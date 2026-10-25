import { after } from "next/server";
import { InteractionResponseType, InteractionType } from "discord-interactions";
import { eq } from "drizzle-orm";
import { chat, contextKey } from "@/lib/chat";
import { MESSAGE_COMMAND_NAME } from "@/lib/commands";
import { classifyError, userFacingMessage } from "@/lib/errors";
import { db } from "@/lib/db";
import { messages, userSettings } from "@/lib/db/schema";
import {
  EPHEMERAL,
  displayName,
  getBooleanOption,
  getOption,
  isAllowed,
  sendResult,
  verifyRequest,
  type CommandOption,
  type Interaction,
} from "@/lib/discord";
import { DEFAULT_MODEL, listChatModels } from "@/lib/gemini";

export const maxDuration = 60;

const QUOTE_MAX = 150;

// "> question" line placed above the answer, so the channel shows what was asked
function quoteBlock(question: string): string {
  const flat = question.replace(/\s+/g, " ").replace(/`/g, "'").trim();
  const shown = flat.length > QUOTE_MAX ? `${flat.slice(0, QUOTE_MAX)}...` : flat;
  return `> ${shown}`;
}

interface Handler {
  ephemeral: boolean;
  run: () => Promise<string>;
}

async function upsertSetting(
  userId: string,
  patch: { style?: string | null; model?: string | null },
) {
  await db
    .insert(userSettings)
    .values({ userId, ...patch })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { ...patch, updatedAt: new Date() },
    });
}

function findFocused(options?: CommandOption[]): CommandOption | undefined {
  for (const o of options ?? []) {
    if (o.focused) return o;
    const nested = findFocused(o.options);
    if (nested) return nested;
  }
  return undefined;
}

async function autocompleteResponse(i: Interaction) {
  const focused = findFocused(i.data?.options);
  const query = String(focused?.value ?? "").toLowerCase();
  let choices: { name: string; value: string }[] = [];

  if (focused?.name === "model") {
    try {
      const ids = await listChatModels();
      choices = ids
        .filter((id) => id.includes(query))
        .slice(0, 25)
        .map((id) => ({ name: id, value: id }));
    } catch (err) {
      console.error("list models failed", err);
    }
  }

  return Response.json({
    type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
    data: { choices },
  });
}

function resolveHandler(i: Interaction, userId: string): Handler | null {
  const data = i.data;
  if (!data) return null;
  const channelId = i.channel_id;
  const userName = displayName(i);

  // 訊息右鍵 / 長按選單：Apps -> Ask Nexora
  if (data.type === 3 && data.name === MESSAGE_COMMAND_NAME) {
    const target = data.target_id
      ? data.resolved?.messages?.[data.target_id]
      : undefined;
    const text = target?.content?.trim();
    return {
      ephemeral: false,
      run: async () =>
        text
          ? chat({
              userId,
              userName,
              channelId,
              prompt: `請回應或說明下面這則訊息：\n\n${text}`,
            })
          : "這則訊息沒有可讀取的文字內容。",
    };
  }

  switch (data.name) {
    case "ask": {
      const question = getOption(data.options, "question");
      if (!question) return null;
      const styleOverride = getOption(data.options, "style");
      const modelOverride = getOption(data.options, "model");
      const search = getBooleanOption(data.options, "search");
      return {
        ephemeral: false,
        run: async () =>
          `${quoteBlock(question)}\n\n${await chat({
            userId,
            userName,
            channelId,
            prompt: question,
            styleOverride,
            modelOverride,
            search,
          })}`,
      };
    }

    case "model": {
      const sub = data.options?.[0];
      if (sub?.name === "set") {
        const model = getOption(sub.options, "model");
        if (!model) return null;
        return {
          ephemeral: true,
          run: async () => {
            const ids = await listChatModels();
            if (!ids.includes(model)) {
              return `找不到模型 ${model}，請從選單裡挑選。`;
            }
            await upsertSetting(userId, { model });
            return `預設模型已設定為：${model}`;
          },
        };
      }
      if (sub?.name === "show") {
        return {
          ephemeral: true,
          run: async () => {
            const [setting] = await db
              .select()
              .from(userSettings)
              .where(eq(userSettings.userId, userId));
            return setting?.model
              ? `目前使用的模型：${setting.model}`
              : `目前使用系統預設模型：${DEFAULT_MODEL}`;
          },
        };
      }
      if (sub?.name === "clear") {
        return {
          ephemeral: true,
          run: async () => {
            await upsertSetting(userId, { model: null });
            return `已改回系統預設模型：${DEFAULT_MODEL}`;
          },
        };
      }
      return null;
    }

    case "reset":
      return {
        ephemeral: true,
        run: async () => {
          await db
            .delete(messages)
            .where(eq(messages.contextKey, contextKey(channelId, userId)));
          return "已清除這個頻道的對話記憶（這個頻道所有人共用的那一份）。";
        },
      };

    case "style": {
      const sub = data.options?.[0];
      if (sub?.name === "set") {
        const style = getOption(sub.options, "text");
        if (!style) return null;
        return {
          ephemeral: true,
          run: async () => {
            await upsertSetting(userId, { style });
            return `預設回答風格已設定為：${style}`;
          },
        };
      }
      if (sub?.name === "clear") {
        return {
          ephemeral: true,
          run: async () => {
            await upsertSetting(userId, { style: null });
            return "已清除預設回答風格。";
          },
        };
      }
      return null;
    }

    default:
      return null;
  }
}

export async function POST(req: Request) {
  const { ok, body } = await verifyRequest(req);
  if (!ok) return new Response("invalid request signature", { status: 401 });

  const interaction = JSON.parse(body) as Interaction;

  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG });
  }

  const userId = interaction.member?.user.id ?? interaction.user?.id;
  const allowed = !!userId && isAllowed(userId);

  if (interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
    if (!allowed) {
      return Response.json({
        type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
        data: { choices: [] },
      });
    }
    return autocompleteResponse(interaction);
  }

  if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
    return new Response("unsupported interaction", { status: 400 });
  }

  if (!allowed || !userId) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "你不在使用名單內。", flags: EPHEMERAL },
    });
  }

  const handler = resolveHandler(interaction, userId);
  if (!handler) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "無法辨識這個指令。", flags: EPHEMERAL },
    });
  }

  // Discord 要求 3 秒內回應：先回 deferred，實際工作丟到回應之後執行
  after(async () => {
    let text: string;
    try {
      text = await handler.run();
    } catch (err) {
      console.error("handler failed", err);
      text = userFacingMessage(classifyError(err));
    }
    await sendResult(
      interaction.application_id,
      interaction.token,
      text,
      handler.ephemeral,
    );
  });

  return Response.json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: handler.ephemeral ? { flags: EPHEMERAL } : undefined,
  });
}
