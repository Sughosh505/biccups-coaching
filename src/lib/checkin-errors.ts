/**
 * Check-in failures travel as short codes, not as text.
 *
 * The client screen renders whatever `?error=` holds, so reflecting the raw value
 * would let anyone who can get a client to open a crafted link put arbitrary words
 * in the app's own error styling ("Your account is suspended, call ..."). React
 * escapes the markup, so this is not XSS — but it is a convincing phishing surface
 * on the one screen a client opens every morning. Only known codes render.
 */
export const CHECKIN_ERRORS: Record<string, string> = {
  "bad-date": "That date is not valid.",
  "future-date": "You cannot check in for a future date.",
  "before-start": "That date is before you started coaching.",
  "bad-link": "The workout link must start with http:// or https://",
  "photo-type": "Photos must be JPEG, PNG or WebP.",
  "photo-size": "That photo is too large. Keep it under 5 MB.",
  "upload-failed": "Uploading the photo failed. Please try again.",
  "save-failed": "Saving your check-in failed. Please try again.",
  unlinked: "This login isn't attached to a client record yet. Contact your coach.",
};

export function checkinErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return CHECKIN_ERRORS[code] ?? "Something went wrong. Please try again.";
}
