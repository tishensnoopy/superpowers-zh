# Phase 0 设计：版本同步与流程纠正

> **创建日期：** 2026-07-22
> **状态：** 待用户审查
> **前置依赖：** 无（这是整个重构项目的第一步）
> **后续阶段：** Phase 1（实体关系重构）→ Phase 2-5（功能优化）

---

## 1. 背景与目标

### 1.1 问题陈述

当前项目存在严重的版本不同步问题，违反了 Strapi 框架的最佳实践：

- **本地开发环境**（`/home/tishensnoopy/project/superpowers-zh`）有 63 个 commit 未 push 到 GitHub，且有 48 个未提交修改
- **测试服务器**（124.223.1.67）有 5 个 geocoding commit 本地没有，且未配置 git remote
- **客户服务器**（121.196.210.191）通过 `docker cp` 部署，完全没有 git 版本记录
- 之前会话直接在服务器上进行开发操作，导致配置变更无法正确持久化、版本控制缺失

### 1.2 目标

1. **技术目标**：将三个环境的代码版本统一到以本地为权威源、GitHub 为中央仓库的标准模型
2. **流程目标**：建立"本地开发 → 单元/集成测试 → git push → 服务器 pull"的规范流程
3. **文档目标**：生成代码差异报告，记录同步过程

### 1.3 技术依据

Strapi v5 的核心配置机制（模型关系定义、权限策略设置、内容类型配置）仅在 development mode 下允许创建和修改。直接在生产服务器环境进行开发操作会导致：
- 配置变更无法正确持久化保存（`docker compose up -d` 重建容器会丢失 `docker cp` 的文件）
- 版本控制缺失（服务器上的改动没有 git 记录）
- 系统状态不一致（本地、GitHub、服务器三方代码不同步）

---

## 2. 现状诊断

### 2.1 三个环境的版本关系

```
GitHub (origin/main, HTTPS)
  ↑ 落后 63 个 commit（本地从未 push 过）
  │ GnuTLS recv error（HTTPS 被网络拦截）
  │ SSH 可达（但无 SSH key）
  │
本地 (HEAD: 9435ea4)
  ├── 48 个未提交修改（有价值的工作，需保留）
  │   ├── 19 个 schema.json（字段描述增强：建议尺寸/格式）
  │   ├── 13 个 component json（组件描述补充）
  │   ├── 1 个 Dockerfile（媒体库勾选框 BUG 修复）
  │   └── 6 个 frontend tsx（api.ts 字段增强 + 页面调整）
  │
  │ 缺 5 个 geocoding commit
  ↓
测试服务器 (HEAD: 7b15dd2, SSH 可达)
  ├── 7b67ae1 feat(backend): add amap geocode service
  ├── a4c43e1 feat(campus): add formattedAddress i18n field
  ├── d297f56 feat(campus): register geocoding lifecycle
  ├── 93353b4 chore(config): inject AMAP_WEB_SERVICE_KEY env
  └── 7b15dd2 chore(scripts): add campus coords regeneration script
  （无 git remote 配置）

客户服务器 (121.196.210.191, SSH 不稳定)
  ← docker cp 部署，无 git 版本记录
  ← node_modules 不完整（lodash/fp/index.js 缺失）
```

### 2.2 网络状况诊断

| 目标 | 协议 | 状态 | 说明 |
|------|------|------|------|
| github.com | HTTPS | ❌ 不可达 | GnuTLS recv error，90 秒超时 |
| github.com | SSH | ✅ 可达 | Permission denied (publickey)，需配置 SSH key |
| api.github.com | HTTPS | ✅ 可达 | HTTP 200，可用于添加 SSH key |
| 测试服务器 124.223.1.67 | SSH | ✅ 可达 | sshpass 可用 |
| 客户服务器 121.196.210.191 | SSH | ⚠️ 不稳定 | Connection timed out（之前会话） |

### 2.3 本地 48 个未提交修改的性质

经检查，这些修改是**有价值的工作，必须保留**：

| 类别 | 文件数 | 内容 | 对应需求 |
|------|--------|------|----------|
| schema 字段描述增强 | 19 | 给媒体字段添加建议尺寸/格式说明 | 媒体资源管理增强 |
| component 描述补充 | 13 | 组件字段描述完善 | 后端界面本地化 |
| Dockerfile BUG 修复 | 1 | 修复 Strapi v5 媒体库勾选框不可见 | BUG 修复 |
| 前端字段增强 | 6 | api.ts 增加 images populate + showPhoneInNav 等 | 页面元素调整 |

### 2.4 测试服务器 5 个 geocoding commit 的文件清单

| Commit | 改动文件 | 与本地冲突风险 |
|--------|----------|----------------|
| 7b67ae1 | `backend/src/services/amap-geocode-service.ts`（新建）+ 测试 | 无（本地不存在） |
| a4c43e1 | `backend/src/api/campus/content-types/campus/schema.json` | ⚠️ 可能（本地改了 description，patch 加 formattedAddress） |
| d297f56 | `backend/src/index.ts` + `backend/src/__tests__/register-lifecycles.test.ts` | 无（本地 index.ts 无 geocoding 改动） |
| 93353b4 | `docker-compose.yml` | 无（本地未修改 docker-compose.yml） |
| 7b15dd2 | `backend/scripts/regenerate-campus-coords.ts`（新建） | 无（本地不存在） |

**唯一潜在冲突**：`campus/schema.json`——本地改了字段 description，测试服务器的 patch 在同一文件添加 formattedAddress 字段。两处改动位置不同，`git am` 应能自动合并。

---

## 3. 同步策略

### 3.1 总体方案：本地为权威源，服务器改动逆向同步

```
Step 1: 本地 48 个未提交修改 → 按功能分组 commit（3 个 commit）
Step 2: 测试服务器 5 个 geocoding commit → git format-patch → 本地 git am
Step 3: 配置 GitHub SSH key → push 全部到 origin/main
Step 4: 测试服务器配置 git remote → 从 GitHub pull 建立规范
Step 5: 客户服务器从 GitHub pull（或 rsync 作为降级）
Step 6: 生成差异报告 + 建立规范流程文档
```

### 3.2 方案选型理由

| 方案 | 保留 git 历史 | 可操作性 | 推荐 |
|------|-------------|---------|------|
| A: git format-patch + git am | ✅ 完整保留 | ✅ 测试服务器 SSH 可达 | **推荐** |
| B: rsync 文件 + 手动 commit | ❌ 丢失 commit 信息 | ✅ 简单 | 次选 |
| C: 本地重置为服务器版本 | ❌ 丢失 63 个 commit | ❌ 不可接受 | 排除 |

---

## 4. 详细实施步骤

### Step 1: 本地 48 个未提交修改分组 commit

将 48 个修改按功能分为 3 个 commit，保持 git 历史清晰：

**Commit 1: schema 字段描述增强（媒体资源管理前置）**
```
git add backend/src/api/*/content-types/*/schema.json \
        backend/src/components/**/*.json
git commit -m "feat(schema): 为媒体字段添加建议尺寸/格式说明，完善组件描述

- 19 个 content type schema 的媒体字段添加建议尺寸描述
- 13 个 component schema 补充字段说明
- 为后续媒体资源管理增强做前置准备"
```

**Commit 2: Dockerfile 媒体库勾选框 BUG 修复**
```
git add backend/Dockerfile
git commit -m "fix(backend): 修复 Strapi v5 媒体库勾选框不可见 BUG

AssetCard 的 CardCheckbox 默认 opacity:0/pointer-events:none，
通过构建时 sed 注入 CSS 修复"
```

**Commit 3: 前端字段增强**
```
git add frontend-next/lib/api.ts \
        frontend-next/components/layout/Footer.tsx \
        frontend-next/components/layout/Navigation.tsx \
        frontend-next/components/sections/Hero.tsx \
        frontend-next/components/course/CourseHeader.tsx \
        frontend-next/components/course/SearchResultsGrid.tsx
git commit -m "feat(frontend): api.ts 增加 images populate + 站点设置字段扩展

- getProducts populate 增加 images 字段
- SiteSettings 增加 showPhoneInNav/icpUrl/publicSecurityRecordUrl
- Footer/Navigation/Hero/Course 组件适配新字段"
```

### Step 2: 从测试服务器同步 5 个 geocoding commit

**2.1 在测试服务器生成 patch**
```bash
sshpass -p 'Ysxkt12345' ssh root@124.223.1.67 \
  'cd /opt/customer-site && git format-patch HEAD~5..HEAD -o /tmp/geocoding-patches'
```

**2.2 下载 patch 到本地**
```bash
sshpass -p 'Ysxkt12345' scp -r root@124.223.1.67:/tmp/geocoding-patches /tmp/
```

**2.3 本地应用 patch**
```bash
git am /tmp/geocoding-patches/*.patch
```

**2.4 冲突处理预案**

如果 `campus/schema.json` 冲突：
- 本地改动：字段 description 添加建议尺寸
- patch 改动：新增 formattedAddress 字段
- 两处改动位置不同，预期可自动合并
- 如冲突，手动合并后 `git add` + `git am --continue`

**2.5 验证 patch 应用成功**
```bash
git log --oneline -5
# 预期看到 5 个 geocoding commit 在最新位置
```

### Step 3: 配置 GitHub SSH key 并 push

**3.1 生成 SSH key**
```bash
ssh-keygen -t ed25519 -C "tishensnoopy@superpowers-zh" -f ~/.ssh/id_ed25519_github -N ""
```

**3.2 获取公钥**
```bash
cat ~/.ssh/id_ed25519_github.pub
```

**3.3 添加到 GitHub**

用户需手动将公钥添加到 GitHub（通过 https://github.com/settings/keys，api.github.com 可达所以网页可访问）。

**3.4 配置 SSH config**
```
# ~/.ssh/config
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
```

**3.5 修改 remote URL 为 SSH**
```bash
git remote set-url origin git@github.com:tishensnoopy/superpowers-zh.git
```

**3.6 push 全部到 GitHub**
```bash
git push origin main
# 预期：63 + 3 + 5 = 71 个 commit push 成功
```

### Step 4: 测试服务器配置 git remote 并建立规范流程

**4.1 在测试服务器添加 remote**
```bash
sshpass -p 'Ysxkt12345' ssh root@124.223.1.67 \
  'cd /opt/customer-site && git remote add origin git@github.com:tishensnoopy/superpowers-zh.git'
```

**4.2 测试服务器配置 SSH key**（同 Step 3，在服务器上执行）

**4.3 fetch 并对齐**
```bash
sshpass -p 'Ysxkt12345' ssh root@124.223.1.67 \
  'cd /opt/customer-site && git fetch origin && git reset --hard origin/main'
```

> **注意**：`git reset --hard` 只影响 tracked 文件的修改，不影响 untracked 文件（如 `.claude-plugin/`、`.codex/` 等工具配置目录会保留）。此操作会让测试服务器的 tracked 文件与 GitHub 完全一致。测试服务器上本地已 commit 的 geocoding 改动已在 Step 2 同步到本地并 push 到 GitHub，因此 reset 不会丢失任何工作。

### Step 5: 客户服务器同步

**5.1 主方案：从 GitHub pull**

如果客户服务器可访问 GitHub SSH：
```bash
ssh root@121.196.210.191 'cd /opt/customer-site && git fetch origin && git reset --hard origin/main'
```

**5.2 降级方案：从测试服务器 rsync**

如果客户服务器无法访问 GitHub：
```bash
# 在测试服务器打包最新代码
sshpass -p 'Ysxkt12345' ssh root@124.223.1.67 \
  'cd /opt/customer-site && git archive --format=tar HEAD | gzip > /tmp/customer-site-latest.tar.gz'

# 传输到客户服务器
sshpass -p 'Ysxkt12345' scp root@124.223.1.67:/tmp/customer-site-latest.tar.gz /tmp/
sshpass -p 'Ysxkt12345' scp /tmp/customer-site-latest.tar.gz root@121.196.210.191:/tmp/

# 在客户服务器解压
ssh root@121.196.210.191 'cd /opt/customer-site && tar xzf /tmp/customer-site-latest.tar.gz'
```

**5.3 客户服务器重建容器**

代码同步后，必须重建 backend 镜像（而非 docker cp）：
```bash
ssh root@121.196.210.191 'cd /opt/customer-site && docker compose up -d --build backend'
```

### Step 6: 生成差异报告 + 建立规范流程文档

**6.1 代码差异报告**

生成同步前后的差异报告，保存到 `docs/superpowers/runbooks/2026-07-22-version-sync-report.md`：
- 同步前：本地 vs 测试服务器 vs 客户服务器的版本差异
- 同步操作：执行的命令和结果
- 同步后：三方版本一致性验证

**6.2 规范流程文档**

在 `docs/superpowers/runbooks/` 中创建开发流程规范，明确：
- 所有后端开发在本地 `/home/tishensnoopy/project/superpowers-zh` 完成
- 本地通过 `docker compose up -d` 运行开发环境
- 本地运行单元测试（`npx vitest run`）和集成测试
- 测试通过后 `git commit` + `git push origin main`
- 服务器通过 `git pull origin main` + `docker compose up -d --build` 部署
- **禁止**直接在服务器上修改代码或 `docker cp`

---

## 5. 验证标准

### 5.1 本地验证
- [ ] `git status` 显示 working tree clean（无未提交修改）
- [ ] `git log --oneline -10` 显示 5 个 geocoding commit + 3 个分组 commit
- [ ] `git push origin main` 成功（无 TLS 错误）
- [ ] GitHub 网页端显示最新 commit

### 5.2 测试服务器验证
- [ ] `git remote -v` 显示 origin 指向 GitHub
- [ ] `git log --oneline -3` 与本地一致
- [ ] `docker compose up -d --build backend` 成功
- [ ] backend 容器日志显示 `[Register] campus geocoding lifecycle subscribed`

### 5.3 客户服务器验证
- [ ] `git log --oneline -3` 与本地一致
- [ ] `docker compose up -d --build backend` 成功（非 docker cp）
- [ ] 前端页面 https://yoosen.cn 正常访问
- [ ] 校区地图坐标正确显示

### 5.4 流程验证
- [ ] 差异报告已生成
- [ ] 规范流程文档已创建
- [ ] 后续所有开发工作遵循"本地 → 测试 → push → pull"流程

---

## 6. 风险与降级方案

### 6.1 GitHub SSH 不可达
**风险**：Step 3 的 SSH key 配置后仍无法 push。
**降级**：使用 GitHub CLI（`gh`）或通过 api.github.com 上传，或使用 GitHub 镜像服务。

### 6.2 客户服务器 SSH 不稳定
**风险**：之前会话出现 Connection timed out。
**降级**：通过测试服务器作为中转（测试服务器 → 客户服务器 rsync）。

### 6.3 patch 冲突
**风险**：`campus/schema.json` 的 git am 冲突。
**降级**：手动合并冲突后 `git am --continue`，或改用方案 B（rsync 文件 + 手动 commit）。

### 6.4 客户服务器镜像重建失败
**风险**：`docker compose up -d --build` 卡住（之前会话遇到）。
**降级**：排查 build 卡住根因（可能是资源不足），或继续使用 `docker cp + strapi build` 作为临时方案，但需在差异报告中记录此偏差。

---

## 7. 后续 Phase 拆分概览

Phase 0 完成后，按以下顺序逐一进行 brainstorming → 设计 → 计划 → 实施：

| Phase | 主题 | 依赖 | 预估复杂度 |
|-------|------|------|-----------|
| **Phase 1** | 实体关系重构（campus ↔ course ↔ teacher manyToMany） | Phase 0 | 高（涉及数据迁移） |
| Phase 2 | 课程分类管理重构（无限层级 + 排序） | Phase 1 | 中 |
| Phase 3 | 富文本编辑器改进（CKEditor/TinyMCE 集成） | 无 | 中 |
| Phase 4a | 页面元素调整优化（双向数据绑定） | 无 | 中 |
| Phase 4b | 媒体资源管理增强（尺寸提示 + 自动裁剪） | 无 | 低 |
| Phase 4c | 后端界面本地化（中文 + 语言切换） | 无 | 低 |
| Phase 5 | 系统集成测试 + 可视化文档（ER Diagram + API 文档） | Phase 1-4 | 中 |

### YAGNI 提醒

用户需求中有部分设计在当前阶段属于过度设计，建议在后续 Phase 的 brainstorming 中逐一评估：
- "通用化主体-关联-客体模型"——当前业务只需 campus/course/teacher 三组关系，通用化框架属于 YAGNI
- "拖拽式关系可视化编辑界面"——Strapi admin 原生支持关系编辑，自定义前端可视化属于 YAGNI
- "关系冲突检测机制"——暂无明确业务需求
- "关联表带 status 字段支持软删除"——与 Strapi 原生 manyToMany 冲突（中间表不支持自定义字段），需在 Phase 1 设计中评估是否改用独立 content type

这些会在各 Phase 的 brainstorming 中详细讨论。
