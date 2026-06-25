import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { Database } from "bun:sqlite";
import { authMiddleware } from "./auth";
import { authRoutes } from "./routes/auth";
import { serverRoutes } from "./routes/servers";
import { agentRoutes } from "./routes/agent";
import { execRoutes } from "./routes/exec";
import { activityRoutes } from "./routes/activity";
import { tokenPublicRoutes, tokenProtectedRoutes } from "./routes/tokens";

export function createApp(db: Database, jwtSecret = "dev-secret") {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.route("/api/auth", authRoutes(db, jwtSecret));
  app.route("/api", tokenPublicRoutes(db));
  app.use("/api/*", authMiddleware(jwtSecret));
  app.route("/api/servers", serverRoutes(db));
  app.route("/api/servers", agentRoutes(db));
  app.route("/api/servers", execRoutes(db));
  app.route("/api/activity", activityRoutes(db));
  app.route("/api", tokenProtectedRoutes(db));

  // Serve built SPA. Falls back to index.html for client-side routes.
  app.use("/*", serveStatic({ root: "./public" }));
  app.get("/*", serveStatic({ path: "./public/index.html" }));

  return app;
}
