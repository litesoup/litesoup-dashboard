import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import type { Database } from "bun:sqlite";
import { verifyPassword, signJwt, verifyJwt, hashPassword } from "../auth";

export function authRoutes(db: Database, jwtSecret: string) {
  const app = new Hono();

  app.post("/login", async (c) => {
    let body: { email?: string; password?: string } = {};
    try {
      body = await c.req.json<{ email?: string; password?: string }>();
    } catch {
      // Invalid JSON or missing body
    }

    const { email, password } = body;
    if (!email || !password) {
      return c.json({ error: "email and password required" }, 400);
    }

    const row = db
      .query<
        { email: string; password: string },
        [string]
      >("SELECT email, password FROM admin WHERE email = ?")
      .get(email);

    if (!row || !(await verifyPassword(password, row.password))) {
      return c.json({ error: "invalid credentials" }, 401);
    }

    const token = await signJwt({ email }, jwtSecret);
    setCookie(c, "session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return c.json({ ok: true });
  });

  app.post("/logout", (c) => {
    deleteCookie(c, "session", { path: "/" });
    return c.json({ ok: true });
  });

  app.post("/change-password", async (c) => {
    // Manually verify JWT since this is inside the public authRoutes function
    const { getCookie } = await import("hono/cookie");
    const token = getCookie(c, "session");
    if (!token) return c.json({ error: "not authenticated" }, 401);

    let email: string;
    try {
      const payload = await verifyJwt(token, jwtSecret);
      email = payload.email as string;
    } catch {
      return c.json({ error: "not authenticated" }, 401);
    }

    let body: { current_password?: string; new_password?: string } = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid request body" }, 400);
    }

    const { current_password, new_password } = body;
    if (!current_password || !new_password) {
      return c.json(
        { error: "current_password and new_password required" },
        400,
      );
    }

    const row = db
      .query<
        { password: string },
        [string]
      >("SELECT password FROM admin WHERE email = ?")
      .get(email);

    if (!row || !(await verifyPassword(current_password, row.password))) {
      return c.json({ error: "current password incorrect" }, 401);
    }

    const newHash = await hashPassword(new_password);
    db.run("UPDATE admin SET password = ? WHERE email = ?", [newHash, email]);
    return c.json({ ok: true });
  });

  return app;
}
