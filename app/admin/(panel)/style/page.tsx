import { loadAdminUsers } from "@/lib/admin-users";
import { getGlobalStyle } from "@/lib/app-settings";
import { UserHead } from "@/app/admin/_components/user-head";
import { StyleForm } from "./style-form";
import { saveGlobalStyle, saveStyle } from "./actions";

export const dynamic = "force-dynamic";

function formatTime(d: Date): string {
  return d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

export default async function StylePage() {
  const [users, globalStyle] = await Promise.all([loadAdminUsers(), getGlobalStyle()]);

  return (
    <>
      <header className="page-head">
        <h1>回答風格</h1>
        <p className="muted">與 Discord 的 /style 指令共用同一份設定</p>
      </header>

      <section className="glass global-card">
        <div className="card-top">
          <span className="card-label">全域風格</span>
          <span className={`pill ${globalStyle ? "pill-ok" : ""}`}>
            <span className="dot" />
            {globalStyle ? "已設定" : "未設定"}
          </span>
        </div>
        <p className="muted small global-desc">
          沒有設定個人風格的使用者，會使用這裡的風格。
        </p>
        <StyleForm
          action={saveGlobalStyle}
          initialStyle={globalStyle}
          placeholder="例如：用繁體中文、簡短直接地回答"
        />
      </section>

      <h2 className="section-title">個別使用者</h2>

      {users.length === 0 ? (
        <div className="glass card">
          <p className="muted">
            白名單是空的。請在環境變數 ALLOWED_USER_IDS 加入使用者 ID。
          </p>
        </div>
      ) : (
        <section className="user-list">
          {users.map(({ profile, setting, inWhitelist }) => (
            <article key={profile.id} className="glass user-card">
              <div>
                <UserHead profile={profile} />
                <div className="meta-row">
                  <span className={`pill ${setting?.style ? "pill-ok" : ""}`}>
                    <span className="dot" />
                    {setting?.style ? "已設定" : globalStyle ? "沿用全域" : "未設定"}
                  </span>
                  {!inWhitelist && <span className="pill pill-warn">不在白名單</span>}
                </div>
                {setting && (
                  <p className="muted small updated">更新於 {formatTime(setting.updatedAt)}</p>
                )}
              </div>
              <StyleForm
                action={saveStyle}
                userId={profile.id}
                initialStyle={setting?.style ?? null}
                placeholder={globalStyle ? "留空則沿用全域風格" : "尚未設定"}
              />
            </article>
          ))}
        </section>
      )}
    </>
  );
}
