import { describe, it, expect, vi } from 'vitest';
import { resyncKnowledgeBase } from '../resync-knowledge-base';

describe('resyncKnowledgeBase', () => {
  it('调用 syncWebsiteContent 并触发 pending 记录重新向量化', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([
      { id: 1, documentId: 'kb-1', status: 'pending' },
      { id: 2, documentId: 'kb-2', status: 'pending' },
    ]);
    const mockAdd = vi.fn().mockResolvedValue({ id: 'job-1' });
    const mockSyncWebsiteContent = vi.fn().mockResolvedValue({
      synced: 2,
      updated: 3,
      errors: [],
    });

    const mockStrapi = {
      db: {
        query: vi.fn().mockReturnValue({ findMany: mockFindMany }),
      },
    } as any;

    const result = await resyncKnowledgeBase(mockStrapi, {
      syncWebsiteContent: mockSyncWebsiteContent,
      queueAdd: mockAdd,
    });

    expect(mockSyncWebsiteContent).toHaveBeenCalledWith(mockStrapi);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { sourceType: 'content-sync', status: 'pending' },
    });
    expect(mockAdd).toHaveBeenCalledTimes(2);
    expect(mockAdd).toHaveBeenCalledWith('document-processing', {
      knowledgeBaseId: 1,
      type: 'revectorize',
    });
    expect(mockAdd).toHaveBeenCalledWith('document-processing', {
      knowledgeBaseId: 2,
      type: 'revectorize',
    });
    expect(result.synced).toBe(2);
    expect(result.updated).toBe(3);
    expect(result.queued).toBe(2);
  });

  it('syncWebsiteContent 失败时抛出错误', async () => {
    const mockSyncWebsiteContent = vi.fn().mockRejectedValue(new Error('DB error'));

    const mockStrapi = {} as any;

    await expect(
      resyncKnowledgeBase(mockStrapi, {
        syncWebsiteContent: mockSyncWebsiteContent,
        queueAdd: vi.fn(),
      })
    ).rejects.toThrow('DB error');
  });

  it('无 pending 记录时不推入队列', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockAdd = vi.fn();
    const mockSyncWebsiteContent = vi.fn().mockResolvedValue({
      synced: 0,
      updated: 0,
      errors: [],
    });

    const mockStrapi = {
      db: {
        query: vi.fn().mockReturnValue({ findMany: mockFindMany }),
      },
    } as any;

    const result = await resyncKnowledgeBase(mockStrapi, {
      syncWebsiteContent: mockSyncWebsiteContent,
      queueAdd: mockAdd,
    });

    expect(mockAdd).not.toHaveBeenCalled();
    expect(result.queued).toBe(0);
  });
});
