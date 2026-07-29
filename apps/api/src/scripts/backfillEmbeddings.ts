import { closeConnection, db, messages } from "@meshmind/database"
import { asc } from "drizzle-orm"
import embeddingsService from "../services/embeddingsService"

const main = async () => {
    const rows = await db.select().from(messages).orderBy(asc(messages.timestamp), asc(messages.id))
    let completed = 0

    try {
        for (const message of rows) {
            await embeddingsService.storeMessageEmbeddings(
                message.id,
                message.conversationId,
                message.userId,
                message.userMessage,
                message.botResponse
            )
            completed += 1
            console.log(`Embedded ${completed}/${rows.length} message turns`)
        }
    } finally {
        await closeConnection()
    }
}

main().catch((err) => {
    console.error("Embedding backfill failed:", err)
    process.exitCode = 1
})
