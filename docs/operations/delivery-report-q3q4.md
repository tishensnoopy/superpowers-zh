# Q3/Q4 交付报告：Editor 权限体系 + 双手册

> 交付日期：2026-07-20
> 范围：Q3（客户后台 Editor 账号与权限体系固化）、Q4（客户/运营双操作手册 + 冒烟验证）
> 服务器：124.223.1.67（/opt/customer-site，yousen-* 容器组）

---

## 1. 交付物清单

### 1.1 代码（已提交并部署到服务器）

| 提交 | 内容 |
|------|------|
| `dedbb70` | Editor 权限自愈 + 启动自检固化 |
| `45d09c5` | 双手册 + 冒烟清单 + 截图 + PDF/Word 导出 |
| `eddcfb4` | 冒烟 B4 实测记录（BUG-5） |

**核心新增/修改：**

- [admin-locale-perms.ts](../../backend/src/services/admin-locale-perms.ts)：
  - locale 并集补全（老库后加 en-US 时 Editor 权限行自动跟上，双语流程不失效）
  - Editor 内容权限行补建（Strapi 只在角色创建时种默认权限，后加内容类型缺整行 CRUD）
  - 超管专属敏感类型回收（ai-config / vector-config 等，Editor 不可见）
- [bootstrap-health.ts](../../backend/src/services/bootstrap-health.ts)：权限自愈纳入启动自检，每次启动幂等修复
- [create-editor-account.ts](../../backend/scripts/create-editor-account.ts)：客户 Editor 账号幂等创建/重置/停用
- docker-compose.yml 补齐 `ENCRYPTION_KEY` 传递；必填 env 与实际代码对齐（MEILI_HOST/MEILI_MASTER_KEY）

### 1.2 文档（docs/operations/）

| 文件 | 受众 | 说明 |
|------|------|------|
| [customer-handbook.md](customer-handbook.md) | 客户运营同事 | 零基础可跟随，10 张后台实拍截图标注，双语同步流程 + 8 个常见坑 |
| [operator-handbook.md](operator-handbook.md) | 运营方（你） | 服务器/容器/部署/账号/备份/故障排查，命令可复制粘贴 |
| [admin-ui-smoke-checklist.md](admin-ui-smoke-checklist.md) | 交付前自检 | 实测结果 + BUG-1~5 记录 |
| [screenshots/](screenshots/) | 手册配图 | 10 张后台实拍 |
| [exports/](exports/) | 打印/分发 | 客户手册 PDF(18页) + Word，运营手册 PDF(13页) + Word |

---

## 2. 质量验证

### 2.1 本地全量回归

- **单元测试：28 个文件 / 230 例全部通过**（vitest）
- **类型检查：tsc --noEmit 零错误**

### 2.2 服务器部署验证（2026-07-20 实测）

| 验证点 | 结果 |
|--------|------|
| backend 容器健康 | ✅ Up (healthy) |
| bootstrap-health 启动自检 | ✅ **OK（5 项全过）**：postgres / kb-schema / admin-locale-perms / required-env / redis |
| Editor 权限自愈（服务器老库） | ✅ 补建 17 条权限行，回收超管专属 10 条 |
| KB source_url 唯一索引 | ✅ 去重 47 组历史重复（删 47 文档 + 66 向量）后索引建立 |
| 前台首页 / 英文站 / 校区页 / 关于页 | ✅ 200 / 308( locale 跳转) / 200 / 200 |
| 后台 /admin | ✅ 200 |
| FAQ API（zh-CN） | ✅ 10 条 |
| AI 客服问答（KB 命中） | ✅ 正常作答 |
| AI 客服兜底（KB 未命中） | ⚠️ 见 BUG-5 |

---

## 3. 冒烟发现的 Bug 台账

| # | 严重度 | 状态 |
|---|--------|------|
| BUG-1 locale 权限行不随后加语言更新 | 高 | ✅ 已修复并纳入自愈 |
| BUG-2 后加内容类型 Editor 缺整行权限 | 高 | ✅ 已修复并纳入自愈 |
| BUG-3 数字 id 访问编辑页 404 | 中 | ✅ 非 bug（Strapi v5 用 documentId） |
| BUG-4 Settings 菜单入口可见 | 低 | ✅ 手册表述已修正 |
| BUG-5 AI 兜底话术不严格 + 夹带编造 | 中 | ⬜ **待立项修复**（rag-service prompt 强化 + 负样本测试） |

---

## 4. 遗留事项（不阻塞交付）

1. **BUG-5**：AI 在 KB 无答案时未严格使用"暂时没有该信息，已为您转接人工客服/欢迎留资"话术，且会夹带编造内容。建议走 systematic-debugging 单独立项。
2. **冒烟清单待补项**：A2/A3/A4/A5/A7 全量 CRUD×双语×发布流、C2 引用图删除表现、E2 线索导出实测（详见 [admin-ui-smoke-checklist.md](admin-ui-smoke-checklist.md) 末节）。
3. **服务器知识库内容质量**：线上 KB 仍含早期占位文案痕迹（如 AI 报价口径与手册示例不一致），建议内容运营正式进场后按 customer-handbook 清洗。

## 5. 后续建议

- 把 `docs/operations/exports/customer-handbook.pdf`（或 Word 版）发给客户运营同事，配合 30 分钟现场带教（重点讲第 2 节双语流程 + 第 8 节常见坑）。
- 客户账号用 `scripts/create-editor-account.ts` 按需创建，命令见 operator-handbook §4。
- 每次交付新实例前，按 admin-ui-smoke-checklist 过一遍 Editor 冒烟。
