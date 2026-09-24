import { createWorker, type Worker } from "tesseract.js";
import fs from "node:fs";
import { getOcrCacheDir } from "../config/paths";

/**
 * Yerel OCR: tesseract.js (tur+eng). Bulut servisi yok; dil verileri ilk
 * first use it downloads to ocr-cache/ under the data directory; offline afterwards.
 */

const OCR_TEXT_MARKER = "[image text]";
/** OCR output below this length is treated as noise. */
const MIN_OCR_CHARS = 20;

let workerPromise: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const cacheDir = getOcrCacheDir();
      fs.mkdirSync(cacheDir, { recursive: true });
      return createWorker(["tur", "eng"], 1, {
        cachePath: cacheDir,
        logger: () => {},
      });
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/** Keeps only images that may be posters; filters out avatars/logos/small variants. */
export function filterPosterImages(urls: string[]): string[] {
  return urls.filter((url) => {
    if (url.includes("pbs.twimg.com/profile_images")) return false;
    if (url.includes("media.licdn.com")) {
      return !/shrink_\d+_\d+|company-logo/.test(url);
    }
    return true;
  });
}

/** Rewrites an X image URL to its large variant. */
export function toLargeVariant(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "pbs.twimg.com") {
      parsed.searchParams.set("name", "large");
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

/** Appends OCR text to the post text with a source tag. */
export function mergeOcrIntoText(text: string, ocrText: string): string {
  return `${text}\n${OCR_TEXT_MARKER}\n${ocrText}`;
}

export interface OcrOptions {
  maxImages: number;
  minBytes: number;
  signal?: AbortSignal;
}

/**
 * Downloads and OCRs the given images in order; a single image failing does
 * not break the flow. Returns null when no meaningful text is found.
 */
export async function ocrImages(
  urls: string[],
  opts: OcrOptions,
): Promise<string | null> {
  const selected = filterPosterImages(urls).slice(0, opts.maxImages);
  if (selected.length === 0) return null;

  const worker = await getOcrWorker();
  const texts: string[] = [];

  for (const url of selected) {
    if (opts.signal?.aborted) break;
    try {
      const res = await fetch(toLargeVariant(url), {
        signal: opts.signal ?? AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < opts.minBytes) continue;
      const { data } = await worker.recognize(buffer);
      const text = (data.text ?? "").replace(/\s+/g, " ").trim();
      if (text.length >= MIN_OCR_CHARS) texts.push(text);
    } catch {
      // A single image failure (network/corrupt file) is skipped.
    }
  }

  const joined = texts.join("\n").trim();
  return joined.length > 0 ? joined : null;
}

/** Releases OCR resources when the worker shuts down. */
export async function shutdownOcr(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise.catch(() => null);
  await worker?.terminate().catch(() => {});
  workerPromise = null;
}
