# MeshMind - Universal LLM Chat Interface

MeshMind is an LLM-agnostic AI chat application built as a Bun monorepo. It connects to chat and embedding models through OpenRouter's OpenAI-compatible API, while PostgreSQL, Drizzle, and pgvector handle persistence and semantic retrieval.

## Stack

- API: Hono + Better Auth + Drizzle ORM + OpenAI-compatible LLM routing
- Web: SolidJS + Vite
- Database: PostgreSQL 18 + pgvector
- Tooling: Bun + Nx + Biome

## Workspace layout

- `apps/api` - Hono API and auth endpoints
- `apps/web` - SolidJS frontend for authenticated AI chat
- `packages/database` - Drizzle schema, PostgreSQL connection, database utilities
- `packages/types` - shared TypeScript types
- `docs` - setup and architecture notes

## Features

- Any Model, One Interface: connect to OpenRouter models through one OpenAI-compatible endpoint.
- Streaming Chat UX: receive real-time assistant responses through Server-Sent Events.
- Authenticated Sessions: Better Auth handles email/password and OAuth-backed sessions.
- Semantic Retrieval: pgvector stores message embeddings for relevant conversation context.
- Context Compaction: long conversations are condensed into persistent semantic memory while raw messages remain available.
- Local Dev Stack: Nix devenv starts PostgreSQL, applies migrations, and runs the API and web app.

## Database model

All persisted application data lives in PostgreSQL:

- `users`
- `accounts`
- `sessions`
- `verification`
- `conversations`
- `messages`
- `message_embeddings`

`message_embeddings` uses pgvector for semantic similarity search, while the rest of the application uses relational tables through Drizzle.

## Prerequisites

- Bun
- Nix devenv for the full local stack
- OpenRouter API key

## Local setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Copy the environment template and fill in secrets:

   ```bash
   cp .env.example .env
   ```

3. Start the full local dev preview:

   ```bash
   just dev
   ```

   This starts PostgreSQL with pgvector, applies the Drizzle schema, and runs the API and web app.

4. For manual database changes, apply the Drizzle migrations:

   ```bash
   bun run --filter=@meshmind/database db:migrate
   ```

5. Start the apps without the devenv-managed database:

   ```bash
   bun run dev
   ```

## Useful commands

```bash
just install
just dev
just build
just type-check
just db-migrate
bun test
```

## Environment notes

Important backend variables:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `BETTER_AUTH_SECRET`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_COMPACTION_MODEL`
- `OPENROUTER_EMBEDDING_MODEL`
- `OPENROUTER_BASE_URL`
- `CHAT_COMPACTION_THRESHOLD_TOKENS`
- `CHAT_COMPACTION_RETAIN_TOKENS`
- `CHAT_COMPACTION_BATCH_TOKENS`
- `CHAT_MAX_INPUT_TOKENS`

If `OPENROUTER_BASE_URL` is omitted, the API defaults to `https://openrouter.ai/api/v1`.

## Documentation

- [Project Structure](docs/PROJECT_STRUCTURE.md) - Architecture, scripts, and services
- [Nix Devenv](docs/NIX_DEVENV.md) - Local development stack
- [OpenRouter Setup](docs/OPENROUTER_SETUP.md) - model provider configuration and environment setup
- [Authentication](docs/AUTHENTICATION.md) - Auth system, OAuth, and API endpoints
- [Vector Embeddings](docs/VECTOR_EMBEDDINGS.md) - Semantic retrieval with pgvector
- [Chat Compaction](docs/CHAT_COMPACTION.md) - Rolling semantic memory for long conversations

## License

MeshMind is open-source under the [MIT License](LICENSE).
