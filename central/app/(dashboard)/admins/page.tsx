'use client';
import { useEffect, useState } from 'react';
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

const ROLE_CLASS: Record<AdminUser['role'], string> = {
  superadmin: 'bg-red-100 text-red-700',
  admin: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-700',
};

export default function AdminsPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/admins')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setItems(d.items ?? []);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('加载失败');
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <Link href="/admins/new" className="bg-blue-600 text-white px-4 py-2 rounded">
          新建管理员
        </Link>
      </div>
      {loading && <p>加载中...</p>}
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {!loading && !error && (
        <table className="w-full bg-white rounded shadow">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">邮箱</th>
              <th className="p-3 text-left">角色</th>
              <th className="p-3 text-left">状态</th>
              <th className="p-3 text-left">创建时间</th>
              <th className="p-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t hover:bg-gray-50">
                <td className="p-3">{a.email}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${ROLE_CLASS[a.role]}`}>
                    {ROLE_LABEL[a.role]}
                  </span>
                </td>
                <td className="p-3">
                  {a.locked ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                      已锁定
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                      正常
                    </span>
                  )}
                </td>
                <td className="p-3 text-sm text-gray-500">
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td className="p-3">
                  <Link href={`/admins/${a.id}`} className="text-blue-600">
                    编辑
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  暂无管理员账号
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
