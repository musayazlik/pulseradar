import { describe, expect, it } from "vitest";
import {
  filterPosterImages,
  mergeOcrIntoText,
  toLargeVariant,
} from "../../src/core/parsers/ocr";
import { searchConfigSchema } from "../../src/core/config/schema";
import { DEFAULT_SEARCH_CONFIG } from "../../src/core/config/defaults";

describe("ocr görsel filtresi", () => {
  it("X medya görsellerini tutar, profil fotoğraflarını eler", () => {
    const kept = filterPosterImages([
      "https://pbs.twimg.com/media/GxHack.jpg?format=jpg&name=medium",
      "https://pbs.twimg.com/profile_images/123/me_normal.jpg",
    ]);
    expect(kept).toEqual([
      "https://pbs.twimg.com/media/GxHack.jpg?format=jpg&name=medium",
    ]);
  });

  it("LinkedIn avatar/logolarını eler", () => {
    const kept = filterPosterImages([
      "https://media.licdn.com/dms/image/D4E.../profile-framedphoto-shrink_100_100/...",
      "https://media.licdn.com/dms/image/C56.../company-logo_100_100/...",
      "https://media.licdn.com/dms/image/D4E.../post-image/...",
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toContain("post-image");
  });

  it("X URL'ini büyük varyanta çevirir", () => {
    const large = toLargeVariant(
      "https://pbs.twimg.com/media/GxHack.jpg?format=jpg&name=medium",
    );
    expect(large).toContain("name=large");
  });
});

describe("ocr metin birleştirme", () => {
  it("görsel metnini kaynak etiketiyle ekler", () => {
    const merged = mergeOcrIntoText("Hackathon duyurusu", "19-20 EYLÜL 2026 ISTANBUL kayit: luma.com/x");
    expect(merged).toContain("[görsel metni]");
    expect(merged).toContain("Hackathon duyurusu");
    expect(merged).toContain("luma.com/x");
  });
});

describe("config geriye uyumluluk", () => {
  it("ocr bölümü olmayan eski config varsayılanlarla kabul edilir", () => {
    const oldConfig = { ...DEFAULT_SEARCH_CONFIG };
    delete (oldConfig as { ocr?: unknown }).ocr;
    const parsed = searchConfigSchema.parse(oldConfig);
    expect(parsed.ocr.enabled).toBe(true);
    expect(parsed.ocr.maxImagesPerPost).toBe(2);
  });
});
