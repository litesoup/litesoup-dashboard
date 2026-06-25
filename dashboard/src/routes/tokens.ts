import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import { ulid } from "ulid";
import { randomBytes } from "crypto";

interface RegistrationToken {
  id: string;
  token: string;
  expires_at: number;
  used_at: number | null;
  server_id: string | null;
  created_at: number;
}

export function tokenPublicRoutes(db: Database) {
  const app = new Hono();

  // GET /api/setup?token=X — returns bash script as plain text
  app.get("/setup", (c) => {
    const token = c.req.query("token");
    if (!token) return c.text("token required", 400);

    const row = db
      .query<
        RegistrationToken,
        [string]
      >("SELECT * FROM registration_tokens WHERE token = ?")
      .get(token);
    if (!row || row.expires_at < Date.now()) {
      return c.text("token invalid or expired", 400);
    }

    const proto =
      c.req.header("x-forwarded-proto") ??
      (c.req.header("host")?.includes("localhost") ? "http" : "https");
    const host = c.req.header("host") ?? "localhost:3000";
    const dashboardUrl = `${proto}://${host}`;

    const script = `#!/usr/bin/env bash
set -euo pipefail

TOKEN="${token}"
DASHBOARD="${dashboardUrl}"

echo "==> Registering with litesoup dashboard..."

NAME=$(hostname -f 2>/dev/null || hostname)
SERVER_HOST="\${SERVER_HOST:-}"
if [ -z "$SERVER_HOST" ] && [ -n "\${SSH_HOST:-}" ]; then
  SERVER_HOST="$SSH_HOST"
fi
if [ -z "$SERVER_HOST" ]; then
  SERVER_HOST=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

case "$SERVER_HOST" in
  ""|localhost|127.*|*.local|*.lan|*.home|*.cs1local)
    echo "Set SERVER_HOST to the real DNS name or IP used for SSH (not the local hostname)." >&2
    exit 1
    ;;
esac

RESULT=$(curl -fsSL -X POST "$DASHBOARD/api/register" \\
  -H "Content-Type: application/json" \\
  -d "{\\"token\\":\\"$TOKEN\\",\\"name\\":\\"$NAME\\",\\"hostname\\":\\"$SERVER_HOST\\"}")

echo "$RESULT"
echo ""
echo "Done. Refresh your dashboard to see the server."
`;

    return c.text(script, 200, { "Content-Type": "text/plain" });
  });

  // POST /api/register — called by the bash script
  app.post("/register", async (c) => {
    const body = await c.req
      .json<{ token?: string; name?: string; hostname?: string }>()
      .catch(() => ({}));
    if (!body.token || !body.name || !body.hostname) {
      return c.json({ error: "token, name, hostname are required" }, 400);
    }

    const row = db
      .query<
        RegistrationToken,
        [string]
      >("SELECT * FROM registration_tokens WHERE token = ?")
      .get(body.token);

    if (!row) return c.json({ error: "invalid token" }, 400);
    if (row.expires_at < Date.now())
      return c.json({ error: "token expired" }, 400);
    if (row.used_at !== null)
      return c.json({ error: "token already used" }, 400);

    const serverId = ulid();
    const now = Date.now();

    db.transaction(() => {
      db.run(
        `INSERT INTO servers (id, name, hostname, ssh_user, ssh_port, ssh_key_path, agent_direct_url, status, added_at)
         VALUES (?, ?, ?, 'root', 22, '', null, 'unknown', ?)`,
        [serverId, body.name, body.hostname, now],
      );
      db.run(
        "UPDATE registration_tokens SET used_at = ?, server_id = ? WHERE id = ?",
        [now, serverId, row.id],
      );
    })();

    return c.json({ ok: true, server_id: serverId });
  });

  return app;
}

export function tokenProtectedRoutes(db: Database) {
  const app = new Hono();

  // POST /api/tokens — create a new registration token (15 min expiry)
  app.post("/tokens", (c) => {
    const id = ulid();
    const token = randomBytes(8).toString("hex");
    const now = Date.now();
    const expires_at = now + 15 * 60 * 1000;

    db.run(
      "INSERT INTO registration_tokens (id, token, expires_at, created_at) VALUES (?, ?, ?, ?)",
      [id, token, expires_at, now],
    );

    return c.json({ id, token, expires_at }, 201);
  });

  // GET /api/tokens/:id/status — poll registration status
  app.get("/tokens/:id/status", (c) => {
    const row = db
      .query<
        RegistrationToken,
        [string]
      >("SELECT * FROM registration_tokens WHERE id = ?")
      .get(c.req.param("id"));

    if (!row) return c.json({ error: "not found" }, 404);

    if (row.server_id) {
      return c.json({ status: "registered", server_id: row.server_id });
    }
    if (row.expires_at < Date.now()) {
      return c.json({ status: "expired" });
    }
    return c.json({ status: "pending" });
  });

  return app;
}
