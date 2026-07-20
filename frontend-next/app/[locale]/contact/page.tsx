import { Phone, Mail, MessageCircle, Clock, MapPin, User } from 'lucide-react';
import { buildMetadata, buildJsonLd, buildBreadcrumbSchema } from '@/lib/seo';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getCampuses, getSiteSettings, type Locale } from '@/lib/api';
import ContactForm from '@/components/sections/ContactForm';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('contact');
  return buildMetadata(undefined, {
    title: t('title'),
    description: t('description'),
    canonicalUrl: '/contact',
  }, { locale: locale as 'zh-CN' | 'en-US', path: '/contact' });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact');
  const tSeo = await getTranslations('seo');
  const tContactForm = await getTranslations('sections.contactForm');
  const [campusesRes, settingsRes] = await Promise.all([
    getCampuses(locale as Locale).catch(() => ({ data: [] as never[] })),
    getSiteSettings(locale as Locale).catch(() => ({ data: null as any })),
  ]);

  const campuses = campusesRes.data || [];
  const settings = Array.isArray(settingsRes.data) ? settingsRes.data[0] : settingsRes.data;

  const infoCards = [
    { icon: Phone, label: t('hotline'), value: settings?.phone || '400-888-XXXX', href: `tel:${settings?.phone || ''}` },
    { icon: Mail, label: t('email'), value: settings?.email || 'contact@yousen.com', href: `mailto:${settings?.email || ''}` },
    { icon: MessageCircle, label: t('wechatConsult'), value: settings?.wechat || 'yousen-edu' },
    { icon: Clock, label: t('serviceHours'), value: t('serviceHoursValue') },
  ];

  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: tSeo('home'), url: '/' },
      { name: tSeo('contact'), url: '/contact' },
    ],
    locale as Locale
  );

  return (
    <div className="pt-[120px] pb-16 min-h-screen bg-gradient-to-br from-[#FFF3E5] to-[#FFFCF8]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(breadcrumbSchema) }}
      />
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="text-center mb-12">
          <h1
            className="text-[var(--brand-dark,#1C2B3A)] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
            }}
          >
            {t('title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {infoCards.map((card) => {
            const Icon = card.icon;
            const content = (
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow text-center h-full">
                <div className="w-12 h-12 rounded-xl bg-[#FFF3E5] flex items-center justify-center mx-auto mb-4">
                  <Icon size={22} className="text-[var(--brand-primary,#F5851F)]" />
                </div>
                <div className="text-xs text-muted-foreground mb-1">{card.label}</div>
                <div className="text-sm font-semibold text-[var(--brand-dark,#1C2B3A)] break-all">{card.value}</div>
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
              className="text-[var(--brand-dark,#1C2B3A)] mb-5 flex items-center gap-2"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: '1.5rem',
                fontWeight: 700,
              }}
            >
              <MapPin size={22} className="text-[var(--brand-primary,#F5851F)]" />
              {t('campusContactTitle')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campuses.map((campus: any) => (
                <div key={campus.id} className="p-4 rounded-xl border border-border bg-background">
                  <div className="font-semibold text-[var(--brand-dark,#1C2B3A)] mb-2">{campus.name}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <User size={14} />
                    {campus.contactPerson || '—'}
                  </div>
                  {campus.phone ? (
                    <a
                      href={`tel:${campus.phone}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--brand-primary,#F5851F)] transition-colors mb-1"
                    >
                      <Phone size={14} />
                      {campus.phone}
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Phone size={14} />
                      —
                    </div>
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
          title: tContactForm('titleFallback'),
          description: tContactForm('descriptionFallback'),
          submitText: tContactForm('submitTextFallback'),
        }} />
      </div>
    </div>
  );
}
