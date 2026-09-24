import type { Platform } from "../core/types/platform";
import { openOwnedSession } from "./browser-manager";

const LOGIN_URLS: Record<Platform, string> = {
  linkedin: "https://www.linkedin.com/login",
  x: "https://x.com/login",
  instagram: "https://www.instagram.com/accounts/login/",
  tiktok: "https://www.tiktok.com/login",
};

/** Giriş tamamlanınca yönlendirilen sayfa işaretleri. */
const LOGGED_IN_MARKERS: Record<Platform, (url: string) => boolean> = {
  linkedin: (url) => url.includes("/feed/"),
  x: (url) => url.includes("/home"),
  instagram: (url) => /instagram\.com\/?$|\/feed/.test(url) && !url.includes("/accounts/login"),
  tiktok: (url) => url.includes("/foryou") && !url.includes("/login"),
};

export interface OpenLoginResult {
  status: "logged_in" | "timeout" | "error";
  detail?: string;
}

/**
 * Giriş ekranını açar ve kullanıcı girişini bekler; profil kapanmadan önce
 * kalıcı olarak saklanır. Şifre uygulamaya asla girilmez.
 */
export async function openLoginScreen(
  platform: Platform,
  opts?: { timeoutMs?: number },
): Promise<OpenLoginResult> {
  const timeoutMs = opts?.timeoutMs ?? 5 * 60_000;
  let session: Awaited<ReturnType<typeof openOwnedSession>> | null = null;
  try {
    session = await openOwnedSession();
    const page = session.context.pages()[0] ?? (await session.context.newPage());
    await page.goto(LOGIN_URLS[platform], {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await page.waitForTimeout(3000);
      if (LOGGED_IN_MARKERS[platform](page.url())) {
        await session.close();
        return {
          status: "logged_in",
          detail: `${platform} girişi tamamlandı; profil saklandı.`,
        };
      }
    }
    await session.close();
    return {
      status: "timeout",
      detail: `${timeoutMs / 1000} sn içinde giriş tamamlanmadı.`,
    };
  } catch (err) {
    await session?.close().catch(() => {});
    return { status: "error", detail: (err as Error).message };
  }
}
