import type { NextRequest } from "next/server";
import { loadConfig, saveConfig, ConfigError } from "@/core/config/loader";
import { isLocalRequest, jsonError } from "@/core/http/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest): Response {
  if (!isLocalRequest(req)) return jsonError("yerel olmayan istek", 403);
  try {
    return Response.json(loadConfig());
  } catch (err) {
    return jsonError((err as Error).message, 500);
  }
}

export async function PUT(req: NextRequest): Promise<Response> {
  if (!isLocalRequest(req)) return jsonError("yerel olmayan istek", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid JSON", 400);
  }

  try {
    const saved = saveConfig(body);
    return Response.json(saved);
  } catch (err) {
    if (err instanceof ConfigError) return jsonError(err.message, 422);
    return jsonError((err as Error).message, 500);
  }
}
