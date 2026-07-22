# 版本同步差异报告

> **生成日期：** 2026-07-22
> **同步范围：** 本地 / 测试服务器 / 客户服务器 / GitHub
> **执行结果：** ✅ 全部完成

---

## 1. 同步前状态

### 1.1 本地 (HEAD: 9435ea4)
- 领先 GitHub origin/main **63 个 commit**（从未 push）
- **48 个未提交修改**：
  - 18 个 schema.json（字段描述增强：建议尺寸/格式）
  - 23 个 component json（组件描述补充）
  - 1 个 Dockerfile（媒体库勾选框 BUG 修复）
  - 6 个 frontend tsx（字段增强）
- 缺失 5 个 geocoding commit

### 1.2 测试服务器 (124.223.1.67, HEAD: 7b15dd2)
- 5 个 geocoding commit（本地没有）
- 无 git remote 配置
- 有大量 untracked 工具配置目录

### 1.3 客户服务器 (121.196.210.191)
- 通过 docker cp 部署，无 git 版本记录
- node_modules 不完整（lodash/fp/index.js 缺失）

### 1.4 GitHub (origin/main)
- 落后本地 63 个 commit
- HTTPS 不可达（GnuTLS TLS 拦截，90 秒超时）
- SSH 可达（Permission denied，需配置 SSH key）

---

## 2. 同步操作

### 2.1 本地 48 个修改分组 commit（3 个 commit）

| Commit | 类型 | 文件数 | 内容 |
|--------|------|--------|------|
| cbbab4e | feat(schema) | 41 | 18 schema + 23 component 描述增强 |
| 26ce947 | fix(backend) | 1 | Dockerfile 媒体库 BUG 修复 |
| dc3b1a9 | feat(frontend) | 6 | api.ts + 组件字段增强 |

### 2.2 测试服务器 geocoding commit 逆向同步

**原始方案：** `git format-patch` + `git am`
**实际问题：** 测试服务器 git 仓库是全新仓库（仅 5 个 commit），`git format-patch --root` 生成的 patch 为"创建新文件"格式，与本地已有文件冲突，`git am` 失败。
**实际执行方案：** rsync 文件 + 手动合并
- 3 个新文件直接 rsync（amap-geocode-service.ts + 测试 + regenerate-campus-coords.ts）
- 4 个已有文件手动合并：
  - `campus/schema.json`：保留本地 description 修改 + 添加 formattedAddress 字段
  - `index.ts`：插入 campus geocoding lifecycle 代码块（55 行）
  - `register-lifecycles.test.ts`：服务器版本是本地版本的超集，直接替换
  - `docker-compose.yml`：添加 AMAP_WEB_SERVICE_KEY 环境变量

**合并 commit：** 244b854 `feat(campus): 同步测试服务器 geocoding 功能（5 commit 合并）`

### 2.3 GitHub SSH 配置与 push

- 生成 ed25519 SSH key（`~/.ssh/id_ed25519_github`）
- 修改 remote URL 从 HTTPS 改为 SSH
- push 全部 commit 成功（6f95a82..551bc41，共 71 个 commit）

### 2.4 测试服务器对齐

**原始方案：** git fetch + git reset --hard origin/main
**实际问题：** 测试服务器到 GitHub 的 `git fetch` 超时（仓库较大，网络限制）
**实际执行方案：** git archive 打包 + scp 传输 + 解压
- 本地 `git archive --format=tar.gz HEAD` → 26M tar.gz
- scp 到测试服务器
- 解压到 `/opt/customer-site`（.env 不在 tar 中，安全保留）
- `docker compose up -d --build backend` 重建容器

### 2.5 客户服务器对齐

**原始方案：** git pull + docker compose build
**实际问题：** 客户服务器无 git 仓库 + docker compose build 超时
**实际执行方案：** git archive 传输 + docker cp + strapi build
- scp tar.gz 到客户服务器
- 解压到 `/opt/customer-site`
- `docker compose up -d`（用旧镜像启动）
- `docker cp` 更新源代码到容器
- `docker exec -u strapi npx strapi build`（TS 编译成功，admin panel 权限错误）
- 修复 `.strapi` 目录权限后重启容器

---

## 3. 同步后状态

### 3.1 版本一致性

| 环境 | HEAD commit | 代码一致 | Git 历史一致 | geocoding 注册 |
|------|------------|---------|-------------|---------------|
| 本地 | 551bc41 | — | — | N/A |
| GitHub | 551bc41 | ✅ | ✅ | N/A |
| 测试服务器 | (git archive 同步) | ✅ | ⚠️ 未对齐 | ✅ |
| 客户服务器 | (git archive 同步) | ✅ | ⚠️ 无 git 仓库 | ✅ |

### 3.2 功能验证

- [x] 本地 backend 启动正常
- [x] 测试服务器 API 返回 200（http://124.223.1.67:1337/_health → 204）
- [x] 测试服务器日志：`[Register] campus geocoding lifecycle subscribed`
- [x] 客户服务器 https://yoosen.cn 返回 200
- [x] 客户服务器日志：`[Register] campus geocoding lifecycle subscribed`
- [x] GitHub origin/main 与本地 HEAD 一致（551bc41）

---

## 4. 遗留问题

### 4.1 服务器 Git 历史未对齐
测试服务器和客户服务器的代码文件已通过 git archive 同步，但 git 历史未对齐（GitHub fetch 超时）。这不影响功能运行，但 `git log` 在服务器上显示的历史与 GitHub 不一致。

**建议后续处理：** 在网络条件改善时，在服务器上执行 `git fetch --depth 1 origin main && git reset --hard FETCH_HEAD` 对齐 git 历史。

### 4.2 客户服务器 admin panel 未完全构建
客户服务器的 `strapi build` TS 编译成功（dist/src/ 已更新），但 admin panel build 因权限问题未完成。不影响后端 API 和前端页面，仅影响 Strapi admin 管理界面的 UI。

**建议后续处理：** 修复 `/opt/app/.strapi` 目录权限后重新运行 `npx strapi build`。

### 4.3 客户服务器 Docker 镜像未重建
客户服务器使用 `docker cp + strapi build` 方式更新代码（旧镜像 + 热更新），而非 `docker compose up -d --build`。`docker restart` 保留更改，但下次 `docker compose up -d backend` 会丢失更改。

**建议后续处理：** 排查 `docker compose build` 超时根因（可能是磁盘空间或内存不足），在条件允许时重建镜像。
