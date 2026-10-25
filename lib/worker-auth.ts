import { createHash, timingSafeEqual } from "crypto";
import { rateLimited } from "./rate-limit";

const sha = (s: string) => createHash("sha256").update(s).digest();

// Returns an error Response when the request must be rejected, null when it may proceed.
export function authorizeWorker(req: Request, bucket: string): Response | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(`worker:${bucket}:${ip}`, 120, 60_000)) {
    return new Response("rate limited", { status: 429 });
  }

  const expected = process.env.WORKER_SECRET ?? "";
  if (expected.length < 32) {
    console.error("WORKER_SECRET is missing or shorter than 32 characters");
    return new Response("unauthorized", { status: 401 });
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  // hash both sides so the comparison is constant-time and length-independent
  if (!timingSafeEqual(sha(token), sha(expected))) {
    return new Response("unauthorized", { status: 401 });
  }
  return null;
}
