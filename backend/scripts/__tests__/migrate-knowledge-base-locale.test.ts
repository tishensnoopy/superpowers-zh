import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('migrate-knowledge-base-locale', () => {
  let mockRaw: ReturnType<typeof vi.fn>;
  let mockStrapi: any;

  beforeEach(() => {
    mockRaw = vi.fn();
    mockStrapi = {
      db: { connection: { raw: mockRaw } },
      destroy: vi.fn(),
    };
  });

  it('updates NULL locale rows to zh-CN', async () => {
    mockRaw.mockResolvedValue({ rows: [{ updated: 5 }] });
    const { migrateKnowledgeBaseLocale } = await import('../migrate-knowledge-base-locale');
    const result = await migrateKnowledgeBaseLocale(mockStrapi);
    expect(mockRaw).toHaveBeenCalledWith(
      "UPDATE knowledge_bases SET locale = 'zh-CN' WHERE locale IS NULL",
      []
    );
    expect(result.updated).toBe(5);
  });

  it('is idempotent — rows with locale are not overwritten', async () => {
    mockRaw.mockResolvedValue({ rows: [{ updated: 0 }] });
    const { migrateKnowledgeBaseLocale } = await import('../migrate-knowledge-base-locale');
    const result = await migrateKnowledgeBaseLocale(mockStrapi);
    expect(result.updated).toBe(0);
  });
});
