import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  applyEventPatch,
  getEventDetail,
  rejectEvent,
} from "@/core/services/event-service";
import { isLocalRequest, jsonError } from "@/core/http/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const timeOnly = /^\d{2}:\d{2}$/;

const patchSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  startDate: z.string().regex(dateOnly).nullable().optional(),
  endDate: z.string().regex(dateOnly).nullable().optional(),
  startTime: z.string().regex(timeOnly).nullable().optional(),
  endTime: z.string().regex(timeOnly).nullable().optional(),
  venue: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  organizer: z.string().nullable().optional(),
  registrationUrl: z.string().url().nullable().optional(),
  status: z.enum(["upcoming", "needs_review", "rejected"]).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isLocalRequest(req)) return jsonError("yerel olmayan istek", 403);
  const { id } = await params;
  const event = getEventDetail(id);
  if (!event) return jsonError("event not found", 404);
  return Response.json(event);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isLocalRequest(req)) return jsonError("yerel olmayan istek", 403);
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid JSON", 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 422);
  }

  if (parsed.data.status === "rejected") {
    const rejected = rejectEvent(id);
    if (!rejected) return jsonError("event not found", 404);
    return Response.json(rejected);
  }

  const updated = applyEventPatch(id, parsed.data);
  if (!updated) return jsonError("event not found", 404);
  return Response.json(updated);
}
