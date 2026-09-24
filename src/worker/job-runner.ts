import type { Page } from "playwright-core";
import type { Platform } from "../core/types/platform";
import type { ScanRunDetail, ScanRunStatus } from "../core/types/scan";
import { getAdapter } from "../platforms/registry";
import { openOwnedSession } from "../browser/browser-manager";
import {
  finishRun,
  isCancelRequested,
  listTasks,
  mergeRunCounters,
  updateTask,
} from "../database/repositories/scans";
import { ingestPost } from "../core/services/event-service";
import { loadConfig } from "../core/config/loader";
import { ocrImages, mergeOcrIntoText } from "../core/parsers/ocr";
import { extractUrls } from "../core/utils/url";
import { recordSessionCheck } from "../database/repositories/sessions";
import { openLoginScreen } from "../browser/session-check";
import { createRateLimiter } from "./rate-limiter";
import { nowIso } from "../core/utils/date";
import { isPlatform } from "../core/types/platform";
import type { RawPost } from "../core/types/platform";

export interface JobRunResult {
  status: ScanRunStatus;
  stopReason: string | null;
}

const TERMINAL_STATUSES: ScanRunStatus[] = [
  "completed",
  "partial",
  "failed",
  "cancelled",
  "interrupted",
];

/** Bir işi baştan sona yürütür; platform hatası kalan görevleri durdurmaz. */
export async function runJob(run: ScanRunDetail): Promise<JobRunResult> {
  switch (run.kind) {
    case "session_check":
      return runSessionCheck(run);
    case "open_login":
      return runOpenLogin(run);
    case "scan":
      return runScan(run);
  }
}

async function runSessionCheck(run: ScanRunDetail): Promise<JobRunResult> {
  const platforms = ((run.configSnapshot as { platforms?: string[] })?.platforms ??
    []) as Platform[];

  let session: Awaited<ReturnType<typeof openOwnedSession>> | null = null;
  try {
    session = await openOwnedSession();
  } catch (err) {
    finishRun(run.id, "failed", `browser_unavailable: ${(err as Error).message}`);
    return { status: "failed", stopReason: "browser_unavailable" };
  }

  try {
    const page = session.context.pages()[0] ?? (await session.context.newPage());
    const limiter = createRateLimiter(4000, 8000);
    for (const platform of platforms) {
      if (!isPlatform(platform)) continue;
      const adapter = getAdapter(platform);
      if (!adapter) {
        recordSessionCheck({
          platform,
          status: "unsupported",
          detail: "Adapter kayıtlı değil.",
        });
        continue;
      }
      try {
        const result = await adapter.checkSession({
          page,
          limiter,
          logger: console,
          signal: new AbortController().signal,
        });
        recordSessionCheck({
          platform,
          status: result.status,
          detail: result.detail,
        });
      } catch (err) {
        recordSessionCheck({
          platform,
          status: "error",
          detail: (err as Error).message,
        });
      }
      await limiter.wait("between-platforms");
    }
  } finally {
    await session.close().catch(() => {});
  }
  finishRun(run.id, "completed", null);
  return { status: "completed", stopReason: null };
}

async function runOpenLogin(run: ScanRunDetail): Promise<JobRunResult> {
  const platform = (run.configSnapshot as { platform?: string })?.platform;
  if (!platform || !isPlatform(platform)) {
    finishRun(run.id, "failed", "missing_platform");
    return { status: "failed", stopReason: "missing_platform" };
  }
  // Giriş penceresi açılır ve kullanıcı girişi yapana kadar beklenir
  // (en fazla 5 dk); profil kapanırken saklanır.
  const result = await openLoginScreen(platform, { timeoutMs: 5 * 60_000 });
  const status: ScanRunStatus =
    result.status === "logged_in" ? "completed" : result.status === "timeout" ? "partial" : "failed";
  finishRun(run.id, status, result.detail ?? null);
  return { status, stopReason: result.detail ?? null };
}

async function runScan(run: ScanRunDetail): Promise<JobRunResult> {
  const config = loadConfig();
  const snapshot = (run.configSnapshot ?? {}) as {
    filters?: { lastDays?: number; city?: string | null };
  };
  const lastDays = snapshot.filters?.lastDays ?? config.filters.lastDays;
  const city = snapshot.filters?.city ?? null;

  const budgetMs = config.limits.maxRunMinutes * 60 * 1000;
  const deadline = Date.now() + budgetMs;
  const limiter = createRateLimiter(config.limits.minDelayMs, config.limits.maxDelayMs);

  // Paylaşım tarihi cutoff'u: lastDays paylaşım tarihine uygulanır.
  const publishedCutoff = lastDays ? Date.now() - lastDays * 24 * 3600 * 1000 : null;

  let session: Awaited<ReturnType<typeof openOwnedSession>> | null = null;
  try {
    session = await openOwnedSession();
  } catch (err) {
    finishRun(run.id, "failed", `browser_unavailable: ${(err as Error).message}`);
    return { status: "failed", stopReason: "browser_unavailable" };
  }

  let platformFailures = 0;
  let limitReached = false;
  let runPosts = 0;
  const platformPosts = new Map<string, number>();

  try {
    const page: Page = session.context.pages()[0] ?? (await session.context.newPage());

    for (const task of listTasks(run.id).filter((t) => t.status === "queued")) {
      if (isCancelRequested(run.id)) {
        updateTask(task.id, { status: "cancelled", finishedAt: nowIso() });
        continue;
      }
      if (Date.now() > deadline) {
        updateTask(task.id, { status: "skipped", reasonCode: "run_budget_exhausted" });
        limitReached = true;
        continue;
      }
      if (runPosts >= config.limits.maxPostsPerRun) {
        updateTask(task.id, { status: "skipped", reasonCode: "run_post_cap" });
        limitReached = true;
        continue;
      }
      if ((platformPosts.get(task.platform) ?? 0) >= config.limits.maxPostsPerPlatform) {
        updateTask(task.id, { status: "skipped", reasonCode: "platform_post_cap" });
        continue;
      }

      updateTask(task.id, { status: "running", startedAt: nowIso() });

      const adapter = getAdapter(task.platform);
      if (!adapter || !adapter.implemented) {
        updateTask(task.id, {
          status: "skipped",
          reasonCode: "not_implemented",
          finishedAt: nowIso(),
        });
        continue;
      }

      try {
        let posts = 0;
        for await (const raw of adapter.search(
          {
            queries: [task.query],
            maxPostsPerQuery: config.limits.maxPostsPerQuery,
            maxScrollsPerQuery: config.limits.maxScrollsPerQuery,
            maxPostsPerPlatform: config.limits.maxPostsPerPlatform,
            lastDays,
            city,
          },
          { page, limiter, logger: console, signal: new AbortController().signal },
        )) {
          if (isCancelRequested(run.id)) break;

          // OCR hattı: afiş adayı görseller varsa metni görselden zenginleştir.
          let processed: RawPost = raw;
          if (config.ocr.enabled && raw.imageUrls && raw.imageUrls.length > 0) {
            if (isCancelRequested(run.id)) break;
            try {
              const ocrText = await ocrImages(raw.imageUrls, {
                maxImages: config.ocr.maxImagesPerPost,
                minBytes: config.ocr.minImageBytes,
              });
              if (ocrText) {
                processed = {
                  ...raw,
                  text: mergeOcrIntoText(raw.text, ocrText),
                  extractedLinks: [
                    ...raw.extractedLinks,
                    ...extractUrls(ocrText),
                  ],
                };
                console.log(
                  `OCR: ${task.platform} gönderisine ${ocrText.length} karakter görsel metni eklendi`,
                );
              }
            } catch (err) {
              // OCR hatası gönderi kaydını engellemez.
              console.warn(`OCR atlandı: ${(err as Error).message.slice(0, 120)}`);
            }
          }

          const draft = adapter.parsePost(processed);
          if (!draft) continue;

          // Katı son-X-gün: bilinen eski paylaşım kayıtlara girmez, ayrıca sayılır.
          if (publishedCutoff && draft.publishedAt) {
            const t = Date.parse(draft.publishedAt);
            if (!Number.isNaN(t) && t < publishedCutoff) {
              mergeRunCounters(run.id, { filteredByDate: 1 });
              continue;
            }
          }

          const result = ingestPost(draft, {
            defaultTimeZone: config.defaultTimeZone,
            lastDays,
            taskId: task.id,
          });
          posts++;
          runPosts++;
          platformPosts.set(task.platform, (platformPosts.get(task.platform) ?? 0) + 1);
          mergeRunCounters(run.id, {
            uniquePostsScanned: 1,
            postsReseen: result.outcome === "reseen" ? 1 : 0,
            eventCandidates:
              result.outcome === "created" || result.outcome === "review" ? 1 : 0,
            eventsCreated: result.outcome === "created" ? 1 : 0,
            candidatesMerged: result.outcome === "merged" ? 1 : 0,
            reviewItems: result.outcome === "review" ? 1 : 0,
          });
          if (posts >= config.limits.maxPostsPerQuery) break;
          if ((platformPosts.get(task.platform) ?? 0) >= config.limits.maxPostsPerPlatform) break;
          await limiter.wait("between-posts");
        }
        updateTask(task.id, {
          status: "completed",
          postsScanned: posts,
          finishedAt: nowIso(),
        });
      } catch (err) {
        platformFailures++;
        updateTask(task.id, {
          status: "failed",
          lastError: (err as Error).message.slice(0, 500),
          finishedAt: nowIso(),
        });
        mergeRunCounters(run.id, { platformErrors: 1 });
      }
    }
  } finally {
    await session.close().catch(() => {});
  }

  let status: ScanRunStatus;
  let stopReason: string | null = null;
  if (isCancelRequested(run.id)) {
    status = "cancelled";
  } else if (platformFailures > 0) {
    status = "partial";
  } else {
    status = "completed";
  }
  if (limitReached) stopReason = "limit_reached";

  finishRun(run.id, status, stopReason);
  return { status, stopReason };
}

export { TERMINAL_STATUSES };
