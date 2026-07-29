import { conversations, db, messages } from "@meshmind/database"
import { and, desc, eq } from "drizzle-orm"
import { type Context, Hono } from "hono"
import { getCurrentUser } from "../middleware/auth"
import conversationContextService, {
    ConversationNotFoundError,
    estimateTokens,
    type PreparedConversationContext,
} from "../services/conversationContextService"
import embeddingsService from "../services/embeddingsService"
import { getSystemPrompt } from "../systemPrompt"
import openRouterManager from "../utils/openRouterManager"

const chatbotRouter = new Hono()
const sseHeaders = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
} as const
const encoder = new TextEncoder()
const DEFAULT_MAX_INPUT_TOKENS = 12000

const encodeSseEvent = (payload: Record<string, unknown>): Uint8Array =>
    encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)

const createNewConversation = async (userId: string, conversationId: string): Promise<void> => {
    await db.insert(conversations).values({ id: conversationId, userId })
}

const storeChat = async (
    userId: string,
    conversationId: string,
    userMessage: string,
    botResponse: string
): Promise<string> => {
    const message = await db.transaction(async (tx) => {
        const [storedMessage] = await tx
            .insert(messages)
            .values({ userId, conversationId, userMessage, botResponse })
            .returning()

        if (!storedMessage) throw new Error("Failed to store chat message")

        await tx
            .update(conversations)
            .set({ updatedAt: new Date() })
            .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))

        return storedMessage
    })

    return message.id
}

chatbotRouter.post("/", getCurrentUser, async (c: Context) => {
    try {
        const user = c.get("user") as { id: string } | undefined
        if (!user) return c.json({ detail: "Unauthorized" }, 401)

        const body = (await c.req.json()) as {
            user_message?: string
            conversation_id?: string
        }
        if (typeof body.user_message !== "string") {
            return c.json({ detail: "user_message is required" }, 400)
        }

        const userMessage = body.user_message.trim()
        let conversationId = body.conversation_id

        if (!userMessage) {
            return c.json({ detail: "user_message is required" }, 400)
        }
        const configuredMaxInputTokens = Number.parseInt(
            process.env["CHAT_MAX_INPUT_TOKENS"] || "",
            10
        )
        const maxInputTokens =
            Number.isFinite(configuredMaxInputTokens) && configuredMaxInputTokens > 0
                ? configuredMaxInputTokens
                : DEFAULT_MAX_INPUT_TOKENS
        if (estimateTokens(userMessage) > maxInputTokens) {
            return c.json(
                { detail: `user_message exceeds ${maxInputTokens} estimated tokens` },
                413
            )
        }

        if (!conversationId) {
            conversationId = crypto.randomUUID()
            await createNewConversation(user.id, conversationId)
        }

        let preparedContext: PreparedConversationContext
        try {
            preparedContext = await conversationContextService.prepare(
                user.id,
                conversationId,
                userMessage
            )
        } catch (err) {
            if (err instanceof ConversationNotFoundError) {
                return c.json({ detail: err.message }, 404)
            }
            throw err
        }

        const finalizedConversationId = conversationId
        const responseStream = new ReadableStream<Uint8Array>({
            async start(controller) {
                let fullResponse = ""
                let closed = false

                const closeStream = () => {
                    if (closed) return
                    closed = true
                    try {
                        controller.close()
                    } catch (err) {
                        console.warn("Failed to close chat stream cleanly:", err)
                    }
                }

                const sendEvent = (payload: Record<string, unknown>) => {
                    if (closed || c.req.raw.signal.aborted) return
                    try {
                        controller.enqueue(encodeSseEvent(payload))
                    } catch (err) {
                        closed = true
                        console.warn("Failed to write chat stream event:", err)
                    }
                }

                try {
                    sendEvent({
                        type: "metadata",
                        conversation_id: finalizedConversationId,
                    })

                    if (preparedContext.compacted && preparedContext.summary) {
                        sendEvent({
                            type: "compaction",
                            summary: preparedContext.summary,
                            summary_updated_at: preparedContext.summaryUpdatedAt?.toISOString(),
                        })
                    }

                    const systemPrompt = getSystemPrompt(preparedContext.context)
                    for await (const chunk of openRouterManager.streamChatResponse(
                        userMessage,
                        systemPrompt,
                        c.req.raw.signal
                    )) {
                        if (c.req.raw.signal.aborted) break
                        fullResponse += chunk
                        sendEvent({ type: "text", content: chunk })
                    }

                    if (!c.req.raw.signal.aborted && fullResponse) {
                        const messageId = await storeChat(
                            user.id,
                            finalizedConversationId,
                            userMessage,
                            fullResponse
                        )
                        sendEvent({ type: "done" })
                        embeddingsService
                            .storeMessageEmbeddings(
                                messageId,
                                finalizedConversationId,
                                user.id,
                                userMessage,
                                fullResponse
                            )
                            .catch((err) => {
                                console.warn(
                                    "Message stored, but embedding generation failed:",
                                    err
                                )
                            })
                    }
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : "Inference failed"
                    console.error("Chat stream error:", err)
                    sendEvent({ type: "error", content: message })
                } finally {
                    closeStream()
                }
            },
            cancel(reason) {
                console.warn("Chat stream cancelled:", reason)
            },
        })

        return new Response(responseStream, { status: 200, headers: sseHeaders })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An error occurred"
        console.error("Chat error:", err)
        return c.json({ detail: message }, 500)
    }
})

chatbotRouter.get("/history", getCurrentUser, async (c: Context) => {
    try {
        const user = c.get("user") as { id: string } | undefined
        if (!user) return c.json({ detail: "Unauthorized" }, 401)

        const requestedLimit = Number.parseInt(c.req.query("limit") || "10", 10)
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 10
        const ownedConversations = await db
            .select()
            .from(conversations)
            .where(eq(conversations.userId, user.id))
            .orderBy(desc(conversations.updatedAt))
            .limit(limit)

        if (ownedConversations.length === 0) {
            return c.json({ history: [] })
        }

        const messagesByConversation = new Map(
            await Promise.all(
                ownedConversations.map(async (conversation) => {
                    const recentMessages = await db
                        .select()
                        .from(messages)
                        .where(
                            and(
                                eq(messages.userId, user.id),
                                eq(messages.conversationId, conversation.id)
                            )
                        )
                        .orderBy(desc(messages.timestamp), desc(messages.id))
                        .limit(100)

                    return [conversation.id, recentMessages.reverse()] as const
                })
            )
        )

        return c.json({
            history: ownedConversations.map((conversation) => ({
                id: conversation.id,
                summary: conversation.summary,
                summaryUpdatedAt: conversation.summaryUpdatedAt,
                timestamp: conversation.updatedAt,
                messages: (messagesByConversation.get(conversation.id) || []).map((message) => ({
                    id: message.id,
                    user_message: message.userMessage,
                    bot_response: message.botResponse,
                    timestamp: message.timestamp,
                })),
            })),
        })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An error occurred"
        return c.json({ detail: message }, 500)
    }
})

chatbotRouter.delete("/:conversationId", getCurrentUser, async (c: Context) => {
    try {
        const user = c.get("user") as { id: string } | undefined
        if (!user) return c.json({ detail: "Unauthorized" }, 401)

        const conversationId = c.req.param("conversationId")
        if (!conversationId) {
            return c.json({ detail: "conversationId is required" }, 400)
        }

        const deleted = await db
            .delete(conversations)
            .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
            .returning({ id: conversations.id })

        if (deleted.length === 0) {
            return c.json({ detail: "Conversation not found" }, 404)
        }

        return c.json({ message: "Conversation deleted successfully" })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An error occurred"
        return c.json({ detail: message }, 500)
    }
})

export { chatbotRouter }
