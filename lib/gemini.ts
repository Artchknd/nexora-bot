import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const BASE_INSTRUCTION =
  "你是 Discord 上的 AI 助理。預設用使用者提問的語言回答，內容簡潔、適合在聊天室閱讀。";

export interface Turn {
  role: "user" | "model";
  content: string;
}

export async function generateReply(
  history: Turn[],
  prompt: string,
  style?: string | null,
): Promise<string> {
  const systemInstruction = style
    ? `${BASE_INSTRUCTION}\n\n回答風格：${style}`
    : BASE_INSTRUCTION;

  const contents = [...history, { role: "user" as const, content: prompt }].map(
    (t) => ({ role: t.role, parts: [{ text: t.content }] }),
  );

  const res = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: { systemInstruction, maxOutputTokens: 1500 },
  });

  return res.text?.trim() || "(模型沒有回傳內容，可能被安全機制擋下，換個說法試試)";
}
