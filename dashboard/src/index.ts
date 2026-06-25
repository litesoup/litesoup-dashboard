import { getDb } from "./db";
import { createApp } from "./app";

const db = getDb();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET env var is required");

const app = createApp(db, jwtSecret);

const port = parseInt(process.env.PORT ?? "3000", 10);
console.log(`litesoup-dashboard listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
};
