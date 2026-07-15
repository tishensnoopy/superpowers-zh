import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { listJobs } from '@/lib/job-manager';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { searchParams } = req.nextUrl;
  const serverId = searchParams.get('serverId') ?? undefined;
  const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10);
  const offsetRaw = parseInt(searchParams.get('offset') ?? '0', 10);
  // 防御 NaN / 负数，回退到默认值
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 50;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  const items = await listJobs({ serverId, limit, offset });
  return json({ items });
}
