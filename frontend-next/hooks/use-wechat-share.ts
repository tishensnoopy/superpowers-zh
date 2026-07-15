'use client';

import { useState, useEffect } from 'react';
import { loadWechatJssdk, isWechatBrowser, getJssdkConfig } from '@/lib/wechat';

export interface ShareData {
  title: string;
  desc: string;
  link: string;
  imgUrl: string;
}

/**
 * Initialize WeChat JSSDK sharing for the current page.
 *
 * Behavior:
 * - Non-WeChat browser: no-op (ready=false)
 * - WeChat browser: loads JSSDK, fetches signature, calls wx.config + wx.ready
 * - Errors are silently swallowed (share just won't work, page still functions)
 */
export function useWechatShare(shareData: ShareData | null): { ready: boolean } {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!shareData) return;
    if (!isWechatBrowser()) return;

    let cancelled = false;

    async function init() {
      try {
        await loadWechatJssdk();
        const url = window.location.href.split('#')[0];
        const config = await getJssdkConfig(url);
        if (cancelled) return;

        const wx = (window as any).wx;
        if (!wx) return;

        wx.config({
          debug: false,
          appId: config.appId,
          timestamp: config.timestamp,
          nonceStr: config.nonceStr,
          signature: config.signature,
          jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData'],
        });

        wx.ready(() => {
          if (cancelled) return;
          wx.updateAppMessageShareData({
            title: shareData.title,
            desc: shareData.desc,
            link: shareData.link,
            imgUrl: shareData.imgUrl,
          });
          wx.updateTimelineShareData({
            title: shareData.title,
            link: shareData.link,
            imgUrl: shareData.imgUrl,
          });
          setReady(true);
        });

        wx.error((err: any) => {
          console.warn('[wechat-share] wx.config error:', err?.errMsg);
        });
      } catch (err) {
        // Silently fail — sharing won't work but page is still functional
        console.warn(
          '[wechat-share] init failed:',
          err instanceof Error ? err.message : err
        );
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [shareData?.title, shareData?.desc, shareData?.link, shareData?.imgUrl]);

  return { ready };
}
