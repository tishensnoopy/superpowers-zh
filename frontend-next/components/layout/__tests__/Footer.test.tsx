import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '@/components/layout/Footer';
import type { Footer as FooterData, SiteSettings } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  getImageUrl: vi.fn(() => null),
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
    expect(screen.getByText('微信')).toBeInTheDocument();
    expect(screen.getByText('微博')).toBeInTheDocument();
    expect(screen.getByText('抖音')).toBeInTheDocument();
    expect(screen.getByText('QQ')).toBeInTheDocument();
  });

  it('social links have QR code images', async () => {
    render(<Footer footer={mockFooter} settings={mockSettings} />);

    await screen.findByText('微信');
    const socialLinks = screen.getByTestId('social-links');
    const qrImages = socialLinks.querySelectorAll('img');
    expect(qrImages.length).toBe(4);
    qrImages.forEach((img) => {
      expect(img).toHaveAttribute('src');
      expect(img).toHaveAttribute('alt');
    });
  });

  it('social links have hover scale effect on QR code container', async () => {
    render(<Footer footer={mockFooter} settings={mockSettings} />);

    await screen.findByText('微信');
    const socialLinks = screen.getByTestId('social-links');
    const qrContainers = socialLinks.querySelectorAll('a > div');
    qrContainers.forEach((container) => {
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
    expect(screen.getByText('微信')).toBeInTheDocument();
    expect(screen.getByText('微博')).toBeInTheDocument();
    expect(screen.getByText('抖音')).toBeInTheDocument();
    expect(screen.getByText('QQ')).toBeInTheDocument();
  });
});
