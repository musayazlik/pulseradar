export type EventStatus =
  | "upcoming"
  | "ongoing"
  | "expired"
  | "needs_review"
  | "rejected";

export type DatePrecision = "exact" | "day" | "month" | "year" | "unknown";

export type AttendanceMode = "online" | "physical" | "hybrid" | "unknown";

export interface EventRecord {
  id: string;
  title: string;
  normalizedTitle: string;
  description: string | null;
  /** YYYY-MM-DD; saat bilinmiyorsa uydurulmaz. */
  startDate: string | null;
  endDate: string | null;
  /** HH:mm */
  startTime: string | null;
  endTime: string | null;
  timeZone: string | null;
  datePrecision: DatePrecision;
  venue: string | null;
  city: string | null;
  country: string | null;
  attendanceMode: AttendanceMode;
  organizer: string | null;
  registrationUrl: string | null;
  status: EventStatus;
  /** Kural puanı; istatistiksel doğruluk yüzdesi değildir. */
  confidence: number;
  /** UTC ISO zamanlar. */
  firstDiscoveredAt: string;
  updatedAt: string;
  manuallyEditedFields: string[];
}

export interface EventSourceLink {
  postId: string;
  platform: string;
  canonicalUrl: string;
  accountName: string | null;
  publishedAt: string | null;
  evidenceJson: string | null;
  parserVersion: string;
}

export interface EventWithSources extends EventRecord {
  sources: EventSourceLink[];
}

/** Etkinlik listesinde satır başına platform rozetleri için. */
export interface EventListRow extends EventRecord {
  platforms: string[];
}
