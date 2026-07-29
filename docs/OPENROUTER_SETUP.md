# OpenRouter Setup Guide

MeshMind routes chat and embedding requests through OpenRouter's OpenAI-compatible API.

This guide matches the variables defined in [.env.example](../.env.example).

## Variables used by the API

Chat requests use:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
OPENROUTER_COMPACTION_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
OPENROUTER_SITE_URL=http://localhost:5173
OPENROUTER_APP_TITLE=MeshMind
```

The default chat model is `nvidia/nemotron-3-ultra-550b-a55b:free`. It was selected from OpenRouter's live model catalog because it is a free text model with a 1M token context window and the strongest listed intelligence benchmark among the current free text-chat candidates that expose benchmark metadata.

Embedding requests use:

```env
OPENROUTER_EMBEDDING_MODEL=nvidia/nemotron-3-embed-1b:free
OPENROUTER_EMBEDDING_DIMENSIONS=2048
```

The free Nemotron embedding endpoint requires 2,048 dimensions. MeshMind stores its float output as pgvector `halfvec(2048)` so the complete embedding can use an HNSW cosine index.

Embedding model or dimension changes require a schema migration and a full embedding backfill.

Compaction limits use:

```env
CHAT_COMPACTION_THRESHOLD_TOKENS=6000
CHAT_COMPACTION_RETAIN_TOKENS=2000
CHAT_COMPACTION_BATCH_TOKENS=12000
CHAT_MAX_INPUT_TOKENS=12000
```

Database and server variables remain:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=meshmind
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_postgres_password
PORT=8000
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

## How MeshMind uses OpenRouter

- [apps/api/src/utils/openRouterManager.ts](../apps/api/src/utils/openRouterManager.ts) sends chat completion requests to OpenRouter.
- [apps/api/src/utils/embeddingsManager.ts](../apps/api/src/utils/embeddingsManager.ts) sends embedding requests to OpenRouter.
- The OpenAI SDK points at `https://openrouter.ai/api/v1` by default.
- `HTTP-Referer` and `X-OpenRouter-Title` are sent when `OPENROUTER_SITE_URL` and `OPENROUTER_APP_TITLE` are configured.
- The `/chat` route streams chunks to the browser as they arrive.

## Streaming verification

Verify chat streaming:

```bash
curl -N https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "HTTP-Referer: ${OPENROUTER_SITE_URL:-http://localhost:5173}" \
  -H "X-OpenRouter-Title: ${OPENROUTER_APP_TITLE:-MeshMind}" \
  -d '{
    "model": "nvidia/nemotron-3-ultra-550b-a55b:free",
    "messages": [
      {"role": "system", "content": "Be concise."},
      {"role": "user", "content": "Say hello in one sentence."}
    ],
    "stream": true
  }'
```

Verify embeddings:

```bash
curl -X POST https://openrouter.ai/api/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d '{
    "model": "nvidia/nemotron-3-embed-1b:free",
    "input": "test",
    "dimensions": 2048,
    "encoding_format": "float"
  }'
```

## Running the app

```bash
bun install
just dev
```

## Notes

- Only variable names from [.env.example](../.env.example) are referenced here.
- If embeddings fail, chat continues with the persisted summary and chronological PostgreSQL history.
- OpenRouter free model availability and limits can change. Check OpenRouter's model catalog before changing the default model.
