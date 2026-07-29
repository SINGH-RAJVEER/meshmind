# Project Structure

MeshMind is organized as an LLM-agnostic chat platform with a web client, an authenticated API, and shared database tooling.

The repository is a Bun workspace orchestrated by Nx. Root commands such as `bun run build`, `bun run lint`, `bun run type-check`, and `bun run dev` delegate to Nx, which discovers package scripts from `apps/*` and `packages/*` and applies the target dependency rules in `nx.json`.

TypeScript compiler defaults live in the root `tsconfig.json`. App and package TypeScript configs extend it and keep only their local JSX and output settings. The shared config owns strictness, path aliases, bundler-style resolution defaults, and additional safety checks such as unchecked indexed access and side-effect import validation.

Local dev preview is managed by Nix devenv. `just dev` starts PostgreSQL 18 with pgvector, applies versioned Drizzle migrations, and runs the API and web app through the processes defined in `devenv.nix`.

## Applications

### `apps/api`

- `src/main.ts` - Hono server bootstrap and health endpoint
- `src/auth.ts` - Better Auth configuration backed by Drizzle
- `src/routes/auth.ts` - auth route mounting and profile endpoint
- `src/routes/chat.ts` - chat streaming, history, and conversation deletion
- `src/middleware/auth.ts` - authenticated user middleware
- `src/services/embeddingsService.ts` - pgvector-backed semantic retrieval
- `src/services/conversationContextService.ts` - context budgeting, semantic retrieval, and rolling summary compaction
- `src/scripts/backfillEmbeddings.ts` - idempotent embedding regeneration
- `src/utils/openRouterManager.ts` - OpenRouter chat completion streaming helper
- `src/utils/embeddingsManager.ts` - OpenAI-compatible embedding generation helper

### `apps/web`

- `src/components` - UI screens and reusable primitives
- `src/components/Login.tsx` - login form with the MeshMind display wordmark
- `src/components/Dashboard.tsx` - responsive chat shell with independently scrolling messages, a bottom-pinned composer, and conversation summary metadata in the sidebar
- `src/components/ui/sidebar.tsx` - collapsible sidebar layout primitive with a rail-mounted expansion control
- `src/hooks` - auth and chat hooks
- `src/store` - client state
- `src/api` - frontend API clients
- frontend UI uses Solid-specific packages, including `@solidjs/router` and `lucide-solid`

## Packages

### `packages/database`

Drizzle owns the PostgreSQL schema and connection layer.

- `src/schema.ts` - Drizzle table definitions for auth, chat, and embeddings
- `src/connection.ts` - shared PostgreSQL client and health helpers
- `src/index.ts` - public exports for the API
- `drizzle.config.ts` - Drizzle Kit configuration

### `packages/types`

- shared prompt and API-related types

## Database tables

MeshMind stores all persisted data in PostgreSQL:

- `users`
- `accounts`
- `sessions`
- `verification`
- `conversations`
- `messages`
- `message_embeddings`

## Performance notes

- Drizzle indexes are defined in `packages/database/src/schema.ts`
- `message_embeddings` uses an HNSW index for pgvector similarity search
- chat context combines persistent summaries, relational recent turns, and ownership-scoped semantic matches

## Code quality

All packages use Biome for linting and formatting through the root `biome.json`.

```bash
bun run lint
bun run format
bun test
```

Bun tests cover compaction planning, embedding response validation, system-prompt context isolation, and fragmented SSE parsing.

## Build and development

```bash
bun run dev
bun run build
bun run type-check
bun run lint
bun run format
bun run clean
```

Use `just dev` for the full local preview with PostgreSQL and pgvector managed by devenv.

## Environment variables

Core database variables:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=meshmind
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
```

Related setup guides:

- [AUTHENTICATION.md](./AUTHENTICATION.md)
- [NIX_DEVENV.md](./NIX_DEVENV.md)
- [VECTOR_EMBEDDINGS.md](./VECTOR_EMBEDDINGS.md)
