TRUNCATE TABLE "message_embeddings";--> statement-breakpoint
ALTER TABLE "message_embeddings" ALTER COLUMN "embedding" SET DATA TYPE halfvec(2048) USING "embedding"::halfvec(2048);--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "compacted_message_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "compaction_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "summary_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "conversations"
SET "updated_at" = COALESCE(
    (SELECT max("timestamp") FROM "messages" WHERE "messages"."conversation_id" = "conversations"."id"),
    "created_at"
);--> statement-breakpoint
ALTER TABLE "message_embeddings" ADD COLUMN "embedding_model" varchar(255) NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_updated_at_idx" ON "conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_embeddings_model_idx" ON "message_embeddings" USING btree ("embedding_model");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_embeddings_embedding_hnsw_idx" ON "message_embeddings" USING hnsw ("embedding" halfvec_cosine_ops) WITH (m=16,ef_construction=64);
