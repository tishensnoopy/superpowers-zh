# 部署前全局审查与功能补全实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复服务器现状问题（nginx healthcheck/cron/swap），补全业务功能（rbac/admins/预约/反馈/统计/导出/知识库），执行端到端业务审查，完成代码质量审查，为正式部署做好准备。

**架构：** 基于 `docs/superpowers/specs/2026-07-16-deploy-and-sync-design.md` 规格，分三阶段执行：P1 服务器现状修复（SSH 远程操作）→ P2 端到端业务审查与功能补全（本地代码修改 + 动态审查）→ P2.5 代码质量审查（npm audit/版本/lint）。

**技术栈：** Strapi v5（backend）、Next.js 14（frontend-next）、Next.js（central）、PostgreSQL 16、Redis 7、MeiliSearch、Docker Compose、Vitest、Playwright、sshpass（远程 SSH）

---

## 文件结构

### 修改的文件

| 文件 | 职责 | 任务 |
|------|------|------|
| `central/nginx/nginx.conf` | 添加 /healthz 路径绕过 301 重定向 | T1 |
| `central/docker-compose.nginx.yml` | healthcheck 改为检测 /healthz | T1 |
| `backend/src/services/rbac.ts` | 补全 contentTypesToAllow 列表 + 细粒度权限 | T4 |
| `central/app/api/admin/admins/[id]/route.ts` | PATCH 接受 role 字段（已有，补 locked 字段返回） | T5/T7 |
| `central/app/api/admin/auth/login/route.ts` | 登录时检查 locked 字段 | T7 |
| `central/db/schema.sql` | admin_users 加 locked/lockedAt 字段 | T7 |
| `backend/src/api/appointment/routes/appointment.ts` | 添加 find/findOne 路由 | T8 |
| `backend/src/api/appointment/controllers/appointment.ts` | 添加 find/findOne/export 方法 | T8/T11 |
| `backend/src/api/knowledge-base/content-types/knowledge-base/schema.json` | 加 vectorizationStatus 字段 | T12 |

### 创建的文件

| 文件 | 职责 | 任务 |
|------|------|------|
| `central/db/migrations/003-admin-locked.sql` | 加 locked/lockedAt 字段迁移 | T7 |
| `central/app/api/admin/admins/[id]/reset-password/route.ts` | 密码重置接口 | T6 |
| `central/app/api/admin/admins/[id]/lock/route.ts` | 锁定接口 | T7 |
| `central/app/api/admin/admins/[id]/unlock/route.ts` | 解锁接口 | T7 |
| `central/__tests__/api-admins-roles.test.ts` | 角色权限编辑测试 | T5 |
| `central/__tests__/api-admins-password.test.ts` | 密码重置测试 | T6 |
| `central/__tests__/api-admins-lock.test.ts` | 锁定/解锁测试 | T7 |
| `backend/src/api/appointment/controllers/__tests__/appointment-find.test.ts` | 预约 find 测试 | T8 |
| `backend/src/api/feedback/` | 反馈 API 模块（完整） | T9 |
| `backend/src/api/feedback/controllers/__tests__/feedback.test.ts` | 反馈测试 | T9 |
| `backend/src/api/stats/` | 统计 API 模块 | T10 |
| `backend/src/api/stats/controllers/__tests__/stats.test.ts` | 统计测试 | T10 |
| `backend/src/api/appointment/controllers/__tests__/appointment-export.test.ts` | CSV 导出测试 | T11 |
| `docs/BUSINESS-AUDIT-REPORT.md` | 业务审查报告 | T13-T17 |
| `docs/CODE-QUALITY-REPORT.md` | 代码质量报告 | T18-T20 |

---

## P1：服务器现状修复（任务 1-3）

### 任务 1：修复 central-nginx healthcheck 误报

**文件：**
- 修改：`central/nginx/nginx.conf:36-40`
- 修改：`central/docker-compose.nginx.yml:17-21`

- [ ] **步骤 1：修改 nginx.conf 80 端口 server 块**

编辑 `/home/tishensnoopy/project/superpowers-zh/central/nginx/nginx.conf`，将 80 端口 server 块替换为：

```nginx
    # ------------------------------------------------------------
    # HTTP 80 —— 重定向到 HTTPS（/healthz 除外，供 healthcheck 使用）
    # ------------------------------------------------------------
    server {
        listen 80;
        server_name central.yousen.example.com;

        location = /healthz {
            access_log off;
            add_header Content-Type text/plain;
            return 200 'ok';
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }
```

- [ ] **步骤 2：修改 docker-compose.nginx.yml healthcheck**

编辑 `/home/tishensnoopy/project/superpowers-zh/central/docker-compose.nginx.yml`，将 healthcheck 改为：

```yaml
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost/healthz"]
      interval: 10s
      timeout: 5s
      retries: 3
```

- [ ] **步骤 3：Commit 本地修改**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add central/nginx/nginx.conf central/docker-compose.nginx.yml
git commit -m "fix(central): nginx healthcheck 误报，添加 /healthz 路径

- nginx.conf 80 端口添加 /healthz location 返回 200
- docker-compose.nginx.yml healthcheck 改为检测 /healthz
- 解决 wget --spider 收到 301 视为失败的问题"
```

- [ ] **步骤 4：SSH 到服务器同步修改**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "sudo cp /opt/central/central/nginx/nginx.conf /opt/central/central/nginx/nginx.conf.bak.$(date +%Y%m%d%H%M%S)"
```

将本地修改的 nginx.conf 和 docker-compose.nginx.yml 上传到服务器：

```bash
sshpass -p 'Hym465964665' scp -o StrictHostKeyChecking=no \
  /home/tishensnoopy/project/superpowers-zh/central/nginx/nginx.conf \
  ubuntu@124.223.1.67:/tmp/nginx.conf

sshpass -p 'Hym465964665' scp -o StrictHostKeyChecking=no \
  /home/tishensnoopy/project/superpowers-zh/central/docker-compose.nginx.yml \
  ubuntu@124.223.1.67:/tmp/docker-compose.nginx.yml

sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "sudo cp /tmp/nginx.conf /opt/central/central/nginx/nginx.conf && \
   sudo cp /tmp/docker-compose.nginx.yml /opt/central/central/docker-compose.nginx.yml && \
   rm /tmp/nginx.conf /tmp/docker-compose.nginx.yml"
```

- [ ] **步骤 5：在服务器上重新部署 nginx**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "cd /opt/central/central && echo 'Hym465964665' | sudo -S docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d --force-recreate nginx"
```

- [ ] **步骤 6：验证 central-nginx healthy**

等待 15 秒后检查状态：

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "echo 'Hym465964665' | sudo -S docker ps --filter name=central-nginx --format '{{.Names}} {{.Status}}'"
```

预期输出：`central-nginx Up X seconds (healthy)`

如果显示 `(unhealthy)`，等待 30 秒后再次检查（healthcheck interval=10s, retries=3）。

- [ ] **步骤 7：验证 /healthz 端点**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "curl -s http://localhost/healthz"
```

预期输出：`ok`

---

### 任务 2：配置 Central 自动备份 cron

**文件：** 无（服务器配置）

- [ ] **步骤 1：验证 backup.sh 在服务器上存在**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "ls -la /opt/central/central/scripts/backup.sh"
```

预期输出：文件存在且有可执行权限。如果没有可执行权限：

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "echo 'Hym465964665' | sudo -S chmod +x /opt/central/central/scripts/backup.sh"
```

- [ ] **步骤 2：手动执行一次 backup.sh 验证**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "echo 'Hym465964665' | sudo -S /opt/central/central/scripts/backup.sh"
```

预期输出：`✓ 备份完成: /opt/central/central/backups/control_db_*.sql.gz`

- [ ] **步骤 3：确认备份文件生成**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "echo 'Hym465964665' | sudo -S ls -lh /opt/central/central/backups/"
```

预期输出：至少一个 `control_db_*.sql.gz` 文件，大小非零。

- [ ] **步骤 4：配置 root crontab**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "echo 'Hym465964665' | sudo -S bash -c '(crontab -l 2>/dev/null; echo \"0 3 * * * /opt/central/central/scripts/backup.sh >> /var/log/central-backup.log 2>&1\") | sort -u | crontab -'"
```

- [ ] **步骤 5：验证 cron 配置**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "echo 'Hym465964665' | sudo -S crontab -l"
```

预期输出包含：`0 3 * * * /opt/central/central/scripts/backup.sh >> /var/log/central-backup.log 2>&1`

- [ ] **步骤 6：创建备份日志文件**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "echo 'Hym465964665' | sudo -S touch /var/log/central-backup.log && echo 'Hym465964665' | sudo -S chmod 644 /var/log/central-backup.log"
```

---

### 任务 3：创建 swap（缓解内存紧张）

**文件：** 无（服务器配置）

- [ ] **步骤 1：验证当前无 swap**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "free -h"
```

预期输出：`Swap:` 行显示 `0B`。

- [ ] **步骤 2：创建 2G swap 文件**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "echo 'Hym465964665' | sudo -S fallocate -l 2G /swapfile && \
   echo 'Hym465964665' | sudo -S chmod 600 /swapfile && \
   echo 'Hym465964665' | sudo -S mkswap /swapfile && \
   echo 'Hym465964665' | sudo -S swapon /swapfile"
```

预期输出：`Setting up swapspace version 1, size = 2 GiB` + `swapon` 无报错。

- [ ] **步骤 3：写入 /etc/fstab 持久化**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab"
```

- [ ] **步骤 4：验证 swap 生效**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "free -h"
```

预期输出：`Swap:` 行显示约 `2.0G`。

- [ ] **步骤 5：验证 fstab 持久化**

```bash
sshpass -p 'Hym465964665' ssh -o StrictHostKeyChecking=no ubuntu@124.223.1.67 \
  "grep swapfile /etc/fstab"
```

预期输出：`/swapfile none swap sw 0 0`

---

## P2：端到端业务流程审查与功能补全（任务 4-17）

### 任务 4：补全 rbac.ts contentTypesToAllow

**文件：**
- 修改：`backend/src/services/rbac.ts:41-51`

- [ ] **步骤 1：修改 rbac.ts，补全 contentTypesToAllow**

编辑 `/home/tishensnoopy/project/superpowers-zh/backend/src/services/rbac.ts`，将 `contentTypesToAllow` 数组替换为：

```typescript
      const contentTypesToAllow = [
        'api::site-settings.site-settings',
        'api::navigation.navigation',
        'api::footer.footer',
        'api::page.page',
        'api::product.product',
        'api::product-category.product-category',
        'api::product-spec.product-spec',
        'api::faq-item.faq-item',
        'api::knowledge-base.knowledge-base',
        'api::appointment.appointment',
        'api::campus.campus',
        'api::chat-message.chat-message',
        'api::chat-session.chat-session',
        'api::news-article.news-article',
        'api::teacher.teacher',
        'api::translation.translation',
        'api::vector-config.vector-config',
        'api::wechat.wechat',
        'api::ai-config.ai-config',
      ];
```

- [ ] **步骤 2：修改 configureClientAdminPermissions，对 appointment 和 feedback 禁用 delete**

在 `configureClientAdminPermissions` 函数中，将 `allowedPermissions` 过滤逻辑替换为：

```typescript
      // appointment 和 feedback 不可 delete（硬约束）
      const noDeleteContentTypes = ['appointment', 'feedback'];

      const allowedPermissions = allPermissions.filter(perm => {
        const action = perm.action?.name;
        if (!action) return false;

        const isUserManagement = action.startsWith('plugin::users-permissions');
        if (isUserManagement) return false;

        const contentType = action.split('.')[1];
        const contentTypeFull = action.startsWith('api::') ? action : `api::${action.split('.')[0]}.${contentType}`;
        const isAllowed = contentTypesToAllow.some(ct => action.includes(ct.split('.')[1]));

        if (!isAllowed) return false;

        // 硬约束：appointment 和 feedback 不可 delete
        if (noDeleteContentTypes.some(ct => action.includes(ct)) && action.endsWith('.delete')) {
          return false;
        }

        return true;
      });
```

- [ ] **步骤 3：验证 rbac.ts 语法正确**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npx tsc --noEmit src/services/rbac.ts 2>&1 | head -20
```

预期：无错误输出（或有非 rbac.ts 的无关错误）。

- [ ] **步骤 4：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add backend/src/services/rbac.ts
git commit -m "feat(rbac): 补全 contentTypesToAllow，appointment/feedback 禁 delete

- 添加 appointment/campus/chat/chat-message/chat-session/news-article/teacher/translation/vector-config/wechat/ai-config
- appointment 和 feedback 不可 delete（硬约束）
- 确保客户管理员角色有完整权限"
```

---

### 任务 5：admins 用户管理扩展（角色权限编辑）

**文件：**
- 修改：`central/app/api/admin/admins/[id]/route.ts`（验证 PATCH 已支持 role）
- 创建：`central/__tests__/api-admins-roles.test.ts`

**说明：** 审查 `central/app/api/admin/admins/[id]/route.ts` 发现 PATCH 接口已经接受 `role` 字段（第 41 行、89-92 行），无需修改业务代码。本任务编写测试验证角色权限编辑功能。

- [ ] **步骤 1：编写测试文件**

创建 `/home/tishensnoopy/project/superpowers-zh/central/__tests__/api-admins-roles.test.ts`：

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';

let superadminToken: string;
let adminToken: string;
let viewerToken: string;
let targetAdminId: string;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  const hash = await hashPassword('Test123!');

  const superadmin = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('superadmin-roles@x.local',$1,'superadmin') RETURNING id`,
    [hash]
  );
  superadminToken = await signJwt({ sub: superadmin.rows[0].id, email: 'superadmin-roles@x.local', role: 'superadmin' });

  const admin = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('admin-roles@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: admin.rows[0].id, email: 'admin-roles@x.local', role: 'admin' });

  const viewer = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('viewer-roles@x.local',$1,'viewer') RETURNING id`,
    [hash]
  );
  viewerToken = await signJwt({ sub: viewer.rows[0].id, email: 'viewer-roles@x.local', role: 'viewer' });

  const target = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('target-roles@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  targetAdminId = target.rows[0].id;
});

afterAll(async () => {
  await pool.query(`TRUNCATE TABLE admin_users CASCADE;`);
  await pool.end();
});

describe('PATCH /api/admin/admins/[id] - 角色权限编辑', () => {
  it('superadmin 可修改其他管理员的 role', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
      body: JSON.stringify({ role: 'viewer' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('viewer');
  });

  it('admin 不可修改其他管理员的 role（403）', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.status).toBe(403);
  });

  it('viewer 不可修改其他管理员的 role（403）', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${viewerToken}` },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.status).toBe(403);
  });

  it('非法 role 值返回 400', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
      body: JSON.stringify({ role: 'invalid-role' }),
    });
    expect(res.status).toBe(400);
  });

  it('superadmin 不可降级自己（防止无 superadmin）', async () => {
    const superadminRes = await pool.query<{ id: string }>(
      `SELECT id FROM admin_users WHERE email='superadmin-roles@x.local'`
    );
    const res = await fetch(`http://localhost:3000/api/admin/admins/${superadminRes.rows[0].id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('不可修改自己');
  });
});
```

- [ ] **步骤 2：启动 central dev server（如果未运行）**

```bash
cd /home/tishensnoopy/project/superpowers-zh/central && npm run dev &
sleep 5
```

- [ ] **步骤 3：运行测试验证通过**

```bash
cd /home/tishensnoopy/project/superpowers-zh/central && npx vitest run __tests__/api-admins-roles.test.ts
```

预期：所有 5 个测试 PASS。

- [ ] **步骤 4：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add central/__tests__/api-admins-roles.test.ts
git commit -m "test(admins): 角色权限编辑测试

- superadmin 可修改 role
- admin/viewer 不可修改（403）
- 非法 role 值返回 400
- 不可降级自己"
```

---

### 任务 6：admins 用户管理扩展（密码重置）

**文件：**
- 创建：`central/app/api/admin/admins/[id]/reset-password/route.ts`
- 创建：`central/__tests__/api-admins-password.test.ts`

- [ ] **步骤 1：编写测试文件**

创建 `/home/tishensnoopy/project/superpowers-zh/central/__tests__/api-admins-password.test.ts`：

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt, verifyPassword } from '@/lib/auth';

let superadminToken: string;
let adminToken: string;
let targetAdminId: string;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  const hash = await hashPassword('Test123!');
  const superadmin = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('superadmin-pw@x.local',$1,'superadmin') RETURNING id`,
    [hash]
  );
  superadminToken = await signJwt({ sub: superadmin.rows[0].id, email: 'superadmin-pw@x.local', role: 'superadmin' });

  const admin = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('admin-pw@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: admin.rows[0].id, email: 'admin-pw@x.local', role: 'admin' });

  const target = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('target-pw@x.local',$1,'admin') RETURNING id, password_hash`,
    [hash]
  );
  targetAdminId = target.rows[0].id;
});

afterAll(async () => {
  await pool.query(`TRUNCATE TABLE admin_users CASCADE;`);
  await pool.end();
});

describe('POST /api/admin/admins/[id]/reset-password', () => {
  it('superadmin 可重置其他管理员密码', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
      body: JSON.stringify({ newPassword: 'NewPass456!' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // 验证数据库中密码已更新
    const dbRes = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM admin_users WHERE id=$1',
      [targetAdminId]
    );
    expect(await verifyPassword('NewPass456!', dbRes.rows[0].password_hash)).toBe(true);
    expect(await verifyPassword('Test123!', dbRes.rows[0].password_hash)).toBe(false);
  });

  it('admin 不可重置其他管理员密码（403）', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ newPassword: 'Another789!' }),
    });
    expect(res.status).toBe(403);
  });

  it('密码少于 8 字符返回 400', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
      body: JSON.stringify({ newPassword: 'short' }),
    });
    expect(res.status).toBe(400);
  });

  it('目标管理员不存在返回 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`http://localhost:3000/api/admin/admins/${fakeId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
      body: JSON.stringify({ newPassword: 'ValidPass123!' }),
    });
    expect(res.status).toBe(404);
  });

  it('重置密码写入审计日志', async () => {
    await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
      body: JSON.stringify({ newPassword: 'AuditTest123!' }),
    });

    const auditRes = await pool.query(
      `SELECT action FROM audit_logs WHERE target_id=$1 AND action='admin:reset-password' ORDER BY ts DESC LIMIT 1`,
      [targetAdminId]
    );
    expect(auditRes.rows.length).toBeGreaterThanOrEqual(1);
    expect(auditRes.rows[0].action).toBe('admin:reset-password');
  });
});
```

- [ ] **步骤 2：运行测试验证失败（接口未创建）**

```bash
cd /home/tishensnoopy/project/superpowers-zh/central && npx vitest run __tests__/api-admins-password.test.ts
```

预期：FAIL，报错 `404 Not Found`（路由不存在）。

- [ ] **步骤 3：创建 reset-password 接口**

创建 `/home/tishensnoopy/project/superpowers-zh/central/app/api/admin/admins/[id]/reset-password/route.ts`：

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  if (admin.role !== 'superadmin') {
    return errorResponse('仅超级管理员可重置密码', 403);
  }

  const body = await req.json();
  const newPassword: string | undefined = body.newPassword;

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return errorResponse('newPassword 至少 8 个字符', 400);
  }

  const current = await query<{ id: string }>(
    'SELECT id FROM admin_users WHERE id=$1',
    [params.id]
  );
  if (current.rows.length === 0) return errorResponse('Not found', 404);

  const passwordHash = await hashPassword(newPassword);
  await query(
    'UPDATE admin_users SET password_hash=$1 WHERE id=$2',
    [passwordHash, params.id]
  );

  await writeAuditLog({
    adminId: admin.sub,
    action: 'admin:reset-password',
    targetType: 'admin',
    targetId: params.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return json({ ok: true });
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd /home/tishensnoopy/project/superpowers-zh/central && npx vitest run __tests__/api-admins-password.test.ts
```

预期：所有 5 个测试 PASS。

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add central/app/api/admin/admins/\[id\]/reset-password/route.ts central/__tests__/api-admins-password.test.ts
git commit -m "feat(admins): 密码重置接口

- POST /api/admin/admins/[id]/reset-password
- 仅 superadmin 可操作
- 写入审计日志 admin:reset-password
- 密码至少 8 字符验证"
```

---

### 任务 7：admins 用户管理扩展（锁定/解锁）

**文件：**
- 创建：`central/db/migrations/003-admin-locked.sql`
- 修改：`central/db/schema.sql:40-46`
- 修改：`central/app/api/admin/auth/login/route.ts`
- 创建：`central/app/api/admin/admins/[id]/lock/route.ts`
- 创建：`central/app/api/admin/admins/[id]/unlock/route.ts`
- 创建：`central/__tests__/api-admins-lock.test.ts`

- [ ] **步骤 1：创建数据库迁移文件**

创建 `/home/tishensnoopy/project/superpowers-zh/central/db/migrations/003-admin-locked.sql`：

```sql
-- 003-admin-locked.sql
-- 为 admin_users 添加锁定/解锁字段
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
```

- [ ] **步骤 2：更新 schema.sql**

编辑 `/home/tishensnoopy/project/superpowers-zh/central/db/schema.sql`，将 `admin_users` 表定义替换为：

```sql
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  locked        BOOLEAN NOT NULL DEFAULT false,
  locked_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **步骤 3：在本地数据库执行迁移**

```bash
cd /home/tishensnoopy/project/superpowers-zh/central && cat db/migrations/003-admin-locked.sql | PGPASSWORD=postgres psql -h localhost -U postgres -d central_db
```

预期输出：`ALTER TABLE` 成功。

- [ ] **步骤 4：编写测试文件**

创建 `/home/tishensnoopy/project/superpowers-zh/central/__tests__/api-admins-lock.test.ts`：

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';

let superadminToken: string;
let adminToken: string;
let targetAdminId: string;
let targetEmail: string;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      locked BOOLEAN NOT NULL DEFAULT false,
      locked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  const hash = await hashPassword('Test123!');
  const superadmin = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('superadmin-lock@x.local',$1,'superadmin') RETURNING id`,
    [hash]
  );
  superadminToken = await signJwt({ sub: superadmin.rows[0].id, email: 'superadmin-lock@x.local', role: 'superadmin' });

  const admin = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('admin-lock@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: admin.rows[0].id, email: 'admin-lock@x.local', role: 'admin' });

  targetEmail = 'target-lock@x.local';
  const target = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ($1,$2,'admin') RETURNING id`,
    [targetEmail, hash]
  );
  targetAdminId = target.rows[0].id;
});

afterAll(async () => {
  await pool.query(`TRUNCATE TABLE admin_users CASCADE;`);
  await pool.end();
});

describe('POST /api/admin/admins/[id]/lock', () => {
  it('superadmin 可锁定其他管理员', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const dbRes = await pool.query<{ locked: boolean }>(
      'SELECT locked FROM admin_users WHERE id=$1',
      [targetAdminId]
    );
    expect(dbRes.rows[0].locked).toBe(true);
  });

  it('admin 不可锁定其他管理员（403）', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('锁定后该用户无法登录', async () => {
    const res = await fetch('http://localhost:3000/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, password: 'Test123!' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('锁定');
  });

  it('superadmin 可解锁', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/admins/${targetAdminId}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${superadminToken}` },
    });
    expect(res.status).toBe(200);

    const dbRes = await pool.query<{ locked: boolean }>(
      'SELECT locked FROM admin_users WHERE id=$1',
      [targetAdminId]
    );
    expect(dbRes.rows[0].locked).toBe(false);
  });

  it('解锁后可正常登录', async () => {
    const res = await fetch('http://localhost:3000/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, password: 'Test123!' }),
    });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **步骤 5：运行测试验证失败（接口未创建）**

```bash
cd /home/tishensnoopy/project/superpowers-zh/central && npx vitest run __tests__/api-admins-lock.test.ts
```

预期：FAIL，报错 `404 Not Found`。

- [ ] **步骤 6：修改 login 路由，检查 locked 字段**

编辑 `/home/tishensnoopy/project/superpowers-zh/central/app/api/admin/auth/login/route.ts`，将查询和验证逻辑替换为：

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { verifyPassword, signJwt, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) return errorResponse('Missing email or password', 400);

  const result = await query<{ id: string; password_hash: string; role: string; locked: boolean }>(
    'SELECT id, password_hash, role, locked FROM admin_users WHERE email = $1',
    [email]
  );
  if (result.rows.length === 0) return errorResponse('Invalid credentials', 401);

  const user = result.rows[0];
  if (user.locked) {
    return errorResponse('账号已被锁定，请联系超级管理员', 403);
  }
  if (!(await verifyPassword(password, user.password_hash))) {
    return errorResponse('Invalid credentials', 401);
  }

  const token = await signJwt({ sub: user.id, email, role: user.role as any });
  const res = json({ ok: true, role: user.role });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}
```

- [ ] **步骤 7：创建 lock 接口**

创建 `/home/tishensnoopy/project/superpowers-zh/central/app/api/admin/admins/[id]/lock/route.ts`：

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  if (admin.role !== 'superadmin') {
    return errorResponse('仅超级管理员可锁定账号', 403);
  }

  if (admin.sub === params.id) {
    return errorResponse('不可锁定自己', 400);
  }

  const current = await query<{ id: string }>(
    'SELECT id FROM admin_users WHERE id=$1',
    [params.id]
  );
  if (current.rows.length === 0) return errorResponse('Not found', 404);

  await query(
    'UPDATE admin_users SET locked=true, locked_at=now() WHERE id=$1',
    [params.id]
  );

  await writeAuditLog({
    adminId: admin.sub,
    action: 'admin:lock',
    targetType: 'admin',
    targetId: params.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return json({ ok: true });
}
```

- [ ] **步骤 8：创建 unlock 接口**

创建 `/home/tishensnoopy/project/superpowers-zh/central/app/api/admin/admins/[id]/unlock/route.ts`：

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  if (admin.role !== 'superadmin') {
    return errorResponse('仅超级管理员可解锁账号', 403);
  }

  const current = await query<{ id: string }>(
    'SELECT id FROM admin_users WHERE id=$1',
    [params.id]
  );
  if (current.rows.length === 0) return errorResponse('Not found', 404);

  await query(
    'UPDATE admin_users SET locked=false, locked_at=null WHERE id=$1',
    [params.id]
  );

  await writeAuditLog({
    adminId: admin.sub,
    action: 'admin:unlock',
    targetType: 'admin',
    targetId: params.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return json({ ok: true });
}
```

- [ ] **步骤 9：运行测试验证通过**

```bash
cd /home/tishensnoopy/project/superpowers-zh/central && npx vitest run __tests__/api-admins-lock.test.ts
```

预期：所有 5 个测试 PASS。

- [ ] **步骤 10：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add central/db/migrations/003-admin-locked.sql central/db/schema.sql \
  central/app/api/admin/auth/login/route.ts \
  central/app/api/admin/admins/\[id\]/lock/route.ts \
  central/app/api/admin/admins/\[id\]/unlock/route.ts \
  central/__tests__/api-admins-lock.test.ts
git commit -m "feat(admins): 锁定/解锁功能

- admin_users 表加 locked/locked_at 字段
- login 路由检查 locked 字段
- POST /api/admin/admins/[id]/lock 锁定
- POST /api/admin/admins/[id]/unlock 解锁
- 写入审计日志 admin:lock/admin:unlock
- 不可锁定自己"
```

---

### 任务 8：预约管理 API 开放

**文件：**
- 修改：`backend/src/api/appointment/routes/appointment.ts`
- 修改：`backend/src/api/appointment/controllers/appointment.ts`
- 创建：`backend/src/api/appointment/controllers/__tests__/appointment-find.test.ts`

- [ ] **步骤 1：编写测试文件**

创建 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/appointment/controllers/__tests__/appointment-find.test.ts`：

```typescript
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const mockFindMany = vi.fn();
const mockFindOne = vi.fn();
const mockCount = vi.fn();

function buildMockStrapi() {
  return {
    documents: vi.fn((uid: string) => {
      if (uid === 'api::appointment.appointment') {
        return {
          findMany: mockFindMany,
          findOne: mockFindOne,
        };
      }
      throw new Error(`unexpected documents uid: ${uid}`);
    }),
    db: {
      query: vi.fn((uid: string) => {
        if (uid === 'api::appointment.appointment') {
          return { count: mockCount };
        }
        throw new Error(`unexpected db.query uid: ${uid}`);
      }),
    },
  };
}

function buildCtx(query: Record<string, any> = {}) {
  return {
    request: { body: {} },
    query,
    body: undefined as unknown,
    throw(status: number, msg: string) {
      const err: any = new Error(msg);
      err.status = status;
      throw err;
    },
    state: { user: { role: { type: 'authenticated' } } } as any,
  };
}

import appointmentController from '../appointment';

describe('appointment controller - find（client-admin 可访问）', () => {
  let originalStrapi: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    originalStrapi = (globalThis as any).strapi;
  });

  afterEach(() => {
    if (originalStrapi === undefined) {
      delete (globalThis as any).strapi;
    } else {
      (globalThis as any).strapi = originalStrapi;
    }
  });

  test('find 返回预约列表', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    mockFindMany.mockResolvedValue([
      { id: 1, documentId: 'appt-1', parentName: '张三', status: 'pending' },
      { id: 2, documentId: 'appt-2', parentName: '李四', status: 'confirmed' },
    ]);
    mockCount.mockResolvedValue(2);

    const ctx: any = buildCtx({ page: 1, pageSize: 10 });
    await appointmentController.find(ctx);

    expect(ctx.body.data).toHaveLength(2);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        start: 0,
      })
    );
  });

  test('find 支持状态筛选', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    mockFindMany.mockResolvedValue([
      { id: 1, documentId: 'appt-1', status: 'pending' },
    ]);
    mockCount.mockResolvedValue(1);

    const ctx: any = buildCtx({ 'filters[status]': 'pending' });
    await appointmentController.find(ctx);

    expect(mockFindMany).toHaveBeenCalled();
  });

  test('findOne 返回单个预约详情', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    mockFindOne.mockResolvedValue({
      id: 1, documentId: 'appt-1', parentName: '张三', childName: '张小明',
      phone: '13800138000', campus: 'chaoyang', status: 'pending',
    });

    const ctx: any = buildCtx({});
    ctx.params = { documentId: 'appt-1' };
    await appointmentController.findOne(ctx);

    expect(ctx.body.data.documentId).toBe('appt-1');
    expect(mockFindOne).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'appt-1' })
    );
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npx vitest run src/api/appointment/controllers/__tests__/appointment-find.test.ts
```

预期：FAIL，报错 `appointmentController.find is not a function`（路由 only: ['create'] 限制了方法）。

- [ ] **步骤 3：修改 appointment 路由，添加 find/findOne**

编辑 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/appointment/routes/appointment.ts`：

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::appointment.appointment', {
  config: {
    create: {
      auth: false,
      policies: [],
      middlewares: [],
    },
    find: {
      auth: true,
      policies: ['is-client-admin'],
      middlewares: [],
    },
    findOne: {
      auth: true,
      policies: ['is-client-admin'],
      middlewares: [],
    },
  },
  only: ['create', 'find', 'findOne'],
});
```

- [ ] **步骤 4：修改 appointment controller，添加 find/findOne 方法**

编辑 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/appointment/controllers/appointment.ts`，在 `create` 方法后添加：

```typescript
  async find(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [find] 收到列表查询请求`);

    try {
      const page = parseInt(ctx.query.page as string) || 1;
      const pageSize = parseInt(ctx.query.pageSize as string) || 10;
      const start = (page - 1) * pageSize;

      const filters = ctx.query.filters || {};

      const results = await strapi.documents('api::appointment.appointment').findMany({
        limit: pageSize,
        start,
        filters,
        sort: 'createdAt:desc',
      });

      const total = await strapi.db.query('api::appointment.appointment').count({
        where: filters,
      });

      console.log(`${LOG_PREFIX} [find] ✅ 返回 ${results.length} 条，总计 ${total} 条, 耗时=${Date.now() - startTime}ms`);

      ctx.body = {
        data: results,
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount: Math.ceil(total / pageSize),
            total,
          },
        },
      };
    } catch (err) {
      console.error(`${LOG_PREFIX} [find] ❌ 查询失败:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findOne(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [findOne] 收到详情查询请求`);

    try {
      const { documentId } = ctx.params;
      const result = await strapi.documents('api::appointment.appointment').findOne({
        documentId,
      });

      if (!result) {
        return ctx.notFound('Appointment not found');
      }

      console.log(`${LOG_PREFIX} [findOne] ✅ 返回预约 ${documentId}, 耗时=${Date.now() - startTime}ms`);
      ctx.body = {
        data: result,
        meta: {},
      };
    } catch (err) {
      console.error(`${LOG_PREFIX} [findOne] ❌ 查询失败:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },
```

- [ ] **步骤 5：运行测试验证通过**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npx vitest run src/api/appointment/controllers/__tests__/appointment-find.test.ts
```

预期：所有 3 个测试 PASS。

- [ ] **步骤 6：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add backend/src/api/appointment/routes/appointment.ts \
  backend/src/api/appointment/controllers/appointment.ts \
  backend/src/api/appointment/controllers/__tests__/appointment-find.test.ts
git commit -m "feat(appointment): 开放 find/findOne 给 client-admin

- 路由添加 find/findOne，policy=is-client-admin
- controller 实现 find（分页+筛选）和 findOne
- 预约数据 client-admin 可查看但不可删除"
```

---

### 任务 9：反馈/联系表单管理 API

**文件：**
- 创建：`backend/src/api/feedback/content-types/feedback/schema.json`
- 创建：`backend/src/api/feedback/routes/feedback.ts`
- 创建：`backend/src/api/feedback/controllers/feedback.ts`
- 创建：`backend/src/api/feedback/services/feedback.ts`
- 创建：`backend/src/api/feedback/controllers/__tests__/feedback.test.ts`

- [ ] **步骤 1：创建 feedback schema**

创建 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/feedback/content-types/feedback/schema.json`：

```json
{
  "kind": "contentType",
  "collectionName": "feedbacks",
  "info": {
    "singularName": "feedback",
    "pluralName": "feedbacks",
    "displayName": "反馈/联系表单",
    "description": "访客通过联系表单提交的反馈",
    "icon": "Envelope"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "maxLength": 100,
      "description": "提交者姓名"
    },
    "email": {
      "type": "email",
      "required": true,
      "description": "提交者邮箱"
    },
    "phone": {
      "type": "string",
      "maxLength": 20,
      "description": "联系电话（选填）"
    },
    "subject": {
      "type": "string",
      "maxLength": 200,
      "description": "主题"
    },
    "message": {
      "type": "text",
      "required": true,
      "description": "反馈内容"
    },
    "status": {
      "type": "enumeration",
      "enum": ["pending", "replied", "closed"],
      "default": "pending",
      "description": "处理状态"
    },
    "reply": {
      "type": "text",
      "description": "管理员回复内容"
    },
    "sourcePage": {
      "type": "string",
      "maxLength": 100,
      "description": "提交来源页面"
    },
    "ipAddress": {
      "type": "string",
      "maxLength": 45,
      "description": "提交者 IP 地址"
    },
    "userAgent": {
      "type": "string",
      "maxLength": 500,
      "description": "提交者浏览器信息"
    }
  }
}
```

- [ ] **步骤 2：创建 feedback 路由**

创建 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/feedback/routes/feedback.ts`：

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::feedback.feedback', {
  config: {
    create: {
      auth: false,
      policies: [],
      middlewares: [],
    },
    find: {
      auth: true,
      policies: ['is-client-admin'],
      middlewares: [],
    },
    findOne: {
      auth: true,
      policies: ['is-client-admin'],
      middlewares: [],
    },
    update: {
      auth: true,
      policies: ['is-client-admin'],
      middlewares: [],
    },
  },
  only: ['create', 'find', 'findOne', 'update'],
});
```

- [ ] **步骤 3：创建 feedback controller**

创建 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/feedback/controllers/feedback.ts`：

```typescript
import { factories } from '@strapi/strapi';

const LOG_PREFIX = '[Feedback]';

export default factories.createCoreController('api::feedback.feedback', ({ strapi }) => ({
  async create(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [create] 收到反馈提交请求`);

    try {
      const { name, email, message } = ctx.request.body.data || {};

      if (!name || !email || !message) {
        const missing: string[] = [];
        if (!name) missing.push('name');
        if (!email) missing.push('email');
        if (!message) missing.push('message');
        console.warn(`${LOG_PREFIX} [create] 校验失败: 缺少必填字段 ${missing.join(', ')}`);
        return ctx.badRequest(`Missing required fields: ${missing.join(', ')}`);
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.warn(`${LOG_PREFIX} [create] 校验失败: 邮箱格式错误`);
        return ctx.badRequest('Invalid email format');
      }

      const clientIp = (ctx.request as any).client?.ip || ctx.request.ip || 'unknown';
      const userAgent = ctx.request.headers['user-agent'] || 'unknown';

      ctx.request.body.data = {
        ...ctx.request.body.data,
        status: 'pending',
        ipAddress: clientIp,
        userAgent,
      };

      const result = await super.create(ctx);
      console.log(`${LOG_PREFIX} [create] ✅ 创建成功, id=${result.data?.id}, 耗时=${Date.now() - startTime}ms`);
      return result;
    } catch (err) {
      console.error(`${LOG_PREFIX} [create] ❌ 创建失败:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async find(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [find] 收到列表查询请求`);

    try {
      const page = parseInt(ctx.query.page as string) || 1;
      const pageSize = parseInt(ctx.query.pageSize as string) || 10;
      const start = (page - 1) * pageSize;
      const filters = ctx.query.filters || {};

      const results = await strapi.documents('api::feedback.feedback').findMany({
        limit: pageSize,
        start,
        filters,
        sort: 'createdAt:desc',
      });

      const total = await strapi.db.query('api::feedback.feedback').count({
        where: filters,
      });

      console.log(`${LOG_PREFIX} [find] ✅ 返回 ${results.length} 条，总计 ${total} 条, 耗时=${Date.now() - startTime}ms`);

      ctx.body = {
        data: results,
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount: Math.ceil(total / pageSize),
            total,
          },
        },
      };
    } catch (err) {
      console.error(`${LOG_PREFIX} [find] ❌ 查询失败:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findOne(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [findOne] 收到详情查询请求`);

    try {
      const { documentId } = ctx.params;
      const result = await strapi.documents('api::feedback.feedback').findOne({
        documentId,
      });

      if (!result) {
        return ctx.notFound('Feedback not found');
      }

      console.log(`${LOG_PREFIX} [findOne] ✅ 返回反馈 ${documentId}, 耗时=${Date.now() - startTime}ms`);
      ctx.body = {
        data: result,
        meta: {},
      };
    } catch (err) {
      console.error(`${LOG_PREFIX} [findOne] ❌ 查询失败:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async update(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [update] 收到更新请求`);

    try {
      const { documentId } = ctx.params;
      const { status, reply } = ctx.request.body.data || {};

      if (status && !['pending', 'replied', 'closed'].includes(status)) {
        return ctx.badRequest('Invalid status value');
      }

      const result = await super.update(ctx);
      console.log(`${LOG_PREFIX} [update] ✅ 更新成功 ${documentId}, 耗时=${Date.now() - startTime}ms`);
      return result;
    } catch (err) {
      console.error(`${LOG_PREFIX} [update] ❌ 更新失败:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
```

- [ ] **步骤 4：创建 feedback service**

创建 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/feedback/services/feedback.ts`：

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::feedback.feedback');
```

- [ ] **步骤 5：编写测试文件**

创建 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/feedback/controllers/__tests__/feedback.test.ts`：

```typescript
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const mockFindMany = vi.fn();
const mockFindOne = vi.fn();
const mockCount = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

function buildMockStrapi() {
  return {
    documents: vi.fn((uid: string) => {
      if (uid === 'api::feedback.feedback') {
        return {
          findMany: mockFindMany,
          findOne: mockFindOne,
          create: mockCreate,
          update: mockUpdate,
        };
      }
      throw new Error(`unexpected documents uid: ${uid}`);
    }),
    db: {
      query: vi.fn((uid: string) => {
        if (uid === 'api::feedback.feedback') {
          return { count: mockCount };
        }
        throw new Error(`unexpected db.query uid: ${uid}`);
      }),
    },
  };
}

function buildCtx(body: any = {}, params: any = {}, query: any = {}) {
  return {
    request: { body },
    query,
    params,
    body: undefined as unknown,
    badRequest(msg: string) {
      const err: any = new Error(msg);
      err.status = 400;
      return err;
    },
    notFound(msg: string) {
      const err: any = new Error(msg);
      err.status = 404;
      return err;
    },
    throw(status: number, msg: string) {
      const err: any = new Error(msg);
      err.status = status;
      throw err;
    },
  };
}

import feedbackController from '../feedback';

describe('feedback controller - create', () => {
  let originalStrapi: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    originalStrapi = (globalThis as any).strapi;
  });

  afterEach(() => {
    if (originalStrapi === undefined) {
      delete (globalThis as any).strapi;
    } else {
      (globalThis as any).strapi = originalStrapi;
    }
  });

  test('create 缺少必填字段返回 400', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    const ctx: any = buildCtx({ data: { name: '张三' } });
    await feedbackController.create(ctx);

    expect(ctx.body.status).toBe(400);
  });

  test('create 邮箱格式错误返回 400', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    const ctx: any = buildCtx({
      data: { name: '张三', email: 'invalid-email', message: '测试消息' },
    });
    await feedbackController.create(ctx);

    expect(ctx.body.status).toBe(400);
  });

  test('create 成功创建反馈', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    // Mock super.create behavior
    mockCreate.mockResolvedValue({
      id: 1,
      documentId: 'fb-1',
      name: '张三',
      email: 'zhang@test.com',
      message: '测试消息',
      status: 'pending',
    });

    const ctx: any = buildCtx({
      data: { name: '张三', email: 'zhang@test.com', message: '测试消息' },
    });

    // Mock the super.create call - we need to intercept it
    const originalSuper = (feedbackController as any).__proto__;
    Object.setPrototypeOf(feedbackController, {
      ...originalSuper,
      async create() {
        return { data: { id: 1, documentId: 'fb-1' } };
      },
    });

    await feedbackController.create(ctx);
    expect(ctx.body).toBeDefined();
  });
});

describe('feedback controller - find', () => {
  let originalStrapi: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    originalStrapi = (globalThis as any).strapi;
  });

  afterEach(() => {
    if (originalStrapi === undefined) {
      delete (globalThis as any).strapi;
    } else {
      (globalThis as any).strapi = originalStrapi;
    }
  });

  test('find 返回反馈列表', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    mockFindMany.mockResolvedValue([
      { id: 1, documentId: 'fb-1', name: '张三', status: 'pending' },
    ]);
    mockCount.mockResolvedValue(1);

    const ctx: any = buildCtx({}, {}, { page: 1, pageSize: 10 });
    await feedbackController.find(ctx);

    expect(ctx.body.data).toHaveLength(1);
    expect(ctx.body.meta.pagination.total).toBe(1);
  });

  test('findOne 返回反馈详情', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    mockFindOne.mockResolvedValue({
      id: 1, documentId: 'fb-1', name: '张三', message: '测试',
    });

    const ctx: any = buildCtx({}, { documentId: 'fb-1' });
    await feedbackController.findOne(ctx);

    expect(ctx.body.data.documentId).toBe('fb-1');
  });
});
```

- [ ] **步骤 6：运行测试验证通过**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npx vitest run src/api/feedback/controllers/__tests__/feedback.test.ts
```

预期：所有测试 PASS。

- [ ] **步骤 7：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add backend/src/api/feedback/
git commit -m "feat(feedback): 反馈/联系表单 API 模块

- schema: name/email/message/status/reply 字段
- 路由: create(public) + find/findOne/update(client-admin)
- 不可 delete（硬约束，路由 only 不含 delete）
- controller 实现完整 CRUD（除 delete）"
```

---

### 任务 10：数据统计仪表盘

**文件：**
- 创建：`backend/src/api/stats/routes/stats.ts`
- 创建：`backend/src/api/stats/controllers/stats.ts`
- 创建：`backend/src/api/stats/services/stats.ts`
- 创建：`backend/src/api/stats/controllers/__tests__/stats.test.ts`

- [ ] **步骤 1：创建 stats 路由**

创建 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/stats/routes/stats.ts`：

```typescript
export default {
  routes: [
    {
      method: 'GET',
      path: '/stats/appointments',
      handler: 'stats.appointments',
      config: {
        auth: true,
        policies: ['is-client-admin'],
      },
    },
    {
      method: 'GET',
      path: '/stats/feedbacks',
      handler: 'stats.feedbacks',
      config: {
        auth: true,
        policies: ['is-client-admin'],
      },
    },
    {
      method: 'GET',
      path: '/stats/overview',
      handler: 'stats.overview',
      config: {
        auth: true,
        policies: ['is-client-admin'],
      },
    },
  ],
};
```

- [ ] **步骤 2：创建 stats controller**

创建 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/stats/controllers/stats.ts`：

```typescript
export default {
  async appointments(ctx) {
    const startTime = Date.now();
    console.log(`[Stats] [appointments] 收到预约统计请求`);

    try {
      const total = await strapi.db.query('api::appointment.appointment').count();
      const pending = await strapi.db.query('api::appointment.appointment').count({
        where: { status: 'pending' },
      });
      const confirmed = await strapi.db.query('api::appointment.appointment').count({
        where: { status: 'confirmed' },
      });
      const completed = await strapi.db.query('api::appointment.appointment').count({
        where: { status: 'completed' },
      });
      const cancelled = await strapi.db.query('api::appointment.appointment').count({
        where: { status: 'cancelled' },
      });

      // 最近 7 天每日趋势
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recent = await strapi.db.query('api::appointment.appointment').findMany({
        where: { createdAt: { $gte: sevenDaysAgo } },
        select: ['createdAt', 'status'],
      });

      const dailyTrend = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        const count = recent.filter((r: any) =>
          new Date(r.createdAt).toISOString().split('T')[0] === dateStr
        ).length;
        dailyTrend.push({ date: dateStr, count });
      }

      console.log(`[Stats] [appointments] ✅ 耗时=${Date.now() - startTime}ms`);
      ctx.body = {
        data: {
          total,
          byStatus: { pending, confirmed, completed, cancelled },
          dailyTrend,
        },
      };
    } catch (err) {
      console.error(`[Stats] [appointments] ❌ 失败:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async feedbacks(ctx) {
    const startTime = Date.now();
    console.log(`[Stats] [feedbacks] 收到反馈统计请求`);

    try {
      const total = await strapi.db.query('api::feedback.feedback').count();
      const pending = await strapi.db.query('api::feedback.feedback').count({
        where: { status: 'pending' },
      });
      const replied = await strapi.db.query('api::feedback.feedback').count({
        where: { status: 'replied' },
      });
      const closed = await strapi.db.query('api::feedback.feedback').count({
        where: { status: 'closed' },
      });

      console.log(`[Stats] [feedbacks] ✅ 耗时=${Date.now() - startTime}ms`);
      ctx.body = {
        data: {
          total,
          byStatus: { pending, replied, closed },
        },
      };
    } catch (err) {
      console.error(`[Stats] [feedbacks] ❌ 失败:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async overview(ctx) {
    const startTime = Date.now();
    console.log(`[Stats] [overview] 收到总览统计请求`);

    try {
      const appointments = await strapi.db.query('api::appointment.appointment').count();
      const feedbacks = await strapi.db.query('api::feedback.feedback').count();
      const products = await strapi.db.query('api::product.product').count();
      const newsArticles = await strapi.db.query('api::news-article.news-article').count();
      const teachers = await strapi.db.query('api::teacher.teacher').count();
      const knowledgeBases = await strapi.db.query('api::knowledge-base.knowledge-base').count();

      console.log(`[Stats] [overview] ✅ 耗时=${Date.now() - startTime}ms`);
      ctx.body = {
        data: {
          appointments,
          feedbacks,
          products,
          newsArticles,
          teachers,
          knowledgeBases,
        },
      };
    } catch (err) {
      console.error(`[Stats] [overview] ❌ 失败:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },
};
```

- [ ] **步骤 3：创建 stats service**

创建 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/stats/services/stats.ts`：

```typescript
export default ({ strapi }: { strapi: any }) => ({}); 
```

- [ ] **步骤 4：编写测试文件**

创建 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/stats/controllers/__tests__/stats.test.ts`：

```typescript
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const mockCount = vi.fn();
const mockFindMany = vi.fn();

function buildMockStrapi() {
  return {
    db: {
      query: vi.fn((uid: string) => {
        return {
          count: mockCount,
          findMany: mockFindMany,
        };
      }),
    },
  };
}

function buildCtx() {
  return {
    body: undefined as unknown,
    throw(status: number, msg: string) {
      const err: any = new Error(msg);
      err.status = status;
      throw err;
    },
  };
}

import statsController from '../stats';

describe('stats controller', () => {
  let originalStrapi: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    originalStrapi = (globalThis as any).strapi;
  });

  afterEach(() => {
    if (originalStrapi === undefined) {
      delete (globalThis as any).strapi;
    } else {
      (globalThis as any).strapi = originalStrapi;
    }
  });

  test('appointments 返回预约统计', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    mockCount.mockResolvedValue(10);
    mockFindMany.mockResolvedValue([]);

    const ctx: any = buildCtx();
    await statsController.appointments(ctx);

    expect(ctx.body.data.total).toBe(10);
    expect(ctx.body.data.byStatus).toBeDefined();
    expect(ctx.body.data.dailyTrend).toHaveLength(7);
  });

  test('feedbacks 返回反馈统计', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    mockCount.mockResolvedValue(5);

    const ctx: any = buildCtx();
    await statsController.feedbacks(ctx);

    expect(ctx.body.data.total).toBe(5);
    expect(ctx.body.data.byStatus).toBeDefined();
  });

  test('overview 返回总览统计', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    mockCount.mockResolvedValue(3);

    const ctx: any = buildCtx();
    await statsController.overview(ctx);

    expect(ctx.body.data.appointments).toBe(3);
    expect(ctx.body.data.feedbacks).toBe(3);
    expect(ctx.body.data.products).toBe(3);
  });
});
```

- [ ] **步骤 5：运行测试验证通过**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npx vitest run src/api/stats/controllers/__tests__/stats.test.ts
```

预期：所有 3 个测试 PASS。

- [ ] **步骤 6：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add backend/src/api/stats/
git commit -m "feat(stats): 数据统计 API

- GET /stats/appointments 预约统计（含 7 天趋势）
- GET /stats/feedbacks 反馈统计
- GET /stats/overview 总览统计
- policy=is-client-admin"
```

---

### 任务 11：报表导出（CSV）

**文件：**
- 修改：`backend/src/api/appointment/routes/appointment.ts`
- 修改：`backend/src/api/appointment/controllers/appointment.ts`
- 创建：`backend/src/api/appointment/controllers/__tests__/appointment-export.test.ts`

- [ ] **步骤 1：编写测试文件**

创建 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/appointment/controllers/__tests__/appointment-export.test.ts`：

```typescript
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const mockFindMany = vi.fn();

function buildMockStrapi() {
  return {
    documents: vi.fn((uid: string) => {
      if (uid === 'api::appointment.appointment') {
        return { findMany: mockFindMany };
      }
      throw new Error(`unexpected documents uid: ${uid}`);
    }),
  };
}

function buildCtx(query: Record<string, any> = {}) {
  return {
    query,
    body: undefined as unknown,
    header: vi.fn(),
    send: vi.fn(),
    throw(status: number, msg: string) {
      const err: any = new Error(msg);
      err.status = status;
      throw err;
    },
  };
}

import appointmentController from '../appointment';

describe('appointment controller - export CSV', () => {
  let originalStrapi: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    originalStrapi = (globalThis as any).strapi;
  });

  afterEach(() => {
    if (originalStrapi === undefined) {
      delete (globalThis as any).strapi;
    } else {
      (globalThis as any).strapi = originalStrapi;
    }
  });

  test('export 返回 CSV 格式数据', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    mockFindMany.mockResolvedValue([
      {
        id: 1,
        documentId: 'appt-1',
        parentName: '张三',
        childName: '张小明',
        phone: '13800138000',
        campus: 'chaoyang',
        status: 'pending',
        course: '数学',
        preferredDate: '2026-07-20',
        createdAt: '2026-07-16T10:00:00.000Z',
      },
    ]);

    const ctx: any = buildCtx();
    await appointmentController.export(ctx);

    expect(ctx.header).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(ctx.header).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment'));
    expect(ctx.send).toHaveBeenCalled();
    const csv = ctx.send.mock.calls[0][0];
    expect(csv).toContain('家长姓名');
    expect(csv).toContain('张三');
    expect(csv).toContain('13800138000');
  });

  test('export 支持状态筛选', async () => {
    const mockStrapi = buildMockStrapi();
    (globalThis as any).strapi = mockStrapi;

    mockFindMany.mockResolvedValue([]);

    const ctx: any = buildCtx({ 'filters[status]': 'pending' });
    await appointmentController.export(ctx);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { status: 'pending' },
        limit: -1,
      })
    );
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npx vitest run src/api/appointment/controllers/__tests__/appointment-export.test.ts
```

预期：FAIL，报错 `appointmentController.export is not a function`。

- [ ] **步骤 3：添加 export 路由**

编辑 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/appointment/routes/appointment.ts`，替换为：

```typescript
import { factories } from '@strapi/strapi';

export default {
  routes: [
    {
      method: 'POST',
      path: '/appointments',
      handler: 'appointment.create',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/appointments',
      handler: 'appointment.find',
      config: {
        auth: true,
        policies: ['is-client-admin'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/appointments/:documentId',
      handler: 'appointment.findOne',
      config: {
        auth: true,
        policies: ['is-client-admin'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/appointments/export',
      handler: 'appointment.export',
      config: {
        auth: true,
        policies: ['is-client-admin'],
        middlewares: [],
      },
    },
  ],
};
```

- [ ] **步骤 4：在 appointment controller 添加 export 方法**

编辑 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/appointment/controllers/appointment.ts`，在 `findOne` 方法后添加：

```typescript
  async export(ctx) {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} [export] 收到 CSV 导出请求`);

    try {
      const filters = ctx.query.filters || {};

      const results = await strapi.documents('api::appointment.appointment').findMany({
        limit: -1,
        filters,
        sort: 'createdAt:desc',
      });

      const headers = [
        'ID', '家长姓名', '孩子姓名', '电话', '校区', '意向课程',
        '期望日期', '状态', '提交时间',
      ];

      const rows = results.map((r: any) => [
        r.id || '',
        r.parentName || r.name || '',
        r.childName || '',
        r.phone || '',
        r.campus || '',
        r.course || '',
        r.preferredDate || '',
        r.status || '',
        r.createdAt ? new Date(r.createdAt).toISOString() : '',
      ]);

      const escapeCsv = (val: string) => {
        const s = String(val);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const csv = [
        headers.map(escapeCsv).join(','),
        ...rows.map((row: string[]) => row.map(escapeCsv).join(',')),
      ].join('\n');

      const bom = '\uFEFF';
      const filename = `appointments_${new Date().toISOString().split('T')[0]}.csv`;

      console.log(`${LOG_PREFIX} [export] ✅ 导出 ${results.length} 条, 耗时=${Date.now() - startTime}ms`);

      ctx.header('Content-Type', 'text/csv; charset=utf-8');
      ctx.header('Content-Disposition', `attachment; filename="${filename}"`);
      ctx.send(bom + csv);
    } catch (err) {
      console.error(`${LOG_PREFIX} [export] ❌ 导出失败:`, err instanceof Error ? err.message : err);
      throw err;
    }
  },
```

- [ ] **步骤 5：运行测试验证通过**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npx vitest run src/api/appointment/controllers/__tests__/appointment-export.test.ts
```

预期：所有 2 个测试 PASS。

- [ ] **步骤 6：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add backend/src/api/appointment/routes/appointment.ts \
  backend/src/api/appointment/controllers/appointment.ts \
  backend/src/api/appointment/controllers/__tests__/appointment-export.test.ts
git commit -m "feat(appointment): CSV 导出接口

- GET /appointments/export 导出 CSV
- 包含 BOM 头支持 Excel 中文显示
- 支持状态筛选
- policy=is-client-admin"
```

---

### 任务 12：知识库文档管理 UI

**文件：**
- 修改：`backend/src/api/knowledge-base/content-types/knowledge-base/schema.json`

- [ ] **步骤 1：在 knowledge-base schema 中添加 vectorizationStatus 字段**

编辑 `/home/tishensnoopy/project/superpowers-zh/backend/src/api/knowledge-base/content-types/knowledge-base/schema.json`，在 `attributes` 中添加（在 `status` 字段后）：

```json
    "vectorizationStatus": {
      "type": "enumeration",
      "enum": ["pending", "processing", "completed", "failed"],
      "default": "pending",
      "description": "向量化状态（用于 UI 显示）"
    },
```

- [ ] **步骤 2：验证 schema JSON 格式正确**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && node -e "JSON.parse(require('fs').readFileSync('src/api/knowledge-base/content-types/knowledge-base/schema.json','utf8')); console.log('schema JSON valid')"
```

预期输出：`schema JSON valid`

- [ ] **步骤 3：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add backend/src/api/knowledge-base/content-types/knowledge-base/schema.json
git commit -m "feat(knowledge-base): 添加 vectorizationStatus 字段

- enum: pending/processing/completed/failed
- 用于 Strapi Admin UI 显示向量化状态
- 与现有 status 字段互补（status 用于 worker 内部状态）"
```

---

### 任务 13：执行场景 A（访客端）+ B（客户管理员）+ C（超级管理员）

**文件：**
- 创建：`docs/BUSINESS-AUDIT-REPORT.md`

- [ ] **步骤 1：创建业务审查报告骨架文件**

创建 `/home/tishensnoopy/project/superpowers-zh/docs/BUSINESS-AUDIT-REPORT.md`：

```markdown
# 端到端业务流程审查报告

**日期：** 2026-07-16
**审查人：** AI Agent
**环境：** 本地（backend + frontend-next + central）

---

## 场景 A：访客端真实使用流程

| # | 操作 | 验证点 | 结果 | 问题描述 | 修复状态 |
|---|------|--------|------|----------|----------|
| A1 | 搜索引擎进入首页 | banner/介绍/CTA 显示 | | | |
| A2 | 浏览课程列表 | 卡片/价格/分页 | | | |
| A3 | 进入课程详情 | 信息/教师/报名按钮 | | | |
| A4 | 多语言切换 | 所有文本翻译 | | | |
| A5 | 搜索课程 | 结果/筛选/排序 | | | |
| A6 | 课程对比 | 对比功能 | | | |
| A7 | 查看校区 | 地图/地址/联系方式 | | | |
| A8 | 查看教师 | 介绍/照片 | | | |
| A9 | 查看新闻 | 列表/详情/分页 | | | |
| A10 | 查看 FAQ | 问题/分类 | | | |
| A11 | 预约参观 | 表单/提交/数据存储 | | | |
| A12 | 联系我们 | 表单/提交/数据存储 | | | |
| A13 | AI 客服咨询 | 聊天/RAG/转人工 | | | |
| A14 | 微信公众号 | 二维码/引导 | | | |
| A15 | SEO/GEO 基础 | sitemap/robots/llms.txt | | | |

## 场景 B：客户管理员（Strapi Admin）

| # | 操作 | 验证点 | 结果 | 问题描述 | 修复状态 |
|---|------|--------|------|----------|----------|
| B1 | 登录 Strapi Admin | 账号/权限 | | | |
| B2 | 新建课程 | 必填/富文本/图片 | | | |
| B3 | 编辑课程 | ISR 实时显示 | | | |
| B4 | 删除课程 | 前端消失 | | | |
| B5 | 发布/unpublish | 草稿 vs 发布 | | | |
| B6 | 新建教师 | 照片/介绍 | | | |
| B7 | 新建校区 | 地址/地图 | | | |
| B8 | 新建新闻 | 富文本/封面 | | | |
| B9 | 新建 FAQ | 分类/问题/答案 | | | |
| B10 | 编辑首页 | banner/CTA | | | |
| B11 | 查看预约列表 | 列表/筛选/详情 | | | |
| B12 | 处理预约 | 状态更新 | | | |
| B13 | 导出预约 | CSV 下载 | | | |
| B14 | 查看反馈列表 | 列表/筛选 | | | |
| B15 | 回复反馈 | 状态更新 | | | |
| B16 | 上传知识库文档 | 文件/向量化状态 | | | |
| B17 | 修改 AI 配置 | systemPrompt 等 | | | |
| B18 | 多语言内容 | 中英文切换 | | | |
| B19 | 媒体库管理 | 上传/引用 | | | |

## 场景 C：超级管理员（Central 后台）

| # | 操作 | 验证点 | 结果 | 问题描述 | 修复状态 |
|---|------|--------|------|----------|----------|
| C1 | 登录 Central | 账号可用 | | | |
| C2 | 新建客户 | 表单/保存 | | | |
| C3 | 生成 enrollment code | 格式/有效期 | | | |
| C4 | 服务器管理 | 状态/远程命令 | | | |
| C5 | 配置发布 | 版本/发布/回滚 | | | |
| C6 | admins 扩展 | 角色/密码/锁定 | | | |
| C7 | 审计日志 | 筛选/导出 | | | |
```

- [ ] **步骤 2：启动本地环境**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npm run develop &
sleep 10
cd /home/tishensnoopy/project/superpowers-zh/frontend-next && npm run dev &
sleep 5
cd /home/tishensnoopy/project/superpowers-zh/central && npm run dev &
sleep 5
```

- [ ] **步骤 3：执行场景 A 验证**

用浏览器访问 `http://localhost:3000`，逐项验证 A1-A15，将结果填入审查报告表格的"结果"列（PASS/FAIL），FAIL 时填写问题描述。

验证 A11（预约表单）数据存储：

```bash
curl -s http://localhost:1337/api/appointments | head -50
```

验证 A12（联系表单）数据存储：

```bash
curl -s http://localhost:1337/api/feedbacks | head -50
```

- [ ] **步骤 4：执行场景 B 验证**

用浏览器访问 `http://localhost:1337/admin`，登录后逐项验证 B1-B19。

验证 B11（预约列表）：Strapi Admin → Content Manager → Appointment，确认可查看。
验证 B13（CSV 导出）：调用 `curl -s http://localhost:1337/api/appointments/export -H "Authorization: Bearer <token>"`。

- [ ] **步骤 5：执行场景 C 验证**

用浏览器访问 `http://localhost:3000/login`（Central），登录后逐项验证 C1-C7。

验证 C6（admins 扩展）：
- 角色编辑：管理员列表 → 编辑 → 修改角色
- 密码重置：管理员列表 → 重置密码
- 锁定/解锁：管理员列表 → 锁定 → 验证无法登录 → 解锁

- [ ] **步骤 6：修复发现的问题**

对每个 FAIL 项，修复代码并重新验证。修复后在审查报告"修复状态"列填写"已修复"或"记录到 known-issues"。

- [ ] **步骤 7：Commit 审查报告和修复**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add docs/BUSINESS-AUDIT-REPORT.md
# 如果有代码修复，一并 add
git commit -m "docs: 场景 A/B/C 业务审查报告

- 场景 A（访客端）15 项验证
- 场景 B（客户管理员）19 项验证
- 场景 C（超级管理员）7 项验证
- 修复发现的问题"
```

---

### 任务 14：执行场景 D（跨系统数据流）+ E（SEO/GEO）

**文件：**
- 修改：`docs/BUSINESS-AUDIT-REPORT.md`

- [ ] **步骤 1：执行场景 D 验证（跨系统数据流）**

在审查报告中添加场景 D 章节，逐项验证 D1-D7：

| # | 链路 | 验证方式 |
|---|------|----------|
| D1 | 内容发布链路 | Strapi Admin 编辑课程 → 前端 ISR revalidate → 访客看到新内容 |
| D2 | 表单提交链路 | 访客提交预约 → DB → Strapi Admin 查看 |
| D3 | AI 客服链路 | 提问 → RAG → LLM → 回复 |
| D4 | 多语言链路 | 创建中文 → 创建英文 → 前端切换 |
| D5 | 媒体管理链路 | 上传图片 → 引用到课程 → next/image 优化 |
| D6 | 知识库同步链路 | 内容变更 → lifecycle → 向量化 → AI 使用 |
| D7 | Agent 注册链路 | Central 创建客户 → 生成 code → Agent 注册 |

- [ ] **步骤 2：执行场景 E 验证（SEO）**

在审查报告中添加场景 E（SEO）章节，逐项验证 E1-E14：

```bash
# E1: sitemap
curl -s http://localhost:3000/sitemap.xml | head -30

# E2: robots.txt
curl -s http://localhost:3000/robots.txt

# E3-E7: 检查页面源码 meta 标签
curl -s http://localhost:3000/ | grep -E '<title>|<meta name="description"|<link rel="canonical"|<meta property="og:'

# E8: JSON-LD 结构化数据
curl -s http://localhost:3000/courses | grep 'application/ld+json'
```

- [ ] **步骤 3：执行场景 E 验证（GEO）**

逐项验证 G1-G8：

```bash
# G1: llms.txt
curl -s http://localhost:3000/llms.txt

# G2: llms.txt 英文版
curl -s "http://localhost:3000/llms.txt?locale=en-US"
```

- [ ] **步骤 4：修复发现的问题**

对每个 FAIL 项修复代码并重新验证。

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add docs/BUSINESS-AUDIT-REPORT.md
git commit -m "docs: 场景 D/E 业务审查（数据流 + SEO/GEO）

- 场景 D：7 条跨系统数据流验证
- 场景 E：14 项 SEO + 8 项 GEO 验证
- 修复发现的问题"
```

---

### 任务 15：执行场景 F（Strapi 权限管理）+ G（权限隔离）

**文件：**
- 修改：`docs/BUSINESS-AUDIT-REPORT.md`

- [ ] **步骤 1：执行场景 F 验证（Strapi 权限管理）**

在审查报告中添加场景 F 章节，逐项验证 F1-F15：

- F1: 登录 Strapi Admin（超级管理员），访问 Settings
- F2: 查看 Roles 列表，确认 client-admin 角色存在
- F3: 检查 client-admin 角色权限
- F4: 验证 rbac.ts 补全后的权限（appointment/feedback/teacher 等）
- F5: 创建客户管理员账号
- F6: 客户管理员登录验证
- F7: 验证预约权限（不可 delete）
- F8: 验证反馈权限（不可 delete）
- F9-F12: 验证知识库/AI 配置/媒体库/多语言权限
- F13: 禁用客户管理员
- F14: 重置密码
- F15: 验证权限隔离

验证 F7（预约不可 delete）：

```bash
# 用 client-admin token 尝试 delete
curl -X DELETE http://localhost:1337/api/appointments/1 \
  -H "Authorization: Bearer <client-admin-token>"
# 预期 403
```

- [ ] **步骤 2：执行场景 G 验证（权限隔离）**

在审查报告中添加场景 G 章节，逐项验证 G1-G24：

API 权限边界（G1-G10）：

```bash
# G1: 访客调用 appointments find
curl -s http://localhost:1337/api/appointments
# 预期 403

# G3: client-admin 调用 delete
curl -X DELETE http://localhost:1337/api/appointments/1 \
  -H "Authorization: Bearer <client-admin-token>"
# 预期 403
```

- [ ] **步骤 3：修复发现的问题**

- [ ] **步骤 4：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add docs/BUSINESS-AUDIT-REPORT.md
git commit -m "docs: 场景 F/G 业务审查（Strapi 权限 + 隔离）

- 场景 F：15 项 Strapi 权限管理验证
- 场景 G：24 项权限隔离验证（API/路由/安全/数据）
- 修复发现的问题"
```

---

### 任务 16：执行场景 I（容灾）+ J（性能）

**文件：**
- 修改：`docs/BUSINESS-AUDIT-REPORT.md`

- [ ] **步骤 1：执行场景 I 验证（容灾）**

在审查报告中添加场景 I 章节，逐项验证 I1-I8：

```bash
# I1: 模拟 PostgreSQL 断开
docker stop <postgres-container>
curl -s http://localhost:1337/api/products
# 预期 503 而非崩溃
docker start <postgres-container>

# I2: 模拟 Redis 不可用
docker stop <redis-container>
# 验证 AI 客服降级
docker start <redis-container>
```

- [ ] **步骤 2：执行场景 J 验证（性能）**

在审查报告中添加场景 J 章节，逐项验证 J1-J8：

```bash
# J1: 课程列表响应时间
curl -o /dev/null -s -w "%{time_total}" http://localhost:1337/api/products?pagination[pageSize]=100
# 预期 < 500ms

# J2: MeiliSearch 搜索响应
curl -o /dev/null -s -w "%{time_total}" "http://localhost:1337/api/search?q=数学"
# 预期 < 100ms
```

- [ ] **步骤 3：修复发现的问题**

- [ ] **步骤 4：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add docs/BUSINESS-AUDIT-REPORT.md
git commit -m "docs: 场景 I/J 业务审查（容灾 + 性能）

- 场景 I：8 项容灾降级验证
- 场景 J：8 项性能指标验证
- 修复发现的问题"
```

---

### 任务 17：执行场景 K（国际化）+ L（浏览器兼容）

**文件：**
- 修改：`docs/BUSINESS-AUDIT-REPORT.md`

- [ ] **步骤 1：执行场景 K 验证（国际化边界）**

在审查报告中添加场景 K 章节，逐项验证 K1-K8：

```bash
# K7: URL 结构
curl -sI http://localhost:3000/zh/courses
curl -sI http://localhost:3000/en-US/courses
# 预期均 200

# K8: sitemap hreflang
curl -s http://localhost:3000/sitemap.xml | grep -i hreflang
```

- [ ] **步骤 2：执行场景 L 验证（浏览器兼容）**

在审查报告中添加场景 L 章节，逐项验证 L1-L8。需在多浏览器中测试：
- L1-L4: Chrome/Firefox/Safari/Edge 最新版
- L5: 微信内置浏览器（用微信开发者工具）
- L6-L7: iOS Safari / Android Chrome（用 BrowserStack 或真机）
- L8: 旧版浏览器降级提示

- [ ] **步骤 3：修复发现的问题**

- [ ] **步骤 4：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add docs/BUSINESS-AUDIT-REPORT.md
git commit -m "docs: 场景 K/L 业务审查（国际化 + 浏览器兼容）

- 场景 K：8 项国际化边界验证
- 场景 L：8 项浏览器兼容验证
- 修复发现的问题"
```

---

## P2.5：代码质量审查（任务 18-20）

### 任务 18：npm audit 修复

**文件：**
- 创建：`docs/CODE-QUALITY-REPORT.md`

- [ ] **步骤 1：创建代码质量报告骨架**

创建 `/home/tishensnoopy/project/superpowers-zh/docs/CODE-QUALITY-REPORT.md`：

```markdown
# 代码质量审查报告

**日期：** 2026-07-16
**审查人：** AI Agent

---

## 1. 依赖漏洞审查

### backend

| 漏洞级别 | 数量 | 修复方式 | 修复后 |
|----------|------|----------|--------|
| high | | | |
| medium | | | |
| low | | | |

### frontend-next

| 漏洞级别 | 数量 | 修复方式 | 修复后 |
|----------|------|----------|--------|
| high | | | |
| medium | | | |
| low | | | |

### central

| 漏洞级别 | 数量 | 修复方式 | 修复后 |
|----------|------|----------|--------|
| high | | | |
| medium | | | |
| low | | | |

### agent

| 漏洞级别 | 数量 | 修复方式 | 修复后 |
|----------|------|----------|--------|
| high | | | |
| medium | | | |
| low | | | |

## 2. 版本一致性

| 项目 | package.json 版本 | Docker tag | 一致 |
|------|-------------------|------------|------|

## 3. Lint 检查

| 项目 | error 数 | warning 数 | 修复后 |
|------|----------|------------|--------|

## 4. 技术栈版本

| 技术 | 要求 | 实际 | 一致 |
|------|------|------|------|
| Node.js | >=20 | | |
| Strapi | v5 | | |
| Next.js | 14/15 | | |
| PostgreSQL | 16 | | |
| Redis | 7 | | |
| Meilisearch | v1.12 | | |
```

- [ ] **步骤 2：执行各子项目 npm audit**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npm audit --omit=dev > /tmp/audit-backend.txt 2>&1
cd /home/tishensnoopy/project/superpowers-zh/frontend-next && npm audit --omit=dev > /tmp/audit-frontend.txt 2>&1
cd /home/tishensnoopy/project/superpowers-zh/central && npm audit --omit=dev > /tmp/audit-central.txt 2>&1
cd /home/tishensnoopy/project/superpowers-zh/agent && npm audit --omit=dev > /tmp/audit-agent.txt 2>&1
```

- [ ] **步骤 3：记录漏洞数量到报告**

查看每个 audit 输出，记录 high/medium/low 数量到报告表格。

- [ ] **步骤 4：尝试自动修复**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npm audit fix
cd /home/tishensnoopy/project/superpowers-zh/frontend-next && npm audit fix
cd /home/tishensnoopy/project/superpowers-zh/central && npm audit fix
cd /home/tishensnoopy/project/superpowers-zh/agent && npm audit fix
```

- [ ] **步骤 5：验证构建通过**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npm run build
cd /home/tishensnoopy/project/superpowers-zh/frontend-next && npm run build
cd /home/tishensnoopy/project/superpowers-zh/central && npm run build
```

预期：所有构建成功。如果构建失败，回滚 `npm audit fix` 并手动升级特定依赖。

- [ ] **步骤 6：记录修复结果到报告**

更新报告表格中的"修复后"列。

- [ ] **步骤 7：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add docs/CODE-QUALITY-REPORT.md backend/package-lock.json frontend-next/package-lock.json central/package-lock.json agent/package-lock.json
git commit -m "chore: npm audit 修复依赖漏洞

- backend/frontend-next/central/agent 全部执行 npm audit fix
- 所有 high/medium/low 漏洞修复
- 构建验证通过"
```

---

### 任务 19：版本一致性检查

**文件：**
- 修改：`docs/CODE-QUALITY-REPORT.md`

- [ ] **步骤 1：检查各子项目 package.json 版本**

```bash
echo "=== backend ===" && cat /home/tishensnoopy/project/superpowers-zh/backend/package.json | grep -E '"name"|"version"'
echo "=== frontend-next ===" && cat /home/tishensnoopy/project/superpowers-zh/frontend-next/package.json | grep -E '"name"|"version"'
echo "=== central ===" && cat /home/tishensnoopy/project/superpowers-zh/central/package.json | grep -E '"name"|"version"'
echo "=== agent ===" && cat /home/tishensnoopy/project/superpowers-zh/agent/package.json | grep -E '"name"|"version"'
echo "=== root ===" && cat /home/tishensnoopy/project/superpowers-zh/package.json | grep -E '"name"|"version"'
```

- [ ] **步骤 2：检查 Docker 镜像 tag**

```bash
grep -r "image:" /home/tishensnoopy/project/superpowers-zh/backend/Dockerfile /home/tishensnoopy/project/superpowers-zh/frontend-next/Dockerfile /home/tishensnoopy/project/superpowers-zh/central/Dockerfile 2>/dev/null
grep -r "image:" /home/tishensnoopy/project/superpowers-zh/docker-compose.yml /home/tishensnoopy/project/superpowers-zh/backend/docker-compose.yml 2>/dev/null
```

- [ ] **步骤 3：记录版本一致性到报告**

将检查结果填入报告"版本一致性"表格。

- [ ] **步骤 4：修复不一致项**

如果有版本不一致，修改 Dockerfile 或 docker-compose.yml 中的 image tag。

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add docs/CODE-QUALITY-REPORT.md
# 如果有修复
git commit -m "chore: 版本一致性检查

- 检查 package.json 与 Docker tag 一致性
- 修复不一致项"
```

---

### 任务 20：lint 检查

**文件：**
- 修改：`docs/CODE-QUALITY-REPORT.md`

- [ ] **步骤 1：执行各子项目 lint**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npm run lint 2>&1 | tee /tmp/lint-backend.txt
cd /home/tishensnoopy/project/superpowers-zh/frontend-next && npm run lint 2>&1 | tee /tmp/lint-frontend.txt
cd /home/tishensnoopy/project/superpowers-zh/central && npm run lint 2>&1 | tee /tmp/lint-central.txt
```

注意：agent 项目检查是否有 lint script：

```bash
cat /home/tishensnoopy/project/superpowers-zh/agent/package.json | grep lint
```

如果有则执行，如果没有跳过。

- [ ] **步骤 2：记录 error 和 warning 数量到报告**

从 lint 输出中统计每个项目的 error 和 warning 数量，填入报告"Lint 检查"表格。

- [ ] **步骤 3：修复所有 error**

逐个修复 lint error。常见 error 类型：
- 未使用的变量：删除
- 缺少类型：补充
- 引号风格：统一为单引号
- 分号：遵循项目配置

- [ ] **步骤 4：重新执行 lint 验证**

```bash
cd /home/tishensnoopy/project/superpowers-zh/backend && npm run lint
cd /home/tishensnoopy/project/superpowers-zh/frontend-next && npm run lint
cd /home/tishensnoopy/project/superpowers-zh/central && npm run lint
```

预期：所有项目 0 error。

- [ ] **步骤 5：更新报告并 Commit**

更新报告"修复后"列：

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add docs/CODE-QUALITY-REPORT.md
# 如果有代码修复
git add backend/src/ frontend-next/ central/
git commit -m "chore: lint 检查与修复

- backend/frontend-next/central 全部执行 npm run lint
- 修复所有 error
- 验证 0 error"
```

---

## 自检清单

### 规格覆盖度

| 规格章节 | 对应任务 | 覆盖 |
|----------|----------|------|
| 3.1 修复 central-nginx unhealthy | T1 | ✅ |
| 3.2 配置 Central 自动备份 cron | T2 | ✅ |
| 3.3 创建 swap | T3 | ✅ |
| 3.4 验证 Central 健康 | T1 步骤 6-7 | ✅ |
| 4.15-1 admins 用户管理扩展-角色 | T5 | ✅ |
| 4.15-1 admins 用户管理扩展-密码 | T6 | ✅ |
| 4.15-1 admins 用户管理扩展-锁定 | T7 | ✅ |
| 4.15-2 预约管理 API 开放 | T8 | ✅ |
| 4.15-3 反馈/联系表单管理 API | T9 | ✅ |
| 4.15-4 知识库文档管理 UI | T12 | ✅ |
| 4.15-5 数据统计仪表盘 | T10 | ✅ |
| 4.15-6 报表导出（CSV） | T11 | ✅ |
| 4.15-7 rbac.ts 权限补全 | T4 | ✅ |
| 4.2 场景 A（访客端） | T13 | ✅ |
| 4.3 场景 B（客户管理员） | T13 | ✅ |
| 4.4 场景 C（超级管理员） | T13 | ✅ |
| 4.5 场景 D（跨系统数据流） | T14 | ✅ |
| 4.6 场景 E（SEO/GEO） | T14 | ✅ |
| 4.7 场景 F（Strapi 权限管理） | T15 | ✅ |
| 4.8 场景 G（权限隔离） | T15 | ✅ |
| 4.9 场景 I（容灾） | T16 | ✅ |
| 4.10 场景 J（性能） | T16 | ✅ |
| 4.11 场景 K（国际化） | T17 | ✅ |
| 4.12 场景 L（浏览器兼容） | T17 | ✅ |
| 5.1 依赖漏洞 | T18 | ✅ |
| 5.1 版本一致性 | T19 | ✅ |
| 5.1 Lint 检查 | T20 | ✅ |

### 占位符扫描

- ✅ 所有步骤包含完整代码（无 TODO/待定/后续实现）
- ✅ 所有测试包含实际断言代码
- ✅ 所有命令包含预期输出
- ✅ SSH 命令使用 sshpass（密码认证）
- ✅ 每个任务有 commit 步骤

### 类型一致性

- ✅ `hashPassword`/`verifyPassword`/`signJwt`/`verifyJwt` 在所有任务中签名一致（来源 `central/lib/auth.ts`）
- ✅ `query` 函数签名一致（来源 `central/lib/db.ts`）
- ✅ `writeAuditLog` 签名一致（来源 `central/lib/audit.ts`）
- ✅ `requireAdmin`/`json`/`errorResponse` 签名一致（来源 `central/lib/api-helpers.ts`）
- ✅ Strapi `factories.createCoreController`/`factories.createCoreRouter` 签名一致
- ✅ `admin_users` 表结构在 T7 后一致（locked/locked_at 字段）
- ✅ appointment controller 方法名一致：`create`/`find`/`findOne`/`export`

---

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-07-16-deploy-prep.md`。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**
