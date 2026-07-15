import { describe, it, expect } from 'vitest';
import zhCN from '../zh-CN.json';
import enUS from '../en-US.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe('i18n messages key completeness', () => {
  const zhKeys = flattenKeys(zhCN as Record<string, unknown>);
  const enKeys = flattenKeys(enUS as Record<string, unknown>);

  it('zh-CN has all keys that en-US has', () => {
    const missing = enKeys.filter(k => !zhKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it('en-US has all keys that zh-CN has', () => {
    const missing = zhKeys.filter(k => !enKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it('both have at least the core namespaces', () => {
    expect(zhCN).toHaveProperty('common');
    expect(zhCN).toHaveProperty('navigation');
    expect(zhCN).toHaveProperty('footer');
    expect(zhCN).toHaveProperty('chat');
    expect(enUS).toHaveProperty('common');
    expect(enUS).toHaveProperty('navigation');
    expect(enUS).toHaveProperty('footer');
    expect(enUS).toHaveProperty('chat');
  });
});
