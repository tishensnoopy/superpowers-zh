'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ROLES = [
  { value: 'admin', label: '管理员' },
  { value: 'viewer', label: '只读' },
  { value: 'superadmin', label: '超级管理员（慎选）' },
];

export default function NewAdminPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', role: 'admin' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      router.push('/admins');
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `创建失败 (${res.status})`);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">新建管理员</h1>
        <Link href="/admins" className="text-blue-600 text-sm">返回列表</Link>
      </div>
      {error && <div className="text-red-600 bg-red-50 p-2 rounded">{error}</div>}
      <div>
        <label className="block text-sm text-gray-700 mb-1">邮箱 *</label>
        <input
          className="w-full border p-2 rounded"
          type="email"
          required
          placeholder="admin@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">密码 *（至少 8 位）</label>
        <input
          className="w-full border p-2 rounded"
          type="password"
          required
          minLength={8}
          placeholder="至少 8 位"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-1">角色 *</label>
        <select
          className="w-full border p-2 rounded"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        type="submit"
        disabled={submitting}
      >
        {submitting ? '创建中...' : '创建'}
      </button>
    </form>
  );
}
