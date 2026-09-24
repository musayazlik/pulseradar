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
}

/**
 * "4 hafta •" gibi göreli tarih metnini yaklaşık ISO zamanına çevirir.
 * LinkedIn arama DOM'unda <time> öğesi yok; hassasiyet gündür.
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
 * Yeni LinkedIn arayüzü hash'li CSS sınıfları kullanır; sonuç kartları
 * "Faaliyet akışı gönderisi" başlığıyla bulunur. Post permalink'i DOM'da
 * yer almaz; kaynak URL'i yazar profili + metinden kararlı URN ile üretilir.
 *
 * Gövde string olarak verilir: tsx/esbuild transpilasyonu evaluate içine
 * sızmasın diye.
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
    // Afiş adayları: avatar/logo küçük varyantları dışındaki medya görselleri.
    // Not: bugünkü liste görünümünde post afişleri DOM'da yok; DOM değişirse
    // OCR hattı otomatik beslenir.
    const images = [...card.querySelectorAll("img")]
      .map((i) => i.getAttribute("src") || "")
      .filter((s) => s.includes("media.licdn.com") && !/shrink_\\d+_\\d+|company-logo/.test(s));
    out.push({ text, author, authorUrl, dateText: dateLine ? dateLine.trim() : null, images });
  }
  return out;
})()`;

async function extractPosts(page: Page): Promise<ExtractedRow[]> {
  return page.evaluate(EXTRACT_POSTS_SNIPPET) as Promise<ExtractedRow[]>;
}

/** Yazar + metinden kararlı sentetik kaynak URL'i (permalink DOM'da yok). */
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
          detail: "LinkedIn doğrulama (checkpoint) sayfasına yönlendirdi.",
        };
      }
      if (state.hasLogin) {
        return {
          platform: "linkedin",
          status: "login_required",
          checkedAt: nowIso(),
          detail: `Oturum yok (${state.url}). Bağlantılar ekranından giriş yapın.`,
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
        detail: `Feed doğrulanamadı; kanıt kaydedildi: ${evidence}`,
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
      maxPostsPerPlatform: options.maxPostsPerPlatform,
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
        const key = row.text.slice(0, 140).toLowerCase();
        if (!row.text || seen.has(key)) continue;
        seen.add(key);
        yield {
          platformPostId: null,
          canonicalUrl: syntheticPermalink(row.authorUrl, row.text),
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

      // İlk turda hiç sonuç yoksa DOM kanıtını sakla ("sonuç yok" mu, "DOM
      // değişti" mi ayrımı için).
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
