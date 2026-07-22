# Phase 0：版本同步与流程纠正 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将本地、测试服务器、客户服务器三个环境的代码版本统一到以本地为权威源、GitHub 为中央仓库的标准模型，并建立"本地开发 → 测试 → git push → 服务器 pull"的规范流程。

**架构：** 本地 48 个未提交修改按功能分 3 组 commit；从测试服务器 `git format-patch` 导出 5 个 geocoding commit 后本地 `git am` 应用；配置 GitHub SSH key 解决 HTTPS TLS 拦截问题后 push 全部 71 个 commit；测试服务器和客户服务器从 GitHub pull 对齐；最后生成差异报告和规范流程文档。

**技术栈：** Git（format-patch/am/remote）、SSH key 认证、Docker Compose、Strapi v5

**源码位置：**
- 本地：`/home/tishensnoopy/project/superpowers-zh`（GitHub: `tishensnoopy/superpowers-zh`）
- 测试服务器：`124.223.1.67`，SSH `sshpass -p 'Ysxkt12345' ssh root@124.223.1.67`
- 客户服务器：`121.196.210.191`，SSH `sshpass -p 'Ysxkt12345' ssh root@121.196.210.191`

**前置依赖：** 已批准的设计文档 `docs/superpowers/specs/2026-07-22-version-sync-and-workflow-design.md`

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 创建 | `~/.ssh/id_ed25519_github` + `.pub` | GitHub SSH 认证密钥对 |
| 修改 | `~/.ssh/config` | SSH 主机配置（指定 IdentityFile） |
| 修改 | 本地 git remote URL | 从 HTTPS 改为 SSH 协议 |
| 创建 | `/tmp/geocoding-patches/*.patch` | 从测试服务器导出的 5 个 geocoding commit patch |
| 创建 | `docs/superpowers/runbooks/2026-07-22-version-sync-report.md` | 代码差异报告 |
| 创建 | `docs/superpowers/runbooks/2026-07-22-development-workflow.md` | 规范开发流程文档 |

---

## 任务 1：本地 48 个未提交修改分组 commit（3 个 commit）

**文件：**
- 修改：19 个 `backend/src/api/*/content-types/*/schema.json`
- 修改：13 个 `backend/src/components/**/*.json`
- 修改：`backend/Dockerfile`
- 修改：6 个 `frontend-next/**/*.tsx` + `frontend-next/lib/api.ts`

**职责：** 将本地积压的 48 个有价值修改按功能分 3 组 commit，保持 git 历史清晰。

- [ ] **步骤 1.1：验证当前未提交修改数量**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git status --short | wc -l
```

预期：输出 `53` 左右（48 个修改 + 5 个 untracked 目录/文件）

- [ ] **步骤 1.2：Commit 1 — schema 字段描述增强**

```bash
git add backend/src/api/*/content-types/*/schema.json \
        backend/src/components/common/*.json \
        backend/src/components/course/*.json \
        backend/src/components/section/*.json

git commit -m "$(cat <<'EOF'
feat(schema): 为媒体字段添加建议尺寸/格式说明，完善组件描述

- 19 个 content type schema 的媒体字段添加建议尺寸描述
- 13 个 component schema 补充字段说明
- 为后续媒体资源管理增强做前置准备
EOF
)"
```

预期：`git commit` 成功，输出约 32 files changed

- [ ] **步骤 1.3：验证 Commit 1 成功**

```bash
git log --oneline -1
git status --short | grep -c "^ M"
```

预期：
- 最新 commit 消息以 `feat(schema):` 开头
- 剩余未提交修改数约 16（48 - 32 = 16，含 Dockerfile + 6 个 frontend）

- [ ] **步骤 1.4：Commit 2 — Dockerfile 媒体库勾选框 BUG 修复**

```bash
git add backend/Dockerfile

git commit -m "$(cat <<'EOF'
fix(backend): 修复 Strapi v5 媒体库勾选框不可见 BUG

AssetCard 的 CardCheckbox 默认 opacity:0/pointer-events:none，
通过构建时 sed 注入 CSS 修复。
EOF
)"
```

预期：`git commit` 成功，1 file changed

- [ ] **步骤 1.5：Commit 3 — 前端字段增强**

```bash
git add frontend-next/lib/api.ts \
        frontend-next/components/layout/Footer.tsx \
        frontend-next/components/layout/Navigation.tsx \
        frontend-next/components/sections/Hero.tsx \
        frontend-next/components/course/CourseHeader.tsx \
        frontend-next/components/course/SearchResultsGrid.tsx

git commit -m "$(cat <<'EOF'
feat(frontend): api.ts 增加 images populate + 站点设置字段扩展

- getProducts populate 增加 images 字段
- SiteSettings 增加 showPhoneInNav/icpUrl/publicSecurityRecordUrl
- Footer/Navigation/Hero/Course 组件适配新字段
EOF
)"
```

预期：`git commit` 成功，6 files changed

- [ ] **步骤 1.6：验证所有修改已 commit**

```bash
git status --short | grep -c "^ M"
```

预期：输出 `0`（无未提交的 modified 文件；untracked 的 `backend/src/admin/`、`docs/` 等目录不在此计数中）

- [ ] **步骤 1.7：验证最近 4 个 commit**

```bash
git log --oneline -4
```

预期：
```
xxxxxxx feat(frontend): api.ts 增加 images populate + 站点设置字段扩展
xxxxxxx fix(backend): 修复 Strapi v5 媒体库勾选框不可见 BUG
xxxxxxx feat(schema): 为媒体字段添加建议尺寸/格式说明，完善组件描述
07a3aba docs(spec): Phase 0 版本同步与流程纠正设计文档
```

---

## 任务 2：从测试服务器同步 5 个 geocoding commit

**文件：**
- 创建：`/tmp/geocoding-patches/0001-*.patch` 到 `0005-*.patch`
- 修改：`backend/src/services/amap-geocode-service.ts`（新建）
- 修改：`backend/src/services/__tests__/amap-geocode-service.test.ts`（新建）
- 修改：`backend/src/api/campus/content-types/campus/schema.json`
- 修改：`backend/src/index.ts`
- 修改：`backend/src/__tests__/register-lifecycles.test.ts`
- 修改：`docker-compose.yml`
- 创建：`backend/scripts/regenerate-campus-coords.ts`

**职责：** 从测试服务器导出 5 个 geocoding commit 的 patch，本地应用，保留完整 git 历史。

- [ ] **步骤 2.1：在测试服务器生成 patch**

```bash
sshpass -p 'Ysxkt12345' ssh -o StrictHostKeyChecking=no root@124.223.1.67 \
  'cd /opt/customer-site && mkdir -p /tmp/geocoding-patches && git format-patch HEAD~5..HEAD -o /tmp/geocoding-patches && ls -la /tmp/geocoding-patches/'
```

预期：看到 5 个 `.patch` 文件：
```
0001-feat-backend-add-amap-geocode-service-for-address-to-co.patch
0002-feat-campus-add-formattedAddress-i18n-field-for-standa.patch
0003-feat-campus-register-beforeCreate-beforeUpdate-geocodi.patch
0004-chore-config-inject-AMAP_WEB_SERVICE_KEY-env-into-backe.patch
0005-chore-scripts-add-one-shot-campus-coords-regeneration-s.patch
```

- [ ] **步骤 2.2：下载 patch 到本地**

```bash
sshpass -p 'Ysxkt12345' scp -o StrictHostKeyChecking=no -r \
  root@124.223.1.67:/tmp/geocoding-patches /tmp/

ls -la /tmp/geocoding-patches/
```

预期：本地 `/tmp/geocoding-patches/` 下有 5 个 `.patch` 文件

- [ ] **步骤 2.3：本地应用 patch**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git am /tmp/geocoding-patches/*.patch
```

预期（无冲突时）：
```
Applying: feat(backend): add amap geocode service for address-to-coordinate conversion
Applying: feat(campus): add formattedAddress i18n field for standardized address
Applying: feat(campus): register beforeCreate/beforeUpdate geocoding lifecycle
Applying: chore(config): inject AMAP_WEB_SERVICE_KEY env into backend container
Applying: chore(scripts): add one-shot campus coords regeneration script
```

- [ ] **步骤 2.4：冲突处理（仅在步骤 2.3 失败时执行）**

如果 `campus/schema.json` 冲突（patch 2 添加 formattedAddress 字段时与步骤 1.2 的 description 改动冲突）：

```bash
# 查看冲突文件
git status

# 编辑冲突文件，手动合并：
# - 保留步骤 1.2 添加的 description 内容（建议尺寸/格式说明）
# - 保留 patch 添加的 formattedAddress 字段定义
# 删除冲突标记 <<<  ===  >>>

# 标记冲突已解决
git add backend/src/api/campus/content-types/campus/schema.json

# 继续 am
git am --continue
```

- [ ] **步骤 2.5：验证 5 个 commit 已应用**

```bash
git log --oneline -9
```

预期：最近 9 个 commit 包含 5 个 geocoding commit（最新 5 个）+ 3 个分组 commit + 1 个设计文档 commit

- [ ] **步骤 2.6：验证 geocoding 文件存在**

```bash
ls backend/src/services/amap-geocode-service.ts && echo "✓ service 存在"
ls backend/src/services/__tests__/amap-geocode-service.test.ts && echo "✓ test 存在"
ls backend/scripts/regenerate-campus-coords.ts && echo "✓ script 存在"
grep -c "formattedAddress" backend/src/api/campus/content-types/campus/schema.json
grep -c "campus-geocode" backend/src/index.ts
grep -c "AMAP_WEB_SERVICE_KEY" docker-compose.yml
```

预期：
- 3 个文件都存在
- `formattedAddress` 出现 ≥ 1 次
- `campus-geocode` 出现 ≥ 1 次
- `AMAP_WEB_SERVICE_KEY` 出现 ≥ 1 次

- [ ] **步骤 2.7：验证 schema 合法性**

```bash
node -e "JSON.parse(require('fs').readFileSync('backend/src/api/campus/content-types/campus/schema.json', 'utf8')); console.log('✓ campus schema JSON 合法')"
```

预期：输出 `✓ campus schema JSON 合法`

---

## 任务 3：配置 GitHub SSH key 并 push

**文件：**
- 创建：`~/.ssh/id_ed25519_github` + `~/.ssh/id_ed25519_github.pub`
- 修改：`~/.ssh/config`
- 修改：本地 git remote URL

**职责：** 解决 GitHub HTTPS TLS 拦截问题，通过 SSH 协议 push 全部 commit。

- [ ] **步骤 3.1：生成 SSH 密钥对**

```bash
ssh-keygen -t ed25519 -C "tishensnoopy@superpowers-zh" -f ~/.ssh/id_ed25519_github -N ""
```

预期：生成 `~/.ssh/id_ed25519_github`（私钥）和 `~/.ssh/id_ed25519_github.pub`（公钥）

- [ ] **步骤 3.2：输出公钥（供用户添加到 GitHub）**

```bash
cat ~/.ssh/id_ed25519_github.pub
```

预期：输出以 `ssh-ed25519 AAAA...` 开头的公钥字符串

- [ ] **步骤 3.3：⚠️ 用户手动操作 — 将公钥添加到 GitHub**

**此步骤需要用户手动完成：**

1. 打开浏览器访问 https://github.com/settings/keys
2. 点击 "New SSH key"
3. Title 填 `superpowers-zh-dev`
4. Key 粘贴步骤 3.2 输出的公钥
5. 点击 "Add SSH key"

**用户完成后告知代理继续。**

- [ ] **步骤 3.4：配置 SSH config**

```bash
cat >> ~/.ssh/config << 'EOF'

Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
```

预期：`~/.ssh/config` 追加了 github.com 配置段

- [ ] **步骤 3.5：测试 SSH 连接 GitHub**

```bash
ssh -T -o StrictHostKeyChecking=no git@github.com 2>&1
```

预期（成功）：
```
Hi tishensnoopy! You've successfully authenticated, but GitHub does not provide shell access.
```

如果仍是 `Permission denied (publickey)`：检查公钥是否正确添加到 GitHub 账户。

- [ ] **步骤 3.6：修改 remote URL 为 SSH**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git remote set-url origin git@github.com:tishensnoopy/superpowers-zh.git
git remote -v
```

预期：
```
origin  git@github.com:tishensnoopy/superpowers-zh.git (fetch)
origin  git@github.com:tishensnoopy/superpowers-zh.git (push)
```

- [ ] **步骤 3.7：push 全部到 GitHub**

```bash
git push origin main
```

预期：push 成功，输出类似：
```
Enumerating objects: ...
Counting objects: ...
...
To github.com:tishensnoopy/superpowers-zh.git
 * [new branch]      main -> main
```

推送的 commit 数量：之前 63 + 任务 1 的 3 + 任务 2 的 5 + 设计文档 1 = **72 个 commit**

- [ ] **步骤 3.8：验证 GitHub 上可见最新 commit**

```bash
git log origin/main --oneline -1
```

预期：输出与本地 `HEAD` 一致的 commit hash

---

## 任务 4：测试服务器配置 git remote 并对齐

**文件：**
- 修改：测试服务器 `/opt/customer-site` 的 git remote 配置
- 创建：测试服务器 `~/.ssh/id_ed25519_github`（SSH key）

**职责：** 在测试服务器配置 GitHub remote，通过 SSH key 认证，`git fetch + reset --hard` 与 GitHub 对齐。

- [ ] **步骤 4.1：在测试服务器生成 SSH key**

```bash
sshpass -p 'Ysxkt12345' ssh -o StrictHostKeyChecking=no root@124.223.1.67 \
  'ssh-keygen -t ed25519 -C "test-server@superpowers-zh" -f ~/.ssh/id_ed25519_github -N "" && cat ~/.ssh/id_ed25519_github.pub'
```

预期：输出测试服务器的 SSH 公钥

- [ ] **步骤 4.2：⚠️ 用户手动操作 — 将测试服务器公钥添加到 GitHub**

**此步骤需要用户手动完成：**

1. 打开 https://github.com/settings/keys
2. 点击 "New SSH key"
3. Title 填 `test-server-124.223.1.67`
4. Key 粘贴步骤 4.1 输出的公钥
5. 点击 "Add SSH key"

**用户完成后告知代理继续。**

- [ ] **步骤 4.3：在测试服务器配置 SSH config**

```bash
sshpass -p 'Ysxkt12345' ssh root@124.223.1.67 << 'EOF'
cat >> ~/.ssh/config << 'SSHCONF'

Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
SSHCONF
chmod 600 ~/.ssh/config
EOF
```

预期：测试服务器 `~/.ssh/config` 配置完成

- [ ] **步骤 4.4：测试服务器测试 SSH 连接 GitHub**

```bash
sshpass -p 'Ysxkt12345' ssh root@124.223.1.67 \
  'ssh -T -o StrictHostKeyChecking=no git@github.com 2>&1'
```

预期：`Hi tishensnoopy! You've successfully authenticated...`

- [ ] **步骤 4.5：在测试服务器配置 git remote**

```bash
sshpass -p 'Ysxkt12345' ssh root@124.223.1.67 \
  'cd /opt/customer-site && git remote remove origin 2>/dev/null; git remote add origin git@github.com:tishensnoopy/superpowers-zh.git && git remote -v'
```

预期：
```
origin  git@github.com:tishensnoopy/superpowers-zh.git (fetch)
origin  git@github.com:tishensnoopy/superpowers-zh.git (push)
```

- [ ] **步骤 4.6：fetch 并对齐到 GitHub**

```bash
sshpass -p 'Ysxkt12345' ssh root@124.223.1.67 \
  'cd /opt/customer-site && git fetch origin && git reset --hard origin/main'
```

预期：
```
HEAD is now at xxxxxxx ...
```

（HEAD 与本地 + GitHub 完全一致）

- [ ] **步骤 4.7：验证测试服务器与 GitHub 对齐**

```bash
sshpass -p 'Ysxkt12345' ssh root@124.223.1.67 \
  'cd /opt/customer-site && git log --oneline -3'
```

预期：最近 3 个 commit 与本地一致

- [ ] **步骤 4.8：重建测试服务器 backend 容器**

```bash
sshpass -p 'Ysxkt12345' ssh root@124.223.1.67 \
  'cd /opt/customer-site && docker compose up -d --build backend && sleep 10 && docker logs yousen-backend --tail 30 2>&1 | grep -E "Server listening|campus geocode|lifecycle|error" | tail -10'
```

预期：
```
Server listening at: http://localhost:1337
[Register] campus geocoding lifecycle subscribed
```

---

## 任务 5：客户服务器同步

**文件：**
- 修改：客户服务器 `/opt/customer-site` 的代码
- 修改：客户服务器 git remote 配置

**职责：** 将客户服务器代码与 GitHub 对齐，重建容器（非 docker cp）。

- [ ] **步骤 5.1：检查客户服务器 SSH 可达性**

```bash
timeout 15 sshpass -p 'Ysxkt12345' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@121.196.210.191 \
  'echo "SSH_OK" && cd /opt/customer-site && git status --short | head -5'
```

预期：输出 `SSH_OK` 和 git 状态

如果超时：跳到步骤 5.8（降级方案）

- [ ] **步骤 5.2：在客户服务器生成 SSH key**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'ssh-keygen -t ed25519 -C "customer-server@yoosen.cn" -f ~/.ssh/id_ed25519_github -N "" 2>/dev/null; cat ~/.ssh/id_ed25519_github.pub'
```

- [ ] **步骤 5.3：⚠️ 用户手动操作 — 将客户服务器公钥添加到 GitHub**

**此步骤需要用户手动完成：**

1. 打开 https://github.com/settings/keys
2. 点击 "New SSH key"
3. Title 填 `customer-server-121.196.210.191`
4. Key 粘贴步骤 5.2 输出的公钥
5. 点击 "Add SSH key"

**用户完成后告知代理继续。**

- [ ] **步骤 5.4：客户服务器配置 SSH + remote**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 << 'EOF'
cat >> ~/.ssh/config << 'SSHCONF'

Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
SSHCONF
chmod 600 ~/.ssh/config

cd /opt/customer-site
git remote remove origin 2>/dev/null
git remote add origin git@github.com:tishensnoopy/superpowers-zh.git
ssh -T -o StrictHostKeyChecking=no git@github.com 2>&1
EOF
```

预期：`Hi tishensnoopy! You've successfully authenticated...`

- [ ] **步骤 5.5：客户服务器 fetch 并对齐**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cd /opt/customer-site && git fetch origin && git reset --hard origin/main && git log --oneline -3'
```

预期：HEAD 与 GitHub 一致

- [ ] **步骤 5.6：备份 .env（包含 AMAP_WEB_SERVICE_KEY）**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cp /opt/customer-site/.env /opt/customer-site/.env.backup-$(date +%Y%m%d) && grep AMAP_WEB_SERVICE_KEY /opt/customer-site/.env'
```

预期：`.env.backup-*` 创建，输出 `AMAP_WEB_SERVICE_KEY=1faffb1b...`

- [ ] **步骤 5.7：重建客户服务器 backend 容器**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cd /opt/customer-site && docker compose up -d --build backend 2>&1 | tail -20'
```

预期：backend 容器重建成功

> **如果 build 卡住超过 5 分钟**，参考降级方案（步骤 5.8）。

- [ ] **步骤 5.8：验证 backend 启动**

```bash
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'sleep 10 && docker logs yousen-backend --tail 30 2>&1 | grep -E "Server listening|campus geocode|lifecycle|error" | tail -10'
```

预期：
```
Server listening at: http://localhost:1337
[Register] campus geocoding lifecycle subscribed
```

- [ ] **步骤 5.9：降级方案 — 如果客户服务器无法访问 GitHub 或 build 卡住**

如果步骤 5.1 SSH 超时或步骤 5.5 无法 fetch GitHub：

```bash
# 从测试服务器打包最新代码
sshpass -p 'Ysxkt12345' ssh root@124.223.1.67 \
  'cd /opt/customer-site && git archive --format=tar.gz HEAD > /tmp/customer-site-latest.tar.gz && ls -lh /tmp/customer-site-latest.tar.gz'

# 通过测试服务器中转到客户服务器
sshpass -p 'Ysxkt12345' scp root@124.223.1.67:/tmp/customer-site-latest.tar.gz /tmp/
sshpass -p 'Ysxkt12345' scp /tmp/customer-site-latest.tar.gz root@121.196.210.191:/tmp/

# 在客户服务器解压（保留 .env 不覆盖）
sshpass -p 'Ysxkt12345' ssh root@121.196.210.191 \
  'cd /opt/customer-site && tar xzf /tmp/customer-site-latest.tar.gz --exclude=".env" && git log --oneline -3'
```

然后执行步骤 5.6-5.8 的备份和重建。

- [ ] **步骤 5.10：验证前端可访问**

```bash
curl -sI https://yoosen.cn 2>&1 | head -5
```

预期：`HTTP/2 200` 或 `HTTP/1.1 200`

---

## 任务 6：生成差异报告 + 规范流程文档

**文件：**
- 创建：`docs/superpowers/runbooks/2026-07-22-version-sync-report.md`
- 创建：`docs/superpowers/runbooks/2026-07-22-development-workflow.md`

**职责：** 记录同步前后的差异，建立规范开发流程文档防止未来不同步。

- [ ] **步骤 6.1：创建版本同步差异报告**

```bash
cat > docs/superpowers/runbooks/2026-07-22-version-sync-report.md << 'REPORT'
# 版本同步差异报告

> **生成日期：** 2026-07-22
> **同步范围：** 本地 / 测试服务器 / 客户服务器 / GitHub

## 1. 同步前状态

### 1.1 本地 (HEAD: 9435ea4)
- 领先 GitHub origin/main **63 个 commit**（从未 push）
- **48 个未提交修改**：
  - 19 个 schema.json（字段描述增强）
  - 13 个 component json（组件描述补充）
  - 1 个 Dockerfile（媒体库勾选框 BUG 修复）
  - 6 个 frontend tsx（字段增强）
- 缺失 5 个 geocoding commit

### 1.2 测试服务器 (HEAD: 7b15dd2)
- 5 个 geocoding commit（本地没有）
- 无 git remote 配置
- 有大量 untracked 工具配置目录（.claude-plugin/ 等）

### 1.3 客户服务器
- 通过 docker cp 部署，无 git 版本记录
- node_modules 不完整（lodash/fp/index.js 缺失）

### 1.4 GitHub (origin/main)
- 落后本地 63 个 commit
- HTTPS 不可达（GnuTLS TLS 拦截），SSH 可达

## 2. 同步操作

### 2.1 本地 48 个修改分组 commit
- Commit 1: feat(schema) — 32 files（schema + component 描述增强）
- Commit 2: fix(backend) — Dockerfile 媒体库 BUG 修复
- Commit 3: feat(frontend) — 6 files（api.ts + 组件字段增强）

### 2.2 测试服务器 geocoding commit 逆向同步
- 方法：git format-patch（测试服务器）→ git am（本地）
- 5 个 commit 全部成功应用
- 冲突：无（或描述手动合并过程）

### 2.3 GitHub SSH 配置
- 生成 ed25519 SSH key
- 修改 remote URL 从 HTTPS 改为 SSH
- push 全部 72 个 commit 成功

### 2.4 测试服务器对齐
- 配置 git remote（SSH）
- git fetch + git reset --hard origin/main
- 重建 backend 容器

### 2.5 客户服务器对齐
- （描述实际执行的方案：GitHub pull 或 rsync 降级）
- 重建 backend 容器

## 3. 同步后状态

### 3.1 版本一致性验证
| 环境 | HEAD commit | 与 GitHub 一致 |
|------|------------|---------------|
| 本地 | xxxxxxx | ✅ |
| GitHub | xxxxxxx | — |
| 测试服务器 | xxxxxxx | ✅ |
| 客户服务器 | xxxxxxx | ✅ |

### 3.2 功能验证
- [ ] 本地 backend 启动正常
- [ ] 测试服务器 backend 日志显示 geocoding lifecycle 注册
- [ ] 客户服务器 https://yoosen.cn 可访问
- [ ] 校区地图坐标正确

## 4. 遗留问题
- （如有：客户服务器 docker compose build 卡住、node_modules 不完整等）
REPORT

echo "✓ 差异报告已创建"
```

预期：报告文件创建成功

- [ ] **步骤 6.2：创建规范开发流程文档**

```bash
cat > docs/superpowers/runbooks/2026-07-22-development-workflow.md << 'WORKFLOW'
# 规范开发流程

> **创建日期：** 2026-07-22
> **适用范围：** superpowers-zh 项目所有后端开发工作

## 1. 核心原则

**所有后端开发工作必须在本地开发环境中完成，经单元测试、集成测试和功能测试验证通过后，方可通过版本控制系统部署至服务器环境。**

### 技术依据
Strapi v5 的核心配置机制（模型关系定义、权限策略设置、内容类型配置）仅在 development mode 下允许创建和修改。直接在生产服务器环境进行开发操作会导致：
- 配置变更无法正确持久化保存（docker compose up -d 重建容器会丢失 docker cp 的文件）
- 版本控制缺失（服务器上的改动没有 git 记录）
- 系统状态不一致（本地、GitHub、服务器三方代码不同步）

## 2. 开发环境

### 2.1 本地开发环境
- **路径：** `/home/tishensnoopy/project/superpowers-zh`
- **启动开发环境：** `docker compose up -d`（Strapi 以 development mode 运行）
- **运行测试：** `cd backend && npx vitest run`
- **Strapi Admin：** http://localhost:1337/admin

### 2.2 版本控制
- **GitHub 仓库：** `git@github.com:tishensnoopy/superpowers-zh.git`（SSH 协议）
- **主分支：** `main`
- **提交规范：** Conventional Commits（feat/fix/docs/chore/feat 等）

## 3. 标准开发流程

### 3.1 开发阶段
```
1. 在本地修改代码 / schema / 配置
2. 本地运行 Strapi 开发环境验证：docker compose up -d
3. 编写/运行单元测试：cd backend && npx vitest run
4. 集成测试：手动或自动化验证功能
5. git add + git commit（遵循 Conventional Commits）
```

### 3.2 部署阶段
```
1. git push origin main（推送到 GitHub）
2. SSH 到测试服务器（124.223.1.67）：
   cd /opt/customer-site
   git pull origin main
   docker compose up -d --build backend
3. 验证测试服务器功能正常
4. SSH 到客户服务器（121.196.210.191）：
   cd /opt/customer-site
   git pull origin main
   docker compose up -d --build backend
5. 验证客户服务器功能正常（https://yoosen.cn）
```

### 3.3 禁止事项
- ❌ **禁止**直接在服务器上修改代码
- ❌ **禁止**使用 docker cp 部署代码（仅用于临时调试）
- ❌ **禁止**在服务器上运行 strapi build 代替镜像重建
- ❌ **禁止**跳过测试直接部署

## 4. 环境信息

| 环境 | 地址 | 用途 | Strapi 模式 |
|------|------|------|------------|
| 本地 | `/home/tishensnoopy/project/superpowers-zh` | 开发 + 测试 | development |
| 测试服务器 | `124.223.1.67` | 集成验证 | production |
| 客户服务器 | `121.196.210.191` / `yoosen.cn` | 生产 | production |

## 5. SSH 凭据
- 测试服务器：`sshpass -p 'Ysxkt12345' ssh root@124.223.1.67`
- 客户服务器：`sshpass -p 'Ysxkt12345' ssh root@121.196.210.191`
- GitHub：SSH key 认证（`~/.ssh/id_ed25519_github`）
WORKFLOW

echo "✓ 规范流程文档已创建"
```

预期：流程文档创建成功

- [ ] **步骤 6.3：Commit 文档**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add docs/superpowers/runbooks/2026-07-22-version-sync-report.md \
        docs/superpowers/runbooks/2026-07-22-development-workflow.md
git commit -m "$(cat <<'EOF'
docs(runbook): 版本同步差异报告 + 规范开发流程文档

- 记录 Phase 0 同步前后三环境版本差异
- 建立本地开发 → 测试 → push → pull 的规范流程
- 明确禁止直接在服务器上修改代码
EOF
)"

git push origin main
```

预期：commit + push 成功

---

## 验证清单（全部任务完成后执行）

- [ ] **本地验证**
  - `git status` working tree clean（无未提交修改）
  - `git log --oneline -10` 显示 5 个 geocoding commit + 3 个分组 commit + 文档 commit
  - `git push origin main` 成功（无 TLS 错误）

- [ ] **测试服务器验证**
  - `git remote -v` 显示 origin 指向 GitHub SSH
  - `git log --oneline -1` 与本地一致
  - `docker compose up -d --build backend` 成功
  - backend 日志显示 `[Register] campus geocoding lifecycle subscribed`

- [ ] **客户服务器验证**
  - `git log --oneline -1` 与本地一致
  - `docker compose up -d --build backend` 成功（非 docker cp）
  - `https://yoosen.cn` 返回 200
  - 校区地图坐标正确

- [ ] **文档验证**
  - 差异报告已创建并 commit
  - 规范流程文档已创建并 commit
  - 两个文档已 push 到 GitHub
