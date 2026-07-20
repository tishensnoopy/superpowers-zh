'use client';

import { useState } from 'react';
import { Search, ChevronDown, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { Section } from '@/lib/api';
import { submitFaqFeedback } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category?: string;
}

export default function Faq({ section }: { section: Section }) {
  const { title, faqs, showSearch = true } = section;
  const t = useTranslations('sections.faq');
  const tFaq = useTranslations('faq');
  const tCommon = useTranslations('common');
  const [openId, setOpenId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, 'helpful' | 'notHelpful' | 'submitting'>>({});

  const CATEGORIES = [
    { value: 'all', label: tFaq('all') },
    { value: 'course', label: tFaq('courseConsulting') },
    { value: 'service', label: tFaq('serviceRelated') },
    { value: 'policy', label: tFaq('policyRegulations') },
  ] as const;

  const faqList: FaqItem[] = Array.isArray(faqs) ? faqs : faqs?.data || [];

  const filteredFaqs = faqList.filter((faq) => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    if (!matchesCategory) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return faq.question.toLowerCase().includes(query) ||
           faq.answer.toLowerCase().includes(query);
  });

  const handleFeedback = async (faqId: number, helpful: boolean) => {
    if (feedbackGiven[faqId]) return;
    setFeedbackGiven(prev => ({ ...prev, [faqId]: 'submitting' }));
    try {
      await submitFaqFeedback(String(faqId), { helpful });
      setFeedbackGiven(prev => ({ ...prev, [faqId]: helpful ? 'helpful' : 'notHelpful' }));
    } catch {
      setFeedbackGiven(prev => {
        const next = { ...prev };
        delete next[faqId];
        return next;
      });
    }
  };

  return (
    <section className="py-24 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-16">
          <h2
            className="text-[var(--brand-dark,#1C2B3A)] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '2.25rem',
              fontWeight: 800,
            }}
          >
            {title || t('titleFallback')}
          </h2>
        </div>

        {showSearch && (
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={tFaq('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={tFaq('searchAriaLabel')}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:border-[var(--brand-primary,#F5851F)] transition-colors"
              />
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto mb-10 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                activeCategory === cat.value
                  ? 'bg-[var(--brand-primary,#F5851F)] text-white border-[var(--brand-primary,#F5851F)] shadow-md'
                  : 'bg-card text-[var(--brand-dark,#1C2B3A)] border-border hover:border-[var(--brand-primary,#F5851F)] hover:text-[var(--brand-primary,#F5851F)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {filteredFaqs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {tFaq('noResults')}
            </div>
          )}
          {filteredFaqs.map((faq) => {
            const isOpen = openId === faq.id;
            const given = feedbackGiven[faq.id];
            return (
              <div
                key={faq.id}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <button
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-content-${faq.id}`}
                >
                  <span className="font-semibold text-[var(--brand-dark,#1C2B3A)]">{faq.question}</span>
                  <ChevronDown
                    size={20}
                    className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <div
                  id={`faq-content-${faq.id}`}
                  className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[600px]' : 'max-h-0'}`}
                >
                  <div className="p-6 pt-0 text-muted-foreground text-sm leading-relaxed">
                    {faq.answer}
                  </div>
                  {isOpen && (
                    <div className="px-6 pb-4 flex items-center gap-3 border-t border-border/50 pt-3">
                      {!given && (
                        <>
                          <span className="text-xs text-muted-foreground mr-2">{tFaq('feedbackPrompt')}</span>
                          <button
                            onClick={() => handleFeedback(faq.id, true)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-card hover:border-[var(--brand-primary,#F5851F)] hover:text-[var(--brand-primary,#F5851F)] transition-colors"
                          >
                            <ThumbsUp size={12} /> {tFaq('helpful')}
                          </button>
                          <button
                            onClick={() => handleFeedback(faq.id, false)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-card hover:border-[var(--brand-primary,#F5851F)] hover:text-[var(--brand-primary,#F5851F)] transition-colors"
                          >
                            <ThumbsDown size={12} /> {tFaq('notHelpful')}
                          </button>
                        </>
                      )}
                      {given === 'submitting' && (
                        <span className="text-xs text-muted-foreground">{tCommon('submitting')}</span>
                      )}
                      {(given === 'helpful' || given === 'notHelpful') && (
                        <span className="text-xs text-[var(--brand-primary,#F5851F)] font-semibold">{tFaq('thanksForFeedback')}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
