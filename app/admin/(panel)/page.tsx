import { isWorkerOnline } from "@/lib/app-settings";
import {
  checkDiscord,
  checkGemini,
  envStatus,
  whitelistCount,
} from "@/lib/admin-status";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [discord, gemini, workerOnline] = await Promise.all([
    checkDiscord(),
    checkGemini(),
    isWorkerOnline(),
  ]);
  const envs = envStatus();
  const missing = envs.filter((e) => !e.set).length;

  return (
    <>
      <header className="page-head">
        <h1>總覽</h1>
        <p className="muted">服務連線狀態與設定檢查</p>
      </header>

      <section className="grid">
        {[discord, gemini].map((c) => (
          <div key={c.title} className="glass card">
            <div className="card-top">
              <span className="card-label">{c.title}</span>
              <span className={`pill ${c.ok ? "pill-ok" : "pill-bad"}`}>
                <span className="dot" />
                {c.ok ? "正常" : "異常"}
              </span>
            </div>
            <div className="card-value">
              {c.latencyMs !== null ? `${c.latencyMs} ms` : "--"}
            </div>
            <div className="muted small">{c.detail}</div>
          </div>
        ))}

        <div className="glass card">
          <div className="card-top">
            <span className="card-label">白名單人數</span>
          </div>
          <div className="card-value">{whitelistCount()}</div>
          <div className="muted small">來自 ALLOWED_USER_IDS</div>
        </div>

        <div className="glass card">
          <div className="card-top">
            <span className="card-label">@ 模式</span>
            <span className={`pill ${workerOnline ? "pill-ok" : "pill-warn"}`}>
              <span className="dot" />
              {workerOnline ? "開啟中" : "休息中"}
            </span>
          </div>
          <div className="card-value">{workerOnline ? "worker 運作中" : "worker 未啟動"}</div>
          <div className="muted small">依 worker 心跳判斷，90 秒內有回報即視為開啟</div>
        </div>

        <div className="glass card">
          <div className="card-top">
            <span className="card-label">環境變數</span>
            <span className={`pill ${missing === 0 ? "pill-ok" : "pill-warn"}`}>
              <span className="dot" />
              {missing === 0 ? "齊全" : `缺 ${missing} 個`}
            </span>
          </div>
          <ul className="env-list">
            {envs.map((e) => (
              <li key={e.name}>
                <code>{e.name}</code>
                <span className={e.set ? "ok-text" : "error-text"}>
                  {e.set ? "已設定" : "未設定"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}