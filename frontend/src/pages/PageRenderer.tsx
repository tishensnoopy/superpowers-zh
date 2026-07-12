import { useState, useEffect } from 'react';
import { getPageBySlug, getHomepage } from '../lib/api';
import SectionRenderer from '../components/SectionRenderer';
import Seo from '../components/Seo';
import type { Page } from '../lib/api';

export default function PageRenderer({ slug }: { slug?: string }) {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPage() {
      setLoading(true);
      setError(null);
      try {
        const res = slug ? await getPageBySlug(slug) : await getHomepage();
        setPage(res.data);
      } catch (err) {
        console.error('Failed to fetch page:', err);
        setError('页面加载失败');
      } finally {
        setLoading(false);
      }
    }
    fetchPage();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#F5851F] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground text-lg mb-4">{error || '页面不存在'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-lg text-white font-semibold"
            style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  const sections = page.attributes.sections || [];
  const seo = page.attributes.seo;
  const pageTitle = page.attributes.title;

  return (
    <div>
      <Seo seo={seo} title={pageTitle} />
      {sections.map((section: any, index: number) => (
        <SectionRenderer key={`${section.__component}-${section.id}-${index}`} section={section} />
      ))}
    </div>
  );
}
