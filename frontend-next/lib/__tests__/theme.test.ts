import { describe, it, expect } from 'vitest';
import { buildThemeCss, DEFAULT_PRIMARY, DEFAULT_DARK } from '../theme';

describe('buildThemeCss（后台主题色 → CSS 变量）', () => {
  it('后台配置合法 hex 时注入对应 CSS 变量', () => {
    const css = buildThemeCss({ primaryColor: '#123456', darkColor: '#654321' });
    expect(css).toContain('--brand-primary: #123456');
    expect(css).toContain('--brand-dark: #654321');
  });

  it('从 hex 派生 rgb 三元组变量（供 rgba() 使用）', () => {
    const css = buildThemeCss({ primaryColor: '#F5851F', darkColor: '#1C2B3A' });
    expect(css).toContain('--brand-primary-rgb: 245, 133, 31');
    expect(css).toContain('--brand-dark-rgb: 28, 43, 58');
  });

  it('未配置时使用品牌默认色', () => {
    const css = buildThemeCss({});
    expect(css).toContain(`--brand-primary: ${DEFAULT_PRIMARY}`);
    expect(css).toContain(`--brand-dark: ${DEFAULT_DARK}`);
  });

  it('非法色值回退默认色（防注入/防脏数据）', () => {
    const css = buildThemeCss({
      primaryColor: 'red; } body { display:none',
      darkColor: 'not-a-color',
    });
    expect(css).toContain(`--brand-primary: ${DEFAULT_PRIMARY}`);
    expect(css).toContain(`--brand-dark: ${DEFAULT_DARK}`);
    expect(css).not.toContain('display:none');
  });

  it('支持 3 位缩写 hex', () => {
    const css = buildThemeCss({ primaryColor: '#abc' });
    expect(css).toContain('--brand-primary: #abc');
    expect(css).toContain('--brand-primary-rgb: 170, 187, 204');
  });

  it('输出为 :root 块', () => {
    const css = buildThemeCss({});
    expect(css.trim()).toMatch(/^:root\s*\{/);
    expect(css.trim()).toMatch(/\}$/);
  });
});
