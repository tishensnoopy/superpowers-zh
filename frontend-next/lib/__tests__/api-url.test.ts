import { describe, it, expect } from 'vitest';
import { getApiBaseUrl } from '@/lib/api';

describe('getApiBaseUrl 服务端/客户端 URL 选择', () => {
  it('服务端且设置了 STRAPI_API_URL_SSR 时返回 SSR URL', () => {
    const url = getApiBaseUrl({
      isServer: true,
      serverUrl: 'http://backend:1337',
      clientUrl: 'http://localhost:1337',
    });
    expect(url).toBe('http://backend:1337');
  });

  it('服务端但未设置 SSR URL 时回退到客户端 URL', () => {
    const url = getApiBaseUrl({
      isServer: true,
      serverUrl: undefined,
      clientUrl: 'http://localhost:1337',
    });
    expect(url).toBe('http://localhost:1337');
  });

  it('客户端始终使用客户端 URL（浏览器无法访问 Docker 内部网络）', () => {
    const url = getApiBaseUrl({
      isServer: false,
      serverUrl: 'http://backend:1337',
      clientUrl: 'http://localhost:1337',
    });
    expect(url).toBe('http://localhost:1337');
  });

  it('客户端且未设置任何 URL 时使用默认值', () => {
    const url = getApiBaseUrl({
      isServer: false,
      serverUrl: undefined,
      clientUrl: undefined,
    });
    expect(url).toBe('http://localhost:1337');
  });

  it('服务端 SSR URL 优先于客户端 URL（解决 Docker 容器内 localhost 不通问题）', () => {
    const url = getApiBaseUrl({
      isServer: true,
      serverUrl: 'http://backend:1337',
      clientUrl: 'http://localhost:1337',
    });
    expect(url).not.toBe('http://localhost:1337');
    expect(url).toBe('http://backend:1337');
  });
});
