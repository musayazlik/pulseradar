/** Navigation/scroll delay: random between min and max; keeps the event loop alive for the whole process. */
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
