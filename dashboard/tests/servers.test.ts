import { createTestDb, seedAdmin, loginCookie } from "../testdata/helpers";
import { createApp } from "../src/app";

async function authedApp() {
  const db = createTestDb();
  await seedAdmin(db, "admin@test.com", "pass");
  const app = createApp(db);
  const cookie = await loginCookie(app, "admin@test.com", "pass");
  return { app, db, cookie };
}

describe("GET /api/servers", () => {
  it("returns empty array when no servers registered", async () => {
    const { app, cookie } = await authedApp();
    const res = await app.request("/api/servers", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns 401 without auth", async () => {
    const db = createTestDb();
    const app = createApp(db);
    const res = await app.request("/api/servers");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/servers", () => {
  it("creates a server and returns it with generated id", async () => {
    const { app, cookie } = await authedApp();
    const payload = {
      name: "sg9",
      hostname: "sg9.codetot.org",
      ssh_user: "root",
      ssh_port: 22,
      ssh_key_path: "/root/.ssh/id_ed25519",
      agent_direct_url: "http://127.0.0.1:7777",
    };

    const res = await app.request("/api/servers", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.name).toBe("sg9");
    expect(body.agent_direct_url).toBe("http://127.0.0.1:7777");
    expect(body.status).toBe("unknown");
  });

  it("returns 400 when hostname is missing", async () => {
    const { app, cookie } = await authedApp();
    const res = await app.request("/api/servers", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "sg9" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is missing", async () => {
    const { app, cookie } = await authedApp();
    const res = await app.request("/api/servers", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        hostname: "sg9.codetot.org",
        ssh_key_path: "/root/.ssh/id_ed25519",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when ssh_key_path is missing", async () => {
    const { app, cookie } = await authedApp();
    const res = await app.request("/api/servers", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "sg9", hostname: "sg9.codetot.org" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/servers/:id", () => {
  it("returns 404 for unknown server", async () => {
    const { app, cookie } = await authedApp();
    const res = await app.request("/api/servers/nonexistent", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it("returns server by id", async () => {
    const { app, cookie } = await authedApp();

    const createRes = await app.request("/api/servers", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "sg9",
        hostname: "sg9.codetot.org",
        ssh_user: "root",
        ssh_port: 22,
        ssh_key_path: "/root/.ssh/id_ed25519",
        agent_direct_url: null,
      }),
    });
    const { id } = await createRes.json();

    const res = await app.request(`/api/servers/${id}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.hostname).toBe("sg9.codetot.org");
  });
});

describe("GET /api/activity", () => {
  it("returns empty array when no activity logged", async () => {
    const { app, cookie } = await authedApp();
    const res = await app.request("/api/activity", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("filters by server_id query param", async () => {
    const { app, cookie } = await authedApp();
    const res = await app.request("/api/activity?server_id=nonexistent", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
