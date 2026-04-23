const ipWindows = new Map<string, number[]>();

/**
 * Returns true if the request is within the allowed rate.
 * Mutates the internal window map on each allowed request.
 */
export function checkRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const prior = (ipWindows.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (prior.length >= maxRequests) return false;
  prior.push(now);
  ipWindows.set(ip, prior);
  return true;
}
