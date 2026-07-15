import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { addSSEClient, removeSSEClient } from '@/lib/sse-broadcaster';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  // 验证 job 存在
  const job = await query(`SELECT id, status FROM deploy_jobs WHERE id=$1`, [params.id]);
  if (job.rows.length === 0) {
    return new Response('Job not found', { status: 404 });
  }

  const jobId = params.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writer = {
        write: (chunk: Uint8Array): Promise<void> => {
          try {
            controller.enqueue(chunk);
          } catch {
            // controller 已关闭
          }
          return Promise.resolve();
        },
        close: () => {
          try { controller.close(); } catch {}
        },
        closed: false,
      } as unknown as WritableStreamDefaultWriter<Uint8Array>;

      // 1. 发送 SSE 头部注释（保活）
      controller.enqueue(encoder.encode(`: connected to job ${jobId}\n\n`));

      // 2. 发送当前 job 状态快照
      query(`SELECT * FROM deploy_jobs WHERE id=$1`, [jobId]).then((res) => {
        const snapshot = res.rows[0];
        try {
          controller.enqueue(encoder.encode(`event: job:snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`));
        } catch {
          // 流已关闭
        }
      }).catch(() => {
        // 忽略查询失败
      });

      // 3. 发送历史日志（最近 500 行，按时间升序展示）
      query(
        `SELECT ts, stream, line FROM (
           SELECT ts, stream, line FROM job_logs WHERE job_id=$1 ORDER BY ts DESC LIMIT 500
         ) sub ORDER BY ts ASC`,
        [jobId]
      ).then((res) => {
        for (const row of res.rows) {
          try {
            controller.enqueue(encoder.encode(
              `event: job:log\ndata: ${JSON.stringify(row)}\n\n`
            ));
          } catch {
            // 流已关闭，停止发送历史日志
            break;
          }
        }
      }).catch(() => {
        // 忽略查询失败
      });

      // 4. 注册到 SSE 广播器，接收后续实时日志
      addSSEClient(jobId, writer);

      // 5. 心跳：每 25 秒发注释行，防止代理超时
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // 6. 客户端断开时清理
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        removeSSEClient(jobId, writer);
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      // ReadableStream 被 cancel（浏览器关闭）
      // removeSSEClient 已在 abort 处理器中调用
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',  // nginx 不缓冲
    },
  });
}
