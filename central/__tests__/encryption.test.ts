import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';

describe('encryption', () => {
  beforeEach(() => {
    process.env.AES_KEY = Buffer.alloc(32, 1).toString('base64');
  });

  it('encrypts and decrypts roundtrip', () => {
    const plain = 'sk-dashscope-abc123';
    const cipher = encrypt(plain);
    expect(cipher).not.toBe(plain);
    expect(cipher).toMatch(/^enc:/);
    expect(decrypt(cipher)).toBe(plain);
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const a = encrypt('same');
    const b = encrypt('same');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same');
    expect(decrypt(b)).toBe('same');
  });

  it('throws on tampered ciphertext', () => {
    const cipher = encrypt('secret');
    const tampered = cipher.slice(0, -4) + 'XXXX';
    expect(() => decrypt(tampered)).toThrow();
  });

  it('isEncrypted correctly identifies encrypted values', () => {
    expect(isEncrypted(encrypt('test'))).toBe(true);
    expect(isEncrypted('plain-text')).toBe(false);
    expect(isEncrypted('enc:invalid-base64')).toBe(true);  // 只检查前缀
    expect(isEncrypted('')).toBe(false);
  });

  it('decrypt throws on non-enc-prefixed input', () => {
    expect(() => decrypt('plain-text')).toThrow(/not an encrypted payload/);
    expect(() => decrypt('')).toThrow(/not an encrypted payload/);
  });

  it('throws when AES_KEY is missing', () => {
    delete process.env.AES_KEY;
    expect(() => encrypt('test')).toThrow(/AES_KEY env var is required/);
    expect(() => decrypt('enc:dGVzdA==')).toThrow(/AES_KEY env var is required/);
  });
});
