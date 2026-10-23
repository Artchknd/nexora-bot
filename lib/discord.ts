import { verifyKey } from "discord-interactions";

const API = "https://discord.com/api/v10";
const MAX_LEN = 1900;

export const EPHEMERAL = 64;

export interface CommandOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  focused?: boolean;
  options?: CommandOption[];
}

export interface Interaction {
  type: number;
  token: string;
  application_id: string;
  channel_id?: string;
  member?: { user: { id: string } };
  user?: { id: string };
  data?: {
    name: string;
    type?: number;
    options?: CommandOption[];
    target_id?: string;
    resolved?: { messages?: Record<string, { content: string }> };
  };
}

export async function verifyRequest(
  req: Request,
): Promise<{ ok: boolean; body: string }> {
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const body = await req.text();
  if (!signature || !timestamp) return { ok: false, body };
  const ok = await verifyKey(
    body,
    signature,
    timestamp,
    process.env.DISCORD_PUBLIC_KEY!,
  );
  return { ok, body };
}

export function isAllowed(userId: string): boolean {
  const ids = (process.env.ALLOWED_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

export function getOption(
  options: CommandOption[] | undefined,
  name: string,
): string | undefined {
  const v = options?.find((o) => o.name === name)?.value;
  return typeof v === "string" ? v : undefined;
}

function splitMessage(text: string, limit = MAX_LEN): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n", limit);
    if (cut < limit / 2) cut = limit;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

async function callDiscord(url: string, method: string, body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("Discord API error", res.status, await res.text());
  }
}

// 以 deferred response 的 token 回傳最終內容；超過長度上限時用 follow-up 補送
export async function sendResult(
  appId: string,
  token: string,
  text: string,
  ephemeral: boolean,
) {
  const [first, ...rest] = splitMessage(text.trim() || "(空白回覆)");
  const allowed_mentions = { parse: [] as string[] };

  await callDiscord(
    `${API}/webhooks/${appId}/${token}/messages/@original`,
    "PATCH",
    { content: first, allowed_mentions },
  );
  for (const chunk of rest) {
    await callDiscord(`${API}/webhooks/${appId}/${token}`, "POST", {
      content: chunk,
      flags: ephemeral ? EPHEMERAL : 0,
      allowed_mentions,
    });
  }
}
