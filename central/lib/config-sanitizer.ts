import { encrypt, isEncrypted } from './encryption';

const SENSITIVE_PATHS: string[][] = [
  ['ai', 'dashscopeKey'],
  ['ai', 'wechatAppSecret'],
  ['envOverrides', 'DATABASE_PASSWORD'],
  ['envOverrides', 'REDIS_PASSWORD'],
  ['envOverrides', 'MEILI_MASTER_KEY'],
  ['envOverrides', 'JWT_SECRET'],
];

export function encryptSensitiveFields(config: Record<string, any>): Record<string, any> {
  const cloned = JSON.parse(JSON.stringify(config));
  for (const path of SENSITIVE_PATHS) {
    let obj = cloned;
    for (let i = 0; i < path.length - 1; i++) {
      if (!obj[path[i]]) break;
      obj = obj[path[i]];
    }
    const lastKey = path[path.length - 1];
    if (obj && obj[lastKey] && !isEncrypted(obj[lastKey])) {
      obj[lastKey] = encrypt(String(obj[lastKey]));
    }
  }
  return cloned;
}

export function maskSensitiveFields(config: Record<string, any>): Record<string, any> {
  const cloned = JSON.parse(JSON.stringify(config));
  for (const path of SENSITIVE_PATHS) {
    let obj = cloned;
    for (let i = 0; i < path.length - 1; i++) {
      if (!obj[path[i]]) break;
      obj = obj[path[i]];
    }
    const lastKey = path[path.length - 1];
    if (obj && obj[lastKey]) {
      obj[lastKey] = '••••••••';
    }
  }
  return cloned;
}
