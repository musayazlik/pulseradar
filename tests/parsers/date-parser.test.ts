import { describe, expect, it } from "vitest";
import { parseDateExpressions } from "@/core/parsers/date-parser";

describe("date-parser", () => {
  it("parses the 12.10.2026 format", () => {
    const { dates } = parseDateExpressions("Etkinlik 12.10.2026 tarihinde", null);
    expect(dates[0]?.date).toBe("2026-10-12");
    expect(dates[0]?.precision).toBe("day");
  });

  it("gives minute precision for the 12 Ekim 2026 19:00 format", () => {
    const { dates } = parseDateExpressions("12 Ekim 2026 19:00'da görüşürüz", null);
    expect(dates[0]?.date).toBe("2026-10-12");
    expect(dates[0]?.time).toBe("19:00");
    expect(dates[0]?.precision).toBe("exact");
  });

  it("moves a past date to its next occurrence", () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    // for "31 Aralık <year-1>", the next 31 Aralık is within this year
    // (even if today were the last day of the year).
    const { dates } = parseDateExpressions(`31 Aralık ${year - 1} etkinliği`, null);
    expect(dates[0]?.date).toBe(`${year}-12-31`);

    // for "10 Ocak <year-1>", the next 10 Ocak: next year if the year has advanced.
    const jan10Passed = Date.UTC(year, 0, 10) < now.getTime();
    const expectedJan = jan10Passed ? year + 1 : year;
    const { dates: janDates } = parseDateExpressions(`10 Ocak ${year - 1} etkinliği`, null);
    expect(janDates[0]?.date).toBe(`${expectedJan}-01-10`);
  });

  it("preserves the year rollover at the 31 Aralık / 1 Ocak boundary", () => {
    const { dates } = parseDateExpressions("31.12.2026", null);
    const { dates: next } = parseDateExpressions("01.01.2027", null);
    expect(dates[0]?.date).toBe("2026-12-31");
    expect(next[0]?.date).toBe("2027-01-01");
  });

  it("resolves 'yarın' (tomorrow) against the post date", () => {
    const publishedAt = "2026-03-10T10:00:00Z";
    const { dates } = parseDateExpressions("yarın buluşuyoruz", publishedAt);
    expect(dates[0]?.date).toBe("2026-03-11");
  });

  it("'yarın' cannot be resolved without a post date", () => {
    const { dates } = parseDateExpressions("yarın buluşuyoruz", null);
    expect(dates).toHaveLength(0);
  });

  it("finds the weekday for 'bu cuma' (this Friday)", () => {
    // 2026-09-23 is a Wednesday; this Friday is 2026-09-25
    const publishedAt = "2026-09-23T09:00:00Z";
    const { dates } = parseDateExpressions("bu cuma meetup var", publishedAt);
    expect(dates[0]?.date).toBe("2026-09-25");
  });

  it("resolves 'Ekim 2026' with month precision", () => {
    const { dates } = parseDateExpressions("Ekim 2026 içinde bir etkinlik", null);
    expect(dates[0]?.date).toBe("2026-10-01");
    expect(dates[0]?.precision).toBe("month");
  });
});
