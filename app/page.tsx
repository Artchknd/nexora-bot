import Link from "next/link";
import "./admin/admin.css";
import "./home.css";
import { WhitelistCheck } from "./_components/whitelist-check";
import { isWorkerOnline } from "@/lib/app-settings";
import { ADMIN_PROFILE_URL, INSTALL_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const COMMANDS: { name: string; desc: string }[] = [
  { name: "/ask", desc: "向 AI 提問，可臨時指定回答風格、模型，或開啟上網搜尋" },
  { name: "/style", desc: "設定或清除自己的預設回答風格" },
  { name: "/model", desc: "設定、查看或清除自己的預設模型" },
  { name: "/reset", desc: "清除這個頻道的對話記憶" },
  { name: "Ask Nexora", desc: "對任一則訊息按右鍵（手機長按）→ Apps，請 AI 回應那則訊息" },
];

export default async function Home() {
  const workerOnline = await isWorkerOnline();

  return (
    <div className="admin-root">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />

      <div className="admin-content home-wrap">
        <header className="home-hero">
          <h1 className="home-title">Nexora</h1>
          <p className="muted">Discord 上的 AI 助理，只給自己和朋友使用。</p>
          <span className={`pill ${workerOnline ? "pill-ok" : "pill-warn"}`}>
            <span className="dot" />
            @ 模式：{workerOnline ? "開啟中" : "休息中"}
          </span>
        </header>

        <section className="glass card home-card">
          <div className="home-actions">
            <a
              className="btn home-link"
              href={INSTALL_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              加入我的帳號
            </a>
            <Link className="btn btn-ghost home-link" href="/admin">
              管理員登入
            </Link>
          </div>
          <p className="muted small">安裝後需在白名單內才能使用。</p>
        </section>

        <section className="glass card home-card">
          <div className="card-top">
            <span className="card-label">指令</span>
          </div>
          <ul className="home-commands">
            {COMMANDS.map((c) => (
              <li key={c.name}>
                <code>{c.name}</code>
                <span className="muted">{c.desc}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">
            在伺服器裡直接 @Nexora 提問只在「@ 模式」開啟中才有效；休息中時請用 / 指令。
          </p>
        </section>

        <WhitelistCheck profileUrl={ADMIN_PROFILE_URL} />
      </div>
    </div>
  );
}
