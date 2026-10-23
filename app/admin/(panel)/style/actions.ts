"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin-guard";
import { setGlobalStyle } from "@/lib/app-settings";
import { SNOWFLAKE, type FormState } from "@/lib/admin-form";

const MAX_STYLE_LENGTH = 500;

function readStyle(formData: FormData): { style: string | null; error?: string } {
  const intent = String(formData.get("intent") ?? "save");
  const raw = String(formData.get("style") ?? "").trim();
  if (raw.length > MAX_STYLE_LENGTH) {
    return { style: null, error: `風格最多 ${MAX_STYLE_LENGTH} 字，請縮短後再儲存` };
  }
  return { style: intent === "clear" || raw === "" ? null : raw };
}

export async function saveStyle(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  if (!SNOWFLAKE.test(userId)) {
    return { status: "error", message: "使用者 ID 格式不正確" };
  }
  const { style, error } = readStyle(formData);
  if (error) return { status: "error", message: error };

  try {
    await db
      .insert(userSettings)
      .values({ userId, style })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { style, updatedAt: new Date() },
      });
  } catch (err) {
    console.error("admin saveStyle failed", err);
    return { status: "error", message: "資料庫寫入失敗，請稍後再試" };
  }

  revalidatePath("/admin/style");
  return { status: "ok", message: style ? "已儲存" : "已清除" };
}

export async function saveGlobalStyle(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const { style, error } = readStyle(formData);
  if (error) return { status: "error", message: error };

  try {
    await setGlobalStyle(style);
  } catch (err) {
    console.error("admin saveGlobalStyle failed", err);
    return { status: "error", message: "資料庫寫入失敗，請確認已執行 npm run db:push" };
  }

  revalidatePath("/admin/style");
  return { status: "ok", message: style ? "已儲存" : "已清除" };
}
