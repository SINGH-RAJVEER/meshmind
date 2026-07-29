# Vector Embeddings

MeshMind stores semantic embeddings in PostgreSQL 18 using pgvector. There is no secondary document database.

## Storage model

Each `messages` row stores one complete user and assistant turn. Each turn can have two rows in `message_embeddings`:

- one embedding for the user message
- one embedding for the assistant response

Each embedding row stores the owning user and conversation, normalized source content, role, embedding model ID, and vector. Retrieval always filters by authenticated user, conversation, and active embedding model before ranking by cosine distance.

## Model and dimensions

```env
OPENROUTER_EMBEDDING_MODEL=nvidia/nemotron-3-embed-1b:free
OPENROUTER_EMBEDDING_DIMENSIONS=2048
```

OpenRouter lists this model as free and text-to-embeddings. Its endpoint requires 2,048-dimensional float output. MeshMind validates every response count, dimension, and numeric value before storage.

The database column is `halfvec(2048)`. Regular pgvector HNSW indexes support up to 2,000 `vector` dimensions, while `halfvec` supports this model's full 2,048-dimensional output with the `halfvec_cosine_ops` operator class.

## Indexes

`message_embeddings` has:

- a unique index on `message_id + is_user_message`
- ownership and model lookup indexes
- an HNSW cosine index over `embedding`

## Retrieval flow

1. Load the conversation's persistent semantic summary.
2. Load uncompacted complete turns from the relational `messages` table.
3. Embed the current prompt with the active OpenRouter embedding model.
4. Search pgvector for user-scoped, conversation-scoped, model-matched semantic results.
5. Exclude matches already present in recent context.
6. Send summary, recent turns, and relevant earlier details as delimited untrusted context.

Vector lookup failure is supplementary and does not prevent chat generation.

## Migrations and backfill

Apply versioned migrations:

```bash
just db-migrate
```

Migration `0001` clears old 768-dimensional derived embeddings because vectors from different models and dimensions cannot be converted meaningfully. Raw messages are retained. Regenerate all embeddings with:

```bash
bun run --filter=@meshmind/api embeddings:backfill
```

The backfill is idempotent because each message role is upserted.

## Verification

```sql
SELECT current_setting('server_version');
SELECT extversion FROM pg_extension WHERE extname = 'vector';

SELECT embedding_model, vector_dims(embedding), count(*)
FROM message_embeddings
GROUP BY embedding_model, vector_dims(embedding);

SELECT indexdef
FROM pg_indexes
WHERE indexname = 'message_embeddings_embedding_hnsw_idx';
```
