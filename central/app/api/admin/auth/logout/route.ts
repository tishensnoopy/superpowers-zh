import { json } from '@/lib/api-helpers';
import { COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const res = json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return res;
}
