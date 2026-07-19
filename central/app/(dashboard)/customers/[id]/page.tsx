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

  async function downloadBootstrap() {
    const res = await fetch(`/api/admin/customers/${id}/bootstrap-script`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? '下载失败');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bootstrap-agent.sh';
    a.click();
    URL.revokeObjectURL(url);
  }

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
        <h2 className="text-lg font-bold mb-2">操作</h2>
        <div className="space-x-2">
          <button onClick={downloadBootstrap} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">
            下载开通脚本
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">裸机第一步：把脚本拷到目标服务器执行 <code className="bg-gray-100 px-1">sudo bash bootstrap-agent.sh</code>（含一次性 enrollment code，24h 有效；需先构建出 ready 发布包）。</p>
      </section>
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
