import { Phone, MapPin, Mail } from 'lucide-react';
import type { Footer as FooterData, SiteSettings, SocialLink } from '@/lib/api';

const DEFAULT_SOCIAL_LINKS: SocialLink[] = [
  { id: 1, platform: 'wechat', url: 'https://wechat.example.com', label: '微信' },
  { id: 2, platform: 'weibo', url: 'https://weibo.example.com', label: '微博' },
  { id: 3, platform: 'douyin', url: 'https://douyin.example.com', label: '抖音' },
  { id: 4, platform: 'qq', url: 'https://qq.example.com', label: 'QQ' },
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
                {settings.name?.[0] || '启'}
              </div>
              <div>
                <div
                  className="font-black text-[18px] leading-tight text-white"
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                >
                  {settings.name || '启航幼小教育'}
                </div>
                <div className="text-[10px] text-white/40 tracking-widest">EDUCATION</div>
              </div>
            </div>
            <p className="text-white/55 text-sm leading-relaxed mb-6 max-w-[300px]">
              专注幼小衔接教育8年，以专业、安全、温暖的理念陪伴每一个孩子顺利开启人生第一个重要阶段。
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
                  <li><a href="/courses/language" className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">语言启蒙</a></li>
                  <li><a href="/courses/math" className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">数学思维</a></li>
                  <li><a href="/courses/english" className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">英语口语</a></li>
                  <li><a href="/courses/comprehensive" className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">综合素养</a></li>
                </ul>
              </div>
              <div className="flex-1 min-w-[120px]">
                <h4 className="text-white font-bold text-sm mb-5 pb-2 border-b border-white/10">
                  关于我们
                </h4>
                <ul className="space-y-3">
                  <li><a href="/about/school" className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">学校介绍</a></li>
                  <li><a href="/about/philosophy" className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">办学理念</a></li>
                  <li><a href="/team" className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">师资团队</a></li>
                  <li><a href="/campuses" className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">校区环境</a></li>
                </ul>
              </div>
              <div className="flex-1 min-w-[120px]">
                <h4 className="text-white font-bold text-sm mb-5 pb-2 border-b border-white/10">
                  帮助中心
                </h4>
                <ul className="space-y-3">
                  <li><a href="#" className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">常见问题</a></li>
                  <li><a href="#" className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">预约流程</a></li>
                  <li><a href="/refund-policy" className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">退费政策</a></li>
                  <li><a href="/contact" className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">联系客服</a></li>
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
            {footer.copyright || '© 2026 启航幼小教育集团'}
            {settings.icp && <span className="mx-2">·</span>}
            {settings.icp && <span>{settings.icp}</span>}
            {settings.publicSecurityRecord && <span className="mx-2">·</span>}
            {settings.publicSecurityRecord && <span>{settings.publicSecurityRecord}</span>}
          </p>
          <div className="flex items-center gap-6 text-white/35 text-sm">
            <a href="/privacy-policy" className="hover:text-white/60 transition-colors">隐私政策</a>
            <a href="/user-agreement" className="hover:text-white/60 transition-colors">用户协议</a>
            <a href="#" className="hover:text-white/60 transition-colors">举报中心</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
