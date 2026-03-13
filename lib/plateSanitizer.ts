/**
 * Sanitize vehicle plate numbers by removing encoding corruption and invalid characters
 */

export function sanitizePlate(plate: string | null | undefined): string {
  if (!plate) return '';
  
  let cleaned = plate;
  
  // Remove common UTF-8 encoding corruption patterns
  const corruptionPatterns = [
    /â€¢/g,  // bullet point corruption
    /â€"/g,  // em dash corruption
    /â€™/g,  // apostrophe corruption
    /â€œ/g,  // left quote corruption
    /â€/g,   // right quote corruption
    /Â/g,    // non-breaking space corruption
    /â€¦/g,  // ellipsis corruption
  ];
  
  corruptionPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Remove any remaining non-alphanumeric characters except hyphens and spaces
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s-]/g, '');
  
  // Convert to uppercase
  cleaned = cleaned.toUpperCase();
  
  // Normalize whitespace and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}
