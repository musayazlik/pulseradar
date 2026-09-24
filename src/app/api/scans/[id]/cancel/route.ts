import type { NextRequest } from "next/server";
import { cancelScan, getScanDetail } from "@/core/services/scan-service";
import { isLocalRequest, jsonError } from "@/core/http/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isLocalRequest(req)) return jsonError("yerel olmayan istek", 403);
  const { id } = await params;

  const detail = getScanDetail(id);
  if (!detail) return jsonError("scan not found", 404);

  // The cancel request is written to the DB; the worker checks it between steps.
  const requested = cancelScan(id);
  return Response.json({ runId: id, cancelRequested: requested });
}
