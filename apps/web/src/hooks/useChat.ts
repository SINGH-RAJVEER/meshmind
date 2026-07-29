import { createResource, createSignal } from "solid-js"
import { deleteChat, fetchChatHistory, sendMessageStream } from "../api/chatApi"
import { toast } from "../components/Toast"
import { useChatStore } from "../store/chatStore"

export const useFetchChatHistory = () => {
    const { setChatHistory } = useChatStore()

    const [data, { refetch, mutate }] = createResource(async () => {
        const data = await fetchChatHistory()
        setChatHistory(data)
        return data
    })

    return { data, refetch, mutate }
}

/**
 * Stream-based message sending hook
 * Streams text chunks as they arrive from the LLM
 */
export const useSendMessageStream = () => {
    const { setLoading, updateConversation, selectedConversation, setSelectedConversation } =
        useChatStore()

    const [isPending, setIsPending] = createSignal(false)
    const [error, setError] = createSignal<string | null>(null)

    const mutate = async ({
        message,
        conversationId,
        onChunk,
    }: {
        message: string
        conversationId?: string
        onChunk: (chunk: string) => void
    }) => {
        setIsPending(true)
        setError(null)
        setLoading(true)
        let fullResponse = ""
        let finalConversationId = conversationId
        let compactionSummary: string | undefined
        let summaryUpdatedAt: string | undefined

        try {
            for await (const event of sendMessageStream({
                message,
                conversationId,
            })) {
                if (event.type === "text") {
                    const content = event.content || ""
                    fullResponse += content
                    onChunk(content)
                } else if (event.type === "metadata") {
                    finalConversationId = event.conversation_id
                } else if (event.type === "compaction") {
                    compactionSummary = event.summary
                    summaryUpdatedAt = event.summary_updated_at

                    const currentConversationId = finalConversationId ?? selectedConversation()?.id
                    if (currentConversationId) {
                        updateConversation(currentConversationId, (conversation) => ({
                            ...conversation,
                            summary: event.summary,
                            summaryUpdatedAt: event.summary_updated_at,
                        }))
                    }
                } else if (event.type === "error") {
                    throw new Error(event.content)
                }
            }

            setLoading(false)

            const selected = selectedConversation()
            const userMessage = {
                id: crypto.randomUUID(),
                user_message: message,
                type: "user" as const,
            }
            const botMessage = {
                id: crypto.randomUUID(),
                bot_response: fullResponse,
                type: "ai" as const,
            }

            if (!selected) {
                if (!finalConversationId) {
                    throw new Error("Chat response did not include a conversation ID")
                }
                const newConversation = {
                    id: finalConversationId,
                    messages: [userMessage, botMessage],
                    summary: compactionSummary,
                    summaryUpdatedAt,
                }
                setSelectedConversation(newConversation)
            } else {
                updateConversation(selected.id, (conversation) => ({
                    ...conversation,
                    messages: [...conversation.messages, userMessage, botMessage],
                }))
            }

            return {
                response: fullResponse,
                conversation_id: finalConversationId,
            }
        } catch (err: unknown) {
            setLoading(false)
            const errorMsg = err instanceof Error ? err.message : "Failed to send message"
            setError(errorMsg)
            toast.error(errorMsg)
            throw err
        } finally {
            setIsPending(false)
        }
    }

    return { mutate, isPending, error }
}

export const useDeleteChat = () => {
    const { deleteConversation } = useChatStore()
    const [isPending, setIsPending] = createSignal(false)
    const [error, setError] = createSignal<string | null>(null)

    const mutate = async (conversationId: string) => {
        setIsPending(true)
        setError(null)

        try {
            await deleteChat(conversationId)
            deleteConversation(conversationId)
            toast.success("Chat deleted successfully")
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : "Failed to delete chat"
            setError(errorMsg)
            toast.error(errorMsg)
        } finally {
            setIsPending(false)
        }
    }

    return { mutate, isPending, error }
}
