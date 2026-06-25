import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import { ulid } from "ulid";
import { resolveAgentUrl } from "../tunnel";
import type { Server, Site } from "../types";

export function agentRoutes(db: Database) {
  const app = new Hono();

  function getServer(id: string): Server | null {
    return db
      .query<Server, [string]>("SELECT * FROM servers WHERE id = ?")
      .get(id);
  }

  async function proxyAgent(server: Server, path: string): Promise<Response> {
    return resolveAgentUrl(server, (base) => fetch(`${base}${path}`));
  }

  app.get("/:id/metrics", async (c) => {
    const server = getServer(c.req.param("id"));
    if (!server) return c.json({ error: "not found" }, 404);

    try {
      const res = await proxyAgent(server, "/metrics");
      db.run("UPDATE servers SET status = 'active' WHERE id = ?", [server.id]);
      return c.json(await res.json());
    } catch {
      db.run("UPDATE servers SET status = 'offline' WHERE id = ?", [server.id]);
      return c.json({ error: "agent unreachable" }, 502);
    }
  });

  app.get("/:id/services", async (c) => {
    const server = getServer(c.req.param("id"));
    if (!server) return c.json({ error: "not found" }, 404);

    try {
      const res = await proxyAgent(server, "/services");
      return c.json(await res.json());
    } catch {
      return c.json({ error: "agent unreachable" }, 502);
    }
  });

  app.get("/:id/sync", async (c) => {
    const server = getServer(c.req.param("id"));
    if (!server) return c.json({ error: "not found" }, 404);

    let agentData: {
      sites: Array<{
        domain: string;
        user: string;
        php_version: string;
        tier: string;
        tls_mode: string;
        wp_version?: string | null;
        plugins_need_update?: number | null;
        themes_need_update?: number | null;
        wp_scanned_at?: number | null;
      }>;
    };
    try {
      const res = await proxyAgent(server, "/sites");
      agentData = await res.json();
    } catch {
      return c.json({ error: "agent unreachable" }, 502);
    }

    if (!Array.isArray(agentData.sites)) {
      return c.json({ error: "agent returned unexpected response" }, 502);
    }

    const now = Date.now();
    const reportedDomains = agentData.sites.map((s) => s.domain);

    db.transaction(() => {
      // Upsert each reported site
      for (const s of agentData.sites) {
        db.run(
          `INSERT INTO sites (id, server_id, domain, site_user, php_version, tier, tls_mode, synced_at,
                             wp_version, plugins_need_update, themes_need_update, wp_scanned_at,
                             git_repo, git_branch)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(server_id, domain) DO UPDATE SET
             site_user=excluded.site_user,
             php_version=excluded.php_version,
             tier=excluded.tier,
             tls_mode=excluded.tls_mode,
             synced_at=excluded.synced_at,
             wp_version=CASE WHEN excluded.wp_scanned_at IS NOT NULL THEN excluded.wp_version ELSE wp_version END,
             plugins_need_update=CASE WHEN excluded.wp_scanned_at IS NOT NULL THEN excluded.plugins_need_update ELSE plugins_need_update END,
             themes_need_update=CASE WHEN excluded.wp_scanned_at IS NOT NULL THEN excluded.themes_need_update ELSE themes_need_update END,
             wp_scanned_at=CASE WHEN excluded.wp_scanned_at IS NOT NULL THEN excluded.wp_scanned_at ELSE wp_scanned_at END,
             git_repo = CASE WHEN sites.git_repo IS NOT NULL THEN sites.git_repo ELSE excluded.git_repo END,
             git_branch = CASE WHEN sites.git_repo IS NOT NULL THEN sites.git_branch ELSE excluded.git_branch END`,
          [
            ulid(),
            server.id,
            s.domain,
            s.user,
            s.php_version,
            s.tier,
            s.tls_mode,
            now,
            s.wp_version ?? null,
            s.plugins_need_update ?? 0,
            s.themes_need_update ?? 0,
            s.wp_scanned_at ?? null,
            null,
            null,
          ],
        );
      }

      // Remove sites no longer on the agent
      if (reportedDomains.length > 0) {
        const placeholders = reportedDomains.map(() => "?").join(", ");
        db.run(
          `DELETE FROM sites WHERE server_id = ? AND domain NOT IN (${placeholders})`,
          [server.id, ...reportedDomains],
        );
      } else {
        // Agent reports zero sites — remove all cached sites for this server
        db.run("DELETE FROM sites WHERE server_id = ?", [server.id]);
      }
    })();

    return c.json({ synced: agentData.sites.length });
  });

  app.get("/:id/sites", (c) => {
    const server = getServer(c.req.param("id"));
    if (!server) return c.json({ error: "not found" }, 404);
    const sites = db
      .query<Site, [string]>("SELECT * FROM sites WHERE server_id = ?")
      .all(server.id);
    return c.json(sites);
  });

  app.get("/:id/sites/:siteId", (c) => {
    const server = getServer(c.req.param("id"));
    if (!server) return c.json({ error: "not found" }, 404);

    const site = db
      .query<
        Site,
        [string, string]
      >("SELECT * FROM sites WHERE server_id = ? AND id = ?")
      .get(c.req.param("id"), c.req.param("siteId"));
    if (!site) return c.json({ error: "not found" }, 404);
    return c.json(site);
  });

  return app;
}
