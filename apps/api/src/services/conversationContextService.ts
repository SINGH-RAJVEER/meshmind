import { conversations, db, messages } from "@meshmind/database"
import { and, asc, eq, isNull } from "drizzle-orm"
import openRouterManager from "../utils/openRouterManager"
import embeddingsService from "./embeddingsService"

const DEFAULT_COMPACTION_THRESHOLD_TOKENS = 6000
const DEFAULT_RETAIN_TOKENS = 2000
const DEFAULT_COMPACTION_BATCH_TOKENS = 12000
const DEFAULT_SEMANTIC_MATCHES = 4

const positiveIntegerFromEnv = (name: string, fallback: number): number => {
    const parsed = Number.parseInt(process.env[name] || "", 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const estimateTokens = (value: string): number => Math.ceil(value.length / 4)

const formatTurn = (turn: { userMessage: string; botResponse: string }): string =>
    `User: ${turn.userMessage}\nAssistant: ${turn.botResponse}`

interface CompactableTurn {
    id: string
    userMessage: string
    botResponse: string
}

export const planCompaction = (
    turns: CompactableTurn[],
    retainTokens: number,
    batchTokens: number
): { turnsToCompact: CompactableTurn[]; retainedTurns: CompactableTurn[] } => {
    let retainFrom = turns.length
    let retainedTokens = 0

    for (let index = turns.length - 1; index >= 0; index -= 1) {
        const turn = turns[index]
        if (!turn) continue

        const turnTokens = estimateTokens(formatTurn(turn))
        if (retainedTokens + turnTokens > retainTokens) break

        retainedTokens += turnTokens
        retainFrom = index
    }

    const eligibleTurns = turns.slice(0, retainFrom)
    const turnsToCompact: CompactableTurn[] = []
    let compactedTokens = 0

    for (const turn of eligibleTurns) {
        const turnTokens = estimateTokens(formatTurn(turn))
        if (turnsToCompact.length > 0 && compactedTokens + turnTokens > batchTokens) break
        turnsToCompact.push(turn)
        compactedTokens += turnTokens
    }

    return {
        turnsToCompact,
        retainedTurns: turns.slice(turnsToCompact.length),
    }
}

export class ConversationNotFoundError extends Error {}

export interface PreparedConversationContext {
    context: string
    compacted: boolean
    summary: string | null
    summaryUpdatedAt: Date | null
}

class ConversationContextService {
    async prepare(
        userId: string,
        conversationId: string,
        currentMessage: string
    ): Promise<PreparedConversationContext> {
        const [conversation] = await db
            .select()
            .from(conversations)
            .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
            .limit(1)

        if (!conversation) {
            throw new ConversationNotFoundError("Conversation not found")
        }

        const history = await db
            .select()
            .from(messages)
            .where(and(eq(messages.conversationId, conversationId), eq(messages.userId, userId)))
            .orderBy(asc(messages.timestamp), asc(messages.id))

        let compactedMessageCount = Math.min(conversation.compactedMessageCount, history.length)
        let compactedThroughMessageId = conversation.compactedThroughMessageId
        let summary = conversation.summary
        let summaryUpdatedAt = conversation.summaryUpdatedAt
        let compacted = false
        const cursorIndex = compactedThroughMessageId
            ? history.findIndex((turn) => turn.id === compactedThroughMessageId)
            : -1
        let uncompactedTurns = compactedThroughMessageId
            ? history.slice(cursorIndex >= 0 ? cursorIndex + 1 : 0)
            : history

        const threshold = positiveIntegerFromEnv(
            "CHAT_COMPACTION_THRESHOLD_TOKENS",
            DEFAULT_COMPACTION_THRESHOLD_TOKENS
        )
        const retainTokens = Math.min(
            positiveIntegerFromEnv("CHAT_COMPACTION_RETAIN_TOKENS", DEFAULT_RETAIN_TOKENS),
            Math.max(1, threshold - 1)
        )
        const batchTokens = positiveIntegerFromEnv(
            "CHAT_COMPACTION_BATCH_TOKENS",
            DEFAULT_COMPACTION_BATCH_TOKENS
        )
        const pendingContext = [summary || "", ...uncompactedTurns.map(formatTurn), currentMessage]
            .filter(Boolean)
            .join("\n\n")

        if (uncompactedTurns.length > 0 && estimateTokens(pendingContext) >= threshold) {
            const { turnsToCompact } = planCompaction(uncompactedTurns, retainTokens, batchTokens)
            if (turnsToCompact.length > 0) {
                try {
                    const updatedSummary = await openRouterManager.compactConversation(
                        summary || "",
                        turnsToCompact.map(formatTurn).join("\n\n")
                    )
                    const updatedAt = new Date()
                    const nextCompactedMessageCount = compactedMessageCount + turnsToCompact.length
                    const nextCompactedThroughMessageId =
                        turnsToCompact[turnsToCompact.length - 1]?.id

                    const [updatedConversation] = await db
                        .update(conversations)
                        .set({
                            summary: updatedSummary,
                            compactedMessageCount: nextCompactedMessageCount,
                            compactedThroughMessageId: nextCompactedThroughMessageId,
                            compactionCount: conversation.compactionCount + 1,
                            summaryUpdatedAt: updatedAt,
                            updatedAt,
                        })
                        .where(
                            and(
                                eq(conversations.id, conversationId),
                                eq(conversations.userId, userId),
                                compactedThroughMessageId
                                    ? eq(
                                          conversations.compactedThroughMessageId,
                                          compactedThroughMessageId
                                      )
                                    : isNull(conversations.compactedThroughMessageId)
                            )
                        )
                        .returning()

                    if (updatedConversation) {
                        summary = updatedConversation.summary
                        summaryUpdatedAt = updatedConversation.summaryUpdatedAt
                        compactedMessageCount = updatedConversation.compactedMessageCount
                        compactedThroughMessageId = updatedConversation.compactedThroughMessageId
                        uncompactedTurns = history.slice(
                            history.findIndex((turn) => turn.id === compactedThroughMessageId) + 1
                        )
                        compacted = true
                    } else {
                        const [latestConversation] = await db
                            .select()
                            .from(conversations)
                            .where(
                                and(
                                    eq(conversations.id, conversationId),
                                    eq(conversations.userId, userId)
                                )
                            )
                            .limit(1)

                        if (latestConversation) {
                            summary = latestConversation.summary
                            summaryUpdatedAt = latestConversation.summaryUpdatedAt
                            compactedMessageCount = latestConversation.compactedMessageCount
                            compactedThroughMessageId = latestConversation.compactedThroughMessageId
                            const latestCursorIndex = compactedThroughMessageId
                                ? history.findIndex((turn) => turn.id === compactedThroughMessageId)
                                : -1
                            uncompactedTurns = compactedThroughMessageId
                                ? history.slice(latestCursorIndex >= 0 ? latestCursorIndex + 1 : 0)
                                : history
                        }
                    }
                } catch (err) {
                    console.warn("Conversation compaction failed; using uncompacted history:", err)
                }
            }
        }

        const semanticMatches = await embeddingsService.findSimilarMessagesInConversation(
            userId,
            conversationId,
            currentMessage,
            DEFAULT_SEMANTIC_MATCHES
        )
        const recentBudget = Math.max(
            0,
            threshold - estimateTokens(summary || "") - estimateTokens(currentMessage)
        )
        const recentTurns: typeof uncompactedTurns = []
        let recentContextTokens = 0

        for (let index = uncompactedTurns.length - 1; index >= 0; index -= 1) {
            const turn = uncompactedTurns[index]
            if (!turn) continue

            const formattedTurn = formatTurn(turn)
            const turnTokens = estimateTokens(formattedTurn)
            if (recentContextTokens + turnTokens > recentBudget) break

            recentTurns.unshift(turn)
            recentContextTokens += turnTokens
        }
        const recentMessageIds = new Set(recentTurns.map((turn) => turn.id))
        const recentContext = recentTurns.map(formatTurn)

        let semanticBudget = Math.max(
            0,
            threshold -
                estimateTokens(summary || "") -
                estimateTokens(currentMessage) -
                recentContextTokens
        )
        const relevantContext: string[] = []

        for (const match of semanticMatches) {
            if (recentMessageIds.has(match.messageId)) continue

            const formattedMatch = `${match.isUserMessage ? "User" : "Assistant"}: ${match.content}`
            const matchTokens = estimateTokens(formattedMatch)
            if (matchTokens > semanticBudget) continue

            relevantContext.push(formattedMatch)
            semanticBudget -= matchTokens
        }

        const sections = [
            summary ? `Semantic conversation memory:\n${summary}` : "",
            recentContext.length > 0 ? `Recent conversation:\n${recentContext.join("\n\n")}` : "",
            relevantContext.length > 0
                ? `Relevant earlier details:\n${relevantContext.join("\n")}`
                : "",
        ].filter(Boolean)

        return {
            context: sections.join("\n\n"),
            compacted,
            summary,
            summaryUpdatedAt,
        }
    }
}

export default new ConversationContextService()
