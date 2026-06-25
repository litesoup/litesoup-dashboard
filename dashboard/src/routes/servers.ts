import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import { ulid } from "ulid";
import type { Server } from "../types";

export function serverRoutes(db: Database) {
  const app = new Hono();

  app.get("/", (c) => {
    const servers = db
      .query<Server, []>("SELECT * FROM servers ORDER BY added_at DESC")
      .all();
    return c.json(servers);
  });

  app.post("/", async (c) => {
    const body = await c.req.json<Partial<Server>>().catch(() => ({}));
    if (!body.name || !body.hostname || !body.ssh_key_path) {
      return c.json(
        { error: "name, hostname, ssh_key_path are required" },
        400,
      );
    }

    const id = ulid();
    const now = Date.now();
    db.run(
      `INSERT INTO servers (id, name, hostname, ssh_user, ssh_port, ssh_key_path, agent_direct_url, status, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'unknown', ?)`,
      [
        id,
        body.name,
        body.hostname,
        body.ssh_user ?? "root",
        body.ssh_port ?? 22,
        body.ssh_key_path,
        body.agent_direct_url ?? null,
        now,
      ],
    );

    const server = db
      .query<Server, [string]>("SELECT * FROM servers WHERE id = ?")
      .get(id)!;
    return c.json(server, 201);
  });

  app.get("/:id", (c) => {
    const server = db
      .query<Server, [string]>("SELECT * FROM servers WHERE id = ?")
      .get(c.req.param("id"));
    if (!server) return c.json({ error: "not found" }, 404);
    return c.json(server);
  });

  return app;
}
