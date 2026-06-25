export interface Server {
  id: string;
  name: string;
  hostname: string;
  ssh_user: string;
  ssh_port: number;
  ssh_key_path: string;
  agent_direct_url: string | null;
  status: "active" | "offline" | "unknown";
  added_at: number;
}

export interface Site {
  id: string;
  server_id: string;
  domain: string;
  site_user: string;
  php_version: string;
  tier: string;
  tls_mode: string;
  synced_at: number;
  wp_version: string | null;
  plugins_need_update: number;
  themes_need_update: number;
  wp_scanned_at: number | null;
  git_repo: string | null;
  git_branch: string | null;
}

export interface ActivityLog {
  id: string;
  server_id: string;
  site_id: string | null;
  action: string;
  params: string; // JSON-encoded action parameters
  status: "pending" | "running" | "success" | "failed";
  output: string | null;
  actor: string;
  started_at: number;
  finished_at: number | null;
}
