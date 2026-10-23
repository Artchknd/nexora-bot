"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, timingSafeEqual } from "crypto";
import { COOKIE_NAME, MAX_AGE, createSessionToken } from "@/lib/admin-auth";

export async function login(formData: FormData) {
  const input = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD ?? "";

  // hash both sides so the comparison is constant-time and length-independent
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();

  if (!expected || !timingSafeEqual(a, b)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down brute force
    redirect("/admin/login?error=1");
  }

  const jar = await cookies();
  jar.set(COOKIE_NAME, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: MAX_AGE,
  });
  redirect("/admin");
}

export async function logout() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { path: "/admin", maxAge: 0 });
  redirect("/admin/login");
}