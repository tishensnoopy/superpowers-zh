import { NextRequest } from 'next/server';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { query } from '@/lib/db';
import { verifyAgentToken } from '@/lib/agent-auth';
import { bundlePath } from '@/lib/bundles';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return Response.json({ error: 'missing token' }, { status: 401 });

  const server = await verifyAgentToken(token);
  if (!server) return Response.json({ error: 'invalid token' }, { status: 401 });

  const result = await query(`SELECT status FROM bundles WHERE id=$1`, [params.id]);
  if (result.rows.length === 0) return Response.json({ error: 'bundle not found' }, { status: 404 });
  const bundle = result.rows[0] as { status: string };
  if (bundle.status !== 'ready') {
    return Response.json({ error: `bundle not ready (status=${bundle.status})` }, { status: 409 });
  }

  const filePath = bundlePath(params.id);
  if (!existsSync(filePath)) {
    return Response.json({ error: 'bundle file missing on disk' }, { status: 410 });
  }

  const { size } = statSync(filePath);
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      'content-type': 'application/gzip',
      'content-length': String(size),
      'content-disposition': `attachment; filename="${params.id}.tar.gz"`,
    },
  });
}
