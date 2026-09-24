import { describe, expect, it } from "vitest";
import { parseDateExpressions } from "@/core/parsers/date-parser";

describe("date-parser", () => {
  it("12.10.2026 biçimini çözer", () => {
    const { dates } = parseDateExpressions("Etkinlik 12.10.2026 tarihinde", null);
    expect(dates[0]?.date).toBe("2026-10-12");
    expect(dates[0]?.precision).toBe("day");
  });

  it("12 Ekim 2026 19:00 biçiminde saat hassasiyeti verir", () => {
    const { dates } = parseDateExpressions("12 Ekim 2026 19:00'da görüşürüz", null);
    expect(dates[0]?.date).toBe("2026-10-12");
    expect(dates[0]?.time).toBe("19:00");
    expect(dates[0]?.precision).toBe("exact");
  });

  it("geçmiş tarihi bir sonraki gerçekleşmeye taşır", () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    // "31 Aralık <year-1>" verildiyse bir sonraki 31 Aralık bu yildedir
    // (bugün yılın son günü olsa bile yıl içindeyiz).
    const { dates } = parseDateExpressions(`31 Aralık ${year - 1} etkinliği`, null);
    expect(dates[0]?.date).toBe(`${year}-12-31`);

    // "10 Ocak <year-1>" için bir sonraki 10 Ocak: yıl ilerlediyse gelecek yıl.
    const jan10Passed = Date.UTC(year, 0, 10) < now.getTime();
    const expectedJan = jan10Passed ? year + 1 : year;
    const { dates: janDates } = parseDateExpressions(`10 Ocak ${year - 1} etkinliği`, null);
    expect(janDates[0]?.date).toBe(`${expectedJan}-01-10`);
  });

  it("31 Aralık / 1 Ocak sınırında yıl değişimini korur", () => {
    const { dates } = parseDateExpressions("31.12.2026", null);
    const { dates: next } = parseDateExpressions("01.01.2027", null);
    expect(dates[0]?.date).toBe("2026-12-31");
    expect(next[0]?.date).toBe("2027-01-01");
  });

  it("'yarın' ifadesini paylaşım tarihine göre çözer", () => {
    const publishedAt = "2026-03-10T10:00:00Z";
    const { dates } = parseDateExpressions("yarın buluşuyoruz", publishedAt);
    expect(dates[0]?.date).toBe("2026-03-11");
  });

  it("'yarın' paylaşım tarihi yoksa çözülmez", () => {
    const { dates } = parseDateExpressions("yarın buluşuyoruz", null);
    expect(dates).toHaveLength(0);
  });

  it("'bu cuma' için haftanın gününü bulur", () => {
    // 2026-09-23 Çarşamba; bu cuma 2026-09-25
    const publishedAt = "2026-09-23T09:00:00Z";
    const { dates } = parseDateExpressions("bu cuma meetup var", publishedAt);
    expect(dates[0]?.date).toBe("2026-09-25");
  });

  it("ay hassasiyetiyle 'Ekim 2026' çözer", () => {
    const { dates } = parseDateExpressions("Ekim 2026 içinde bir etkinlik", null);
    expect(dates[0]?.date).toBe("2026-10-01");
    expect(dates[0]?.precision).toBe("month");
  });
});
