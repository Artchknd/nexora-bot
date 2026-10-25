import { GoogleGenAI } from "@google/genai";
import { GeminiTimeoutError } from "./errors";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

const TIMEZONE = process.env.BOT_TIMEZONE ?? "Asia/Taipei";

// Our own deadlines must stay below maxDuration in app/api/discord/route.ts (60 s),
// leaving room to log usage and post the reply after a timeout.
const TIMEOUT_MS = 35_000;
const SEARCH_TIMEOUT_MS = 50_000;

const BASE_INSTRUCTION =
  "你是 Discord 上的 AI 助理。預設用使用者提問的語言回答，內容簡潔、適合在聊天室閱讀。";

// 這些不是文字對話用的模型，從選單中排除
const EXCLUDED_KEYWORDS = [
  "image",
  "tts",
  "live",
  "embedding",
  "audio",
  "native",
  "robotics",
  "computer-use",
];

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { at: number; ids: string[] } | null = null;

// 向 Gemini API 查詢目前這把 key 可用的對話模型，避免模型名稱寫死後過期
export async function listChatModels(): Promise<string[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.ids;

  const ids: string[] = [];
  const pager = await ai.models.list({ config: { pageSize: 100 } });
  for await (const m of pager) {
    const id = m.name?.replace(/^models\//, "");
    if (!id || !id.startsWith("gemini-")) continue;

    const actions = (m as { supportedActions?: string[] }).supportedActions;
    if (actions && !actions.includes("generateContent")) continue;
    if (EXCLUDED_KEYWORDS.some((k) => id.includes(k))) continue;

    ids.push(id);
  }
  ids.sort((a, b) => b.localeCompare(a));

  cache = { at: Date.now(), ids };
  return ids;
}

export interface Turn {
  role: "user" | "model";
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  totalTokens: number;
}

export interface ReplyResult {
  text: string;
  usage: TokenUsage;
}

// e.g. "現在是 2026-10-23 星期五 15:42，時區 Asia/Taipei"
function currentTimeLine(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("zh-TW", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `現在是 ${parts.year}-${parts.month}-${parts.day} ${parts.weekday} ${parts.hour}:${parts.minute}，時區 ${TIMEZONE}`;
}

export async function generateReply(
  history: Turn[],
  prompt: string,
  style: string | null | undefined,
  model: string,
  search = false,
): Promise<ReplyResult> {
  // the time goes into the system prompt only, never into the stored history
  let systemInstruction = `${BASE_INSTRUCTION}\n\n${currentTimeLine()}`;
  if (style) systemInstruction += `\n\n回答風格：${style}`;

  const contents = [...history, { role: "user" as const, content: prompt }].map(
    (t) => ({ role: t.role, parts: [{ text: t.content }] }),
  );

  const timeoutMs = search ? SEARCH_TIMEOUT_MS : TIMEOUT_MS;
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const call = ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      maxOutputTokens: 1500,
      abortSignal: ctrl.signal,
      ...(search ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });
  call.catch(() => {}); // the abort rejects this promise after we have stopped listening

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new GeminiTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  let res: Awaited<typeof call>;
  try {
    res = await Promise.race([call, deadline]);
  } finally {
    clearTimeout(timer);
  }

  const u = res.usageMetadata;
  const usage: TokenUsage = {
    promptTokens: u?.promptTokenCount ?? 0,
    outputTokens: u?.candidatesTokenCount ?? 0,
    thoughtTokens: u?.thoughtsTokenCount ?? 0,
    totalTokens: u?.totalTokenCount ?? 0,
  };

  return {
    text: res.text?.trim() || "(模型沒有回傳內容，可能被安全機制擋下，換個說法試試)",
    usage,
  };
}
