"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { listChatModels } from "@/lib/gemini";
import { requireAdmin } from "@/lib/admin-guard";
import { SNOWFLAKE, type FormState } from "@/lib/admin-form";

export async function saveModel(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const raw = String(formData.get("model") ?? "").trim();

  if (!SNOWFLAKE.test(userId)) {
    return { status: "error", message: "使用者 ID 格式不正確" };
  }

  // empty value means "use the system default"
  const model = raw === "" ? null : raw;

  if (model) {
    try {
      const ids = await listChatModels();
      if (!ids.includes(model)) {
        return { status: "error", message: "找不到這個模型，請重新整理頁面後再選" };
      }
    } catch (err) {
      console.error("admin saveModel list failed", err);
      return { status: "error", message: "無法取得模型清單，請稍後再試" };
    }
  }

  try {
    await db
      .insert(userSettings)
      .values({ userId, model })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { model, updatedAt: new Date() },
      });
  } catch (err) {
    console.error("admin saveModel failed", err);
    return { status: "error", message: "資料庫寫入失敗，請稍後再試" };
  }

  revalidatePath("/admin/model");
  return { status: "ok", message: model ? "已儲存" : "已改回系統預設" };
}
