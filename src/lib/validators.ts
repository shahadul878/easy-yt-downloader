const URL_PATTERN = /^https?:\/\/.+/i;

export function validateMediaUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "Enter a media URL.";
  if (trimmed.length > 2048) return "URL is too long.";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Only http and https URLs are supported.";
    }
  } catch {
    return "Invalid URL.";
  }
  if (!URL_PATTERN.test(trimmed)) return "Invalid URL.";
  return null;
}
