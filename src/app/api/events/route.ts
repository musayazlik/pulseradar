import type { NextRequest } from "next/server";
import { listEventsWithStatus } from "@/core/services/event-service";
import { isLocalRequest, jsonError } from "@/core/http/guard";
import type { EventStatus } from "@/core/types/event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: EventStatus[] = ["upcoming", "ongoing", "expired", "needs_review", "rejected"];

export function GET(req: NextRequest): Response {
  if (!isLocalRequest(req)) return jsonError("yerel olmayan istek", 403);

  const params = req.nextUrl.searchParams;
  const statusParam = params.getAll("status").filter(Boolean) as EventStatus[];
  const statuses = statusParam.filter((s) => VALID_STATUSES.includes(s));

  const rows = listEventsWithStatus({
    city: params.get("city"),
    status: statuses.length > 0 ? statuses : undefined,
    upcomingOnly: params.get("upcoming") === "1",
    limit: Math.min(Number(params.get("limit") ?? 100), 500),
    offset: Math.max(Number(params.get("offset") ?? 0), 0),
  });

  return Response.json({ events: rows, count: rows.length });
}
