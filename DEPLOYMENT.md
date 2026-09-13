# Light POS deployment

The frontend is served from `/usr/share/nginx/html/projects/light-pos/`. The API runs as `light-pos.service` on `127.0.0.1:8103`; nginx proxies `/projects/light-pos/api/` to it.

## Tenant model

The revisioned JSON aggregate is an envelope with one complete bucket for each tenant: `harbor`, `garden`, and `north`. Orders, catalog and experiments, order types, tables, coupons, notes, expenses, leave/staff/shifts, inventory, SOP/history, messages/read state, audit, targets, planning notes, and schedules live inside that bucket. Receipts and SQL audit events carry a required `business_id`. Tenant admins have full administration only for assigned business IDs. Only `superadmin` with the global assignment can request the read-only combined portfolio projection or switch across every tenant. Every mutation must select one authorized business and the server replaces only that bucket after validation.

## Normal deployment

1. Copy `.env.example` to `.env`, set one secure `POS_SEED_PASSWORD` of at least 12 characters, optionally configure `POS_RECEIPT_PARSER_URL`, and set mode `0600`.
2. Stop the API. Run `sqlite3 sqlite.db 'PRAGMA integrity_check;'` and require `ok`. Copy `sqlite.db`, `sqlite.db-wal`, and `sqlite.db-shm` together when present.
3. Run `npm ci`, `npm run test:backend`, `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
4. Replace the contents of `/usr/share/nginx/html/projects/light-pos/` with `dist/`, retaining the deployed directory ownership and modes.
5. Restart `light-pos.service`, verify `systemctl is-active light-pos.service`, then check local and public `/api/health`.

The service uses `WorkingDirectory=/home/ubuntu/projects/light-pos` and `ExecStart=/home/ubuntu/.local/bin/node --env-file=.env server/index.mjs`.

## Intentional development reset

Normal startup migrates legacy state and creates missing users only. It does not reseed data, delete operational records, or reset passwords.

For a disposable development deployment only, stop the service and run:

```bash
npm run seed:reset -- RESET_DEVELOPMENT_DATA
```

The confirmation token is mandatory. The command first copies the main database to a timestamped `sqlite.db.backup-*`, then transactionally replaces tenant seed state and clears sessions, SQL audits, and receipts. Repeating it is intentional and idempotent. Existing password hashes remain unchanged. Add `--reset-passwords` only when you explicitly want `POS_SEED_PASSWORD` (or the `light-pos-demo` development default) reapplied to every seed account:

```bash
npm run seed:reset -- RESET_DEVELOPMENT_DATA --reset-passwords
```

Never run either reset command against operational production data.

## Nginx API location

```nginx
location ^~ /projects/light-pos/api/ {
    proxy_pass http://127.0.0.1:8103/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 5m;
}
```
