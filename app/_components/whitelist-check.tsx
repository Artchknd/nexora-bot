"use client";

import { useActionState, useState } from "react";
import { checkWhitelist, type WhitelistState } from "@/app/check-whitelist";

const INITIAL: WhitelistState = { status: "idle" };

export function WhitelistCheck({ profileUrl }: { profileUrl: string }) {
  const [state, action, pending] = useActionState(checkWhitelist, INITIAL);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  const requestText =
    state.status === "out" ? `我想使用 Nexora，我的 ID 是 ${state.id}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(requestText);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  return (
    <div className="glass card home-card">
      <div className="card-top">
        <span className="card-label">我在白名單內嗎？</span>
      </div>

      <form action={action} className="home-check" onChange={() => setCopied(null)}>
        <input
          className="field"
          name="userId"
          inputMode="numeric"
          placeholder="輸入你的 Discord 使用者 ID"
          autoComplete="off"
          required
        />
        <button className="btn btn-inline" type="submit" disabled={pending}>
          {pending ? "查詢中" : "查詢"}
        </button>
      </form>

      <details className="home-help muted small">
        <summary>怎麼取得自己的 ID？</summary>
        <p>
          Discord 設定 → 進階 → 開啟「開發者模式」，之後在自己的頭像或名稱上按右鍵（手機長按），選「複製使用者 ID」。
        </p>
      </details>

      <div aria-live="polite">
        {state.status === "invalid" && (
          <p className="error-text">ID 格式不對，應該是 17 到 20 位的數字。</p>
        )}
        {state.status === "limited" && (
          <p className="error-text">查詢太頻繁了，請稍後再試。</p>
        )}
        {state.status === "in" && (
          <p className="ok-text">這個 ID 在白名單內，可以使用。</p>
        )}
        {state.status === "out" && (
          <div className="home-contact">
            <p className="error-text">這個 ID 不在白名單內。</p>
            <p className="muted small">想使用的話，請聯絡管理員：</p>
            <div className="home-contact-actions">
              <a
                className="btn btn-ghost btn-inline home-link"
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                管理員的 Discord 個人檔案
              </a>
              <button className="btn btn-ghost btn-inline" type="button" onClick={copy}>
                {copied === "ok" ? "已複製" : "複製申請訊息"}
              </button>
            </div>
            <p className="muted small home-request">{requestText}</p>
            {copied === "fail" && (
              <p className="error-text">自動複製失敗，請手動複製上面那行字。</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
