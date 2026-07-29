import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

function resolvePostgresHost(): string {
    return process.env["POSTGRES_HOST"]?.trim() || "localhost"
}

export const queryClient = postgres({
    host: resolvePostgresHost(),
    port: parseInt(process.env["POSTGRES_PORT"] || "5432", 10),
    database: process.env["POSTGRES_DB"] || "meshmind",
    user: process.env["POSTGRES_USER"] || "postgres",
    password: process.env["POSTGRES_PASSWORD"],
})

export const db = drizzle(queryClient, { schema })

export async function healthCheck(): Promise<{
    ok: boolean
    postgresVersion?: string
    vectorVersion?: string
    error?: string
}> {
    try {
        const [status] = await queryClient<
            { postgres_version: string; vector_version: string | null }[]
        >`
            SELECT
                current_setting('server_version') AS postgres_version,
                (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS vector_version
        `

        if (!status?.postgres_version.startsWith("18.")) {
            throw new Error(`PostgreSQL 18 is required; connected to ${status?.postgres_version}`)
        }
        if (!status.vector_version) {
            throw new Error("The pgvector extension is not installed")
        }

        return {
            ok: true,
            postgresVersion: status.postgres_version,
            vectorVersion: status.vector_version,
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        return { ok: false, error: message }
    }
}

export async function closeConnection(): Promise<void> {
    await queryClient.end()
}

export default db
