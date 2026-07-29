// Type definitions for pgvector query results

export interface MessageEmbeddingRow {
    id: string
    message_id: string
    conversation_id: string
    user_id: string
    content: string
    is_user_message: boolean
    embedding_model: string
    created_at: Date
    similarity?: number
}
