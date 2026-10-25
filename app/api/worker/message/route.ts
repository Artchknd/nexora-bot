import { chat } from "@/lib/chat";
import { isAllowed } from "@/lib/discord";
import { classifyError, userFacingMessage } from "@/lib/errors";
import { NON_WHITELIST_NOTICE, recordNonWhitelist } from "@/lib/non-whitelist";
import { authorizeWorker } from "@/lib/worker-auth";

// Gemini timeout (35/50 s) < maxDuration < the worker's own wait limit (75 s)
export const maxDuration = 60;

const ID = /^\d{17,20}$/;
const MAX_CONTENT = 4000;

type Body = {
  guildId?: unknown;
  channelId?: unknown;
  messageId?: unknown;
  authorId?: unknown;
  authorName?: unknown;
  content?: unknown;
};

export async function POST(req: Request) {
  const denied = authorizeWorker(req, "message");
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as Body | null;
  const { channelId, authorId, authorName, content } = body ?? {};
  if (
    typeof channelId !== "string" ||
    !ID.test(channelId) ||
    typeof authorId !== "string" ||
    !ID.test(authorId) ||
    typeof authorName !== "string" ||
    typeof content !== "string" ||
    content.length > MAX_CONTENT
  ) {
    return new Response("bad request", { status: 400 });
  }

  // the only whitelist check, same function the slash commands use
  if (!isAllowed(authorId)) {
    try {
      const { notify } = await recordNonWhitelist(authorId);
      return Response.json(
        notify ? { action: "notice", text: NON_WHITELIST_NOTICE } : { action: "ignore" },
      );
    } catch (err) {
      console.error("record non-whitelist failed", err);
      return Response.json({ action: "ignore" });
    }
  }

  const prompt = content.trim();
  if (!prompt) {
    return Response.json({ action: "reply", text: "請在 @ 後面寫下你的問題。" });
  }

  // search is on only when the message starts with this word; the text is sent unchanged
  const search = prompt.startsWith("搜尋");

  try {
    const text = await chat({
      userId: authorId,
      userName: authorName.slice(0, 80),
      channelId,
      prompt,
      search,
    });
    return Response.json({ action: "reply", text });
  } catch (err) {
    console.error("worker chat failed", err);
    return Response.json({ action: "reply", text: userFacingMessage(classifyError(err)) });
  }
}
