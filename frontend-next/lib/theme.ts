/**
 * 主题色注入：把后台「站点设置」里的品牌色转成 CSS 变量。
 * 前端组件统一使用 var(--brand-primary, #F5851F) / var(--brand-dark, #1C2B3A)，
 * 后台改色后全站生效；未配置或值非法时回退品牌默认色。
 */

export const DEFAULT_PRIMARY = '#F5851F';
export const DEFAULT_DARK = '#1C2B3A';

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function sanitizeHex(value: string | undefined, fallback: string): string {
  if (value && HEX_RE.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function hexToRgbTriplet(hex: string): string {
  let h = hex.slice(1);
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export interface ThemeColors {
  primaryColor?: string;
  darkColor?: string;
}

export function buildThemeCss(colors: ThemeColors): string {
  const primary = sanitizeHex(colors.primaryColor, DEFAULT_PRIMARY);
  const dark = sanitizeHex(colors.darkColor, DEFAULT_DARK);
  return `:root {
  --brand-primary: ${primary};
  --brand-primary-rgb: ${hexToRgbTriplet(primary)};
  --brand-dark: ${dark};
  --brand-dark-rgb: ${hexToRgbTriplet(dark)};
}`;
}
