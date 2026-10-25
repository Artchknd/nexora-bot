import { setWorkerHeartbeat } from "@/lib/app-settings";
import { authorizeWorker } from "@/lib/worker-auth";

export async function POST(req: Request) {
  const denied = authorizeWorker(req, "heartbeat");
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  if (body?.status !== "online" && body?.status !== "offline") {
    return new Response("bad request", { status: 400 });
  }

  await setWorkerHeartbeat(body.status === "online");
  return Response.json({ ok: true });
}
