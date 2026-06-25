import type { Context } from "hono";

export interface ServiceStatus {
  name: string;
  active: boolean;
  status: string;
}

const STATIC_SERVICES = ["apache2", "mariadb", "redis-server", "memcached"];

/**
 * Runs `systemctl is-active <service>` and returns the trimmed output.
 * Returns "inactive" on error (service not installed or no systemd).
 */
export async function checkService(name: string): Promise<ServiceStatus> {
  try {
    const proc = Bun.spawn(["systemctl", "is-active", name], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = (await new Response(proc.stdout).text()).trim();
    return {
      name,
      active: out === "active",
      status: out || "inactive",
    };
  } catch {
    return { name, active: false, status: "inactive" };
  }
}

/**
 * Discovers php*-fpm service names via `systemctl list-units`.
 */
async function discoverPhpFpmServices(): Promise<string[]> {
  try {
    const proc = Bun.spawn(
      [
        "systemctl",
        "list-units",
        "--type=service",
        "--no-legend",
        "--no-pager",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const out = await new Response(proc.stdout).text();
    return out
      .split("\n")
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((name) => name && /^php\d[\d.]*-fpm\.service$/.test(name))
      .map((name) => name.replace(/\.service$/, ""));
  } catch {
    return [];
  }
}

export async function servicesHandler(c: Context) {
  const phpFpmServices = await discoverPhpFpmServices();
  const allServices = [...STATIC_SERVICES, ...phpFpmServices];

  const statuses = await Promise.all(allServices.map(checkService));

  return c.json(statuses);
}
