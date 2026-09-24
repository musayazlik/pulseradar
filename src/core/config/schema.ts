import { z } from "zod";
import { PLATFORMS } from "../types/platform";

export const searchConfigSchema = z.object({
  version: z.literal(1),
  enabledPlatforms: z.array(z.enum(PLATFORMS)).min(1),
  preferredCountry: z.string().trim().length(2).default("TR"),
  defaultTimeZone: z.string().trim().min(1).default("Europe/Istanbul"),
  keywords: z.array(z.string().trim().min(1)).default([]),
  hashtags: z
    .array(z.string().trim().min(1).regex(/^[^\s#]+$/, "hashtag cannot contain spaces"))
    .default([]),
  filters: z.object({
    city: z.string().trim().min(1).nullable().default(null),
    lastDays: z.number().int().min(1).max(365).default(30),
    includeOnline: z.boolean().default(true),
    includeExpired: z.boolean().default(false),
    unknownPublishedAt: z
      .enum(["exclude_from_date_filtered_results", "include"])
      .default("exclude_from_date_filtered_results"),
  }),
  limits: z.object({
    maxPostsPerQuery: z.number().int().min(1).max(100).default(15),
    maxScrollsPerQuery: z.number().int().min(0).max(20).default(3),
    minDelayMs: z.number().int().min(1000).max(60000).default(4000),
    maxDelayMs: z.number().int().min(1000).max(120000).default(8000),
    maxRunMinutes: z.number().int().min(1).max(480).default(60),
  }),
  // Older search.json files stay valid without the ocr section (default).
  ocr: z
    .object({
      enabled: z.boolean().default(true),
      maxImagesPerPost: z.number().int().min(1).max(5).default(2),
      minImageBytes: z.number().int().min(0).default(20000),
    })
    .default({ enabled: true, maxImagesPerPost: 2, minImageBytes: 20000 }),
});

export type SearchConfig = z.infer<typeof searchConfigSchema>;
