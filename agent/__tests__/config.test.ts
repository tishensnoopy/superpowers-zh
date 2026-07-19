import { describe, it, expect } from 'vitest';
import { apiUrlFromWsUrl } from '../src/config';

describe('apiUrlFromWsUrl（从 WS URL 推导 API base）', () => {
  it('wss → https，去掉尾部 /ws', () => {
    expect(apiUrlFromWsUrl('wss://central.example.com/api/agent/ws')).toBe(
      'https://central.example.com/api/agent'
    );
  });

  it('ws → http，保留端口', () => {
    expect(apiUrlFromWsUrl('ws://localhost:3000/api/agent/ws')).toBe(
      'http://localhost:3000/api/agent'
    );
  });

  it('根路径 /ws → 源站根', () => {
    expect(apiUrlFromWsUrl('wss://central.example.com/ws')).toBe('https://central.example.com');
  });

  it('尾部斜杠容错', () => {
    expect(apiUrlFromWsUrl('wss://central.example.com/api/agent/ws/')).toBe(
      'https://central.example.com/api/agent'
    );
  });
});
