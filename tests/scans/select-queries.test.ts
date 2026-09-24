import { describe, expect, it } from "vitest";
import { selectQueries } from "../../src/core/services/scan-service";

const configKeywords = Array.from({ length: 25 }, (_, i) => `kelime-${i}`);
const configHashtags = Array.from({ length: 13 }, (_, i) => `tag${i}`);

const base = {
  configKeywords,
  configHashtags,
};

describe("selectQueries", () => {
  it("every user-provided word is scanned without trimming", () => {
    const { queries, customCount } = selectQueries({
      ...base,
      customKeywords: ["a", "b", "c", "d", "e"],
      customHashtags: [],
    });
    expect(queries.slice(0, 5)).toEqual(["a", "b", "c", "d", "e"]);
    expect(customCount).toBe(5);
    // no word from the pool is skipped
    expect(queries).toHaveLength(5 + 25 + 13);
  });

  it("custom hashtags are added with # and take priority", () => {
    const { queries } = selectQueries({
      ...base,
      customKeywords: [],
      customHashtags: ["hackathon2026"],
    });
    expect(queries[0]).toBe("#hackathon2026");
  });

  it("custom inputs are deduplicated and do not collide with the default pool", () => {
    const { queries, customCount } = selectQueries({
      ...base,
      customKeywords: ["hackathon", "hackathon", " kelime-0 "],
      customHashtags: ["hackathon"],
    });
    // "hackathon" (deduplicated) + "#hackathon" (distinct as a hashtag) + "kelime-0"
    expect(customCount).toBe(3);
    expect(queries.filter((q) => q === "hackathon")).toHaveLength(1);
    expect(queries.filter((q) => q === "#hackathon")).toHaveLength(1);
    // "kelime-0" was chosen as custom; it must not come back from the default pool
    expect(queries.filter((q) => q === "kelime-0")).toHaveLength(1);
  });

  it("with no custom inputs, the entire settings list is scanned", () => {
    const { queries, customCount } = selectQueries({
      ...base,
      customKeywords: [],
      customHashtags: [],
    });
    expect(customCount).toBe(0);
    expect(queries).toHaveLength(25 + 13);
    expect(queries[0]).toBe("kelime-0");
    expect(queries).toContain("#tag0");
  });
});
