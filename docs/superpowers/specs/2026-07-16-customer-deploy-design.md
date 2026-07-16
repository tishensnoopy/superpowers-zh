# 客户服务器生产部署设计规格（C 块）

> **日期：** 2026-07-16
> **状态：** 待用户审查
> **范围：** 单台客户服务器的生产部署体系（GitHub Actions 自动部署 + rsync 兜底 + SSL 预留 + Agent 整合 + Runbook）

## 1. 背景与目标

### 1.1 业务背景

佑森小课堂是一家武汉的幼小衔接教育机构。网站主体由 Strapi v5 后端 + Next.js 前端 + PostgreSQL + Redis + MeiliSearch 组成，已有完善的 [deploy.sh](../../../deploy.sh) 部署脚本（分阶段健康检查 + nginx 模式）。A 块（多租户中央控制）已完成，产出 `central`（中央管理后台）和 `agent`（客户服务器 Agent）。现需将客户服务器的部署体系生产化，整合 GitHub Actions CI/CD、Agent 部署、SSL 预留、Runbook 文档。

### 1.2 目标

1. **GitHub Actions 自动部署**：push 到 main 分支 → runner 主动 rsync 代码到客户服务器 → SSH 远程执行 deploy.sh
2. **rsync 兜底**：客户服务器无需连 GitHub，由 runner 主动推送代码，规避国内服务器连 GitHub 不稳定问题
3. **Agent 整合**：deploy.sh 追加 `--agent` 选项，一键启动 Agent 容器
4. **SSL 预留**：nginx.conf 追加 HTTPS server 块（注释化），配域名后即可启用
5. **Runbook 文档**：整合首次部署、更新部署、回滚、Agent 注册、SSL 启用、微信回调启用等操作流程

### 1.3 非目标（YAGNI）

- **central 部署**：central 部署在另一台服务器，不在 C 块范围内
- **真实 SSL 证书申请**：当前无域名，仅预留配置；真实证书申请待后续配域名时执行
- **微信真实凭证配置**：代码已就绪，凭证填入 .env 待后续
- **多客户服务器集群**：C 块仅覆盖单台客户服务器部署
- **Gitee/CNB 国内镜像**：rsync 兜底已足够，不引入双远程复杂度
- **Blue-green / canary 部署**：单台服务器不需要

### 1.4 约束

- **服务器无域名**：当前用 IP 访问，nginx 仅监听 80 端口；微信 webhook 因强制要求 HTTPS 暂不可用
- **客户服务器在国内**：连 GitHub 不稳定，必须用 rsync 由 runner 主动推送
- **零第三方依赖**：deploy.sh 仅用 bash + docker compose，workflow 仅用 GitHub 官方 actions + rsync
- **复用现有 deploy.sh**：不重写，只追加 `--no-pull` 和 `--agent` 选项

## 2. 部署拓扑

```
┌──────────────────────────────────────────────────────────────────┐
│ GitHub 仓库（main 分支）                                          │
│   ↓ push 触发                                                     │
│ GitHub Actions Runner（境外，连 GitHub 稳定）                     │
│   1. checkout 代码                                                │
│   2. ssh-agent 加载私钥                                           │
│   3. rsync 同步代码 → 客户服务器（排除 .env/node_modules/.git）   │
│   4. SSH 远程执行 deploy.sh --no-pull --nginx -d                  │
└──────────────────────────────────────────────────────────────────┘
                          ↓ rsync + ssh（公网）
┌──────────────────────────────────────────────────────────────────┐
│ 客户服务器（单台，国内，IP 访问）                                 │
│                                                                   │
│  /opt/yousen/                    ← 项目代码（rsync 同步）         │
│    ├── backend/                                                  │
│    ├── frontend-next/                                            │
│    ├── docker-compose.yml                                        │
│    ├── docker-compose.nginx.yml                                  │
│    ├── nginx/nginx.conf                                          │
│    ├── deploy.sh                                                 │
│    ├── scripts/agent-compose.yml                                 │
│    └── .env                       ← 服务器端维护，不进 Git        │
│                                                                   │
│  Docker 容器：                                                    │
│    ├── postgres + redis + meilisearch  ← 基础设施                 │
│    ├── backend (Strapi)                ← 后端                     │
│    ├── frontend (Next.js)              ← 前端                     │
│    ├── nginx                            ← 反向代理（80 端口）     │
│    └── agent                            ← 客户 Agent（--agent）   │
│                                                                   │
│  Agent ←── WebSocket 长连接 ──→ Central（另一台服务器）           │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 已有资产盘点

| 资产 | 路径 | 状态 | C 块动作 |
|------|------|------|---------|
| deploy.sh | [deploy.sh](../../../deploy.sh) | 完善（311 行，分阶段健康检查 + nginx 模式） | 修改：追加 `--no-pull` 和 `--agent` 选项 |
| nginx.conf | [nginx/nginx.conf](../../../nginx/nginx.conf) | 仅 HTTP 80 端口 | 修改：追加注释化 HTTPS server 块 |
| .env.example | [.env.example](../../../.env.example) | 完整（含微信配置） | 修改：追加 Agent 相关变量 |
| 微信集成代码 | `backend/src/api/wechat/`、`frontend-next/lib/wechat.ts` 等 | 完整 | 不动，Runbook 说明启用步骤 |
| agent/README.md | [agent/README.md](../../../agent/README.md) | 完整安装指南 | 不动，Runbook 引用 |
| deploy-site.yml | [.github/workflows/deploy-site.yml](../../../.github/workflows/deploy-site.yml) | superpowers-zh 官网部署（Cloudflare Pages） | 不动，**新建** deploy-customer.yml |
| docker-compose.yml | [docker-compose.yml](../../../docker-compose.yml) | 客户业务 compose | 不动 |
| docker-compose.nginx.yml | [docker-compose.nginx.yml](../../../docker-compose.nginx.yml) | nginx 模式 compose | 不动 |

## 4. 文件结构

```
.github/workflows/
└── deploy-customer.yml              # 新建：客户业务自动部署 workflow
nginx/
└── nginx.conf                       # 修改：追加 HTTPS 预留 server 块
deploy.sh                            # 修改：追加 --no-pull 和 --agent 选项
.env.example                         # 修改：追加 Agent 变量
scripts/
└── agent-compose.yml                # 新建：Agent 容器 compose 模板
docs/
└── DEPLOY-RUNBOOK.md                # 新建：生产部署操作手册
docs/superpowers/specs/
└── 2026-07-16-customer-deploy-design.md  # 本文档
docs/superpowers/plans/
└── 2026-07-16-customer-deploy.md         # 实现计划（writing-plans 产出）
```

## 5. 关键设计决策

### 5.1 GitHub Actions 自动部署

**核心策略**：不依赖客户服务器连 GitHub，由 GitHub Actions runner 主动 rsync 代码到服务器。

**workflow 触发**：
- `push` 到 `main` 分支，paths: `backend/**`, `frontend-next/**`, `docker-compose.yml`, `docker-compose.nginx.yml`, `nginx/**`, `deploy.sh`, `scripts/agent-compose.yml`
- `workflow_dispatch` 手动触发（支持输入 `restart_agent` 布尔参数，默认 false）

**workflow 步骤**：
1. `actions/checkout@<SHA>` 拉取代码（runner 在境外，连 GitHub 稳定）
2. `webfactory/ssh-agent@<SHA>` 加载 SSH key
3. `ssh-keyscan` 将 SERVER_IP 加入 known_hosts（避免首次连接交互提示）
4. **rsync 同步代码**到 `$DEPLOY_PATH`：
   ```bash
   rsync -avz --delete \
     --exclude='.git/' \
     --exclude='node_modules/' \
     --exclude='.next/' \
     --exclude='dist/' \
     --exclude='build/' \
     --exclude='.env' \
     --exclude='*.log' \
     --exclude='data/' \
     --exclude='strapi_uploads/' \
     --exclude='strapi_pg_data/' \
     --exclude='strapi_redis_data/' \
     --exclude='strapi_meili_data/' \
     --exclude='.cache/' \
     --exclude='.npmrc' \
     -e "ssh -p ${DEPLOY_SSH_PORT:-22}" \
     ./ ${DEPLOY_USER:-root}@${SERVER_IP}:${DEPLOY_PATH}/
   ```
   关键：`--exclude='.env'` 确保服务器端 `.env` 不被覆盖
5. SSH 远程执行部署：
   ```bash
   ssh -p ${DEPLOY_SSH_PORT:-22} ${DEPLOY_USER:-root}@${SERVER_IP} \
     "cd ${DEPLOY_PATH} && ./deploy.sh --no-pull --nginx -d"
   ```
6. 失败时：`actions/upload-artifact` 上传 deploy.sh 输出日志

**Actions SHA 固定**：参考已有 [deploy-site.yml](../../../.github/workflows/deploy-site.yml) 模式，所有 actions 用 SHA 固定，防供应链劫持。

### 5.2 GitHub Secrets 清单

| Secret | 用途 | 必填 | 示例 |
|--------|------|------|------|
| `SSH_PRIVATE_KEY` | SSH 登录私钥（runner → 服务器） | ✅ | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SERVER_IP` | 客户服务器公网 IP | ✅ | `1.2.3.4` |
| `DEPLOY_PATH` | 服务器项目路径 | ✅ | `/opt/yousen` |
| `DEPLOY_SSH_PORT` | SSH 端口（默认 22） | 可选 | `22` |
| `DEPLOY_USER` | SSH 登录用户（默认 root） | 可选 | `root` |

**敏感变量隔离原则**：客户业务的 `DATABASE_PASSWORD`/`APP_KEYS`/`JWT_SECRET`/`DASHSCOPE_API_KEY`/`WECHAT_APP_ID`/`WECHAT_APP_SECRET`/`WECHAT_TOKEN` 等**不进 GitHub Secrets**，仅在服务器 `.env` 维护，避免仓库泄露导致密钥泄露。GitHub Secrets 只存"如何连接到服务器"的信息。

### 5.3 deploy.sh 改动

追加两个选项（现有选项不变）：

| 选项 | 用途 | 使用场景 |
|------|------|---------|
| `--no-pull` | 跳过 git pull | rsync 模式专用（代码已由 runner 同步） |
| `--agent` | 部署完成后启动 agent 容器 | 首次部署或 agent 升级时 |
| `--no-agent` | 显式跳过 agent 启动（默认行为，向后兼容） | 不需要 agent 时 |

**`--agent` 行为**：
1. 检查 `${DEPLOY_PATH}/scripts/agent-compose.yml` 是否存在，不存在则报错退出
2. 检查 `${DEPLOY_PATH}/.env` 是否包含 `AGENT_TOKEN` 和 `SERVER_ID`，不存在则提示先执行 `agent register` 流程
3. 执行 `docker compose -f scripts/agent-compose.yml up -d`
4. 等待 5 秒，检查 agent 容器健康状态
5. 输出 agent 状态

**`--no-pull` 行为**：
- 现有 deploy.sh 实际上没有 git pull 步骤（它只跑 docker compose），所以 `--no-pull` 当前是被接受但不执行实质动作的语义选项，用于明确"代码已由 rsync 同步，不要尝试任何 git 操作"。
- 实现要点：在 deploy.sh 中设置 `NO_PULL=1` 标志位。当前不触发任何行为差异，但记录在日志中（`[mode] no-pull (rsync mode)`）。未来如果 deploy.sh 加入 git pull 步骤，此标志位用于跳过 git pull。
- 这样设计的目的是：让 GitHub Actions workflow 调用 `deploy.sh --no-pull` 时语义明确，避免未来 deploy.sh 增加 git pull 后行为意外变化。

### 5.4 Agent 部署整合

**scripts/agent-compose.yml 模板**（基于 [agent/README.md](../../../agent/README.md)）：

> **路径处理**：agent-compose.yml 中的 `env_file` 和 `volumes` 路径必须与实际部署路径一致。模板中用 `${DEPLOY_PATH}` 占位，由 deploy.sh 在启动 agent 前用 `envsubst` 替换为实际路径（如 `/opt/yousen`）。

```yaml
# 用法：deploy.sh --agent 时，由 deploy.sh 调用 envsubst 替换 ${DEPLOY_PATH} 后再 docker compose up
services:
  agent:
    image: registry.cn-hangzhou.aliyuncs.com/yousen/agent:latest
    container_name: yousen-agent
    restart: unless-stopped
    env_file: ${DEPLOY_PATH}/.env
    environment:
      CENTRAL_WS_URL: ${CENTRAL_WS_URL}
      DATA_DIR: ${DEPLOY_PATH}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ${DEPLOY_PATH}:${DEPLOY_PATH}:rw
    network_mode: host
```

**.env 追加变量**：
```env
# === Agent（多租户中央控制）===
CENTRAL_WS_URL=wss://central.yousen.example.com/api/agent/ws
AGENT_TOKEN=
SERVER_ID=
```

**首次注册流程**（Runbook 详述）：
1. 在 central 管理后台为客户颁发 enrollment code
2. 在客户服务器执行 agent register 命令（见 agent/README.md）
3. 注册成功后 .env 写入 AGENT_TOKEN 和 SERVER_ID
4. 后续部署用 `./deploy.sh --nginx -d --agent` 同时启动业务 + agent

### 5.5 nginx SSL 预留

**当前**：保持 80 端口 HTTP 工作模式

**追加**（注释化的 443 server 块）：
```nginx
# === HTTPS 预留（配域名后取消注释启用）===
# server {
#     listen 443 ssl http2 default_server;
#     listen [::]:443 ssl http2 default_server;
#     server_name your-domain.com;
#
#     ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
#
#     # 复用 80 端口的所有 location 配置
#     # ...（同 80 端口的 location 块）
# }
#
# # HTTP 强制跳转 HTTPS（启用 HTTPS 后取消注释）
# server {
#     listen 80 default_server;
#     server_name your-domain.com;
#     return 301 https://$server_name$request_uri;
# }
```

**启用步骤**（Runbook 详述）：
1. 域名 DNS 解析到服务器 IP
2. `sudo apt install certbot python3-certbot-nginx`
3. `sudo certbot --nginx -d your-domain.com`
4. 取消 nginx.conf 中 HTTPS server 块的注释
5. `docker compose -f docker-compose.yml -f docker-compose.nginx.yml restart nginx`
6. 微信公众号后台配置 webhook URL：`https://your-domain.com/api/wechat/webhook`

### 5.6 兜底链路

| 场景 | 兜底方式 |
|------|---------|
| 客户服务器连不上 GitHub | rsync 由 runner 主动推送，服务器无需连 GitHub |
| GitHub Actions runner 连不上服务器 SSH | workflow 失败，手动 `ssh user@IP "cd $DEPLOY_PATH && ./deploy.sh --no-pull --nginx -d"` |
| 完全离线场景 | 本地 `rsync` + `ssh` 手动执行（Runbook 提供脚本） |
| rsync 同步失败 | workflow 步骤 4 失败立即中止，不会执行步骤 5（避免半状态） |
| agent 容器启动失败 | deploy.sh 输出错误日志，不影响业务容器（agent 与业务解耦） |
| docker compose build 失败 | deploy.sh 现有逻辑会报错退出，workflow 步骤 5 SSH 命令非 0 退出码触发 GitHub Actions 失败 |

## 6. Runbook 结构

`docs/DEPLOY-RUNBOOK.md` 包含以下章节：

1. **前置准备**：服务器要求、SSH key 配置、GitHub Secrets 配置
2. **首次部署**：
   - 服务器初始化（安装 Docker、配置镜像加速器）
   - `git clone` 项目到 `/opt/yousen`
   - `cp .env.example .env` 并填入敏感变量
   - `./deploy.sh --configure-mirrors`（首次）
   - `./deploy.sh --nginx -d`（首次启动业务）
   - Agent 注册（见 agent/README.md）
   - `./deploy.sh --nginx -d --agent`（后续带 agent 部署）
3. **更新部署**：
   - 自动：push 到 main → GitHub Actions 自动执行
   - 手动：`ssh user@IP "cd /opt/yousen && git pull && ./deploy.sh --nginx -d"`
4. **回滚**：
   - `git checkout <previous-tag>` + `./deploy.sh --nginx -d --no-build`
5. **Agent 管理**：
   - 注册、启动、停止、查看日志、升级
6. **SSL 启用**（配域名后）：
   - certbot 申请证书 + 取消 nginx.conf 注释 + 重启 nginx
7. **微信回调启用**（配域名 + SSL 后）：
   - 填入 .env 凭证 + 公众号后台配置 webhook URL
8. **故障排查**：
   - GitHub Actions 失败排查
   - rsync 失败排查
   - deploy.sh 各阶段失败排查
   - agent 连不上 central 排查
9. **手动离线部署**（GitHub 完全不可用）：
   - 本地打包代码 → scp 到服务器 → 解压 → deploy.sh

## 7. 安全考量

- **SSH 私钥**：仅存在 GitHub Secrets，不进入代码仓库；使用专用部署 key（非个人 key）
- **服务器 .env 隔离**：rsync 排除 `.env`，避免仓库内容覆盖服务器敏感配置
- **GitHub Actions 权限**：`permissions: contents: read`，仅读代码 + 写 artifact
- **Actions SHA 固定**：所有第三方 actions 用 SHA 固定，防供应链劫持
- **ssh-keyscan**：首次添加 known_hosts，避免 MITM；后续可考虑改用 SSH CA 签名
- **agent token**：长期 token，存在服务器 `.env`（权限 600），不进入 Git
- **docker.sock 挂载**：agent 容器挂载 docker.sock，需确保服务器不跑其他敏感业务

## 8. 验收标准

1. push 到 main 分支（触及指定 paths）触发 GitHub Actions workflow
2. workflow 完成 rsync 同步 + SSH 远程部署，客户服务器业务正常启动
3. `workflow_dispatch` 手动触发支持 `restart_agent` 参数
4. `./deploy.sh --no-pull --nginx -d` 在服务器端正常执行（rsync 模式）
5. `./deploy.sh --nginx -d --agent` 同时启动业务 + agent 容器
6. agent 容器启动后能连上 central（前提：central 已部署且 .env 配置正确）
7. nginx.conf 包含注释化的 HTTPS server 块，取消注释 + 配证书后可启用
8. `.env.example` 包含 Agent 相关变量（CENTRAL_WS_URL、AGENT_TOKEN、SERVER_ID）
9. `scripts/agent-compose.yml` 模板可用
10. `docs/DEPLOY-RUNBOOK.md` 覆盖 9 个章节
11. GitHub Secrets 清单在 Runbook 中文档化
12. 手动离线部署脚本在 Runbook 中提供

## 9. 与已有资产的关系

### 9.1 与 A 块（多租户中央控制）的关系

- **agent**：A 块产出的 agent 容器，C 块负责其在客户服务器的部署整合
- **central**：A 块产出的 central 管理后台，**不在 C 块范围**，由另一台服务器部署（另立计划）
- **enrollment 流程**：A 块设计的 agent 注册流程，C 块在 Runbook 中引用 agent/README.md

### 9.2 与微信集成（5C）的关系

- 微信集成代码已完整（spec + plan + 代码 + 测试）
- C 块不动微信代码，仅在 Runbook 中说明生产启用步骤
- **当前 HTTP only 模式下微信 webhook 不可用**（微信强制 HTTPS），待配域名 + SSL 后启用

### 9.3 与现有 deploy.sh 的关系

- C 块不重写 deploy.sh，仅追加 `--no-pull` 和 `--agent` 选项
- 现有 `--nginx`/`-d`/`--no-build`/`--clean`/`--status`/`--logs`/`--down`/`--configure-mirrors` 选项不变
- 现有分阶段健康检查逻辑（postgres → backend → frontend → nginx）不变

## 10. 用户决策记录

以下决策由用户在 brainstorming 过程中通过 AskUserQuestion 确认：

1. **部署拓扑**：单台客户服务器跑业务（postgres+backend+frontend+nginx）+ agent；central 在另一台服务器
2. **SSL 方案**：无域名，用 IP 访问（HTTP only）；微信 webhook 暂不可用，待配域名后启用
3. **CI/CD**：GitHub Actions 自动部署（push to main → SSH → 部署）
4. **Git 兜底**：rsync 同步（runner 主动推送，服务器无需连 GitHub）
5. **central 范围**：central 部署不在 C 块范围内
6. **Agent 整合**：agent 按 `--agent` 选项整合进 deploy.sh
