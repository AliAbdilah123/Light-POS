# Light POS deployment preparation

The frontend is served from `/usr/share/nginx/html/projects/light-pos/`. The API runs as `light-pos.service` on `127.0.0.1:8103` and nginx proxies `/projects/light-pos/api/` to it.

1. Copy `.env.example` to project-root `.env`, replace every password, optionally configure `POS_RECEIPT_PARSER_URL`, and set mode `0600`.
2. Before replacing an existing database, stop the API and run `sqlite3 sqlite.db 'PRAGMA integrity_check;'`; require `ok`, then copy `sqlite.db`, `sqlite.db-wal`, and `sqlite.db-shm` together when present.
3. Build with `npm ci && npm run build`, then replace the contents of `/usr/share/nginx/html/projects/light-pos/` with `dist/` using the existing ownership.
4. Run the API from `/home/ubuntu/projects/light-pos` as the unprivileged `ubuntu` user with `npm run server`. A service unit should use `Restart=on-failure`, `WorkingDirectory=/home/ubuntu/projects/light-pos`, and `ExecStart=/home/ubuntu/.local/bin/node --env-file=.env server/index.mjs`.
5. Add this location before the existing static `/projects/light-pos/` location, then validate with `nginx -t` before reload:

```nginx
location ^~ /projects/light-pos/api/ {
    proxy_pass http://127.0.0.1:8103/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 5m;
}
```

6. Verify locally with `curl --fail http://127.0.0.1:8103/api/health`, then verify the proxied health and authenticated role workflows. This preparation does not change nginx, systemd, the deployed static files, or a runtime database.
