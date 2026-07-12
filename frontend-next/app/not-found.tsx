import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="text-center px-8">
        <div className="text-[120px] font-bold text-orange-500 leading-none">404</div>
        <h1 className="text-2xl font-bold text-gray-800 mt-4 mb-2">页面未找到</h1>
        <p className="text-gray-600 mb-8">您访问的页面不存在或已被移除</p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            <Home size={18} /> 返回首页
          </Link>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 px-6 py-3 border border-orange-500 text-orange-500 rounded-lg hover:bg-orange-50"
          >
            <Search size={18} /> 浏览课程
          </Link>
        </div>
      </div>
    </div>
  );
}
