import { describe, expect, test } from "bun:test"
import { estimateTokens, planCompaction } from "./conversationContextService"

const turn = (id: string, text: string) => ({
    id,
    userMessage: text,
    botResponse: text,
})

describe("conversation compaction planning", () => {
    test("estimates tokens conservatively from characters", () => {
        expect(estimateTokens("12345")).toBe(2)
        expect(estimateTokens("")).toBe(0)
    })

    test("retains the newest turns inside the tail budget", () => {
        const turns = [turn("1", "a".repeat(20)), turn("2", "b"), turn("3", "c")]
        const plan = planCompaction(turns, 12, 100)

        expect(plan.turnsToCompact.map(({ id }) => id)).toEqual(["1"])
        expect(plan.retainedTurns.map(({ id }) => id)).toEqual(["2", "3"])
    })

    test("limits each compaction batch without skipping later turns", () => {
        const turns = [turn("1", "a".repeat(20)), turn("2", "b".repeat(20)), turn("3", "c")]
        const firstTurnTokens = estimateTokens(
            `User: ${"a".repeat(20)}\nAssistant: ${"a".repeat(20)}`
        )
        const plan = planCompaction(turns, 0, firstTurnTokens)

        expect(plan.turnsToCompact.map(({ id }) => id)).toEqual(["1"])
        expect(plan.retainedTurns.map(({ id }) => id)).toEqual(["2", "3"])
    })
})
