import { describe, it, expect, vi } from 'vitest';

// vitest 走 ESM 条件加载 @strapi/strapi（.mjs）会因 lodash/fp 目录导入报错，
// 且这里只需要 createCoreService 把 cfg 函数包成 ({ strapi }) => service 工厂，直接 mock。
vi.mock('@strapi/strapi', () => ({
  factories: {
    createCoreService: (_uid: string, cfg: any) => (ctx: any) =>
      typeof cfg === 'function' ? cfg(ctx) : (cfg ?? {}),
  },
}));

import serviceFactory from '../services/knowledge-base';

describe('knowledge-base.initializeDefaults（母站隔离：零硬编码种子）', () => {
  it('KB 为空也不创建任何种子文档，返回空数组', async () => {
    const strapi: any = {
      db: { query: vi.fn(() => ({ findMany: vi.fn() })) },
    };
    const service: any = (serviceFactory as any)({ strapi });

    const result = await service.initializeDefaults();

    expect(result).toEqual([]);
    // 不得触达 DB（读都不需要，直接返回空数组）
    expect(strapi.db.query).not.toHaveBeenCalled();
  });
});
