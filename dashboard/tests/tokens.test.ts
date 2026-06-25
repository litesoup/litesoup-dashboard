import { createApp } from "../src/app";
import { createTestDb } from "../testdata/helpers";
import { ulid } from "ulid";

describe("GET /api/setup", () => {
  it("requires a real SSH host and does not auto-register local hostnames", async () => {
    const db = createTestDb();
    const token = "test-token";
    const tokenId = ulid();
    const now = Date.now();

    db.run(
      "INSERT INTO registration_tokens (id, token, expires_at, created_at) VALUES (?, ?, ?, ?)",
      [tokenId, token, now + 15 * 60 * 1000, now],
    );

    const app = createApp(db);
    const res = await app.request(`/api/setup?token=${token}`);

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("SERVER_HOST");
    expect(body).toContain("Set SERVER_HOST to the real DNS name or IP used for SSH");
    expect(body).not.toContain('"hostname":"$HOSTNAME"');
  });
});
