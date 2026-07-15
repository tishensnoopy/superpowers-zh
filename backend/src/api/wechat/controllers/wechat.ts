/**
 * WeChat webhook + JSSDK controller.
 *
 * Endpoints (see routes/wechat.ts):
 *   GET  /wechat/webhook  - verify (signature check, return echostr)
 *   POST /wechat/webhook  - handleMessage (parse XML, process, return passive reply)
 *   GET  /wechat/jssdk    - getJssdkConfig (return signature for wx.config)
 */
import {
  verifySignature,
  parseXml,
  buildTextXml,
  handleIncomingMessage,
  getJssdkConfig as fetchJssdkConfig,
} from '../services/wechat';

/**
 * GET /wechat/webhook — WeChat server verification.
 * WeChat sends signature, timestamp, nonce, echostr.
 * If signature matches SHA1(sort([token, timestamp, nonce])), return echostr.
 */
export async function verify(ctx: any) {
  const { signature, timestamp, nonce, echostr } = ctx.query || {};
  if (!echostr) {
    ctx.throw(400, 'echostr is required');
  }
  const token = process.env.WECHAT_TOKEN || '';
  if (!verifySignature(signature, timestamp, nonce, token)) {
    ctx.throw(401, 'Invalid signature');
  }
  ctx.body = echostr;
}

/**
 * POST /wechat/webhook — Receive WeChat message (XML body).
 * Parse XML, process message, return passive reply XML.
 */
export async function handleMessage(ctx: any) {
  const rawBody = ctx.request.body;
  if (!rawBody) {
    ctx.body = '';
    return;
  }

  try {
    const message = await parseXml(typeof rawBody === 'string' ? rawBody : rawBody.toString());
    const result = await handleIncomingMessage(ctx.strapi || strapi, message);

    // Build passive reply XML (ToUserName = user openid, FromUserName = official account)
    ctx.type = 'application/xml';
    ctx.body = buildTextXml(message.FromUserName, message.ToUserName, result.passiveReply);
  } catch (err) {
    console.error('[wechat] handleMessage error:', err instanceof Error ? err.message : err);
    // Return empty 200 to prevent WeChat from retrying
    ctx.body = '';
  }
}

/**
 * GET /wechat/jssdk?url=xxx — Return JSSDK signature config for wx.config.
 */
export async function getJssdkConfig(ctx: any) {
  const { url } = ctx.query || {};
  if (!url) {
    ctx.throw(400, 'url parameter is required');
  }
  const config = await fetchJssdkConfig(url);
  ctx.body = config;
}

export default {
  verify,
  handleMessage,
  getJssdkConfig,
};
