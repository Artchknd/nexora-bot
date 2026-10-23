export type ErrorKind =
  | "rate_limit"
  | "daily_quota"
  | "overloaded"
  | "server_error"
  | "bad_request"
  | "auth"
  | "model_gone"
  | "network"
  | "unknown";

export interface ErrorInfo {
  kind: ErrorKind;
  status: number | null;
  raw: string;
}

// who has to act: Google's side, a quota/rate limit, or this bot's own setup
export type ErrorSide = "google" | "quota" | "config" | "network" | "unknown";

export function classifyError(err: unknown): ErrorInfo {
  const rawStatus = (err as { status?: unknown } | null)?.status;
  const status = typeof rawStatus === "number" ? rawStatus : null;
  const raw = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";

  if (status === 429) {
    return { kind: /per\s*day|perday/i.test(raw) ? "daily_quota" : "rate_limit", status, raw };
  }
  if (status === 503) return { kind: "overloaded", status, raw };
  if (status !== null && status >= 500) return { kind: "server_error", status, raw };
  if (status === 404) return { kind: "model_gone", status, raw };
  if (status === 401 || status === 403) return { kind: "auth", status, raw };
  if (status === 400) {
    const badKey = /api key (not valid|expired|invalid)/i.test(raw);
    return { kind: badKey ? "auth" : "bad_request", status, raw };
  }
  if (status !== null) return { kind: "unknown", status, raw };

  if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    /fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|timed? ?out/i.test(raw)
  ) {
    return { kind: "network", status: null, raw };
  }
  return { kind: "unknown", status: null, raw };
}

export const ERROR_KIND_LABEL: Record<ErrorKind, string> = {
  rate_limit: "請求過於頻繁",
  daily_quota: "每日額度用完",
  overloaded: "Google 過載",
  server_error: "Google 伺服器錯誤",
  bad_request: "請求被拒絕",
  auth: "金鑰或權限問題",
  model_gone: "模型已下架",
  network: "連線失敗",
  unknown: "未知錯誤",
};

export function errorSide(kind: string | null): ErrorSide {
  switch (kind) {
    case "overloaded":
    case "server_error":
      return "google";
    case "rate_limit":
    case "daily_quota":
      return "quota";
    case "bad_request":
    case "auth":
    case "model_gone":
      return "config";
    case "network":
      return "network";
    default:
      return "unknown";
  }
}

const BODY: Record<ErrorKind, string> = {
  rate_limit:
    "現在同時使用的人比較多，Gemini 暫時限制了回應速度。請等一分鐘左右再試一次。",
  daily_quota:
    "今天的 Gemini 用量額度已經用完了，要等額度重置才能繼續使用。可以用 /model set 換一個模型試試，或請管理員處理。",
  overloaded:
    "Gemini 伺服器目前負載過高，這是 Google 那邊的狀況，不是你的問題。過幾分鐘再試一次通常就會恢復。",
  server_error: "Gemini 服務暫時出了點問題，是 Google 那邊的錯誤，請稍後再試一次。",
  auth: "機器人的 API 金鑰或權限有問題，需要管理員處理，請通知管理員。",
  bad_request:
    "Gemini 沒有接受這次的請求，可能是內容或設定有問題。可以換個說法再試，如果一直發生請通知管理員。",
  model_gone:
    "目前使用的模型已經無法使用。可以用 /model set 換一個模型，或請管理員檢查預設模型。",
  network: "連線外部服務時失敗（網路或逾時），請稍後再試一次。",
  unknown: "發生了未預期的錯誤，請稍後再試，如果一直發生請通知管理員。",
};

export function userFacingMessage(info: ErrorInfo): string {
  const code =
    info.status !== null
      ? `HTTP ${info.status}`
      : info.kind === "network"
        ? "連線錯誤"
        : "錯誤代碼不明";
  return `${BODY[info.kind]}（${code}）`;
}
