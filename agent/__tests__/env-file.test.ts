import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { syncEnvFile, readEnvFile, parseEnv, stringifyEnv } from '../src/lib/env-file';

const TMP = '/tmp/test.env';

describe('parseEnv + stringifyEnv', () => {
  it('roundtrips basic key=value pairs', () => {
    const content = 'FOO=bar\nBAZ=qux\n';
    const parsed = parseEnv(content);
    expect(parsed).toEqual({ FOO: 'bar', BAZ: 'qux' });
    expect(stringifyEnv(parsed)).toBe('FOO=bar\nBAZ=qux\n');
  });

  it('preserves quotes and special chars', () => {
    const content = 'KEY="hello world"\nNUM=42\n';
    const parsed = parseEnv(content);
    expect(parsed.KEY).toBe('hello world');
    expect(parsed.NUM).toBe('42');
  });

  it('skips comments and empty lines', () => {
    const content = '# comment\n\nFOO=bar\n';
    const parsed = parseEnv(content);
    expect(parsed).toEqual({ FOO: 'bar' });
  });
});

describe('syncEnvFile', () => {
  beforeEach(() => writeFileSync(TMP, 'EXISTING=old\nOTHER=val\n', { mode: 0o600 }));
  afterEach(() => { if (existsSync(TMP)) unlinkSync(TMP); });

  it('updates existing keys and adds new ones, preserves others', () => {
    syncEnvFile(TMP, { EXISTING: 'new', NEW_KEY: 'added' });
    const content = readFileSync(TMP, 'utf8');
    expect(content).toContain('EXISTING=new');
    expect(content).toContain('NEW_KEY=added');
    expect(content).toContain('OTHER=val');
  });
});
