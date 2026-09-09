export interface PlanPriceDetail {
  plan: "Starter" | "Professional" | "Enterprise";
  monthlyUSD: number;          // Total billed per month on monthly cycle
  annualTotalUSD: number;      // Total billed per year on annual cycle
  annualMonthlyEquivUSD: number; // Monthly equivalent on annual cycle
}

export const PLAN_PRICES: Record<"Starter" | "Professional" | "Enterprise", PlanPriceDetail> = {
  Starter: {
    plan: "Starter",
    monthlyUSD: 6,
    annualTotalUSD: 50,
    annualMonthlyEquivUSD: 4.17
  },
  Professional: {
    plan: "Professional",
    monthlyUSD: 189,
    annualTotalUSD: 1788,
    annualMonthlyEquivUSD: 149
  },
  Enterprise: {
    plan: "Enterprise",
    monthlyUSD: 849,
    annualTotalUSD: 8388,
    annualMonthlyEquivUSD: 699
  }
};

export function getPlanCostUSD(plan: "Starter" | "Professional" | "Enterprise", cycle: "monthly" | "annual"): number {
  const detail = PLAN_PRICES[plan] || PLAN_PRICES.Professional;
  return cycle === "annual" ? detail.annualTotalUSD : detail.monthlyUSD;
}

export function formatPlanPriceUSD(
  plan: "Starter" | "Professional" | "Enterprise",
  cycle: "monthly" | "annual",
  lang: string = "ar"
): string {
  const detail = PLAN_PRICES[plan] || PLAN_PRICES.Professional;
  if (cycle === "annual") {
    const formattedTotal = detail.annualTotalUSD.toLocaleString("en-US");
    return `$${formattedTotal}.00 USD / ${lang === "ar" ? "سنة" : "yr"}`;
  } else {
    return `$${detail.monthlyUSD}.00 USD / ${lang === "ar" ? "شهر" : "mo"}`;
  }
}
