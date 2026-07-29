# Authentication

MeshMind uses Better Auth with PostgreSQL and Drizzle.

## Backing tables

Authentication data is stored in these PostgreSQL tables:

- `users`
- `accounts`
- `sessions`
- `verification`

The API does not use MongoDB, Mongoose, or JWT session storage.

## Supported auth flows

- email and password
- Google OAuth
- GitHub OAuth

OAuth sign-in now uses a shared frontend callback route:

- `/auth/callback` for Better Auth redirects
- `/auth/github/callback` remains as a compatibility alias in the web app

## Important variables

```env
BETTER_AUTH_SECRET=super-secret
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

## Database expectations

Better Auth expects relational auth tables with fields such as:

- `users.email`
- `users.email_verified`
- `accounts.provider_id`
- `accounts.account_id`
- `accounts.password`
- `sessions.token`
- `sessions.expires_at`

These are defined in [packages/database/src/schema.ts](../packages/database/src/schema.ts).

Auth table primary keys are UUIDs. Better Auth is configured to generate UUID identifiers before inserts so they match the PostgreSQL schema.

## Local setup

1. Start PostgreSQL locally with the pgvector extension enabled.

1. Apply the schema:

```bash
bun run --filter=@meshmind/database db:migrate
```

1. Start the API:

```bash
cd apps/api && bun run dev
```

## Endpoints

- `/auth/*` — Better Auth handler
- `/auth/me` — current session user
- `/auth/oauth/url/:provider` — provider authorize URL helper

Email/password flows use the Better Auth endpoints under `/auth`:

- `POST /auth/sign-up/email`
- `POST /auth/sign-in/email`
- `POST /auth/sign-out`
- `GET /auth/get-session`

## Frontend behavior

- OAuth buttons in the login and registration screens redirect through `/auth/oauth/url/:provider`.
- Google uses the standard multicolor Google mark in the provider button to match the OAuth entry point.
- After the provider redirects back, the frontend callback page restores the Better Auth session by calling `GET /auth/get-session` with credentials enabled and reading the returned `user` object.
- Frontend route protection should rely on the restored Better Auth session user, not on any legacy local storage token.
- Authenticated API requests rely on the Better Auth session cookie, so the API must allow credentialed CORS requests from the active frontend origin.
- Chat streaming requests must use `/chat` without a trailing slash because the Hono router is mounted at `/chat` and the stream handler is registered on `/` within that router.
- `FRONTEND_URL` can be a comma-separated list of trusted frontend origins when you need to support multiple dev hosts, for example `http://localhost:5173,http://localhost:3000`.
- Local development accepts both `http://localhost:5173` and `http://localhost:3000` by default.

## Notes

- Better Auth is wired through the Drizzle adapter with pluralized schema exports.
- Session validation in API middleware reads the Better Auth session directly from request headers.
