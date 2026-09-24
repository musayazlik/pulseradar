const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** MVP panel yalnızca 127.0.0.1'de yayınlanır. */
export function isLocalRequest(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return false;
  const hostName = host.split(":")[0];
  if (!LOCAL_HOSTS.has(hostName)) return false;

  // Değişiklik yapan isteklerde Origin (varsa) de yerel olmalı.
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      return LOCAL_HOSTS.has(parsed.hostname);
    } catch {
      return false;
    }
  }
  return true;
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
