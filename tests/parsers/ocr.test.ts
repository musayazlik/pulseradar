import { describe, expect, it } from "vitest";
import {
  filterPosterImages,
  mergeOcrIntoText,
  toLargeVariant,
} from "../../src/core/parsers/ocr";
import { searchConfigSchema } from "../../src/core/config/schema";
import { DEFAULT_SEARCH_CONFIG } from "../../src/core/config/defaults";

describe("ocr image filter", () => {
  it("keeps X media images, filters out profile photos", () => {
    const kept = filterPosterImages([
      "https://pbs.twimg.com/media/GxHack.jpg?format=jpg&name=medium",
      "https://pbs.twimg.com/profile_images/123/me_normal.jpg",
    ]);
    expect(kept).toEqual([
      "https://pbs.twimg.com/media/GxHack.jpg?format=jpg&name=medium",
    ]);
  });

  it("filters out LinkedIn avatars/logos", () => {
    const kept = filterPosterImages([
      "https://media.licdn.com/dms/image/D4E.../profile-framedphoto-shrink_100_100/...",
      "https://media.licdn.com/dms/image/C56.../company-logo_100_100/...",
      "https://media.licdn.com/dms/image/D4E.../post-image/...",
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toContain("post-image");
  });

  it("rewrites an X URL to its large variant", () => {
    const large = toLargeVariant(
      "https://pbs.twimg.com/media/GxHack.jpg?format=jpg&name=medium",
    );
    expect(large).toContain("name=large");
  });
});

describe("ocr text merging", () => {
  it("appends image text with the source tag", () => {
    const merged = mergeOcrIntoText("Hackathon duyurusu", "19-20 EYLÜL 2026 ISTANBUL kayit: luma.com/x");
    expect(merged).toContain("[image text]");
    expect(merged).toContain("Hackathon duyurusu");
    expect(merged).toContain("luma.com/x");
  });
});

describe("config backward compatibility", () => {
  it("an old config without the ocr section is accepted with defaults", () => {
    const oldConfig = { ...DEFAULT_SEARCH_CONFIG };
    delete (oldConfig as { ocr?: unknown }).ocr;
    const parsed = searchConfigSchema.parse(oldConfig);
    expect(parsed.ocr.enabled).toBe(true);
    expect(parsed.ocr.maxImagesPerPost).toBe(2);
  });
});
