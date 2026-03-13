const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function hasSurroundingWhitespace(value: string): boolean {
  return value !== value.trim();
}

export function getSessionSecret(): string {
  const sessionSecret = process.env.SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error('SESSION_SECRET is required');
  }

  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long');
  }

  if (hasSurroundingWhitespace(sessionSecret)) {
    throw new Error('SESSION_SECRET cannot have leading or trailing whitespace');
  }

  return sessionSecret;
}

export interface AdminAuthSecrets {
  adminPasswordHash?: string;
  adminPasswordLegacy?: string;
}

export function getAdminAuthSecrets(): AdminAuthSecrets {
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const adminPasswordLegacy = process.env.ADMIN_PASSWORD;

  if (!adminPasswordHash && !adminPasswordLegacy) {
    throw new Error('ADMIN_PASSWORD_HASH (preferred) or ADMIN_PASSWORD (legacy) must be configured');
  }

  if (adminPasswordHash) {
    if (hasSurroundingWhitespace(adminPasswordHash)) {
      throw new Error('ADMIN_PASSWORD_HASH cannot have leading or trailing whitespace');
    }

    if (!BCRYPT_HASH_REGEX.test(adminPasswordHash)) {
      throw new Error('ADMIN_PASSWORD_HASH must be a valid bcrypt hash');
    }
  }

  if (adminPasswordLegacy) {
    if (hasSurroundingWhitespace(adminPasswordLegacy)) {
      throw new Error('ADMIN_PASSWORD cannot have leading or trailing whitespace');
    }

    if (adminPasswordLegacy.length < 8) {
      throw new Error('ADMIN_PASSWORD must be at least 8 characters long');
    }
  }

  return {
    adminPasswordHash,
    adminPasswordLegacy,
  };
}
