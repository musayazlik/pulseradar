import { listEventsWithStatus } from "../core/services/event-service";
import type { EventStatus } from "../core/types/event";

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
};

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** [12 Ekim 2026] biçiminde tarih başlığı. */
function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${TR_MONTHS[m - 1]} ${y}`;
}

export async function runListCommand(flags: Record<string, string>): Promise<number> {
  const status = (flags.status?.split(",") as EventStatus[]) ?? undefined;
  const events = listEventsWithStatus({
    city: flags.city ?? null,
    status,
    upcomingOnly: flags.all !== "1",
    limit: 200,
  });

  if (events.length === 0) {
    console.log("Kayıt bulunamadı.");
    return 0;
  }

  for (const event of events) {
    const dateLabel = event.startDate
      ? `[${formatDateLabel(event.startDate)}]`
      : "[tarih belirsiz]";
    const cityLabel = event.city
      ? ` — ${event.city.charAt(0).toLocaleUpperCase("tr")}${event.city.slice(1)}`
      : event.attendanceMode === "online"
        ? " — Online"
        : "";

    console.log(`${dateLabel} ${event.title}${cityLabel}`);
    console.log(
      `Platformlar: ${
        event.platforms.length > 0
          ? event.platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(", ")
          : "—"
      }`,
    );
    if (event.organizer) console.log(`Organizatör: ${event.organizer}`);
    console.log(
      `Kayıt: ${event.registrationUrl ?? "Bulunamadı"}`,
    );
    console.log(""); // boş satır ayırıcı
  }

  console.log(`${events.length} etkinlik listelendi.`);
  return 0;
}
