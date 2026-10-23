import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

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

export async function generateReply(
  history: Turn[],
  prompt: string,
  style: string | null | undefined,
  model: string,
): Promise<string> {
  const systemInstruction = style
    ? `${BASE_INSTRUCTION}\n\n回答風格：${style}`
    : BASE_INSTRUCTION;

  const contents = [...history, { role: "user" as const, content: prompt }].map(
    (t) => ({ role: t.role, parts: [{ text: t.content }] }),
  );

  const res = await ai.models.generateContent({
    model,
    contents,
    config: { systemInstruction, maxOutputTokens: 1500 },
  });

  return res.text?.trim() || "(模型沒有回傳內容，可能被安全機制擋下，換個說法試試)";
}
