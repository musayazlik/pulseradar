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
  // CDP yalnızca loopback adresine bağlanır.
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
 * Uygulamaya ayrılmış kalıcı profil; ilk kullanımda kullanıcı girişi
 * tarayıcıda yapılır, profil sonraki çalıştırmalarda saklanır.
 */
export async function launchPersistentContext(): Promise<BrowserContext> {
  const profileDir = getBrowserProfileDir();
  fs.mkdirSync(profileDir, { recursive: true });
  return chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: false,
    viewport: null,
    // Google SSO, otomasyon bayrağı gördüğünde "bu tarayıcı güvenli değil"
    // diye reddediyor; izi azaltıyoruz (hesap girişi yine kullanıcıya ait).
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
    ],
  });
}

/** CDP modu: kullanıcının debugging açık Chrome'una bağlanır. */
export async function connectOverCdp(): Promise<{ browser: Browser; context: BrowserContext }> {
  const url = getCdpUrl();
  if (!url) {
    throw new Error(
      "EVENT_RADAR_CDP_URL ayarlı değil veya loopback dışında. Chrome'u ayrı bir veri diziniyle --remote-debugging-port=9222 ile başlatın.",
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

/** Worker yalnızca kendi açtığı context'i kapatır; kullanıcının tarayıcısını kapatmaz. */
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
