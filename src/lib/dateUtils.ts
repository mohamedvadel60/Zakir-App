/**
 * Safe, Runtime-Robust Date & Time Formatters for ZAKIR
 * Replaces unsafe Intl/toLocale options (e.g. timeStyle) that cause TypeError runtime crashes.
 */

/**
 * Normalizes any timestamp value into a valid ISO string or null.
 * Strictly supports:
 * - Firestore Timestamp instance (.toDate())
 * - Serialized Firestore timestamp object ({ seconds, nanoseconds } or { _seconds, _nanoseconds })
 * - ISO string
 * - Unix timestamp in milliseconds or seconds (number or numeric string)
 * - JavaScript Date object
 * Rejects: null, undefined, 0, "0", empty string, "null", "undefined", "Invalid Date"
 */
export function normalizeTimestampToIso(val: any): string | null {
  if (val === null || val === undefined || val === "" || val === 0 || val === "0") {
    return null;
  }
  try {
    if (val instanceof Date) {
      const ms = val.getTime();
      return !isNaN(ms) && ms > 0 ? val.toISOString() : null;
    }
    if (typeof val?.toDate === "function") {
      const d = val.toDate();
      const ms = d?.getTime?.();
      return ms && !isNaN(ms) && ms > 0 ? d.toISOString() : null;
    }
    if (typeof val === "object") {
      const secs = val.seconds ?? val._seconds ?? val.seconds_ ?? val._seconds_;
      const nanos = val.nanoseconds ?? val._nanoseconds ?? 0;
      if (typeof secs === "number" && !isNaN(secs) && secs > 0) {
        const ms = secs * 1000 + Math.floor(nanos / 1000000);
        return new Date(ms).toISOString();
      }
    }
    if (typeof val === "number") {
      if (isNaN(val) || val <= 0) return null;
      const ms = val > 1e11 ? val : val * 1000;
      return new Date(ms).toISOString();
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed || trimmed === "0" || trimmed === "null" || trimmed === "undefined" || trimmed.toLowerCase() === "invalid date") {
        return null;
      }
      if (/^\d+$/.test(trimmed)) {
        const num = Number(trimmed);
        if (isNaN(num) || num <= 0) return null;
        const ms = num > 1e11 ? num : num * 1000;
        return new Date(ms).toISOString();
      }
      const d = new Date(trimmed);
      const ms = d.getTime();
      return !isNaN(ms) && ms > 0 ? d.toISOString() : null;
    }
  } catch {
    return null;
  }
  return null;
}

export const safeFormatDate = (dateVal: any, localeOrLang: string = "ar", fallback = "N/A"): string => {
  const iso = normalizeTimestampToIso(dateVal);
  if (!iso) return fallback;
  try {
    const d = new Date(iso);
    const loc = localeOrLang === "ar" || localeOrLang === "ar-SA" || localeOrLang === "ar-EG"
      ? "ar-EG"
      : localeOrLang === "fr" || localeOrLang === "fr-FR"
      ? "fr-FR"
      : "en-US";

    return d.toLocaleDateString(loc, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return fallback;
  }
};

export const safeFormatDateTime = (dateVal: any, localeOrLang: string = "ar", fallback = "N/A"): string => {
  const iso = normalizeTimestampToIso(dateVal);
  if (!iso) return fallback;
  try {
    const d = new Date(iso);
    const loc = localeOrLang === "ar" || localeOrLang === "ar-SA" || localeOrLang === "ar-EG"
      ? "ar-EG"
      : localeOrLang === "fr" || localeOrLang === "fr-FR"
      ? "fr-FR"
      : "en-US";

    return d.toLocaleString(loc, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return fallback;
  }
};

export const safeFormatTime = (dateVal: any, localeOrLang: string = "ar", fallback = "N/A"): string => {
  const iso = normalizeTimestampToIso(dateVal);
  if (!iso) return fallback;
  try {
    const d = new Date(iso);
    const loc = localeOrLang === "ar" || localeOrLang === "ar-SA" || localeOrLang === "ar-EG"
      ? "ar-EG"
      : localeOrLang === "fr" || localeOrLang === "fr-FR"
      ? "fr-FR"
      : "en-US";

    return d.toLocaleTimeString(loc, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return fallback;
  }
};

/**
 * Format Recovery Request date and time in comprehensive, human-readable localized format.
 * Displays Day of week, Day, Month, Year, Hour, Minute, and Second.
 * If timestamp is missing/invalid, displays unambiguous fallback message without fake zeros.
 */
export function formatRecoveryDateTime(
  dateVal: any,
  lang: "ar" | "fr" | "en" = "ar",
  customFallback?: string
): string {
  const fallback = customFallback || (
    lang === "ar" ? "تاريخ الطلب غير متوفر" : lang === "fr" ? "Date non disponible" : "Date not available"
  );
  const iso = normalizeTimestampToIso(dateVal);
  if (!iso) return fallback;

  try {
    const d = new Date(iso);
    const loc = lang === "ar" ? "ar-EG" : lang === "fr" ? "fr-FR" : "en-US";
    return d.toLocaleString(loc, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  } catch {
    return fallback;
  }
}

