/** Gezinme/scroll arası bekleme: min-max arasında rastgele; süreç boyunca olay döngüsü canlı kalır. */
export function createRateLimiter(
  minDelayMs: number,
  maxDelayMs: number,
): { wait(reason?: string): Promise<void> } {
  return {
    wait(reason?: string): Promise<void> {
      const clampedMin = Math.min(minDelayMs, maxDelayMs);
      const delay = clampedMin + Math.random() * (maxDelayMs - clampedMin);
      void reason;
      return new Promise((resolve) => setTimeout(resolve, delay));
    },
  };
}
