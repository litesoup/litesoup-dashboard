import type { Context } from "hono";
import { stream } from "hono/streaming";
import { readCache, writeCache } from "../cache";
import { discoverSites } from "../discovery";
import { scanAllSites } from "../wp";

export async function sitesHandler(c: Context) {
  const [discovered, cached] = await Promise.all([
    discoverSites(),
    readCache(),
  ]);

  // Build a lookup from cached data by domain
  const cacheMap = new Map(cached.map((entry) => [entry.domain, entry]));

  // Merge: discovered sites enriched with any cached WP data
  const sites = discovered.map((site) => {
    const cachedEntry = cacheMap.get(site.domain);
    return {
      domain: site.domain,
      user: site.user,
      wpVersion: cachedEntry?.wpVersion ?? "unknown",
      phpVersion: cachedEntry?.phpVersion ?? "unknown",
      tier: cachedEntry?.tier ?? "unknown",
      plugins: cachedEntry?.plugins ?? [],
      scannedAt: cachedEntry?.scannedAt ?? null,
    };
  });

  return c.json(sites);
}

export async function wpScanHandler(c: Context) {
  return stream(c, async (s) => {
    const sites = await discoverSites();

    await s.writeln(`data: {"event":"start","total":${sites.length}}\n`);

    const results = await scanAllSites(sites, async (line) => {
      await s.writeln(`data: ${JSON.stringify({ event: "progress", line })}\n`);
    });

    await writeCache(results);

    await s.writeln(
      `data: ${JSON.stringify({ event: "done", scanned: results.length })}\n`,
    );
  });
}
