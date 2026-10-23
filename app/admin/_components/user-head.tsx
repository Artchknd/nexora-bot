import type { DiscordProfile } from "@/lib/discord-profile";

export function UserHead({ profile }: { profile: DiscordProfile }) {
  return (
    <div className="user-head">
      {profile.avatarUrl && (
        // plain img on purpose: avoids whitelisting the Discord CDN in next.config
        // eslint-disable-next-line @next/next/no-img-element
        <img className="avatar" src={profile.avatarUrl} alt="" width={42} height={42} />
      )}
      <div className="user-meta">
        <div className="user-name">{profile.name}</div>
        <div className="user-id">{profile.id}</div>
      </div>
    </div>
  );
}
