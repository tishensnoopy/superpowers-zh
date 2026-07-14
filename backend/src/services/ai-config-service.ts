export interface AiConfig {
  provider: 'qwen' | 'openai' | 'custom';
  model: string;
  embeddingModel: string;
  apiKey: string;
  apiEndpoint: string;
  systemPrompt: string;
  systemPromptEn: string | null;
  temperature: number;
  maxTokens: number;
  topK: number;
  chunkSize: number;
  chunkOverlap: number;
}

let cachedConfig: { data: AiConfig; expiresAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

export async function getActiveAiConfig(strapi: any): Promise<AiConfig | null> {
  // 1. 检查内存缓存
  if (cachedConfig && Date.now() < cachedConfig.expiresAt) {
    return cachedConfig.data;
  }

  // 2. 查询数据库 isActive=true 的配置
  try {
    const configs = await strapi.documents('api::ai-config.ai-config').findMany({
      filters: { isActive: true },
      limit: 1,
    });

    if (!configs || configs.length === 0) {
      return null;
    }

    const config = configs[0];
    const aiConfig: AiConfig = {
      provider: config.provider,
      model: config.model,
      embeddingModel: config.embeddingModel,
      apiKey: config.apiKey,
      apiEndpoint: config.apiEndpoint,
      systemPrompt: config.systemPrompt,
      systemPromptEn: config.systemPromptEn ?? null,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      topK: config.topK,
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
    };

    // 3. 更新缓存
    cachedConfig = { data: aiConfig, expiresAt: Date.now() + CACHE_TTL };
    return aiConfig;
  } catch (err) {
    console.error('[ai-config-service] Failed to read config:', err);
    return null;
  }
}

export function clearCache(): void {
  cachedConfig = null;
}
