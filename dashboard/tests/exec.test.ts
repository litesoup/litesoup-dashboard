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

function mockAgentNdjson(lines: string[]) {
  const ndjson =
    lines.join("\n") + "\n" + JSON.stringify({ type: "done", code: 0 }) + "\n";
  return mock(() =>
    Promise.resolve(
      new Response(ndjson, {
        headers: { "Content-Type": "application/x-ndjson" },
      }),
    ),
  );
}

describe("POST /api/servers/:id/sites (create site)", () => {
  it("returns 400 when domain is missing", async () => {
    const { app, cookie, serverId } = await appWithServer();
    const res = await app.request(`/api/servers/${serverId}/sites`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ php_version: "8.2" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns SSE stream and logs activity on success", async () => {
    const { app, db, cookie, serverId } = await appWithServer();

    globalThis.fetch = mockAgentNdjson([
      JSON.stringify({ type: "output", line: "Creating site..." }),
    ]);

    const res = await app.request(`/api/servers/${serverId}/sites`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: "example.com",
        php_version: "8.2",
        tier: "small",
        tls_mode: "letsencrypt",
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const body = await res.text();
    expect(body).toContain("data:");

    const log = db
      .query<
        { status: string; action: string },
        []
      >("SELECT status, action FROM activity_log LIMIT 1")
      .get();
    expect(log).toBeTruthy();
    expect(log!.action).toBe("site.create");
  });
});

describe("DELETE /api/servers/:id/sites/:siteId", () => {
  it("returns 404 for unknown site", async () => {
    const { app, cookie, serverId } = await appWithServer();
    const res = await app.request(`/api/servers/${serverId}/sites/nosuchsite`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });
});
