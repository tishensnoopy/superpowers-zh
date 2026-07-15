import os from 'node:os';
import { execSync } from 'node:child_process';

export interface HeartbeatData {
  cpu: number;
  mem: number;
  disk: number;
  services: Array<{ name: string; status: string }>;
}

export function collectHeartbeatData(): HeartbeatData {
  const cpu = os.loadavg()[0];
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const mem = (totalMem - freeMem) / totalMem;
  const disk = getDiskUsage();
  return { cpu, mem, disk, services: [] };
}

function getDiskUsage(): number {
  try {
    const out = execSync(`df -P / | awk 'NR==2 {print $5}'`, { encoding: 'utf8' }).trim();
    return parseFloat(out.replace('%', '')) / 100;
  } catch {
    return 0;
  }
}
