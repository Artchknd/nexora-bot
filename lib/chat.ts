import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { messages, userSettings } from "./db/schema";
import { generateReply } from "./gemini";

const HISTORY_LIMIT = 20;

export function contextKey(userId: string, channelId: string) {
  return `${userId}:${channelId}`;
}

export async function chat(opts: {
  userId: string;
  channelId: string;
  prompt: string;
  styleOverride?: string;
}): Promise<string> {
  const key = contextKey(opts.userId, opts.channelId);

  const [setting] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, opts.userId));

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.contextKey, key))
    .orderBy(desc(messages.id))
    .limit(HISTORY_LIMIT);

  const history = rows
    .reverse()
    .map((r) => ({ role: r.role, content: r.content }));

  const reply = await generateReply(
    history,
    opts.prompt,
    opts.styleOverride ?? setting?.style,
  );

  await db.insert(messages).values([
    { contextKey: key, role: "user", content: opts.prompt },
    { contextKey: key, role: "model", content: reply },
  ]);

  return reply;
}
