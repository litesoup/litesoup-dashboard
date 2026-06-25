import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { readCache, writeCache, cacheAge } from "../cache";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

let tmpDir: string;
let cachePath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "litesoup-agent-test-"));
  cachePath = join(tmpDir, "wp-cache.json");
  process.env.AGENT_CACHE_PATH = cachePath;
});

afterEach(async () => {
  delete process.env.AGENT_CACHE_PATH;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("readCache", () => {
  it("returns empty array when file does not exist", async () => {
    const result = await readCache();
    expect(result).toEqual([]);
  });

  it("returns parsed data when file exists", async () => {
    const data = [{ domain: "example.com", wpVersion: "6.5.0" }];
    await Bun.write(cachePath, JSON.stringify(data));
    const result = await readCache();
    expect(result).toEqual(data);
  });

  it("returns empty array when file contains invalid JSON", async () => {
    await Bun.write(cachePath, "not-json");
    const result = await readCache();
    expect(result).toEqual([]);
  });
});

describe("writeCache", () => {
  it("writes data as JSON to cache file", async () => {
    const data = [{ domain: "test.com", wpVersion: "6.6.0" }];
    await writeCache(data);
    const raw = await Bun.file(cachePath).text();
    expect(JSON.parse(raw)).toEqual(data);
  });

  it("overwrites existing cache", async () => {
    await writeCache([{ domain: "old.com", wpVersion: "6.0.0" }]);
    await writeCache([{ domain: "new.com", wpVersion: "6.6.0" }]);
    const result = await readCache();
    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe("new.com");
  });
});

describe("cacheAge", () => {
  it("returns Infinity when cache file does not exist", async () => {
    const age = await cacheAge();
    expect(age).toBe(Infinity);
  });

  it("returns a small number (ms) for a freshly written cache", async () => {
    await writeCache([]);
    const age = await cacheAge();
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(5000);
  });
});
