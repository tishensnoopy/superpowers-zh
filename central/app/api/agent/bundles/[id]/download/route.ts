import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { query } from '@/lib/db';
import { verifyAgentToken } from '@/lib/agent-auth';
import { bundlePath } from '@/lib/bundles';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'missing token' }, { status: 401 });

  const server = await verifyAgentToken(token);
  if (!server) return NextResponse.json({ error: 'invalid token' }, { status: 401 });

  // 防御纵深：非 uuid 直接 400（避免 PG 22P02 500，也挡住路径拼接的意外输入）
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'invalid bundle id' }, { status: 400 });
  }

  const result = await query(`SELECT status FROM bundles WHERE id=$1`, [params.id]);
  if (result.rows.length === 0) return NextResponse.json({ error: 'bundle not found' }, { status: 404 });
  const bundle = result.rows[0] as { status: string };
  if (bundle.status !== 'ready') {
    return NextResponse.json({ error: `bundle not ready (status=${bundle.status})` }, { status: 409 });
  }

  const filePath = bundlePath(params.id);
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'bundle file missing on disk' }, { status: 410 });
  }

  const { size } = statSync(filePath);
  const nodeStream = createReadStream(filePath);
  // existsSync → createReadStream 之间文件被删会产生未处理 error 事件，兜底销毁
  nodeStream.on('error', () => nodeStream.destroy());
  const stream = Readable.toWeb(nodeStream) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      'content-type': 'application/gzip',
      'content-length': String(size),
      'content-disposition': `attachment; filename="${params.id}.tar.gz"`,
    },
  });
}
