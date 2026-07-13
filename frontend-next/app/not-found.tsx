import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
    >
      <div className="text-center px-8">
        <div
          className="text-[120px] font-black text-white leading-none opacity-90"
          style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
        >
          404
        </div>
        <h1
          className="text-3xl font-bold text-white mt-4 mb-3"
          style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
        >
          页面未找到
        </h1>
        <p className="text-white/80 mb-8 max-w-md mx-auto">
          您访问的页面不存在或已被移除，请返回首页继续浏览
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#F5851F] rounded-xl font-semibold hover:bg-white/90 transition-colors shadow-lg"
          >
            <Home size={18} /> 返回首页
          </Link>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 px-6 py-3 border-2 border-white/70 text-white rounded-xl font-semibold hover:bg-white/10 transition-colors"
          >
            <Search size={18} /> 浏览课程
          </Link>
        </div>
      </div>
    </div>
  );
}
