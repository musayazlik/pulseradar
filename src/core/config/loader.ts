import fs from "node:fs";
import path from "node:path";
import { searchConfigSchema, type SearchConfig } from "./schema";
import { DEFAULT_SEARCH_CONFIG } from "./defaults";
import { ensureDataDirs, getConfigPath } from "./paths";

export class ConfigError extends Error {}

/** Config dosyası yoksa varsayılanlarla oluşturur; varsa Zod ile doğrular. */
export function loadConfig(): SearchConfig {
  ensureDataDirs();
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    writeConfigAtomic(DEFAULT_SEARCH_CONFIG);
    return DEFAULT_SEARCH_CONFIG;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    throw new ConfigError(
      `search.json okunamadı/JSON geçersiz: ${configPath} (${(err as Error).message})`,
    );
  }

  const parsed = searchConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new ConfigError(`search.json doğrulanamadı: ${issues}`);
  }
  return parsed.data;
}

/** Doğrular ve atomik olarak (tmp + rename) yazar. */
export function saveConfig(raw: unknown): SearchConfig {
  const parsed = searchConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new ConfigError(`ayarlar doğrulanamadı: ${issues}`);
  }
  ensureDataDirs();
  writeConfigAtomic(parsed.data);
  return parsed.data;
}

function writeConfigAtomic(config: SearchConfig): void {
  const configPath = getConfigPath();
  const tmpPath = path.join(path.dirname(configPath), `.search.json.tmp-${process.pid}`);
  fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  fs.renameSync(tmpPath, configPath);
}
