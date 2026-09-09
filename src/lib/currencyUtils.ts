// Local Currency conversion estimate utility based on browser locale and country

export interface CurrencyInfo {
  code: string;
  symbol: string;
  rateToUSD: number; // Units of local currency per 1 USD
  nameAr: string;
  nameEn: string;
}

const CURRENCY_MAP: Record<string, CurrencyInfo> = {
  DZD: { code: "DZD", symbol: "DZD", rateToUSD: 135, nameAr: "دينار جزائري", nameEn: "Algerian Dinar" },
  SAR: { code: "SAR", symbol: "SAR", rateToUSD: 3.75, nameAr: "ريال سعودي", nameEn: "Saudi Riyal" },
  AED: { code: "AED", symbol: "AED", rateToUSD: 3.67, nameAr: "درهم إماراتي", nameEn: "UAE Dirham" },
  EGP: { code: "EGP", symbol: "EGP", rateToUSD: 48.5, nameAr: "جنيه مصري", nameEn: "Egyptian Pound" },
  QAR: { code: "QAR", symbol: "QAR", rateToUSD: 3.64, nameAr: "ريال قطري", nameEn: "Qatari Riyal" },
  KWD: { code: "KWD", symbol: "KWD", rateToUSD: 0.31, nameAr: "دينار كويتي", nameEn: "Kuwaiti Dinar" },
  BHD: { code: "BHD", symbol: "BHD", rateToUSD: 0.377, nameAr: "دينار بحريني", nameEn: "Bahraini Dinar" },
  OMR: { code: "OMR", symbol: "OMR", rateToUSD: 0.385, nameAr: "ريال عماني", nameEn: "Omani Rial" },
  JOD: { code: "JOD", symbol: "JOD", rateToUSD: 0.71, nameAr: "دينار أردني", nameEn: "Jordanian Dinar" },
  MAD: { code: "MAD", symbol: "MAD", rateToUSD: 9.9, nameAr: "درهم مغربي", nameEn: "Moroccan Dirham" },
  TRY: { code: "TRY", symbol: "TRY", rateToUSD: 34.0, nameAr: "ليرة تركية", nameEn: "Turkish Lira" },
  EUR: { code: "EUR", symbol: "€", rateToUSD: 0.92, nameAr: "يورو", nameEn: "Euro" },
  GBP: { code: "GBP", symbol: "£", rateToUSD: 0.78, nameAr: "جنيه إسترليني", nameEn: "British Pound" },
  IQD: { code: "IQD", symbol: "IQD", rateToUSD: 1310, nameAr: "دينار عراقي", nameEn: "Iraqi Dinar" },
  USD: { code: "USD", symbol: "$", rateToUSD: 1.0, nameAr: "دولار أمريكي", nameEn: "US Dollar" }
};

export function detectUserCurrency(): CurrencyInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return CURRENCY_MAP.USD;
  }

  try {
    const locale = navigator.language || "ar-SA";
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";

    if (locale.includes("-SA") || timeZone.includes("Riyadh")) return CURRENCY_MAP.SAR;
    if (locale.includes("-AE") || timeZone.includes("Dubai")) return CURRENCY_MAP.AED;
    if (locale.includes("-DZ") || timeZone.includes("Algiers")) return CURRENCY_MAP.DZD;
    if (locale.includes("-EG") || timeZone.includes("Cairo")) return CURRENCY_MAP.EGP;
    if (locale.includes("-QA") || timeZone.includes("Qatar")) return CURRENCY_MAP.QAR;
    if (locale.includes("-KW") || timeZone.includes("Kuwait")) return CURRENCY_MAP.KWD;
    if (locale.includes("-BH") || timeZone.includes("Bahrain")) return CURRENCY_MAP.BHD;
    if (locale.includes("-OM") || timeZone.includes("Muscat")) return CURRENCY_MAP.OMR;
    if (locale.includes("-JO") || timeZone.includes("Amman")) return CURRENCY_MAP.JOD;
    if (locale.includes("-MA") || timeZone.includes("Casablanca")) return CURRENCY_MAP.MAD;
    if (locale.includes("-TR") || timeZone.includes("Istanbul")) return CURRENCY_MAP.TRY;
    if (locale.includes("-IQ") || timeZone.includes("Baghdad")) return CURRENCY_MAP.IQD;
    if (timeZone.includes("Europe")) return CURRENCY_MAP.EUR;
    if (timeZone.includes("London")) return CURRENCY_MAP.GBP;
  } catch (e) {
    // Fallback safely
  }

  return CURRENCY_MAP.USD;
}

export function formatLocalCurrencyEstimate(amountUSD: number, lang: string = "ar"): string | null {
  const currency = detectUserCurrency();
  if (currency.code === "USD") return null;

  const converted = Math.round(amountUSD * currency.rateToUSD);
  const formattedAmount = converted.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");

  return `≈ ${formattedAmount} ${currency.code}`;
}
