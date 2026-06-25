import type { DiscoveredSite } from "./discovery";
import type { WpSiteCache } from "./cache";

export interface ScanOptions {
  /** Skip actual wp-cli invocations — used in tests and dry-run mode. */
  dryRun?: boolean;
}

/**
 * Returns the base wp-cli argument array for a given site path.
 */
export function buildWpCliArgs(domain: string, user: string): string[] {
  return [`--path=/home/${user}/webapps/${domain}`, "--allow-root"];
}

/**
 * Parses wp-cli `core version` output into a semver string.
 * Returns "unknown" if the output doesn't look like a version.
 */
export function parseWpVersion(output: string): string {
  const trimmed = output.trim();
  if (/^\d+\.\d+/.test(trimmed)) return trimmed;
  return "unknown";
}

/**
 * Scans a single site by running wp-cli commands.
 * Returns a WpSiteCache entry.
 */
export async function scanSite(
  domain: string,
  user: string,
  options: ScanOptions = {},
): Promise<WpSiteCache> {
  const base: WpSiteCache = {
    domain,
    wpVersion: "unknown",
    phpVersion: "unknown",
    tier: "unknown",
    plugins: [],
    scannedAt: new Date().toISOString(),
  };

  if (options.dryRun) return base;

  try {
    const baseArgs = buildWpCliArgs(domain, user);

    // Get WP core version
    const versionProc = Bun.spawn(["wp", "core", "version", ...baseArgs], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const versionOut = await new Response(versionProc.stdout).text();
    base.wpVersion = parseWpVersion(versionOut);

    // Get plugin list as JSON
    const pluginProc = Bun.spawn(
      [
        "wp",
        "plugin",
        "list",
        "--format=json",
        "--fields=name,version,update",
        ...baseArgs,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const pluginOut = await new Response(pluginProc.stdout).text();
    try {
      const rawPlugins = JSON.parse(pluginOut) as Array<{
        name: string;
        version: string;
        update: string;
      }>;
      base.plugins = rawPlugins.map((p) => ({
        name: p.name,
        version: p.version,
        updateAvailable: p.update === "available",
      }));
    } catch {
      // plugin list parse failed — leave as empty array
    }
  } catch {
    // wp-cli not available or site path missing — return defaults
  }

  return base;
}

/**
 * Scans all discovered sites sequentially.
 * Calls onProgress(line) with status lines as each site is processed.
 * Returns the array of WpSiteCache results.
 */
export async function scanAllSites(
  sites: DiscoveredSite[],
  onProgress: (line: string) => void,
  options: ScanOptions = {},
): Promise<WpSiteCache[]> {
  const results: WpSiteCache[] = [];

  for (const site of sites) {
    onProgress(`[wp-scan] scanning ${site.domain} (user: ${site.user})`);
    const entry = await scanSite(site.domain, site.user, options);
    results.push(entry);
    onProgress(`[wp-scan] done ${site.domain} — wp ${entry.wpVersion}`);
  }

  return results;
}
