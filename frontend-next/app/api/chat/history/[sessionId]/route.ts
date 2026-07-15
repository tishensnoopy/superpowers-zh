import { proxyJsonRequest } from '@/lib/chat-proxy';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  // 透传 visitorId query 参数用于后端 IDOR 校验
  const visitorId = new URL(request.url).searchParams.get('visitorId');
  const queryString = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
  return proxyJsonRequest(`/api/chat/history/${sessionId}${queryString}`, null, 'GET');
}
