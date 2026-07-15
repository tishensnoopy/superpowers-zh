import { describe, it, expect } from 'vitest';
import { chunkText, cleanTextContent } from '../document-processor';

describe('chunkText 语义边界分块', () => {
  it('空字符串返回空数组', () => {
    expect(chunkText('', 500, 50)).toEqual([]);
  });

  it('短文本（<= chunkSize）返回单个 chunk', () => {
    const text = '课程：拼音班\n简介：系统学习拼音\n价格：2800元';
    const chunks = chunkText(text, 500, 50);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('多行文本按行边界分块，不在行中间切断', () => {
    // 构造 > 500 字符的多行文本
    const longLine = '这是一个很长的字段值'.repeat(20); // ~200 chars
    const text = [
      '课程：测试课程',
      `简介：${longLine}`,
      `教学方式：${longLine}`,
      `描述：${longLine}`,
    ].join('\n');
    const allLines = text.split('\n');
    // text 总长约 800+ 字符，需要分 2+ chunk
    const chunks = chunkText(text, 500, 50);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // 每个 chunk 的最后一行必须是 allLines 中的完整行（不在行中间截断）
    for (const chunk of chunks) {
      const chunkLines = chunk.split('\n');
      const lastLine = chunkLines[chunkLines.length - 1];
      expect(allLines).toContain(lastLine);
    }
  });

  it('超长单行 fallback 到字符级切片', () => {
    const longLine = 'A'.repeat(1200);
    const text = `标题：${longLine}`;
    const chunks = chunkText(text, 500, 50);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    // 第一个 chunk 包含 "标题："
    expect(chunks[0]).toContain('标题：');
    // 后续 chunk 应是字符级切片
    expect(chunks[1].length).toBeLessThanOrEqual(500);
  });

  it('overlap >= chunkSize 时抛错', () => {
    expect(() => chunkText('test', 100, 100)).toThrow('overlap');
    expect(() => chunkText('test', 100, 150)).toThrow('overlap');
  });

  it('overlap 在多行分块中保留末尾行', () => {
    // 构造需要 2 个 chunk 的多行文本
    const line = '字段值'.repeat(30); // ~90 chars per line
    const text = [
      `行1：${line}`,
      `行2：${line}`,
      `行3：${line}`,
      `行4：${line}`,
      `行5：${line}`,
      `行6：${line}`,
    ].join('\n');
    // 总长约 600+ 字符，chunkSize=300 → 至少 2 chunk
    const chunks = chunkText(text, 300, 50);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // 第二个 chunk 应包含第一个 chunk 末尾的行（overlap）
    const firstChunkLastLine = chunks[0].split('\n').pop();
    if (firstChunkLastLine) {
      expect(chunks[1]).toContain(firstChunkLastLine);
    }
  });
});

describe('cleanTextContent', () => {
  it('去除 HTML 标签', () => {
    expect(cleanTextContent('<p>hello</p>')).toBe('hello');
  });

  it('去除 &nbsp;', () => {
    expect(cleanTextContent('a&nbsp;b')).toBe('a b');
  });

  it('合并多个空格', () => {
    expect(cleanTextContent('a    b')).toBe('a b');
  });
});
