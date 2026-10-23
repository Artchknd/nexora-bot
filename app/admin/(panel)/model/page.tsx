import { loadAdminUsers } from "@/lib/admin-users";
import { DEFAULT_MODEL, listChatModels } from "@/lib/gemini";
import { UserHead } from "@/app/admin/_components/user-head";
import { ModelForm } from "./model-form";

export const dynamic = "force-dynamic";

function formatTime(d: Date): string {
  return d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

export default async function ModelPage() {
  const users = await loadAdminUsers();

  let models: string[] = [];
  let listFailed = false;
  try {
    models = await listChatModels();
  } catch (err) {
    console.error("admin list models failed", err);
    listFailed = true;
  }

  return (
    <>
      <header className="page-head">
        <h1>模型</h1>
        <p className="muted">
          與 Discord 的 /model 指令共用同一份設定，未指定的使用者使用系統預設：{DEFAULT_MODEL}
        </p>
      </header>

      {listFailed && (
        <div className="glass card notice">
          <p className="error-text">
            無法取得 Gemini 模型清單，暫時無法修改。請稍後重新整理頁面。
          </p>
        </div>
      )}

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
                  <span className={`pill ${setting?.model ? "pill-ok" : ""}`}>
                    <span className="dot" />
                    {setting?.model ? "自訂模型" : "系統預設"}
                  </span>
                  {!inWhitelist && <span className="pill pill-warn">不在白名單</span>}
                </div>
                {setting && (
                  <p className="muted small updated">更新於 {formatTime(setting.updatedAt)}</p>
                )}
              </div>
              <ModelForm
                userId={profile.id}
                currentModel={setting?.model ?? null}
                models={models}
                defaultModel={DEFAULT_MODEL}
                disabled={listFailed}
              />
            </article>
          ))}
        </section>
      )}
    </>
  );
}
