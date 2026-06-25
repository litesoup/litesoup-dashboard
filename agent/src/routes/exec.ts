import type { Context } from "hono";
import { stream } from "hono/streaming";

export interface ExecRequest {
  command: string;
  params?: Record<string, string>;
}

interface CommandSpec {
  sub: string[];
  paramOrder: string[];
  params: Record<string, { required: boolean; flag: string }>;
}

const commandAllowlist: Record<string, CommandSpec> = {
  "site.create": {
    sub: ["site", "create"],
    paramOrder: ["domain", "php_version", "tier", "tls", "email", "git_repo", "git_branch"],
    params: {
      domain:      { required: true,  flag: "--domain" },
      php_version: { required: true,  flag: "--php" },
      tier:        { required: true,  flag: "--tier" },
      tls:         { required: true,  flag: "--tls" },
      email:       { required: false, flag: "--email" },
      git_repo:    { required: false, flag: "--git-repo" },
      git_branch:  { required: false, flag: "--git-branch" },
    },
  },
  "site.delete": {
    sub: ["site", "delete"],
    paramOrder: ["domain"],
    params: {
      domain: { required: true, flag: "--domain" },
    },
  },
  "site.set-php": {
    sub: ["site", "set-php"],
    paramOrder: ["domain", "php_version"],
    params: {
      domain:      { required: true, flag: "--domain" },
      php_version: { required: true, flag: "--php" },
    },
  },
  "site.set-tier": {
    sub: ["site", "set-tier"],
    paramOrder: ["domain", "tier"],
    params: {
      domain: { required: true, flag: "--domain" },
      tier:   { required: true, flag: "--tier" },
    },
  },
  "site.set-tls": {
    sub: ["site", "set-tls"],
    paramOrder: ["domain", "tls", "email"],
    params: {
      domain: { required: true,  flag: "--domain" },
      tls:    { required: true,  flag: "--tls" },
      email:  { required: false, flag: "--email" },
    },
  },
};

function buildCliArgs(spec: CommandSpec, params: Record<string, string>): string[] {
  const args: string[] = [...spec.sub];
  for (const name of spec.paramOrder) {
    const ps = spec.params[name];
    const val = params[name];
    if (ps.required && !val) {
      throw new Error(`missing required param: ${name}`);
    }
    if (val) {
      args.push(`${ps.flag}=${val}`);
    }
  }
  return args;
}

export async function execHandler(c: Context) {
  let body: ExecRequest;
  try {
    body = await c.req.json<ExecRequest>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const command = body.command?.trim();
  if (!command) {
    return c.json({ error: "Missing or empty 'command'" }, 400);
  }

  const spec = commandAllowlist[command];
  if (!spec) {
    return c.json({ error: `Unknown command: ${command}` }, 422);
  }

  const params = body.params ?? {};

  // Validate required params
  for (const [name, ps] of Object.entries(spec.params)) {
    if (ps.required && !params[name]) {
      return c.json({ error: `Missing required param: ${name}` }, 422);
    }
  }

  let argv: string[];
  try {
    argv = ["litesoup", ...buildCliArgs(spec, params)];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 422);
  }

  return stream(c, async (s) => {
    await s.writeln(`data: ${JSON.stringify({ event: "start", command })}\n`);

    try {
      const proc = Bun.spawn(argv, {
        stdout: "pipe",
        stderr: "pipe",
      });

      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          await s.writeln(
            `data: ${JSON.stringify({ event: "output", line })}\n`,
          );
        }
      }

      // flush any remaining buffer
      if (buffer.length > 0) {
        await s.writeln(
          `data: ${JSON.stringify({ event: "output", line: buffer })}\n`,
        );
      }

      const exitCode = await proc.exited;
      await s.writeln(`data: ${JSON.stringify({ event: "done", exitCode })}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await s.writeln(`data: ${JSON.stringify({ event: "error", message })}\n`);
    }
  });
}
