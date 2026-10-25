"use server";

import { headers } from "next/headers";
import { isAllowed } from "@/lib/discord";
import { rateLimited } from "@/lib/rate-limit";

export type WhitelistState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "limited" }
  | { status: "in" | "out"; id: string };

const LIMIT = 8;
const WINDOW_MS = 60_000;

export async function checkWhitelist(
  _prev: WhitelistState,
  formData: FormData,
): Promise<WhitelistState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(`whitelist:${ip}`, LIMIT, WINDOW_MS)) return { status: "limited" };

  const id = String(formData.get("userId") ?? "").trim();
  if (!/^\d{17,20}$/.test(id)) return { status: "invalid" };

  // same function the Discord route uses to block people, so the answers cannot drift apart
  return { status: isAllowed(id) ? "in" : "out", id };
}
