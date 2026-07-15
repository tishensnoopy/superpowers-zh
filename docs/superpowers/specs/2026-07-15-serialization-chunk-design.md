# 5B-3 序列化增强与 Chunk 策略优化设计

> **项目：** 佑森小课堂网站 — 子项目 5B-3
> **前置：** 5A (i18n) ✅、5B-1 (SEO 基础) ✅、5B-2 (GEO) ✅
> **后续：** 5C (微信集成) → 6A (部署) → 6B (多客户)

## 1. 背景与问题

### 1.1 当前状态

AI 客服的 RAG 管线已完整实现（BullMQ → cleanText → chunkText → generateEmbedding → pgvector），但序列化和分块两个环节存在明确缺陷：

**序列化函数过于简陋**（`backend/src/services/knowledge-sync-service.ts`）：

```typescript
// 当前 serializeCourse — 丢失 objectives、teachingMethod 等关键字段
`课程：${c.title}。${c.description}。适合${c.ageRange}。学费${c.price}。`
```

5 个序列化函数平均只输出 3-4 个字段，大量结构化信息（教学目标、教学方式、营业时间、交通指引、教龄、学历等）被丢弃。

**chunkText 是字符级切片**（`backend/src/queues/document-processor.ts`）：

```typescript
// 当前 chunkText — 500 字符硬切，可能在字段中间截断
chunks.push(text.slice(start, end));
```

结构化内容在字段中间被切断，导致 embedding 捕获的语义不完整。

**uid 不匹配**：

`CONTENT_TYPES` 数组中 `api::course.course` 不存在，实际应为 `api::product.product`。导致课程内容无法同步到知识库。

### 1.2 不在范围内（YAGNI）

- 向量库抽象层（pgvector → qdrant/milvus 切换）— 推迟到 6B 多客户阶段
- 混合检索（向量 + 关键词）、重排序 — 推迟到上线后有对话数据后评估
- locale 字段修复（knowledge-base schema 无 locale 列但 rag-service SQL 查询它）— 独立问题，推迟处理

## 2. 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 序列化格式 | 结构化模板（换行符分隔字段） | 信息密度高，embedding 能捕捉每个字段的语义 |
| Chunk 策略 | 语义边界分块（按行累加） | 不在字段中间切断，短记录 1 个 chunk，长记录按字段段落分块 |
| 修复范围 | 全链路（序列化 + chunk + uid + 重新同步脚本） | 确保端到端可用 |
| 重新同步策略 | 幂等重建（无删除阶段） | 无数据空窗期，可安全重跑 |

## 3. 序列化函数增强

### 3.1 设计原则

- 每个字段独占一行（`标签：值` 格式）
- 空值/undefined 跳过该行，不输出空标签
- 数组字段用 ` | ` 连接（如教学目标、成就）
- 函数名与 content type 一致（`serializeProduct` 而非 `serializeCourse`）

### 3.2 五个函数的增强字段

| 函数 | 当前字段 | 增强后字段 | 新增字段 |
|------|---------|-----------|---------|
| serializeProduct | title, description, ageRange, price | name, shortDescription（fallback description）, objectives, teachingMethod, ageRange, price | objectives, teachingMethod, shortDescription |
| serializeTeacher | name, title, bio | name, title, teachingYears, education, teachingFeatures, achievements | teachingYears, education, teachingFeatures, achievements |
| serializeCampus | name, address, phone, description | name, address, phone, businessHours, transportation, description | businessHours, transportation |
| serializeNews | title, content/excerpt | title, publishedAt, excerpt, content | publishedAt |
| serializeFaq | question, answer | question, answer, category | category |

### 3.3 输出示例

```text
课程：拼音全能班
简介：系统学习汉语拼音，适合幼小衔接
教学目标：掌握23个声母 | 认识24个韵母 | 熟练拼读
教学方式：小班教学
价格：2800元
```

```text
教师：张老师
职称：高级教师
教龄：10年
学历：本科
教学特色：寓教于乐，注重思维培养
成就：武汉市优秀青年教师 | 教学论文一等奖
```

## 4. Chunk 策略重写

### 4.1 算法

```
输入：text（结构化模板，换行符分隔）, chunkSize=500, overlap=50

1. 按换行符分段（lines = text.split('\n')）
2. 如果 text.length <= chunkSize → 返回 [text]（短记录快路径）
3. 逐行累加：
   - 如果 current.length + line.length + 1 > chunkSize 且 current 非空
     → 输出 current 为一个 chunk
     → overlap：保留 current 末尾 2 行作为下一个 chunk 的起始
   - 否则追加 line 到 current
4. 超长单行 fallback（line.length > chunkSize）：
   → 对该行做字符级切片（保留旧逻辑）
5. 保留 overlap >= chunkSize 抛错防御
```

### 4.2 参数

不变：`CHUNK_SIZE = 500`，`CHUNK_OVERLAP = 50`。

### 4.3 行为矩阵

| 场景 | 输入长度 | 行为 | chunk 数 |
|------|---------|------|---------|
| 短记录（课程/教师/校区/FAQ） | 200-300 字符 | 快路径，直接返回 | 1 |
| 中等记录（带丰富字段的课程） | 500-1000 字符 | 按行累加，达 500 断 chunk | 2-3 |
| 长记录（新闻文章 content） | 1000+ 字符 | 按行累加 + 超长行 fallback | 3-5 |
| 超长单行（新闻 richtext 去标签后） | 500+ 字符/行 | 字符级 fallback | 2+ |

## 5. UID 修复

### 5.1 修改

```typescript
// 修改前（knowledge-sync-service.ts 第 17 行）
{ uid: 'api::course.course', serialize: serializeCourse, name: '课程' },

// 修改后
{ uid: 'api::product.product', serialize: serializeProduct, name: '课程' },
```

### 5.2 影响分析

- 其余 4 个 uid（news-article、teacher、campus、faq-item）已正确，无需修改
- `serializeCourse` 函数重命名为 `serializeProduct`
- `syncSingleContent` 和 `deleteSyncedContent` 中的 uid 匹配逻辑自动生效（通过 `CONTENT_TYPES.find(c => c.uid === uid)`）

## 6. 重新同步脚本

### 6.1 设计原则

- **先建后删**：不删除旧记录，syncWebsiteContent 的 sourceUrl 去重自动 update 已有记录
- **幂等可重跑**：syncWebsiteContent 幂等（update 已有），revectorize 幂等（先删旧 embeddings 再建新的）
- **无数据空窗期**：旧 embeddings 保留到 worker 完成重新向量化

### 6.2 流程

```
步骤 1：重建（update 已有 / create 新的）
  syncWebsiteContent(strapi)
  ├─ 已有记录（sourceUrl 匹配）→ update content, status='pending'
  └─ 新记录 → create, status='pending'
  此时旧 embeddings 仍在 → AI 客服仍可用（旧内容）

步骤 2：触发重新向量化
  查找 sourceType='content-sync' AND status='pending'
  逐条推入队列 action='revectorize'
  每条间隔 100ms 限速
  worker 先 DELETE 旧 embeddings → 再 INSERT 新 embeddings
  完成后 status='ready'
```

### 6.3 脚本位置与运行方式

- 文件：`backend/scripts/resync-knowledge-base.ts`
- 运行：`npx tsx scripts/resync-knowledge-base.ts`（或在 Docker 容器内 `npm run resync:kb`）
- 依赖：需要 Strapi 实例 + Redis + PostgreSQL + DashScope API 全部可用

### 6.4 失败处理

| 失败点 | 状态 | 恢复方式 |
|--------|------|---------|
| 步骤 1 失败 | 旧 kb 记录 + 旧 embeddings 仍在 | 修复错误后重跑脚本 |
| 步骤 2 失败（Redis 不可用） | kb 记录已更新（pending），旧 embeddings 仍可用 | Redis 恢复后重跑脚本，worker 处理 pending 记录 |
| 步骤 2 失败（API 限流） | 部分记录已向量化（ready），部分 pending | 重跑脚本——syncWebsiteContent 会将所有 content-sync 记录重设为 pending，步骤 2 重新推入队列。已 ready 的记录会被 revectorize（先删旧 embeddings 再建新的），无副作用 |
| Worker 处理失败 | 单条记录 status='failed'，retryCount++ | BullMQ 自动重试（attempts=5, 指数退避） |

## 7. 测试策略

### 7.1 单元测试

| 测试文件 | 覆盖范围 |
|---------|---------|
| `backend/src/services/__tests__/knowledge-sync-service.test.ts` | 5 个序列化函数的输出格式、空值跳过、数组连接 |
| `backend/src/queues/__tests__/document-processor.test.ts` | chunkText 语义分块：短记录快路径、按行累加、超长行 fallback、overlap 保留、防御性抛错 |

### 7.2 测试数据要求

- 序列化测试：构造包含所有字段的完整对象 + 只含必填字段的最小对象
- chunkText 测试：
  - 短文本（< 500 字符）→ 1 个 chunk
  - 多行中等文本（500-1000 字符）→ 2-3 个 chunk，不在行中间切断
  - 超长单行（> 500 字符）→ 字符级 fallback
  - overlap >= chunkSize → 抛错

### 7.3 不在范围内

- E2E 测试（需要完整 Strapi + Redis + PostgreSQL 环境）— 推迟到部署前统一测试
- 重新同步脚本的集成测试 — 手动运行验证即可

## 8. 验收标准

1. `serializeProduct` 输出包含 name、shortDescription/description、objectives、teachingMethod、price，空值字段跳过
2. `serializeTeacher` 输出包含 name、title、teachingYears、education、teachingFeatures、achievements
3. `serializeCampus` 输出包含 name、address、phone、businessHours、transportation
4. `serializeNews` 输出包含 title、publishedAt、excerpt/content
5. `serializeFaq` 输出包含 question、answer、category
6. `chunkText` 对 < 500 字符的文本返回 1 个 chunk
7. `chunkText` 对多行长文本按行边界分块，不在行中间切断
8. `chunkText` 对超长单行 fallback 到字符级切片
9. `chunkText` 在 overlap >= chunkSize 时抛错
10. `CONTENT_TYPES` 数组使用 `api::product.product` 而非 `api::course.course`
11. 重新同步脚本是幂等的，可安全重跑
12. 重新同步脚本运行期间 AI 客服不会出现数据空窗期
13. 所有现有单元测试继续通过（无回归）
