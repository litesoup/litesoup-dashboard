import { stat } from "fs/promises";

const DEFAULT_CACHE_PATH = "/var/lib/litesoup-agent/wp-cache.json";

function cachePath(): string {
  return process.env.AGENT_CACHE_PATH ?? DEFAULT_CACHE_PATH;
}

export interface WpSiteCache {
  domain: string;
  wpVersion?: string;
  phpVersion?: string;
  tier?: string;
  plugins?: Array<{ name: string; version: string; updateAvailable: boolean }>;
  scannedAt?: string;
}

/**
 * Reads the WP cache JSON file.
 * Returns an empty array if the file does not exist or is invalid JSON.
 */
export async function readCache(): Promise<WpSiteCache[]> {
  const path = cachePath();
  try {
    const file = Bun.file(path);
    const exists = await file.exists();
    if (!exists) return [];
    const text = await file.text();
    return JSON.parse(text) as WpSiteCache[];
  } catch {
    return [];
  }
}

/**
 * Writes data to the WP cache JSON file.
 */
export async function writeCache(data: WpSiteCache[]): Promise<void> {
  const path = cachePath();
  await Bun.write(path, JSON.stringify(data, null, 2));
}

/**
 * Returns the age of the cache file in milliseconds.
 * Returns Infinity if the file does not exist.
 */
export async function cacheAge(): Promise<number> {
  const path = cachePath();
  try {
    const info = await stat(path);
    return Date.now() - info.mtimeMs;
  } catch {
    return Infinity;
  }
}
