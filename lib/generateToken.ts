export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}
