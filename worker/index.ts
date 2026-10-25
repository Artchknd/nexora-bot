import { Client, Events, GatewayIntentBits, cleanContent, type Message } from "discord.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const SECRET = process.env.WORKER_SECRET;
const API_BASE = (process.env.API_BASE_URL ?? "https://nexora-bot-orcin.vercel.app").replace(/\/+$/, "");

if (!TOKEN || !SECRET) {
  console.error("DISCORD_BOT_TOKEN and WORKER_SECRET must be set in .env");
  process.exit(1);
}

// Must stay above Vercel's maxDuration (60 s) so the server's own plain-language
// timeout message has time to arrive before we give up.
const WAIT_LIMIT_MS = 75_000;
const TYPING_REFRESH_MS = 8_000;
const HEARTBEAT_MS = 30_000;
const CHUNK = 1900;

type Reply = { action: "reply" | "notice" | "ignore"; text?: string };

// Message Content is a privileged intent, but Discord still sends the content of
// messages that mention the bot, so only these two intents are needed.
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

async function post(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function heartbeat(status: "online" | "offline") {
  try {
    const res = await post("/api/worker/heartbeat", { status }, 10_000);
    if (!res.ok) console.error("heartbeat rejected", res.status);
  } catch (err) {
    console.error("heartbeat failed", err instanceof Error ? err.message : err);
  }
}

function splitMessage(text: string): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > CHUNK) {
    let cut = rest.lastIndexOf("\n", CHUNK);
    if (cut < CHUNK / 2) cut = CHUNK;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

// Ask the server. Errors are phrased so the two failure sources stay distinguishable:
// "cannot reach" (network) versus "reached but it failed" (HTTP error).
async function ask(message: Message<true>): Promise<Reply> {
  const botId = client.user!.id;
  const withoutMention = message.content.replace(new RegExp(`<@!?${botId}>`, "g"), " ");
  const content = cleanContent(withoutMention, message.channel).trim();

  let res: Response;
  try {
    res = await post(
      "/api/worker/message",
      {
        guildId: message.guildId,
        channelId: message.channelId,
        messageId: message.id,
        authorId: message.author.id,
        authorName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
        content,
      },
      WAIT_LIMIT_MS,
    );
  } catch {
    return { action: "reply", text: "Nexora 這邊連不上伺服器，請稍後再試一次。（連線錯誤）" };
  }

  if (!res.ok) {
    return {
      action: "reply",
      text: `Nexora 的伺服器回應異常，這是 Nexora 自己這邊的問題，請稍後再試或通知管理員。（HTTP ${res.status}）`,
    };
  }
  try {
    return (await res.json()) as Reply;
  } catch {
    return { action: "reply", text: "Nexora 的伺服器回傳了看不懂的內容，請通知管理員。" };
  }
}

async function handle(message: Message<true>) {
  const channel = message.channel;
  const typing = async () => {
    if (channel.isSendable()) await channel.sendTyping().catch(() => {});
  };

  await typing();
  const timer = setInterval(typing, TYPING_REFRESH_MS);
  let result: Reply;
  try {
    result = await ask(message);
  } finally {
    clearInterval(timer);
  }

  if (result.action === "ignore" || !result.text?.trim()) return;

  // only the person being replied to may be pinged; no @everyone, @here or roles
  const allowedMentions = { parse: [] as never[], repliedUser: true };
  const [first, ...rest] = splitMessage(result.text.trim());
  try {
    await message.reply({ content: first, allowedMentions, failIfNotExists: false });
    for (const part of rest) {
      if (channel.isSendable()) await channel.send({ content: part, allowedMentions: { parse: [] } });
    }
  } catch (err) {
    console.error("send failed", err instanceof Error ? err.message : err);
  }
}

// messages of one channel are processed one at a time, so history is written in order
const queues = new Map<string, Promise<void>>();

function enqueue(message: Message<true>) {
  const prev = queues.get(message.channelId) ?? Promise.resolve();
  const next = prev
    .then(() => handle(message))
    .catch((err) => console.error("handle failed", err instanceof Error ? err.message : err))
    .finally(() => {
      if (queues.get(message.channelId) === next) queues.delete(message.channelId);
    });
  queues.set(message.channelId, next);
}

client.on(Events.MessageCreate, (message) => {
  if (message.author.bot || !message.inGuild()) return;
  // direct @Nexora, or a reply to Nexora with the reply ping left on
  const addressed = message.mentions.has(client.user!, { ignoreEveryone: true, ignoreRoles: true });
  if (addressed) enqueue(message);
});

let hbTimer: ReturnType<typeof setInterval> | undefined;

client.once(Events.ClientReady, async (c) => {
  console.log(`logged in as ${c.user.tag}`);
  await heartbeat("online");
  hbTimer = setInterval(() => void heartbeat("online"), HEARTBEAT_MS);
});

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: stopping`);
  clearInterval(hbTimer);
  await heartbeat("offline");
  await client.destroy();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await client.login(TOKEN);
