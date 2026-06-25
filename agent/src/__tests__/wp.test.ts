import { describe, it, expect } from "bun:test";
import { buildWpCliArgs, parseWpVersion, scanAllSites } from "../wp";
import type { DiscoveredSite } from "../discovery";

describe("buildWpCliArgs", () => {
  it("returns wp-cli path argument for a given domain and user", () => {
    const args = buildWpCliArgs("example.com", "example-user");
    expect(args).toContain("--path=/home/example-user/webapps/example.com");
  });

  it("includes allow-root flag", () => {
    const args = buildWpCliArgs("test.com", "testuser");
    expect(args).toContain("--allow-root");
  });
});

describe("parseWpVersion", () => {
  it("extracts version from wp core version output", () => {
    const version = parseWpVersion("6.5.3\n");
    expect(version).toBe("6.5.3");
  });

  it("returns unknown for empty output", () => {
    const version = parseWpVersion("");
    expect(version).toBe("unknown");
  });

  it("returns unknown for non-version output", () => {
    const version = parseWpVersion("Error: WordPress files not found.");
    expect(version).toBe("unknown");
  });

  it("handles output with extra whitespace", () => {
    const version = parseWpVersion("  6.6.1  \n");
    expect(version).toBe("6.6.1");
  });
});

describe("scanAllSites", () => {
  it("calls onProgress for each site processed", async () => {
    const sites: DiscoveredSite[] = [
      { domain: "a.com", user: "usera" },
      { domain: "b.com", user: "userb" },
    ];
    const lines: string[] = [];
    // scanAllSites with dryRun=true skips actual wp-cli calls
    await scanAllSites(sites, (line) => lines.push(line), { dryRun: true });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.includes("a.com"))).toBe(true);
    expect(lines.some((l) => l.includes("b.com"))).toBe(true);
  });

  it("returns one result per site", async () => {
    const sites: DiscoveredSite[] = [
      { domain: "x.com", user: "userx" },
      { domain: "y.com", user: "usery" },
    ];
    const results = await scanAllSites(sites, () => {}, { dryRun: true });
    expect(results).toHaveLength(2);
    expect(results[0].domain).toBe("x.com");
    expect(results[1].domain).toBe("y.com");
  });

  it("returns unknown fields when dryRun is true", async () => {
    const sites: DiscoveredSite[] = [{ domain: "z.com", user: "userz" }];
    const results = await scanAllSites(sites, () => {}, { dryRun: true });
    expect(results[0].phpVersion).toBe("unknown");
    expect(results[0].tier).toBe("unknown");
  });

  it("returns empty array for empty sites input", async () => {
    const results = await scanAllSites([], () => {}, { dryRun: true });
    expect(results).toEqual([]);
  });
});
