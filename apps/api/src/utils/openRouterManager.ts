import OpenAI from "openai"

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
const OPENROUTER_REQUEST_TIMEOUT_MS = 30_000

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "")

const resolveOpenRouterBaseUrl = () => {
    const configuredValue = process.env["OPENROUTER_BASE_URL"]?.trim()

    if (configuredValue) {
        return stripTrailingSlash(configuredValue)
    }

    return DEFAULT_OPENROUTER_BASE_URL
}

const resolveOpenRouterHeaders = () => {
    const siteUrl = process.env["OPENROUTER_SITE_URL"] || process.env["FRONTEND_URL"]
    const appTitle = process.env["OPENROUTER_APP_TITLE"] || "MeshMind"

    return {
        ...(siteUrl ? { "HTTP-Referer": siteUrl } : {}),
        "X-OpenRouter-Title": appTitle,
        "User-Agent": "meshmind-api/1.0",
    }
}

const resolveOpenRouterApiKey = () => {
    return process.env["OPENROUTER_API_KEY"] || "missing-openrouter-api-key"
}

export const resolveOpenRouterModel = () => {
    return process.env["OPENROUTER_MODEL"] || DEFAULT_OPENROUTER_MODEL
}

const resolveCompactionModel = () => {
    return process.env["OPENROUTER_COMPACTION_MODEL"] || resolveOpenRouterModel()
}

const toErrorMessage = (err: unknown, baseURL: string) => {
    if (err && typeof err === "object" && "status" in err && err.status === 404) {
        return `OpenRouter endpoint returned 404. Check OPENROUTER_BASE_URL (current: ${baseURL}) and confirm the selected OpenRouter model is available.`
    }

    if (err instanceof Error) {
        return err.message
    }

    return "Unknown OpenRouter error"
}

class OpenRouterManager {
    private client: OpenAI
    private baseURL: string

    constructor() {
        const baseURL = resolveOpenRouterBaseUrl()
        const defaultModel = resolveOpenRouterModel()

        this.baseURL = baseURL

        this.client = new OpenAI({
            apiKey: resolveOpenRouterApiKey(),
            baseURL,
            defaultHeaders: resolveOpenRouterHeaders(),
            maxRetries: 1,
            timeout: OPENROUTER_REQUEST_TIMEOUT_MS,
        })

        console.log("OpenRouter Manager initialized")
        console.log(`Base URL: ${baseURL}`)
        console.log(`Default Model: ${defaultModel}`)
    }

    async *streamChatResponse(
        userMessage: string,
        systemPrompt: string,
        signal?: AbortSignal
    ): AsyncGenerator<string, void, unknown> {
        const model = resolveOpenRouterModel()

        try {
            const stream = await this.client.chat.completions.create(
                {
                    model,
                    max_tokens: 1024,
                    temperature: 0.7,
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt,
                        },
                        {
                            role: "user",
                            content: userMessage,
                        },
                    ],
                    stream: true,
                },
                { signal }
            )

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content
                if (content) {
                    yield content
                }
            }
        } catch (err: unknown) {
            const message = toErrorMessage(err, this.baseURL)
            console.error("Error in streamChatResponse:", err)
            throw new Error(message)
        }
    }

    async getChatResponse(userMessage: string, systemPrompt: string): Promise<string> {
        const model = resolveOpenRouterModel()

        try {
            const response = await this.client.chat.completions.create({
                model,
                max_tokens: 1024,
                temperature: 0.7,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt,
                    },
                    {
                        role: "user",
                        content: userMessage,
                    },
                ],
            })

            if (response.choices[0]?.message?.content) {
                return response.choices[0].message.content
            }

            return ""
        } catch (err: unknown) {
            const message = toErrorMessage(err, this.baseURL)
            console.error("Error in getChatResponse:", err)
            throw new Error(message)
        }
    }

    async compactConversation(existingSummary: string, turns: string): Promise<string> {
        try {
            const response = await this.client.chat.completions.create({
                model: resolveCompactionModel(),
                max_tokens: 700,
                temperature: 0.2,
                messages: [
                    {
                        role: "system",
                        content:
                            "Create a compact semantic memory for an ongoing conversation. Preserve concrete facts, user preferences, decisions, constraints, unresolved questions, and important outcomes. Merge the existing memory with the new turns. Do not mention that you are summarizing. Return only the updated memory in concise prose.",
                    },
                    {
                        role: "user",
                        content: JSON.stringify({
                            existingMemory: existingSummary || null,
                            turnsToCompact: turns,
                        }),
                    },
                ],
            })

            const summary = response.choices[0]?.message?.content?.trim()
            if (!summary) {
                throw new Error("Compaction model returned an empty summary")
            }

            return summary
        } catch (err: unknown) {
            const message = toErrorMessage(err, this.baseURL)
            console.error("Error compacting conversation:", err)
            throw new Error(message)
        }
    }

    getClient(): OpenAI {
        return this.client
    }
}

export default new OpenRouterManager()
