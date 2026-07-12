import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../Layout';

vi.mock('../../lib/api', () => ({
  getSiteSettings: vi.fn().mockResolvedValue({ data: [{
    name: '启航幼小教育',
    phone: '400-123-4567',
    address: '北京市朝阳区',
    email: 'contact@example.com'
  }] }),
  getNavigation: vi.fn().mockResolvedValue({ data: [] }),
  getFooter: vi.fn().mockResolvedValue({ data: [{
    attributes: {
      copyright: '© 2026 启航幼小教育集团',
      quickLinks: {
        data: [
          { id: 1, name: '关于我们', links: [{ name: '公司简介', url: '/about' }] },
          { id: 2, name: '课程中心', links: [{ name: '幼小衔接', url: '/courses' }] },
          { id: 3, name: '师资团队', links: [{ name: '教师介绍', url: '/teachers' }] },
          { id: 4, name: '联系我们', links: [{ name: '在线咨询', url: '/contact' }] },
        ]
      }
    }
  }] }),
}));

describe('Layout Footer', () => {
  it('should render social media links with hover scale effect', async () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MemoryRouter>
    );

    await screen.findByText('关于我们');

    const socialLinks = screen.getByTestId('social-links');
    expect(socialLinks).toBeInTheDocument();

    const socialIcons = socialLinks.querySelectorAll('a');
    expect(socialIcons.length).toBeGreaterThan(0);

    socialIcons.forEach(icon => {
      expect(icon).toHaveClass('duration-300', 'hover:scale-110');
      expect(icon.className).toContain('transition');
    });
  });
});