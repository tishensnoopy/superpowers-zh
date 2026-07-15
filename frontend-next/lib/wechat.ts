/**
 * WeChat JSSDK loader and config helper.
 *
 * Dynamically loads the WeChat JSSDK script only when needed (inside WeChat
 * browser). The script URL is the official WeChat JSSDK 1.6.0.
 */

const JSSDK_URL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
let scriptLoaded: Promise<void> | null = null;

/**
 * Load WeChat JSSDK script. Idempotent — only loads once.
 */
export function loadWechatJssdk(): Promise<void> {
  if (scriptLoaded) return scriptLoaded;
  scriptLoaded = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('SSR environment'));
      return;
    }
    const script = document.createElement('script');
    script.src = JSSDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load WeChat JSSDK'));
    document.head.appendChild(script);
  });
  return scriptLoaded;
}

/**
 * Check if the current browser is WeChat.
 */
export function isWechatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

interface JssdkConfig {
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
}

/**
 * Fetch JSSDK signature config from backend.
 */
export async function getJssdkConfig(url: string): Promise<JssdkConfig> {
  const apiUrl = process.env.NEXT_PUBLIC_STRAPI_API_URL || 'http://localhost:1337';
  const res = await fetch(
    `${apiUrl}/api/wechat/jssdk?url=${encodeURIComponent(url)}`
  );
  if (!res.ok) {
    throw new Error(`JSSDK config fetch failed: ${res.status}`);
  }
  return res.json();
}
