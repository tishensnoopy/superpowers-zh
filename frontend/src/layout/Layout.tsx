import { useState, useEffect } from 'react';
import { Phone, Menu, X, MapPin, Mail, ChevronDown } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getSiteSettings, getNavigation, getFooter } from '../lib/api';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState<any>(null);
  const [navigation, setNavigation] = useState<any[]>([]);
  const [footer, setFooter] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  const handleMobileNavClick = (url: string) => {
    console.log('[Nav] handleMobileNavClick triggered, url:', url);
    console.log('[Nav] Before - mobileMenuOpen:', mobileMenuOpen, 'dropdownOpen:', dropdownOpen);
    setMobileMenuOpen(false);
    setDropdownOpen(null);
    navigate(url);
    console.log('[Nav] After - mobileMenuOpen set to false, navigating to:', url);
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const [settingsRes, navRes, footerRes] = await Promise.all([
          getSiteSettings(),
          getNavigation(),
          getFooter(),
        ]);
        setSiteSettings(Array.isArray(settingsRes.data) ? settingsRes.data[0] : settingsRes.data);
        setNavigation(navRes.data);
        setFooter(Array.isArray(footerRes.data) ? footerRes.data[0] : footerRes.data);
      } catch (err) {
        console.warn('Failed to fetch global data:', err);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    console.log('[Nav] Location changed:', location.pathname);
    console.log('[Nav] Closing mobile menu and dropdown due to page change');
    setMobileMenuOpen(false);
    setDropdownOpen(null);
  }, [location.pathname]);

  const settings = siteSettings?.attributes || {};
  const footerAttrs = footer?.attributes || {};

  const isActive = (url: string) => {
    if (url === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(url);
  };

  const handleDropdownToggle = (id: number) => {
    console.log('[Nav] handleDropdownToggle called, id:', id, 'current dropdownOpen:', dropdownOpen);
    setDropdownOpen(dropdownOpen === id ? null : id);
  };

  const handleDropdownMouseEnter = (id: number) => {
    console.log('[Nav] handleDropdownMouseEnter called, id:', id);
    setDropdownOpen(id);
  };

  const handleDropdownMouseLeave = () => {
    console.log('[Nav] handleDropdownMouseLeave called, closing dropdown');
    setDropdownOpen(null);
  };

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
    >
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-[1400px] mx-auto px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-black shadow-sm"
              style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
            >
              {settings.name?.[0] || '启'}
            </div>
            <div>
              <div className="font-black text-[18px] leading-tight text-[#1C2B3A]" style={{ fontFamily: "'Nunito', sans-serif" }}>
                {settings.name || '启航幼小'}
              </div>
              <div className="text-[10px] text-muted-foreground tracking-widest">EDUCATION</div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {navigation.map((item: any) => {
              const itemAttrs = item.attributes || item;
              const hasChildren = itemAttrs.children?.data?.length > 0;
              const active = isActive(itemAttrs.url);

              if (hasChildren) {
                return (
                  <div
                    key={item.id}
                    className="relative"
                    onMouseEnter={() => handleDropdownMouseEnter(item.id)}
                    onMouseLeave={handleDropdownMouseLeave}
                  >
                    <button
                      className={`flex items-center gap-1 px-4 py-2 text-sm rounded-lg transition-all duration-200 ${
                        active
                          ? 'text-[#F5851F] bg-[#FFF3E5]'
                          : 'text-[#4A5568] hover:text-[#F5851F] hover:bg-[#FFF3E5]'
                      }`}
                      onClick={() => handleDropdownToggle(item.id)}
                    >
                      {itemAttrs.name}
                      <ChevronDown size={14} className={`transition-transform duration-200 ${dropdownOpen === item.id ? 'rotate-180' : ''}`} />
                    </button>
                    {dropdownOpen === item.id && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-border py-2 min-w-[180px] z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        {itemAttrs.children.data.map((child: any) => {
                          const childAttrs = child.attributes || child;
                          return (
                            <Link
                              key={child.id}
                              to={childAttrs.url}
                              className={`block px-4 py-2.5 text-sm transition-all duration-200 ${
                                isActive(childAttrs.url)
                                  ? 'text-[#F5851F] bg-[#FFF3E5]'
                                  : 'text-[#4A5568] hover:text-[#F5851F] hover:bg-[#FFF3E5]'
                              }`}
                            >
                              {childAttrs.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.id}
                  to={itemAttrs.url}
                  className={`px-4 py-2 text-sm rounded-lg transition-all duration-200 ${
                    active
                      ? 'text-[#F5851F] bg-[#FFF3E5] font-medium'
                      : 'text-[#4A5568] hover:text-[#F5851F] hover:bg-[#FFF3E5]'
                  }`}
                >
                  {itemAttrs.name}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {settings.phone && (
              <a
                href={`tel:${settings.phone}`}
                className="hidden md:flex items-center gap-2 text-sm text-[#4A5568]"
              >
                <Phone size={15} className="text-[#F5851F]" />
                <span className="font-medium">{settings.phone}</span>
              </a>
            )}
            <Link
              to="/contact"
              className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.03]"
              style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
            >
              预约免费试听
            </Link>
            <button
              className="lg:hidden p-2 rounded-lg text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-border px-8 py-4 flex flex-col gap-1">
            {navigation.map((item: any) => {
              const itemAttrs = item.attributes || item;
              const hasChildren = itemAttrs.children?.data?.length > 0;
              const active = isActive(itemAttrs.url);

              if (hasChildren) {
                return (
                  <div key={item.id} className="relative">
                    <button
                      className={`flex items-center justify-between w-full py-2.5 text-sm transition-colors ${
                        active ? 'text-[#F5851F] font-medium' : 'text-foreground'
                      }`}
                      onClick={() => handleDropdownToggle(item.id)}
                    >
                      <span>{itemAttrs.name}</span>
                      <ChevronDown size={16} className={`transition-transform duration-200 ${dropdownOpen === item.id ? 'rotate-180' : ''}`} />
                    </button>
                    {dropdownOpen === item.id && (
                      <div className="pl-6 mt-1 space-y-1">
                        {itemAttrs.children.data.map((child: any) => {
                          const childAttrs = child.attributes || child;
                          return (
                            <button
                              key={child.id}
                              onClick={() => handleMobileNavClick(childAttrs.url)}
                              className={`block w-full text-left py-2 text-sm transition-colors ${
                                isActive(childAttrs.url)
                                  ? 'text-[#F5851F] font-medium'
                                  : 'text-muted-foreground hover:text-[#F5851F]'
                              }`}
                            >
                              {childAttrs.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => handleMobileNavClick(itemAttrs.url)}
                  className={`block w-full text-left py-2.5 text-sm transition-colors ${
                    active ? 'text-[#F5851F] font-medium' : 'text-foreground hover:text-[#F5851F]'
                  }`}
                >
                  {itemAttrs.name}
                </button>
              );
            })}
            <button
              onClick={() => handleMobileNavClick('/contact')}
              className="mt-3 py-3 rounded-xl text-white text-sm font-semibold text-center"
              style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
            >
              预约免费试听
            </button>
          </div>
        )}
      </header>

      <main>{children}</main>

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

            {(footerAttrs.quickLinks?.data || []).map((group: any) => (
              <div key={group.id} className="col-span-6 sm:col-span-4 lg:col-span-2">
                <h4 className="text-white font-bold text-sm mb-5 pb-2 border-b border-white/10">
                  {group.name || '链接'}
                </h4>
                <ul className="space-y-3">
                  {group.links?.map((link: any) => (
                    <li key={link.name}>
                      <a href={link.url} className="text-white/50 text-sm hover:text-[#F5851F] transition-colors">
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="col-span-12 lg:col-span-2">
              <h4 className="text-white font-bold text-sm mb-5 pb-2 border-b border-white/10">
                关注我们
              </h4>
              <div data-testid="social-links" className="flex items-center gap-4">
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-[#F5851F] hover:bg-white/20 transition-all duration-300 hover:scale-110">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.322-1.223a.49.49 0 01.177-.554C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.269-.03-.407-.032zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.969-.982z"/>
                  </svg>
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-[#F5851F] hover:bg-white/20 transition-all duration-300 hover:scale-110">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
                  </svg>
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-[#F5851F] hover:bg-white/20 transition-all duration-300 hover:scale-110">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                  </svg>
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-[#F5851F] hover:bg-white/20 transition-all duration-300 hover:scale-110">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/35 text-sm">
              {footerAttrs.copyright || '© 2026 启航幼小教育集团'}
              {settings.icp && <span className="mx-2">·</span>}
              {settings.icp && <span>{settings.icp}</span>}
              {settings.publicSecurityRecord && <span className="mx-2">·</span>}
              {settings.publicSecurityRecord && <span>{settings.publicSecurityRecord}</span>}
            </p>
            <div className="flex items-center gap-6 text-white/35 text-sm">
              <a href="#" className="hover:text-white/60 transition-colors">隐私政策</a>
              <a href="#" className="hover:text-white/60 transition-colors">用户协议</a>
              <a href="#" className="hover:text-white/60 transition-colors">举报中心</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
