import { loadAdminUsers } from "@/lib/admin-users";
import { EMPTY_USAGE, loadUsage, type Totals, type UserUsage } from "@/lib/admin-usage";
import { formatNumber, formatTime, timeAgo } from "@/lib/admin-format";
import { ERROR_KIND_LABEL, errorSide, type ErrorKind } from "@/lib/errors";
import { UserHead } from "@/app/admin/_components/user-head";

export const dynamic = "force-dynamic";

const PERIODS: { key: "today" | "week" | "all"; label: string }[] = [
  { key: "today", label: "今天" },
  { key: "week", label: "近 7 天" },
  { key: "all", label: "累計" },
];

function kindLabel(kind: string | null): string {
  return kind && kind in ERROR_KIND_LABEL
    ? ERROR_KIND_LABEL[kind as ErrorKind]
    : ERROR_KIND_LABEL.unknown;
}

function statusOf(u: UserUsage): { label: string; cls: string } {
  if (!u.last) return { label: "尚無紀錄", cls: "" };
  if (u.last.ok) return { label: "正常", cls: "pill-ok" };
  return { label: "最近一次失敗", cls: "pill-bad" };
}

function Period({ label, t }: { label: string; t: Totals }) {
  return (
    <div className="period">
      <div className="period-label">{label}</div>
      <div className="period-value">
        {formatNumber(t.requests)}
        <span className="period-unit"> 次呼叫</span>
      </div>
      <div className="kv"><span>輸入 token</span><span>{formatNumber(t.promptTokens)}</span></div>
      <div className="kv"><span>輸出 token</span><span>{formatNumber(t.outputTokens)}</span></div>
      <div className="kv"><span>思考 token</span><span>{formatNumber(t.thoughtTokens)}</span></div>
      <div className="kv kv-total"><span>合計</span><span>{formatNumber(t.totalTokens)}</span></div>
      <div className="kv"><span>失敗次數</span><span>{formatNumber(t.errors)}</span></div>
    </div>
  );
}

export default async function UsersPage() {
  const [users, usage] = await Promise.all([loadAdminUsers(), loadUsage()]);

  const all = users.map((u) => usage.get(u.profile.id) ?? EMPTY_USAGE);
  const todayCalls = all.reduce((s, u) => s + u.today.requests, 0);
  const todayTokens = all.reduce((s, u) => s + u.today.totalTokens, 0);
  const weekErrors = all.reduce((s, u) => s + u.week.errors, 0);

  const byStatus = new Map<string, number>();
  for (const u of all) {
    for (const e of u.weekErrors) {
      const k = `${e.httpStatus ?? "—"} ${kindLabel(e.kind)}`;
      byStatus.set(k, (byStatus.get(k) ?? 0) + e.count);
    }
  }
  const topError = [...byStatus.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <>
      <header className="page-head">
        <h1>使用者</h1>
        <p className="muted">
          用量與錯誤紀錄從啟用記錄功能之後開始累計，更早的使用不會有數字。「今天」與「近 7 天」以台灣時間計算。
        </p>
      </header>

      <section className="grid summary">
        <div className="glass card">
          <div className="card-label">今天呼叫次數</div>
          <div className="card-value">{formatNumber(todayCalls)}</div>
        </div>
        <div className="glass card">
          <div className="card-label">今天 token 合計</div>
          <div className="card-value">{formatNumber(todayTokens)}</div>
        </div>
        <div className="glass card">
          <div className="card-label">近 7 天失敗次數</div>
          <div className="card-value">{formatNumber(weekErrors)}</div>
          <div className="muted small">
            {topError ? `最多：${topError[0]}（${topError[1]} 次）` : "沒有失敗紀錄"}
          </div>
        </div>
      </section>

      <p className="legend muted small">
        錯誤顏色：<span className="legend-google">紅色</span> 是 Google 端的問題，
        <span className="legend-quota">黃色</span> 是額度或頻率限制，
        <span className="legend-config">藍色</span> 是機器人這邊的設定問題。
        429 是整把 API 金鑰共用的額度，不是個別使用者的額度。
      </p>

      {users.length === 0 ? (
        <div className="glass card">
          <p className="muted">
            白名單是空的。請在環境變數 ALLOWED_USER_IDS 加入使用者 ID。
          </p>
        </div>
      ) : (
        <section className="usage-list">
          {users.map(({ profile, setting, inWhitelist }) => {
            const u = usage.get(profile.id) ?? EMPTY_USAGE;
            const status = statusOf(u);
            return (
              <article key={profile.id} className="glass usage-card">
                <div className="usage-top">
                  <UserHead profile={profile} />
                  <div className="meta-row">
                    <span className={`pill ${status.cls}`}>
                      <span className="dot" />
                      {status.label}
                    </span>
                    {!inWhitelist && <span className="pill pill-warn">不在白名單</span>}
                    <span className="pill">{setting?.style ? "個人風格" : "無個人風格"}</span>
                    <span className="pill">{setting?.model ?? "預設模型"}</span>
                  </div>
                </div>

                <div className="period-grid">
                  {PERIODS.map((p) => (
                    <Period key={p.key} label={p.label} t={u[p.key]} />
                  ))}
                </div>

                <div className="detail-grid">
                  <div className="detail">
                    <div className="k">最近一次呼叫</div>
                    <div className="v">
                      {u.last ? `${timeAgo(u.last.at)}（${formatTime(u.last.at)}）` : "尚無紀錄"}
                    </div>
                  </div>
                  <div className="detail">
                    <div className="k">最近使用的模型</div>
                    <div className="v">{u.last?.model ?? "—"}</div>
                  </div>
                  <div className="detail">
                    <div className="k">平均回應時間（近 7 天，成功）</div>
                    <div className="v">
                      {u.avgLatencyMs !== null ? `${formatNumber(Math.round(u.avgLatencyMs))} ms` : "—"}
                    </div>
                  </div>
                  <div className="detail">
                    <div className="k">最後一次對話</div>
                    <div className="v">
                      {u.lastMessageAt ? `${timeAgo(u.lastMessageAt)}（${formatTime(u.lastMessageAt)}）` : "尚無對話"}
                    </div>
                  </div>
                  <div className="detail">
                    <div className="k">已儲存的對話訊息數</div>
                    <div className="v">{formatNumber(u.messageCount)}</div>
                  </div>
                </div>

                {u.weekErrors.length > 0 && (
                  <div>
                    <div className="k">近 7 天錯誤</div>
                    <div className="chips">
                      {u.weekErrors.map((e) => (
                        <span
                          key={`${e.httpStatus}-${e.kind}`}
                          className={`chip chip-${errorSide(e.kind)}`}
                        >
                          {e.httpStatus ?? "—"} {kindLabel(e.kind)} × {e.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {u.lastError && (
                  <div className="last-error">
                    最近一次錯誤：{timeAgo(u.lastError.at)}（{formatTime(u.lastError.at)}），
                    模型 {u.lastError.model}，
                    {u.lastError.httpStatus !== null ? `HTTP ${u.lastError.httpStatus}` : "無 HTTP 狀態碼"}，
                    {kindLabel(u.lastError.kind)}
                    {u.lastError.message && <code>{u.lastError.message}</code>}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
