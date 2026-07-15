/**
 * Document processing queue + worker.
 *
 * Pipeline: fetch knowledge-base document -> clean text -> chunk ->
 * generate embedding -> write to pgvector (`knowledge_embeddings`).
 *
 * Job data shapes accepted (the existing knowledge-base controller enqueues
 * `{ type, documentId }` with the numeric `id`; newer callers may use
 * `{ knowledgeBaseId }`):
 *   - { knowledgeBaseId: number }
 *   - { documentId: number, type?: 'vectorize' | 'revectorize' }
 *
 * `llm-service` is required via a deferred require() so this module can load
 * even before the LLM service file exists (incremental dev / boot safety).
 *
 * Worker lifecycle:
 *   - `startDocumentWorker(strapi)` creates and starts the Worker, saving the
 *     instance to `documentWorkerInstance` for later shutdown.
 *   - `closeDocumentWorker()` gracefully closes the Worker. Called from
 *     `src/index.ts` destroy() before `closeAllQueues()`.
 *   - The Queue (`documentQueue`) is a producer-only instance; consumers that
 *     enqueue via `utils/queue.addJob()` do not need it.
 *
 * Schema bootstrap:
 *   - `ensureSchema(strapi)` lazily creates the `knowledge_embeddings`
 *     pgvector table on the first job, making the worker self-sufficient.
 */
import { Queue, Worker } from 'bullmq';

const QUEUE_NAME = 'document-processing';
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

/**
 * Producer for the document-processing queue. Callers that already enqueue via
 * `utils/queue.addJob('document-processing', ...)` do not need this instance —
 * BullMQ routes jobs by queue name regardless of which Queue instance produced
 * them. It is exported for convenience and for explicit typed access.
 */
export const documentQueue = new Queue(QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400 },
  },
});

/* -------------------------------------------------------------------------- */
/* Schema bootstrap (idempotent)                                              */
/* -------------------------------------------------------------------------- */

/**
 * Ensures the `knowledge_embeddings` pgvector table exists. The table is a raw
 * SQL table (not a Strapi content type) so it must be created out-of-band.
 * Running this lazily on the first job makes the worker self-sufficient.
 */
async function ensureSchema(strapi: any): Promise<void> {
  const db = strapi.db.connection;

  try {
    await db.raw('CREATE EXTENSION IF NOT EXISTS vector');
  } catch (err) {
    // Extension may already exist or require superuser privileges; the INSERT
    // below will surface a clearer error if the extension is truly missing.
    console.warn(
      '[Queue] CREATE EXTENSION vector skipped:',
      err instanceof Error ? err.message : err
    );
  }

  await db.raw(`
    CREATE TABLE IF NOT EXISTS knowledge_embeddings (
      id BIGSERIAL PRIMARY KEY,
      knowledge_base_id BIGINT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding vector,
      source_type VARCHAR(50) DEFAULT 'document',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_kb_id ON knowledge_embeddings (knowledge_base_id)'
  );

  console.log('[Queue] knowledge_embeddings schema ensured');
}

let schemaPromise: Promise<void> | null = null;
function ensureSchemaOnce(strapi: any): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = ensureSchema(strapi).catch((err) => {
      // Reset so a later job can retry schema setup.
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

/* -------------------------------------------------------------------------- */
/* Text helpers                                                               */
/* -------------------------------------------------------------------------- */

export function cleanTextContent(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  // 防御：overlap >= chunkSize 会导致死循环或无意义分块
  if (overlap >= chunkSize) {
    throw new Error(`overlap (${overlap}) must be less than chunkSize (${chunkSize})`);
  }
  if (!text) {
    return [];
  }
  // 短文本直接返回单个 chunk
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  // 按换行切分，丢弃纯空白行（如连续空行），保留有内容的行
  const lines = text.split('\n').filter((l) => l.trim());
  let current = '';

  for (const line of lines) {
    // 超长单行（单行就超过 chunkSize）：fallback 到字符级切片，避免单行无法放入任何 chunk
    if (line.length > chunkSize) {
      // 先把累积的 current 推入 chunks，避免跨 chunk 拼接混淆
      if (current) {
        chunks.push(current);
        current = '';
      }
      let start = 0;
      while (start < line.length) {
        const end = Math.min(start + chunkSize, line.length);
        chunks.push(line.slice(start, end));
        if (end >= line.length) break;
        start += chunkSize - overlap;
      }
      continue;
    }

    // 常规行：判断加入后是否会超出 chunkSize
    // +1 是为了算上换行符（current 非空时需要拼接 \n）
    if (current.length + line.length + 1 > chunkSize && current) {
      // 当前 chunk 已满，推入 chunks
      chunks.push(current);
      // overlap 保留 current 末尾 2 行（语义上下文连续性）
      const overlapLines = current.split('\n').slice(-2);
      current = overlapLines.join('\n') + '\n' + line;
    } else {
      // 累积到 current
      current = current ? current + '\n' + line : line;
    }
  }
  // 推入最后一个 chunk
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

/* -------------------------------------------------------------------------- */
/* Worker                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Starts the BullMQ worker that processes document vectorization jobs.
 * Returns the worker instance, or null when Redis is not configured.
 */
let documentWorkerInstance: Worker | null = null;

export function startDocumentWorker(strapi: any): Worker | null {
  if (!process.env.REDIS_HOST) {
    console.log('[Queue] Document worker skipped - REDIS_HOST not set');
    return null;
  }

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const data = job.data || {};

      // Accept both { knowledgeBaseId } and the existing { documentId, type }.
      const rawId = data.knowledgeBaseId ?? data.documentId;
      const knowledgeBaseId = Number(rawId);
      const action = data.type || data.action || 'vectorize';

      if (!Number.isFinite(knowledgeBaseId)) {
        throw new Error(`Invalid knowledge base id: ${String(rawId)}`);
      }

      console.log(`[Queue] Processing document ${knowledgeBaseId} (action=${action})`);

      // Make sure the embeddings table exists before doing any work.
      await ensureSchemaOnce(strapi);

      try {
        // 1. Mark as processing.
        await strapi.db.query('api::knowledge-base.knowledge-base').update({
          where: { id: knowledgeBaseId },
          data: {
            status: 'processing',
            statusMessage: null,
            failedAt: null,
          },
        });

        // 2. Fetch document.
        const doc = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
          where: { id: knowledgeBaseId },
        });

        if (!doc || !doc.content) {
          throw new Error('Document has no content');
        }

        // 3. Clean + chunk.
        const cleanText = cleanTextContent(doc.content);
        const chunks = chunkText(cleanText, CHUNK_SIZE, CHUNK_OVERLAP);
        console.log(`[Queue] Document ${knowledgeBaseId}: ${chunks.length} chunks`);

        // 4. On re-vectorize, clear previous embeddings to avoid stale dupes.
        if (action === 'revectorize') {
          await strapi.db.connection.raw(
            'DELETE FROM knowledge_embeddings WHERE knowledge_base_id = ?',
            [knowledgeBaseId]
          );
          console.log(`[Queue] Document ${knowledgeBaseId}: cleared old embeddings`);
        }

        // 5. Embed + insert each chunk.
        // Deferred require so this module loads even if llm-service is not yet
        // present (keeps bootstrap + other workers healthy during incremental dev).
        const { generateEmbedding } = require('../services/llm-service') as {
          generateEmbedding: (text: string) => Promise<{ embedding: number[] }>;
        };

        let inserted = 0;
        for (let i = 0; i < chunks.length; i++) {
          const { embedding } = await generateEmbedding(chunks[i]);
          if (embedding && embedding.length > 0) {
            await strapi.db.connection.raw(
              `INSERT INTO knowledge_embeddings (knowledge_base_id, chunk_index, chunk_text, embedding, source_type)
               VALUES (?, ?, ?, ?::vector, 'document')`,
              [knowledgeBaseId, i, chunks[i], JSON.stringify(embedding)]
            );
            inserted++;
          }
        }

        // 6. Mark as ready.
        await strapi.db.query('api::knowledge-base.knowledge-base').update({
          where: { id: knowledgeBaseId },
          data: {
            status: 'ready',
            chunkCount: chunks.length,
            processedAt: new Date().toISOString(),
            statusMessage: null,
            failedAt: null,
          },
        });

        console.log(
          `[Queue] Document ${knowledgeBaseId} processed (${inserted}/${chunks.length} embedded)`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[Queue] Document ${knowledgeBaseId} failed:`, message);

        // Increment retryCount and record failure metadata.
        try {
          const existing = await strapi.db
            .query('api::knowledge-base.knowledge-base')
            .findOne({ where: { id: knowledgeBaseId }, select: ['retryCount'] });

          await strapi.db.query('api::knowledge-base.knowledge-base').update({
            where: { id: knowledgeBaseId },
            data: {
              status: 'failed',
              statusMessage: message.slice(0, 500),
              failedAt: new Date().toISOString(),
              retryCount: (existing?.retryCount || 0) + 1,
            },
          });
        } catch (updateErr) {
          console.error(
            `[Queue] Failed to mark document ${knowledgeBaseId} as failed:`,
            updateErr instanceof Error ? updateErr.message : updateErr
          );
        }

        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Queue] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    const knowledgeBaseId = job?.data?.knowledgeBaseId ?? 'unknown';
    console.error(`[Queue] Job ${job?.id} failed (knowledgeBaseId=${knowledgeBaseId}, attempts=${job?.attemptsMade}/${job?.opts?.attempts ?? '?'}):`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Queue] Worker error:', err.message);
  });

  documentWorkerInstance = worker;
  return worker;
}

/**
 * Close the document worker gracefully. Called from Strapi destroy() lifecycle.
 */
export async function closeDocumentWorker(): Promise<void> {
  if (documentWorkerInstance) {
    try {
      await documentWorkerInstance.close();
      console.log('[Queue] Document worker closed');
    } catch (err) {
      console.warn('[Queue] Failed to close document worker:', err instanceof Error ? err.message : err);
    }
    documentWorkerInstance = null;
  }
}
