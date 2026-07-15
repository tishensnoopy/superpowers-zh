import * as crypto from 'crypto';

export interface WechatMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime?: string;
  MsgType: string;
  Content?: string;
  MsgId?: string;
  PicUrl?: string;
  [key: string]: string | undefined;
}

export function verifySignature(
  signature: string,
  timestamp: string,
  nonce: string,
  token: string
): boolean {
  if (!signature) return false;
  const sorted = [token, timestamp, nonce].sort().join('');
  const expected = crypto.createHash('sha1').update(sorted).digest('hex');
  return signature === expected;
}

export async function parseXml(xmlString: string): Promise<WechatMessage> {
  const result: WechatMessage = {} as WechatMessage;
  const regex = /<(\w+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xmlString)) !== null) {
    const key = match[1];
    const value = match[2] !== undefined ? match[2] : match[3];
    result[key] = value;
  }
  return result;
}

export function buildTextXml(toUser: string, fromUser: string, content: string): string {
  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const timestamp = Math.floor(Date.now() / 1000);
  return `<xml>
  <ToUserName><![CDATA[${toUser}]]></ToUserName>
  <FromUserName><![CDATA[${fromUser}]]></FromUserName>
  <CreateTime>${timestamp}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${escapeXml(content)}]]></Content>
</xml>`;
}
