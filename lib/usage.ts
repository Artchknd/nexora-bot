import { db } from "./db";
import { usageLogs } from "./db/schema";

export type UsageEntry = typeof usageLogs.$inferInsert;

// logging must never break a reply, so failures are only reported to the console
export async function logUsage(entry: UsageEntry): Promise<void> {
  try {
    await db.insert(usageLogs).values(entry);
  } catch (err) {
    console.error("log usage failed", err);
  }
}
