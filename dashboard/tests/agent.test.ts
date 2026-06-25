import { resolveAgentUrl } from "../src/tunnel";
import type { Server } from "../src/types";

const baseServer: Server = {
  id: "01",
  name: "sg9",
  hostname: "sg9.codetot.org",
  ssh_user: "root",
  ssh_port: 22,
  ssh_key_path: "/root/.ssh/id_ed25519",
  agent_direct_url: null,
  status: "unknown",
  added_at: 0,
};

describe("resolveAgentUrl", () => {
  it("calls fn with agent_direct_url when set (no SSH)", async () => {
    const server = { ...baseServer, agent_direct_url: "http://127.0.0.1:7777" };
    let calledWith = "";
    await resolveAgentUrl(server, async (url) => {
      calledWith = url;
      return new Response("ok");
    });
    expect(calledWith).toBe("http://127.0.0.1:7777");
  });

  it("throws when no agent_direct_url and SSH fails or times out", async () => {
    const server = { ...baseServer, agent_direct_url: null };
    await expect(
      resolveAgentUrl(server, async () => new Response("ok"), {
        timeoutMs: 100,
      }),
    ).rejects.toThrow("timed out");
  });
});
