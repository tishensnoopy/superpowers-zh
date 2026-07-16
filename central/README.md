# 中央管理后台部署指南

## 前置要求

- Node.js 20+
- PostgreSQL 15+
- npm 10+

## 1. 初始化数据库

```bash
# 创建 control_db
createdb control_db

# 执行 schema
psql control_db -f db/schema.sql

# 执行 seed（创建默认 superadmin）
psql control_db -f db/seed.sql
# 或：npm run db:seed
```

默认管理员账号：
- email: `admin@yousen.local`
- password: 首次启动时由 `INITIAL_ADMIN_PASSWORD` env 决定，登录后强制改密

## 2. 配置环境变量

```bash
cp .env.example .env
```

`.env` 必填项：
```env
DATABASE_URL=postgres://user:pass@localhost:5432/control_db
AES_KEY=<base64 编码的 32 字节密钥，用 `openssl rand -base64 32` 生成>
JWT_SECRET=<随机字符串，用 `openssl rand -base64 32` 生成>
ADMIN_JWT_SECRET=<随机字符串>
PORT=3000
```

密钥轮换时：
```env
AES_KEY=<新密钥>
AES_KEY_PREVIOUS=<旧密钥>  # 保留 30 天后可移除
```

## 3. 启动

```bash
npm install
npm run build
npm start
```

访问 `http://localhost:3000/login`。

## 4. 首次使用流程

1. 用默认管理员账号登录
2. 修改密码
3. 创建客户（客户名 + 联系人 + 联系电话）
4. 为客户颁发 enrollment code（24 小时有效）
5. 在客户服务器上跑 Agent 注册（见 `agent/README.md`）
6. Agent 上线后，在中央管理后台：
   - 编辑客户配置（品牌 / AI / 部署 / 环境变量）
   - 发布配置版本
   - 触发部署（git pull + docker compose up --build + 健康检查）
   - 实时查看部署日志
   - 查看任务历史
   - 查看审计日志

## 5. 生产部署

- 用 nginx 反向代理，`proxy_read_timeout 3600s`（WebSocket 长连接需要）
- HTTPS 必须启用（token 在 URL query 中传输）
- 数据库定期备份（pg_dump control_db）
- AES_KEY 备份到密码管理器（丢失则所有加密配置无法解密）

## 6. 安全注意事项

- `AES_KEY` 一旦丢失，所有客户敏感配置（dashscopeKey / wechatAppSecret / DATABASE_PASSWORD 等）无法解密
- token revoke 后 Agent 立即断开，需要重新走 enrollment 流程
- 单 IP 5 分钟内 3 次 enrollment 失败会锁定 1 小时
- enrollment code 失败 5 次自动作废
- 所有管理操作（创建/修改/删除/部署/revoke）都记录到 audit_logs

## 7. 监控

- 服务器列表页显示所有 Agent 在线状态
- 任务历史页显示所有部署/同步/重启任务
- 审计日志页可按类型、action、管理员过滤
- job_manager 每 60s 扫描超时任务（5 分钟无 result 标记为 failed）
- heartbeat-monitor 每 10s 扫描过期心跳（60s 无心跳标记为 offline）
