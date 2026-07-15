/**
 * Translation assist service.
 *
 * Calls DashScope (qwen-plus) to translate JSON field values from
 * sourceLocale to targetLocale. Returns the translated JSON or throws
 * on provider/parse errors.
 */

const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const TRANSLATE_MODEL = 'qwen-plus';
const TIMEOUT_MS = 30000;

const SYSTEM_PROMPT = `You are a professional translator. Translate the JSON values to English. Keep keys unchanged. Return JSON only.`;

export interface TranslateOptions {
  apiKey: string;
  fields: Record<string, string>;
}

export async function translateDocument(opts: TranslateOptions): Promise<Record<string, string>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: TRANSLATE_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(opts.fields) },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`DashScope ${response.status}: ${text}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI_RESPONSE_PARSE_ERROR: empty content');
    }

    // Strip markdown code fences if present
    const cleaned = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('AI_RESPONSE_PARSE_ERROR: response is not a JSON object');
    }
    return parsed as Record<string, string>;
  } finally {
    clearTimeout(timeout);
  }
}
