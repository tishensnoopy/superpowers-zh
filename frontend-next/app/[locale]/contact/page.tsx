import { Phone, Mail, MessageCircle, Clock, MapPin } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { setRequestLocale } from 'next-intl/server';
import { getCampuses, getSiteSettings } from '@/lib/api';
import ContactForm from '@/components/sections/ContactForm';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(undefined, {
    title: '联系我们',
    description: '联系佑森小课堂，预约免费试听课程，查看各校区联系方式',
    canonicalUrl: '/contact',
  });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [campusesRes, settingsRes] = await Promise.all([
    getCampuses().catch(() => ({ data: [] as never[] })),
    getSiteSettings().catch(() => ({ data: null as any })),
  ]);

  const campuses = campusesRes.data || [];
  const settings = Array.isArray(settingsRes.data) ? settingsRes.data[0] : settingsRes.data;

  const infoCards = [
    { icon: Phone, label: '客服热线', value: settings?.phone || '400-888-XXXX', href: `tel:${settings?.phone || ''}` },
    { icon: Mail, label: '邮箱', value: settings?.email || 'contact@yousen.com', href: `mailto:${settings?.email || ''}` },
    { icon: MessageCircle, label: '微信咨询', value: settings?.wechat || 'yousen-edu' },
    { icon: Clock, label: '服务时间', value: '周一至周日 8:30-20:00' },
  ];

  return (
    <div className="pt-[120px] pb-16 min-h-screen bg-gradient-to-br from-[#FFF3E5] to-[#FFFCF8]">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="text-center mb-12">
          <h1
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
            }}
          >
            联系我们
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            填写下方表单预约免费试听课程，或通过以下方式直接联系我们
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {infoCards.map((card) => {
            const Icon = card.icon;
            const content = (
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow text-center h-full">
                <div className="w-12 h-12 rounded-xl bg-[#FFF3E5] flex items-center justify-center mx-auto mb-4">
                  <Icon size={22} className="text-[#F5851F]" />
                </div>
                <div className="text-xs text-muted-foreground mb-1">{card.label}</div>
                <div className="text-sm font-semibold text-[#1C2B3A] break-all">{card.value}</div>
              </div>
            );
            return card.href ? (
              <a key={card.label} href={card.href} className="block">{content}</a>
            ) : (
              <div key={card.label}>{content}</div>
            );
          })}
        </div>

        {campuses.length > 0 && (
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm mb-12">
            <h2
              className="text-[#1C2B3A] mb-5 flex items-center gap-2"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: '1.5rem',
                fontWeight: 700,
              }}
            >
              <MapPin size={22} className="text-[#F5851F]" />
              各校区联系方式
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campuses.map((campus: any) => (
                <div key={campus.id} className="p-4 rounded-xl border border-border bg-background">
                  <div className="font-semibold text-[#1C2B3A] mb-2">{campus.name}</div>
                  {campus.phone && (
                    <a
                      href={`tel:${campus.phone}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#F5851F] transition-colors mb-1"
                    >
                      <Phone size={14} />
                      {campus.phone}
                    </a>
                  )}
                  {campus.address && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                      <span>{campus.address}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <ContactForm section={{
          id: 0,
          __component: 'section.contact-form',
          title: '预约免费试听',
          description: '填写下方表单，我们将尽快联系您',
          submitText: '立即预约',
        }} />
      </div>
    </div>
  );
}
