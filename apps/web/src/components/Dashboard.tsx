import {
    Bot,
    Loader,
    LogOut,
    MessageSquareText,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    Send,
    Trash2,
} from "lucide-solid"
import { createEffect, createSignal, For, onMount, Show } from "solid-js"
import { useDeleteChat, useFetchChatHistory, useSendMessageStream } from "../hooks/useChat"
import { useLogout } from "../hooks/useLogout"
import { useAuthStore } from "../store/authStore"
import { useChatStore } from "../store/chatStore"
import MarkdownContent from "./MarkdownContent"
import ThemeToggle from "./ThemeToggle"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Separator } from "./ui/separator"
import { Sidebar } from "./ui/sidebar"

function Dashboard() {
    const { chatHistory, selectedConversation, setSelectedConversation, loading } = useChatStore()
    const { user } = useAuthStore()

    let chatEndRef: HTMLDivElement | undefined
    const [prompt, setPrompt] = createSignal("")
    const [sidebarCollapsed, setSidebarCollapsed] = createSignal(
        typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
    )
    const [streamingMessage, setStreamingMessage] = createSignal("")

    const { mutate: sendMessage, isPending: isMutationPending } = useSendMessageStream()
    const { refetch: refetchChatHistory } = useFetchChatHistory()
    const { mutate: logout } = useLogout()
    const { mutate: deleteChat } = useDeleteChat()

    onMount(() => {
        refetchChatHistory()
    })

    createEffect(() => {
        if (chatEndRef) {
            chatEndRef.scrollIntoView({ behavior: "smooth" })
        }
    })

    const handleSendMessage = async (e: Event) => {
        e.preventDefault()
        const currentPrompt = prompt().trim()
        if (!currentPrompt || loading() || isMutationPending()) return

        setPrompt("")
        setStreamingMessage("")

        try {
            await sendMessage({
                message: currentPrompt,
                conversationId: selectedConversation()?.id,
                onChunk: (chunk: string) => {
                    setStreamingMessage((prev) => prev + chunk)
                },
            })
            setStreamingMessage("")
            await refetchChatHistory()
        } catch {
            setStreamingMessage("")
        }
    }

    const startNewConversation = () => {
        setSelectedConversation(null)
        setPrompt("")
        setStreamingMessage("")
    }

    const handleDeleteChat = (e: Event, chatId: string) => {
        e.stopPropagation()
        deleteChat(chatId)
    }

    const conversationTitle = () =>
        selectedConversation()?.messages[0]?.user_message || "New conversation"

    const userInitials = () => user()?.username.slice(0, 2).toUpperCase() || "MM"

    return (
        <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground">
            <Sidebar
                collapsed={sidebarCollapsed()}
                onCollapse={() => setSidebarCollapsed((prev) => !prev)}
            >
                <div className="flex h-full flex-col">
                    <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-3">
                        <Show
                            when={!sidebarCollapsed()}
                            fallback={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="mx-auto text-sidebar-foreground"
                                    onClick={() => setSidebarCollapsed(false)}
                                    aria-label="Expand sidebar"
                                >
                                    <PanelLeftOpen />
                                </Button>
                            }
                        >
                            <div className="flex w-full items-center gap-2.5">
                                <span className="font-wordmark flex-1 text-xl font-semibold tracking-[-0.04em]">
                                    MeshMind
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-sidebar-foreground"
                                    onClick={() => setSidebarCollapsed(true)}
                                    aria-label="Collapse sidebar"
                                >
                                    <PanelLeftClose />
                                </Button>
                            </div>
                        </Show>
                    </div>

                    <div className="p-3">
                        <Button
                            onClick={startNewConversation}
                            variant={sidebarCollapsed() ? "ghost" : "default"}
                            size={sidebarCollapsed() ? "icon" : "default"}
                            className={sidebarCollapsed() ? "w-full" : "w-full justify-start"}
                            aria-label="New chat"
                        >
                            <Plus />
                            <Show when={!sidebarCollapsed()}>New chat</Show>
                        </Button>
                    </div>

                    <Show when={!sidebarCollapsed()}>
                        <Separator />
                        <div className="flex min-h-0 flex-1 flex-col px-3 py-4">
                            <div className="mb-2 flex items-center justify-between px-2">
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Recent
                                </p>
                                <span className="text-xs tabular-nums text-muted-foreground">
                                    {chatHistory().length}
                                </span>
                            </div>
                            <div className="space-y-1 overflow-y-auto">
                                <For
                                    each={chatHistory()}
                                    fallback={
                                        <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                                            Your conversations will appear here.
                                        </p>
                                    }
                                >
                                    {(chat) => (
                                        <div className="group relative">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className={`h-auto min-h-9 w-full items-start justify-start overflow-hidden py-2 pr-9 font-normal ${
                                                    selectedConversation()?.id === chat.id
                                                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                                        : ""
                                                }`}
                                                onClick={() => setSelectedConversation(chat)}
                                            >
                                                <MessageSquareText className="mt-0.5 shrink-0" />
                                                <span className="min-w-0 flex-1 text-left">
                                                    <span className="block truncate">
                                                        {chat.messages[0]?.user_message ||
                                                            "New chat"}
                                                    </span>
                                                    <Show when={chat.summary}>
                                                        {(summary) => (
                                                            <span className="mt-0.5 line-clamp-2 whitespace-normal text-left text-xs leading-4 text-muted-foreground">
                                                                {summary()}
                                                            </span>
                                                        )}
                                                    </Show>
                                                </span>
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                                                onClick={(e) => handleDeleteChat(e, chat.id)}
                                                aria-label="Delete conversation"
                                            >
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    </Show>

                    <div className="mt-auto border-t border-sidebar-border p-3">
                        <Show
                            when={!sidebarCollapsed()}
                            fallback={
                                <Button
                                    onClick={() => logout()}
                                    variant="ghost"
                                    size="icon"
                                    className="w-full text-muted-foreground"
                                    aria-label="Log out"
                                >
                                    <LogOut />
                                </Button>
                            }
                        >
                            <div className="flex items-center gap-2">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
                                    {userInitials()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                        {user()?.username}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {user()?.email}
                                    </p>
                                </div>
                                <Button
                                    onClick={() => logout()}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-muted-foreground"
                                    aria-label="Log out"
                                >
                                    <LogOut />
                                </Button>
                            </div>
                        </Show>
                    </div>
                </div>
            </Sidebar>

            <div className="flex h-[100dvh] min-w-0 flex-1 flex-col">
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="min-w-0">
                            <h1 className="truncate text-sm font-medium sm:text-base">
                                {conversationTitle()}
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                {selectedConversation() ? "Conversation" : "New conversation"}
                            </p>
                        </div>
                    </div>
                    <ThemeToggle />
                </header>

                <main className="flex min-h-0 flex-1 flex-col">
                    <Show
                        when={selectedConversation()}
                        fallback={<div className="min-h-0 flex-1 overflow-y-auto" />}
                    >
                        {(conversation) => (
                            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                                <div className="flex min-h-full flex-col space-y-4">
                                    <Show
                                        when={conversation().messages.length === 0}
                                        fallback={
                                            <div className="space-y-4">
                                                <For each={conversation().messages}>
                                                    {(message) => (
                                                        <div className="flex flex-col gap-3">
                                                            <Show when={message.user_message}>
                                                                <div className="flex justify-end">
                                                                    <div className="from-primary to-primary/80 bg-gradient-to-r rounded-2xl px-4 py-2 max-w-xs sm:max-w-md lg:max-w-lg break-words text-primary-foreground shadow-sm">
                                                                        {message.user_message}
                                                                    </div>
                                                                </div>
                                                            </Show>
                                                            <Show when={message.bot_response}>
                                                                <div className="flex justify-start">
                                                                    <div className="bg-muted rounded-2xl px-4 py-3 max-w-xs sm:max-w-md lg:max-w-lg break-words shadow-sm">
                                                                        <MarkdownContent
                                                                            content={
                                                                                message.bot_response ||
                                                                                ""
                                                                            }
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </Show>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        }
                                    >
                                        <div className="flex flex-1 items-center justify-center">
                                            <div className="text-center text-muted-foreground">
                                                <Bot className="mx-auto mb-3 h-8 w-8" />
                                                <p className="text-sm">Send a message to begin.</p>
                                            </div>
                                        </div>
                                    </Show>

                                    <Show when={streamingMessage()}>
                                        <div className="flex justify-start">
                                            <div className="bg-muted rounded-2xl px-4 py-3 max-w-xs sm:max-w-md lg:max-w-lg break-words shadow-sm animate-pulse">
                                                <MarkdownContent content={streamingMessage()} />
                                            </div>
                                        </div>
                                    </Show>

                                    <Show
                                        when={
                                            (loading() || isMutationPending()) &&
                                            !streamingMessage()
                                        }
                                    >
                                        <div className="flex justify-start">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Loader className="animate-spin h-5 w-5" />
                                                <span>Generating response...</span>
                                            </div>
                                        </div>
                                    </Show>
                                    <div ref={chatEndRef} />
                                </div>
                            </div>
                        )}
                    </Show>

                    <form
                        onSubmit={handleSendMessage}
                        className="flex shrink-0 gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-3 sm:p-4"
                    >
                        <Input
                            type="text"
                            value={prompt()}
                            onInput={(e) => setPrompt(e.currentTarget.value)}
                            placeholder="Message MeshMind"
                            disabled={loading() || isMutationPending()}
                            className="h-11 flex-1 rounded-xl px-4"
                            autoFocus
                        />
                        <Button
                            type="submit"
                            disabled={loading() || isMutationPending() || !prompt().trim()}
                            size="icon"
                            className="h-11 w-11 shrink-0 rounded-xl"
                            aria-label="Send message"
                        >
                            <Show
                                when={loading() || isMutationPending()}
                                fallback={<Send className="h-5 w-5" />}
                            >
                                <Loader className="animate-spin h-5 w-5" />
                            </Show>
                        </Button>
                    </form>
                </main>
            </div>
        </div>
    )
}

export default Dashboard
