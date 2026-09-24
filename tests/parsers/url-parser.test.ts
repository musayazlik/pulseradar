import { describe, expect, it } from "vitest";
import { extractUrls, normalizeUrl } from "@/core/utils/url";
import { parseUrls } from "@/core/parsers/url-parser";

describe("url-parser", () => {
  it("UTM parametrelerini temizler, etkinlik parametresini korur", () => {
    const normalized = normalizeUrl(
      "https://luma.com/abc?utm_source=x&utm_campaign=y&event_id=42",
    );
    expect(normalized).toBe("https://luma.com/abc?event_id=42");
  });

  it("geçersiz URL'de null döner", () => {
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("metindeki benzersiz bağlantıları çıkarır", () => {
    const links = extractUrls(
      "Kayıt: https://kommunity.com/etkinlik Ayrıntı: https://kommunity.com/etkinlik",
    );
    expect(links).toHaveLength(1);
  });

  it("kayıt adaylarını işaretler", () => {
    const result = parseUrls("Kayıt için https://luma.com/abc ve https://example.com/sayfa");
    expect(result.registrationCandidates).toEqual(["https://luma.com/abc"]);
  });
});
