# Nix Devenv

MeshMind uses a Nix-backed devenv for local development.

## Start the stack

```bash
just dev
```

This runs `devenv up` and starts:

- PostgreSQL 18 with pgvector on `localhost:5432`
- Versioned Drizzle migrations through `@meshmind/database db:migrate`
- API on `http://localhost:8000`
- Web app on `http://localhost:5173`

PostgreSQL 18 data is stored under `.devenv/state/postgres-18` and is ignored by git. The version-specific path prevents PostgreSQL 18 from opening an incompatible PostgreSQL 16 data directory. Existing PostgreSQL 16 data under `.devenv/state/postgres` is preserved for manual export or removal.

## Environment

The devenv provides local defaults for:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=meshmind
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
PORT=8000
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:8000
```

Keep OAuth and OpenRouter secrets in the root `.env` file. Devenv loads it for every managed process, including the API and web app.

## Commands

Use normal workspace commands inside the shell:

```bash
devenv shell
bun install
bun run type-check
bun run build
just db-migrate
```

The `just dev` command is the full dev preview entrypoint.
