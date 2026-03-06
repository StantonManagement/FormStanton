// Simple in-memory rate limiter for authentication attempts
// In production, consider using Redis or a database for distributed systems

interface RateLimitEntry {
  attempts: number;
  lockedUntil?: number;
  firstAttempt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const WINDOW_DURATION = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(identifier: string): { allowed: boolean; remainingAttempts?: number; lockedUntil?: Date } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // No previous attempts
  if (!entry) {
    rateLimitStore.set(identifier, {
      attempts: 1,
      firstAttempt: now
    });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 };
  }

  // Check if currently locked out
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      lockedUntil: new Date(entry.lockedUntil)
    };
  }

  // Reset if window has expired
  if (now - entry.firstAttempt > WINDOW_DURATION) {
    rateLimitStore.set(identifier, {
      attempts: 1,
      firstAttempt: now
    });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 };
  }

  // Increment attempts
  entry.attempts++;

  // Lock if exceeded max attempts
  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION;
    rateLimitStore.set(identifier, entry);
    return {
      allowed: false,
      lockedUntil: new Date(entry.lockedUntil)
    };
  }

  rateLimitStore.set(identifier, entry);
  return {
    allowed: true,
    remainingAttempts: MAX_ATTEMPTS - entry.attempts
  };
}

export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entries older than 1 hour
    if (now - entry.firstAttempt > 60 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000); // Run every hour
