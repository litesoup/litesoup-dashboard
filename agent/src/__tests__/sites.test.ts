import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { readCache, writeCache } from "../cache";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Test the cache-merge logic used by sitesHandler independently
// (sitesHandler itself requires a full Hono context — integration tested separately)

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "litesoup-sites-test-"));
  process.env.AGENT_CACHE_PATH = join(tmpDir, "wp-cache.json");
  process.env.VHOSTS_DIR = join(import.meta.dir, "fixtures");
});

afterEach(async () => {
  delete process.env.AGENT_CACHE_PATH;
  delete process.env.VHOSTS_DIR;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("sites merge logic", () => {
  it("discovered sites have unknown wp fields when cache is empty", async () => {
    const { discoverSites } = await import("../discovery");
    const cache = await readCache();
    const cacheMap = new Map(cache.map((e) => [e.domain, e]));
    const sites = await discoverSites();

    for (const site of sites) {
      const cached = cacheMap.get(site.domain);
      expect(cached?.wpVersion ?? "unknown").toBe("unknown");
    }
  });

  it("cached wp data is merged with discovered sites", async () => {
    const { discoverSites } = await import("../discovery");
    const discovered = await discoverSites();
    expect(discovered.length).toBeGreaterThan(0);

    // Write cache entry for the first discovered site
    const first = discovered[0];
    await writeCache([
      {
        domain: first.domain,
        wpVersion: "6.5.3",
        phpVersion: "unknown",
        tier: "unknown",
        plugins: [],
        scannedAt: new Date().toISOString(),
      },
    ]);

    const cache = await readCache();
    const cacheMap = new Map(cache.map((e) => [e.domain, e]));
    const merged = discovered.map((site) => ({
      ...site,
      wpVersion: cacheMap.get(site.domain)?.wpVersion ?? "unknown",
    }));

    expect(merged.find((s) => s.domain === first.domain)?.wpVersion).toBe(
      "6.5.3",
    );
  });

  it("sites not in cache still appear with unknown wpVersion", async () => {
    const { discoverSites } = await import("../discovery");
    const discovered = await discoverSites();

    // Write cache for none of them
    const cache = await readCache(); // empty
    const cacheMap = new Map(cache.map((e) => [e.domain, e]));
    const merged = discovered.map((s) => ({
      domain: s.domain,
      wpVersion: cacheMap.get(s.domain)?.wpVersion ?? "unknown",
    }));

    expect(merged.every((s) => s.wpVersion === "unknown")).toBe(true);
  });
});
