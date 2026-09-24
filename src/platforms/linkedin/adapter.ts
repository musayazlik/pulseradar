import { createHash } from "node:crypto";
import type { Page } from "playwright-core";
import type {
  Author,
  PlatformScanner,
  RawPost,
  ScannerContext,
  SearchOptions,
  SessionResult,
  SocialPostDraft,
} from "../../core/types/platform";
import { nowIso } from "../../core/utils/date";
import { extractUrls } from "../../core/utils/url";
import { LINKEDIN_CAPABILITIES } from "./selectors";
import { buildLinkedInSearchUrl } from "./search-builder";
import { captureDebug } from "../shared/debug";

interface ExtractedRow {
  text: string;
  author: string | null;
  authorUrl: string | null;
  dateText: string | null;
  images: string[];
  postId: string | null;
  permalink: string | null;
}

/**
 * The card's translation infrastructure embeds the post's URN id in the `id`
 * attribute: shareId=... or userGeneratedContentId=... → a real permalink can be built.
 */
export function permalinkFromCommentaryId(
  idAttr: string,
): { postId: string; permalink: string } | null {
  const share = idAttr.match(/shareId=(\d+)/);
  if (share) {
    return {
      postId: share[1],
      permalink: `https://www.linkedin.com/feed/update/urn:li:share:${share[1]}/`,
    };
  }
  const ugc = idAttr.match(/userGeneratedContentId=(\d+)/);
  if (ugc) {
    return {
      postId: ugc[1],
      permalink: `https://www.linkedin.com/feed/update/urn:li:ugcPost:${ugc[1]}/`,
    };
  }
  return null;
}

/**
 * Converts relative date text like "4 hafta •" into an approximate ISO time.
 * LinkedIn search DOM has no <time> element; precision is days.
 */
function relativeToIso(rawText: string | null): string | null {
  if (!rawText) return null;
  const text = rawText.toLowerCase();
  const now = Date.now();
  const m = text.match(/(\d+)\s*(saniye|dakika|saat|gün|hafta|ay|yıl)/);
  if (m) {
    const n = Number(m[1]);
    const mult: Record<string, number> = {
      saniye: 1000,
      dakika: 60_000,
      saat: 3_600_000,
      gün: 86_400_000,
      hafta: 604_800_000,
      ay: 2_592_000_000,
      yıl: 31_536_000_000,
    };
    return new Date(now - n * (mult[m[2]] ?? 86_400_000)).toISOString();
  }
  if (/şimdi|now/.test(text)) return new Date(now).toISOString();
  return null;
}

/**
 * The new LinkedIn UI uses hashed CSS classes; result cards are found by the
 * "Faaliyet akışı gönderisi" title (= feed post, Turkish UI). The post permalink is not
 * in the DOM; the source URL is produced from the author profile + text as a stable URN.
 *
 * The body is passed as a string so tsx/esbuild transpilation does not
 * leak into evaluate.
 */
const EXTRACT_POSTS_SNIPPET = `(() => {
  const headings = [...document.querySelectorAll("h2 span")].filter((s) =>
    (s.textContent || "").includes("Faaliyet akışı gönderisi"),
  );
  const out = [];
  for (const heading of headings) {
    let card = heading.parentElement;
    let authorLink = null;
    for (let depth = 0; card && depth < 6; depth++) {
      authorLink = [...card.querySelectorAll("a")].find((a) =>
        /linkedin\\.com\\/(in|company|school)\\//.test(a.href),
      );
      if (authorLink && card.innerText.length > heading.textContent.length + 40) break;
      card = card.parentElement;
    }
    if (!card) continue;
    const fullText = (card.innerText || "").trim();
    if (!fullText) continue;
    const author = authorLink
      ? (authorLink.getAttribute("aria-label") || authorLink.innerText || "").trim()
      : null;
    const authorUrl = authorLink ? authorLink.href : null;
    const dateLine = fullText
      .split("\\n")
      .find((l) => /\\b\\d+\\s*(saniye|dakika|saat|gün|hafta|ay|yıl)\\b/i.test(l) || /\\bşimdi\\b/i.test(l));
    const text = fullText
      .split("\\n")
      .filter((l) => l.trim() !== "Faaliyet akışı gönderisi")
      .join("\\n")
      .trim();
    // Poster candidates: media images other than avatar/logo small variants.
    // Note: today's list view has no post posters in the DOM; if the DOM changes,
    // the OCR pipeline will feed automatically.
    const images = [...card.querySelectorAll("img")]
      .map((i) => i.getAttribute("src") || "")
      .filter((s) => s.includes("media.licdn.com") && !/shrink_\\d+_\\d+|company-logo/.test(s));
    // Real permalink: the share/ugc id embedded in the translation infrastructure id.
    const commentary = card.querySelector('[id^="translatable-commentary-"]');
    const idAttr = commentary ? commentary.getAttribute("id") || "" : "";
    const shareMatch = idAttr.match(/shareId=(\\d+)/);
    const ugcMatch = idAttr.match(/userGeneratedContentId=(\\d+)/);
    const postId = shareMatch ? shareMatch[1] : ugcMatch ? ugcMatch[1] : null;
    const urn = shareMatch
      ? "urn:li:share:" + shareMatch[1]
      : ugcMatch
        ? "urn:li:ugcPost:" + ugcMatch[1]
        : null;
    const permalink = urn ? "https://www.linkedin.com/feed/update/" + urn + "/" : null;
    out.push({
      text,
      author,
      authorUrl,
      dateText: dateLine ? dateLine.trim() : null,
      images,
      postId,
      permalink,
    });
  }
  return out;
})()`;

async function extractPosts(page: Page): Promise<ExtractedRow[]> {
  return page.evaluate(EXTRACT_POSTS_SNIPPET) as Promise<ExtractedRow[]>;
}

/** Stable synthetic source URL built from author + text (no permalink in the DOM). */
function syntheticPermalink(authorUrl: string | null, text: string): string {
  const key = `${authorUrl ?? ""}|${text.slice(0, 140).toLowerCase()}`;
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return `https://www.linkedin.com/search/results/content/#lrn_${hash}`;
}

export const linkedinScanner: PlatformScanner = {
  platform: "linkedin",
  capabilities: LINKEDIN_CAPABILITIES,
  implemented: true,

  async checkSession(context: ScannerContext): Promise<SessionResult> {
    const page = context.page as Page;
    try {
      await page.goto("https://www.linkedin.com/feed/", {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await page.waitForTimeout(4000);
      const state = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        hasLogin:
          location.href.includes("/login") ||
          location.href.includes("authwall") ||
          !!document.querySelector("form#login, .authwall-join-form"),
      }));
      if (state.url.includes("/checkpoint/")) {
        return {
          platform: "linkedin",
          status: "challenge",
          checkedAt: nowIso(),
          detail: "LinkedIn redirected to a verification (checkpoint) page.",
        };
      }
      if (state.hasLogin) {
        return {
          platform: "linkedin",
          status: "login_required",
          checkedAt: nowIso(),
          detail: `No session (${state.url}). Sign in from the Connections screen.`,
        };
      }
      if (/feed|faaliyet/i.test(state.title) && state.url.includes("/feed/")) {
        return { platform: "linkedin", status: "ready", checkedAt: nowIso() };
      }
      const evidence = await captureDebug(page, "linkedin", "session-unknown");
      return {
        platform: "linkedin",
        status: "unsupported",
        checkedAt: nowIso(),
        detail: `Feed could not be verified; evidence saved: ${evidence}`,
      };
    } catch (err) {
      return {
        platform: "linkedin",
        status: "error",
        checkedAt: nowIso(),
        detail: (err as Error).message,
      };
    }
  },

  async *search(
    options: SearchOptions,
    context: ScannerContext,
  ): AsyncIterable<RawPost> {
    const page = context.page as Page;
    const query = options.queries[0] ?? "";
    const url = buildLinkedInSearchUrl({
      queries: [query],
      maxPostsPerQuery: options.maxPostsPerQuery,
      maxScrollsPerQuery: options.maxScrollsPerQuery,
      lastDays: options.lastDays,
      city: options.city,
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(5000);
    if (/authwall|\/login|\/checkpoint/.test(page.url())) {
      throw new Error(`linkedin_session_required: ${page.url()}`);
    }

    const seen = new Set<string>();
    let yielded = 0;
    const safeQuery = query.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 30);

    for (let scroll = 0; scroll <= options.maxScrollsPerQuery; scroll++) {
      if (context.signal.aborted) return;

      const rows = await extractPosts(page);
      for (const row of rows) {
        // Priority for the same post: the real postId; otherwise the text fingerprint.
        const key = row.postId ?? `txt:${row.text.slice(0, 140).toLowerCase()}`;
        if (!row.text || seen.has(key)) continue;
        seen.add(key);
        yield {
          platformPostId: row.postId,
          canonicalUrl:
            row.permalink ?? syntheticPermalink(row.authorUrl, row.text),
          text: row.text,
          publishedAt: relativeToIso(row.dateText),
          extractedLinks: extractUrls(row.text),
          authorName: row.author,
          authorUrl: row.authorUrl,
          imageUrls: row.images,
        };
        yielded++;
        if (yielded >= options.maxPostsPerQuery) return;
      }

      // If the first round has no results, save the DOM evidence (to tell "no
      // results" and "DOM changed" apart).
      if (yielded === 0 && scroll === 0) {
        await captureDebug(page, "linkedin", `search-empty-${safeQuery}`);
      }

      await page.evaluate("window.scrollBy(0, Math.round(window.innerHeight * 2))");
      await context.limiter.wait("linkedin-scroll");
      await page.waitForTimeout(2000);
    }
  },

  parsePost(raw: RawPost): SocialPostDraft | null {
    if (!raw.text?.trim()) return null;
    if (!raw.canonicalUrl) return null;
    return {
      platform: "linkedin",
      platformPostId: raw.platformPostId,
      canonicalUrl: raw.canonicalUrl,
      accountName: raw.authorName ?? null,
      accountUrl: raw.authorUrl ?? null,
      publishedAt: raw.publishedAt,
      publishedAtPrecision: raw.publishedAt ? "day" : "unknown",
      rawText: raw.text,
      extractedLinks: raw.extractedLinks,
    };
  },

  getPostUrl(raw: RawPost): string | null {
    return raw.canonicalUrl;
  },

  getAuthor(raw: RawPost): Author | null {
    if (!raw.authorName && !raw.authorUrl) return null;
    return { name: raw.authorName ?? "", url: raw.authorUrl ?? null };
  },
};
