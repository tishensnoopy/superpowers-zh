import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function stringifyEnv(env: Record<string, string>): string {
  return Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
}

export function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  return parseEnv(readFileSync(path, 'utf8'));
}

export function syncEnvFile(path: string, updates: Record<string, string>): void {
  const existing = readEnvFile(path);
  const merged = { ...existing, ...updates };
  writeFileSync(path, stringifyEnv(merged), { mode: 0o600 });
}

export function writeEnvFile(path: string, env: Record<string, string>): void {
  writeFileSync(path, stringifyEnv(env), { mode: 0o600 });
}
