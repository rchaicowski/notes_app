 # Server — Notes App
 
 This folder contains the server for the Notes App (Express + PostgreSQL).
 
 This README documents recommended, secure workflows for development and deployment.
 
 Important principles
 - Use migrations (versioned, idempotent) to manage schema changes. Do not run destructive SQL automatically on server start.
 - Keep secrets out of source control. Use environment variables or a secret manager.
 - Validate and sanitize user input on the server side.
 
 Prerequisites
 - Node.js >= 18
 - PostgreSQL (local or remote)
 
 Environment
 1. Copy `server/.env.example` to `server/.env` and fill values (do NOT commit `.env`).
 2. Required env vars:
    - DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
    - JWT_SECRET
    - ALLOWED_ORIGINS (comma-separated)
    - NOTES_BODY_LIMIT (optional, default 1mb)
    - USER_BODY_LIMIT (optional, default 100kb)
 
 Start the server (development)
 
 From project root (`notes-app`):
 
 ```bash
 npm install
 npm run dev
 ```
 
 Running migrations
 - We use `node-pg-migrate` and keep migrations in `server/db/migrations`.
 - To apply migrations:
 
 ```bash
 # from project root
 npm run migrate
 ```
 
 - To rollback the last migration:
 
 ```bash
 npm run migrate:down
 ```
 
 Notes about `init.sql`
 - `server/db/init.sql` exists for convenience (dev use), but migrations are the canonical source of truth.
 - Do NOT run `init.sql` in production. If you need to recreate a dev DB quickly, prefer a dedicated script and explicit confirmation.
 - The server will only run `init.sql` if `RUN_DB_INIT=true` is set in env — this is intentionally gated.
 
 Continuous integration / deployment
 - CI should run migrations against the test/staging DB before running tests or deploying.
 - Store DB credentials and `JWT_SECRET` in CI secrets (do not expose in logs).
 
 Security notes
 - The server now redacts sensitive fields from logs and enforces per-route body size limits. Keep these settings in place.
 - Do not log raw request bodies for auth routes.
 
 Next steps (recommended)
 - Add an automated CI workflow that:
   1. Installs deps
   2. Runs migrations against a temporary Postgres instance
   3. Runs integration tests (Jest + Supertest)
 - Remove or archive `init.sql` once migrations are trusted across environments.
 
 If you want, I can add the CI workflow and a minimal test suite next.
 
 ---
 Generated on: 2025-11-10T00:00:00.000Z
