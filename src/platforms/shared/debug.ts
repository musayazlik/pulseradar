import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright-core";
import { getLogsDir } from "../../core/config/paths";

/**
 * To tell "no results" apart from "DOM changed", empty results save evidence
 * (HTML + screenshot) into the local logs directory. Contains no session values.
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
    // Diagnostic recording can fail; it never breaks the flow.
  }
  return base;
}
