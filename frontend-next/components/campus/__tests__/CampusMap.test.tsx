import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampusMap from '@/components/campus/CampusMap';

// 组件已改为高德 JS API 坐标渲染（不再使用 mapEmbed iframe）
describe('CampusMap 组件', () => {
  it('有经纬度时渲染地图容器（加载高德 JS API）', () => {
    const { container } = render(
      <CampusMap latitude={30.6486} longitude={114.3185} address="武汉市江岸区百步亭" name="百步亭校区" />
    );
    // 不渲染 iframe，渲染高德地图容器
    expect(container.querySelector('iframe')).not.toBeInTheDocument();
    expect(screen.getByText(/校区地图/)).toBeInTheDocument();
    expect(screen.getByText(/地图加载中/)).toBeInTheDocument();
  });

  it('缺少经纬度时渲染占位 UI', () => {
    render(<CampusMap />);
    expect(screen.getByText(/暂无地图信息/)).toBeInTheDocument();
  });

  it('仅有纬度缺少经度时渲染占位 UI', () => {
    render(<CampusMap latitude={30.6486} />);
    expect(screen.getByText(/暂无地图信息/)).toBeInTheDocument();
  });

  it('渲染容器有校区地图标题', () => {
    render(<CampusMap />);
    expect(screen.getByText(/校区地图/)).toBeInTheDocument();
  });
});
