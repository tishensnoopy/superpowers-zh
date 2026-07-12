import { MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Campus } from '../../lib/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337';

function getImageUrl(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
}

export default function CampusCard({ campus }: { campus: Campus }) {
  const { name, slug, address, phone, coverImage } = campus;
  const imageUrl = getImageUrl(coverImage?.url);

  return (
    <Link
      to={`/campuses/${slug}`}
      className="group block bg-card rounded-2xl overflow-hidden border border-border shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#F5851F] hover:shadow-lg"
    >
      <div className="aspect-[16/9] overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
          />
        )}
      </div>
      <div className="p-5">
        <h3
          className="text-[#1C2B3A] font-bold mb-3"
          style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif", fontSize: '1.25rem' }}
        >
          {name}
        </h3>
        <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
          <MapPin size={16} className="flex-shrink-0 mt-0.5" />
          <span>{address}</span>
        </div>
        {phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone size={16} className="flex-shrink-0" />
            <span>{phone}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
