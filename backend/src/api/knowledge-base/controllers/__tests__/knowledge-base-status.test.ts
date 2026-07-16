import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { processDocumentJob, setLlmService } from '../../../../queues/document-processor';

const mockGenerateEmbedding = vi.fn();

const schemaPath = join(
  __dirname,
  '../../content-types/knowledge-base/schema.json'
);
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

/**
 * 构造 mock strapi：
 *   - strapi.db.query(uid).update / findOne 各为 vi.fn
 *   - strapi.db.connection.raw 用于 ensureSchema + INSERT/DELETE
 *   - findOne 根据 select 参数区分：select:['retryCount'] 返回 retryCount（失败路径的 catch 块），
 *     否则返回文档内容（步骤 2 的 findOne）。
 */
function buildMockStrapi(opts: { content?: string | null; retryCount?: number } = {}) {
  const mockUpdate = vi.fn().mockResolvedValue({});
  const mockFindOne = vi.fn(async (args: any) => {
    if (args?.select?.includes('retryCount')) {
      return { retryCount: opts.retryCount ?? 2 };
    }
    return {
      id: 1,
      content: opts.content === undefined ? null : opts.content,
    };
  });
  const mockRaw = vi.fn().mockResolvedValue({ rows: [] as unknown[] });

  const strapi = {
    db: {
      query: vi.fn(() => ({ update: mockUpdate, findOne: mockFindOne })),
      connection: { raw: mockRaw },
    },
  };
  return { strapi, mockUpdate, mockFindOne, mockRaw };
}

describe('knowledge-base schema - vectorizationStatus 字段', () => {
  test('schema 包含 vectorizationStatus 枚举字段', () => {
    expect(schema.attributes).toHaveProperty('vectorizationStatus');
    const field = schema.attributes.vectorizationStatus;
    expect(field.type).toBe('enumeration');
    expect(field.enum).toEqual(['pending', 'processing', 'completed', 'failed']);
    expect(field.default).toBe('pending');
  });

  test('vectorizationStatus 与既有 status 字段独立存在', () => {
    expect(schema.attributes).toHaveProperty('status');
    expect(schema.attributes).toHaveProperty('vectorizationStatus');
    // 两者 enum 不同（status 用 ready，vectorizationStatus 用 completed）
    expect(schema.attributes.status.enum).toContain('ready');
    expect(schema.attributes.vectorizationStatus.enum).toContain('completed');
    expect(schema.attributes.status.enum).not.toContain('completed');
  });
});

describe('processDocumentJob - vectorizationStatus 状态更新', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateEmbedding.mockReset();
    // 注入 mock llm-service，避免命中 deferred require（vitest 无法解析 .ts）
    setLlmService({ generateEmbedding: mockGenerateEmbedding });
  });

  afterEach(() => {
    setLlmService(null);
  });

  test('处理开始设为 processing，成功后设为 completed', async () => {
    const { strapi, mockUpdate } = buildMockStrapi({ content: '这是一段测试知识库内容' });
    mockGenerateEmbedding.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });

    await processDocumentJob(strapi, { data: { knowledgeBaseId: 1 } });

    // 两次 update：processing → completed
    expect(mockUpdate).toHaveBeenCalledTimes(2);

    const firstData = mockUpdate.mock.calls[0][0].data;
    expect(firstData.status).toBe('processing');
    expect(firstData.vectorizationStatus).toBe('processing');

    const lastData = mockUpdate.mock.calls[1][0].data;
    expect(lastData.status).toBe('ready');
    expect(lastData.vectorizationStatus).toBe('completed');
  });

  test('文档无内容时设为 failed', async () => {
    const { strapi, mockUpdate } = buildMockStrapi({ content: null });

    await expect(
      processDocumentJob(strapi, { data: { knowledgeBaseId: 1 } })
    ).rejects.toThrow('Document has no content');

    // 两次 update：processing → failed
    expect(mockUpdate).toHaveBeenCalledTimes(2);

    const firstData = mockUpdate.mock.calls[0][0].data;
    expect(firstData.vectorizationStatus).toBe('processing');

    const lastData = mockUpdate.mock.calls[1][0].data;
    expect(lastData.status).toBe('failed');
    expect(lastData.vectorizationStatus).toBe('failed');
    expect(lastData.retryCount).toBe(3); // existing.retryCount=2 + 1
  });

  test('非法 knowledgeBaseId 时抛错且不更新状态', async () => {
    const { strapi, mockUpdate } = buildMockStrapi({ content: 'x' });

    await expect(
      processDocumentJob(strapi, { data: { knowledgeBaseId: NaN } })
    ).rejects.toThrow('Invalid knowledge base id');

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
