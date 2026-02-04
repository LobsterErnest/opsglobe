import { NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export async function GET() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  // Calculate CPU usage (basic average across cores)
  const loadAvg = os.loadavg();
  const cpuPercent = Math.min(100, (loadAvg[0] / cpus.length) * 100);
  const memUsage = ((totalMem - freeMem) / totalMem) * 100;

  // Fetch Top Processes
  let topProcesses = [];
  try {
      // ps -eo pcpu,pmem,comm --sort=-%cpu | head -n 10
      // We ask for more lines to allow for filtering
      const { stdout } = await execAsync('ps -eo pcpu,pmem,comm --sort=-%cpu | head -n 10');
      
      const coreCount = os.cpus().length || 1;

      // Parse output:
      // %CPU %MEM COMMAND
      // 10.5  2.1 node
      const lines = stdout.trim().split('\n');
      if (lines.length > 1) {
          topProcesses = lines.slice(1)
            .map(line => {
                const parts = line.trim().split(/\s+/);
                // parts[0] is CPU, parts[1] is MEM, rest is command
                // Parse CPU and normalize by core count (simple approximation to avoid "200%")
                let cpuRaw = parseFloat(parts[0]) || 0;
                // Cap at 100% per process for visual sanity, or divide by cores if preferred.
                // The user asked to "normalize... or simply cap it". 
                // Dividing by cores is more "Task Manager" style.
                let cpuNorm = (cpuRaw / coreCount).toFixed(1);
                
                return { 
                    cpu: cpuNorm, 
                    mem: parts[1], 
                    name: parts.slice(2).join(' ') 
                };
            })
            .filter(p => {
                const n = p.name.toLowerCase();
                // Filter out artifacts of the check
                return !['ps', 'sh', 'head', 'bash', 'cmd'].includes(n);
            })
            .slice(0, 3); // Take top 3 after filtering
      }
  } catch (e) {
      // Ignore errors (e.g. windows)
  }

  const data = {
    cpu: Math.round(cpuPercent),
    memory: Math.round(memUsage),
    hostname: os.hostname(),
    platform: os.platform(),
    uptime: os.uptime(),
    processes: topProcesses,
    location: {
        lat: 52.5200,
        lng: 13.4050,
        name: "Local Node (HQ)"
    }
  };

  return NextResponse.json(data);
}
