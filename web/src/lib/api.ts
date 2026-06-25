import type {
  Server,
  Site,
  ActivityLog,
  Metrics,
  ServiceStatus,
  SseEvent,
} from "./types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "request failed" }));
    throw new Error((body as { error?: string }).error ?? "request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Auth
export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "login failed" }));
    throw new Error((body as { error?: string }).error ?? "login failed");
  }
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function changePassword(
  current_password: string,
  new_password: string,
): Promise<void> {
  return request<void>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password, new_password }),
  });
}

// Servers
export function getServers(): Promise<Server[]> {
  return request<Server[]>("/servers");
}

export function getServer(id: string): Promise<Server> {
  return request<Server>(`/servers/${id}`);
}

export function createServer(body: {
  name: string;
  hostname: string;
  ssh_user: string;
  ssh_port: number;
  ssh_key_path: string;
  agent_direct_url?: string;
}): Promise<Server> {
  return request<Server>("/servers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function syncServer(id: string): Promise<void> {
  return request<void>(`/servers/${id}/sync`);
}

export function getServerMetrics(id: string): Promise<Metrics> {
  return request<Metrics>(`/servers/${id}/metrics`);
}

export function getServerServices(id: string): Promise<ServiceStatus> {
  return request<ServiceStatus>(`/servers/${id}/services`);
}

// Sites
export function getServerSites(serverId: string): Promise<Site[]> {
  return request<Site[]>(`/servers/${serverId}/sites`);
}

export function getSite(serverId: string, siteId: string): Promise<Site> {
  return request<Site>(`/servers/${serverId}/sites/${siteId}`);
}

// Activity
export function getActivity(): Promise<ActivityLog[]> {
  return request<ActivityLog[]>("/activity");
}

export function wpScanUrl(serverId: string): string {
  return `${BASE}/servers/${serverId}/wp-scan`;
}

// Registration tokens
export function createToken(): Promise<{
  id: string;
  token: string;
  expires_at: number;
}> {
  return request("/tokens", { method: "POST" });
}

export function getTokenStatus(id: string): Promise<{
  status: "pending" | "registered" | "expired";
  server_id?: string;
}> {
  return request(`/tokens/${id}/status`);
}

// SSE exec — yields each parsed event as it arrives
export async function* streamExec(
  url: string,
  body: Record<string, unknown>,
): AsyncGenerator<SseEvent> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.href = "/login";
    return;
  }
  if (!res.ok || !res.body) {
    throw new Error("exec request failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        yield JSON.parse(line.slice(6)) as SseEvent;
      } catch {
        // skip malformed
      }
    }
  }
}
