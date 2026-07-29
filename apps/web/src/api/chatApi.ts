import axiosInstance from "./axiosInstance"

export interface ChatStreamEvent {
    type: "metadata" | "compaction" | "text" | "done" | "error"
    content?: string
    conversation_id?: string
    summary?: string
    summary_updated_at?: string
}

export const parseSseChunk = (input: string): { events: ChatStreamEvent[]; remainder: string } => {
    const lines = input.split("\n")
    const remainder = lines.pop() || ""
    const events = lines
        .map((line) => line.trimEnd())
        .filter((line) => line.startsWith("data: "))
        .map((line) => JSON.parse(line.slice(6)) as ChatStreamEvent)

    return { events, remainder }
}

export const fetchChatHistory = async () => {
    const response = await axiosInstance.get("/chat/history")
    return response.data.history
}

/**
 * Stream chat messages using Server-Sent Events
 * Returns an async generator that yields message chunks and metadata
 */
export const sendMessageStream = async function* ({
    message,
    conversationId,
}: {
    message: string
    conversationId?: string
}): AsyncGenerator<ChatStreamEvent> {
    try {
        const response = await fetch(
            `${axiosInstance.defaults.baseURL || "http://localhost:8000"}/chat`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    user_message: message,
                    conversation_id: conversationId,
                }),
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`API error: ${response.status} ${errorText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
            throw new Error("Response body is null")
        }

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const parsed = parseSseChunk(buffer)
            buffer = parsed.remainder

            for (const event of parsed.events) {
                yield event
                if (event.type === "done") {
                    await reader.cancel()
                    return
                }
            }
        }

        if (buffer.startsWith("data: ")) {
            const event = JSON.parse(buffer.slice(6)) as ChatStreamEvent
            yield event
        }
    } catch (error) {
        console.error("Stream error:", error)
        yield {
            type: "error",
            content: error instanceof Error ? error.message : "Unknown error",
        } satisfies ChatStreamEvent
    }
}

export const deleteChat = async (conversationId: string) => {
    const response = await axiosInstance.delete(`/chat/${conversationId}`)
    return response.data
}
