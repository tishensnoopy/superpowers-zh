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
  locked        BOOLEAN NOT NULL DEFAULT false,
  locked_at     TIMESTAMPTZ,
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

-- 审计日志（M5 新增）
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    UUID REFERENCES admin_users(id),
  action      TEXT NOT NULL,             -- login|customer:create|customer:update|customer:delete|
                                          -- config:publish|config:delete|server:create|server:delete|
                                          -- token:revoke|job:deploy|job:cancel|enrollment:issue|enrollment:revoke
  target_type TEXT,                      -- customer|config|server|token|job|enrollment
  target_id   TEXT,
  ip          TEXT,
  user_agent  TEXT,
  detail      JSONB DEFAULT '{}',        -- 变更前后 diff、extra 信息
  ts          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs (admin_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_type, target_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts ON audit_logs (ts DESC);

-- 发布包（bundle）：唯一代码分发载体，central 本机仓库 git archive 产出
CREATE TABLE IF NOT EXISTS bundles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ref         TEXT NOT NULL,
  filename    TEXT NOT NULL,
  size_bytes  BIGINT,
  status      TEXT NOT NULL DEFAULT 'building',  -- building|ready|failed
  error       TEXT,
  created_by  UUID REFERENCES admin_users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bundles_created ON bundles(created_at DESC);
