import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright-core";
import { getLogsDir } from "../../core/config/paths";

/**
 * "Sonuç yok" ile "DOM değişti"yi ayırt etmek için boş sonuçlarda kanıt
 * (HTML + ekran görüntüsü) yerel logs dizinine kaydedilir. Oturum değeri içermez.
 */
export async function captureDebug(
  page: Page,
  platform: string,
  tag: string,
): Promise<string> {
  const dir = getLogsDir();
  fs.mkdirSync(dir, { recursive: true });
  const safeTag = tag.replace(/[^\w-]+/g, "_").slice(0, 40);
  const base = path.join(dir, `${platform}-${safeTag}-${Date.now()}`);
  try {
    fs.writeFileSync(`${base}.html`, await page.content());
    await page.screenshot({ path: `${base}.png` });
  } catch {
    // Tanılama kaydı başarısız olabilir; akışı bozmaz.
  }
  return base;
}
