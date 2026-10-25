export type CheckResult = {
  ok: boolean;
  title: string;
  detail: string;
  latencyMs: number | null;
};

async function timedFetch(url: string, init: RequestInit) {
  const start = Date.now();
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  return { res, ms: Date.now() - start };
}

export async function checkDiscord(): Promise<CheckResult> {
  const title = "Discord API";
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return { ok: false, title, detail: "DISCORD_BOT_TOKEN 未設定", latencyMs: null };
  }
  try {
    const { res, ms } = await timedFetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) {
      return { ok: false, title, detail: `HTTP ${res.status}`, latencyMs: ms };
    }
    const data = (await res.json()) as { username?: string };
    return { ok: true, title, detail: `Bot：${data.username ?? "unknown"}`, latencyMs: ms };
  } catch {
    return { ok: false, title, detail: "連線失敗或逾時", latencyMs: null };
  }
}

export async function checkGemini(): Promise<CheckResult> {
  const title = "Gemini API";
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { ok: false, title, detail: "GEMINI_API_KEY 未設定", latencyMs: null };
  }
  try {
    const { res, ms } = await timedFetch(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
      { headers: { "x-goog-api-key": key } }
    );
    if (!res.ok) {
      return { ok: false, title, detail: `HTTP ${res.status}`, latencyMs: ms };
    }
    return { ok: true, title, detail: "金鑰有效", latencyMs: ms };
  } catch {
    return { ok: false, title, detail: "連線失敗或逾時", latencyMs: null };
  }
}

const ENV_NAMES = [
  "DISCORD_APP_ID",
  "DISCORD_PUBLIC_KEY",
  "DISCORD_BOT_TOKEN",
  "GEMINI_API_KEY",
  "ALLOWED_USER_IDS",
  "WORKER_SECRET",
  "DATABASE_URL",
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SECRET",
] as const;

export function envStatus() {
  return ENV_NAMES.map((name) => ({ name, set: Boolean(process.env[name]) }));
}

export function whitelistCount(): number {
  return (process.env.ALLOWED_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean).length;
}