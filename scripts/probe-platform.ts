/**
 * Live selector observation tool: opens the platform, reports the session status and
 * candidate selector counts in the search result DOM, and saves evidence under
 * logs/. Selectors are updated only by observing with this tool.
 *
 * Usage: npx tsx scripts/probe-platform.ts <linkedin|x> [query]
 */
import { openOwnedSession } from "../src/browser/browser-manager";
import { getAdapter } from "../src/platforms/registry";
import { normalizePlatform } from "../src/core/types/platform";
import type { SearchOptions } from "../src/core/types/platform";
import { buildLinkedInSearchUrl } from "../src/platforms/linkedin/search-builder";
import { buildXSearchUrl } from "../src/platforms/twitter/search-builder";
import { captureDebug } from "../src/platforms/shared/debug";
import { createRateLimiter } from "../src/worker/rate-limiter";

async function main(): Promise<void> {
  const platform = normalizePlatform(process.argv[2] ?? "linkedin");
  if (!platform) throw new Error("platform must be linkedin|x|instagram|tiktok");
  const query = process.argv[3] ?? "hackathon istanbul";

  const adapter = getAdapter(platform)!;
  const session = await openOwnedSession();
  try {
    const page = session.context.pages()[0] ?? (await session.context.newPage());
    const ctx = {
      page,
      limiter: createRateLimiter(4000, 8000),
      logger: console,
      signal: new AbortController().signal,
    };

    const sessionResult = await adapter.checkSession(ctx);
    console.log(`oturum: ${sessionResult.status}${sessionResult.detail ? ` — ${sessionResult.detail}` : ""}`);

    const options: SearchOptions = {
      queries: [query],
      maxPostsPerQuery: 15,
      maxScrollsPerQuery: 1,
      lastDays: 30,
      city: null,
    };
    const url =
      platform === "linkedin"
        ? buildLinkedInSearchUrl(options)
        : buildXSearchUrl(options);
    console.log("arama URL:", url);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(5000);
    console.log("son URL:", page.url());

    const counts = await page.evaluate(() => ({
      linkedinContainers: document.querySelectorAll(
        'div[data-urn^="urn:li:activity"], div.feed-shared-update-v2',
      ).length,
      tweets: document.querySelectorAll('article[data-testid="tweet"]').length,
      articles: document.querySelectorAll("article").length,
      timeEls: document.querySelectorAll("time[datetime]").length,
      loginMarkers: document.querySelectorAll(
        '[data-testid="loginButton"], form#login, a[href="/login"]',
      ).length,
      bodyChars: document.body.innerText.length,
    }));
    console.log("selector counts:", counts);

    const sample = await page.evaluate(() =>
      document.body.innerText.slice(0, 500).replace(/\n+/g, " | "),
    );
    console.log("text sample:", sample);

    const base = await captureDebug(page, platform, "probe");
    console.log(`evidence: ${base}.html + ${base}.png`);
  } finally {
    await session.close().catch(() => {});
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
