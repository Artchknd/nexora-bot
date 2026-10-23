import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { fetchDiscordProfile, type DiscordProfile } from "@/lib/discord-profile";

export type UserSetting = typeof userSettings.$inferSelect;

export type AdminUser = {
  profile: DiscordProfile;
  setting: UserSetting | null;
  inWhitelist: boolean;
};

export function whitelistIds(): string[] {
  const ids = (process.env.ALLOWED_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

// whitelisted users first, then anyone who still has a saved row but left the whitelist
export async function loadAdminUsers(): Promise<AdminUser[]> {
  const rows = await db.select().from(userSettings);
  const byId = new Map(rows.map((r) => [r.userId, r]));
  const whitelist = whitelistIds();
  const whitelistSet = new Set(whitelist);

  const ids = [
    ...whitelist,
    ...rows.map((r) => r.userId).filter((id) => !whitelistSet.has(id)),
  ];
  const profiles = await Promise.all(ids.map(fetchDiscordProfile));

  return profiles.map((profile) => ({
    profile,
    setting: byId.get(profile.id) ?? null,
    inWhitelist: whitelistSet.has(profile.id),
  }));
}
