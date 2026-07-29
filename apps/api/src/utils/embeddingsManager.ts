import OpenAI from "openai"

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const DEFAULT_OPENROUTER_EMBEDDING_MODEL = "nvidia/nemotron-3-embed-1b:free"
const DEFAULT_EMBEDDING_DIMENSIONS = 2048
const EMBEDDING_REQUEST_TIMEOUT_MS = 15_000

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
        "User-Agent": "meshmind-embeddings/1.0",
    }
}

const resolveOpenRouterApiKey = () => {
    return process.env["OPENROUTER_API_KEY"] || "missing-openrouter-api-key"
}

const resolveEmbeddingDimensions = () => {
    const configuredDimensions = process.env["OPENROUTER_EMBEDDING_DIMENSIONS"]

    if (!configuredDimensions) {
        return DEFAULT_EMBEDDING_DIMENSIONS
    }

    const dimensions = parseInt(configuredDimensions, 10)

    if (dimensions !== DEFAULT_EMBEDDING_DIMENSIONS) {
        throw new Error(
            `OPENROUTER_EMBEDDING_DIMENSIONS must be ${DEFAULT_EMBEDDING_DIMENSIONS} for the configured pgvector schema`
        )
    }

    return dimensions
}

const toErrorMessage = (err: unknown, baseURL: string) => {
    if (err && typeof err === "object" && "status" in err && err.status === 404) {
        return `OpenRouter embedding endpoint returned 404. Check OPENROUTER_BASE_URL (current: ${baseURL}) and confirm the selected embedding model is available.`
    }

    if (err instanceof Error) {
        return err.message
    }

    return "Unknown embeddings error"
}

export const validateEmbeddingBatch = (
    embeddings: number[][],
    expectedCount: number,
    dimensions: number
): number[][] => {
    if (embeddings.length !== expectedCount) {
        throw new Error(`Expected ${expectedCount} embeddings but received ${embeddings.length}`)
    }

    for (const embedding of embeddings) {
        if (embedding.length !== dimensions || embedding.some((value) => !Number.isFinite(value))) {
            throw new Error(`Embedding response must contain ${dimensions} finite values`)
        }
    }

    return embeddings
}

class EmbeddingsManager {
    private client: OpenAI
    private embeddingModel: string
    private embeddingDimensions: number
    private baseURL: string

    private validateEmbeddings(embeddings: number[][], expectedCount: number): number[][] {
        return validateEmbeddingBatch(embeddings, expectedCount, this.embeddingDimensions)
    }

    constructor() {
        const baseURL = resolveOpenRouterBaseUrl()

        this.embeddingModel =
            process.env["OPENROUTER_EMBEDDING_MODEL"] || DEFAULT_OPENROUTER_EMBEDDING_MODEL
        this.embeddingDimensions = resolveEmbeddingDimensions()

        this.baseURL = baseURL

        this.client = new OpenAI({
            apiKey: resolveOpenRouterApiKey(),
            baseURL,
            defaultHeaders: resolveOpenRouterHeaders(),
            maxRetries: 1,
            timeout: EMBEDDING_REQUEST_TIMEOUT_MS,
        })

        console.log("OpenRouter Embeddings Manager initialized")
        console.log(`Base URL: ${baseURL}`)
        console.log(`Embedding Model: ${this.embeddingModel}`)
        console.log(`Embedding Dimensions: ${this.embeddingDimensions}`)
    }

    /**
     * Generate embeddings for a single text
     * Returns a vector array representing the semantic meaning of the text
     */
    async generateEmbedding(text: string): Promise<number[]> {
        try {
            const response = await this.client.embeddings.create({
                model: this.embeddingModel,
                input: text,
                dimensions: this.embeddingDimensions,
                encoding_format: "float",
            })

            const embedding = response.data[0]

            if (embedding) {
                return this.validateEmbeddings([embedding.embedding], 1)[0] || []
            }

            throw new Error("No embedding data received")
        } catch (err: unknown) {
            const message = toErrorMessage(err, this.baseURL)
            console.error("Error generating embedding:", err)
            throw new Error(message)
        }
    }

    /**
     * Generate embeddings for multiple texts in batch
     * More efficient than calling generateEmbedding multiple times
     */
    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        try {
            const response = await this.client.embeddings.create({
                model: this.embeddingModel,
                input: texts,
                dimensions: this.embeddingDimensions,
                encoding_format: "float",
            })

            if (response.data && response.data.length > 0) {
                // Sort by index to ensure correct order
                const embeddings = response.data
                    .sort((a, b) => a.index - b.index)
                    .map((item) => item.embedding)
                return this.validateEmbeddings(embeddings, texts.length)
            }

            throw new Error("No embedding data received")
        } catch (err: unknown) {
            const message = toErrorMessage(err, this.baseURL)
            console.error("Error generating embeddings:", err)
            throw new Error(message)
        }
    }

    /**
     * Prepare text for embedding by cleaning and truncating if necessary
     * Keep text chunks conservative so embedding providers can process them reliably.
     */
    prepareTextForEmbedding(text: string, maxLength: number = 8000): string {
        // Remove excessive whitespace and newlines
        let cleaned = text.replace(/\s+/g, " ").trim()

        // Truncate if too long (approximate character limit)
        if (cleaned.length > maxLength) {
            cleaned = cleaned.substring(0, maxLength)
        }

        return cleaned
    }

    /**
     * Get the embedding model being used
     */
    getEmbeddingModel(): string {
        return this.embeddingModel
    }

    getEmbeddingDimensions(): number {
        return this.embeddingDimensions
    }
}

// Export singleton instance
const embeddingsManager = new EmbeddingsManager()
export default embeddingsManager
