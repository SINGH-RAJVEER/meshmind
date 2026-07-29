import { createContext, createSignal, type JSX, useContext } from "solid-js"

export interface Message {
    id?: string
    user_message?: string
    bot_response?: string
}

export interface Conversation {
    id: string
    messages: Message[]
    summary?: string
    summaryUpdatedAt?: string
}

interface ChatContextType {
    chatHistory: () => Conversation[]
    selectedConversation: () => Conversation | null
    loading: () => boolean
    setChatHistory: (history: Conversation[]) => void
    setSelectedConversation: (conversation: Conversation | null) => void
    setLoading: (loading: boolean) => void
    updateConversation: (
        conversationId: string,
        updateFn: (chat: Conversation) => Conversation
    ) => void
    deleteConversation: (conversationId: string) => void
}

const ChatContext = createContext<ChatContextType>()

export function ChatProvider(props: { children: JSX.Element }) {
    const [chatHistory, setChatHistorySignal] = createSignal<Conversation[]>([])
    const [selectedConversation, setSelectedConversationSignal] = createSignal<Conversation | null>(
        null
    )
    const [loading, setLoadingSignal] = createSignal(false)

    const setChatHistory = (history: Conversation[]) => {
        setChatHistorySignal(history)
        // Preserve selected conversation if it exists in the new history
        const selected = selectedConversation()
        if (selected) {
            const found = history.find((chat) => chat.id === selected.id)
            setSelectedConversationSignal(found || null)
        }
    }

    const setSelectedConversation = (conversation: Conversation | null) => {
        if (!conversation) {
            setSelectedConversationSignal(null)
            return
        }

        // If conversation exists in history, use that version
        const history = chatHistory()
        const existing = history.find((chat) => chat.id === conversation.id)
        setSelectedConversationSignal(existing || conversation)
    }

    const setLoading = (isLoading: boolean) => {
        setLoadingSignal(isLoading)
    }

    const updateConversation = (
        conversationId: string,
        updateFn: (chat: Conversation) => Conversation
    ) => {
        const updatedHistory = chatHistory().map((chat) =>
            chat.id === conversationId ? updateFn(chat) : chat
        )
        setChatHistorySignal(updatedHistory)

        const selected = selectedConversation()
        if (selected && selected.id === conversationId) {
            setSelectedConversationSignal(updateFn(selected))
        }
    }

    const deleteConversation = (conversationId: string) => {
        setChatHistorySignal(chatHistory().filter((chat) => chat.id !== conversationId))
        const selected = selectedConversation()
        if (selected && selected.id === conversationId) {
            setSelectedConversationSignal(null)
        }
    }

    const value: ChatContextType = {
        chatHistory,
        selectedConversation,
        loading,
        setChatHistory,
        setSelectedConversation,
        setLoading,
        updateConversation,
        deleteConversation,
    }

    return <ChatContext.Provider value={value}>{props.children}</ChatContext.Provider>
}

export function useChatStore() {
    const context = useContext(ChatContext)
    if (!context) {
        throw new Error("useChatStore must be used within ChatProvider")
    }
    return context
}
