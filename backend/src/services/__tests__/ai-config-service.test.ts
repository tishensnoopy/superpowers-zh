import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getActiveAiConfig, clearCache } from '../ai-config-service';

const mockStrapi = {
  documents: vi.fn(),
};

const mockConfig = {
  provider: 'qwen',
  model: 'qwen-plus',
  embeddingModel: 'text-embedding-v2',
  apiKey: 'sk-test-key',
  apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  systemPrompt: '你是佑森小课堂的AI助手',
  temperature: 0.7,
  maxTokens: 2000,
  topK: 5,
  chunkSize: 500,
  chunkOverlap: 50,
  isActive: true,
};

describe('ai-config-service', () => {
  beforeEach(() => {
    clearCache();
    vi.clearAllMocks();
  });

  it('应从数据库读取 active 配置', async () => {
    mockStrapi.documents.mockReturnValue({
      findMany: vi.fn().mockResolvedValue([mockConfig]),
    });

    const result = await getActiveAiConfig(mockStrapi as any);
    expect(result).not.toBeNull();
    expect(result!.apiKey).toBe('sk-test-key');
    expect(result!.model).toBe('qwen-plus');
  });

  it('无 active 配置时返回 null', async () => {
    mockStrapi.documents.mockReturnValue({
      findMany: vi.fn().mockResolvedValue([]),
    });

    const result = await getActiveAiConfig(mockStrapi as any);
    expect(result).toBeNull();
  });

  it('5 分钟内应使用缓存（不重复查库）', async () => {
    const findMany = vi.fn().mockResolvedValue([mockConfig]);
    mockStrapi.documents.mockReturnValue({ findMany });

    await getActiveAiConfig(mockStrapi as any);
    await getActiveAiConfig(mockStrapi as any);
    await getActiveAiConfig(mockStrapi as any);

    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('clearCache 后应重新查库', async () => {
    const findMany = vi.fn().mockResolvedValue([mockConfig]);
    mockStrapi.documents.mockReturnValue({ findMany });

    await getActiveAiConfig(mockStrapi as any);
    clearCache();
    await getActiveAiConfig(mockStrapi as any);

    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
