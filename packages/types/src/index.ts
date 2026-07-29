// User types
export interface User {
    id: string
    username: string
    email: string
}

export interface UserCredentials {
    email: string
    password: string
}

export interface RegisterData {
    username: string
    email: string
    password: string
}

// Auth types
export interface AuthResponse {
    message?: string
    access_token: string
    token_type: string
    user: User
}

export interface RegisterResponse {
    message: string
}

// Message types
export interface Message {
    id: string
    user_message?: string
    bot_response?: string
    timestamp?: string | Date
    type?: "user" | "ai"
}

// Conversation types
export interface Conversation {
    id: string
    messages: Message[]
    timestamp?: string | Date
    summary?: string
    summaryUpdatedAt?: string
}

// Chat API types
export interface SendMessageParams {
    message: string
    conversationId?: string | null
}

export interface SendMessageResponse {
    response: string
    conversation_id: string
    user_message?: string
    message?: string
}

export interface DeleteChatResponse {
    message: string
}
