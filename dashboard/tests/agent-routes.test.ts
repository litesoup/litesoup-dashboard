import { createTestDb, seedAdmin, loginCookie } from "../testdata/helpers";
import { createApp } from "../src/app";
import { mock, afterEach, describe, it, expect } from "bun:test";

const origFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = origFetch;
});

async function appWithServer() {
  const db = createTestDb();
  await seedAdmin(db, "admin@test.com", "pass");
  const app = createApp(db);
  const cookie = await loginCookie(app, "admin@test.com", "pass");

  const createRes = await app.request("/api/servers", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "sg9",
      hostname: "sg9.codetot.org",
      ssh_user: "root",
      ssh_port: 22,
      ssh_key_path: "/root/.ssh/id_ed25519",
      agent_direct_url: "http://127.0.0.1:7777",
    }),
  });
  const { id: serverId } = await createRes.json();
  return { app, db, cookie, serverId };
}

describe("GET /api/servers/:id/metrics", () => {
  it("proxies response from agent and marks server online", async () => {
    const { app, db, cookie, serverId } = await appWithServer();

    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            cpu_percent: 12.5,
            ram_used_mb: 2048,
            ram_total_mb: 8192,
            disk_used_gb: 20,
            disk_total_gb: 100,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const res = await app.request(`/api/servers/${serverId}/metrics`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cpu_percent).toBe(12.5);

    const srv = db
      .query<
        { status: string },
        [string]
      >("SELECT status FROM servers WHERE id = ?")
      .get(serverId);
    expect(srv?.status).toBe("active");
  });

  it("returns 502 and marks server offline when agent unreachable", async () => {
    const { app, db, cookie, serverId } = await appWithServer();

    globalThis.fetch = mock(() => Promise.reject(new Error("ECONNREFUSED")));

    const res = await app.request(`/api/servers/${serverId}/metrics`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(502);
    const srv = db
      .query<
        { status: string },
        [string]
      >("SELECT status FROM servers WHERE id = ?")
      .get(serverId);
    expect(srv?.status).toBe("offline");
  });

  it("returns 404 for unknown server", async () => {
    const db = createTestDb();
    await seedAdmin(db, "admin@test.com", "pass");
    const app = createApp(db);
    const cookie = await loginCookie(app, "admin@test.com", "pass");

    const res = await app.request("/api/servers/unknown-id/metrics", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/servers/:id/sync", () => {
  it("upserts sites from agent into DB", async () => {
    const { app, db, cookie, serverId } = await appWithServer();

    const agentSites = [
      {
        domain: "example.com",
        user: "example",
        php_version: "8.2",
        tier: "small",
        tls_mode: "letsencrypt",
      },
    ];
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ sites: agentSites }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const res = await app.request(`/api/servers/${serverId}/sync`, {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(1);

    const sites = db
      .query<
        { domain: string },
        [string]
      >("SELECT domain FROM sites WHERE server_id = ?")
      .all(serverId);
    expect(sites[0].domain).toBe("example.com");
  });
});
