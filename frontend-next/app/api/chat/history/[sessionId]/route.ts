import { proxyJsonRequest } from '@/lib/chat-proxy';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  return proxyJsonRequest(`/api/chat/history/${sessionId}`, null, 'GET');
}
