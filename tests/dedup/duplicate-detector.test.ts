import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resetDbForTests } from "../../src/database/client";
import { ingestPost, listEventsWithStatus } from "../../src/core/services/event-service";

// Her test izole veri dizininde çalışır; DB önbelleği afterEach'de sıfırlanır.
const tmpDirs: string[] = [];

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "event-radar-test-"));
  process.env.EVENT_RADAR_DATA_DIR = dir;
  tmpDirs.push(dir);
});

afterEach(() => {
  resetDbForTests();
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  delete process.env.EVENT_RADAR_DATA_DIR;
});

describe("duplicate kontrolü (DB entegre)", () => {
  it("aynı veri ikinci kez eklenmez; aynı gönderi 'reseen' olur", () => {
    const draft = {
      platform: "linkedin" as const,
      platformPostId: "post-1",
      canonicalUrl: "https://www.linkedin.com/feed/update/urn:li:activity:123/",
      accountName: "Example Community",
      accountUrl: null,
      publishedAt: "2026-09-01T10:00:00Z",
      publishedAtPrecision: "day" as const,
      rawText:
        "AI Startup Meetup 12.10.2026'da İstanbul'da! Kayıtlar açıldı: https://luma.com/ai-meetup",
      extractedLinks: ["https://luma.com/ai-meetup"],
    };

    const first = ingestPost(draft, { defaultTimeZone: "Europe/Istanbul", lastDays: 30, taskId: null });
    const second = ingestPost(draft, { defaultTimeZone: "Europe/Istanbul", lastDays: 30, taskId: null });

    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("reseen");

    const events = listEventsWithStatus();
    const created = events.filter((e) => e.id === first.eventId);
    expect(created).toHaveLength(1);
  });

  it("aynı başlık + aynı tarih ikinci paylaşımda birleşir", () => {
    const base = {
      accountName: "A",
      accountUrl: null,
      publishedAt: "2026-09-01T10:00:00Z",
      publishedAtPrecision: "day" as const,
      extractedLinks: [],
    };

    const first = ingestPost(
      {
        ...base,
        platform: "linkedin" as const,
        platformPostId: "p1",
        canonicalUrl: "https://www.linkedin.com/feed/update/urn:li:activity:1/",
        rawText: "TechKonferans 12.10.2026 İstanbul'da! Etkinlik kayıtları açık: https://luma.com/tk",
      },
      { defaultTimeZone: "Europe/Istanbul", lastDays: 30, taskId: null },
    );

    const second = ingestPost(
      {
        ...base,
        platform: "x" as const,
        platformPostId: "p2",
        canonicalUrl: "https://x.com/a/status/2",
        rawText: "TechKonferans 12.10.2026 İstanbul'da! Konferans programı açıklandı.",
      },
      { defaultTimeZone: "Europe/Istanbul", lastDays: 30, taskId: null },
    );

    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("merged");
    expect(second.eventId).toBe(first.eventId);
  });

  it("etkinlik niyeti olmayan metin (iş ilanı) kayıt açmaz", () => {
    const result = ingestPost(
      {
        platform: "x" as const,
        platformPostId: "p3",
        canonicalUrl: "https://x.com/a/status/3",
        accountName: null,
        accountUrl: null,
        publishedAt: "2026-09-01T10:00:00Z",
        publishedAtPrecision: "day" as const,
        rawText: "Senior developer arıyoruz, iş ilanı: https://example.com/job 12.10.2026",
        extractedLinks: [],
      },
      { defaultTimeZone: "Europe/Istanbul", lastDays: 30, taskId: null },
    );
    expect(result.outcome).toBe("no_event");
  });
});
