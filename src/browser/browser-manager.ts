import fs from "node:fs";
import { chromium, type Browser, type BrowserContext } from "playwright-core";
import { getBrowserProfileDir } from "../core/config/paths";

export type BrowserMode = "persistent" | "cdp";

export function getBrowserMode(): BrowserMode {
  const mode = process.env.EVENT_RADAR_BROWSER_MODE;
  return mode === "cdp" ? "cdp" : "persistent";
}

export function getCdpUrl(): string | null {
  const url = process.env.EVENT_RADAR_CDP_URL;
  if (!url) return null;
  // CDP connects to loopback addresses only.
  try {
    const parsed = new URL(url);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * App-dedicated persistent profile; the user signs in via the browser on
 * first use and the profile is kept for later runs.
 */
export async function launchPersistentContext(): Promise<BrowserContext> {
  const profileDir = getBrowserProfileDir();
  fs.mkdirSync(profileDir, { recursive: true });
  return chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: false,
    viewport: null,
    // Google SSO rejects the browser as "not secure" when it sees automation
    // flags; we reduce the footprint (the account sign-in still belongs to the user).
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
    ],
  });
}

/** CDP mode: connects to the user's Chrome with debugging enabled. */
export async function connectOverCdp(): Promise<{ browser: Browser; context: BrowserContext }> {
  const url = getCdpUrl();
  if (!url) {
    throw new Error(
      "EVENT_RADAR_CDP_URL is not set or is not loopback. Start Chrome with a separate data directory and --remote-debugging-port=9222.",
    );
  }
  const browser = await chromium.connectOverCDP(url);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  return { browser, context };
}

export interface OwnedBrowserSession {
  mode: BrowserMode;
  context: BrowserContext;
  close(): Promise<void>;
}

/** The worker closes only the context it opened; never the user's browser. */
export async function openOwnedSession(): Promise<OwnedBrowserSession> {
  const mode = getBrowserMode();
  if (mode === "cdp") {
    const { browser, context } = await connectOverCdp();
    return {
      mode,
      context,
      close: async () => {
        await browser.close();
      },
    };
  }
  const context = await launchPersistentContext();
  return {
    mode,
    context,
    close: async () => {
      await context.close();
    },
  };
}
