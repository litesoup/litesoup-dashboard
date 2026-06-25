import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import type { ActivityLog } from "../types";

export function activityRoutes(db: Database) {
  const app = new Hono();

  app.get("/", (c) => {
    const server_id = c.req.query("server_id");
    const action = c.req.query("action");
    const status = c.req.query("status");

    let sql = "SELECT * FROM activity_log WHERE 1=1";
    const args: (string | number)[] = [];

    if (server_id) {
      sql += " AND server_id = ?";
      args.push(server_id);
    }
    if (action) {
      sql += " AND action = ?";
      args.push(action);
    }
    if (status) {
      sql += " AND status = ?";
      args.push(status);
    }

    sql += " ORDER BY started_at DESC LIMIT 100";

    const rows = db.query<ActivityLog, typeof args>(sql).all(...args);
    return c.json(rows);
  });

  return app;
}
