import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { encrypt, decrypt, encryptWithKey, decryptWithAnyKey } from '@/lib/encryption';

const OLD_KEY = Buffer.from('old'.padEnd(32, '0')).toString('base64');
const NEW_KEY = Buffer.from('new'.padEnd(32, '0')).toString('base64');

describe('encryption key rotation', () => {
  const originalKey = process.env.AES_KEY;
  const originalPrev = process.env.AES_KEY_PREVIOUS;

  beforeEach(() => {
    process.env.AES_KEY = NEW_KEY;
    delete process.env.AES_KEY_PREVIOUS;
  });

  afterEach(() => {
    process.env.AES_KEY = originalKey;
    if (originalPrev) process.env.AES_KEY_PREVIOUS = originalPrev;
    else delete process.env.AES_KEY_PREVIOUS;
  });

  it('encrypts with new key, decrypts with same new key', () => {
    const cipher = encrypt('secret-data');
    expect(decrypt(cipher)).toBe('secret-data');
  });

  it('decrypts old ciphertext with AES_KEY_PREVIOUS after rotation', () => {
    // 用旧 key 加密
    const oldCipher = encryptWithKey('legacy-data', OLD_KEY);
    // 设置新 key + 旧 key 作为 PREVIOUS
    process.env.AES_KEY = NEW_KEY;
    process.env.AES_KEY_PREVIOUS = OLD_KEY;
    // 用新环境解密
    expect(decryptWithAnyKey(oldCipher)).toBe('legacy-data');
  });

  it('decrypts new ciphertext with AES_KEY after rotation', () => {
    process.env.AES_KEY = NEW_KEY;
    process.env.AES_KEY_PREVIOUS = OLD_KEY;
    const newCipher = encrypt('fresh-data');
    expect(decryptWithAnyKey(newCipher)).toBe('fresh-data');
  });

  it('throws if neither key can decrypt', () => {
    process.env.AES_KEY = NEW_KEY;
    process.env.AES_KEY_PREVIOUS = OLD_KEY;
    const otherCipher = encryptWithKey('other', Buffer.from('oth'.padEnd(32, '0')).toString('base64'));
    expect(() => decryptWithAnyKey(otherCipher)).toThrow();
  });

  it('encrypt always uses AES_KEY (new key), not PREVIOUS', () => {
    process.env.AES_KEY = NEW_KEY;
    process.env.AES_KEY_PREVIOUS = OLD_KEY;
    const cipher = encrypt('test');
    // 用新 key 能解
    expect(decryptWithKey(cipher, NEW_KEY)).toBe('test');
    // 用旧 key 不能解
    expect(() => decryptWithKey(cipher, OLD_KEY)).toThrow();
  });
});

// 辅助：用指定 key 解密
function decryptWithKey(packed: string, keyBase64: string): string {
  const ALGO = 'aes-256-gcm';
  const IV_LEN = 12;
  const buf = Buffer.from(packed.slice(4), 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const enc = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, Buffer.from(keyBase64, 'base64'), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
