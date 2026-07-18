# 母站加固综合设计：Q1~Q5 方案与决策点

日期：2026-07-19
状态：待用户决策（D1~D8）

---

## Q1 知识库与后台内容精确对应

### 现状审计（服务器实测，2026-07-19）

| 内容类型 | KB 文档数（中/英） | 后台实际（中/英） | 状态 |
|---|---|---|---|
| 课程 product | 0 / 0 | 6 / 6 | ❌ 完全没同步 |
| 校区 campus | 12 / 12 | 12 / 12 | ✅ 对齐 |
| 新闻 news | 20 / 10 | 20 / 20 | ❌ 英文缺一半 |
| 教师 teacher | 11 / 6 | 12 / 12 | ❌ 中英文都不足 |
| FAQ | 20 / 22 | 10 / 10 | ❌ 翻倍膨胀 |
| 无来源孤儿文档 | 45 条 | — | ❌ 垃圾数据 |
| 英文模板种子 | 6 条 | — | ❌ 不对应后台任何内容 |

### 根因清单

1. **UID 不匹配 bug**：`backend/src/index.ts` 生命周期注册 `api::course.course`，实际内容类型是 `api::product.product`，`syncSingleContent` 静默 return，课程 CRUD 从不进 KB。
2. **发布状态不对应**：sync 不区分草稿/发布；后台"取消发布"不会移除 KB 内容 → AI 会泄露未发布内容。
3. **硬编码英文种子**：`knowledge-base.initializeDefaults()` 在 KB 为空时写入 3 条英文模板（×2 语言 = 6 条）。
4. **无唯一性保障**：`source_url` 无唯一索引，异常重试产生重复/孤儿。
5. **LLM 幻觉**："8 城市 / ¥3,680" 在 KB 中不存在，是模型在检索不相关时自由发挥。

### 方案（用户已确认：严格模式 / 无种子 / 一次做全）

- A. 修 UID bug（index.ts: course→product）
- B. 发布状态对应：sync 只处理 `published`；取消发布/删除 → 自动移除 KB 文档+向量
- C. 服务器清理重建：删种子+孤儿+重复 → 全量重同步（双语、published only）→ 清空 embeddings 重跑向量化；`source_url` 加唯一索引
- D. 移除 KB 硬编码种子（`initializeDefaults` 空实现）
- E. 防幻觉强约束 system prompt：检索不含答案时必须明说"暂无该信息"并引导转人工/留资，禁止编造价格/校区/政策
- F. TDD：product UID 匹配、published-only、unpublish→删除、delete→向量清理、upsert 幂等

---

## Q2 central 功能完成度

### 已实现并验证 ✅

| 功能 | 状态 |
|---|---|
| 客户 CRUD（central 后台 customers 列表/新建/详情） | ✅ 已有 2 个客户（佑森小课堂/佑森小课堂测试） |
| 部署权鉴 | ✅ enrollment code（一次性、可吊销）→ agent enroll → token 哈希存储 → WS 鉴权，已实测 |
| 命令通道 | ✅ deploy（写 env → git pull → compose up --build → 健康检查）、config-sync（写 env+重启）、logs、restart、status |
| 配置中心 | ✅ customer_configs（brand/ai/deployment/env_overrides）+ publish |
| 管理侧 | ✅ admins 管理（锁定/解锁/重置密码）、audit-logs 审计、agent 在线心跳 |

### 缺口 ❌

1. **客户账号体系**：central 只有管理员（admin_users），客户（如朱莉）没有登录账号，无法自助查看自己服务器状态/部署历史（M6 未做）
2. **品牌预览**（M6 未做）
3. **新客户从零开通无端到端编排**：agent deploy 是 git pull 模式，要求目标机已有代码仓+docker；全新服务器的首次开通（装 docker、同步代码、初始化 DB/扩展、种子）目前靠手动脚本+人工步骤（本次 knowledge_embeddings 表漏建就是证据）
4. **部署模式分裂**：agent 走 git pull（依赖 GitHub），而我们为去 GitHub 依赖已改 rsync——两条路线未统一

---

## Q3 客户账号权限

### 关键事实

Strapi 有**两套互不相通**的账号体系：

| 体系 | 管什么 | 能否登录后台面板 | 自定义角色 |
|---|---|---|---|
| admin_users（后台面板账号） | 后台 UI 一切操作 | ✅ | ❌ 社区版只有 3 个固定角色（Super Admin / Editor / Author），自定义要企业版 License |
| up_users（users-permissions） | 仅 REST API | ❌ | ✅ 自建角色（client-admin 已配 79 权限） |

- 服务器实测：`up_users` **0 个用户**——客户目前没有任何账号
- client-admin 角色（79 权限）存在于 users-permissions 体系，只约束 API，**对后台面板无效**
- 超管在「设置 → Users & Permissions → Roles」调整 client-admin 权限可持久（R19 已修，seed 只跑一次）

### 结论

在"每个客户一套独立实例"的母站模式下，给客户开权限最简单可靠的路径是：**在客户自己的实例上建 admin 面板 Editor 账号**（可管全部内容，不能改系统设置/用户）。客户间天然实例级隔离，无需企业版。

---

## Q4 后台 UI 管理可靠性

- Strapi admin 是成熟产品，内容 CRUD 本身可靠，本次验证过的 ai-config 创建/修改/删除均正常
- 真实风险不是 UI bug，而是**操作知识缺口**：双语（每条内容中/英两个 locale 分别编辑）、草稿/发布流、动态区块（page dynamic zone）、组件用法
- 母站交付物应包含《客户运营手册》+ 一轮 admin UI 全流程冒烟测试（建/改/发布/取消发布/删除 × 各内容类型 × 双语）

---

## Q5 母站：部署与管理便利性

### 现状痛点

1. 部署手动步骤多、易漏（本次 KB 表事故）：rsync → 手动数据修复脚本 → 重建 → 手动验证
2. **bootstrap 无自检**：pgvector 扩展、knowledge_embeddings 表、队列、必填 env 缺失时不报警（KB 表漏建的根因）
3. 种子数据散落在 10+ 个 service 的 `initializeDefaults()`，母站克隆后客户要逐个改
4. central 配置下发（agent）与 rsync 脚本两条部署路线并存未统一
5. 密钥/env 人工传递

### 方案方向

- **B1. bootstrap 自检与自愈（根因修复）**：启动时检查 pgvector 扩展、KB 表、Redis 连通、必填 env；缺表自动建、缺扩展报警。母站克隆后首启即自检
- **B2. 一键开通脚本**：`provision-new-customer.sh` 固化"装依赖→同步代码→初始化→种子→健康检查→验证清单"全流程
- **B3. 品牌差异集中化**：品牌名/校区/AI key 等客户差异全部走 central config publish，代码完全一致
- **B4. 部署路线统一**：选定唯一部署模式（见 D6）

---

## 需要您判定的问题（D1~D8）

| # | 问题 | 选项 |
|---|---|---|
| D1 | Q1 方案是否按 A~F 全量执行？ | 是 / 裁剪（说明） |
| D2 | central 缺口是否现在补？ | ① 都不补，专注母站落地 ② 只补"从零开通编排" ③ 客户自助账号+开通编排都做 |
| D3 | 客户内容管理账号路线 | ① Editor 面板账号（推荐）② API-only users-permissions 账号 ③ 两者都要 |
| D4 | 是否给客户做《运营手册》+ admin UI 全流程冒烟测试 | 是 / 否 |
| D5 | bootstrap 自检自愈（B1）是否做 | 是（推荐）/ 否 |
| D6 | 部署路线统一为 | ① central agent 全自动（需补从零开通，弃 rsync）② 脚本 rsync 半自动（推荐：简单可控，agent 只做监控/配置下发）③ 维持双轨 |
| D7 | 母站种子数据策略 | ① 保留现有 initializeDefaults 占位内容（客户改内容即可）② 精简为最小骨架（推荐）③ 完全无种子 |
| D8 | 执行顺序 | ① Q1→Q5→Q3/Q4→Q2 ② 您指定 |

---

## 备注

- 本地有 83 modified + 9 untracked 未提交变更（之前会话遗留），实施前需要您确认是否先 commit。
- 本文档尚未 commit（遵循"本地变更需明确确认后才提交"约束）。
