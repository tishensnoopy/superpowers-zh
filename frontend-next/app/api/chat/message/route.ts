import { proxyJsonRequest } from '@/lib/chat-proxy';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return proxyJsonRequest('/api/chat/message', body, 'POST');
}
