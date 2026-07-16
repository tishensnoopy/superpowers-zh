'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface AdminUser {
  id: string;
  email: string;
  role: 'superadmin' | 'admin' | 'viewer';
  locked: boolean | null;
  locked_at: string | null;
  created_at: string;
}

const ROLE_LABEL: Record<AdminUser['role'], string> = {
  superadmin: '超级管理员',
  admin: '管理员',
  viewer: '只读',
};

const ROLES = [
  { value: 'admin', label: '管理员' },
  { value: 'viewer', label: '只读' },
  { value: 'superadmin', label: '超级管理员（慎选）' },
];

export default function AdminDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('admin');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/admins/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setAdmin(d);
          setEmail(d.email);
          setRole(d.role);
        }
      })
      .catch(() => setError('加载失败'));
  }, [id]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const body: Record<string, unknown> = { email, role };
    if (password) body.password = password;

    const res = await fetch(`/api/admin/admins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setAdmin(updated);
      setEmail(updated.email);
      setRole(updated.role);
      setPassword('');
      setSuccess('保存成功');
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? `保存失败 (${res.status})`);
    }
    setSaving(false);
  }

  async function onDelete() {
    if (!confirm(`确认删除管理员 ${admin?.email}？此操作不可恢复。`)) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/admin/admins/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/admins');
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? `删除失败 (${res.status})`);
      setDeleting(false);
    }
  }

  async function onToggleLock() {
    if (!admin) return;
    const action = admin.locked ? '解锁' : '锁定';
    if (!confirm(`确认${action}管理员 ${admin.email}？`)) return;
    setTogglingLock(true);
    setError(null);
    setSuccess(null);
    const endpoint = admin.locked ? 'unlock' : 'lock';
    const res = await fetch(`/api/admin/admins/${id}/${endpoint}`, { method: 'POST' });
    if (res.ok) {
      const updated = await res.json();
      setAdmin(updated);
      setSuccess(`${action}成功`);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? `${action}失败 (${res.status})`);
    }
    setTogglingLock(false);
  }

  if (!admin && !error) return <p>加载中...</p>;
  if (!admin) {
    return (
      <div className="space-y-4">
        <div className="text-red-600">{error}</div>
        <Link href="/admins" className="text-blue-600">返回列表</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">编辑管理员</h1>
        <Link href="/admins" className="text-blue-600 text-sm">返回列表</Link>
      </div>

      {error && <div className="text-red-600 bg-red-50 p-2 rounded">{error}</div>}
      {success && <div className="text-green-700 bg-green-50 p-2 rounded">{success}</div>}

      <div className="bg-white rounded shadow p-4 text-sm text-gray-600 space-y-1">
        <div>当前角色：<span className="font-semibold">{ROLE_LABEL[admin.role]}</span></div>
        <div>
          账号状态：
          {admin.locked ? (
            <span className="font-semibold text-orange-700">
              已锁定{admin.locked_at ? `（${new Date(admin.locked_at).toLocaleString()}）` : ''}
            </span>
          ) : (
            <span className="font-semibold text-green-700">正常</span>
          )}
        </div>
        <div>创建时间：{new Date(admin.created_at).toLocaleString()}</div>
      </div>

      <form onSubmit={onSave} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">邮箱</label>
          <input
            className="w-full border p-2 rounded"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">角色</label>
          <select
            className="w-full border p-2 rounded"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">
            重置密码（留空则不修改，至少 8 位）
          </label>
          <input
            className="w-full border p-2 rounded"
            type="password"
            minLength={8}
            placeholder="留空保持原密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          type="submit"
          disabled={saving}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </form>

      <div className="border-t pt-4 space-y-3">
        <button
          onClick={onToggleLock}
          className={`text-white px-4 py-2 rounded disabled:opacity-50 ${
            admin.locked ? 'bg-green-600' : 'bg-orange-600'
          }`}
          disabled={togglingLock}
        >
          {togglingLock
            ? '处理中...'
            : admin.locked
              ? '解锁账号'
              : '锁定账号'}
        </button>
        <button
          onClick={onDelete}
          className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50 ml-2"
          disabled={deleting}
        >
          {deleting ? '删除中...' : '删除账号'}
        </button>
      </div>
    </div>
  );
}
