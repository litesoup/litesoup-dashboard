import { createTestDb, seedAdmin, loginCookie } from "../testdata/helpers";
import { createApp } from "../src/app";
import { migrate } from "../src/db";
import { Database } from "bun:sqlite";
import {
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  authMiddleware,
} from "../src/auth";

describe("GET /health", () => {
  it("returns 200 ok", async () => {
    const db = createTestDb();
    const app = createApp(db);
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});

describe("migrate()", () => {
  it("creates all tables idempotently", () => {
    const db = new Database(":memory:");
    migrate(db);
    migrate(db); // second call must not throw

    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table'",
      )
      .all()
      .map((r) => r.name)
      .sort();

    expect(tables).toEqual([
      "activity_log",
      "admin",
      "registration_tokens",
      "servers",
      "sites",
    ]);
  });

  it("servers table has agent_direct_url column", () => {
    const db = new Database(":memory:");
    migrate(db);
    const cols = db
      .query<{ name: string }, []>("PRAGMA table_info(servers)")
      .all()
      .map((r) => r.name);
    expect(cols).toContain("agent_direct_url");
  });

  it("prunes local hostname records on migrate", () => {
    const db = new Database(":memory:");
    migrate(db);

    db.run(
      `INSERT INTO servers (id, name, hostname, ssh_user, ssh_port, ssh_key_path, agent_direct_url, status, added_at)
       VALUES (?, ?, ?, 'root', 22, '/root/.ssh/id_ed25519', null, 'unknown', ?)`,
      ["server-1", "local", "VM-06f0101a-15b1-4886-a955-d0630795c0a5.cs1local", 1],
    );
    db.run(
      `INSERT INTO servers (id, name, hostname, ssh_user, ssh_port, ssh_key_path, agent_direct_url, status, added_at)
       VALUES (?, ?, ?, 'root', 22, '/root/.ssh/id_ed25519', null, 'unknown', ?)`,
      ["server-2", "public", "sg9.codetot.org", 2],
    );

    migrate(db);

    const hostnames = db
      .query<{ hostname: string }, []>(
        "SELECT hostname FROM servers ORDER BY added_at",
      )
      .all()
      .map((row) => row.hostname);

    expect(hostnames).toEqual(["sg9.codetot.org"]);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("verifies matching password", async () => {
    const hash = await hashPassword("secret");
    expect(await verifyPassword("secret", hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("secret");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("signJwt / verifyJwt", () => {
  it("round-trips a payload", async () => {
    const token = await signJwt({ email: "admin@example.com" }, "test-secret");
    const payload = await verifyJwt(token, "test-secret");
    expect(payload.email).toBe("admin@example.com");
  });

  it("throws on tampered token", async () => {
    const token = await signJwt({ email: "a@b.com" }, "secret");
    await expect(verifyJwt(token + "x", "secret")).rejects.toThrow();
  });

  it("throws on expired token", async () => {
    // Sign with exp in the past (epoch second 1 = Jan 1, 1970)
    const token = await signJwt({ email: "a@b.com", exp: 1 }, "dev-secret");
    await expect(verifyJwt(token, "dev-secret")).rejects.toThrow();
  });
});

describe("authMiddleware", () => {
  it("returns 401 when JWT cookie is absent", async () => {
    const db = createTestDb();
    const app = createApp(db);
    const res = await app.request("/api/servers");
    expect(res.status).toBe(401);
  });

  it("returns 401 when JWT is tampered", async () => {
    const db = createTestDb();
    const app = createApp(db);
    const res = await app.request("/api/servers", {
      headers: { Cookie: "session=bad.token.value" },
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/login", () => {
  it("returns 200 and sets httpOnly cookie on valid credentials", async () => {
    const db = createTestDb();
    await seedAdmin(db, "admin@example.com", "correct-pass");
    const app = createApp(db);

    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@example.com",
        password: "correct-pass",
      }),
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("session=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("returns 401 on wrong password", async () => {
    const db = createTestDb();
    await seedAdmin(db, "admin@example.com", "correct-pass");
    const app = createApp(db);

    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "wrong" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 on unknown email", async () => {
    const db = createTestDb();
    const app = createApp(db);

    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "x" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 when body is missing email or password", async () => {
    const db = createTestDb();
    const app = createApp(db);

    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const db = createTestDb();
    await seedAdmin(db, "admin@example.com", "pass");
    const app = createApp(db);
    const cookie = await loginCookie(app, "admin@example.com", "pass");

    const res = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("session=;");
  });
});
