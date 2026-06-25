import { openDb } from "./db";
import { hashPassword } from "./auth";

const [, , command, ...args] = process.argv;

if (command === "setup-admin") {
  const email = args[0] ?? process.env.ADMIN_EMAIL;
  const password = args[1] ?? process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Usage: bun run src/cli.ts setup-admin <email> <password>");
    console.error("  or set ADMIN_EMAIL and ADMIN_PASSWORD env vars");
    process.exit(1);
  }

  const db = openDb(
    process.env.DB_PATH ?? "/var/lib/litesoup-dashboard/db.sqlite",
  );
  const hash = await hashPassword(password);
  db.run("INSERT OR REPLACE INTO admin (email, password) VALUES (?, ?)", [
    email,
    hash,
  ]);
  console.log(`Admin account set for ${email}`);
  process.exit(0);
} else {
  console.error(`Unknown command: ${command}`);
  console.error("Available commands: setup-admin");
  process.exit(1);
}
