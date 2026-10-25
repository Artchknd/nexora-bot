import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { messages, userSettings } from "./db/schema";
import { getGlobalStyle } from "./app-settings";
import { classifyError } from "./errors";
import { DEFAULT_MODEL, generateReply, type Turn } from "./gemini";
import { logUsage } from "./usage";

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

// one Gemini call, recorded in usage_logs whether it succeeds or fails
async function callGemini(
  userId: string,
  model: string,
  history: Turn[],
  prompt: string,
  style: string | null | undefined,
  search: boolean,
): Promise<string> {
  const started = Date.now();
  try {
    const { text, usage } = await generateReply(history, prompt, style, model, search);
    await logUsage({
      userId,
      model,
      ok: true,
      latencyMs: Date.now() - started,
      ...usage,
    });
    return text;
  } catch (err) {
    const info = classifyError(err);
    await logUsage({
      userId,
      model,
      ok: false,
      httpStatus: info.status,
      errorKind: info.kind,
      errorMessage: info.raw.slice(0, 500),
      latencyMs: Date.now() - started,
    });
    throw err;
  }
}

export async function chat(opts: {
  userId: string;
  channelId: string;
  prompt: string;
  styleOverride?: string;
  modelOverride?: string;
  search?: boolean;
}): Promise<string> {
  const key = contextKey(opts.userId, opts.channelId);

  const [[setting], globalStyle] = await Promise.all([
    db.select().from(userSettings).where(eq(userSettings.userId, opts.userId)),
    getGlobalStyle(),
  ]);

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.contextKey, key))
    .orderBy(desc(messages.id))
    .limit(HISTORY_LIMIT);

  const history = rows
    .reverse()
    .map((r) => ({ role: r.role, content: r.content }));

  // 優先順序：/ask 的臨時風格 > 個人風格 > 全域風格
  const style = opts.styleOverride ?? setting?.style ?? globalStyle;
  const model = opts.modelOverride ?? setting?.model ?? DEFAULT_MODEL;

  const search = opts.search ?? false;

  let reply: string;
  let note = "";
  try {
    reply = await callGemini(opts.userId, model, history, opts.prompt, style, search);
  } catch (err) {
    // 所選模型被下架時，自動退回預設模型，避免整個 Bot 掛掉
    if (isModelGone(err) && model !== DEFAULT_MODEL) {
      reply = await callGemini(opts.userId, DEFAULT_MODEL, history, opts.prompt, style, search);
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
