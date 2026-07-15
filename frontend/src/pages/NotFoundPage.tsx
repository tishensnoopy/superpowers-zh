import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import Seo from '../components/Seo';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div>
      <Seo title="页面未找到" />
      <section className="min-h-[70vh] flex items-center justify-center px-8 py-32">
        <div className="text-center max-w-md">
          <h1
            className="text-[120px] leading-none font-black mb-4"
            style={{
              background: 'linear-gradient(135deg, #F5851F, #FF6B35)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            404
          </h1>
          <h2 className="text-2xl font-bold text-[#1C2B3A] mb-3">
            页面未找到
          </h2>
          <p className="text-muted-foreground text-base mb-10">
            抱歉，您访问的页面不存在或已被移除。
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.03]"
              style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
            >
              <Home size={16} />
              返回首页
            </Link>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-[#4A5568] text-sm font-semibold border border-border hover:bg-muted transition-all duration-200"
            >
              <ArrowLeft size={16} />
              返回上一页
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
