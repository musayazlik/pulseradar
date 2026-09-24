// Aşama 6'da doldurulacak: kuyruk sahiplenme (atomik claim), heartbeat/lease
// yenileme, kesilmiş iş kurtarma ve iptal davranışı testleri.
import { describe, expect, it } from "vitest";

describe("kuyruk sahiplenme", () => {
  it.todo("aynı iş iki süreçte birden fazla sahiplenilemez");
  it.todo("lease süresi dolan iş interrupted işaretlenir");
});
