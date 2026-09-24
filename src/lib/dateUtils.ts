/**
 * Safe, Runtime-Robust Date & Time Formatters for ZAKIR
 * Replaces unsafe Intl/toLocale options (e.g. timeStyle) that cause TypeError runtime crashes.
 */

export const safeFormatDate = (dateVal: any, localeOrLang: string = "ar", fallback = "N/A"): string => {
  if (!dateVal) return fallback;
  try {
    let d: Date;
    if (typeof dateVal?.toDate === "function") {
      d = dateVal.toDate();
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return fallback;

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
  if (!dateVal) return fallback;
  try {
    let d: Date;
    if (typeof dateVal?.toDate === "function") {
      d = dateVal.toDate();
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return fallback;

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
      minute: "2-digit"
    });
  } catch {
    return fallback;
  }
};

export const safeFormatTime = (dateVal: any, localeOrLang: string = "ar", fallback = "N/A"): string => {
  if (!dateVal) return fallback;
  try {
    let d: Date;
    if (typeof dateVal?.toDate === "function") {
      d = dateVal.toDate();
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return fallback;

    const loc = localeOrLang === "ar" || localeOrLang === "ar-SA" || localeOrLang === "ar-EG"
      ? "ar-EG"
      : localeOrLang === "fr" || localeOrLang === "fr-FR"
      ? "fr-FR"
      : "en-US";

    return d.toLocaleTimeString(loc, {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return fallback;
  }
};
