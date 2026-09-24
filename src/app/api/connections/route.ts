import type { NextRequest } from "next/server";
import { latestSessionChecks } from "@/database/repositories/sessions";
import { isLocalRequest, jsonError } from "@/core/http/guard";
import { PLATFORMS } from "@/core/types/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest): Response {
  if (!isLocalRequest(req)) return jsonError("yerel olmayan istek", 403);

  const checks = latestSessionChecks();
  const connections = PLATFORMS.map((platform) => {
    const latest = checks.find((c) => c.platform === platform);
    return {
      platform,
      status: latest?.status ?? "unknown",
      detail: latest?.detail ?? null,
      checkedAt: latest?.checkedAt ?? null,
    };
  });

  return Response.json({ connections });
}
