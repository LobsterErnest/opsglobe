import { NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);
const IS_VERCEL = !!process.env.VERCEL;

export async function GET() {
  // On Vercel: filesystem is read-only, exec may be restricted. Return simulated HQ node.
  if (IS_VERCEL) {
    return NextResponse.json({
      cpu: 12,
      memory: 34,
      hostname: 'opsglobe.vercel.app',
      platform: 'linux',
      uptime: 86400,
      processes: [
        { cpu: '5.2', mem: '2.1', name: 'node' },
        { cpu: '2.1', mem: '1.0', name: 'next-server' },
      ],
      location: { lat: 37.7749, lng: -122.4194, name: 'Vercel Edge (HQ)' },
    });
  }

  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  const loadAvg = os.loadavg();
  const cpuPercent = Math.min(100, (loadAvg[0] / cpus.length) * 100);
  const memUsage = ((totalMem - freeMem) / totalMem) * 100;

  let topProcesses: { cpu: string; mem: string; name: string }[] = [];
  try {
    const { stdout } = await execAsync('ps -eo pcpu,pmem,comm --sort=-%cpu | head -n 10');
    const coreCount = os.cpus().length || 1;
    const lines = stdout.trim().split('\n');
    if (lines.length > 1) {
      topProcesses = lines
        .slice(1)
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          const cpuRaw = parseFloat(parts[0]) || 0;
          const cpuNorm = (cpuRaw / coreCount).toFixed(1);
          return {
            cpu: cpuNorm,
            mem: parts[1],
            name: parts.slice(2).join(' '),
          };
        })
        .filter((p) => {
          const n = p.name.toLowerCase();
          return !['ps', 'sh', 'head', 'bash', 'cmd'].includes(n);
        })
        .slice(0, 3);
    }
  } catch {
    // Ignore (e.g. Windows, restricted env)
  }

  return NextResponse.json({
    cpu: Math.round(cpuPercent),
    memory: Math.round(memUsage),
    hostname: os.hostname(),
    platform: os.platform(),
    uptime: os.uptime(),
    processes: topProcesses,
    location: { lat: 52.5200, lng: 13.4050, name: 'Local Node (HQ)' },
  });
}
