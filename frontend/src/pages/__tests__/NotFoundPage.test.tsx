import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { render } from '../../test/test-utils';
import NotFoundPage from '../NotFoundPage';

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('NotFoundPage 组件', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('渲染 404 数字和页面未找到文案', () => {
    renderPage();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('页面未找到')).toBeInTheDocument();
  });

  it('包含返回首页链接指向 /', () => {
    renderPage();
    const homeLink = screen.getByText('返回首页');
    expect(homeLink).toBeInTheDocument();
    expect(homeLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('包含返回上一页按钮', () => {
    renderPage();
    expect(screen.getByText('返回上一页')).toBeInTheDocument();
  });

  it('Seo 注入正确的 title 标签', () => {
    renderPage();
    const titleEl = document.querySelector('title');
    expect(titleEl?.textContent).toContain('页面未找到');
  });
});
