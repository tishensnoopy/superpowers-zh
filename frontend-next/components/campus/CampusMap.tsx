'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface CampusMapProps {
  latitude?: number;
  longitude?: number;
  address?: string;
  name?: string;
}

const AMAP_KEY = process.env.NEXT_PUBLIC_AMAP_KEY || '1faffb1bce264c7661f0a3100320dc31';

function loadAmapScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window not available'));
      return;
    }
    const w = window as any;
    if (w.AMap && w.AMap.Map) {
      resolve();
      return;
    }
    if ((document as any)._amapLoading) {
      const check = () => {
        if (w.AMap && w.AMap.Map) resolve();
        else setTimeout(check, 100);
      };
      check();
      return;
    }
    (document as any)._amapLoading = true;
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load AMap script'));
    document.head.appendChild(script);
  });
}

export default function CampusMap({ latitude, longitude, address, name }: CampusMapProps) {
  const t = useTranslations('campuses');
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';

  useEffect(() => {
    if (!hasCoords || !containerRef.current) {
      setLoading(false);
      return;
    }

    let map: any;
    let destroyed = false;

    loadAmapScript()
      .then(() => {
        if (destroyed) return;
        const AMap = (window as any).AMap;
        if (!AMap) {
          setError('高德地图脚本加载失败');
          setLoading(false);
          return;
        }

        map = new AMap.Map(containerRef.current, {
          zoom: 15,
          center: new AMap.LngLat(longitude, latitude),
        });

        const marker = new AMap.Marker({
          position: new AMap.LngLat(longitude, latitude),
          title: name || address || '',
        });
        map.add(marker);

        if (address) {
          const infoWindow = new AMap.InfoWindow({
            content: `<div style="padding:4px 8px;font-size:14px;color:#1C2B3A;">${address}</div>`,
            offset: new AMap.Pixel(0, -30),
          });
          marker.on('click', () => infoWindow.open(map, marker.getPosition()));
        }

        setLoading(false);
      })
      .catch((err) => {
        if (destroyed) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      destroyed = true;
      if (map) {
        try {
          map.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [hasCoords, latitude, longitude, address, name]);

  return (
    <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
      <h2
        className="text-[#1C2B3A] mb-5 flex items-center gap-2"
        style={{
          fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
          fontSize: '1.5rem',
          fontWeight: 700,
        }}
      >
        <MapPin size={22} className="text-[#F5851F]" />
        {t('mapTitle')}
      </h2>
      {hasCoords ? (
        <div
          ref={containerRef}
          className="w-full rounded-xl border border-border overflow-hidden"
          style={{ height: 320 }}
        >
          {loading && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30 text-muted-foreground">
              <MapPin size={40} className="mb-3 opacity-40 animate-bounce" />
              <p className="text-sm">{t('mapLoading')}</p>
            </div>
          )}
          {error && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30 text-muted-foreground">
              <MapPin size={40} className="mb-3 opacity-40" />
              <p className="text-sm">{t('mapError')}</p>
              <p className="text-xs mt-1 opacity-70">{error}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-64 flex flex-col items-center justify-center bg-muted/30 rounded-xl border border-dashed border-border text-muted-foreground">
          <MapPin size={40} className="mb-3 opacity-40" />
          <p className="text-sm">{t('noMap')}</p>
          <p className="text-xs mt-1 opacity-70">{t('noMapHint')}</p>
        </div>
      )}
    </div>
  );
}
