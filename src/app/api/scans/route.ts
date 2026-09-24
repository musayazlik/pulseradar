import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  createScanRun,
  listScanHistory,
  ScanValidationError,
} from "@/core/services/scan-service";
import { isLocalRequest, jsonError } from "@/core/http/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  platforms: z.array(z.enum(["linkedin", "x", "instagram", "tiktok"])).min(1),
  city: z.string().trim().min(1).nullable().optional(),
  keywords: z.array(z.string().trim().min(1)).optional(),
  hashtags: z.array(z.string().trim().min(1)).optional(),
  lastDays: z.number().int().min(1).max(365).nullable().optional(),
  includeOnline: z.boolean().optional(),
});

export function GET(req: NextRequest): Response {
  if (!isLocalRequest(req)) return jsonError("yerel olmayan istek", 403);
  return Response.json({ runs: listScanHistory() });
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!isLocalRequest(req)) return jsonError("yerel olmayan istek", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid JSON", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      422,
    );
  }

  try {
    const detail = createScanRun(parsed.data);
    // Job persisted to the DB; the worker picks up the next job.
    return Response.json(
      { runId: detail.id, status: detail.status },
      { status: 202 },
    );
  } catch (err) {
    if (err instanceof ScanValidationError) return jsonError(err.message, 422);
    return jsonError((err as Error).message, 500);
  }
}
