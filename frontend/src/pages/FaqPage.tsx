import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getFaqItems, type FaqItem } from '../lib/api';
import Seo from '../components/Seo';

export default function FaqPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getFaqItems(activeCategory || undefined)
      .then((res) => {
        if (!cancelled) {
          setFaqs(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[FaqPage] 加载失败:', err);
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeCategory]);

  // 从 FAQ 数据中提取唯一分类
  const categories = Array.from(
    new Set(faqs.map((f) => f.category).filter(Boolean))
  ) as string[];

  if (loading) {
    return (
      <div className="pt-[120px] pb-32 min-h-screen text-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-[120px] pb-32 min-h-screen text-center">
        <h2 className="text-2xl font-bold text-[#1C2B3A] mb-4">加载失败</h2>
        <p className="text-muted-foreground">FAQ 列表加载出错，请稍后重试。</p>
      </div>
    );
  }

  return (
    <div className="pt-[72px] pb-16 min-h-screen" style={{ background: '#FAFAFA' }}>
      <Seo title="常见问题" description="幼小衔接课程常见问题解答，帮助您了解入学流程、课程安排等。" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* 页面标题 */}
        <div className="py-12 text-center">
          <h1
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
            }}
          >
            常见问题
          </h1>
          <p className="text-[#6B7280] text-base sm:text-lg">
            在这里找到您可能关心的问题答案
          </p>
        </div>

        {/* 分类筛选 */}
        {categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <button
              onClick={() => setActiveCategory('')}
              data-active={activeCategory === '' ? 'true' : 'false'}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                activeCategory === ''
                  ? 'text-white shadow-md'
                  : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#F5851F] hover:text-[#F5851F]'
              }`}
              style={activeCategory === '' ? { background: '#F5851F' } : {}}
            >
              全部
            </button>
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  data-active={isActive ? 'true' : 'false'}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                    isActive
                      ? 'text-white shadow-md'
                      : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#F5851F] hover:text-[#F5851F]'
                  }`}
                  style={isActive ? { background: '#F5851F' } : {}}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {/* FAQ 列表 */}
        {faqs.length === 0 ? (
          <div className="text-center py-20 text-[#9CA3AF]">
            <p className="text-lg">暂无常见问题</p>
          </div>
        ) : (
          <div className="space-y-4">
            {faqs.map((faq) => {
              const isExpanded = expandedId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden transition-shadow hover:shadow-md"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left"
                  >
                    <span
                      className="text-[#1C2B3A] font-semibold"
                      style={{ fontSize: '16px' }}
                    >
                      {faq.question}
                    </span>
                    <ChevronDown
                      size={20}
                      className={`flex-shrink-0 text-[#9CA3AF] transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-5">
                      <p className="text-[#6B7280]" style={{ fontSize: '15px', lineHeight: 1.7 }}>
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
