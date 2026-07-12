import Image from 'next/image';
import { getImageUrl } from '@/lib/api';

interface StrapiImageProps {
  src?: { url: string; alternativeText?: string } | null;
  alt?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  className?: string;
  sizes?: string;
}

export default function StrapiImage({
  src,
  alt,
  width,
  height,
  fill = false,
  priority = false,
  className,
  sizes,
}: StrapiImageProps) {
  const url = getImageUrl(src);
  if (!url) return null;

  if (fill) {
    return (
      <Image
        src={url}
        alt={alt || src?.alternativeText || ''}
        fill
        priority={priority}
        sizes={sizes || '100vw'}
        className={className}
      />
    );
  }

  return (
    <Image
      src={url}
      alt={alt || src?.alternativeText || ''}
      width={width || 800}
      height={height || 600}
      priority={priority}
      className={className}
    />
  );
}
