import { login } from "@/app/admin/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="login-wrap">
      <form action={login} className="glass login-card">
        <h1 className="login-title">Nexora</h1>
        <p className="muted">管理後台</p>
        <input
          className="field"
          type="password"
          name="password"
          placeholder="管理員密碼"
          autoComplete="current-password"
          autoFocus
          required
        />
        {error && <p className="error-text">密碼錯誤</p>}
        <button className="btn" type="submit">登入</button>
      </form>
    </main>
  );
}