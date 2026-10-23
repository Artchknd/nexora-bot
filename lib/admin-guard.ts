import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";

// Server actions are public HTTP endpoints, so every admin action
// re-checks the session instead of relying on the proxy alone.
export async function requireAdmin(): Promise<void> {
  const jar = await cookies();
  if (!(await verifySessionToken(jar.get(COOKIE_NAME)?.value))) {
    redirect("/admin/login");
  }
}
