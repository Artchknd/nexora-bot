import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

const GLOBAL_STYLE_KEY = "global_style";

export async function getGlobalStyle(): Promise<string | null> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, GLOBAL_STYLE_KEY));
  return row?.value ?? null;
}

export async function setGlobalStyle(value: string | null): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: GLOBAL_STYLE_KEY, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}
