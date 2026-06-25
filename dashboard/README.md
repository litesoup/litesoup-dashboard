# litesoup-dashboard API

Hono/Bun backend for the self-hosted litesoup dashboard.

## Development

```bash
bun install
bun run dev         # starts on :3000
bun test            # run tests
```

## First-run setup

```bash
bun run setup-admin admin@yourdomain.com your-password
```

## Environment variables

| Variable     | Default                                 | Description        |
| ------------ | --------------------------------------- | ------------------ |
| `PORT`       | `3000`                                  | HTTP listen port   |
| `DB_PATH`    | `/var/lib/litesoup-dashboard/db.sqlite` | SQLite file path   |
| `JWT_SECRET` | _(required in production)_              | JWT signing secret |

## API Routes

| Method | Path                                    | Auth | Description                  |
| ------ | --------------------------------------- | ---- | ---------------------------- |
| POST   | /api/auth/login                         | —    | Login, sets httpOnly cookie  |
| POST   | /api/auth/logout                        | ✓    | Clear session cookie         |
| GET    | /api/servers                            | ✓    | List servers                 |
| POST   | /api/servers                            | ✓    | Register server              |
| GET    | /api/servers/:id                        | ✓    | Server details               |
| GET    | /api/servers/:id/metrics                | ✓    | Agent metrics (CPU/RAM/disk) |
| GET    | /api/servers/:id/services               | ✓    | Agent service status         |
| GET    | /api/servers/:id/sync                   | ✓    | Sync sites from agent        |
| GET    | /api/servers/:id/sites                  | ✓    | List sites (from cache)      |
| GET    | /api/servers/:id/sites/:siteId          | ✓    | Site details                 |
| POST   | /api/servers/:id/sites                  | ✓    | Create site (SSE stream)     |
| DELETE | /api/servers/:id/sites/:siteId          | ✓    | Delete site (SSE stream)     |
| POST   | /api/servers/:id/sites/:siteId/set-php  | ✓    | Change PHP version (SSE)     |
| POST   | /api/servers/:id/sites/:siteId/set-tier | ✓    | Change pool tier (SSE)       |
| POST   | /api/servers/:id/sites/:siteId/set-tls  | ✓    | Change TLS mode (SSE)        |
| GET    | /api/activity                           | ✓    | Activity log (filterable)    |
