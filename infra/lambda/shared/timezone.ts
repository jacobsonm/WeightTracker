export function isValidTimezone(timezone: string): boolean {
  if (!timezone.trim()) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
