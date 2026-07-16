'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/customers', label: '客户' },
  { href: '/servers', label: '服务器' },
  { href: '/configs', label: '配置' },
  { href: '/jobs', label: '任务管理' },
  { href: '/admins', label: '用户管理' },
  { href: '/audit-logs', label: '审计日志' },
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
