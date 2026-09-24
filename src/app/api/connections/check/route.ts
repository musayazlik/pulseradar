import type { NextRequest } from "next/server";
import { z } from "zod";
import { enqueueSessionCheck } from "@/core/services/scan-service";
import { isLocalRequest, jsonError } from "@/core/http/guard";
import { MVP_PLATFORMS } from "@/core/types/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  platforms: z.array(z.enum(["linkedin", "x", "instagram", "tiktok"])).min(1),
});

export async function POST(req: NextRequest): Promise<Response> {
  if (!isLocalRequest(req)) return jsonError("yerel olmayan istek", 403);

  let body: unknown = { platforms: MVP_PLATFORMS };
  try {
    const parsedBody = await req.json();
    body = parsedBody;
  } catch {
    // gövde yoksa varsayılan: MVP platformları
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError("platforms gerekli", 422);

  const run = enqueueSessionCheck(parsed.data.platforms);
  return Response.json({ runId: run.id, status: run.status }, { status: 202 });
}
