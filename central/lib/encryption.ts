import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey(): Buffer {
  const raw = process.env.AES_KEY;
  if (!raw) throw new Error('AES_KEY env var is required');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('AES_KEY must decode to 32 bytes');
  return buf;
}

function getPreviousKey(): Buffer | null {
  const raw = process.env.AES_KEY_PREVIOUS;
  if (!raw) return null;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) return null;
  return buf;
}

function getKeyFromBase64(keyBase64: string): Buffer {
  const buf = Buffer.from(keyBase64, 'base64');
  if (buf.length !== 32) throw new Error('key must decode to 32 bytes');
  return buf;
}

/** 用当前 AES_KEY 加密（标准入口） */
export function encrypt(plaintext: string): string {
  return encryptWithKey(plaintext, getKey());
}

/** 用指定 key 加密（密钥轮换工具用） */
export function encryptWithKey(plaintext: string, key: Buffer | string): string {
  const keyBuf = typeof key === 'string' ? getKeyFromBase64(key) : key;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, keyBuf, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:' + Buffer.concat([iv, tag, enc]).toString('base64');
}

/** 用当前 AES_KEY 解密（不向后兼容旧密钥） */
export function decrypt(packed: string): string {
  return decryptWithKey(packed, getKey());
}

/**
 * 用当前 key 或旧 key 解密（密钥轮换期使用）。
 * 先尝试当前 key，失败后尝试 AES_KEY_PREVIOUS。
 * 两者都失败则抛异常。
 */
export function decryptWithAnyKey(packed: string): string {
  try {
    return decryptWithKey(packed, getKey());
  } catch {
    const prev = getPreviousKey();
    if (!prev) throw new Error('decryption failed: current key cannot decrypt and no previous key configured');
    return decryptWithKey(packed, prev);
  }
}

/** 用指定 key 解密 */
export function decryptWithKey(packed: string, key: Buffer): string {
  if (!packed.startsWith('enc:')) throw new Error('not an encrypted payload');
  const buf = Buffer.from(packed.slice(4), 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const enc = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith('enc:');
}
