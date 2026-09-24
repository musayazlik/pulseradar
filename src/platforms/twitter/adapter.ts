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
import { X_CAPABILITIES } from "./selectors";
import { buildXSearchUrl } from "./search-builder";
import { captureDebug } from "../shared/debug";

interface ExtractedRow {
  postId: string | null;
  permalink: string | null;
  datetime: string | null;
  text: string;
  author: string | null;
  authorUrl: string | null;
  images: string[];
}

const EXTRACT_TWEETS_SNIPPET = `(() => {
  return [...document.querySelectorAll('article[data-testid="tweet"]')].map((a) => {
    const time = a.querySelector("time[datetime]");
    const link = [...a.querySelectorAll("a")].find((x) =>
      (x.getAttribute("href") || "").includes("/status/"),
    );
    const textEl = a.querySelector('div[data-testid="tweetText"], div[lang]');
    const nameBlock = a.querySelector('a[data-testid="User-Name"]');
    const href = link ? link.getAttribute("href") : null;
    const m = (href || "").match(/\\/status\\/(\\d+)/);
    const handle = nameBlock ? nameBlock.getAttribute("href") : null;
    const name = nameBlock && nameBlock.innerText ? nameBlock.innerText.split("\\n")[0].trim() : null;
    const images = [...a.querySelectorAll("img")]
      .map((i) => i.getAttribute("src") || "")
      .filter((s) => s.includes("pbs.twimg.com/media"));
    return {
      postId: m ? m[1] : null,
      permalink: href ? "https://x.com" + (href.startsWith("/") ? href : "/" + href) : null,
      datetime: time ? time.getAttribute("datetime") : null,
      text: textEl && textEl.innerText ? textEl.innerText.trim() : "",
      author: name,
      authorUrl: handle ? "https://x.com" + handle : null,
      images,
    };
  });
})()`;

async function extractTweets(page: Page): Promise<ExtractedRow[]> {
  return page.evaluate(EXTRACT_TWEETS_SNIPPET) as Promise<ExtractedRow[]>;
}

export const xScanner: PlatformScanner = {
  platform: "x",
  capabilities: X_CAPABILITIES,
  implemented: true,

  async checkSession(context: ScannerContext): Promise<SessionResult> {
    const page = context.page as Page;
    try {
      await page.goto("https://x.com/home", {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await page.waitForTimeout(3500);
      const state = await page.evaluate(() => ({
        url: location.href,
        hasTimeline:
          !!document.querySelector('[data-testid="primaryColumn"] article[data-testid="tweet"]') ||
          !!document.querySelector('[data-testid="primaryColumn"]'),
        hasLogin:
          !!document.querySelector('[data-testid="loginButton"], a[href="/login"]') ||
          location.href.includes("/login") ||
          location.href.includes("/i/flow"),
      }));
      if (state.hasLogin && !state.hasTimeline) {
        return {
          platform: "x",
          status: "login_required",
          checkedAt: nowIso(),
          detail: "No session (login wall). Sign in from the Connections screen.",
        };
      }
      if (state.hasTimeline) {
        return { platform: "x", status: "ready", checkedAt: nowIso() };
      }
      const evidence = await captureDebug(page, "x", "session-unknown");
      return {
        platform: "x",
        status: "unsupported",
        checkedAt: nowIso(),
        detail: `Timeline not found; evidence saved: ${evidence}`,
      };
    } catch (err) {
      return {
        platform: "x",
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
    const url = buildXSearchUrl({
      queries: [query],
      maxPostsPerQuery: options.maxPostsPerQuery,
      maxScrollsPerQuery: options.maxScrollsPerQuery,
      lastDays: options.lastDays,
      city: options.city,
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(3500);

    const loginWall = await page.evaluate(() => ({
      url: location.href,
      hasLogin: !!document.querySelector('[data-testid="loginButton"], a[href="/login"]'),
    }));
    if (loginWall.hasLogin || loginWall.url.includes("/login") || loginWall.url.includes("/i/flow")) {
      throw new Error(`x_session_required: ${loginWall.url}`);
    }

    const seen = new Set<string>();
    let yielded = 0;
    const safeQuery = query.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 30);

    for (let scroll = 0; scroll <= options.maxScrollsPerQuery; scroll++) {
      if (context.signal.aborted) return;

      const rows = await extractTweets(page);
      for (const row of rows) {
        const key = row.postId ?? row.permalink;
        if (!row.text || !key || seen.has(key)) continue;
        seen.add(key);
        yield {
          platformPostId: row.postId,
          canonicalUrl: row.permalink,
          text: row.text,
          publishedAt: row.datetime,
          extractedLinks: extractUrls(row.text),
          authorName: row.author,
          authorUrl: row.authorUrl,
          imageUrls: row.images,
        };
        yielded++;
        if (yielded >= options.maxPostsPerQuery) return;
      }

      if (yielded === 0 && scroll === 0) {
        await captureDebug(page, "x", `search-empty-${safeQuery}`);
      }

      await page.evaluate("window.scrollBy(0, Math.round(window.innerHeight * 2))");
      await context.limiter.wait("x-scroll");
      await page.waitForTimeout(1500);
    }
  },

  parsePost(raw: RawPost): SocialPostDraft | null {
    if (!raw.text?.trim()) return null;
    if (!raw.canonicalUrl) return null;
    return {
      platform: "x",
      platformPostId: raw.platformPostId,
      canonicalUrl: raw.canonicalUrl,
      accountName: raw.authorName ?? null,
      accountUrl: raw.authorUrl ?? null,
      publishedAt: raw.publishedAt,
      publishedAtPrecision: raw.publishedAt ? "exact" : "unknown",
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
