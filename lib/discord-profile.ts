export type DiscordProfile = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export async function fetchDiscordProfile(id: string): Promise<DiscordProfile> {
  const fallback: DiscordProfile = { id, name: "未知使用者", avatarUrl: null };
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return fallback;

  try {
    const res = await fetch(`https://discord.com/api/v10/users/${id}`, {
      headers: { Authorization: `Bot ${token}` },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return fallback;
    const u = (await res.json()) as {
      username?: string;
      global_name?: string | null;
      avatar?: string | null;
    };
    return {
      id,
      name: u.global_name || u.username || fallback.name,
      avatarUrl: u.avatar
        ? `https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png?size=64`
        : null,
    };
  } catch {
    return fallback;
  }
}
