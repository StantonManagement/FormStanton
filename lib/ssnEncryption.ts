import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const keyHex = process.env.PBV_SSN_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'PBV_SSN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts an SSN string using AES-256-GCM.
 * Returns a colon-separated string: "{iv_hex}:{authTag_hex}:{ciphertext_hex}".
 * Never logs or throws the plaintext SSN.
 */
export function encryptSsn(ssn: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(ssn, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a ciphertext produced by encryptSsn().
 * Throws if the format is invalid or if the auth tag does not match
 * (which indicates key mismatch or tampered ciphertext).
 * Never logs the decrypted value.
 */
export function decryptSsn(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid SSN ciphertext format');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Extracts the last 4 digits of an SSN.
 * Input may be formatted ("123-45-6789") or raw digits ("123456789").
 */
export function ssnLastFour(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length < 4) {
    throw new Error('SSN must contain at least 4 digits');
  }
  return digits.slice(-4);
}
