import { describe, it, expect } from 'vitest';
import { verifySignature, parseXml, buildTextXml } from '../wechat';

describe('verifySignature', () => {
  it('正确签名返回 true', () => {
    const token = 'mytesttoken';
    const timestamp = '1609459200';
    const nonce = 'abc123';
    const sorted = [token, timestamp, nonce].sort().join('');
    const crypto = require('crypto');
    const expected = crypto.createHash('sha1').update(sorted).digest('hex');
    expect(verifySignature(expected, timestamp, nonce, token)).toBe(true);
  });

  it('错误签名返回 false', () => {
    expect(verifySignature('wrong', '1609459200', 'abc123', 'mytesttoken')).toBe(false);
  });

  it('空签名返回 false', () => {
    expect(verifySignature('', '1609459200', 'abc123', 'mytesttoken')).toBe(false);
  });
});

describe('parseXml', () => {
  it('解析文本消息 XML', async () => {
    const xml = `<xml>
      <ToUserName><![CDATA[gh_123]]></ToUserName>
      <FromUserName><![CDATA[oAbc123]]></FromUserName>
      <CreateTime>1609459200</CreateTime>
      <MsgType><![CDATA[text]]></MsgType>
      <Content><![CDATA[你好]]></Content>
      <MsgId>1234567890</MsgId>
    </xml>`;
    const msg = await parseXml(xml);
    expect(msg.ToUserName).toBe('gh_123');
    expect(msg.FromUserName).toBe('oAbc123');
    expect(msg.MsgType).toBe('text');
    expect(msg.Content).toBe('你好');
    expect(msg.MsgId).toBe('1234567890');
  });

  it('解析图片消息 XML（MsgType=image 无 Content）', async () => {
    const xml = `<xml>
      <ToUserName><![CDATA[gh_123]]></ToUserName>
      <FromUserName><![CDATA[oAbc123]]></FromUserName>
      <CreateTime>1609459200</CreateTime>
      <MsgType><![CDATA[image]]></MsgType>
      <PicUrl><![CDATA[http://example.com/img.jpg]]></PicUrl>
      <MsgId>1234567890</MsgId>
    </xml>`;
    const msg = await parseXml(xml);
    expect(msg.MsgType).toBe('image');
    expect(msg.Content).toBeUndefined();
  });

  it('空 XML 返回空对象', async () => {
    const msg = await parseXml('<xml></xml>');
    expect(msg).toBeDefined();
  });
});

describe('buildTextXml', () => {
  it('构造文本回复 XML', () => {
    const xml = buildTextXml('oAbc123', 'gh_123', '你好，欢迎');
    expect(xml).toContain('<ToUserName><![CDATA[oAbc123]]></ToUserName>');
    expect(xml).toContain('<FromUserName><![CDATA[gh_123]]></FromUserName>');
    expect(xml).toContain('<MsgType><![CDATA[text]]></MsgType>');
    expect(xml).toContain('<Content><![CDATA[你好，欢迎]]></Content>');
  });

  it('XML 中转义特殊字符', () => {
    const xml = buildTextXml('user', 'app', '<script>alert(1)</script>');
    expect(xml).not.toContain('<script>');
    expect(xml).toContain('&lt;script&gt;');
  });
});
