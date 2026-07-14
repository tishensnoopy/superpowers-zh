/**
 * 获取后端 Strapi API URL（服务端用）
 */
export function getBackendUrl(): string {
  return process.env.STRAPI_API_URL_SSR || process.env.NEXT_PUBLIC_STRAPI_API_URL || 'http://localhost:1337';
}

/**
 * 代理 JSON 请求到后端
 */
export async function proxyJsonRequest(
  backendPath: string,
  body: unknown,
  method: string = 'POST'
): Promise<Response> {
  const backendUrl = `${getBackendUrl()}${backendPath}`;
  const res = await fetch(backendUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 代理 SSE 流式请求到后端
 * 返回 ReadableStream 给客户端
 */
export async function proxySSERequest(
  backendPath: string,
  body: unknown
): Promise<Response> {
  const backendUrl = `${getBackendUrl()}${backendPath}`;
  const res = await fetch(backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const errorText = await res.text().catch(() => '');
    return new Response(
      JSON.stringify({ error: `Backend error: ${res.status}`, detail: errorText }),
      { status: res.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Stream the SSE response directly to the client
  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
