-- 003-admin-locked.sql
-- 为 admin_users 添加锁定/解锁字段
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
