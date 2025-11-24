# Notes App

A full-stack Notes application with a static frontend and an Express + PostgreSQL backend. The app supports user registration/login (JWT-based auth), creating, reading, updating and deleting notes, and per-user note storage.

**Tech:** Node.js, Express, PostgreSQL, vanilla JavaScript (client)

**Highlights:**
- **Authentication:** Register / login with JWT tokens.
- **Notes CRUD:** Create, read, update, delete notes (owners only).
- **Server-side validation & rate limiting:** Input validation, sanitization, and per-route rate limits.
- **DB migrations:** Managed with `node-pg-migrate` under `server/db/migrations`.

**Quick Links:**
- Server docs: `server/README.md`

**Folder overview**

`notes-app/`
- `client/` — static frontend files
	- `index.html`
	- `js/` — frontend JavaScript modules (e.g. `app.js`, `notesManager.js`, `loginManager.js`, etc.)
	- `styles/`, `sounds/`
- `server/` — Express server
	- `index.js` — server entrypoint
	- `db.js` — Postgres pool and optional init helper
	- `routes/` — `notes.js`, `users.js`
	- `middleware/` — auth, validation, rate limiting, error handling
	- `db/` — `migrations/`, `init.sql`
- `package.json` — project scripts and deps

## Requirements

- Node.js >= 18
- PostgreSQL (local or remote)

## Installation (development)

1. Clone the repository and change into the project folder:

```powershell
cd "path\to\notes-app"
```

2. Install dependencies:

```powershell
npm install
```

3. Create a `.env` file for the server. You can copy the server example if available:

```powershell
copy server\.env.example server\.env
# then edit server\.env and fill the values
```

## Important environment variables

The server expects the following variables (set them in `server/.env` or your environment):

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — Postgres connection
- `JWT_SECRET` — secret used to sign JWT tokens (required)
- `PORT` — optional server port (defaults to 5000)
- `ALLOWED_ORIGINS` — comma-separated list of allowed CORS origins for the client (optional)
- `NOTES_BODY_LIMIT`, `USER_BODY_LIMIT` — per-route JSON body size limits (optional)
- `RUN_DB_INIT` — when set to `true` the server will execute `server/db/init.sql` (dangerous in production; prefer migrations)

## Run (development)

From the project root `notes-app`:

```powershell
npm run dev
# or to run without nodemon:
npm start
```

## Database migrations

Migrations live in `server/db/migrations` and are managed with `node-pg-migrate`.

```powershell
# apply migrations
npm run migrate

# rollback last migration
npm run migrate:down
```

## API (summary)

Base path: `/api`

- `POST /api/users/register` — register new user (body: `email`, `password`, `name`)
- `POST /api/users/login` — login (body: `email`, `password`) → returns `{ user, token }`
- `DELETE /api/users/account` — delete authenticated user's account (requires `Authorization: Bearer <token>`)

- `GET /api/notes` — list notes for authenticated user
- `POST /api/notes` — create note (body: `title`, `content`, `formatting`)
- `GET /api/notes/:id` — get a single note
- `PUT /api/notes/:id` — update a note
- `DELETE /api/notes/:id` — delete a note

All `/api/notes` routes require a valid JWT token in `Authorization` header.

For more details about request validation, rate limits, and error format, see `server/README.md`.

## Client

The client is a static front-end in `client/`. You can open `client/index.html` directly in your browser for local testing or serve it with any static server (e.g. VS Code Live Server or `serve`). Make sure `ALLOWED_ORIGINS` includes the origin you use for the frontend during development.

## Administration scripts

- `npm run admin:delete-user` — runs `server/scripts/deleteUser.js` (helper for admin tasks)

## Contributing

- Follow conventional PR workflow. Update or add migrations for schema changes. Keep secrets out of source control.

## License

Project license: `ISC` (see `package.json`).

---

## Troubleshooting & Safety

- **Missing DB env vars:** The server requires `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. When any are missing the server logs a clear error. Check `server/.env.example` and ensure `server/.env` is configured.
- **JWT secret required:** `JWT_SECRET` must be set before starting the server; otherwise the server will refuse to start.
- **Dangerous init SQL:** `server/db/init.sql` can be destructive. The server only runs it when `RUN_DB_INIT=true` and only if explicitly requested; prefer using migrations (`server/db/migrations`) for schema changes.
- **Migrations fail:** Ensure Postgres is reachable and credentials match. Use `npm run migrate` and, if needed, `npm run migrate:down` to rollback. Check database permissions and that the DB specified in `DB_NAME` exists.
- **CORS / ALLOWED_ORIGINS:** If your frontend cannot talk to the API during development, add the frontend origin to `ALLOWED_ORIGINS` in the server env (comma-separated list).

Common quick fixes:

- Ensure Postgres is running and the connection env vars are correct.
- Ensure `JWT_SECRET` is set and different between environments.
- Do not set `RUN_DB_INIT=true` on production or shared environments.

## Quick API examples

Replace `TOKEN` with the JWT returned from login/register. All examples assume the server runs at `http://localhost:5000`.

- Register:

```bash
curl -X POST http://localhost:5000/api/users/register \
	-H "Content-Type: application/json" \
	-d '{"email":"you@example.com","password":"secret","name":"You"}'
```

- Login (returns `token`):

```bash
curl -X POST http://localhost:5000/api/users/login \
	-H "Content-Type: application/json" \
	-d '{"email":"you@example.com","password":"secret"}'
```

- Create note:

```bash
curl -X POST http://localhost:5000/api/notes \
	-H "Authorization: Bearer TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"title":"Hello","content":"Note body"}'
```

- List notes:

```bash
curl -X GET http://localhost:5000/api/notes \
	-H "Authorization: Bearer TOKEN"
```

- Get note:

```bash
curl -X GET http://localhost:5000/api/notes/NOTE_ID \
	-H "Authorization: Bearer TOKEN"
```

- Update note (partial):

```bash
curl -X PUT http://localhost:5000/api/notes/NOTE_ID \
	-H "Authorization: Bearer TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"title":"Updated title"}'
```

- Delete note:

```bash
curl -X DELETE http://localhost:5000/api/notes/NOTE_ID \
	-H "Authorization: Bearer TOKEN"
```

## Useful links

- Server docs: `server/README.md`
- Dangerous init SQL (dev-only): `server/db/init.sql`
- Migrations: `server/db/migrations`
- Open client in browser: `client/index.html`
- Package and scripts: `package.json`

---

