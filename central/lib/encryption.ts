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

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:' + Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(packed: string): string {
  if (!packed.startsWith('enc:')) throw new Error('not an encrypted payload');
  const buf = Buffer.from(packed.slice(4), 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const enc = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith('enc:');
}
