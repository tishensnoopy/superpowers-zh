import { MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import StrapiImage from '@/components/ui/StrapiImage';
import type { Campus } from '@/lib/api';

export default function CampusCard({ campus }: { campus: Campus }) {
  const { name, slug, address, phone, coverImage } = campus;

  return (
    <Link
      href={`/campuses/${slug}`}
      className="group block bg-card rounded-2xl overflow-hidden border border-border shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#F5851F] hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {coverImage?.url ? (
          <StrapiImage
            src={coverImage}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
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
