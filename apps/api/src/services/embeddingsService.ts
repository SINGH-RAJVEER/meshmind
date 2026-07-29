import { db, messageEmbeddings, queryClient } from "@meshmind/database"
import { sql } from "drizzle-orm"
import embeddingsManager from "../utils/embeddingsManager"
import type { MessageEmbeddingRow } from "./types"

export interface MessageEmbeddingData {
    id?: string
    messageId: string
    conversationId: string
    userId: string
    content: string
    isUserMessage: boolean
    embeddingModel?: string
    embedding?: number[]
    createdAt?: Date
    similarity?: number
}

class MessageEmbeddingsService {
    private toVectorLiteral(values: number[]): string {
        return `[${values.join(",")}]`
    }

    async storeMessageEmbeddings(
        messageId: string,
        conversationId: string,
        userId: string,
        userMessage: string,
        botResponse: string
    ): Promise<void> {
        const preparedUserMessage = embeddingsManager.prepareTextForEmbedding(userMessage)
        const preparedBotResponse = embeddingsManager.prepareTextForEmbedding(botResponse)
        const [userEmbedding, botEmbedding] = await embeddingsManager.generateEmbeddings([
            preparedUserMessage,
            preparedBotResponse,
        ])

        if (!userEmbedding || !botEmbedding) {
            throw new Error("Embedding provider returned an incomplete batch")
        }

        const embeddingModel = embeddingsManager.getEmbeddingModel()
        await db
            .insert(messageEmbeddings)
            .values([
                {
                    messageId,
                    conversationId,
                    userId,
                    content: preparedUserMessage,
                    isUserMessage: true,
                    embeddingModel,
                    embedding: userEmbedding,
                },
                {
                    messageId,
                    conversationId,
                    userId,
                    content: preparedBotResponse,
                    isUserMessage: false,
                    embeddingModel,
                    embedding: botEmbedding,
                },
            ])
            .onConflictDoUpdate({
                target: [messageEmbeddings.messageId, messageEmbeddings.isUserMessage],
                set: {
                    content: sql`excluded.content`,
                    embeddingModel: sql`excluded.embedding_model`,
                    embedding: sql`excluded.embedding`,
                },
            })
    }

    async findSimilarMessagesInConversation(
        userId: string,
        conversationId: string,
        queryText: string,
        limit: number = 10,
        similarityThreshold: number = 0.55
    ): Promise<MessageEmbeddingData[]> {
        try {
            const preparedQuery = embeddingsManager.prepareTextForEmbedding(queryText)
            const queryEmbedding = await embeddingsManager.generateEmbedding(preparedQuery)
            const query = `
                WITH candidates AS MATERIALIZED (
                    SELECT
                        id,
                        message_id,
                        conversation_id,
                        user_id,
                        content,
                        is_user_message,
                        embedding_model,
                        embedding,
                        created_at
                    FROM message_embeddings
                    WHERE user_id = $2
                        AND conversation_id = $3
                        AND embedding_model = $4
                )
                SELECT
                    id,
                    message_id,
                    conversation_id,
                    user_id,
                    content,
                    is_user_message,
                    embedding_model,
                    created_at,
                    1 - (embedding <=> $1::halfvec) AS similarity
                FROM candidates
                WHERE 1 - (embedding <=> $1::halfvec) > $5
                ORDER BY embedding <=> $1::halfvec
                LIMIT $6
            `
            const result = (await queryClient.unsafe(query, [
                this.toVectorLiteral(queryEmbedding),
                userId,
                conversationId,
                embeddingsManager.getEmbeddingModel(),
                similarityThreshold,
                limit,
            ])) as MessageEmbeddingRow[]

            return result.map((row) => ({
                id: row.id,
                messageId: row.message_id,
                conversationId: row.conversation_id,
                userId: row.user_id,
                content: row.content,
                isUserMessage: row.is_user_message,
                embeddingModel: row.embedding_model,
                createdAt: row.created_at,
                similarity:
                    row.similarity === null || row.similarity === undefined
                        ? undefined
                        : Number(row.similarity),
            }))
        } catch (err) {
            console.warn("Semantic retrieval unavailable; continuing without vector context:", err)
            return []
        }
    }
}

export default new MessageEmbeddingsService()
