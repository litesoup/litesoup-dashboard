import { compare, hash } from "bcryptjs";
import { sign, verify } from "hono/jwt";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(password, passwordHash);
}

export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  return sign(
    { exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, ...payload },
    secret,
    "HS256",
  );
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<Record<string, unknown>> {
  return verify(token, secret, "HS256") as Promise<Record<string, unknown>>;
}

export function authMiddleware(secret: string): MiddlewareHandler {
  return async (c: Context, next) => {
    const token = getCookie(c, "session");
    if (!token) {
      return c.json({ error: "unauthorized" }, 401);
    }
    try {
      const payload = await verifyJwt(token, secret);
      const email = payload.email;
      if (typeof email !== "string" || !email) {
        return c.json({ error: "unauthorized" }, 401);
      }
      c.set("actor", email);
    } catch {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  };
}
