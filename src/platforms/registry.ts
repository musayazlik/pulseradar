import type { Platform, PlatformScanner } from "../core/types/platform";
import { linkedinScanner } from "./linkedin/adapter";
import { xScanner } from "./twitter/adapter";
import { instagramScanner } from "./instagram/adapter";
import { tiktokScanner } from "./tiktok/adapter";

const registry = new Map<Platform, PlatformScanner>([
  [linkedinScanner.platform, linkedinScanner],
  [xScanner.platform, xScanner],
  [instagramScanner.platform, instagramScanner],
  [tiktokScanner.platform, tiktokScanner],
]);

export function getAdapter(platform: Platform): PlatformScanner | null {
  return registry.get(platform) ?? null;
}

export function listAdapters(): PlatformScanner[] {
  return [...registry.values()];
}
