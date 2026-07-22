import { describe, it, expect, vi } from 'vitest';
import index from '../index';
import { SYNCED_UIDS } from '../services/knowledge-sync-service';

describe('register() 生命周期订阅', () => {
  it('订阅的 UID 与 knowledge-sync-service.SYNCED_UIDS 完全一致（防 UID 漂移）', async () => {
    const subscribe = vi.fn();
    const strapi: any = { db: { lifecycles: { subscribe } } };

    await index.register({ strapi });

    // 过滤掉 campus geocoding 订阅（它独立于 SYNCED_UIDS，只有 beforeCreate/beforeUpdate）
    // reconcile 订阅有 afterCreate，geocoding 订阅没有——用此特征区分
    const syncSubs = subscribe.mock.calls.filter((c) => c[0].afterCreate);
    expect(syncSubs.length).toBe(SYNCED_UIDS.length);
    const models = syncSubs.map((c) => c[0].models[0]).sort();
    expect(models).toEqual([...SYNCED_UIDS].sort());
    // 回归：历史上的 bug——注册了不存在的 api::course.course
    expect(models).toContain('api::product.product');
    expect(models).not.toContain('api::course.course');
  });

  it('每个 SYNCED_UIDS 订阅都挂 afterCreate/afterUpdate/afterDelete 三个钩子', async () => {
    const subscribe = vi.fn();
    const strapi: any = { db: { lifecycles: { subscribe } } };

    await index.register({ strapi });

    // 只检查 SYNCED_UIDS 相关订阅（campus geocoding 订阅只有 beforeCreate/beforeUpdate，无 afterCreate）
    for (const call of subscribe.mock.calls) {
      const subscriber = call[0];
      if (!subscriber.afterCreate) continue; // 跳过非 reconcile 订阅
      expect(typeof subscriber.afterCreate).toBe('function');
      expect(typeof subscriber.afterUpdate).toBe('function');
      expect(typeof subscriber.afterDelete).toBe('function');
    }
  });

  it('生命周期钩子以 published 状态为准 reconcile（draft 事件不产生 KB 文档）', async () => {
    let captured: any = null;
    const subscribe = vi.fn((s: any) => {
      if (s.models[0] === 'api::product.product') captured = s;
    });
    const findOnePublished = vi.fn().mockResolvedValue(null); // 无 published 版本（草稿）
    const findOneKb = vi.fn().mockResolvedValue(null); // KB 中也没有
    const createKb = vi.fn();
    const strapi: any = {
      db: {
        lifecycles: { subscribe },
        query: vi.fn(() => ({ findOne: findOneKb })),
      },
      documents: vi.fn((uid: string) => {
        if (uid === 'api::knowledge-base.knowledge-base') return { create: createKb };
        return { findOne: findOnePublished };
      }),
      service: vi.fn(() => ({ deleteVectors: vi.fn() })),
    };

    await index.register({ strapi });
    expect(captured).not.toBeNull();

    // 模拟后台"保存草稿"触发 afterCreate
    await captured.afterCreate({ result: { documentId: 'p1', locale: 'zh-CN', name: '草稿课程' } });

    expect(findOnePublished).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'p1', status: 'published' })
    );
    expect(createKb).not.toHaveBeenCalled();
  });

  it('reconcile 抛错时 handler 不 reject（错误隔离，不阻断后台保存）', async () => {
    let captured: any = null;
    const subscribe = vi.fn((s: any) => {
      if (s.models[0] === 'api::product.product') captured = s;
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const strapi: any = {
      db: { lifecycles: { subscribe }, query: vi.fn(() => ({ findOne: vi.fn() })) },
      documents: vi.fn(() => { throw new Error('DB down'); }),
      service: vi.fn(() => ({ deleteVectors: vi.fn() })),
    };
    await index.register({ strapi });
    await expect(captured.afterCreate({ result: { documentId: 'p1', locale: 'zh-CN' } })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ============ campus geocoding lifecycle 测试 ============

describe('register() campus geocoding lifecycle', () => {
  // SYNCED_UIDS 已包含 api::campus.campus（reconcile 订阅），geocoding 订阅是第二个 campus 订阅。
  // 用 beforeCreate 特征区分：reconcile 订阅有 afterCreate 无 beforeCreate，geocoding 订阅有 beforeCreate 无 afterCreate。
  const findCampusGeocodeSub = (subscribe: any) =>
    subscribe.mock.calls.find(
      (c: any) =>
        c[0].models[0] === 'api::campus.campus' &&
        typeof c[0].beforeCreate === 'function'
    );

  it('订阅 campus 的 beforeCreate/beforeUpdate 钩子', async () => {
    const subscribe = vi.fn();
    const strapi: any = { db: { lifecycles: { subscribe } } };

    await index.register({ strapi });

    const campusSub = findCampusGeocodeSub(subscribe);
    expect(campusSub).toBeDefined();
    expect(typeof campusSub![0].beforeCreate).toBe('function');
    expect(typeof campusSub![0].beforeUpdate).toBe('function');
  });

  it('beforeCreate: address 非空时调用 geocodeAddress 并填充 lat/lng/formattedAddress', async () => {
    process.env.AMAP_WEB_SERVICE_KEY = 'test-key';
    const subscribe = vi.fn();
    const strapi: any = { db: { lifecycles: { subscribe } } };

    // vi.doMock 对动态 import 生效需配合 vi.resetModules 清缓存 + 重新 import index
    vi.resetModules();
    vi.doMock('../services/amap-geocode-service', () => ({
      geocodeAddress: vi.fn().mockResolvedValue({
        latitude: 30.6486,
        longitude: 114.3185,
        formattedAddress: '湖北省武汉市江岸区百步亭花园',
      }),
    }));
    const indexFresh = (await import('../index')).default;

    await indexFresh.register({ strapi });

    const campusSub = findCampusGeocodeSub(subscribe);

    const eventData = { params: { data: { address: '武汉市江岸区百步亭' } } };
    await campusSub![0].beforeCreate(eventData);

    expect(eventData.params.data.latitude).toBe(30.6486);
    expect(eventData.params.data.longitude).toBe(114.3185);
    expect(eventData.params.data.formattedAddress).toBe('湖北省武汉市江岸区百步亭花园');

    vi.doUnmock('../services/amap-geocode-service');
    delete process.env.AMAP_WEB_SERVICE_KEY;
  });

  it('beforeUpdate: address 未变时不覆盖现有坐标', async () => {
    const subscribe = vi.fn();
    const existingAddress = '武汉市江岸区百步亭';
    const findOne = vi.fn().mockResolvedValue({ address: existingAddress });
    const strapi: any = {
      db: {
        lifecycles: { subscribe },
        query: vi.fn(() => ({ findOne })),
      },
    };

    await index.register({ strapi });

    const campusSub = findCampusGeocodeSub(subscribe);

    const eventData = {
      params: { data: { address: existingAddress }, where: { id: 1 } },
    };
    await campusSub![0].beforeUpdate(eventData);

    expect(findOne).toHaveBeenCalled();
    expect(eventData.params.data.latitude).toBeUndefined();
  });

  it('beforeUpdate: address 变化时调用 geocodeAddress 覆盖坐标', async () => {
    process.env.AMAP_WEB_SERVICE_KEY = 'test-key';
    const subscribe = vi.fn();
    const findOne = vi.fn().mockResolvedValue({ address: '旧地址' });
    const strapi: any = {
      db: {
        lifecycles: { subscribe },
        query: vi.fn(() => ({ findOne })),
      },
    };

    vi.resetModules();
    vi.doMock('../services/amap-geocode-service', () => ({
      geocodeAddress: vi.fn().mockResolvedValue({
        latitude: 30.65,
        longitude: 114.32,
        formattedAddress: '新地址标准化',
      }),
    }));
    const indexFresh = (await import('../index')).default;

    await indexFresh.register({ strapi });

    const campusSub = findCampusGeocodeSub(subscribe);

    const eventData = {
      params: { data: { address: '新地址' }, where: { id: 1 } },
    };
    await campusSub![0].beforeUpdate(eventData);

    expect(eventData.params.data.latitude).toBe(30.65);
    expect(eventData.params.data.longitude).toBe(114.32);
    expect(eventData.params.data.formattedAddress).toBe('新地址标准化');

    vi.doUnmock('../services/amap-geocode-service');
    delete process.env.AMAP_WEB_SERVICE_KEY;
  });

  it('geocodeAddress 失败时不阻断保存（返回 null 时数据原样保留）', async () => {
    process.env.AMAP_WEB_SERVICE_KEY = 'test-key';
    const subscribe = vi.fn();
    const findOne = vi.fn().mockResolvedValue({ address: '旧地址' });
    const strapi: any = {
      db: {
        lifecycles: { subscribe },
        query: vi.fn(() => ({ findOne })),
      },
    };

    vi.resetModules();
    vi.doMock('../services/amap-geocode-service', () => ({
      geocodeAddress: vi.fn().mockResolvedValue(null),  // 模拟失败
    }));
    const indexFresh = (await import('../index')).default;

    await indexFresh.register({ strapi });

    const campusSub = findCampusGeocodeSub(subscribe);

    const eventData = {
      params: { data: { address: '新地址', latitude: 99, longitude: 99 }, where: { id: 1 } },
    };

    await expect(campusSub![0].beforeUpdate(eventData)).resolves.toBeUndefined();
    expect(eventData.params.data.latitude).toBe(99);

    vi.doUnmock('../services/amap-geocode-service');
    delete process.env.AMAP_WEB_SERVICE_KEY;
  });
});
