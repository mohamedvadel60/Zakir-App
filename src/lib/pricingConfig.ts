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

export interface PlanLimitDetail {
  plan: "Starter" | "Professional" | "Enterprise";
  maxTeamMembers: number; // Starter: 0, Professional: 5, Enterprise: 15
  allowsTeamInvitations: boolean; // Starter: false, Professional: true, Enterprise: true
}

export const PLAN_LIMITS: Record<"Starter" | "Professional" | "Enterprise", PlanLimitDetail> = {
  Starter: {
    plan: "Starter",
    maxTeamMembers: 0,
    allowsTeamInvitations: false,
  },
  Professional: {
    plan: "Professional",
    maxTeamMembers: 5,
    allowsTeamInvitations: true,
  },
  Enterprise: {
    plan: "Enterprise",
    maxTeamMembers: 15,
    allowsTeamInvitations: true,
  }
};

export function normalizeSubscriptionPlan(plan?: string | null): "Starter" | "Professional" | "Enterprise" {
  if (!plan) return "Starter";
  const p = plan.trim().toUpperCase();
  if (p === "ENTERPRISE") return "Enterprise";
  if (p === "PROFESSIONAL" || p === "PRO") return "Professional";
  return "Starter";
}

export function getPlanLimits(plan?: string | null): PlanLimitDetail {
  const norm = normalizeSubscriptionPlan(plan);
  return PLAN_LIMITS[norm] || PLAN_LIMITS.Starter;
}

export function canPlanInviteMembers(plan?: string | null): boolean {
  return getPlanLimits(plan).allowsTeamInvitations;
}

export function getPlanMaxTeamMembers(plan?: string | null): number {
  return getPlanLimits(plan).maxTeamMembers;
}

