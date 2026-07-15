'use client';

import { useState } from 'react';
import { Images } from 'lucide-react';
import StrapiImage from '@/components/ui/StrapiImage';
import type { Campus } from '@/lib/api';
import { useTranslations } from 'next-intl';

export default function CampusGallery({ campus }: { campus: Campus }) {
  const t = useTranslations('campuses');
  const galleryData = (campus.gallery ?? []).filter((item) => !!item?.url);

  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
      <h2
        className="text-[#1C2B3A] mb-5"
        style={{
          fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
          fontSize: '1.5rem',
          fontWeight: 700,
        }}
      >
        {t('galleryTitle')}
      </h2>

      {galleryData.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
          <Images size={40} className="mx-auto mb-3 opacity-40" />
          <p>{t('galleryUpdating')}</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="md:w-2/3">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted">
              <StrapiImage
                src={galleryData[activeIndex]}
                alt={t('galleryImageAlt', { index: activeIndex + 1 })}
                fill
                sizes="(max-width: 768px) 100vw, 66vw"
                className="object-cover"
              />
            </div>
          </div>
          {galleryData.length > 1 && (
            <div className="md:w-1/3 grid grid-cols-2 md:grid-cols-1 gap-3">
              {galleryData.map((item, index) => (
                <button
                  key={(item.url || '') + index}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={t('switchToImageAriaLabel', { index: index + 1 })}
                  className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all ${
                    index === activeIndex
                      ? 'border-[#F5851F] ring-2 ring-[#F5851F]/30'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <StrapiImage
                    src={item}
                    alt={t('thumbnailAlt', { index: index + 1 })}
                    fill
                    sizes="100px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
