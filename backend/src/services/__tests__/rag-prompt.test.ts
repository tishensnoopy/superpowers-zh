import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT_TEMPLATE } from '../rag-service';

describe('SYSTEM_PROMPT_TEMPLATE 防幻觉约束', () => {
  it('包含"暂时没有该信息，已为您转接人工客服"兜底话术要求', () => {
    expect(SYSTEM_PROMPT_TEMPLATE).toContain('暂时没有该信息，已为您转接人工客服');
  });

  it('明确禁止编造校区/课程/价格/政策', () => {
    expect(SYSTEM_PROMPT_TEMPLATE).toContain('不得编造');
    expect(SYSTEM_PROMPT_TEMPLATE).toMatch(/校区/);
    expect(SYSTEM_PROMPT_TEMPLATE).toMatch(/价格/);
    expect(SYSTEM_PROMPT_TEMPLATE).toMatch(/政策/);
  });

  it('检索不到答案时引导转人工客服或留资', () => {
    expect(SYSTEM_PROMPT_TEMPLATE).toContain('转接人工客服');
    expect(SYSTEM_PROMPT_TEMPLATE).toMatch(/留(下|资)|姓名电话/);
  });

  it('保留 {retrieved_docs} 占位符（buildSystemPrompt 依赖）', () => {
    expect(SYSTEM_PROMPT_TEMPLATE).toContain('{retrieved_docs}');
  });

  it('费用/名额等变动信息建议致电确认', () => {
    expect(SYSTEM_PROMPT_TEMPLATE).toContain('致电确认');
  });
});
