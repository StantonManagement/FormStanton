export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed || fallback;
  }

  if (error instanceof Error) {
    const message = typeof error.message === 'string' ? error.message.trim() : '';
    return message || fallback;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const candidate = record.message ?? record.error ?? record.error_description;

    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      return trimmed || fallback;
    }
  }

  return fallback;
}
