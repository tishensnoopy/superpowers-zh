import { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import type { Section } from '../../lib/api';

export default function Faq({ section }: { section: Section }) {
  const { title, faqs, showSearch = true } = section;
  const [openId, setOpenId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredFaqs = faqs?.data?.filter((faq: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return faq.question.toLowerCase().includes(query) ||
           faq.answer.toLowerCase().includes(query);
  }) || [];
  
  return (
    <section className="py-24 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-16">
          <h2
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '2.25rem',
              fontWeight: 800,
            }}
          >
            {title || '常见问题'}
          </h2>
        </div>

        {showSearch && (
          <div className="max-w-2xl mx-auto mb-10">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索常见问题..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:border-[#F5851F] transition-colors"
              />
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-4">
          {filteredFaqs.map((faq: any) => (
            <div
              key={faq.id}
              className="bg-card rounded-xl border border-border overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
              >
                <span className="font-semibold text-[#1C2B3A]">{faq.question}</span>
                <ChevronDown
                  size={20}
                  className={`text-muted-foreground transition-transform duration-200 ${openId === faq.id ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${openId === faq.id ? 'max-h-96' : 'max-h-0'}`}
              >
                <div className="p-6 pt-0 text-muted-foreground text-sm leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
