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

// The @ worker (batch 3) writes the current time in ms here as its heartbeat.
export const WORKER_HEARTBEAT_KEY = "worker_heartbeat";
const HEARTBEAT_FRESH_MS = 90_000;

export async function isWorkerOnline(): Promise<boolean> {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, WORKER_HEARTBEAT_KEY));
    const at = Number(row?.value);
    return Number.isFinite(at) && Date.now() - at < HEARTBEAT_FRESH_MS;
  } catch (err) {
    console.error("read worker heartbeat failed", err);
    return false;
  }
}
