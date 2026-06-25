import { openDb } from "../src/db";
import { hashPassword } from "../src/auth";
import type { Database } from "bun:sqlite";
import type { Hono } from "hono";

export function createTestDb(): Database {
  return openDb(":memory:");
}

export async function seedAdmin(
  db: Database,
  email: string,
  password: string,
): Promise<void> {
  const hash = await hashPassword(password);
  db.run("INSERT OR REPLACE INTO admin (email, password) VALUES (?, ?)", [
    email,
    hash,
  ]);
}

export async function loginCookie(
  app: Hono,
  email: string,
  password: string,
): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/session=([^;]+)/);
  if (!match) throw new Error("login failed — no session cookie");
  return `session=${match[1]}`;
}
