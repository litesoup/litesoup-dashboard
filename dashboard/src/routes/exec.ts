import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import type { Database } from "bun:sqlite";
import { ulid } from "ulid";
import { resolveAgentUrl } from "../tunnel";
import type { Server, Site } from "../types";

export function execRoutes(db: Database) {
  const app = new Hono();

  function getServer(id: string): Server | null {
    return db
      .query<Server, [string]>("SELECT * FROM servers WHERE id = ?")
      .get(id);
  }

  function getSite(serverId: string, siteId: string): Site | null {
    return db
      .query<
        Site,
        [string, string]
      >("SELECT * FROM sites WHERE server_id = ? AND id = ?")
      .get(serverId, siteId);
  }

  function getActor(c: Context): string | null {
    const actor = c.get("actor");
    return typeof actor === "string" && actor ? actor : null;
  }

  async function runExecStream(
    c: Context,
    server: Server,
    command: string,
    params: Record<string, string>,
    actor: string,
    siteId: string | null = null,
    onDone?: (exitCode: number) => void,
  ) {
    const logId = ulid();
    db.run(
      `INSERT INTO activity_log (id, server_id, site_id, action, params, status, actor, started_at)
       VALUES (?, ?, ?, ?, ?, 'running', ?, ?)`,
      [
        logId,
        server.id,
        siteId,
        command,
        JSON.stringify(params),
        actor,
        Date.now(),
      ],
    );

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        data: JSON.stringify({ type: "start", id: logId }),
      });

      let output = "";
      let exitCode = 0;

      try {
        const agentRes = await resolveAgentUrl(server, (base) =>
          fetch(`${base}/exec`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command, params }),
          }),
        );

        const text = await agentRes.text();
        for (const line of text.split("\n").filter(Boolean)) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === "output") {
              output += parsed.line + "\n";
              await stream.writeSSE({
                data: JSON.stringify({ type: "output", line: parsed.line }),
              });
            } else if (parsed.type === "done") {
              exitCode = parsed.code ?? 0;
            }
          } catch {
            // skip malformed lines
          }
        }
      } catch (err) {
        exitCode = 1;
        await stream.writeSSE({
          data: JSON.stringify({ type: "output", line: String(err) }),
        });
      } finally {
        try {
          await stream.writeSSE({
            data: JSON.stringify({ type: "done", code: exitCode }),
          });
        } catch {
          /* client disconnected */
        }
        db.run(
          "UPDATE activity_log SET status = ?, output = ?, finished_at = ? WHERE id = ?",
          [exitCode === 0 ? "success" : "failed", output, Date.now(), logId],
        );
        onDone?.(exitCode);
      }
    });
  }

  // POST /api/servers/:id/sites → create site
  app.post("/:id/sites", async (c) => {
    const server = getServer(c.req.param("id"));
    if (!server) return c.json({ error: "not found" }, 404);

    const body = await c.req.json<Record<string, string>>().catch(() => ({}));
    if (!body.domain || !body.php_version || !body.tier || !body.tls_mode) {
      return c.json(
        { error: "domain, php_version, tier, tls_mode are required" },
        400,
      );
    }

    const actor = getActor(c);
    if (!actor) return c.json({ error: "unauthorized" }, 401);

    const git_repo = body.git_repo?.trim() || null;
    const git_branch = body.git_branch?.trim() || null;

    const params: Record<string, string> = {
      domain: body.domain,
      php_version: body.php_version,
      tier: body.tier,
      tls: body.tls_mode,
    };
    if (body.tls_email) params.email = body.tls_email;
    if (git_repo) params.git_repo = git_repo;
    if (git_branch) params.git_branch = git_branch;

    return runExecStream(
      c,
      server,
      "site.create",
      params,
      actor,
      null,
      (code) => {
        if (code === 0) {
          db.run(
            `INSERT INTO sites (id, server_id, domain, site_user, php_version, tier, tls_mode, synced_at, git_repo, git_branch)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(server_id, domain) DO UPDATE SET
             git_repo = excluded.git_repo,
             git_branch = excluded.git_branch`,
            [
              ulid(),
              server.id,
              body.domain,
              "www-data",
              body.php_version,
              body.tier,
              body.tls_mode,
              Date.now(),
              git_repo,
              git_branch,
            ],
          );
        }
      },
    );
  });

  // DELETE /api/servers/:id/sites/:siteId
  app.delete("/:id/sites/:siteId", async (c) => {
    const server = getServer(c.req.param("id"));
    if (!server) return c.json({ error: "not found" }, 404);
    const site = getSite(server.id, c.req.param("siteId"));
    if (!site) return c.json({ error: "not found" }, 404);

    const actor = getActor(c);
    if (!actor) return c.json({ error: "unauthorized" }, 401);
    return runExecStream(
      c,
      server,
      "site.delete",
      { domain: site.domain },
      actor,
      site.id,
    );
  });

  // POST /api/servers/:id/sites/:siteId/set-php
  app.post("/:id/sites/:siteId/set-php", async (c) => {
    const server = getServer(c.req.param("id"));
    if (!server) return c.json({ error: "not found" }, 404);
    const site = getSite(server.id, c.req.param("siteId"));
    if (!site) return c.json({ error: "not found" }, 404);

    const body = await c.req.json<{ php_version?: string }>().catch(() => ({}));
    if (!body.php_version)
      return c.json({ error: "php_version required" }, 400);

    const actor = getActor(c);
    if (!actor) return c.json({ error: "unauthorized" }, 401);
    return runExecStream(
      c,
      server,
      "site.set-php",
      { domain: site.domain, php_version: body.php_version },
      actor,
      site.id,
    );
  });

  // POST /api/servers/:id/sites/:siteId/set-tier
  app.post("/:id/sites/:siteId/set-tier", async (c) => {
    const server = getServer(c.req.param("id"));
    if (!server) return c.json({ error: "not found" }, 404);
    const site = getSite(server.id, c.req.param("siteId"));
    if (!site) return c.json({ error: "not found" }, 404);

    const body = await c.req.json<{ tier?: string }>().catch(() => ({}));
    if (!body.tier) return c.json({ error: "tier required" }, 400);

    const actor = getActor(c);
    if (!actor) return c.json({ error: "unauthorized" }, 401);
    return runExecStream(
      c,
      server,
      "site.set-tier",
      { domain: site.domain, tier: body.tier },
      actor,
      site.id,
    );
  });

  // POST /api/servers/:id/sites/:siteId/set-tls
  app.post("/:id/sites/:siteId/set-tls", async (c) => {
    const server = getServer(c.req.param("id"));
    if (!server) return c.json({ error: "not found" }, 404);
    const site = getSite(server.id, c.req.param("siteId"));
    if (!site) return c.json({ error: "not found" }, 404);

    const body = await c.req.json<{ tls_mode?: string; tls_email?: string }>().catch(() => ({}));
    if (!body.tls_mode) return c.json({ error: "tls_mode required" }, 400);

    const actor = getActor(c);
    if (!actor) return c.json({ error: "unauthorized" }, 401);

    const params: Record<string, string> = {
      domain: site.domain,
      tls: body.tls_mode,
    };
    if (body.tls_email) params.email = body.tls_email;

    return runExecStream(
      c,
      server,
      "site.set-tls",
      params,
      actor,
      site.id,
    );
  });

  // POST /api/servers/:id/wp-scan
  app.post("/:id/wp-scan", async (c) => {
    const server = getServer(c.req.param("id"));
    if (!server) return c.json({ error: "not found" }, 404);

    const actor = getActor(c);
    if (!actor) return c.json({ error: "unauthorized" }, 401);
    return runExecStream(c, server, "wp_scan", {}, actor);
  });

  return app;
}
