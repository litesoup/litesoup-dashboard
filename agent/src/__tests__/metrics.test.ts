import { describe, it, expect } from "bun:test";
import { parseProcStat, parseProcMeminfo } from "../routes/metrics";

describe("parseProcStat", () => {
  it("parses a typical /proc/stat cpu line", () => {
    const content =
      "cpu  100 20 50 800 10 5 5 0 0 0\ncpu0 50 10 25 400 5 2 3 0 0 0\n";
    const result = parseProcStat(content);
    expect(result.user).toBe(100);
    expect(result.nice).toBe(20);
    expect(result.system).toBe(50);
    expect(result.idle).toBe(800);
    // total=990, active=190, usage = round(190/990*100) = 19
    expect(result.usagePercent).toBe(19);
  });

  it("returns zeros for empty content", () => {
    const result = parseProcStat("");
    expect(result.user).toBe(0);
    expect(result.usagePercent).toBe(0);
  });

  it("handles a line with only idle (0% usage)", () => {
    const content = "cpu  0 0 0 1000 0 0 0\n";
    const result = parseProcStat(content);
    expect(result.usagePercent).toBe(0);
  });

  it("handles 100% usage (no idle)", () => {
    const content = "cpu  1000 0 0 0 0 0 0\n";
    const result = parseProcStat(content);
    expect(result.usagePercent).toBe(100);
  });
});

describe("parseProcMeminfo", () => {
  it("parses a typical /proc/meminfo", () => {
    const content = [
      "MemTotal:       8192000 kB",
      "MemFree:        1024000 kB",
      "MemAvailable:   2048000 kB",
      "Buffers:         512000 kB",
      "Cached:          614400 kB",
    ].join("\n");
    const result = parseProcMeminfo(content);
    expect(result.totalKb).toBe(8192000);
    expect(result.availableKb).toBe(2048000);
    expect(result.usedKb).toBe(8192000 - 2048000);
    expect(result.usagePercent).toBe(75);
  });

  it("returns zeros for empty content", () => {
    const result = parseProcMeminfo("");
    expect(result.totalKb).toBe(0);
    expect(result.usagePercent).toBe(0);
  });

  it("calculates usagePercent correctly", () => {
    const content = "MemTotal: 4000000 kB\nMemAvailable: 1000000 kB\n";
    const result = parseProcMeminfo(content);
    // used = 3000000, usage = round(3000000/4000000*100) = 75
    expect(result.usagePercent).toBe(75);
  });
});
