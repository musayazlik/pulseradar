import { normalizeTurkish } from "../utils/normalize";

/** Türkiye priority: common cities (extensible). */
const TR_CITIES = [
  "adana", "ankara", "antalya", "aydin", "balikesir", "bursa", "denizli",
  "diyarbakir", "edirne", "erzurum", "eskisehir", "gaziantep", "hatay",
  "izmir", "kayseri", "kocaeli", "konya", "malatya", "manisa", "mersin",
  "mugla", "ordu", "rize", "samsun", "sivas", "sanliurfa", "trabzon",
  "van", "zonguldak",
];

/** Istanbul is handled separately (European/Asian side variants). */
const ISTANBUL_VARIANTS = ["istanbul", "istanbul avrupa", "istanbul anadolu"];

const ONLINE_HINTS = [
  "online", "çevrimiçi", "cevrimici", "webinar", "uzaktan", "virtual",
  "her yerden", "zoom", "youtube canlı",
];

export interface LocationParseResult {
  city: string | null;
  venue: string | null;
  attendanceMode: "online" | "physical" | "hybrid" | "unknown";
  evidence: string | null;
}

export function parseLocation(rawText: string): LocationParseResult {
  const normalized = normalizeTurkish(rawText);
  const lowered = normalized.toLowerCase();

  let city: string | null = null;
  let evidence: string | null = null;
  for (const variant of ISTANBUL_VARIANTS) {
    if (lowered.includes(variant)) {
      city = "istanbul";
      evidence = variant;
      break;
    }
  }
  if (!city) {
    for (const candidate of TR_CITIES) {
      if (lowered.includes(candidate)) {
        city = candidate;
        evidence = candidate;
        break;
      }
    }
  }

  const isOnline = ONLINE_HINTS.some((hint) =>
    lowered.includes(normalizeTurkish(hint)),
  );

  let attendanceMode: LocationParseResult["attendanceMode"] = "unknown";
  if (isOnline && city) attendanceMode = "hybrid";
  else if (isOnline) attendanceMode = "online";
  else if (city) attendanceMode = "physical";

  return { city, venue: null, attendanceMode, evidence };
}
