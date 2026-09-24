import { describe, expect, it } from "vitest";
import { selectQueries } from "../../src/core/services/scan-service";

const configKeywords = Array.from({ length: 25 }, (_, i) => `kelime-${i}`);
const configHashtags = Array.from({ length: 13 }, (_, i) => `tag${i}`);

const base = {
  configKeywords,
  configHashtags,
  maxQueries: 3,
  rotationOffset: 0,
};

describe("selectQueries", () => {
  it("özel anahtar kelime büyük havuza rağmen her zaman ilk sırada", () => {
    const { queries, customCount } = selectQueries({
      ...base,
      customKeywords: ["izmir javascript buluşması"],
      customHashtags: [],
      rotationOffset: 7,
    });
    expect(queries[0]).toBe("izmir javascript buluşması");
    expect(customCount).toBe(1);
    expect(queries).toHaveLength(3);
    // kalan iki slot varsayılan havuzdan
    expect(queries.slice(1).every((q) => !q.startsWith("#izmir"))).toBe(true);
  });

  it("özel hashtag'ler # ile eklenir ve önceliklidir", () => {
    const { queries } = selectQueries({
      ...base,
      customKeywords: [],
      customHashtags: ["hackathon2026"],
      rotationOffset: 0,
    });
    expect(queries[0]).toBe("#hackathon2026");
  });

  it("kalan haklar varsayılan havuzdan döndürülerek doldurulur", () => {
    const a = selectQueries({ ...base, customKeywords: ["özel tarama"], customHashtags: [], rotationOffset: 0 });
    const b = selectQueries({ ...base, customKeywords: ["özel tarama"], customHashtags: [], rotationOffset: 1 });
    expect(a.queries[0]).toBe("özel tarama");
    expect(b.queries[0]).toBe("özel tarama");
    // ilk slot aynı, döndürülen kısımlar farklı
    expect(a.queries.slice(1)).not.toEqual(b.queries.slice(1));
  });

  it("özel sayıyı aşarsa ilk maxQueries özel kullanılır, varsayılan girmez", () => {
    const { queries, customCount } = selectQueries({
      ...base,
      customKeywords: ["a", "b", "c", "d", "e"],
      customHashtags: [],
      rotationOffset: 3,
    });
    expect(queries).toEqual(["a", "b", "c"]);
    expect(customCount).toBe(3);
  });

  it("özel olmadığında eski kapsama davranışı korunur", () => {
    const a = selectQueries({ ...base, customKeywords: [], customHashtags: [], rotationOffset: 0 });
    const b = selectQueries({ ...base, customKeywords: [], customHashtags: [], rotationOffset: 1 });
    expect(a.queries).toHaveLength(3);
    expect(a.queries[0]).toBe("kelime-0");
    expect(b.queries[0]).toBe("kelime-1");
  });

  it("özel girişler tekilleştirilir ve varsayılan havuzla çakışmaz", () => {
    const { queries, customCount } = selectQueries({
      ...base,
      customKeywords: ["hackathon", "hackathon", " kelime-0 "],
      customHashtags: ["hackathon"],
      rotationOffset: 0,
    });
    // "hackathon" (tekrarsız) + "#hackathon" (hashtag olarak farklı) + "kelime-0"
    expect(customCount).toBe(3);
    expect(queries.filter((q) => q === "hackathon")).toHaveLength(1);
    expect(queries.filter((q) => q === "#hackathon")).toHaveLength(1);
    // "kelime-0" özel olarak seçildi; varsayılan havuzdan tekrar gelmemeli
    expect(queries.filter((q) => q === "kelime-0")).toHaveLength(1);
  });
});
