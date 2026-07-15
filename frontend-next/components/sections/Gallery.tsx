import { Heart } from 'lucide-react';
import type { Section } from '@/lib/api';
import { useTranslations } from 'next-intl';

export default function Gallery({ section }: { section: Section }) {
  const t = useTranslations('sections.gallery');
  const { title, description, images, columns = '3' } = section;

  const colClasses: Record<string, string> = {
    '2': 'col-span-12 md:col-span-6 h-[196px]',
    '3': 'col-span-12 md:col-span-4 h-[196px]',
    '4': 'col-span-12 md:col-span-3 h-[196px]',
  };

  return (
    <section className="py-24 bg-background">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ECFDF5] text-[#059669] text-sm font-medium mb-5">
            <Heart size={14} />
            {t('badge')}
          </div>
          <h2
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: '2.25rem',
              fontWeight: 800,
            }}
          >
            {title || t('titleFallback')}
          </h2>
          <p className="text-muted-foreground text-base max-w-[480px] mx-auto">
            {description || t('descriptionFallback')}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {(images?.data || []).map((img: any, i: number) => (
            <div
              key={img.id || i}
              className={`group relative overflow-hidden rounded-2xl bg-muted ${
                i === 0
                  ? 'col-span-12 md:col-span-6 row-span-2 h-[400px]'
                  : colClasses[columns] || colClasses['3']
              }`}
            >
              <img
                src={img.image?.url || img.url}
                alt={img.alt || img.caption || ''}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <span className="text-white text-sm font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                  {img.caption || t('photoFallback')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
