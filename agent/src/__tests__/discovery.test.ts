import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { discoverSites } from "../discovery";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

beforeEach(() => {
  process.env.VHOSTS_DIR = FIXTURES_DIR;
});

afterEach(() => {
  delete process.env.VHOSTS_DIR;
});

describe("discoverSites", () => {
  it("discovers sites from fixture vhost conf files", async () => {
    const sites = await discoverSites();
    const domains = sites.map((s) => s.domain);
    expect(domains).toContain("example.com");
    expect(domains).toContain("another-site.com");
  });

  it("extracts the correct user for each site", async () => {
    const sites = await discoverSites();
    const exampleSite = sites.find((s) => s.domain === "example.com");
    expect(exampleSite).toBeDefined();
    expect(exampleSite!.user).toBe("example-user");

    const anotherSite = sites.find((s) => s.domain === "another-site.com");
    expect(anotherSite).toBeDefined();
    expect(anotherSite!.user).toBe("another-user");
  });

  it("skips conf files without ServerName", async () => {
    const sites = await discoverSites();
    // no-servername.conf has no ServerName — should not appear with empty domain
    expect(
      sites.every((s) => typeof s.domain === "string" && s.domain.length > 0),
    ).toBe(true);
  });

  it("returns empty array when vhosts dir does not exist", async () => {
    process.env.VHOSTS_DIR = "/nonexistent/path/sites-enabled";
    const sites = await discoverSites();
    expect(sites).toEqual([]);
  });

  it("returns empty array when vhosts dir has no .conf files", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "litesoup-vhosts-empty-"));
    process.env.VHOSTS_DIR = emptyDir;
    try {
      const sites = await discoverSites();
      expect(sites).toEqual([]);
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });
});
