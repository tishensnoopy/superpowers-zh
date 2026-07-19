import { describe, it, expect, vi } from 'vitest';
import { ensureAdminLocalePermissions, ensureEditorContentPermissions } from '../admin-locale-perms';

/**
 * 背景（2026-07-19 线上事故）：老版本 Strapi 创建的 Editor/Author 角色权限
 * properties 里缺 locales 属性，i18n 引擎对"缺失"的语义是注入 locale:{$in:[]}，
 * 导致 Editor 文档级读写全部 403（模型级 can.read=true 具有迷惑性）。
 * 修复与 Strapi 5.50+ normalizeRolePermissionsLocales 对齐：缺/空则补，null 不动。
 */
describe('ensureAdminLocalePermissions（Editor/Author 本地化权限自愈）', () => {
  function makeStrapi(opts: {
    localeCodes?: string[];
    roles?: any[];
    permissions?: any[];
    contentTypes?: Record<string, any>;
    localizedUids?: string[];
  }) {
    const update = vi.fn().mockResolvedValue({});
    const findManyRole = vi.fn().mockResolvedValue(opts.roles ?? [{ id: 2, code: 'strapi-editor' }]);
    const findManyPerm = vi.fn().mockResolvedValue(opts.permissions ?? []);
    const localeFind = vi.fn().mockResolvedValue((opts.localeCodes ?? ['zh-CN', 'en-US']).map((code) => ({ code })));
    const isLocalizedContentType = vi.fn(
      (ct: any) => !!ct && (opts.localizedUids ?? ['api::product.product']).includes(ct.uid)
    );

    const strapi: any = {
      plugin: vi.fn((name: string) => {
        if (name !== 'i18n') throw new Error(`unexpected plugin ${name}`);
        return {
          service: vi.fn((svc: string) => {
            if (svc === 'locales') return { find: localeFind };
            if (svc === 'content-types') return { isLocalizedContentType };
            throw new Error(`unexpected service ${svc}`);
          }),
        };
      }),
      db: {
        query: vi.fn((uid: string) => {
          if (uid === 'admin::role') return { findMany: findManyRole };
          if (uid === 'admin::permission') return { findMany: findManyPerm, update };
          throw new Error(`unexpected query ${uid}`);
        }),
      },
      contentTypes: opts.contentTypes ?? {
        'api::product.product': { uid: 'api::product.product' },
        'api::campus.campus': { uid: 'api::campus.campus' },
      },
    };
    return { strapi, update };
  }

  it('缺失 locales 的本地化权限 → 补全量已启用 locale', async () => {
    const { strapi, update } = makeStrapi({
      permissions: [
        { id: 31, action: 'plugin::content-manager.explorer.read', subject: 'api::product.product', properties: { fields: ['name'] } },
      ],
    });

    const result = await ensureAdminLocalePermissions(strapi);

    expect(update).toHaveBeenCalledWith({
      where: { id: 31 },
      data: { properties: { fields: ['name'], locales: ['zh-CN', 'en-US'] } },
    });
    expect(result.patched).toBe(1);
  });

  it('locales 为空数组 → 同样补齐（空数组语义=无任何语言）', async () => {
    const { strapi, update } = makeStrapi({
      permissions: [
        { id: 31, action: 'plugin::content-manager.explorer.read', subject: 'api::product.product', properties: { fields: ['name'], locales: [] } },
      ],
    });

    const result = await ensureAdminLocalePermissions(strapi);

    expect(update).toHaveBeenCalled();
    expect(result.patched).toBe(1);
  });

  it('locales=null（全语言可访问）→ 不动', async () => {
    const { strapi, update } = makeStrapi({
      permissions: [
        { id: 31, action: 'plugin::content-manager.explorer.read', subject: 'api::product.product', properties: { fields: ['name'], locales: null } },
      ],
    });

    const result = await ensureAdminLocalePermissions(strapi);

    expect(update).not.toHaveBeenCalled();
    expect(result.patched).toBe(0);
  });

  it('locales 已有值但缺已启用 locale → 并集补全（只增不减，新增 locale 后历史权限行自动跟上）', async () => {
    // 真实事故（2026-07-20 本地实测）：权限行 locales=['zh-CN'] 是 zh-CN 为唯一
    // locale 时种下的，后加 en-US 后已有行不跟上，Editor locale 切换器只剩中文，
    // 双语内容管理流程（手册 §2）直接失效。
    const { strapi, update } = makeStrapi({
      permissions: [
        { id: 31, action: 'plugin::content-manager.explorer.read', subject: 'api::product.product', properties: { fields: ['name'], locales: ['zh-CN'] } },
      ],
    });

    const result = await ensureAdminLocalePermissions(strapi);

    expect(update).toHaveBeenCalledWith({
      where: { id: 31 },
      data: { properties: { fields: ['name'], locales: ['zh-CN', 'en-US'] } },
    });
    expect(result.patched).toBe(1);
  });

  it('locales 已含全部已启用 locale → 不动（幂等）', async () => {
    const { strapi, update } = makeStrapi({
      permissions: [
        { id: 31, action: 'plugin::content-manager.explorer.read', subject: 'api::product.product', properties: { fields: ['name'], locales: ['zh-CN', 'en-US'] } },
      ],
    });

    const result = await ensureAdminLocalePermissions(strapi);

    expect(update).not.toHaveBeenCalled();
    expect(result.patched).toBe(0);
  });

  it('非本地化内容类型 / 无 subject 的 plugin 权限 → 不动', async () => {
    const { strapi, update } = makeStrapi({
      permissions: [
        { id: 1, action: 'plugin::upload.read', subject: null, properties: {} },
        { id: 2, action: 'plugin::content-manager.explorer.read', subject: 'api::campus.campus', properties: { fields: ['name'] } },
      ],
      localizedUids: ['api::product.product'], // campus 不在其中 → 非本地化
    });

    const result = await ensureAdminLocalePermissions(strapi);

    expect(update).not.toHaveBeenCalled();
    expect(result.patched).toBe(0);
  });

  it('幂等：重复执行第二次 patched=0', async () => {
    const perm = { id: 31, action: 'plugin::content-manager.explorer.read', subject: 'api::product.product', properties: { fields: ['name'] } };
    const { strapi, update } = makeStrapi({ permissions: [perm] });

    const first = await ensureAdminLocalePermissions(strapi);
    expect(first.patched).toBe(1);

    // 模拟第一次修复后的 DB 状态
    perm.properties = { ...perm.properties, locales: ['zh-CN', 'en-US'] };
    update.mockClear();
    const second = await ensureAdminLocalePermissions(strapi);
    expect(second.patched).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('未启用任何 locale（i18n 未初始化）→ 跳过不报错', async () => {
    const { strapi, update } = makeStrapi({
      localeCodes: [],
      permissions: [
        { id: 31, action: 'plugin::content-manager.explorer.read', subject: 'api::product.product', properties: { fields: ['name'] } },
      ],
    });

    const result = await ensureAdminLocalePermissions(strapi);

    expect(result.patched).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});

/**
 * 背景（2026-07-19 冒烟实测发现）：老库的 strapi-editor 角色对后加的内容类型
 * 缺整行权限（5 个 draftAndPublish 类型无 publish 行、13 个类型无 delete 行），
 * 根因是 Strapi 只在角色首次创建时种默认权限，之后新增内容类型不会补。
 * 自愈对齐 Strapi 内置 createRolesIfNoneExist 的 Editor 能力矩阵：
 *   全内容类型 CRUD + 有 draftAndPublish 的类型加 publish。Author 不动（本项目不用）。
 */
describe('ensureEditorContentPermissions（Editor 权限行自愈）', () => {
  const CT = {
    'api::product.product': { uid: 'api::product.product', options: { draftAndPublish: true } },
    'api::campus.campus': { uid: 'api::campus.campus', options: { draftAndPublish: true } },
    'api::faq-item.faq-item': { uid: 'api::faq-item.faq-item', options: {} },
    'api::ai-config.ai-config': { uid: 'api::ai-config.ai-config', options: { draftAndPublish: true } },
    'api::vector-config.vector-config': { uid: 'api::vector-config.vector-config', options: {} },
  };

  function makeStrapi2(opts: { permissions: any[]; localeCodes?: string[] }) {
    const create = vi.fn().mockResolvedValue({});
    const del = vi.fn().mockResolvedValue({});
    const findManyRole = vi.fn().mockResolvedValue([{ id: 2, code: 'strapi-editor' }]);
    const findManyPerm = vi.fn().mockResolvedValue(opts.permissions);
    const localeFind = vi.fn().mockResolvedValue((opts.localeCodes ?? ['zh-CN', 'en-US']).map((code) => ({ code })));
    const strapi: any = {
      plugin: vi.fn(() => ({
        service: vi.fn((svc: string) => {
          if (svc === 'locales') return { find: localeFind };
          throw new Error(`unexpected service ${svc}`);
        }),
      })),
      db: {
        query: vi.fn((uid: string) => {
          if (uid === 'admin::role') return { findMany: findManyRole };
          if (uid === 'admin::permission') return { findMany: findManyPerm, create, delete: del };
          throw new Error(`unexpected query ${uid}`);
        }),
      },
      contentTypes: CT,
    };
    return { strapi, create, del };
  }

  it('draftAndPublish 类型缺 publish/delete 行 → 补齐（含 locales 属性）', async () => {
    const { strapi, create } = makeStrapi2({
      permissions: [
        { id: 1, action: 'plugin::content-manager.explorer.create', subject: 'api::product.product', properties: {} },
        { id: 2, action: 'plugin::content-manager.explorer.read', subject: 'api::product.product', properties: {} },
        { id: 3, action: 'plugin::content-manager.explorer.update', subject: 'api::product.product', properties: {} },
      ],
    });

    const result = await ensureEditorContentPermissions(strapi);

    const createdActions = create.mock.calls.map((c) => `${c[0].data.action}|${c[0].data.subject}`).sort();
    expect(createdActions).toEqual([
      'plugin::content-manager.explorer.delete|api::campus.campus',
      'plugin::content-manager.explorer.delete|api::faq-item.faq-item',
      'plugin::content-manager.explorer.delete|api::product.product',
      'plugin::content-manager.explorer.publish|api::campus.campus',
      'plugin::content-manager.explorer.publish|api::product.product',
      'plugin::content-manager.explorer.create|api::campus.campus',
      'plugin::content-manager.explorer.create|api::faq-item.faq-item',
      'plugin::content-manager.explorer.read|api::campus.campus',
      'plugin::content-manager.explorer.read|api::faq-item.faq-item',
      'plugin::content-manager.explorer.update|api::campus.campus',
      'plugin::content-manager.explorer.update|api::faq-item.faq-item',
    ].sort());
    // 每行都带 locales（防 i18n 引擎注入空条件）且归属 editor 角色
    for (const call of create.mock.calls) {
      expect(call[0].data.role).toBe(2);
      expect(call[0].data.properties.locales).toEqual(['zh-CN', 'en-US']);
      expect(call[0].data.conditions).toEqual([]);
    }
    // 无 draftAndPublish 的 faq-item 不得有 publish 行
    expect(createdActions.some((a) => a.includes('publish') && a.includes('faq-item'))).toBe(false);
    expect(result.created).toBe(11);
  });

  it('敏感类型（ai-config/vector-config，超管专属）：不补建 + 回收已有行', async () => {
    const { strapi, create, del } = makeStrapi2({
      permissions: [
        { id: 90, action: 'plugin::content-manager.explorer.read', subject: 'api::ai-config.ai-config', properties: {} },
        { id: 91, action: 'plugin::content-manager.explorer.create', subject: 'api::ai-config.ai-config', properties: {} },
        { id: 92, action: 'plugin::content-manager.explorer.update', subject: 'api::vector-config.vector-config', properties: {} },
        { id: 1, action: 'plugin::content-manager.explorer.create', subject: 'api::product.product', properties: {} },
        { id: 2, action: 'plugin::content-manager.explorer.read', subject: 'api::product.product', properties: {} },
        { id: 3, action: 'plugin::content-manager.explorer.update', subject: 'api::product.product', properties: {} },
        { id: 4, action: 'plugin::content-manager.explorer.delete', subject: 'api::product.product', properties: {} },
        { id: 5, action: 'plugin::content-manager.explorer.publish', subject: 'api::product.product', properties: {} },
      ],
    });

    const result = await ensureEditorContentPermissions(strapi);

    // 敏感类型一行都不建
    const createdSubjects = create.mock.calls.map((c) => c[0].data.subject);
    expect(createdSubjects).not.toContain('api::ai-config.ai-config');
    expect(createdSubjects).not.toContain('api::vector-config.vector-config');
    // 已有的 3 条敏感行被回收
    const deletedIds = del.mock.calls.map((c) => c[0].where.id).sort();
    expect(deletedIds).toEqual([90, 91, 92]);
    expect(result.revoked).toBe(3);
  });

  it('权限行已齐 → 不重复创建（幂等）', async () => {
    const full = ['create', 'read', 'update', 'delete', 'publish'].map((a, i) => ({
      id: i + 1,
      action: `plugin::content-manager.explorer.${a}`,
      subject: 'api::product.product',
      properties: {},
    }));
    for (const uid of ['api::campus.campus']) {
      for (const a of ['create', 'read', 'update', 'delete', 'publish']) {
        full.push({ id: full.length + 1, action: `plugin::content-manager.explorer.${a}`, subject: uid, properties: {} });
      }
    }
    for (const a of ['create', 'read', 'update', 'delete']) {
      full.push({ id: full.length + 1, action: `plugin::content-manager.explorer.${a}`, subject: 'api::faq-item.faq-item', properties: {} });
    }
    const { strapi, create, del } = makeStrapi2({ permissions: full });

    const result = await ensureEditorContentPermissions(strapi);

    expect(create).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.revoked).toBe(0);
  });

  it('strapi-editor 角色不存在 → 跳过不报错', async () => {
    const { strapi, create } = makeStrapi2({ permissions: [] });
    strapi.db.query = vi.fn((uid: string) => {
      if (uid === 'admin::role') return { findMany: vi.fn().mockResolvedValue([]) };
      if (uid === 'admin::permission') return { findMany: vi.fn().mockResolvedValue([]), create };
      throw new Error(`unexpected query ${uid}`);
    });

    const result = await ensureEditorContentPermissions(strapi);

    expect(result.created).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });
});
