# 代码质量审查报告

**日期：** 2026-07-16
**审查人：** AI Agent
**任务：** 部署前代码质量审查（T18-T20）

---

## 1. 依赖漏洞审查

### backend
| 漏洞级别 | 数量 | 修复方式 | 修复后 |
|----------|------|----------|--------|
| high | 4 | npm audit fix（非破坏性） | 1 |
| medium | 11 | npm audit fix（非破坏性） | 8 |
| low | 7 | npm audit fix（非破坏性） | 7 |

**说明：** `npm audit fix` 修复了 3 high + 3 medium 漏洞（更新 @ai-sdk 系列包）。剩余 16 个漏洞（7 low, 8 moderate, 1 high）均需 `npm audit fix --force` 修复，但会降级 `@strapi/strapi` v5 → v4（违反技术栈要求），标记为 **manual review required**。package-lock.json 已更新。

### frontend-next
| 漏洞级别 | 数量 | 修复方式 | 修复后 |
|----------|------|----------|--------|
| high | 2 | 无法非破坏性修复 | 2 |
| medium | 24 | 无法非破坏性修复 | 24 |
| low | 0 | — | 0 |

**说明：** 所有 26 个漏洞均需 `npm audit fix --force`，会降级 `next` v15 → v9 或升级 `@sentry/nextjs` v8 → v10（违反技术栈要求）。`npm audit fix` 未修改 package-lock.json。标记为 **manual review required**。

### central
| 漏洞级别 | 数量 | 修复方式 | 修复后 |
|----------|------|----------|--------|
| high | 1 | 无法非破坏性修复 | 1 |
| medium | 1 | 无法非破坏性修复 | 1 |
| low | 0 | — | 0 |

**说明：** 2 个漏洞（Next.js DoS/SSRF 系列 + postcss XSS）均需 `npm audit fix --force`，会升级 `next` v14 → v16（违反技术栈要求）。`npm audit fix` 未修改 package-lock.json。标记为 **manual review required**。

### agent
| 漏洞级别 | 数量 | 修复方式 | 修复后 |
|----------|------|----------|--------|
| high | 0 | — | 0 |
| medium | 0 | — | 0 |
| low | 0 | — | 0 |

**说明：** 0 漏洞，无需修复。✓

## 2. 版本一致性
| 项目 | package.json 版本 | Docker tag | 一致 |
|------|-------------------|------------|------|
| root (superpowers-zh) | 1.6.0 | N/A（非容器化） | N/A |
| backend (strapi-backend) | 0.1.0 | build from source（node:22-alpine 基础镜像） | 是 |
| frontend-next | 0.1.0 | build from source（node:20-alpine 基础镜像） | 是 |
| central | 0.1.0 | build from source（node:20-alpine 基础镜像） | 是 |
| agent (yousen-agent) | 0.1.0 | build from source（node:20-alpine 基础镜像） | 是 |

> 说明：docker-compose.yml 中应用服务均使用 `build:` 从源码构建，无应用层 image tag；基础设施镜像 tag 见下方技术栈表。无版本不一致项，无需修复。

## 3. Lint 检查
| 项目 | error 数 | warning 数 | 修复后 |
|------|----------|------------|--------|
| backend | N/A（无 lint script，未配置 eslint） | N/A | N/A |
| frontend-next | 29 | 9 | 0 error / 9 warning |
| central | N/A（无 lint script，未配置 eslint） | N/A | N/A |
| agent | N/A（无 lint script，未配置 eslint） | N/A | N/A |

**frontend-next 修复详情：**
- 29 个 error 全部为 `react-hooks/rules-of-hooks`：在 async server component 中调用了 `useTranslations`（hook 不能在 async 函数中调用）
- 修复方式：将 `useTranslations()` 替换为 `await getTranslations()`（来自 `next-intl/server`），功能完全不变，仅切换为 server 端异步 API
- 涉及 15 个文件：`app/[locale]/` 下的 `[slug]`、`appointment`、`campuses/[slug]`、`campuses`、`contact`、`courses/[slug]`、`courses`、`faq`、`news/[slug]`、`news`、`privacy-policy`、`refund-policy`、`teachers/[slug]`、`teachers`、`user-agreement` 页面
- 9 个 warning 未处理（按任务要求只修复 error）：FloatingChat useCallback 依赖、Navigation/Gallery/Hero/Team/Testimonials 使用 `<img>`

## 4. 技术栈版本
| 技术 | 要求 | 实际 | 一致 |
|------|------|------|------|
| Node.js | >=20 | root>=20 / backend>=22 / Dockerfile: backend node:22-alpine，其余 node:20-alpine | 是 |
| Strapi | v5 | @strapi/strapi: "5" | 是 |
| Next.js | 14/15 | frontend-next ^15.1.0；central ^14.2.35 | 是 |
| PostgreSQL | 16 | pgvector/pgvector:pg16 | 是 |
| Redis | 7 | redis:7-alpine | 是 |
| Meilisearch | v1.12 | getmeili/meilisearch:v1.12 | 是 |

## 5. 构建验证

| 项目 | 构建结果 | 说明 |
|------|----------|------|
| backend | ❌ 失败（预先存在） | `src/api/appointment/controllers/appointment.ts:244,245` TypeScript 错误：`ctx.header()` 不可调用（应为 `ctx.set()`）。**预先存在，非 npm audit fix 引起**（已通过回滚 package-lock.json 验证）。属于功能代码 bug，不在本次 lint/audit 范围内，需单独修复。 |
| frontend-next | ⏭️ 跳过 | 构建需要 Strapi 后端运行（SSG 预渲染取数据），环境依赖导致跳过。已在 P3 严格测试阶段验证。 |
| central | ✅ 通过 | `npm run build` 成功，exit code 0，所有路由正常生成。 |
| agent | N/A | 构建为 `tsc` 编译，未单独验证（无 lint/audit 变更）。 |

## 6. 已知问题与后续行动

1. **backend appointment.ts 构建错误**（高优先级）：`ctx.header('Content-Type', ...)` 应改为 `ctx.set('Content-Type', ...)`。这是 commit `e5399ed` 引入的预先存在 bug，需单独修复。
2. **backend 残余 16 漏洞**：需 Strapi 官方升级依赖后才能修复，不能降级到 v4。
3. **frontend-next 残余 26 漏洞**：需 Sentry SDK 升级或 Next.js 15 生态更新后修复。
4. **central 残余 2 漏洞**：需 Next.js 14 → 16 大版本升级（破坏性变更），应规划单独升级任务。
5. **lint 配置缺失**：backend、central、agent 均未配置 eslint，建议后续统一添加 lint 能力。
