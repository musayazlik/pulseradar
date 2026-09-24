import type { NextRequest } from "next/server";
import { z } from "zod";
import { enqueueOpenLogin } from "@/core/services/scan-service";
import { isLocalRequest, jsonError } from "@/core/http/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  platform: z.enum(["linkedin", "x", "instagram", "tiktok"]),
});

export async function POST(req: NextRequest): Promise<Response> {
  if (!isLocalRequest(req)) return jsonError("yerel olmayan istek", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError("platform gerekli", 422);

  const run = enqueueOpenLogin(parsed.data.platform);
  return Response.json({ runId: run.id, status: run.status }, { status: 202 });
}
