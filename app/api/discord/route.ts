import { after } from "next/server";
import { InteractionResponseType, InteractionType } from "discord-interactions";
import { eq } from "drizzle-orm";
import { chat, contextKey } from "@/lib/chat";
import { MESSAGE_COMMAND_NAME } from "@/lib/commands";
import { db } from "@/lib/db";
import { messages, userSettings } from "@/lib/db/schema";
import {
  EPHEMERAL,
  getOption,
  isAllowed,
  sendResult,
  verifyRequest,
  type Interaction,
} from "@/lib/discord";

export const maxDuration = 60;

interface Handler {
  ephemeral: boolean;
  run: () => Promise<string>;
}

function resolveHandler(i: Interaction, userId: string): Handler | null {
  const data = i.data;
  if (!data) return null;
  const channelId = i.channel_id ?? "dm";

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
      return {
        ephemeral: false,
        run: () => chat({ userId, channelId, prompt: question, styleOverride }),
      };
    }

    case "reset":
      return {
        ephemeral: true,
        run: async () => {
          await db
            .delete(messages)
            .where(eq(messages.contextKey, contextKey(userId, channelId)));
          return "已清除這個頻道的對話記憶。";
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
            await db
              .insert(userSettings)
              .values({ userId, style })
              .onConflictDoUpdate({
                target: userSettings.userId,
                set: { style, updatedAt: new Date() },
              });
            return `預設回答風格已設定為：${style}`;
          },
        };
      }
      if (sub?.name === "clear") {
        return {
          ephemeral: true,
          run: async () => {
            await db.delete(userSettings).where(eq(userSettings.userId, userId));
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

  if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
    return new Response("unsupported interaction", { status: 400 });
  }

  const userId = interaction.member?.user.id ?? interaction.user?.id;
  if (!userId || !isAllowed(userId)) {
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
      text = "處理時發生錯誤，請稍後再試。";
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
