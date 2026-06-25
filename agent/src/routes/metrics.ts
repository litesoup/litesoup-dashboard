import type { Context } from "hono";
import { readFile } from "fs/promises";

export interface CpuStats {
  user: number;
  nice: number;
  system: number;
  idle: number;
  usagePercent: number;
}

export interface MemStats {
  totalKb: number;
  availableKb: number;
  usedKb: number;
  usagePercent: number;
}

export interface DiskStats {
  device: string;
  mountpoint: string;
  totalGb: number;
  usedGb: number;
  availableGb: number;
  usagePercent: number;
}

export interface MetricsResponse {
  cpu: CpuStats;
  memory: MemStats;
  disk: DiskStats[];
}

/**
 * Parses a single "cpu" line from /proc/stat.
 * Format: cpu  <user> <nice> <system> <idle> <iowait> <irq> <softirq> ...
 */
export function parseProcStat(content: string): CpuStats {
  const line = content.split("\n").find((l) => l.startsWith("cpu "));
  if (!line) return { user: 0, nice: 0, system: 0, idle: 0, usagePercent: 0 };

  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  const [user = 0, nice = 0, system = 0, idle = 0] = parts;
  const total = parts.reduce((a, b) => a + b, 0);
  const usagePercent =
    total > 0 ? Math.round(((total - idle) / total) * 100) : 0;

  return { user, nice, system, idle, usagePercent };
}

/**
 * Parses /proc/meminfo content into memory stats.
 */
export function parseProcMeminfo(content: string): MemStats {
  const getValue = (key: string): number => {
    const match = content.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
    return match ? parseInt(match[1], 10) : 0;
  };

  const totalKb = getValue("MemTotal");
  const availableKb = getValue("MemAvailable");
  const usedKb = totalKb - availableKb;
  const usagePercent = totalKb > 0 ? Math.round((usedKb / totalKb) * 100) : 0;

  return { totalKb, availableKb, usedKb, usagePercent };
}

/**
 * Runs `df -BG` and parses disk usage for real filesystems.
 */
async function getDiskStats(): Promise<DiskStats[]> {
  try {
    const proc = Bun.spawn(
      ["df", "-BG", "--output=source,target,size,used,avail,pcent"],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const out = await new Response(proc.stdout).text();
    const lines = out.trim().split("\n").slice(1); // skip header

    return lines
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 6) return null;
        const [device, mountpoint, sizeRaw, usedRaw, availRaw, pcentRaw] =
          parts;
        // skip pseudo-filesystems
        if (!device.startsWith("/")) return null;
        const parseGb = (s: string) => parseFloat(s.replace("G", "")) || 0;
        const usagePercent = parseInt(pcentRaw?.replace("%", "") ?? "0", 10);
        return {
          device,
          mountpoint,
          totalGb: parseGb(sizeRaw),
          usedGb: parseGb(usedRaw),
          availableGb: parseGb(availRaw),
          usagePercent,
        };
      })
      .filter((d): d is DiskStats => d !== null);
  } catch {
    return [];
  }
}

export async function metricsHandler(c: Context) {
  const [procStatContent, procMeminfoContent, disk] = await Promise.all([
    readFile("/proc/stat", "utf-8").catch(() => ""),
    readFile("/proc/meminfo", "utf-8").catch(() => ""),
    getDiskStats(),
  ]);

  const response: MetricsResponse = {
    cpu: parseProcStat(procStatContent),
    memory: parseProcMeminfo(procMeminfoContent),
    disk,
  };

  return c.json(response);
}
