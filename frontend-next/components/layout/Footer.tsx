'use client';

import { Link } from '@/i18n/navigation';
import { Phone, MapPin, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Footer as FooterData, SiteSettings, SocialLink } from '@/lib/api';

function renderSocialLink(social: SocialLink) {
  return (
    <a
      key={social.id}
      href={social.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-1.5 group"
      title={social.label || social.platform}
    >
      <div className="w-16 h-16 bg-white/10 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:bg-white/20">
        <span className="text-white/80 text-xs font-medium text-center px-1">
          {social.label || social.platform}
        </span>
      </div>
      <span className="text-white/60 text-xs group-hover:text-white transition-colors">
        {social.label || social.platform}
      </span>
    </a>
  );
}

export default function Footer({
  footer,
  settings,
}: {
  footer: FooterData;
  settings: SiteSettings;
}) {
  const t = useTranslations('footer');

  const DEFAULT_SOCIAL_LINKS: SocialLink[] = [
    { id: 1, platform: 'wechat', url: 'https://wechat.example.com', label: t('wechat') },
    { id: 2, platform: 'weibo', url: 'https://weibo.example.com', label: t('weibo') },
    { id: 3, platform: 'douyin', url: 'https://douyin.example.com', label: t('douyin') },
    { id: 4, platform: 'qq', url: 'https://qq.example.com', label: t('qq') },
  ];

  const COURSE_LINKS = [
    { title: t('courseFullClass'), url: '/courses/yousen-youxiao-xianjie' },
    { title: t('courseAfterSchool'), url: '/courses/yousen-kehao-tuoguan' },
    { title: t('courseFullTimeDaycare'), url: '/courses/yousen-tuoban' },
  ];

  const ABOUT_LINKS = [
    { title: t('aboutUs'), url: '/about' },
    { title: t('teachers'), url: '/teachers' },
    { title: t('campuses'), url: '/campuses' },
    { title: t('newsInfo'), url: '/news' },
  ];

  const socialData = footer.socialLinks;
  const links =
    socialData && socialData.length > 0 ? socialData : DEFAULT_SOCIAL_LINKS;

  const quickLinks = footer.quickLinks && footer.quickLinks.length > 0
    ? footer.quickLinks
    : [
        { title: t('faq'), url: '/faq' },
        { title: t('refundPolicy'), url: '/refund-policy' },
        { title: t('privacyPolicy'), url: '/privacy-policy' },
        { title: t('userAgreement'), url: '/user-agreement' },
        { title: t('contactService'), url: '/contact' },
      ];

  return (
    <footer className="bg-[#111827] text-white">
      <div className="max-w-[1400px] mx-auto px-8 py-16">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-4">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-black"
                style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
              >
                {settings.name?.[0] || t('brandNameFallback')[0]}
              </div>
              <div>
                <div
                  className="font-black text-[18px] leading-tight text-white"
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                >
                  {settings.name || t('brandNameFallback')}
                </div>
                <div className="text-[10px] text-white/40 tracking-widest">{settings.slogan || t('sloganFallback')}</div>
              </div>
            </div>
            <p className="text-white/55 text-sm leading-relaxed mb-6 max-w-[300px]">
              {footer.aboutText || t('aboutTextFallback')}
            </p>
            <div className="space-y-3">
              {settings.address && (
                <div className="flex items-center gap-3 text-white/60 text-sm">
                  <MapPin size={15} className="text-[#F5851F] shrink-0" />
                  {settings.address}
                </div>
              )}
              {settings.phone && (
                <div className="flex items-center gap-3 text-white/60 text-sm">
                  <Phone size={15} className="text-[#F5851F] shrink-0" />
                  {settings.phone}
                </div>
              )}
              {settings.email && (
                <div className="flex items-center gap-3 text-white/60 text-sm">
                  <Mail size={15} className="text-[#F5851F] shrink-0" />
                  {settings.email}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-6">
            <div className="flex flex-wrap gap-8">
              <div className="flex-1 min-w-[120px]">
                <h4 className="text-white font-bold text-sm mb-5 pb-2 border-b border-white/10">
                  {t('courseSystem')}
                </h4>
                <ul className="space-y-3">
                  {COURSE_LINKS.map((link) => (
                    <li key={link.url}><Link href={link.url} className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">{link.title}</Link></li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 min-w-[120px]">
                <h4 className="text-white font-bold text-sm mb-5 pb-2 border-b border-white/10">
                  {t('aboutUs')}
                </h4>
                <ul className="space-y-3">
                  {ABOUT_LINKS.map((link) => (
                    <li key={link.url}><Link href={link.url} className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">{link.title}</Link></li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 min-w-[120px]">
                <h4 className="text-white font-bold text-sm mb-5 pb-2 border-b border-white/10">
                  {t('helpCenter')}
                </h4>
                <ul className="space-y-3">
                  {quickLinks.map((link: any) => (
                    <li key={link.url}><Link href={link.url} className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">{link.title}</Link></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {links.length > 0 && (
            <div className="col-span-12 lg:col-span-2">
              <h4 className="text-white font-bold text-sm mb-5 pb-2 border-b border-white/10">
                {t('followUs')}
              </h4>
              <div data-testid="social-links" className="flex flex-wrap gap-3">
                {links.map(renderSocialLink)}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/35 text-sm">
            {footer.copyright || t('copyrightFallback')}
            {settings.icp && <span className="mx-2">·</span>}
            {settings.icp && <span>{settings.icp}</span>}
            {settings.publicSecurityRecord && <span className="mx-2">·</span>}
            {settings.publicSecurityRecord && <span>{settings.publicSecurityRecord}</span>}
          </p>
          <div className="flex items-center gap-6 text-white/35 text-sm">
            <Link href="/privacy-policy" className="hover:text-white/60 transition-colors">{t('privacyPolicy')}</Link>
            <Link href="/user-agreement" className="hover:text-white/60 transition-colors">{t('userAgreement')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
