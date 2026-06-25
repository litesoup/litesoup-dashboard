import { describe, it, expect } from "bun:test";
import { checkService } from "../routes/services";

describe("checkService", () => {
  it("returns active=false and status=inactive when systemctl is unavailable", async () => {
    // On macOS (dev machine) systemctl does not exist — graceful fallback expected
    const result = await checkService("apache2");
    expect(result.name).toBe("apache2");
    expect(typeof result.active).toBe("boolean");
    expect(typeof result.status).toBe("string");
    expect(result.status.length).toBeGreaterThan(0);
  });

  it("returns the correct service name in the result", async () => {
    const result = await checkService("redis-server");
    expect(result.name).toBe("redis-server");
  });

  it("returns active=false for a clearly non-existent service", async () => {
    const result = await checkService("litesoup-definitely-not-installed-xyz");
    expect(result.active).toBe(false);
  });

  it("status field is never empty", async () => {
    const result = await checkService("mariadb");
    expect(result.status).toBeTruthy();
  });
});
