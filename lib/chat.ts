import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { messages, userSettings } from "./db/schema";
import { DEFAULT_MODEL, generateReply } from "./gemini";

const HISTORY_LIMIT = 20;

export function contextKey(userId: string, channelId: string) {
  return `${userId}:${channelId}`;
}

function isModelGone(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { status?: number }).status === 404
  );
}

export async function chat(opts: {
  userId: string;
  channelId: string;
  prompt: string;
  styleOverride?: string;
  modelOverride?: string;
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

  const style = opts.styleOverride ?? setting?.style;
  const model = opts.modelOverride ?? setting?.model ?? DEFAULT_MODEL;

  let reply: string;
  let note = "";
  try {
    reply = await generateReply(history, opts.prompt, style, model);
  } catch (err) {
    // 所選模型被下架時，自動退回預設模型，避免整個 Bot 掛掉
    if (isModelGone(err) && model !== DEFAULT_MODEL) {
      reply = await generateReply(history, opts.prompt, style, DEFAULT_MODEL);
      note = `(模型 ${model} 已無法使用，這次改用 ${DEFAULT_MODEL}。可用 /model set 重新選擇。)\n\n`;
    } else {
      throw err;
    }
  }

  await db.insert(messages).values([
    { contextKey: key, role: "user", content: opts.prompt },
    { contextKey: key, role: "model", content: reply },
  ]);

  return note + reply;
}
