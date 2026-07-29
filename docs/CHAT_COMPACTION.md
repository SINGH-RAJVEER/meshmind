# Chat Compaction

MeshMind compacts long conversations into rolling semantic memory before requesting the next assistant response.

## Trigger

The API estimates prompt tokens from the existing summary, uncompacted turns, and current message. Compaction runs when the estimate reaches `CHAT_COMPACTION_THRESHOLD_TOKENS`.

```env
CHAT_COMPACTION_THRESHOLD_TOKENS=6000
CHAT_COMPACTION_RETAIN_TOKENS=2000
CHAT_COMPACTION_BATCH_TOKENS=12000
CHAT_MAX_INPUT_TOKENS=12000
OPENROUTER_COMPACTION_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
```

The token estimate is intentionally conservative and does not replace provider token accounting. `CHAT_COMPACTION_RETAIN_TOKENS` controls the recent chronological tail kept outside the summary. `CHAT_COMPACTION_BATCH_TOKENS` bounds each summary request, while `CHAT_MAX_INPUT_TOKENS` rejects oversized user messages before opening a provider request.

## Persistence

The `conversations` table stores:

- `summary`: the latest semantic memory
- `compacted_through_message_id`: the exact last summarized turn
- `compacted_message_count`: a compaction progress metric
- `compaction_count`: the number of successful compactions
- `summary_updated_at`: when the memory last changed

Raw `messages` rows are never deleted by compaction. They remain available for transcript display, embedding backfill, and auditability.

The summary update uses the exact previously observed message ID as a compare-and-set guard so concurrent requests cannot both advance the same compaction state. A request that loses this race reloads the winning summary and cursor before assembling context.

## Context assembly

Each model request can include:

1. The rolling semantic summary.
2. Complete turns newer than the compaction cursor.
3. Relevant earlier details found through user-scoped pgvector cosine search.
4. The current prompt as a normal user message.

Historical context is delimited and identified as untrusted content in the system prompt. The current user message is not duplicated in the system prompt.

## User interface

After a successful compaction, the API emits an SSE `compaction` event. The web client updates the matching conversation immediately and displays the summary as left-aligned, two-line metadata under the conversation title in the sidebar. History responses also include the persisted summary for reloads and other sessions.

## Failure behavior

A failed compaction call does not advance the cursor or replace the last good summary. Provider calls have bounded retries and timeouts. OpenRouter free models are rate-limited, so production deployments can set `OPENROUTER_COMPACTION_MODEL` independently when stronger availability is required.
