# M1：中央基础 + 管理 UI 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 搭建中央管理后台基础设施，使维护者能登录、CRUD 客户/服务器/配置，并为每台客户服务器颁发一次性 enrollment code。

**架构：** Next.js App Router（custom server 暂不引入，M2 再加 WebSocket）+ PostgreSQL（独立 `control_db`）+ shadcn/ui。敏感字段（AI 密钥等）用 AES-256-GCM 加密存储；管理员认证用 JWT cookie + bcrypt。

**技术栈：** Next.js 14、TypeScript、`pg`（连接池）、`bcryptjs`、`jose`（JWT）、shadcn/ui、Tailwind CSS、Vitest、Playwright。

**关联规格：** [2026-07-15-multi-tenant-central-control.md](../specs/2026-07-15-multi-tenant-central-control.md) 第 5、6.1、9、12.1 节

---

## 文件结构

```
central/
├── db/
│   ├── schema.sql                # 建表 SQL
│   ├── migrate.ts                # 幂等迁移入口
│   └── seed.ts                   # 初始超级管理员
├── lib/
│   ├── db.ts                     # pg 连接池封装
│   ├── encryption.ts             # AES-256-GCM
│   ├── auth.ts                   # JWT + bcrypt
│   └── api-helpers.ts            # 统一响应/错误处理
├── middleware.ts                 # 路由守卫
├── app/
│   ├── (auth)/login/page.tsx     # 登录页
│   ├── (auth)/login/route.ts     # 登录 API（实际在 app/api/admin/auth）
│   ├── (dashboard)/layout.tsx    # 管理后台 shell
│   ├── (dashboard)/customers/
│   │   ├── page.tsx              # 列表
│   │   ├── new/page.tsx          # 创建
│   │   └── [id]/page.tsx         # 详情
│   ├── (dashboard)/servers/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── (dashboard)/configs/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   └── api/admin/
│       ├── auth/login/route.ts
│       ├── auth/logout/route.ts
│       ├── customers/route.ts
│       ├── customers/[id]/route.ts
│       ├── servers/route.ts
│       ├── servers/[id]/route.ts
│       ├── configs/route.ts
│       ├── configs/[id]/route.ts
│       ├── enrollment-codes/route.ts
│       └── enrollment-codes/[id]/revoke/route.ts
├── __tests__/
│   ├── encryption.test.ts
│   ├── auth.test.ts
│   ├── api-customers.test.ts
│   ├── api-servers.test.ts
│   ├── api-configs.test.ts
│   └── api-enrollment.test.ts
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── next.config.ts
```

---

## 任务 1：项目脚手架 + 数据库 schema

**文件：**
- 创建：`central/package.json`、`central/tsconfig.json`、`central/next.config.ts`、`central/vitest.config.ts`
- 创建：`central/db/schema.sql`
- 创建：`central/.env.example`

- [ ] **步骤 1：初始化 Next.js 项目结构**

```bash
cd /home/tishensnoopy/project/superpowers-zh
mkdir -p central/db central/lib central/app central/__tests__
cd central
npm init -y
npm install next@14 react react-dom typescript @types/node @types/react @types/react-dom
npm install pg @types/pg bcryptjs @types/bcryptjs jose
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

`central/package.json` 的 `scripts`：
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "tsx db/migrate.ts",
    "db:seed": "tsx db/seed.ts"
  }
}
```

- [ ] **步骤 2：写 `central/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **步骤 3：写 `central/db/schema.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  contact_name  TEXT,
  contact_phone TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_servers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  hostname       TEXT NOT NULL,
  display_name   TEXT,
  agent_version  TEXT,
  last_heartbeat TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'offline',
  meta           JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, hostname)
);
CREATE INDEX IF NOT EXISTS idx_servers_customer ON customer_servers(customer_id);

CREATE TABLE IF NOT EXISTS customer_configs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  version       INT NOT NULL,
  brand         JSONB DEFAULT '{}',
  ai            JSONB DEFAULT '{}',
  deployment    JSONB DEFAULT '{}',
  env_overrides JSONB DEFAULT '{}',
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, version)
);
CREATE INDEX IF NOT EXISTS idx_configs_customer_version
  ON customer_configs(customer_id, version DESC);

CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_tokens (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id    UUID NOT NULL REFERENCES customer_servers(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  issued_at    TIMESTAMPTZ DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON agent_tokens(token_hash);

CREATE TABLE IF NOT EXISTS enrollment_codes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  code        TEXT UNIQUE NOT NULL,
  issued_at   TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  failed_attempts INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS deploy_jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id     UUID NOT NULL REFERENCES customer_servers(id) ON DELETE CASCADE,
  config_id     UUID REFERENCES customer_configs(id),
  type          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued',
  triggered_by  UUID REFERENCES admin_users(id),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  exit_code     INT,
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_server_created
  ON deploy_jobs(server_id, created_at DESC);

CREATE TABLE IF NOT EXISTS job_logs (
  id          BIGSERIAL PRIMARY KEY,
  job_id      UUID NOT NULL REFERENCES deploy_jobs(id) ON DELETE CASCADE,
  ts          TIMESTAMPTZ DEFAULT now(),
  stream      TEXT,
  line        TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_job_ts ON job_logs(job_id, ts);
```

- [ ] **步骤 4：写 `central/.env.example`**

```bash
DATABASE_URL=postgres://central:changeme@localhost:5432/control_db
JWT_SECRET=change-me-to-32-byte-random-string
AES_KEY=change-me-to-32-byte-base64-key
NEXTAUTH_URL=http://localhost:3000
```

- [ ] **步骤 5：写 `central/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', globals: true },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] **步骤 6：Commit**

```bash
git add central/package.json central/tsconfig.json central/next.config.ts \
        central/vitest.config.ts central/db/schema.sql central/.env.example
git commit -m "feat(central): scaffold project + DB schema (M1-1)"
```

---

## 任务 2：DB 连接池 + 加密工具（TDD）

**文件：**
- 创建：`central/lib/db.ts`
- 创建：`central/lib/encryption.ts`
- 测试：`central/__tests__/encryption.test.ts`

- [ ] **步骤 1：写失败的加密测试**

`central/__tests__/encryption.test.ts`：
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt } from '@/lib/encryption';

describe('encryption', () => {
  beforeEach(() => {
    process.env.AES_KEY = Buffer.alloc(32, 1).toString('base64');
  });

  it('encrypts and decrypts roundtrip', () => {
    const plain = 'sk-dashscope-abc123';
    const cipher = encrypt(plain);
    expect(cipher).not.toBe(plain);
    expect(cipher).toMatch(/^enc:/);
    expect(decrypt(cipher)).toBe(plain);
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const a = encrypt('same');
    const b = encrypt('same');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same');
    expect(decrypt(b)).toBe('same');
  });

  it('throws on tampered ciphertext', () => {
    const cipher = encrypt('secret');
    const tampered = cipher.slice(0, -4) + 'XXXX';
    expect(() => decrypt(tampered)).toThrow();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd central && npx vitest run __tests__/encryption.test.ts
```
预期：FAIL，报错 `Cannot find module '@/lib/encryption'`

- [ ] **步骤 3：写 `central/lib/encryption.ts`**

```typescript
import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey(): Buffer {
  const raw = process.env.AES_KEY;
  if (!raw) throw new Error('AES_KEY env var is required');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('AES_KEY must decode to 32 bytes');
  return buf;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:' + Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(packed: string): string {
  if (!packed.startsWith('enc:')) throw new Error('not an encrypted payload');
  const buf = Buffer.from(packed.slice(4), 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const enc = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith('enc:');
}
```

- [ ] **步骤 4：写 `central/lib/db.ts`**

```typescript
import { Pool, QueryResult, QueryResultRow } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as any[]);
}

export async function withTransaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function endPool(): Promise<void> {
  await pool.end();
}
```

- [ ] **步骤 5：运行测试验证通过**

```bash
cd central && npx vitest run __tests__/encryption.test.ts
```
预期：PASS 3 tests

- [ ] **步骤 6：Commit**

```bash
git add central/lib/encryption.ts central/lib/db.ts central/__tests__/encryption.test.ts
git commit -m "feat(central): add AES-256-GCM encryption + pg pool (M1-2)"
```

---

## 任务 3：管理员认证（JWT + bcrypt，TDD）

**文件：**
- 创建：`central/lib/auth.ts`
- 创建：`central/lib/api-helpers.ts`
- 测试：`central/__tests__/auth.test.ts`

- [ ] **步骤 1：写失败的认证测试**

`central/__tests__/auth.test.ts`：
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword, verifyPassword, signJwt, verifyJwt } from '@/lib/auth';

describe('auth', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-32-bytes-xxxxxxxxxxxxx';
  });

  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('Admin123!');
    expect(hash).not.toBe('Admin123!');
    expect(await verifyPassword('Admin123!', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('signs and verifies JWT', async () => {
    const token = await signJwt({ sub: 'user-1', email: 'a@b.c', role: 'admin' });
    const payload = await verifyJwt(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('a@b.c');
    expect(payload.role).toBe('admin');
  });

  it('rejects tampered JWT', async () => {
    const token = await signJwt({ sub: 'user-1', email: 'a@b.c', role: 'admin' });
    const tampered = token.slice(0, -4) + 'XXXX';
    await expect(verifyJwt(tampered)).rejects.toThrow();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd central && npx vitest run __tests__/auth.test.ts
```
预期：FAIL，报错 `Cannot find module '@/lib/auth'`

- [ ] **步骤 3：写 `central/lib/auth.ts`**

```typescript
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const BCRYPT_COST = 12;
const JWT_ALG = 'HS256';

function getJwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET env var is required');
  return new TextEncoder().encode(s);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: 'superadmin' | 'admin' | 'viewer';
}

export async function signJwt(payload: AdminJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());
}

export async function verifyJwt(token: string): Promise<AdminJwtPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return {
    sub: payload.sub as string,
    email: payload.email as string,
    role: payload.role as AdminJwtPayload['role'],
  };
}

export const COOKIE_NAME = 'central_admin_session';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
```

- [ ] **步骤 4：写 `central/lib/api-helpers.ts`**

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME, AdminJwtPayload } from './auth';

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAdmin(): Promise<AdminJwtPayload | NextResponse> {
  const store = cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return errorResponse('Unauthorized', 401);
  try {
    return await verifyJwt(token);
  } catch {
    return errorResponse('Invalid session', 401);
  }
}
```

- [ ] **步骤 5：运行测试验证通过**

```bash
cd central && npx vitest run __tests__/auth.test.ts
```
预期：PASS 3 tests

- [ ] **步骤 6：Commit**

```bash
git add central/lib/auth.ts central/lib/api-helpers.ts central/__tests__/auth.test.ts
git commit -m "feat(central): add JWT + bcrypt auth (M1-3)"
```

---

## 任务 4：登录 + 登出 API

**文件：**
- 创建：`central/app/api/admin/auth/login/route.ts`
- 创建：`central/app/api/admin/auth/logout/route.ts`
- 创建：`central/db/migrate.ts`
- 创建：`central/db/seed.ts`

- [ ] **步骤 1：写 `central/db/migrate.ts`**

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '@/lib/db';

async function migrate() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('[migrate] schema applied');
  } finally {
    client.release();
  }
  await pool.end();
}

migrate().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
```

- [ ] **步骤 2：写 `central/db/seed.ts`**

```typescript
import { pool } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@yousen.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const hash = await hashPassword(password);
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, role)
     VALUES ($1, $2, 'superadmin')
     ON CONFLICT (email) DO NOTHING`,
    [email, hash]
  );
  console.log(`[seed] superadmin ensured: ${email}`);
  await pool.end();
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
```

- [ ] **步骤 3：写 `central/app/api/admin/auth/login/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { verifyPassword, signJwt, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) return errorResponse('Missing email or password', 400);

  const result = await query<{ id: string; password_hash: string; role: string }>(
    'SELECT id, password_hash, role FROM admin_users WHERE email = $1',
    [email]
  );
  if (result.rows.length === 0) return errorResponse('Invalid credentials', 401);

  const user = result.rows[0];
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

- [ ] **步骤 4：写 `central/app/api/admin/auth/logout/route.ts`**

```typescript
import { json } from '@/lib/api-helpers';
import { COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const res = json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return res;
}
```

- [ ] **步骤 5：手动冒烟测试（启动 DB 后）**

```bash
# 启动一个临时 postgres
docker run -d --name central-pg -p 5433:5432 \
  -e POSTGRES_DB=control_db -e POSTGRES_USER=central \
  -e POSTGRES_PASSWORD=changeme postgres:16-alpine

# 在 central/.env 设 DATABASE_URL=postgres://central:changeme@localhost:5433/control_db
cd central && npx tsx db/migrate.ts && npx tsx db/seed.ts
# 启动 dev server，curl 测试登录
npm run dev &
curl -i -X POST http://localhost:3000/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@yousen.local","password":"ChangeMe123!"}'
# 预期：200 + Set-Cookie: central_admin_session=...
```

- [ ] **步骤 6：Commit**

```bash
git add central/db/migrate.ts central/db/seed.ts \
        central/app/api/admin/auth/login/route.ts \
        central/app/api/admin/auth/logout/route.ts
git commit -m "feat(central): add login/logout API + migrate/seed scripts (M1-4)"
```

---

## 任务 5：路由守卫 middleware

**文件：**
- 创建：`central/middleware.ts`

- [ ] **步骤 1：写 `central/middleware.ts`**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { COOKIE_NAME } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/admin/auth/login'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/_next/') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return redirectToLogin(req);

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return redirectToLogin(req);
  }
}

function redirectToLogin(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **步骤 2：手动验证**

```bash
cd central && npm run dev &
curl -i http://localhost:3000/customers
# 预期：302 重定向到 /login
curl -i http://localhost:3000/api/admin/customers
# 预期：401 Unauthorized
```

- [ ] **步骤 3：Commit**

```bash
git add central/middleware.ts
git commit -m "feat(central): add route guard middleware (M1-5)"
```

---

## 任务 6：客户 CRUD API（TDD）

**文件：**
- 创建：`central/app/api/admin/customers/route.ts`
- 创建：`central/app/api/admin/customers/[id]/route.ts`
- 测试：`central/__tests__/api-customers.test.ts`

- [ ] **步骤 1：写失败的客户 API 测试**

`central/__tests__/api-customers.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';

let adminToken: string;
let testCustomerId: string;

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL, contact_name TEXT, contact_phone TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  const hash = await hashPassword('Test123!');
  const r = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('test@x.local',$1,'superadmin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: r.rows[0].id, email: 'test@x.local', role: 'superadmin' });
});

afterAll(async () => {
  await pool.query(`DELETE FROM customers; DELETE FROM admin_users;`);
  await pool.end();
});

describe('POST /api/admin/customers', () => {
  it('creates a customer', async () => {
    const res = await fetch('http://localhost:3000/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ name: '客户A', contactName: '张三', contactPhone: '13800138000' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^[0-9a-f-]+$/);
    expect(body.name).toBe('客户A');
    testCustomerId = body.id;
  });
});
```

注意：以上测试需要 dev server 已启动 + DB 已迁移 + admin 已 seed。

- [ ] **步骤 2：运行测试验证失败**

```bash
cd central && npx vitest run __tests__/api-customers.test.ts
```
预期：FAIL（404，路由不存在）

- [ ] **步骤 3：写 `central/app/api/admin/customers/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(
    'SELECT id, name, contact_name, contact_phone, created_at FROM customers ORDER BY created_at DESC'
  );
  return json({ items: result.rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { name, contactName, contactPhone } = await req.json();
  if (!name || typeof name !== 'string') return errorResponse('name is required', 400);

  const result = await query<{ id: string }>(
    `INSERT INTO customers (name, contact_name, contact_phone) VALUES ($1,$2,$3)
     RETURNING id, name, contact_name, contact_phone, created_at`,
    [name, contactName ?? null, contactPhone ?? null]
  );
  return json(result.rows[0], 201);
}
```

- [ ] **步骤 4：写 `central/app/api/admin/customers/[id]/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(
    'SELECT id, name, contact_name, contact_phone, created_at FROM customers WHERE id=$1',
    [params.id]
  );
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  return json(result.rows[0]);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { name, contactName, contactPhone } = await req.json();
  const result = await query(
    `UPDATE customers SET name=COALESCE($1,name), contact_name=COALESCE($2,contact_name),
       contact_phone=COALESCE($3,contact_phone)
     WHERE id=$4 RETURNING id, name, contact_name, contact_phone, created_at`,
    [name ?? null, contactName ?? null, contactPhone ?? null, params.id]
  );
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  return json(result.rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query('DELETE FROM customers WHERE id=$1 RETURNING id', [params.id]);
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  return json({ ok: true });
}
```

- [ ] **步骤 5：运行测试验证通过**

```bash
cd central && npx vitest run __tests__/api-customers.test.ts
```
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add central/app/api/admin/customers/ central/__tests__/api-customers.test.ts
git commit -m "feat(central): add customer CRUD API (M1-6)"
```

---

## 任务 7：服务器 CRUD API

**文件：**
- 创建：`central/app/api/admin/servers/route.ts`
- 创建：`central/app/api/admin/servers/[id]/route.ts`
- 测试：`central/__tests__/api-servers.test.ts`

- [ ] **步骤 1：写失败的服务器 API 测试**

`central/__tests__/api-servers.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';

let adminToken: string;
let customerId: string;
let serverId: string;

beforeAll(async () => {
  const hash = await hashPassword('Test123!');
  const u = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('srv@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: u.rows[0].id, email: 'srv@x.local', role: 'admin' });
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Srv测试') RETURNING id`);
  customerId = c.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM customer_servers; DELETE FROM customers; DELETE FROM admin_users;`);
  await pool.end();
});

describe('POST /api/admin/servers', () => {
  it('creates a server under a customer', async () => {
    const res = await fetch('http://localhost:3000/api/admin/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ customerId, hostname: 'prod-1', displayName: '生产服务器1' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.hostname).toBe('prod-1');
    expect(body.status).toBe('offline');
    serverId = body.id;
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd central && npx vitest run __tests__/api-servers.test.ts
```
预期：FAIL（404）

- [ ] **步骤 3：写 `central/app/api/admin/servers/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const customerId = req.nextUrl.searchParams.get('customerId');
  const params = customerId ? [customerId] : [];
  const result = await query(
    `SELECT id, customer_id, hostname, display_name, status, last_heartbeat, agent_version, meta, created_at
     FROM customer_servers ${customerId ? 'WHERE customer_id=$1' : ''} ORDER BY created_at DESC`,
    params
  );
  return json({ items: result.rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { customerId, hostname, displayName } = await req.json();
  if (!customerId || !hostname) return errorResponse('customerId and hostname are required', 400);

  try {
    const result = await query(
      `INSERT INTO customer_servers (customer_id, hostname, display_name)
       VALUES ($1,$2,$3) RETURNING *`,
      [customerId, hostname, displayName ?? null]
    );
    return json(result.rows[0], 201);
  } catch (err: any) {
    if (err.code === '23505') return errorResponse('Server already exists for this customer', 409);
    throw err;
  }
}
```

- [ ] **步骤 4：写 `central/app/api/admin/servers/[id]/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(`SELECT * FROM customer_servers WHERE id=$1`, [params.id]);
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  return json(result.rows[0]);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { displayName, hostname } = await req.json();
  const result = await query(
    `UPDATE customer_servers SET display_name=COALESCE($1,display_name), hostname=COALESCE($2,hostname)
     WHERE id=$3 RETURNING *`,
    [displayName ?? null, hostname ?? null, params.id]
  );
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  return json(result.rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query('DELETE FROM customer_servers WHERE id=$1 RETURNING id', [params.id]);
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  return json({ ok: true });
}
```

- [ ] **步骤 5：运行测试验证通过**

```bash
cd central && npx vitest run __tests__/api-servers.test.ts
```
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add central/app/api/admin/servers/ central/__tests__/api-servers.test.ts
git commit -m "feat(central): add server CRUD API (M1-7)"
```

---

## 任务 8：配置版本化 API（含加密敏感字段，TDD）

**文件：**
- 创建：`central/lib/config-sanitizer.ts`
- 创建：`central/app/api/admin/configs/route.ts`
- 创建：`central/app/api/admin/configs/[id]/route.ts`
- 测试：`central/__tests__/api-configs.test.ts`

- [ ] **步骤 1：写失败的配置 API 测试**

`central/__tests__/api-configs.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';
import { decrypt } from '@/lib/encryption';

let adminToken: string;
let customerId: string;
let configId: string;

beforeAll(async () => {
  process.env.AES_KEY = Buffer.alloc(32, 1).toString('base64');
  const hash = await hashPassword('Test123!');
  const u = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('cfg@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: u.rows[0].id, email: 'cfg@x.local', role: 'admin' });
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Cfg测试') RETURNING id`);
  customerId = c.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM customer_configs; DELETE FROM customers; DELETE FROM admin_users;`);
  await pool.end();
});

describe('POST /api/admin/configs', () => {
  it('creates v1 config with encrypted dashscopeKey', async () => {
    const res = await fetch('http://localhost:3000/api/admin/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({
        customerId,
        brand: { brandName: '客户A' },
        ai: { dashscopeKey: 'sk-secret-xxx', model: 'qwen-plus' },
        deployment: { mode: 'nginx' },
        envOverrides: { DATABASE_PASSWORD: 'changeme' },
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.version).toBe(1);
    configId = body.id;

    // 验证 db 中 ai.dashscopeKey 是密文
    const dbRow = await pool.query(`SELECT ai FROM customer_configs WHERE id=$1`, [configId]);
    const aiField = dbRow.rows[0].ai;
    expect(aiField.dashscopeKey).toMatch(/^enc:/);
    expect(decrypt(aiField.dashscopeKey)).toBe('sk-secret-xxx');
  });

  it('creates v2 config for same customer', async () => {
    const res = await fetch('http://localhost:3000/api/admin/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ customerId, brand: { brandName: '客户A v2' }, ai: {}, deployment: {} }),
    });
    expect(res.status).toBe(201);
    expect((await res.json()).version).toBe(2);
  });

  it('publishes a config (sets published_at, blocks further PATCH)', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/configs/${configId}/publish`, {
      method: 'POST',
      headers: { cookie: `central_admin_session=${adminToken}` },
    });
    expect(res.status).toBe(200);

    const patch = await fetch(`http://localhost:3000/api/admin/configs/${configId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ brand: { brandName: 'changed' } }),
    });
    expect(patch.status).toBe(409);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd central && npx vitest run __tests__/api-configs.test.ts
```
预期：FAIL（404）

- [ ] **步骤 3：写 `central/lib/config-sanitizer.ts`**

```typescript
import { encrypt, isEncrypted } from './encryption';

const SENSITIVE_PATHS: Array<(string)[]> = [
  ['ai', 'dashscopeKey'],
  ['ai', 'wechatAppSecret'],
  ['envOverrides', 'DATABASE_PASSWORD'],
  ['envOverrides', 'REDIS_PASSWORD'],
  ['envOverrides', 'MEILI_MASTER_KEY'],
  ['envOverrides', 'JWT_SECRET'],
];

export function encryptSensitiveFields(config: Record<string, any>): Record<string, any> {
  const cloned = JSON.parse(JSON.stringify(config));
  for (const path of SENSITIVE_PATHS) {
    let obj = cloned;
    for (let i = 0; i < path.length - 1; i++) {
      if (!obj[path[i]]) break;
      obj = obj[path[i]];
    }
    const lastKey = path[path.length - 1];
    if (obj && obj[lastKey] && !isEncrypted(obj[lastKey])) {
      obj[lastKey] = encrypt(String(obj[lastKey]));
    }
  }
  return cloned;
}

export function maskSensitiveFields(config: Record<string, any>): Record<string, any> {
  const cloned = JSON.parse(JSON.stringify(config));
  for (const path of SENSITIVE_PATHS) {
    let obj = cloned;
    for (let i = 0; i < path.length - 1; i++) {
      if (!obj[path[i]]) break;
      obj = obj[path[i]];
    }
    const lastKey = path[path.length - 1];
    if (obj && obj[lastKey]) {
      obj[lastKey] = '••••••••';
    }
  }
  return cloned;
}
```

- [ ] **步骤 4：写 `central/app/api/admin/configs/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query, withTransaction } from '@/lib/db';
import { encryptSensitiveFields, maskSensitiveFields } from '@/lib/config-sanitizer';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const customerId = req.nextUrl.searchParams.get('customerId');
  if (!customerId) return errorResponse('customerId query param required', 400);
  const result = await query(
    `SELECT id, customer_id, version, brand, ai, deployment, env_overrides, published_at, created_at
     FROM customer_configs WHERE customer_id=$1 ORDER BY version DESC`,
    [customerId]
  );
  return json({ items: result.rows.map((r) => maskApiRow(r)) });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { customerId, brand, ai, deployment, envOverrides } = await req.json();
  if (!customerId) return errorResponse('customerId is required', 400);

  const encrypted = encryptSensitiveFields({ brand, ai, deployment, envOverrides });
  const result = await withTransaction(async (client) => {
    const versionRow = await client.query<{ max: string }>(
      'SELECT COALESCE(MAX(version),0) + 1 AS max FROM customer_configs WHERE customer_id=$1',
      [customerId]
    );
    const version = Number(versionRow.rows[0].max);
    const insertResult = await client.query(
      `INSERT INTO customer_configs (customer_id, version, brand, ai, deployment, env_overrides)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [customerId, version, encrypted.brand ?? {}, encrypted.ai ?? {}, encrypted.deployment ?? {}, encrypted.envOverrides ?? {}]
    );
    return insertResult.rows[0];
  });
  return json(maskApiRow(result), 201);
}

function maskApiRow(row: Record<string, any>) {
  return {
    ...row,
    ai: maskSensitiveFields({ ai: row.ai }).ai,
    env_overrides: maskSensitiveFields({ envOverrides: row.env_overrides }).envOverrides,
  };
}
```

- [ ] **步骤 5：写 `central/app/api/admin/configs/[id]/route.ts` + `publish/route.ts`**

```typescript
// central/app/api/admin/configs/[id]/route.ts
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import { encryptSensitiveFields, maskSensitiveFields } from '@/lib/config-sanitizer';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(`SELECT * FROM customer_configs WHERE id=$1`, [params.id]);
  if (result.rows.length === 0) return errorResponse('Not found', 404);
  const row = result.rows[0];
  return json({
    ...row,
    ai: maskSensitiveFields({ ai: row.ai }).ai,
    env_overrides: maskSensitiveFields({ envOverrides: row.env_overrides }).envOverrides,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const existing = await query<{ published_at: string | null }>(
    'SELECT published_at FROM customer_configs WHERE id=$1',
    [params.id]
  );
  if (existing.rows.length === 0) return errorResponse('Not found', 404);
  if (existing.rows[0].published_at) return errorResponse('Published configs are immutable', 409);

  const { brand, ai, deployment, envOverrides } = await req.json();
  const encrypted = encryptSensitiveFields({ brand, ai, deployment, envOverrides });
  const result = await query(
    `UPDATE customer_configs SET brand=COALESCE($1,brand), ai=COALESCE($2,ai),
       deployment=COALESCE($3,deployment), env_overrides=COALESCE($4,env_overrides)
     WHERE id=$5 RETURNING *`,
    [encrypted.brand ?? null, encrypted.ai ?? null, encrypted.deployment ?? null, encrypted.envOverrides ?? null, params.id]
  );
  return json(result.rows[0]);
}
```

```typescript
// central/app/api/admin/configs/[id]/publish/route.ts
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(
    `UPDATE customer_configs SET published_at=now() WHERE id=$1 AND published_at IS NULL RETURNING id, published_at`,
    [params.id]
  );
  if (result.rows.length === 0) return errorResponse('Not found or already published', 404);
  return json(result.rows[0]);
}
```

- [ ] **步骤 6：运行测试验证通过**

```bash
cd central && npx vitest run __tests__/api-configs.test.ts
```
预期：PASS 3 tests

- [ ] **步骤 7：Commit**

```bash
git add central/lib/config-sanitizer.ts central/app/api/admin/configs/ \
        central/__tests__/api-configs.test.ts
git commit -m "feat(central): add versioned config API with sensitive field encryption (M1-8)"
```

---

## 任务 9：Enrollment Codes API（TDD）

**文件：**
- 创建：`central/app/api/admin/enrollment-codes/route.ts`
- 创建：`central/app/api/admin/enrollment-codes/[id]/revoke/route.ts`
- 测试：`central/__tests__/api-enrollment.test.ts`

- [ ] **步骤 1：写失败的 enrollment 测试**

`central/__tests__/api-enrollment.test.ts`：
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';

let adminToken: string;
let customerId: string;
let codeId: string;
let codeValue: string;

beforeAll(async () => {
  const hash = await hashPassword('Test123!');
  const u = await pool.query(
    `INSERT INTO admin_users (email, password_hash, role) VALUES ('enr@x.local',$1,'admin') RETURNING id`,
    [hash]
  );
  adminToken = await signJwt({ sub: u.rows[0].id, email: 'enr@x.local', role: 'admin' });
  const c = await pool.query(`INSERT INTO customers (name) VALUES ('Enr测试') RETURNING id`);
  customerId = c.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM enrollment_codes; DELETE FROM customers; DELETE FROM admin_users;`);
  await pool.end();
});

describe('POST /api/admin/enrollment-codes', () => {
  it('issues a 24h enrollment code for a customer', async () => {
    const res = await fetch('http://localhost:3000/api/admin/enrollment-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `central_admin_session=${adminToken}` },
      body: JSON.stringify({ customerId }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toMatch(/^[A-Z0-9_-]{32}$/);
    expect(body.expiresAt).toBeDefined();
    codeId = body.id;
    codeValue = body.code;
  });

  it('revokes an enrollment code', async () => {
    const res = await fetch(`http://localhost:3000/api/admin/enrollment-codes/${codeId}/revoke`, {
      method: 'POST',
      headers: { cookie: `central_admin_session=${adminToken}` },
    });
    expect(res.status).toBe(200);
    const dbRow = await pool.query(`SELECT used_at FROM enrollment_codes WHERE id=$1`, [codeId]);
    // revoke sets used_at to now (so it can't be used)
    expect(dbRow.rows[0].used_at).not.toBeNull();
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

```bash
cd central && npx vitest run __tests__/api-enrollment.test.ts
```
预期：FAIL（404）

- [ ] **步骤 3：写 `central/app/api/admin/enrollment-codes/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';
import crypto from 'node:crypto';

const CODE_TTL_HOURS = 24;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const customerId = req.nextUrl.searchParams.get('customerId');
  if (!customerId) return errorResponse('customerId required', 400);
  const result = await query(
    `SELECT id, customer_id, code, issued_at, expires_at, used_at, failed_attempts
     FROM enrollment_codes WHERE customer_id=$1 ORDER BY issued_at DESC`,
    [customerId]
  );
  return json({ items: result.rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { customerId } = await req.json();
  if (!customerId) return errorResponse('customerId required', 400);

  const code = crypto.randomBytes(16).toString('base64url').toUpperCase().slice(0, 32);
  const result = await query(
    `INSERT INTO enrollment_codes (customer_id, code, expires_at)
     VALUES ($1,$2, now() + interval '${CODE_TTL_HOURS} hours')
     RETURNING id, customer_id, code, issued_at, expires_at, used_at, failed_attempts`,
    [customerId, code]
  );
  return json(result.rows[0], 201);
}
```

- [ ] **步骤 4：写 `central/app/api/admin/enrollment-codes/[id]/revoke/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { json, errorResponse, requireAdmin } from '@/lib/api-helpers';
import { query } from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const result = await query(
    `UPDATE enrollment_codes SET used_at=now() WHERE id=$1 AND used_at IS NULL RETURNING id`,
    [params.id]
  );
  if (result.rows.length === 0) return errorResponse('Not found or already used', 404);
  return json({ ok: true });
}
```

- [ ] **步骤 5：运行测试验证通过**

```bash
cd central && npx vitest run __tests__/api-enrollment.test.ts
```
预期：PASS 2 tests

- [ ] **步骤 6：Commit**

```bash
git add central/app/api/admin/enrollment-codes/ central/__tests__/api-enrollment.test.ts
git commit -m "feat(central): add enrollment codes issue + revoke API (M1-9)"
```

---

## 任务 10：登录 UI

**文件：**
- 创建：`central/app/(auth)/login/page.tsx`
- 创建：`central/app/globals.css`

- [ ] **步骤 1：写 `central/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body { @apply bg-gray-50 text-gray-900; }
```

- [ ] **步骤 2：写 `central/app/(auth)/login/page.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push('/customers');
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? '登录失败');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <form onSubmit={onSubmit} className="bg-white p-8 rounded shadow-md w-96 space-y-4">
        <h1 className="text-xl font-bold">中央管理后台</h1>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-2 rounded disabled:opacity-50">
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **步骤 3：手动冒烟测试**

```bash
cd central && npm run dev
# 浏览器访问 http://localhost:3000/login
# 输入 admin@yousen.local / ChangeMe123! → 应跳转到 /customers
```

- [ ] **步骤 4：Commit**

```bash
git add central/app/globals.css central/app/\(auth\)/
git commit -m "feat(central): add login UI (M1-10)"
```

---

## 任务 11：管理后台 Layout Shell

**文件：**
- 创建：`central/app/(dashboard)/layout.tsx`
- 创建：`central/app/layout.tsx`（根 layout）

- [ ] **步骤 1：写 `central/app/layout.tsx`**

```tsx
import './globals.css';

export const metadata = { title: '中央管理后台' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **步骤 2：写 `central/app/(dashboard)/layout.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/customers', label: '客户' },
  { href: '/servers', label: '服务器' },
  { href: '/configs', label: '配置' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-gray-800 text-gray-100 p-4 space-y-2">
        <div className="font-bold text-lg mb-4">中央管理</div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2 rounded ${pathname.startsWith(item.href) ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
          >
            {item.label}
          </Link>
        ))}
        <button onClick={logout} className="block w-full text-left px-3 py-2 rounded hover:bg-gray-700 mt-8">
          退出登录
        </button>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **步骤 3：Commit**

```bash
git add central/app/layout.tsx central/app/\(dashboard\)/layout.tsx
git commit -m "feat(central): add dashboard layout shell with sidebar (M1-11)"
```

---

## 任务 12：客户列表 + 详情 + 创建 UI

**文件：**
- 创建：`central/app/(dashboard)/customers/page.tsx`
- 创建：`central/app/(dashboard)/customers/new/page.tsx`
- 创建：`central/app/(dashboard)/customers/[id]/page.tsx`

- [ ] **步骤 1：写 `central/app/(dashboard)/customers/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Customer { id: string; name: string; contact_name: string | null; contact_phone: string | null; }

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/customers').then((r) => r.json()).then((d) => {
      setItems(d.items ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">客户</h1>
        <Link href="/customers/new" className="bg-blue-600 text-white px-4 py-2 rounded">新建客户</Link>
      </div>
      {loading ? <p>加载中...</p> : (
        <table className="w-full bg-white rounded shadow">
          <thead className="bg-gray-100">
            <tr><th className="p-3 text-left">名称</th><th className="p-3 text-left">联系人</th><th className="p-3 text-left">电话</th></tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="p-3"><Link href={`/customers/${c.id}`} className="text-blue-600">{c.name}</Link></td>
                <td className="p-3">{c.contact_name ?? '-'}</td>
                <td className="p-3">{c.contact_phone ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **步骤 2：写 `central/app/(dashboard)/customers/new/page.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', contactName: '', contactPhone: '' });
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) router.push('/customers');
    else setError((await res.json()).error ?? '创建失败');
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold">新建客户</h1>
      {error && <div className="text-red-600">{error}</div>}
      <input className="w-full border p-2 rounded" placeholder="客户名称" required
        value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className="w-full border p-2 rounded" placeholder="联系人"
        value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
      <input className="w-full border p-2 rounded" placeholder="联系电话"
        value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
      <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">创建</button>
    </form>
  );
}
```

- [ ] **步骤 3：写 `central/app/(dashboard)/customers/[id]/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<any>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/customers/${id}`).then((r) => r.json()),
      fetch(`/api/admin/servers?customerId=${id}`).then((r) => r.json()),
      fetch(`/api/admin/configs?customerId=${id}`).then((r) => r.json()),
      fetch(`/api/admin/enrollment-codes?customerId=${id}`).then((r) => r.json()),
    ]).then(([c, s, cfg, codes]) => {
      setCustomer(c); setServers(s.items ?? []); setConfigs(cfg.items ?? []); setCodes(codes.items ?? []);
    });
  }, [id]);

  async function issueCode() {
    await fetch('/api/admin/enrollment-codes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: id }),
    });
    const codes = await fetch(`/api/admin/enrollment-codes?customerId=${id}`).then((r) => r.json());
    setCodes(codes.items ?? []);
  }

  if (!customer) return <p>加载中...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{customer.name}</h1>
      <section>
        <h2 className="text-lg font-bold mb-2">服务器</h2>
        <Link href={`/servers?customerId=${id}`} className="text-blue-600">添加服务器 →</Link>
        <ul className="mt-2">
          {servers.map((s) => (
            <li key={s.id} className="border-b py-2">
              <Link href={`/servers/${s.id}`} className="text-blue-600">{s.hostname}</Link>
              <span className="ml-2 text-sm text-gray-500">{s.display_name}</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded ${s.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                {s.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-bold mb-2">配置版本</h2>
        <ul>
          {configs.map((c) => (
            <li key={c.id} className="border-b py-2">
              <Link href={`/configs/${c.id}`} className="text-blue-600">v{c.version}</Link>
              {c.published_at && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">已发布</span>}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-bold mb-2">Enrollment Codes</h2>
        <button onClick={issueCode} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">颁发新注册码</button>
        <ul className="mt-2">
          {codes.map((c) => (
            <li key={c.id} className="border-b py-2 text-sm">
              <code className="bg-gray-100 px-1">{c.code}</code>
              <span className="ml-2 text-gray-500">过期: {new Date(c.expires_at).toLocaleString()}</span>
              {c.used_at && <span className="ml-2 text-orange-600">已使用</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **步骤 4：手动验证完整流程**

```bash
cd central && npm run dev
# 登录 → 创建客户 → 查看详情 → 颁发 enrollment code
```

- [ ] **步骤 5：Commit**

```bash
git add central/app/\(dashboard\)/customers/
git commit -m "feat(central): add customer list/detail/new UI (M1-12)"
```

---

## 任务 13：服务器列表 + 详情 UI

**文件：**
- 创建：`central/app/(dashboard)/servers/page.tsx`
- 创建：`central/app/(dashboard)/servers/[id]/page.tsx`

- [ ] **步骤 1：写 `central/app/(dashboard)/servers/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ServersPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/servers').then((r) => r.json()).then((d) => setItems(d.items ?? []));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">服务器</h1>
      <table className="w-full bg-white rounded shadow">
        <thead className="bg-gray-100">
          <tr><th className="p-3 text-left">主机名</th><th className="p-3 text-left">显示名</th><th className="p-3 text-left">状态</th><th className="p-3 text-left">最后心跳</th></tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className="border-t hover:bg-gray-50">
              <td className="p-3"><Link href={`/servers/${s.id}`} className="text-blue-600">{s.hostname}</Link></td>
              <td className="p-3">{s.display_name ?? '-'}</td>
              <td className="p-3">
                <span className={`text-xs px-2 py-0.5 rounded ${s.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                  {s.status}
                </span>
              </td>
              <td className="p-3 text-sm text-gray-500">{s.last_heartbeat ? new Date(s.last_heartbeat).toLocaleString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **步骤 2：写 `central/app/(dashboard)/servers/[id]/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [server, setServer] = useState<any>(null);

  useEffect(() => { fetch(`/api/admin/servers/${id}`).then((r) => r.json()).then(setServer); }, [id]);

  if (!server) return <p>加载中...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{server.hostname}</h1>
      <dl className="grid grid-cols-2 gap-2 max-w-lg">
        <dt className="font-bold">显示名</dt><dd>{server.display_name ?? '-'}</dd>
        <dt className="font-bold">状态</dt><dd>{server.status}</dd>
        <dt className="font-bold">Agent 版本</dt><dd>{server.agent_version ?? '-'}</dd>
        <dt className="font-bold">最后心跳</dt><dd>{server.last_heartbeat ? new Date(server.last_heartbeat).toLocaleString() : '-'}</dd>
      </dl>
    </div>
  );
}
```

- [ ] **步骤 3：Commit**

```bash
git add central/app/\(dashboard\)/servers/
git commit -m "feat(central): add server list/detail UI (M1-13)"
```

---

## 任务 14：配置编辑器 UI

**文件：**
- 创建：`central/app/(dashboard)/configs/page.tsx`
- 创建：`central/app/(dashboard)/configs/[id]/page.tsx`

- [ ] **步骤 1：写 `central/app/(dashboard)/configs/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function ConfigsPage() {
  const params = useSearchParams();
  const customerId = params.get('customerId');
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/admin/configs?customerId=${customerId}`).then((r) => r.json()).then((d) => setItems(d.items ?? []));
  }, [customerId]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">配置版本 {customerId ? `· 客户 ${customerId.slice(0,8)}` : ''}</h1>
      {!customerId && <p className="text-gray-500">请通过客户详情页进入。</p>}
      <ul>
        {items.map((c) => (
          <li key={c.id} className="border-b py-2">
            <Link href={`/configs/${c.id}`} className="text-blue-600">v{c.version}</Link>
            {c.published_at && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">已发布</span>}
            <span className="ml-2 text-sm text-gray-500">{new Date(c.created_at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **步骤 2：写 `central/app/(dashboard)/configs/[id]/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const TABS = ['brand', 'ai', 'deployment', 'envOverrides'] as const;
type Tab = typeof TABS[number];

export default function ConfigDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [config, setConfig] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('brand');
  const [draft, setDraft] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch(`/api/admin/configs/${id}`).then((r) => r.json()).then((c) => {
      setConfig(c);
      setDraft({
        brand: c.brand ?? {},
        ai: c.ai ?? {},
        deployment: c.deployment ?? {},
        envOverrides: c.env_overrides ?? {},
      });
    });
  }, [id]);

  async function save() {
    const res = await fetch(`/api/admin/configs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (res.ok) alert('已保存');
    else alert('保存失败: ' + (await res.json()).error);
  }

  async function publish() {
    if (!confirm('发布后不可修改，确认？')) return;
    const res = await fetch(`/api/admin/configs/${id}/publish`, { method: 'POST' });
    if (res.ok) location.reload();
    else alert('发布失败');
  }

  if (!config) return <p>加载中...</p>;
  const isPublished = !!config.published_at;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">配置 v{config.version}</h1>
        {isPublished ? (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">已发布</span>
        ) : (
          <div className="space-x-2">
            <button onClick={save} className="bg-gray-600 text-white px-3 py-1 rounded text-sm">保存草稿</button>
            <button onClick={publish} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">发布</button>
          </div>
        )}
      </div>
      <div className="flex border-b">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 ${tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>
      <textarea
        className="w-full h-96 border p-2 font-mono text-sm"
        value={JSON.stringify(draft[tab], null, 2)}
        onChange={(e) => {
          try { setDraft({ ...draft, [tab]: JSON.parse(e.target.value) }); } catch {}
        }}
        disabled={isPublished}
      />
    </div>
  );
}
```

- [ ] **步骤 3：Commit**

```bash
git add central/app/\(dashboard\)/configs/
git commit -m "feat(central): add config version list + 4-tab editor UI (M1-14)"
```

---

## 任务 15：Dockerfile + docker-compose

**文件：**
- 创建：`central/Dockerfile`
- 创建：`central/docker-compose.yml`

- [ ] **步骤 1：写 `central/Dockerfile`**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/db ./db
COPY --from=builder /app/lib ./lib
EXPOSE 3000
CMD ["npm", "start"]
```

- [ ] **步骤 2：写 `central/docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: central-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: control_db
      POSTGRES_USER: central
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD:-changeme}
    volumes:
      - central_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U central -d control_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  central:
    build: .
    container_name: central-app
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://central:${DATABASE_PASSWORD:-changeme}@postgres:5432/control_db
      JWT_SECRET: ${JWT_SECRET}
      AES_KEY: ${AES_KEY}
      NODE_ENV: production
    ports:
      - "${CENTRAL_PORT:-3000}:3000"
    command: sh -c "npx tsx db/migrate.ts && npx tsx db/seed.ts && npm start"

volumes:
  central_pgdata:
```

- [ ] **步骤 3：手动验证**

```bash
cd central
cp .env.example .env  # 填入实际值
docker compose up -d
# 等待 migrate + seed 完成
curl -i http://localhost:3000/login
# 预期：200
```

- [ ] **步骤 4：Commit**

```bash
git add central/Dockerfile central/docker-compose.yml
git commit -m "feat(central): add Dockerfile + docker-compose (M1-15)"
```

---

## 任务 16：端到端集成验证

- [ ] **步骤 1：完整流程冒烟测试**

```bash
cd central && docker compose up -d
# 等 30s 让 migrate+seed 跑完
# 浏览器访问 http://localhost:3000/login
# 1. 用 admin@yousen.local / ChangeMe123! 登录
# 2. 新建客户「客户A」
# 3. 进入客户详情 → 颁发 enrollment code（记下 code 值）
# 4. 在客户详情页添加服务器「prod-1」
# 5. 创建配置 v1（在 ai tab 填入 {"dashscopeKey":"sk-test","model":"qwen-plus"}）
# 6. 保存草稿 → 发布
# 7. 试图修改已发布配置 → 应 409 报错
# 8. 在 DB 中验证：SELECT ai FROM customer_configs → 应看到 "enc:..." 密文
```

- [ ] **步骤 2：跑全部单元测试**

```bash
cd central && npx vitest run
```
预期：全部 PASS

- [ ] **步骤 3：标记 M1 完成 + push**

```bash
git tag m1-complete
git push origin main --tags
```

---

## M1 自检

**规格覆盖度：**
- 第 5 节数据模型 → 任务 1（schema.sql）✓
- 第 6.1 节接口签名 → M1 不涉及 WebSocket（M2 范围）✓
- 第 9 节安全 1/3/6/7 → 任务 2（加密）、任务 3（JWT+bcrypt）、任务 8（敏感字段加密）、任务 9（enrollment 24h）✓
- 第 12.1 节交付物清单 → 任务 1-15 全覆盖 ✓

**类型一致性：**
- `AdminJwtPayload` 在任务 3 定义，任务 4-9 使用 `requireAdmin` 返回类型一致 ✓
- `encryptSensitiveFields` 在任务 8 定义，所有配置 API 使用一致 ✓
- `COOKIE_NAME` 在任务 3 导出，任务 4/5 使用一致 ✓

**遗漏：** 无。M2 范围（WebSocket、Agent）在下一份计划。
