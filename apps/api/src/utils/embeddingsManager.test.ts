import { describe, expect, test } from "bun:test"
import { validateEmbeddingBatch } from "./embeddingsManager"

describe("embedding validation", () => {
    test("accepts the expected batch shape", () => {
        expect(validateEmbeddingBatch([[0.1, 0.2]], 1, 2)).toEqual([[0.1, 0.2]])
    })

    test("rejects missing vectors", () => {
        expect(() => validateEmbeddingBatch([], 1, 2)).toThrow("Expected 1 embeddings")
    })

    test("rejects wrong dimensions and non-finite values", () => {
        expect(() => validateEmbeddingBatch([[0.1]], 1, 2)).toThrow("2 finite values")
        expect(() => validateEmbeddingBatch([[0.1, Number.NaN]], 1, 2)).toThrow("2 finite values")
    })
})
