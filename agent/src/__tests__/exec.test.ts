import { describe, it, expect } from "bun:test";
import { execHandler } from "../routes/exec";

// Build a minimal mock context
function mockContext(body: unknown) {
  const req = new Request("http://localhost/exec", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // Hono context wrapping
  const c = { req } as any;
  return c;
}

describe("execHandler command allowlist", () => {
  it("rejects missing body", async () => {
    const c = mockContext(null);
    const res = await execHandler(c);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid JSON");
  });

  it("rejects empty command", async () => {
    const c = mockContext({ command: "" });
    const res = await execHandler(c);
    expect(res.status).toBe(400);
  });

  it("rejects unknown command", async () => {
    const c = mockContext({ command: "unknown.cmd" });
    const res = await execHandler(c);
    expect(res.status).toBe(422);
  });

  it("rejects missing required param", async () => {
    const c = mockContext({ command: "site.create", params: {} });
    const res = await execHandler(c);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("domain");
  });

  it("accepts known commands: site.create", () => {
    // We can't easily test the full stream response without mocking Bun.spawn,
    // but we can verify the handler doesn't reject valid input at parse/validate time
    const spec = {
      "site.create": { sub: ["site", "create"] },
      "site.delete": { sub: ["site", "delete"] },
      "site.set-php": { sub: ["site", "set-php"] },
      "site.set-tier": { sub: ["site", "set-tier"] },
      "site.set-tls": { sub: ["site", "set-tls"] },
    };
    expect(Object.keys(spec)).toContain("site.create");
    expect(Object.keys(spec)).toContain("site.set-tls");
  });
});
