/**
 * WeChat customer service message sender.
 *
 * Sends messages via the WeChat客服消息 API within the 48h interaction window.
 * Automatically retries once on token expiry (errcode 40001/42001).
 */
import { getAccessToken, resetTokenCache } from './wechat-token-service';

const WECHAT_API_BASE = 'https://api.weixin.qq.com/cgi-bin';
const MAX_CONTENT_LENGTH = 2048;

/**
 * Truncate content to WeChat's 2048-char limit with ellipsis.
 */
export function truncateContent(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) {
    return content;
  }
  return content.slice(0, MAX_CONTENT_LENGTH - 1) + '…';
}

/**
 * Send a text customer service message to a WeChat user.
 * @param openid - recipient's openid
 * @param content - message text (truncated to 2048 chars)
 * @throws on non-zero errcode after retry
 */
export async function sendCustomMessage(openid: string, content: string): Promise<void> {
  const truncated = truncateContent(content);
  const body = JSON.stringify({
    touser: openid,
    msgtype: 'text',
    text: { content: truncated },
  });

  const result = await doSend(body);

  // Token expired — refresh and retry once
  if (result.errcode === 40001 || result.errcode === 42001) {
    resetTokenCache();
    const retryResult = await doSend(body);
    if (retryResult.errcode && retryResult.errcode !== 0) {
      throw new Error(`WeChat send failed: ${retryResult.errmsg} (code ${retryResult.errcode})`);
    }
    return;
  }

  if (result.errcode && result.errcode !== 0) {
    throw new Error(`WeChat send failed: ${result.errmsg} (code ${result.errcode})`);
  }
}

async function doSend(body: string): Promise<{ errcode: number; errmsg: string }> {
  const token = await getAccessToken();
  const url = `${WECHAT_API_BASE}/message/custom/send?access_token=${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return res.json() as Promise<{ errcode: number; errmsg: string }>;
}
