/**
 * WeChat access_token and jsapi_ticket cache service.
 *
 * Both tokens are valid for 2 hours (7200s). We cache them in memory with a
 * 5-minute safety buffer (refresh when < 5 min remaining). No Redis — the
 * single-server Docker Compose deployment means in-memory cache is sufficient.
 */
import * as crypto from 'crypto';

interface TokenCache {
  value: string;
  expiresAt: number; // Unix timestamp in ms
}

let accessTokenCache: TokenCache | null = null;
let jsapiTicketCache: TokenCache | null = null;

const SAFETY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

function getConfig(): { appId: string; appSecret: string } {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;
  if (!appId) {
    throw new Error('WECHAT_APP_ID is not configured');
  }
  if (!appSecret) {
    throw new Error('WECHAT_APP_SECRET is not configured');
  }
  return { appId, appSecret };
}

export function resetTokenCache(): void {
  accessTokenCache = null;
  jsapiTicketCache = null;
}

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (accessTokenCache && accessTokenCache.expiresAt > now + SAFETY_BUFFER_MS) {
    return accessTokenCache.value;
  }

  const { appId, appSecret } = getConfig();
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  const res = await fetch(url);
  const data = await res.json() as any;

  if (data.errcode) {
    throw new Error(`WeChat token error: ${data.errmsg} (code ${data.errcode})`);
  }

  accessTokenCache = {
    value: data.access_token,
    expiresAt: now + (data.expires_in || 7200) * 1000,
  };
  return accessTokenCache.value;
}

export async function getJsapiTicket(): Promise<string> {
  const now = Date.now();
  if (jsapiTicketCache && jsapiTicketCache.expiresAt > now + SAFETY_BUFFER_MS) {
    return jsapiTicketCache.value;
  }

  const token = await getAccessToken();
  const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?type=jsapi&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json() as any;

  if (data.errcode) {
    throw new Error(`WeChat ticket error: ${data.errmsg} (code ${data.errcode})`);
  }

  jsapiTicketCache = {
    value: data.ticket,
    expiresAt: now + (data.expires_in || 7200) * 1000,
  };
  return jsapiTicketCache.value;
}

/**
 * Generate JSSDK signature for wx.config.
 * Algorithm: SHA1(jsapi_ticket=xxx&noncestr=xxx&timestamp=xxx&url=xxx)
 */
export function generateJssdkSignature(
  jsapiTicket: string,
  nonceStr: string,
  timestamp: number,
  url: string
): string {
  const str = `jsapi_ticket=${jsapiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
  return crypto.createHash('sha1').update(str).digest('hex');
}
