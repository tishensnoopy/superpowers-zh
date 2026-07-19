import { describe, it, expect, vi } from 'vitest';
import { manageEditorAccount } from '../create-editor-account';

describe('create-editor-account（Editor 面板账号管理）', () => {
  const editorRole = { id: 3, code: 'strapi-editor', name: 'Editor' };

  function makeStrapi(opts: { existingUser?: any } = {}) {
    const create = vi.fn().mockResolvedValue({ id: 10, email: 'client@example.com' });
    const updateById = vi.fn().mockResolvedValue({ id: 10 });
    const findOneUser = vi.fn().mockResolvedValue(opts.existingUser ?? null);
    const findOneRole = vi.fn().mockResolvedValue(editorRole);
    const hashPassword = vi.fn().mockResolvedValue('hashed-pw');
    const strapi: any = {
      db: {
        query: vi.fn((uid: string) => {
          if (uid === 'admin::role') return { findOne: findOneRole };
          if (uid === 'admin::user') return { findOne: findOneUser };
          throw new Error(`unexpected query ${uid}`);
        }),
      },
      service: vi.fn((uid: string) => {
        if (uid === 'admin::user') return { create, updateById };
        if (uid === 'admin::auth') return { hashPassword };
        throw new Error(`unexpected service ${uid}`);
      }),
    };
    return { strapi, create, updateById, findOneUser, hashPassword };
  }

  it('账号不存在 → 创建（Editor 角色 + 哈希密码 + isActive）', async () => {
    const { strapi, create, hashPassword } = makeStrapi();

    const result = await manageEditorAccount(strapi, {
      email: 'client@example.com',
      password: 'Str0ng!Passw0rd',
      firstname: '朱莉',
    });

    expect(hashPassword).not.toHaveBeenCalled(); // 哈希由 admin::user.create 内部完成
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'client@example.com',
        password: 'Str0ng!Passw0rd',
        firstname: '朱莉',
        isActive: true,
        roles: [3],
      })
    );
    expect(result).toEqual({ action: 'created', email: 'client@example.com' });
  });

  it('账号已存在 → 重置密码 + 确保 Editor 角色 + 激活（幂等）', async () => {
    const { strapi, create, updateById } = makeStrapi({
      existingUser: { id: 10, email: 'client@example.com', isActive: false },
    });

    const result = await manageEditorAccount(strapi, {
      email: 'client@example.com',
      password: 'NewPassw0rd!234',
    });

    expect(create).not.toHaveBeenCalled();
    expect(updateById).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ password: 'NewPassw0rd!234', isActive: true, roles: [3] })
    );
    expect(result).toEqual({ action: 'updated', email: 'client@example.com' });
  });

  it('deactivate 模式 → 仅停用不删数据', async () => {
    const { strapi, updateById } = makeStrapi({
      existingUser: { id: 10, email: 'client@example.com', isActive: true },
    });

    const result = await manageEditorAccount(strapi, {
      email: 'client@example.com',
      deactivate: true,
    });

    expect(updateById).toHaveBeenCalledWith(10, expect.objectContaining({ isActive: false }));
    expect(result).toEqual({ action: 'deactivated', email: 'client@example.com' });
  });

  it('strapi-editor 角色不存在 → 抛错', async () => {
    const { strapi } = makeStrapi();
    strapi.db.query = vi.fn(() => ({ findOne: vi.fn().mockResolvedValue(null) }));

    await expect(
      manageEditorAccount(strapi, { email: 'a@b.com', password: 'x'.repeat(12) })
    ).rejects.toThrow('strapi-editor');
  });

  it('创建模式缺 password → 抛错提示', async () => {
    const { strapi } = makeStrapi();
    await expect(
      manageEditorAccount(strapi, { email: 'a@b.com' })
    ).rejects.toThrow('password');
  });
});
