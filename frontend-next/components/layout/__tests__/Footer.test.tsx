import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '@/components/layout/Footer';
import type { Footer as FooterData, SiteSettings } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  getImageUrl: vi.fn((media: any) => media?.url ?? null),
  getSiteSettings: vi.fn(),
  getNavigationTree: vi.fn(),
  getFooter: vi.fn(),
}));

describe('Footer Social Links', () => {
  const mockSettings: SiteSettings = {
    id: 1,
    name: 'Test',
    phone: '400-123-4567',
  } as SiteSettings;

  const mockFooter: FooterData = {
    id: 1,
    documentId: 'abc',
    copyright: '© 2026 Test',
    socialLinks: [
      { id: 1, platform: 'wechat', url: '#', label: '微信' },
      { id: 2, platform: 'weibo', url: '#', label: '微博' },
      { id: 3, platform: 'douyin', url: '#', label: '抖音' },
      { id: 4, platform: 'qq', url: '#', label: 'QQ' },
    ],
    quickLinks: [],
  } as FooterData;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders social media links', async () => {
    render(<Footer footer={mockFooter} settings={mockSettings} />);

    await screen.findByText('关注我们');
    // S8 修复后：label 同时出现在容器 span 和标签 span 中，用 getAllByText
    expect(screen.getAllByText('微信').length).toBeGreaterThan(0);
    expect(screen.getAllByText('微博').length).toBeGreaterThan(0);
    expect(screen.getAllByText('抖音').length).toBeGreaterThan(0);
    expect(screen.getAllByText('QQ').length).toBeGreaterThan(0);
  });

  it('social links render text labels (S8: 不再使用外部 QR API 图片)', async () => {
    render(<Footer footer={mockFooter} settings={mockSettings} />);

    await screen.findByText('关注我们');
    const socialLinks = screen.getByTestId('social-links');
    // S8 修复后：用文字标签替代图片，避免对外部 QR API 的依赖
    const qrImages = socialLinks.querySelectorAll('img');
    expect(qrImages.length).toBe(0);
    const anchors = socialLinks.querySelectorAll('a');
    expect(anchors.length).toBe(4);
    // 每个 a 元素应包含 platform label 作为可访问名称
    anchors.forEach((a) => {
      expect(a).toHaveAttribute('title');
      expect(a.getAttribute('href')).toBeTruthy();
    });
  });

  it('social links have hover scale effect on label container', async () => {
    render(<Footer footer={mockFooter} settings={mockSettings} />);

    await screen.findByText('关注我们');
    const socialLinks = screen.getByTestId('social-links');
    const labelContainers = socialLinks.querySelectorAll('a > div');
    expect(labelContainers.length).toBe(4);
    labelContainers.forEach((container) => {
      expect(container).toHaveClass('group-hover:scale-110');
      expect(container.className).toContain('transition');
    });
  });

  it('renders default social links when API returns empty array', async () => {
    const emptyFooter: FooterData = {
      ...mockFooter,
      socialLinks: [],
    } as FooterData;

    render(<Footer footer={emptyFooter} settings={mockSettings} />);

    await screen.findByText('关注我们');
    expect(screen.getAllByText('微信').length).toBeGreaterThan(0);
    expect(screen.getAllByText('微博').length).toBeGreaterThan(0);
    expect(screen.getAllByText('抖音').length).toBeGreaterThan(0);
    expect(screen.getAllByText('QQ').length).toBeGreaterThan(0);
  });

  it('后台上传 logo 时品牌区渲染 logo 图片（而非首字母色块）', async () => {
    const settingsWithLogo = {
      ...mockSettings,
      logo: { url: '/uploads/brand-logo.png' },
    } as SiteSettings;

    render(<Footer footer={mockFooter} settings={settingsWithLogo} />);

    const logoImg = screen.getByAltText('Test');
    expect(logoImg).toBeInTheDocument();
    expect(logoImg.getAttribute('src')).toContain('brand-logo.png');
  });

  it('社交链接带 qrImage 时渲染二维码图片', async () => {
    const footerWithQr: FooterData = {
      ...mockFooter,
      socialLinks: [
        { id: 1, platform: 'wechat', label: '微信公众号', qrImage: { url: '/uploads/wechat-qr.png' } },
      ],
    } as unknown as FooterData;

    render(<Footer footer={footerWithQr} settings={mockSettings} />);

    await screen.findByText('关注我们');
    const socialLinks = screen.getByTestId('social-links');
    const imgs = socialLinks.querySelectorAll('img');
    expect(imgs.length).toBe(1);
    expect(imgs[0].getAttribute('src')).toContain('wechat-qr.png');
  });

  it('纯二维码条目（无 url）不作为链接渲染', async () => {
    const footerQrOnly: FooterData = {
      ...mockFooter,
      socialLinks: [
        { id: 1, platform: 'wechat', label: '扫码关注', qrImage: { url: '/uploads/wechat-qr.png' } },
      ],
    } as unknown as FooterData;

    render(<Footer footer={footerQrOnly} settings={mockSettings} />);

    await screen.findByText('关注我们');
    const socialLinks = screen.getByTestId('social-links');
    expect(socialLinks.querySelectorAll('a').length).toBe(0);
    expect(socialLinks.querySelectorAll('img').length).toBe(1);
  });
});
