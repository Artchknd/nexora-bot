import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, usageLogs } from "@/lib/db/schema";

export type Totals = {
  requests: number;
  errors: number;
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  totalTokens: number;
};

export type LastCall = {
  at: Date;
  model: string;
  ok: boolean;
  httpStatus: number | null;
  kind: string | null;
  message: string | null;
  latencyMs: number | null;
};

export type ErrorCount = {
  httpStatus: number | null;
  kind: string;
  count: number;
};

export type UserUsage = {
  today: Totals;
  week: Totals;
  all: Totals;
  avgLatencyMs: number | null;
  last: LastCall | null;
  lastError: LastCall | null;
  weekErrors: ErrorCount[];
  messageCount: number;
  lastMessageAt: Date | null;
};

export const EMPTY_TOTALS: Totals = {
  requests: 0,
  errors: 0,
  promptTokens: 0,
  outputTokens: 0,
  thoughtTokens: 0,
  totalTokens: 0,
};

export const EMPTY_USAGE: UserUsage = {
  today: EMPTY_TOTALS,
  week: EMPTY_TOTALS,
  all: EMPTY_TOTALS,
  avgLatencyMs: null,
  last: null,
  lastError: null,
  weekErrors: [],
  messageCount: 0,
  lastMessageAt: null,
};

// "today" and "last 7 days" follow Taiwan time (UTC+8)
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfTodayTaipei(now: number): Date {
  return new Date(Math.floor((now + TZ_OFFSET_MS) / DAY_MS) * DAY_MS - TZ_OFFSET_MS);
}

function totalsQuery(since?: Date) {
  return db
    .select({
      userId: usageLogs.userId,
      requests: count(),
      errors: sql<number>`count(*) filter (where ${usageLogs.ok} = false)`.mapWith(Number),
      promptTokens: sql<number>`coalesce(sum(${usageLogs.promptTokens}), 0)`.mapWith(Number),
      outputTokens: sql<number>`coalesce(sum(${usageLogs.outputTokens}), 0)`.mapWith(Number),
      thoughtTokens: sql<number>`coalesce(sum(${usageLogs.thoughtTokens}), 0)`.mapWith(Number),
      totalTokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)`.mapWith(Number),
      avgLatency: sql<number | null>`avg(${usageLogs.latencyMs}) filter (where ${usageLogs.ok} = true)`.mapWith(
        (v: unknown) => (v == null ? null : Number(v)),
      ),
    })
    .from(usageLogs)
    .where(since ? gte(usageLogs.createdAt, since) : undefined)
    .groupBy(usageLogs.userId);
}

type TotalsRow = Awaited<ReturnType<typeof totalsQuery>>[number];

function toTotals(r: TotalsRow): Totals {
  return {
    requests: r.requests,
    errors: r.errors,
    promptTokens: r.promptTokens,
    outputTokens: r.outputTokens,
    thoughtTokens: r.thoughtTokens,
    totalTokens: r.totalTokens,
  };
}

function toLastCall(r: typeof usageLogs.$inferSelect): LastCall {
  return {
    at: r.createdAt,
    model: r.model,
    ok: r.ok,
    httpStatus: r.httpStatus,
    kind: r.errorKind,
    message: r.errorMessage,
    latencyMs: r.latencyMs,
  };
}

export async function loadUsage(): Promise<Map<string, UserUsage>> {
  const startToday = startOfTodayTaipei(Date.now());
  const startWeek = new Date(startToday.getTime() - 6 * DAY_MS);

  const [allRows, weekRows, todayRows, lastRows, lastErrorRows, errorRows, messageRows] =
    await Promise.all([
      totalsQuery(),
      totalsQuery(startWeek),
      totalsQuery(startToday),
      db
        .selectDistinctOn([usageLogs.userId])
        .from(usageLogs)
        .orderBy(usageLogs.userId, desc(usageLogs.id)),
      db
        .selectDistinctOn([usageLogs.userId])
        .from(usageLogs)
        .where(eq(usageLogs.ok, false))
        .orderBy(usageLogs.userId, desc(usageLogs.id)),
      db
        .select({
          userId: usageLogs.userId,
          httpStatus: usageLogs.httpStatus,
          kind: usageLogs.errorKind,
          n: count(),
        })
        .from(usageLogs)
        .where(and(eq(usageLogs.ok, false), gte(usageLogs.createdAt, startWeek)))
        .groupBy(usageLogs.userId, usageLogs.httpStatus, usageLogs.errorKind),
      db
        .select({
          userId: sql<string>`split_part(${messages.contextKey}, ':', 1)`,
          n: count(),
          lastAt: sql<Date | null>`max(${messages.createdAt})`.mapWith(messages.createdAt),
        })
        .from(messages)
        .groupBy(sql`1`),
    ]);

  const map = new Map<string, UserUsage>();
  const get = (id: string): UserUsage => {
    let u = map.get(id);
    if (!u) {
      u = { ...EMPTY_USAGE, weekErrors: [] };
      map.set(id, u);
    }
    return u;
  };

  for (const r of allRows) get(r.userId).all = toTotals(r);
  for (const r of weekRows) {
    const u = get(r.userId);
    u.week = toTotals(r);
    u.avgLatencyMs = r.avgLatency;
  }
  for (const r of todayRows) get(r.userId).today = toTotals(r);
  for (const r of lastRows) get(r.userId).last = toLastCall(r);
  for (const r of lastErrorRows) get(r.userId).lastError = toLastCall(r);
  for (const r of errorRows) {
    get(r.userId).weekErrors.push({
      httpStatus: r.httpStatus,
      kind: r.kind ?? "unknown",
      count: r.n,
    });
  }
  for (const r of messageRows) {
    const u = get(r.userId);
    u.messageCount = r.n;
    u.lastMessageAt = r.lastAt;
  }

  for (const u of map.values()) u.weekErrors.sort((a, b) => b.count - a.count);
  return map;
}
