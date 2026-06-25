import { readdir, readFile } from "fs/promises";
import { join } from "path";

const DEFAULT_VHOSTS_DIR = "/etc/apache2/sites-enabled";

function vhostsDir(): string {
  return process.env.VHOSTS_DIR ?? DEFAULT_VHOSTS_DIR;
}

export interface DiscoveredSite {
  domain: string;
  user: string;
}

/**
 * Parses Apache vhost .conf files to discover managed sites.
 * Extracts ServerName and the first token of AssignUserId per vhost block.
 * Returns empty array if the directory does not exist or has no .conf files.
 */
export async function discoverSites(): Promise<DiscoveredSite[]> {
  const dir = vhostsDir();

  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".conf")).map((f) => join(dir, f));
  } catch {
    return [];
  }

  const sites: DiscoveredSite[] = [];

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const serverNameMatch = content.match(/^\s*ServerName\s+(\S+)/m);
      const assignUserMatch = content.match(/^\s*AssignUserId\s+(\S+)/m);

      if (!serverNameMatch) continue;

      const domain = serverNameMatch[1];
      const user = assignUserMatch ? assignUserMatch[1] : "www-data";

      sites.push({ domain, user });
    } catch {
      // skip unreadable files
    }
  }

  return sites;
}
