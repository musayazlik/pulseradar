const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** The MVP panel is served on 127.0.0.1 only. */
export function isLocalRequest(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return false;
  const hostName = host.split(":")[0];
  if (!LOCAL_HOSTS.has(hostName)) return false;

  // Mutating requests must also have a local Origin (when present).
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
