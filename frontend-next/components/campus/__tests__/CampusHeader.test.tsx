import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampusHeader from '@/components/campus/CampusHeader';

describe('CampusHeader 组件', () => {
  it('渲染主标题"六大校区 任您选择"', () => {
    render(<CampusHeader />);
    expect(
      screen.getByRole('heading', { name: /六大校区 任您选择/ })
    ).toBeInTheDocument();
  });

  it('渲染副标题包含"武汉三镇"', () => {
    render(<CampusHeader />);
    expect(screen.getByText(/武汉三镇/)).toBeInTheDocument();
  });

  it('副标题包含"就近选择"提示', () => {
    render(<CampusHeader />);
    expect(screen.getByText(/就近选择/)).toBeInTheDocument();
  });
});
