import { useState } from 'react';
import { Images } from 'lucide-react';
import type { Campus } from '../../lib/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337';

function getImageUrl(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
}

export default function CampusGallery({ campus }: { campus: Campus }) {
  const galleryData = campus.attributes.gallery?.data ?? [];
  const images = galleryData
    .map((item) => getImageUrl(item.attributes?.url))
    .filter((url): url is string => !!url);

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
        校区环境
      </h2>

      {images.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
          <Images size={40} className="mx-auto mb-3 opacity-40" />
          <p>图片更新中，敬请期待</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="md:w-2/3">
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-muted">
              <img
                src={images[activeIndex]}
                alt={`校区环境图片 ${activeIndex + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          {images.length > 1 && (
            <div className="md:w-1/3 grid grid-cols-2 md:grid-cols-1 gap-3">
              {images.map((url, index) => (
                <button
                  key={url + index}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`切换到图片 ${index + 1}`}
                  className={`aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all ${
                    index === activeIndex
                      ? 'border-[#F5851F] ring-2 ring-[#F5851F]/30'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={url}
                    alt={`缩略图 ${index + 1}`}
                    className="w-full h-full object-cover"
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
