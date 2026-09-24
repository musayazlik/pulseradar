import { describe, expect, it } from "vitest";
import { extractEventCandidates } from "@/core/parsers/event-parser";

const defaultOptions = { defaultTimeZone: "Europe/Istanbul" };

describe("event-parser", () => {
  it("produces an upcoming candidate with date + event intent", () => {
    const candidates = extractEventCandidates(
      {
        platform: "linkedin",
        platformPostId: "1",
        canonicalUrl: "https://linkedin.com/x",
        accountName: null,
        accountUrl: null,
        publishedAt: "2026-09-01T00:00:00Z",
        publishedAtPrecision: "day",
        rawText:
          "Yapay Zekâ Zirvesi 15.11.2026'da Ankara'da! Konferans kayıtları açıldı: https://luma.com/yz",
        extractedLinks: [],
      },
      defaultOptions,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.startDate).toBe("2026-11-15");
    expect(candidates[0]?.city).toBe("ankara");
    expect(candidates[0]?.needsReview).toBe(false);
  });

  it("sends strong announcements without a date to review", () => {
    const candidates = extractEventCandidates(
      {
        platform: "x",
        platformPostId: "2",
        canonicalUrl: "https://x.com/a/1",
        accountName: null,
        accountUrl: null,
        publishedAt: null,
        publishedAtPrecision: "unknown",
        rawText: "Büyük hackathon geliyor! Bu yıl ilk kez İstanbul'da. Detaylar yakında.",
        extractedLinks: [],
      },
      defaultOptions,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.needsReview).toBe(true);
    expect(candidates[0]?.startDate).toBeNull();
  });

  it("the mere mention of 'startup' is not enough", () => {
    const candidates = extractEventCandidates(
      {
        platform: "x",
        platformPostId: "3",
        canonicalUrl: "https://x.com/a/2",
        accountName: null,
        accountUrl: null,
        publishedAt: null,
        publishedAtPrecision: "unknown",
        rawText: "Yeni startup ürünümüzü duyurduk: https://example.com",
        extractedLinks: [],
      },
      defaultOptions,
    );
    expect(candidates).toHaveLength(0);
  });

  it("a job-ad text is not counted as an event", () => {
    const candidates = extractEventCandidates(
      {
        platform: "linkedin",
        platformPostId: "4",
        canonicalUrl: "https://linkedin.com/4",
        accountName: null,
        accountUrl: null,
        publishedAt: null,
        publishedAtPrecision: "unknown",
        rawText: "İş ilanı: Senior Engineer arıyoruz. 12.10.2026'ya kadar başvuru açık.",
        extractedLinks: [],
      },
      defaultOptions,
    );
    expect(candidates).toHaveLength(0);
  });

  it("does not automatically write the posting account as organizer", () => {
    const candidates = extractEventCandidates(
      {
        platform: "linkedin",
        platformPostId: "5",
        canonicalUrl: "https://linkedin.com/5",
        accountName: "Sözde Organizatör",
        accountUrl: null,
        publishedAt: "2026-09-01T00:00:00Z",
        publishedAtPrecision: "day",
        rawText: "Meetup 20.11.2026 İzmir'de buluşuyoruz!",
        extractedLinks: [],
      },
      defaultOptions,
    );
    expect(candidates[0]?.organizer).toBeNull();
  });
});
