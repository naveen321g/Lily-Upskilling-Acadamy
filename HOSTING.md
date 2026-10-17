# Hosting LUA (Lily Upskilling Academy) locally

This runs the whole app on one machine: a Node.js server plus a **PostgreSQL** database. You don't need Supabase, Docker or any cloud account.

## 1. Requirements

- **Node.js 22.12 or newer**. Check with `node -v`. Download it from https://nodejs.org.
- **PostgreSQL 14 or newer**, running locally. Download it from https://www.postgresql.org/download/. Remember the password you set for the `postgres` user.

## 2. Configure

Copy `.env.example` to `.env`, then set at least `DATABASE_URL`:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/lua
```

- `lua` is the database name. It's created automatically in the next step.
- If your password contains special characters such as `@`, `:`, `/` or `#`, URL-encode them. For example, `@` becomes `%40`.

## 3. Install and set up the database

```sh
npm install
```

Then do **one** of the following.

**A. You received a data backup** (`lua-database.sql` plus a `.local-storage` folder). This restores everything as it was: users, certificates, attempts and settings.

1. Copy the `.local-storage` folder into the project folder, next to `package.json`.
2. Run:
   ```sh
   npm run db:restore -- path/to/lua-database.sql
   ```
3. Skip step 4: the admin accounts are already in the backup, with the same passwords as before.

**B. Starting fresh** (empty database with the default skills and questions):

```sh
npm run db:setup
```

`db:setup` (option B) does three things:
1. Creates the `lua` database.
2. Applies `db/bootstrap.sql`.
3. Applies every migration in `supabase/migrations/`.

Running it again is safe: migrations that were already applied are skipped.

## 4. Create the first admin account (fresh setup only)

```sh
npm run db:create-user -- admin@example.com "a-strong-password" --admin --name "Admin"
```

Anyone can sign up as a normal candidate from the website. Only the account created with `--admin` can use the admin pages.

### Optional: copy existing data from Supabase

If the app previously ran on Supabase, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env`, then run:

```sh
npm run db:import-supabase -- --dry-run   # preview what would be copied
npm run db:import-supabase                # copy it
```

The import copies every table, the user accounts and the uploaded certificate files. It replaces the local data and keeps accounts that exist only locally. Supabase doesn't expose passwords, so give each copied user a new password with `npm run db:create-user -- <email> "<new-password>"`, or have them use "Forgot password".

## 5. Run

**Development** (auto-reloads when code changes):

```sh
npm run dev
```

Open the URL it prints (usually http://localhost:8080).

**Production:**

```sh
npm run build
npm start
```

The server listens on http://localhost:3000. To use a different port, set `PORT`: `PORT=5000 npm start` (Git Bash / macOS / Linux) or `$env:PORT=5000; npm start` (PowerShell).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `APP_URL` | no | Public URL used in password-reset links (defaults to the URL of the incoming request) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | no | Sending password-reset emails. If `SMTP_HOST` is empty, the reset link is **printed in the server console** instead. |
| `LOCAL_STORAGE_DIR` | no | Folder for uploaded certificate files (default `./.local-storage`) |
| `STORAGE_SIGNING_SECRET` | no | Secret for signing file-download links (a random one is used if unset) |
| `BUSTLER_GROQ_API_KEY` | no | All AI features (AI Interview, admin question generation, assessment feedback). Get a key at https://console.groq.com |

## Backups

All data is in PostgreSQL, and uploaded files are in `LOCAL_STORAGE_DIR` (default `.local-storage`). Back up both. `pg_dump` comes with PostgreSQL, in its `bin` folder:

```sh
pg_dump --inserts --no-owner -f lua-database.sql "postgresql://postgres:YOUR_PASSWORD@localhost:5432/lua"
```

To restore that file on a new machine, use `npm run db:restore -- lua-database.sql` (option A in step 3).

## Troubleshooting

- **`password authentication failed`:** the password in `DATABASE_URL` is wrong.
- **`permission denied to create role`:** `db:setup` must connect as a user that can create roles, such as `postgres`.
- **`ECONNREFUSED 127.0.0.1:5432`:** PostgreSQL isn't running. On Windows, start the `postgresql-x64-NN` service in Services.
- **Forgot the admin password:** run the `db:create-user` command again with the same email. It resets the password.
- **Port already in use:** stop the other process on that port, or set a different `PORT`.
