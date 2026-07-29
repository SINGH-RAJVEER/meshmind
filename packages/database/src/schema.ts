import {
    boolean,
    halfvec,
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core"

// Users table (compatible with BetterAuth)
export const users = pgTable(
    "users",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        email: varchar("email", { length: 255 }).notNull().unique(),
        emailVerified: boolean("email_verified").notNull().default(false),
        name: varchar("name", { length: 255 }),
        image: varchar("image", { length: 500 }),
        username: varchar("username", { length: 255 }),
        profilePicture: varchar("profile_picture", { length: 500 }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        emailIdx: uniqueIndex("users_email_idx").on(table.email),
        usernameIdx: index("users_username_idx").on(table.username),
    })
)

// Accounts table (for OAuth providers - required by BetterAuth)
export const accounts = pgTable(
    "accounts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        providerId: varchar("provider_id", { length: 255 }).notNull(),
        accountId: varchar("account_id", { length: 255 }).notNull(),
        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),
        accessTokenExpiresAt: timestamp("access_token_expires_at", {
            withTimezone: true,
        }),
        refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
            withTimezone: true,
        }),
        scope: text("scope"),
        password: text("password"),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        userIdIdx: index("accounts_user_id_idx").on(table.userId),
        providerIdIdx: index("accounts_provider_id_idx").on(table.providerId),
        providerAccountIdx: uniqueIndex("accounts_provider_account_idx").on(
            table.providerId,
            table.accountId
        ),
    })
)

// Sessions table (required by BetterAuth)
export const sessions = pgTable(
    "sessions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        token: varchar("token", { length: 255 }).notNull().unique(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        ipAddress: varchar("ip_address", { length: 255 }),
        userAgent: text("user_agent"),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        userIdIdx: index("sessions_user_id_idx").on(table.userId),
        tokenIdx: uniqueIndex("sessions_token_idx").on(table.token),
    })
)

// Verification table (for email verification - required by BetterAuth)
export const verification = pgTable(
    "verification",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identifier: varchar("identifier", { length: 255 }).notNull(),
        value: varchar("value", { length: 255 }).notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        identifierIdx: index("verification_identifier_idx").on(table.identifier),
    })
)

// Conversations table
export const conversations = pgTable(
    "conversations",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        summary: text("summary"),
        compactedMessageCount: integer("compacted_message_count").notNull().default(0),
        compactedThroughMessageId: uuid("compacted_through_message_id"),
        compactionCount: integer("compaction_count").notNull().default(0),
        summaryUpdatedAt: timestamp("summary_updated_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        userIdIdx: index("conversations_user_id_idx").on(table.userId),
        updatedAtIdx: index("conversations_updated_at_idx").on(table.updatedAt),
    })
)

// Messages table
export const messages = pgTable(
    "messages",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        conversationId: uuid("conversation_id")
            .notNull()
            .references(() => conversations.id, { onDelete: "cascade" }),
        userMessage: text("user_message").notNull(),
        botResponse: text("bot_response").notNull(),
        timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        userIdIdx: index("messages_user_id_idx").on(table.userId),
        conversationIdIdx: index("messages_conversation_id_idx").on(table.conversationId),
        timestampIdx: index("messages_timestamp_idx").on(table.timestamp),
        userConversationIdx: index("messages_user_conversation_idx").on(
            table.userId,
            table.conversationId
        ),
    })
)

// Message embeddings table
export const messageEmbeddings = pgTable(
    "message_embeddings",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        messageId: uuid("message_id")
            .notNull()
            .references(() => messages.id, { onDelete: "cascade" }),
        conversationId: uuid("conversation_id")
            .notNull()
            .references(() => conversations.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        content: text("content").notNull(),
        isUserMessage: boolean("is_user_message").notNull().default(true),
        embeddingModel: varchar("embedding_model", { length: 255 }).notNull(),
        embedding: halfvec("embedding", { dimensions: 2048 }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => ({
        messageEmbeddingUniqueIdx: uniqueIndex("message_embeddings_message_idx").on(
            table.messageId,
            table.isUserMessage
        ),
        userIdIdx: index("message_embeddings_user_id_idx").on(table.userId),
        conversationIdIdx: index("message_embeddings_conversation_id_idx").on(table.conversationId),
        userConversationIdx: index("message_embeddings_user_conversation_idx").on(
            table.userId,
            table.conversationId
        ),
        embeddingModelIdx: index("message_embeddings_model_idx").on(table.embeddingModel),
        embeddingHnswIdx: index("message_embeddings_embedding_hnsw_idx")
            .using("hnsw", table.embedding.op("halfvec_cosine_ops"))
            .with({ m: 16, ef_construction: 64 }),
        createdAtIdx: index("message_embeddings_created_at_idx").on(table.createdAt),
    })
)

// TypeScript types
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type Verification = typeof verification.$inferSelect
export type NewVerification = typeof verification.$inferInsert

export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

export type MessageEmbedding = typeof messageEmbeddings.$inferSelect
export type NewMessageEmbedding = typeof messageEmbeddings.$inferInsert
