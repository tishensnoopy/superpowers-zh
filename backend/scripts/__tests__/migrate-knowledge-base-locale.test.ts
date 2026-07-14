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
    // PostgreSQL UPDATE without RETURNING returns { rowCount: N, rows: [] }
    mockRaw.mockResolvedValue({ rowCount: 5, rows: [] });
    const { migrateKnowledgeBaseLocale } = await import('../migrate-knowledge-base-locale');
    const result = await migrateKnowledgeBaseLocale(mockStrapi);
    expect(mockRaw).toHaveBeenCalledWith(
      "UPDATE knowledge_bases SET locale = 'zh-CN' WHERE locale IS NULL",
      []
    );
    expect(result.updated).toBe(5);
  });

  it('is idempotent across multiple runs', async () => {
    // First run: 3 rows updated; second run: 0 rows updated (no NULL rows left)
    mockRaw
      .mockResolvedValueOnce({ rowCount: 3, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const { migrateKnowledgeBaseLocale } = await import('../migrate-knowledge-base-locale');

    const firstResult = await migrateKnowledgeBaseLocale(mockStrapi);
    expect(firstResult.updated).toBe(3);

    const secondResult = await migrateKnowledgeBaseLocale(mockStrapi);
    expect(secondResult.updated).toBe(0);

    // Both calls use the same SQL (idempotent by WHERE clause)
    expect(mockRaw).toHaveBeenCalledTimes(2);
    expect(mockRaw).toHaveBeenNthCalledWith(1,
      "UPDATE knowledge_bases SET locale = 'zh-CN' WHERE locale IS NULL",
      []
    );
    expect(mockRaw).toHaveBeenNthCalledWith(2,
      "UPDATE knowledge_bases SET locale = 'zh-CN' WHERE locale IS NULL",
      []
    );
  });
});
