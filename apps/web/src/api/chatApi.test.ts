import { describe, expect, test } from "bun:test"
import { parseSseChunk } from "./chatApi"

describe("chat SSE parsing", () => {
    test("parses complete events and keeps a fragmented tail", () => {
        const parsed = parseSseChunk(
            'data: {"type":"metadata","conversation_id":"abc"}\n\ndata: {"type":"te'
        )

        expect(parsed.events).toEqual([{ type: "metadata", conversation_id: "abc" }])
        expect(parsed.remainder).toBe('data: {"type":"te')
    })

    test("parses compaction and done events", () => {
        const parsed = parseSseChunk(
            'data: {"type":"compaction","summary":"Memory"}\n\ndata: {"type":"done"}\n'
        )

        expect(parsed.events).toEqual([{ type: "compaction", summary: "Memory" }, { type: "done" }])
        expect(parsed.remainder).toBe("")
    })
})
