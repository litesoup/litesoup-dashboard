import type { Server } from "./types";
import * as net from "net";

// Note: there is a small TOCTOU window between when we release the port here
// and when ssh binds to it. Acceptable for a single-admin dashboard with low concurrency.
export async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("no address"));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

export async function resolveAgentUrl<T>(
  server: Server,
  fn: (agentUrl: string) => Promise<T>,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  if (server.agent_direct_url) {
    return fn(server.agent_direct_url);
  }

  const localPort = await findFreePort();
  const agentUrl = `http://127.0.0.1:${localPort}`;
  const timeoutMs = opts.timeoutMs ?? 5000;

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn([
      "ssh",
      "-N",
      "-o",
      "StrictHostKeyChecking=no",
      "-o",
      "ConnectTimeout=5",
      "-i",
      server.ssh_key_path,
      "-p",
      String(server.ssh_port),
      "-L",
      `127.0.0.1:${localPort}:127.0.0.1:7777`,
      `${server.ssh_user}@${server.hostname}`,
    ]);
  } catch (err) {
    throw new Error(`failed to spawn ssh: ${err}`);
  }

  // Poll until tunnel is ready or timeout
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await isPortOpen("127.0.0.1", localPort);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  if (Date.now() >= deadline) {
    try {
      proc.kill();
    } catch {
      /* process already exited */
    }
    throw new Error(
      `SSH tunnel to ${server.hostname}:${server.ssh_port} timed out after ${timeoutMs}ms`,
    );
  }

  try {
    return await fn(agentUrl);
  } finally {
    proc.kill();
  }
}

async function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(200);
    sock.connect(port, host, () => {
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => {
      sock.destroy();
      resolve(false);
    });
    sock.on("timeout", () => {
      sock.destroy();
      resolve(false);
    });
  });
}
