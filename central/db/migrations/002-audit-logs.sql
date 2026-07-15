-- M5 增量迁移：审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    UUID REFERENCES admin_users(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  ip          TEXT,
  user_agent  TEXT,
  detail      JSONB DEFAULT '{}',
  ts          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs (admin_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_type, target_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts ON audit_logs (ts DESC);
