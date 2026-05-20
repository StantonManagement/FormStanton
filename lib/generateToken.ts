export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

/**
 * Generate a URL-safe random token using a base62 alphabet [0-9A-Za-z].
 *
 * Default length 16 ≈ 95.3 bits of entropy (62^16 ≈ 4.77e28), comfortably
 * above the OWASP-recommended 96-bit threshold for unguessable magic-link
 * / session tokens — and ~half the character count of a hex UUID (32 chars).
 *
 * Uses crypto.getRandomValues with rejection sampling to avoid modulo bias.
 */
const BASE62_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export function generateShortToken(length: number = 16): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error(`generateShortToken: length must be a positive integer, got ${length}`)
  }
  const alphabetLen = BASE62_ALPHABET.length // 62
  // Largest multiple of 62 that fits in a byte (0..255). Reject bytes >= this
  // value to keep the distribution uniform across the 62 alphabet positions.
  const maxAcceptable = Math.floor(256 / alphabetLen) * alphabetLen // 248

  const out: string[] = []
  // Oversample to reduce loop iterations on rejection.
  const buf = new Uint8Array(length * 2)
  while (out.length < length) {
    crypto.getRandomValues(buf)
    for (let i = 0; i < buf.length && out.length < length; i++) {
      const byte = buf[i]
      if (byte < maxAcceptable) {
        out.push(BASE62_ALPHABET[byte % alphabetLen])
      }
    }
  }
  return out.join('')
}
