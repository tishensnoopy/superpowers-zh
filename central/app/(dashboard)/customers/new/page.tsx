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
