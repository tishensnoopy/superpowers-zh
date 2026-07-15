import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword, verifyPassword, signJwt, verifyJwt } from '@/lib/auth';

describe('auth', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-32-bytes-xxxxxxxxxxxxx';
  });

  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('Admin123!');
    expect(hash).not.toBe('Admin123!');
    expect(await verifyPassword('Admin123!', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('signs and verifies JWT', async () => {
    const token = await signJwt({ sub: 'user-1', email: 'a@b.c', role: 'admin' });
    const payload = await verifyJwt(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('a@b.c');
    expect(payload.role).toBe('admin');
  });

  it('rejects tampered JWT', async () => {
    const token = await signJwt({ sub: 'user-1', email: 'a@b.c', role: 'admin' });
    const tampered = token.slice(0, -4) + 'XXXX';
    await expect(verifyJwt(tampered)).rejects.toThrow();
  });

  it('rejects invalid token format', async () => {
    await expect(verifyJwt('not.a.jwt')).rejects.toThrow();
    await expect(verifyJwt('garbage')).rejects.toThrow();
  });

  it('throws when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;
    await expect(signJwt({ sub: 'x', email: 'x@x.x', role: 'admin' })).rejects.toThrow(/JWT_SECRET env var is required/);
    await expect(verifyJwt('eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0IjoxfQ.xxx')).rejects.toThrow(/JWT_SECRET env var is required/);
  });

  it('throws when JWT_SECRET is too short', async () => {
    process.env.JWT_SECRET = 'short';
    await expect(signJwt({ sub: 'x', email: 'x@x.x', role: 'admin' })).rejects.toThrow(/at least 32 characters/);
  });
});
