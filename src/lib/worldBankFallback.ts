export interface WorldBankRecord {
  year: number;
  value: number | null;
  country: string;
  indicatorName: string;
}

export const COUNTRY_NAMES_MAP: Record<string, string> = {
  "MR": "Mauritania / موريتانيا",
  "EG": "Egypt / مصر",
  "SA": "Saudi Arabia / السعودية",
  "AE": "UAE / الإمارات",
  "MA": "Morocco / المغرب",
  "DZ": "Algeria / الجزائر",
  "TN": "Tunisia / تونس",
  "LY": "Libya / ليبيا",
  "SD": "Sudan / السودان",
  "IQ": "Iraq / العراق",
  "JO": "Jordan / الأردن",
  "LB": "Lebanon / لبنان",
  "OM": "Oman / عُمان",
  "QA": "Qatar / قطر",
  "KW": "Kuwait / الكويت",
  "BH": "Bahrain / البحرين",
  "YE": "Yemen / اليمن",
  "PS": "Palestine / فلسطين",
  "SY": "Syria / سوريا",
  "SO": "Somalia / الصومال",
  "DJ": "Djibouti / جيبوتي",
  "KM": "Comoros / جزر القمر",
  "WLD": "World / العالم"
};

export const INDICATOR_NAMES_MAP: Record<string, string> = {
  "NY.GDP.MKTP.KD.ZG": "GDP Growth (Annual %)",
  "FP.CPI.TOTL.ZG": "Inflation, consumer prices (Annual %)",
  "SL.UEM.TOTL.ZS": "Unemployment rate (%)",
  "NY.GDP.PCAP.CD": "GDP per capita (Current US$)",
  "BX.KLT.DINV.WD.GD.ZS": "Foreign Direct Investment, net inflows (% of GDP)",
  "NE.EXP.GNFS.ZS": "Exports of goods and services (% of GDP)",
  "NE.IMP.GNFS.ZS": "Imports of goods and services (% of GDP)",
  "NE.GDI.TOTL.ZS": "Gross Capital Formation (% of GDP)",
  "BN.CAB.XOKA.GD.ZS": "Current Account Balance (% of GDP)",
  "GC.XPN.TOTL.GD.ZS": "Government Expenditure (% of GDP)",
  "NE.TRD.GNFS.ZS": "Trade (% of GDP)"
};

export function generateWorldBankFallbackData(
  country: string, 
  indicator: string,
  startYear: number = 2015,
  endYear: number = 2024
): WorldBankRecord[] {
  const minY = Math.max(1960, Math.min(startYear, endYear));
  const maxY = Math.min(2025, Math.max(startYear, endYear));
  const fallbackYears: number[] = [];
  for (let y = minY; y <= maxY; y++) {
    fallbackYears.push(y);
  }

  const cName = COUNTRY_NAMES_MAP[country.toUpperCase()] || country;
  const indName = INDICATOR_NAMES_MAP[indicator] || "Macro Indicator";

  return fallbackYears.map(year => {
    let baseVal = 0;
    if (indicator === "NY.GDP.MKTP.KD.ZG") {
      if (country === "MR") baseVal = year === 2020 ? -0.9 : (year === 2022 ? 5.2 : (year === 2023 ? 4.8 : 3.5));
      else if (country === "EG") baseVal = year === 2020 ? 3.6 : (year === 2022 ? 6.6 : (year === 2023 ? 3.8 : 4.2));
      else if (country === "SA") baseVal = year === 2020 ? -4.1 : (year === 2022 ? 8.7 : (year === 2023 ? -0.8 : 2.5));
      else if (country === "DZ") baseVal = year === 2020 ? -5.1 : (year === 2022 ? 3.2 : (year === 2023 ? 4.1 : 3.8));
      else if (country === "TN") baseVal = year === 2020 ? -8.6 : (year === 2022 ? 2.6 : (year === 2023 ? 0.4 : 1.9));
      else if (country === "LY") baseVal = year === 2020 ? -29.5 : (year === 2021 ? 31.4 : (year === 2023 ? 10.2 : 4.5));
      else baseVal = year === 2020 ? -3.1 : 3.0 + Math.sin(year) * 2;
    } else if (indicator === "FP.CPI.TOTL.ZG") {
      if (country === "MR") baseVal = year === 2022 ? 9.5 : (year === 2023 ? 7.9 : 3.5 + Math.cos(year) * 1.5);
      else if (country === "EG") baseVal = year === 2022 ? 13.9 : (year === 2023 ? 33.9 : 5.0 + Math.abs(Math.sin(year)) * 8);
      else if (country === "SA") baseVal = year === 2020 ? 3.4 : (year === 2022 ? 2.5 : 1.5 + Math.sin(year) * 0.5);
      else if (country === "DZ") baseVal = year === 2022 ? 9.3 : (year === 2023 ? 9.3 : 4.5 + Math.sin(year));
      else if (country === "TN") baseVal = year === 2022 ? 8.3 : (year === 2023 ? 9.3 : 5.1 + Math.cos(year));
      else baseVal = 2.0 + Math.abs(Math.sin(year)) * 4;
    } else if (indicator === "SL.UEM.TOTL.ZS") {
      if (country === "MR") baseVal = 10.2 + Math.cos(year) * 0.4;
      else if (country === "EG") baseVal = 7.2 + Math.sin(year) * 0.8;
      else if (country === "SA") baseVal = 5.6 + Math.cos(year) * 1.1;
      else if (country === "DZ") baseVal = 11.8 + Math.sin(year) * 0.5;
      else if (country === "TN") baseVal = 15.3 + Math.cos(year) * 0.7;
      else baseVal = 6.0 + Math.sin(year) * 1.0;
    } else if (indicator === "BX.KLT.DINV.WD.GD.ZS") {
      baseVal = 2.1 + Math.sin(year * 0.8) * 1.4;
    } else if (indicator === "NE.EXP.GNFS.ZS") {
      baseVal = 32.5 + Math.cos(year * 0.5) * 8.2;
    } else if (indicator === "NE.IMP.GNFS.ZS") {
      baseVal = 38.0 + Math.sin(year * 0.5) * 6.5;
    } else if (indicator === "NE.GDI.TOTL.ZS") {
      baseVal = 24.5 + Math.sin(year) * 3.2;
    } else if (indicator === "BN.CAB.XOKA.GD.ZS") {
      baseVal = -2.5 + Math.cos(year) * 4.5;
    } else if (indicator === "GC.XPN.TOTL.GD.ZS") {
      baseVal = 28.0 + Math.sin(year) * 2.5;
    } else if (indicator === "NE.TRD.GNFS.ZS") {
      baseVal = 68.5 + Math.cos(year) * 12.0;
    } else {
      if (country === "MR") baseVal = 1800 + (year - 2015) * 85;
      else if (country === "EG") baseVal = 3500 + (year - 2015) * 120;
      else if (country === "SA") baseVal = 21000 + (year - 2015) * 800;
      else if (country === "DZ") baseVal = 3900 + (year - 2015) * 110;
      else if (country === "TN") baseVal = 3700 + (year - 2015) * 90;
      else baseVal = 12000 + (year - 2015) * 400;
    }

    return {
      year,
      value: parseFloat(baseVal.toFixed(2)),
      country: cName,
      indicatorName: indName
    };
  });
}

function getEnvVar(key: string): string {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[key] || '';
    }
  } catch {
    // Ignore error in non-ESM
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || '';
  }
  return '';
}

const envBaseUrl = getEnvVar('VITE_API_BASE_URL') || getEnvVar('VITE_BACKEND_URL') || '';

export const WORLD_BANK_API_BASE_URL = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' ? '' : envBaseUrl;

export async function fetchWorldBankProxyApi(
  countryCode: string, 
  indicatorCode: string, 
  startYear: number, 
  endYear: number
) {
  const customBase = getEnvVar('VITE_API_BASE_URL') || getEnvVar('VITE_BACKEND_URL') || '';
  const baseUrl = customBase ? customBase.replace(/\/$/, '') : WORLD_BANK_API_BASE_URL;
  const primaryUrl = baseUrl 
    ? `${baseUrl}/api/world-bank?country=${countryCode}&indicator=${indicatorCode}&startYear=${startYear}&endYear=${endYear}`
    : `/api/world-bank?country=${countryCode}&indicator=${indicatorCode}&startYear=${startYear}&endYear=${endYear}`;
  
  let res: Response | null = null;
  try {
    res = await fetch(primaryUrl);
  } catch (err) {
    console.warn("[WorldBank API Service] Fetching from primary Vercel proxy failed, trying relative proxy path:", err);
    try {
      res = await fetch(`/api/world-bank?country=${countryCode}&indicator=${indicatorCode}&startYear=${startYear}&endYear=${endYear}`);
    } catch (relErr) {
      console.warn("[WorldBank API Service] Relative proxy fetch failed:", relErr);
    }
  }
  return res;
}
