import Link from 'next/link';
import { Phone, MapPin, Mail } from 'lucide-react';
import type { Footer as FooterData, SiteSettings, SocialLink } from '@/lib/api';

const DEFAULT_SOCIAL_LINKS: SocialLink[] = [
  { id: 1, platform: 'wechat', url: 'https://wechat.example.com', label: '微信' },
  { id: 2, platform: 'weibo', url: 'https://weibo.example.com', label: '微博' },
  { id: 3, platform: 'douyin', url: 'https://douyin.example.com', label: '抖音' },
  { id: 4, platform: 'qq', url: 'https://qq.example.com', label: 'QQ' },
];

const COURSE_LINKS = [
  { title: '幼小衔接全能班', url: '/courses/yousen-youxiao-xianjie' },
  { title: '课后托管班', url: '/courses/yousen-kehao-tuoguan' },
  { title: '全日制托班', url: '/courses/yousen-tuoban' },
];

const ABOUT_LINKS = [
  { title: '关于我们', url: '/about' },
  { title: '师资团队', url: '/teachers' },
  { title: '校区环境', url: '/campuses' },
  { title: '新闻资讯', url: '/news' },
];

function renderSocialLink(social: SocialLink) {
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=${encodeURIComponent(social.url)}`;

  return (
    <a
      key={social.id}
      href={social.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-1.5 group"
      title={social.label || social.platform}
    >
      <div className="w-16 h-16 bg-white rounded-lg p-0.5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg">
        <img
          src={qrCodeUrl}
          alt={`${social.label || social.platform}二维码`}
          className="w-full h-full rounded-md"
          loading="lazy"
        />
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
  const socialData = footer.socialLinks;
  const links =
    socialData && socialData.length > 0 ? socialData : DEFAULT_SOCIAL_LINKS;

  const quickLinks = footer.quickLinks && footer.quickLinks.length > 0
    ? footer.quickLinks
    : [
        { title: '常见问题', url: '/faq' },
        { title: '退费政策', url: '/refund-policy' },
        { title: '联系客服', url: '/contact' },
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
                {settings.name?.[0] || '佑'}
              </div>
              <div>
                <div
                  className="font-black text-[18px] leading-tight text-white"
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                >
                  {settings.name || '佑森小课堂'}
                </div>
                <div className="text-[10px] text-white/40 tracking-widest">{settings.slogan || '专注幼小衔接教育8年'}</div>
              </div>
            </div>
            <p className="text-white/55 text-sm leading-relaxed mb-6 max-w-[300px]">
              {footer.aboutText || '武汉佑森小课堂艺术培训学校有限公司，专注幼小衔接教育8年，6大校区遍布武汉三镇。'}
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
                  课程体系
                </h4>
                <ul className="space-y-3">
                  {COURSE_LINKS.map((link) => (
                    <li key={link.url}><Link href={link.url} className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">{link.title}</Link></li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 min-w-[120px]">
                <h4 className="text-white font-bold text-sm mb-5 pb-2 border-b border-white/10">
                  关于我们
                </h4>
                <ul className="space-y-3">
                  {ABOUT_LINKS.map((link) => (
                    <li key={link.url}><Link href={link.url} className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">{link.title}</Link></li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 min-w-[120px]">
                <h4 className="text-white font-bold text-sm mb-5 pb-2 border-b border-white/10">
                  帮助中心
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
                关注我们
              </h4>
              <div data-testid="social-links" className="flex flex-wrap gap-3">
                {links.map(renderSocialLink)}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/35 text-sm">
            {footer.copyright || '© 2026 佑森小课堂'}
            {settings.icp && <span className="mx-2">·</span>}
            {settings.icp && <span>{settings.icp}</span>}
            {settings.publicSecurityRecord && <span className="mx-2">·</span>}
            {settings.publicSecurityRecord && <span>{settings.publicSecurityRecord}</span>}
          </p>
          <div className="flex items-center gap-6 text-white/35 text-sm">
            <Link href="/privacy-policy" className="hover:text-white/60 transition-colors">隐私政策</Link>
            <Link href="/user-agreement" className="hover:text-white/60 transition-colors">用户协议</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
