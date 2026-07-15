# 序列化增强与 Chunk 策略优化 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 增强知识库序列化函数的信息密度，重写 chunkText 为语义边界分块，修复 uid 不匹配 bug，并创建幂等的重新同步脚本。

**架构：** 修改 `backend/src/services/knowledge-sync-service.ts` 中 5 个序列化函数为结构化模板格式（换行符分隔），重写 `backend/src/queues/document-processor.ts` 中 `chunkText` 为按行累加分块，修复 CONTENT_TYPES uid 为 `api::product.product`，新建 `backend/scripts/resync-knowledge-base.ts` 幂等重建脚本。

**技术栈：** TypeScript, Vitest, Strapi v5, BullMQ, pgvector

---

### 任务 1：serializeProduct 增强 + uid 修复

**文件：**
- 修改：`backend/src/services/knowledge-sync-service.ts`（第 16-26 行：CONTENT_TYPES uid + serializeCourse 函数）
- 测试：`backend/src/services/__tests__/knowledge-sync-service.test.ts`（更新现有测试 + 新增字段测试）

**背景：** Strapi product schema 的字段名是 `name`（不是 `title`），没有 `ageRange` 字段，有 `shortDescription`/`objectives`/`teachingMethod`。原 `serializeCourse` 引用 `c.title` 和 `c.ageRange` 导致内容丢失。同时 CONTENT_TYPES uid `api::course.course` 不存在，应为 `api::product.product`。

- [ ] **步骤 1：编写失败的测试**

在 `backend/src/services/__tests__/knowledge-sync-service.test.ts` 中，将第一个 describe 块替换为以下内容（更新 import + 序列化测试）：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serializeProduct, serializeNews, serializeTeacher, serializeCampus, serializeFaq, syncWebsiteContent, syncSingleContent, deleteSyncedContent } from '../knowledge-sync-service';

describe('knowledge-sync-service 序列化规则', () => {
  it('课程序列化应包含名称/简介/教学目标/教学方式/价格', () => {
    const product = {
      name: '幼小衔接全能班',
      shortDescription: '全面培养',
      objectives: [
        { title: '掌握拼音基础' },
        { title: '认识常用汉字' },
      ],
      teachingMethod: '小班教学',
      price: 3800,
    };
    const text = serializeProduct(product);
    expect(text).toContain('幼小衔接全能班');
    expect(text).toContain('全面培养');
    expect(text).toContain('掌握拼音基础');
    expect(text).toContain('认识常用汉字');
    expect(text).toContain('小班教学');
    expect(text).toContain('3800');
  });

  it('课程序列化空值字段应跳过', () => {
    const product = { name: '测试课程' };
    const text = serializeProduct(product);
    expect(text).toContain('课程：测试课程');
    expect(text).not.toContain('简介：');
    expect(text).not.toContain('教学目标：');
    expect(text).not.toContain('价格：');
  });

  it('课程序列化 description fallback 当 shortDescription 不存在', () => {
    const product = { name: '测试', description: '详细描述' };
    const text = serializeProduct(product);
    expect(text).toContain('简介：详细描述');
  });

  it('课程序列化格式为换行分隔', () => {
    const product = { name: 'A', shortDescription: 'B', price: 100 };
    const text = serializeProduct(product);
    expect(text).toContain('\n');
    const lines = text.split('\n');
    expect(lines[0]).toBe('课程：A');
    expect(lines[1]).toBe('简介：B');
  });
});
```

同时更新 `syncWebsiteContent` describe 中的 mock uid：

```typescript
  it('应同步课程到知识库', async () => {
    mockStrapi.documents.mockImplementation((uid: string) => {
      if (uid === 'api::product.product') {
        return { findMany: vi.fn().mockResolvedValue([{ id: 1, documentId: 'doc-1', name: '测试课程', description: '描述', price: 1000 }]) };
      }
      if (uid === 'api::knowledge-base.knowledge-base') {
        return { create: vi.fn().mockResolvedValue({ id: 1 }) };
      }
      return { findMany: vi.fn().mockResolvedValue([]) };
    });
    mockStrapi.db.query.mockReturnValue({ findOne: vi.fn().mockResolvedValue(null) });

    const result = await syncWebsiteContent(mockStrapi);
    expect(result.synced).toBeGreaterThan(0);
  });
```

同时更新 `syncSingleContent with locale` describe 中的 uid（3 处 `api::course.course` → `api::product.product`）和字段名（`title` → `name`）：

```typescript
  it('writes locale=en-US to knowledge_base when record has locale=en-US', async () => {
    const mockFindOne = vi.fn().mockResolvedValue(null);
    const mockCreate = vi.fn().mockResolvedValue({});
    const mockStrapi = {
      db: { query: vi.fn().mockReturnValue({ findOne: mockFindOne }) },
      documents: vi.fn().mockReturnValue({ create: mockCreate }),
    } as any;

    await syncSingleContent(mockStrapi, 'api::product.product', {
      documentId: 'doc1',
      name: 'English Course',
      description: 'desc',
      locale: 'en-US',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ locale: 'en-US' }),
      })
    );
  });

  it('writes locale=zh-CN when record has no locale field', async () => {
    const mockFindOne = vi.fn().mockResolvedValue(null);
    const mockCreate = vi.fn().mockResolvedValue({});
    const mockStrapi = {
      db: { query: vi.fn().mockReturnValue({ findOne: mockFindOne }) },
      documents: vi.fn().mockReturnValue({ create: mockCreate }),
    } as any;

    await syncSingleContent(mockStrapi, 'api::product.product', {
      documentId: 'doc2',
      name: '中文课程',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ locale: 'zh-CN' }),
      })
    );
  });

  it('creates two independent records for same documentId different locales', async () => {
    const mockFindOne = vi.fn().mockResolvedValue(null);
    const mockCreate = vi.fn().mockResolvedValue({});
    const mockStrapi = {
      db: { query: vi.fn().mockReturnValue({ findOne: mockFindOne }) },
      documents: vi.fn().mockReturnValue({ create: mockCreate }),
    } as any;

    await syncSingleContent(mockStrapi, 'api::product.product', {
      documentId: 'doc1',
      name: '中文课程',
      locale: 'zh-CN',
    });
    await syncSingleContent(mockStrapi, 'api::product.product', {
      documentId: 'doc1',
      name: 'English Course',
      locale: 'en-US',
    });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    const firstCall = mockCreate.mock.calls[0][0].data;
    const secondCall = mockCreate.mock.calls[1][0].data;
    expect(firstCall.locale).toBe('zh-CN');
    expect(secondCall.locale).toBe('en-US');
    expect(firstCall.sourceUrl).not.toBe(secondCall.sourceUrl);
  });

  it('deleteSyncedContent only deletes matching documentId + locale', async () => {
    const mockFindOne = vi.fn().mockResolvedValue({ id: 5, documentId: 'kb1' });
    const mockDeleteVectors = vi.fn();
    const mockDelete = vi.fn();
    const mockStrapi = {
      db: { query: vi.fn().mockReturnValue({ findOne: mockFindOne }) },
      documents: vi.fn().mockReturnValue({ delete: mockDelete }),
      service: vi.fn().mockReturnValue({ deleteVectors: mockDeleteVectors }),
    } as any;

    await deleteSyncedContent(mockStrapi, 'api::product.product', {
      documentId: 'doc1',
      locale: 'en-US',
    });

    expect(mockFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceUrl: 'strapi://api::product.product/doc1?locale=en-US',
        }),
      })
    );
    expect(mockDeleteVectors).toHaveBeenCalledWith(5);
    expect(mockDelete).toHaveBeenCalled();
  });
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/services/__tests__/knowledge-sync-service.test.ts`
预期：FAIL，报错 `serializeProduct is not a function` 或 import 失败

- [ ] **步骤 3：编写最少实现代码**

在 `backend/src/services/knowledge-sync-service.ts` 中，替换第 16-26 行：

```typescript
const CONTENT_TYPES = [
  { uid: 'api::product.product', serialize: serializeProduct, name: '课程' },
  { uid: 'api::news-article.news-article', serialize: serializeNews, name: '新闻' },
  { uid: 'api::teacher.teacher', serialize: serializeTeacher, name: '教师' },
  { uid: 'api::campus.campus', serialize: serializeCampus, name: '校区' },
  { uid: 'api::faq-item.faq-item', serialize: serializeFaq, name: 'FAQ' },
];

export function serializeProduct(p: any): string {
  const lines: string[] = [];
  lines.push(`课程：${p.name || ''}`);
  if (p.shortDescription) {
    lines.push(`简介：${p.shortDescription}`);
  } else if (p.description) {
    lines.push(`简介：${p.description}`);
  }
  if (p.objectives && Array.isArray(p.objectives) && p.objectives.length > 0) {
    const objectives = p.objectives.map((o: any) => o.title || '').filter(Boolean).join(' | ');
    if (objectives) {
      lines.push(`教学目标：${objectives}`);
    }
  }
  if (p.teachingMethod) {
    lines.push(`教学方式：${p.teachingMethod}`);
  }
  if (p.price) {
    lines.push(`价格：${p.price}元`);
  }
  return lines.join('\n');
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/services/__tests__/knowledge-sync-service.test.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5：Commit**

```bash
cd backend && git add src/services/knowledge-sync-service.ts src/services/__tests__/knowledge-sync-service.test.ts
git commit -m "feat: enhance serializeProduct with structured template + fix uid

- Rename serializeCourse → serializeProduct
- Use structured template format (newline-separated fields)
- Add objectives, teachingMethod, shortDescription fields
- Fix CONTENT_TYPES uid: api::course.course → api::product.product
- Fix field name: title → name (matches Strapi product schema)
- Remove non-existent ageRange field"
```

---

### 任务 2：serializeTeacher + serializeCampus 增强

**文件：**
- 修改：`backend/src/services/knowledge-sync-service.ts`（第 32-38 行：serializeTeacher + serializeCampus 函数）
- 测试：`backend/src/services/__tests__/knowledge-sync-service.test.ts`（在序列化 describe 块中新增测试）

- [ ] **步骤 1：编写失败的测试**

在 `knowledge-sync-service 序列化规则` describe 块中，新增以下测试（在课程测试之后）：

```typescript
  it('教师序列化应包含姓名/职称/教龄/学历/教学特色/成就', () => {
    const teacher = {
      name: '王老师',
      title: '高级教师',
      teachingYears: 10,
      education: '本科',
      teachingFeatures: '寓教于乐',
      achievements: ['市级优秀教师', '教学论文一等奖'],
    };
    const text = serializeTeacher(teacher);
    expect(text).toContain('教师：王老师');
    expect(text).toContain('职称：高级教师');
    expect(text).toContain('教龄：10年');
    expect(text).toContain('学历：本科');
    expect(text).toContain('教学特色：寓教于乐');
    expect(text).toContain('市级优秀教师');
    expect(text).toContain('教学论文一等奖');
  });

  it('教师序列化空值字段应跳过', () => {
    const teacher = { name: '测试教师' };
    const text = serializeTeacher(teacher);
    expect(text).toContain('教师：测试教师');
    expect(text).not.toContain('职称：');
    expect(text).not.toContain('教龄：');
    expect(text).not.toContain('学历：');
  });

  it('校区序列化应包含名称/地址/电话/营业时间/交通', () => {
    const campus = {
      name: '百步亭校区',
      address: '江岸区百步亭花园路',
      phone: '027-12345678',
      businessHours: '周一至周五 8:00-18:00',
      transportation: '地铁3号线百步亭站',
      description: '500平米教学区',
    };
    const text = serializeCampus(campus);
    expect(text).toContain('校区：百步亭校区');
    expect(text).toContain('地址：江岸区百步亭花园路');
    expect(text).toContain('电话：027-12345678');
    expect(text).toContain('营业时间：周一至周五 8:00-18:00');
    expect(text).toContain('交通：地铁3号线百步亭站');
    expect(text).toContain('500平米教学区');
  });

  it('校区序列化空值字段应跳过', () => {
    const campus = { name: '测试校区', address: '测试地址' };
    const text = serializeCampus(campus);
    expect(text).toContain('校区：测试校区');
    expect(text).not.toContain('电话：');
    expect(text).not.toContain('营业时间：');
    expect(text).not.toContain('交通：');
  });
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/services/__tests__/knowledge-sync-service.test.ts`
预期：FAIL，新测试报错（缺少"教龄""学历""教学特色"等字段）

- [ ] **步骤 3：编写最少实现代码**

在 `backend/src/services/knowledge-sync-service.ts` 中，替换 serializeTeacher 和 serializeCampus 函数：

```typescript
export function serializeTeacher(t: any): string {
  const lines: string[] = [];
  lines.push(`教师：${t.name || ''}`);
  if (t.title) {
    lines.push(`职称：${t.title}`);
  }
  if (t.teachingYears) {
    lines.push(`教龄：${t.teachingYears}年`);
  }
  if (t.education) {
    lines.push(`学历：${t.education}`);
  }
  if (t.teachingFeatures) {
    lines.push(`教学特色：${t.teachingFeatures}`);
  }
  if (t.achievements && Array.isArray(t.achievements) && t.achievements.length > 0) {
    lines.push(`成就：${t.achievements.join(' | ')}`);
  }
  if (t.bio || t.description) {
    lines.push(t.bio || t.description);
  }
  return lines.join('\n');
}

export function serializeCampus(c: any): string {
  const lines: string[] = [];
  lines.push(`校区：${c.name || ''}`);
  if (c.address) {
    lines.push(`地址：${c.address}`);
  }
  if (c.phone) {
    lines.push(`电话：${c.phone}`);
  }
  if (c.businessHours) {
    lines.push(`营业时间：${c.businessHours}`);
  }
  if (c.transportation) {
    lines.push(`交通：${c.transportation}`);
  }
  if (c.description) {
    lines.push(c.description);
  }
  return lines.join('\n');
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/services/__tests__/knowledge-sync-service.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
cd backend && git add src/services/knowledge-sync-service.ts src/services/__tests__/knowledge-sync-service.test.ts
git commit -m "feat: enhance serializeTeacher + serializeCampus with structured template

- serializeTeacher: add teachingYears, education, teachingFeatures, achievements
- serializeCampus: add businessHours, transportation
- Both use newline-separated field format
- Empty fields are skipped (no empty labels)"
```

---

### 任务 3：serializeNews + serializeFaq 增强

**文件：**
- 修改：`backend/src/services/knowledge-sync-service.ts`（第 28-30 行 serializeNews + 第 40-42 行 serializeFaq）
- 测试：`backend/src/services/__tests__/knowledge-sync-service.test.ts`（新增测试）

- [ ] **步骤 1：编写失败的测试**

在 `knowledge-sync-service 序列化规则` describe 块中，新增以下测试：

```typescript
  it('新闻序列化应包含标题/发布日期/摘要/内容', () => {
    const news = {
      title: '开学通知',
      publishedAt: '2026-01-15',
      excerpt: '春季班开始报名',
      content: '<p>详细内容</p>',
    };
    const text = serializeNews(news);
    expect(text).toContain('新闻：开学通知');
    expect(text).toContain('发布日期：2026-01-15');
    expect(text).toContain('摘要：春季班开始报名');
    expect(text).toContain('详细内容');
  });

  it('新闻序列化空值字段应跳过', () => {
    const news = { title: '测试新闻' };
    const text = serializeNews(news);
    expect(text).toContain('新闻：测试新闻');
    expect(text).not.toContain('发布日期：');
    expect(text).not.toContain('摘要：');
  });

  it('新闻序列化 content fallback 当 excerpt 不存在', () => {
    const news = { title: '测试', content: '正文内容' };
    const text = serializeNews(news);
    expect(text).toContain('正文内容');
  });

  it('FAQ序列化应包含问题/答案/分类', () => {
    const faq = {
      question: '什么是幼小衔接？',
      answer: '幼儿园到小学的过渡教育',
      category: '课程相关',
    };
    const text = serializeFaq(faq);
    expect(text).toContain('问题：什么是幼小衔接？');
    expect(text).toContain('答案：幼儿园到小学的过渡教育');
    expect(text).toContain('分类：课程相关');
  });

  it('FAQ序列化空值分类应跳过', () => {
    const faq = { question: '测试问题', answer: '测试答案' };
    const text = serializeFaq(faq);
    expect(text).toContain('问题：测试问题');
    expect(text).toContain('答案：测试答案');
    expect(text).not.toContain('分类：');
  });
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/services/__tests__/knowledge-sync-service.test.ts`
预期：FAIL（缺少"发布日期""摘要""分类"等字段）

- [ ] **步骤 3：编写最少实现代码**

在 `backend/src/services/knowledge-sync-service.ts` 中，替换 serializeNews 和 serializeFaq 函数：

```typescript
export function serializeNews(n: any): string {
  const lines: string[] = [];
  lines.push(`新闻：${n.title || ''}`);
  if (n.publishedAt) {
    const date = typeof n.publishedAt === 'string' ? n.publishedAt.split('T')[0] : '';
    if (date) {
      lines.push(`发布日期：${date}`);
    }
  }
  if (n.excerpt) {
    lines.push(`摘要：${n.excerpt}`);
  }
  if (n.content) {
    lines.push(n.content);
  } else if (!n.excerpt) {
    // If neither excerpt nor content, output nothing extra
  }
  return lines.join('\n');
}

export function serializeFaq(f: any): string {
  const lines: string[] = [];
  lines.push(`问题：${f.question || ''}`);
  if (f.answer) {
    lines.push(`答案：${f.answer}`);
  }
  if (f.category) {
    lines.push(`分类：${f.category}`);
  }
  return lines.join('\n');
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/services/__tests__/knowledge-sync-service.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
cd backend && git add src/services/knowledge-sync-service.ts src/services/__tests__/knowledge-sync-service.test.ts
git commit -m "feat: enhance serializeNews + serializeFaq with structured template

- serializeNews: add publishedAt, excerpt fields
- serializeFaq: add category field
- Both use newline-separated field format
- Empty fields are skipped"
```

---

### 任务 4：chunkText 语义边界分块重写

**文件：**
- 修改：`backend/src/queues/document-processor.ts`（第 126-145 行：chunkText 函数）
- 测试：`backend/src/queues/__tests__/document-processor.test.ts`（新建）

- [ ] **步骤 1：编写失败的测试**

创建文件 `backend/src/queues/__tests__/document-processor.test.ts`：

```typescript
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
    // text 总长约 800+ 字符，需要分 2+ chunk
    const chunks = chunkText(text, 500, 50);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // 每个 chunk 不应在换行符中间切断（不以半行开头，除非是 overlap）
    for (const chunk of chunks) {
      // chunk 应以行首字符开头（或 overlap 行）
      const firstLine = chunk.split('\n')[0];
      // 验证 firstLine 是 text 中的某一行（或其末尾部分）
      const allLines = text.split('\n');
      const isFirstLineValid = allLines.some(line => line.endsWith(firstLine) || line === firstLine);
      expect(isFirstLineValid).toBe(true);
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/queues/__tests__/document-processor.test.ts`
预期：FAIL，多行分块测试失败（当前 chunkText 是字符级切片，会在行中间切断）

- [ ] **步骤 3：编写最少实现代码**

在 `backend/src/queues/document-processor.ts` 中，替换 chunkText 函数（第 126-145 行）：

```typescript
export function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  // 防御：overlap >= chunkSize 会导致死循环
  if (overlap >= chunkSize) {
    throw new Error(`overlap (${overlap}) must be less than chunkSize (${chunkSize})`);
  }
  if (!text) {
    return [];
  }

  // 短文本快路径：直接返回单个 chunk
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  const lines = text.split('\n').filter((l) => l.trim());

  let current = '';
  for (const line of lines) {
    // 超长单行 fallback：字符级切片
    if (line.length > chunkSize) {
      // 先输出已累加的内容
      if (current) {
        chunks.push(current);
        current = '';
      }
      // 对超长行做字符级切片（带 overlap）
      let start = 0;
      while (start < line.length) {
        const end = Math.min(start + chunkSize, line.length);
        chunks.push(line.slice(start, end));
        if (end >= line.length) break;
        start += chunkSize - overlap;
      }
      continue;
    }

    // 按行累加：加入当前行会超限时输出 chunk
    if (current.length + line.length + 1 > chunkSize && current) {
      chunks.push(current);
      // overlap：保留上一 chunk 末尾 2 行
      const overlapLines = current.split('\n').slice(-2);
      current = overlapLines.join('\n') + '\n' + line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current) {
    chunks.push(current);
  }

  return chunks;
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/queues/__tests__/document-processor.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
cd backend && git add src/queues/document-processor.ts src/queues/__tests__/document-processor.test.ts
git commit -m "feat: rewrite chunkText with semantic boundary chunking

- Split by newlines (line-aware) instead of character-level slicing
- Short text (< chunkSize) fast path: single chunk
- Multi-line text: accumulate lines, break at line boundaries
- Overlap: retain last 2 lines from previous chunk
- Super long single line: fallback to character-level slicing
- Preserves overlap >= chunkSize guard"
```

---

### 任务 5：重新同步脚本

**文件：**
- 创建：`backend/scripts/resync-knowledge-base.ts`
- 测试：`backend/scripts/__tests__/resync-knowledge-base.test.ts`（新建）

**背景：** 序列化函数增强后，已有 knowledge-base 记录的 content 过时。此脚本调用 syncWebsiteContent（幂等，update 已有记录）再触发重新向量化。不需要删除旧记录——syncWebsiteContent 通过 sourceUrl 去重自动 update。

- [ ] **步骤 1：编写失败的测试**

创建文件 `backend/scripts/__tests__/resync-knowledge-base.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run scripts/__tests__/resync-knowledge-base.test.ts`
预期：FAIL，报错 `Cannot find module '../resync-knowledge-base'`

- [ ] **步骤 3：编写最少实现代码**

创建文件 `backend/scripts/resync-knowledge-base.ts`：

```typescript
/**
 * Resync knowledge base: re-serialize all content-sync records and trigger
 * re-vectorization.
 *
 * This script is idempotent:
 * - syncWebsiteContent uses sourceUrl dedup → update existing records
 * - Re-running re-sets all content-sync records to 'pending' and re-queues them
 * - Worker 'revectorize' action deletes old embeddings before inserting new ones
 *
 * Usage (from backend/):
 *   npx tsx scripts/resync-knowledge-base.ts
 *
 * Requirements:
 * - Strapi instance running
 * - Redis available (for BullMQ queue)
 * - DashScope API available (for embedding generation)
 */

interface ResyncOptions {
  syncWebsiteContent: (strapi: any) => Promise<{ synced: number; updated: number; errors: string[] }>;
  queueAdd: (queueName: string, data: any) => Promise<{ id: string }>;
}

export async function resyncKnowledgeBase(
  strapi: any,
  options: ResyncOptions
): Promise<{ synced: number; updated: number; errors: string[]; queued: number }> {
  // Step 1: Re-sync all content types (updates existing records, creates new ones)
  console.log('[resync-knowledge-base] Step 1: Syncing website content...');
  const { synced, updated, errors } = await options.syncWebsiteContent(strapi);
  console.log(`[resync-knowledge-base] Sync: ${synced} new, ${updated} updated, ${errors.length} errors`);

  if (errors.length > 0) {
    console.error('[resync-knowledge-base] Sync errors:', errors);
  }

  // Step 2: Find all pending content-sync records and queue for re-vectorization
  console.log('[resync-knowledge-base] Step 2: Queueing pending records for re-vectorization...');
  const pendingRecords = await strapi.db
    .query('api::knowledge-base.knowledge-base')
    .findMany({
      where: { sourceType: 'content-sync', status: 'pending' },
    });

  console.log(`[resync-knowledge-base] Found ${pendingRecords.length} pending records`);

  let queued = 0;
  for (const record of pendingRecords) {
    await options.queueAdd('document-processing', {
      knowledgeBaseId: record.id,
      type: 'revectorize',
    });
    queued++;
    // Rate limit: 100ms between jobs to avoid API throttling
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`[resync-knowledge-base] Done: queued ${queued} records for re-vectorization`);
  return { synced, updated, errors, queued };
}

// CLI entry point
async function main() {
  const { createStrapi } = await import('@strapi/strapi');
  const strapi = await createStrapi().load();

  // Dynamic import to avoid circular dependencies during CLI load
  const { syncWebsiteContent } = await import('../src/services/knowledge-sync-service');
  const { documentQueue } = await import('../src/queues/document-processor');

  const options: ResyncOptions = {
    syncWebsiteContent,
    queueAdd: async (queueName: string, data: any) => {
      return documentQueue.add('process', data);
    },
  };

  try {
    const result = await resyncKnowledgeBase(strapi, options);
    console.log('[resync-knowledge-base] Result:', result);
  } finally {
    await strapi.destroy();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run scripts/__tests__/resync-knowledge-base.test.ts`
预期：PASS

- [ ] **步骤 5：运行全量测试验证无回归**

运行：`cd backend && npx vitest run`
预期：所有测试 PASS

- [ ] **步骤 6：Commit**

```bash
cd backend && git add scripts/resync-knowledge-base.ts scripts/__tests__/resync-knowledge-base.test.ts
git commit -m "feat: add idempotent knowledge base resync script

- Calls syncWebsiteContent to update/create kb records (sourceUrl dedup)
- Queues pending records for revectorize via BullMQ
- 100ms rate limit between jobs to avoid API throttling
- Idempotent: safe to re-run (update existing + re-queue pending)
- No data gap: old embeddings preserved until worker completes revectorize
- CLI entry: npx tsx scripts/resync-knowledge-base.ts"
```
