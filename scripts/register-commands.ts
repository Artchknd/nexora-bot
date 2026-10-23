import { config } from "dotenv";
import { commands } from "../lib/commands";

config({ path: ".env.local" });

async function main() {
  const appId = process.env.DISCORD_APP_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!appId || !token) {
    throw new Error("Missing DISCORD_APP_ID or DISCORD_BOT_TOKEN in .env.local");
  }

  const res = await fetch(
    `https://discord.com/api/v10/applications/${appId}/commands`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${token}`,
      },
      body: JSON.stringify(commands),
    },
  );

  if (!res.ok) {
    throw new Error(`Register failed: ${res.status} ${await res.text()}`);
  }

  const registered = (await res.json()) as { name: string }[];
  console.log("Registered:", registered.map((c) => c.name).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
