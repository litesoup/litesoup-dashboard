import { Hono } from "hono";
import { metricsHandler } from "./routes/metrics";
import { servicesHandler } from "./routes/services";
import { sitesHandler, wpScanHandler } from "./routes/sites";
import { execHandler } from "./routes/exec";
import { discoverSites } from "./discovery";
import { scanAllSites } from "./wp";
import { writeCache, cacheAge } from "./cache";

const PORT = parseInt(process.env.AGENT_PORT ?? "7777", 10);
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

const app = new Hono();

// Health check
app.get("/health", (c) => c.json({ ok: true }));

// Metrics — CPU, RAM, disk
app.get("/metrics", metricsHandler);

// Services — systemctl status
app.get("/services", servicesHandler);

// Sites — discovered vhosts merged with WP cache
app.get("/sites", sitesHandler);

// WP scan — SSE stream that refreshes the cache
app.post("/sites/wp-scan", wpScanHandler);

// Exec — SSE stream for litesoup CLI commands
app.post("/exec", execHandler);

/**
 * Refreshes the WP cache by scanning all discovered sites.
 * Called on startup (if cache is stale) and every 12 hours.
 */
async function refreshWpCache(): Promise<void> {
  const age = await cacheAge();
  if (age < CACHE_MAX_AGE_MS) {
    console.log(
      `[agent] WP cache is fresh (${Math.round(age / 60000)}m old), skipping refresh`,
    );
    return;
  }
  console.log("[agent] Refreshing WP cache...");
  try {
    const sites = await discoverSites();
    const results = await scanAllSites(sites, (line) =>
      console.log(`[wp-scan] ${line}`),
    );
    await writeCache(results);
    console.log(`[agent] WP cache refreshed — ${results.length} sites scanned`);
  } catch (err) {
    console.error("[agent] WP cache refresh failed:", err);
  }
}

// Initial cache refresh on startup
refreshWpCache().catch(console.error);

// Schedule refresh every 12 hours
setInterval(() => {
  refreshWpCache().catch(console.error);
}, CACHE_MAX_AGE_MS);

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`[agent] litesoup-agent listening on port ${PORT}`);
