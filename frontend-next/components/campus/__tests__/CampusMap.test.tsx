import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampusMap from '@/components/campus/CampusMap';

describe('CampusMap 组件', () => {
  it('mapEmbed 有值时渲染地图嵌入代码', () => {
    const mapEmbed = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12" width="600" height="450"></iframe>';
    const { container } = render(<CampusMap mapEmbed={mapEmbed} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('src')).toContain('google.com/maps');
  });

  it('mapEmbed 为空字符串时渲染占位 UI', () => {
    render(<CampusMap mapEmbed="" />);
    expect(screen.getByText(/暂无地图信息/)).toBeInTheDocument();
  });

  it('mapEmbed 为 null 时渲染占位 UI', () => {
    render(<CampusMap mapEmbed={null} />);
    expect(screen.getByText(/暂无地图信息/)).toBeInTheDocument();
  });

  it('mapEmbed 为 undefined 时渲染占位 UI', () => {
    render(<CampusMap mapEmbed={undefined} />);
    expect(screen.getByText(/暂无地图信息/)).toBeInTheDocument();
  });

  it('渲染容器有校区地图标题', () => {
    render(<CampusMap mapEmbed={null} />);
    expect(screen.getByText(/校区地图/)).toBeInTheDocument();
  });

  it('百度地图嵌入代码也能正常渲染', () => {
    const baiduMapEmbed = '<iframe src="https://api.map.baidu.com/staticimage?width=600&height=400&center=114.30,30.60" width="600" height="400"></iframe>';
    const { container } = render(<CampusMap mapEmbed={baiduMapEmbed} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('src')).toContain('baidu.com');
  });
});
