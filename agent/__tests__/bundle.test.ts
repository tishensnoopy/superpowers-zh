import { describe, it, expect, vi } from 'vitest';
import { downloadBundle, syncBundleToDir } from '../src/lib/bundle';

describe('bundle.downloadBundle', () => {
  it('带 Bearer token 下载，写入目标文件，返回字节数', async () => {
    const written: string[] = [];
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(c) { c.enqueue(new Uint8Array([1, 2, 3])); c.close(); },
      }),
    }));
    const writeImpl = vi.fn(async (file: string, chunk: Uint8Array) => { written.push(file); });

    const size = await downloadBundle(
      { url: 'https://central.example.com/api/agent/bundles/b-1/download', token: 'tok', destFile: '/tmp/x.tar.gz' },
      { fetchImpl: fetchImpl as any, writeImpl }
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://central.example.com/api/agent/bundles/b-1/download',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) })
    );
    expect(size).toBe(3);
    expect(written).toEqual(['/tmp/x.tar.gz']);
  });

  it('HTTP 401/409 → 抛带状态码的错', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 409, body: null }));
    await expect(
      downloadBundle(
        { url: 'http://x/b', token: 'tok', destFile: '/tmp/x' },
        { fetchImpl: fetchImpl as any, writeImpl: vi.fn() }
      )
    ).rejects.toThrow('409');
  });
});

describe('bundle.syncBundleToDir', () => {
  it('下载→解压到临时目录→rsync -a --delete 同步（排除 .env/uploads）', async () => {
    const calls: string[][] = [];
    const execImpl = vi.fn(async (cmd: string, args: string[]) => { calls.push([cmd, ...args]); });
    const downloadImpl = vi.fn(async () => 100);

    await syncBundleToDir(
      { url: 'http://x/b', token: 'tok', dataDir: '/opt/site' },
      { downloadImpl, execImpl }
    );

    const tarCall = calls.find((c) => c[0] === 'tar');
    expect(tarCall).toBeTruthy();
    const rsyncCall = calls.find((c) => c[0] === 'rsync');
    expect(rsyncCall).toBeTruthy();
    expect(rsyncCall).toContain('--delete');
    expect(rsyncCall).toContain('--exclude');
    expect(rsyncCall!.join(' ')).toContain('.env');
    expect(rsyncCall!.join(' ')).toContain('backend/public/uploads/');
    expect(rsyncCall!.join(' ')).toContain('node_modules/');
    expect(rsyncCall![rsyncCall!.length - 1]).toBe('/opt/site/');
  });
});
