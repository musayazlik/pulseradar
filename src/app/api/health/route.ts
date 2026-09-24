import type { NextRequest } from "next/server";
import { collectHealth } from "@/core/services/health-service";
import { isLocalRequest, jsonError } from "@/core/http/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest): Response {
  if (!isLocalRequest(req)) return jsonError("yerel olmayan istek", 403);
  const report = collectHealth();
  const ok = report.database.ok && report.config.ok;
  return Response.json(report, { status: ok ? 200 : 503 });
}
