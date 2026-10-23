import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";
import { logout } from "@/app/admin/actions";
import { AdminNav } from "@/app/admin/_components/admin-nav";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // defense in depth: the proxy already checks, verify again here
  const jar = await cookies();
  if (!(await verifySessionToken(jar.get(COOKIE_NAME)?.value))) {
    redirect("/admin/login");
  }

  return (
    <div className="shell">
      <aside className="glass sidebar">
        <div className="brand">Nexora</div>
        <AdminNav />
        <form action={logout} className="logout">
          <button className="btn btn-ghost" type="submit">登出</button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
