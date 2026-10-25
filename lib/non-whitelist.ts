import { sql } from "drizzle-orm";
import { db } from "./db";
import { nonWhitelistHits } from "./db/schema";
import { SITE_URL } from "./site";

const NOTICE_COUNT = 2;

export const NON_WHITELIST_NOTICE = `你還不在 Nexora 的白名單內，所以沒辦法使用。可以到 ${SITE_URL} 查詢並聯絡管理員。`;

// Call only for people who failed isAllowed(). Returns whether to send the notice:
// the first two times yes, from the third time on the bot stays silent.
// Nothing the person wrote is stored or sent to the AI.
export async function recordNonWhitelist(userId: string): Promise<{ count: number; notify: boolean }> {
  const [row] = await db
    .insert(nonWhitelistHits)
    .values({ userId, count: 1 })
    .onConflictDoUpdate({
      target: nonWhitelistHits.userId,
      set: { count: sql`${nonWhitelistHits.count} + 1`, lastAt: new Date() },
    })
    .returning({ count: nonWhitelistHits.count });
  return { count: row.count, notify: row.count <= NOTICE_COUNT };
}
