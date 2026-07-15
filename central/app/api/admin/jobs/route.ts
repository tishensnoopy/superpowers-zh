import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { listJobs } from '@/lib/job-manager';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { searchParams } = req.nextUrl;
  const serverId = searchParams.get('serverId') ?? undefined;
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const items = await listJobs({ serverId, limit, offset });
  return json({ items });
}
