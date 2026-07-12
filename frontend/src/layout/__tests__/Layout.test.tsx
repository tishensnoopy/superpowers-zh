import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../Layout';

const mockGetSiteSettings = vi.fn();
const mockGetNavigationTree = vi.fn();
const mockGetFooter = vi.fn();

vi.mock('../../lib/api', () => ({
  getSiteSettings: () => mockGetSiteSettings(),
  getNavigationTree: () => mockGetNavigationTree(),
  getFooter: () => mockGetFooter(),
}));

describe('Footer Social Links', () => {
  beforeEach(() => {
    mockGetSiteSettings.mockResolvedValue({
      data: [{ attributes: { name: 'Test', phone: '400-123-4567' } }],
    });
    mockGetNavigationTree.mockResolvedValue({ data: [] });
    mockGetFooter.mockResolvedValue({
      data: {
        attributes: {
          copyright: '© 2026 Test',
          socialLinks: {
            data: [
              { id: 1, attributes: { platform: 'wechat', url: '#', label: '微信' } },
              { id: 2, attributes: { platform: 'weibo', url: '#', label: '微博' } },
              { id: 3, attributes: { platform: 'douyin', url: '#', label: '抖音' } },
              { id: 4, attributes: { platform: 'qq', url: '#', label: 'QQ' } },
            ],
          },
          quickLinks: { data: [] },
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders social media links', async () => {
    render(
      <MemoryRouter>
        <Layout children={<div>Test</div>} />
      </MemoryRouter>
    );

    await screen.findByText('关注我们');
    expect(screen.getByText('微信')).toBeInTheDocument();
    expect(screen.getByText('微博')).toBeInTheDocument();
    expect(screen.getByText('抖音')).toBeInTheDocument();
    expect(screen.getByText('QQ')).toBeInTheDocument();
  });

  it('social links have QR code images', async () => {
    render(
      <MemoryRouter>
        <Layout children={<div>Test</div>} />
      </MemoryRouter>
    );

    await screen.findByText('微信');
    const socialLinks = screen.getByTestId('social-links');
    const qrImages = socialLinks.querySelectorAll('img');
    expect(qrImages.length).toBe(4);
    qrImages.forEach(img => {
      expect(img).toHaveAttribute('src');
      expect(img).toHaveAttribute('alt');
    });
  });

  it('social links have hover scale effect on QR code container', async () => {
    render(
      <MemoryRouter>
        <Layout children={<div>Test</div>} />
      </MemoryRouter>
    );

    await screen.findByText('微信');
    const socialLinks = screen.getByTestId('social-links');
    const qrContainers = socialLinks.querySelectorAll('a > div');
    qrContainers.forEach(container => {
      expect(container).toHaveClass('group-hover:scale-110');
      expect(container.className).toContain('transition');
    });
  });

  it('renders default social links when API returns empty array', async () => {
    mockGetFooter.mockResolvedValue({
      data: [{ attributes: { socialLinks: { data: [] }, quickLinks: { data: [] } } }],
    });

    render(
      <MemoryRouter>
        <Layout children={<div>Test</div>} />
      </MemoryRouter>
    );

    await screen.findByText('关注我们');
    expect(screen.getByText('微信')).toBeInTheDocument();
    expect(screen.getByText('微博')).toBeInTheDocument();
    expect(screen.getByText('抖音')).toBeInTheDocument();
    expect(screen.getByText('QQ')).toBeInTheDocument();
  });
});

describe('Navigation Dropdown', () => {
  beforeEach(() => {
    mockGetSiteSettings.mockResolvedValue({
      data: [{ attributes: { name: 'Test' } }],
    });
    mockGetNavigationTree.mockResolvedValue({
      data: [
        {
          id: 1,
          attributes: {
            name: '课程体系',
            url: '/courses',
            children: {
              data: [
                { id: 11, attributes: { name: '语言启蒙', url: '/courses/language' } },
                { id: 12, attributes: { name: '数学思维', url: '/courses/math' } },
              ],
            },
          },
        },
        {
          id: 2,
          attributes: {
            name: '首页',
            url: '/',
            children: { data: [] },
          },
        },
      ],
    });
    mockGetFooter.mockResolvedValue({
      data: [{ attributes: { socialLinks: { data: [] }, quickLinks: { data: [] } } }],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders dropdown menu for items with children', async () => {
    render(
      <MemoryRouter>
        <Layout children={<div>Test</div>} />
      </MemoryRouter>
    );

    await screen.findByRole('navigation');
    const dropdownBtns = screen.getAllByRole('button');
    const navBtn = dropdownBtns.find(btn => btn.textContent?.includes('课程体系'));
    expect(navBtn).toBeInTheDocument();
  });

  it('dropdown items have correct links', async () => {
    render(
      <MemoryRouter>
        <Layout children={<div>Test</div>} />
      </MemoryRouter>
    );

    await screen.findByRole('navigation');
    const navLinks = screen.getAllByRole('link');
    const langLink = navLinks.find(link => link.textContent?.includes('语言启蒙'));
    expect(langLink).toBeInTheDocument();
  });
});
