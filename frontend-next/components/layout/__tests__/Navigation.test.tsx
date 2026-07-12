import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Navigation from '@/components/layout/Navigation';
import type { NavigationItem, SiteSettings } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  getImageUrl: vi.fn(() => null),
  getSiteSettings: vi.fn(),
  getNavigationTree: vi.fn(),
  getFooter: vi.fn(),
}));

describe('Navigation Dropdown', () => {
  const mockSettings: SiteSettings = {
    id: 1,
    name: 'Test',
    phone: '400-123-4567',
  } as SiteSettings;

  const mockNavigation: NavigationItem[] = [
    {
      id: 1,
      name: '课程体系',
      url: '/courses',
      position: 1,
      isActive: true,
      children: [
        { id: 11, name: '语言启蒙', url: '/courses/language', position: 1, isActive: true },
        { id: 12, name: '数学思维', url: '/courses/math', position: 2, isActive: true },
      ],
    },
    {
      id: 2,
      name: '首页',
      url: '/',
      position: 2,
      isActive: true,
      children: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders dropdown menu for items with children', async () => {
    render(<Navigation navigation={mockNavigation} settings={mockSettings} />);

    await screen.findByRole('navigation');
    const dropdownBtns = screen.getAllByRole('button');
    const navBtn = dropdownBtns.find((btn) => btn.textContent?.includes('课程体系'));
    expect(navBtn).toBeInTheDocument();
  });

  it('dropdown items have correct links', async () => {
    render(<Navigation navigation={mockNavigation} settings={mockSettings} />);

    await screen.findByRole('navigation');

    // Click the dropdown button to open it
    const dropdownBtn = screen.getAllByRole('button').find((btn) =>
      btn.textContent?.includes('课程体系')
    );
    fireEvent.click(dropdownBtn!);

    const navLinks = screen.getAllByRole('link');
    const langLink = navLinks.find((link) => link.textContent?.includes('语言启蒙'));
    expect(langLink).toBeInTheDocument();
  });
});
