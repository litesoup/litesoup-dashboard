import { openDb } from "./db";
import { hashPassword } from "./auth";
import { ulid } from "ulid";

const DB_PATH = process.env.DB_PATH ?? "/var/lib/litesoup-dashboard/db.sqlite";
const db = openDb(DB_PATH);

// Admin
const adminHash = await hashPassword("admin123");
db.run("INSERT OR REPLACE INTO admin (email, password) VALUES (?, ?)", [
  "admin@example.com",
  adminHash,
]);

const now = Date.now();
const day = 86_400_000;

// Servers
const servers = [
  {
    id: ulid(),
    name: "sg9",
    hostname: "sg9.codetot.org",
    ssh_user: "root",
    ssh_port: 22,
    ssh_key_path: "/root/.ssh/id_ed25519",
    agent_direct_url: "http://127.0.0.1:7777",
    status: "active",
    added_at: now - 30 * day,
  },
  {
    id: ulid(),
    name: "sg10",
    hostname: "sg10.codetot.org",
    ssh_user: "root",
    ssh_port: 22,
    ssh_key_path: "/root/.ssh/id_ed25519",
    agent_direct_url: null,
    status: "offline",
    added_at: now - 15 * day,
  },
  {
    id: ulid(),
    name: "client-vps",
    hostname: "185.220.101.42",
    ssh_user: "deploy",
    ssh_port: 2222,
    ssh_key_path: "/root/.ssh/id_ed25519",
    agent_direct_url: null,
    status: "unknown",
    added_at: now - 2 * day,
  },
];

for (const s of servers) {
  db.run(
    `INSERT OR REPLACE INTO servers
     (id, name, hostname, ssh_user, ssh_port, ssh_key_path, agent_direct_url, status, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.id,
      s.name,
      s.hostname,
      s.ssh_user,
      s.ssh_port,
      s.ssh_key_path,
      s.agent_direct_url,
      s.status,
      s.added_at,
    ],
  );
}

const [sg9, sg10] = servers;

// Sites on sg9
const sites = [
  {
    domain: "codetot.com",
    php_version: "8.3",
    tier: "large",
    tls_mode: "letsencrypt",
    wp_version: "6.7.1",
    plugins_need_update: 2,
    themes_need_update: 0,
  },
  {
    domain: "portal.codetot.org",
    php_version: "8.3",
    tier: "small",
    tls_mode: "letsencrypt",
    wp_version: "6.6.2",
    plugins_need_update: 0,
    themes_need_update: 1,
  },
  {
    domain: "client1.io",
    php_version: "8.2",
    tier: "medium",
    tls_mode: "self-signed",
    wp_version: "6.5.0",
    plugins_need_update: 5,
    themes_need_update: 2,
  },
  {
    domain: "staging.client1.io",
    php_version: "8.4",
    tier: "small",
    tls_mode: "none",
    wp_version: null,
    plugins_need_update: 0,
    themes_need_update: 0,
  },
  {
    domain: "demo.codetot.com",
    php_version: "8.3",
    tier: "small",
    tls_mode: "letsencrypt",
    wp_version: "6.7.1",
    plugins_need_update: 0,
    themes_need_update: 0,
  },
];

const siteIds: string[] = [];
for (const site of sites) {
  const id = ulid();
  siteIds.push(id);
  db.run(
    `INSERT OR REPLACE INTO sites
     (id, server_id, domain, site_user, php_version, tier, tls_mode, synced_at,
      wp_version, plugins_need_update, themes_need_update, wp_scanned_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      sg9.id,
      site.domain,
      "www-data",
      site.php_version,
      site.tier,
      site.tls_mode,
      now - day,
      site.wp_version ?? null,
      site.plugins_need_update,
      site.themes_need_update,
      site.wp_version != null ? now - day : null,
    ],
  );
}

// One site on sg10
const sg10SiteId = ulid();
db.run(
  `INSERT OR REPLACE INTO sites
   (id, server_id, domain, site_user, php_version, tier, tls_mode, synced_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    sg10SiteId,
    sg10.id,
    "legacy.example.com",
    "www-data",
    "8.2",
    "medium",
    "letsencrypt",
    now - 5 * day,
  ],
);

// Activity logs
const logs = [
  // sg9 activity
  {
    server_id: sg9.id,
    site_id: siteIds[0],
    action: "site:create",
    status: "success",
    started_at: now - 29 * day,
    duration: 45_000,
    output:
      "Installing Apache vhost...\nConfiguring PHP-FPM pool...\nSetting up SSL...\nDone.",
  },
  {
    server_id: sg9.id,
    site_id: siteIds[0],
    action: "site:set-php",
    status: "success",
    started_at: now - 20 * day,
    duration: 12_000,
    output: "Switching PHP-FPM from 8.2 to 8.3...\nRestarting pool...\nDone.",
  },
  {
    server_id: sg9.id,
    site_id: siteIds[1],
    action: "site:create",
    status: "success",
    started_at: now - 14 * day,
    duration: 38_000,
    output:
      "Installing Apache vhost...\nIssuing Let's Encrypt certificate...\nDone.",
  },
  {
    server_id: sg9.id,
    site_id: siteIds[2],
    action: "site:set-tls",
    status: "success",
    started_at: now - 10 * day,
    duration: 22_000,
    output:
      "Issuing self-signed cert for client1.io...\nReloading Apache...\nDone.",
  },
  {
    server_id: sg9.id,
    site_id: siteIds[3],
    action: "site:delete",
    status: "success",
    started_at: now - 7 * day,
    duration: 8_000,
    output:
      "Removing vhost...\nRemoving PHP pool...\nRemoving webroot...\nDone.",
  },
  {
    server_id: sg9.id,
    site_id: siteIds[3],
    action: "site:create",
    status: "failed",
    started_at: now - 5 * day,
    duration: 5_000,
    output:
      "Installing Apache vhost...\nError: domain staging.client1.io already in DNS zone.\nAborting.",
  },
  {
    server_id: sg9.id,
    site_id: null,
    action: "server:sync",
    status: "success",
    started_at: now - 3 * day,
    duration: 15_000,
    output:
      "Connecting to sg9.codetot.org...\nDiscovered 4 sites.\nSynced activity log.\nDone.",
  },
  {
    server_id: sg9.id,
    site_id: siteIds[4],
    action: "site:set-tier",
    status: "success",
    started_at: now - 1 * day,
    duration: 9_000,
    output: "Updating PHP-FPM pool tier to small...\nRestarting pool...\nDone.",
  },
  {
    server_id: sg9.id,
    site_id: siteIds[0],
    action: "site:set-php",
    status: "running",
    started_at: now - 30_000,
    duration: null,
    output: "Switching PHP-FPM from 8.3 to 8.4...",
  },
  {
    server_id: sg9.id,
    site_id: siteIds[1],
    action: "server:sync",
    status: "pending",
    started_at: now - 5_000,
    duration: null,
    output: null,
  },
  // sg10 activity
  {
    server_id: sg10.id,
    site_id: sg10SiteId,
    action: "site:create",
    status: "success",
    started_at: now - 13 * day,
    duration: 41_000,
    output: "Installing Apache vhost...\nDone.",
  },
  {
    server_id: sg10.id,
    site_id: null,
    action: "server:sync",
    status: "failed",
    started_at: now - 6 * day,
    duration: 3_000,
    output:
      "Connecting to sg10.codetot.org...\nSSH timeout after 30s.\nFailed.",
  },
];

for (const log of logs) {
  const id = ulid();
  const finished_at =
    log.duration != null ? log.started_at + log.duration : null;
  db.run(
    `INSERT OR REPLACE INTO activity_log
     (id, server_id, site_id, action, params, status, output, actor, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      log.server_id,
      log.site_id,
      log.action,
      "{}",
      log.status,
      log.output ?? null,
      "admin@example.com",
      log.started_at,
      finished_at,
    ],
  );
}

console.log(
  `Seeded: ${servers.length} servers, ${sites.length + 1} sites, ${logs.length} activity logs`,
);
console.log("Login: admin@example.com / admin123");
