import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CampusGallery from '../CampusGallery';

const mockGallery = {
  id: 1,
  name: '朝阳校区',
  slug: 'chaoyang',
  gallery: [
    { url: '/uploads/gallery-1.jpg' },
    { url: '/uploads/gallery-2.jpg' },
    { url: '/uploads/gallery-3.jpg' },
  ],
};

describe('CampusGallery 组件', () => {
  it('渲染标题', () => {
    render(<CampusGallery campus={mockGallery as any} />);
    expect(screen.getByRole('heading', { name: '校区环境' })).toBeInTheDocument();
  });

  it('默认显示第一张图为大图', () => {
    render(<CampusGallery campus={mockGallery as any} />);
    const mainImage = screen.getByAltText('校区环境图片 1');
    expect(mainImage).toHaveAttribute('src', expect.stringContaining('/uploads/gallery-1.jpg'));
  });

  it('渲染所有小图缩略图', () => {
    render(<CampusGallery campus={mockGallery as any} />);
    const thumbs = screen.getAllByRole('button', { name: /切换到图片/ });
    expect(thumbs).toHaveLength(3);
  });

  it('点击小图切换大图', () => {
    render(<CampusGallery campus={mockGallery as any} />);
    const thumb2 = screen.getByRole('button', { name: '切换到图片 2' });
    fireEvent.click(thumb2);
    const mainImage = screen.getByAltText('校区环境图片 2');
    expect(mainImage).toHaveAttribute('src', expect.stringContaining('/uploads/gallery-2.jpg'));
  });

  it('点击第三张小图切换大图', () => {
    render(<CampusGallery campus={mockGallery as any} />);
    const thumb3 = screen.getByRole('button', { name: '切换到图片 3' });
    fireEvent.click(thumb3);
    const mainImage = screen.getByAltText('校区环境图片 3');
    expect(mainImage).toHaveAttribute('src', expect.stringContaining('/uploads/gallery-3.jpg'));
  });

  it('无图集时显示占位符', () => {
    const noGallery = {
      id: 2,
      name: '海淀校区',
      slug: 'haidian',
    };
    render(<CampusGallery campus={noGallery as any} />);
    expect(screen.getByText(/暂无校区环境图片|图片更新中/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('图集为空数组时显示占位符', () => {
    const emptyGallery = {
      id: 3,
      name: '西城校区',
      slug: 'xicheng',
      gallery: [],
    };
    render(<CampusGallery campus={emptyGallery as any} />);
    expect(screen.getByText(/暂无校区环境图片|图片更新中/)).toBeInTheDocument();
  });

  it('单张图时不显示小图缩略图列表', () => {
    const singleImage = {
      id: 4,
      name: '丰台校区',
      slug: 'fengtai',
      gallery: [{ url: '/uploads/single.jpg' }],
    };
    render(<CampusGallery campus={singleImage as any} />);
    const mainImage = screen.getByAltText('校区环境图片 1');
    expect(mainImage).toHaveAttribute('src', expect.stringContaining('/uploads/single.jpg'));
    expect(screen.queryAllByRole('button', { name: /切换到图片/ })).toHaveLength(0);
  });
});
