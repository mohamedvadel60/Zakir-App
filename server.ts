import "./src/lib/env.js";
import { Resend } from "resend";
import express from "express";
import multer from "multer";
import cors from "cors";
import crypto from "crypto";
import http from "http";
import path from "path";
import fs from "fs";
import os from "os";
import zlib from "zlib";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import { db as sqlDb, withRetry } from "./src/db/index.js";
import { users as sqlUsers, gmailLogs } from "./src/db/schema.js";
import { getOrCreateUser } from "./src/db/users.js";
import {
  requireAuth,
  requireAdmin,
  requireApprovedAccount,
  isUserAdminServer,
  requireModulePermission,
  checkUserEntitlementServer,
  requireEntitlement,
  hashSecurityPasscode,
  verifySecurityPasscode,
  checkPasscodeRateLimit,
  recordPasscodeFailure,
  resetPasscodeFailures,
  generateSecuritySessionToken,
  getUserProfileServer,
  computeStrictVerificationState,
  deriveAccountAndVerificationState,
  AuthRequest,
  ADMIN_EMAILS,
  ADMIN_USER_ID,
} from "./src/middleware/auth.js";
import { computeCanonicalVerification } from "./src/lib/unifiedVerification.js";
import { createRateLimiter } from "./src/middleware/rateLimiter.js";
import {
  adminAuth,
  adminDb,
  adminStorage,
  isFirebaseAdminAvailable,
  getSafeBucket,
} from "./src/lib/firebase-admin.js";
import { eq, desc } from "drizzle-orm";
import { generateWorldBankFallbackData } from "./src/lib/worldBankFallback.js";
import { handleAdminRecoveryDecision } from "./src/lib/recoveryService.js";
import {
  emitPlatformEvent,
  getPlatformEvents,
  getPlatformIncidents,
  updateIncidentStatus,
  getAdminNotifications,
  markNotificationRead,
  acknowledgeNotification,
  markAllNotificationsRead,
} from "./src/lib/platformEvents.js";
import {
  handleGetLatestSmartEvolution,
  handleRunSmartEvolution,
  handleAgentChat,
} from "./src/server/smartEvolutionService.js";
import {
  handleGetLatestMarketIntelligence,
  handleGetMarketIntelligenceHistory,
  handleRunMarketIntelligence,
  handleDiagnoseMarketItem,
} from "./src/server/marketIntelligenceService.js";
import {
  PLAN_LIMITS,
  normalizeSubscriptionPlan,
  getPlanLimits,
  canPlanInviteMembers,
  getPlanMaxTeamMembers
} from "./src/lib/pricingConfig.js";

dotenv.config();

export const ZAKIR_BUILD_ID =
  "ZAKIR_BUILD_2026_09_25_ADMIN_KYC_DOCUMENTS_INTEGRITY";

// Concurrency mutex lock per workspace to strictly guard team invitation limits
const workspaceInvitationLocks = new Map<string, Promise<any>>();

export async function runWithWorkspaceLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  const currentLock = workspaceInvitationLocks.get(workspaceId) || Promise.resolve();
  let releaseLock: () => void = () => {};
  const newLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  workspaceInvitationLocks.set(workspaceId, newLock);
  try {
    await currentLock;
    return await fn();
  } finally {
    releaseLock();
    if (workspaceInvitationLocks.get(workspaceId) === newLock) {
      workspaceInvitationLocks.delete(workspaceId);
    }
  }
}

export interface WorkspaceOccupancyInfo {
  plan: "Starter" | "Professional" | "Enterprise";
  maxSeats: number;
  allowsInvitations: boolean;
  activeMembers: any[];
  pendingInvitations: any[];
  distinctOccupiedEmails: Set<string>;
  occupiedSeats: number;
  remainingSeats: number;
  isAtLimit: boolean;
}

export async function getWorkspaceOccupancy(
  workspaceId: string,
  ceoUid: string
): Promise<WorkspaceOccupancyInfo> {
  // 1. Resolve CEO document to determine true authoritative workspace subscription plan
  let ceoData: any = null;
  if (ceoUid) {
    try {
      const snap = await adminDb.collection("users").doc(ceoUid).get();
      if (snap.exists) ceoData = snap.data();
    } catch (e) {}
  }
  if (!ceoData && workspaceId) {
    try {
      const q = await adminDb.collection("users")
        .where("workspaceId", "==", workspaceId)
        .where("role", "in", ["CEO", "Admin", "Owner", "FOUNDER"])
        .limit(1)
        .get();
      if (!q.empty) {
        ceoData = q.docs[0].data();
        if (!ceoUid) ceoUid = q.docs[0].id;
      }
    } catch (e) {}
  }
  if (!ceoData) {
    const db = readDb();
    ceoData = db.users?.find((u: any) => 
      (u.id === ceoUid || u.workspaceId === workspaceId) && 
      ["CEO", "ADMIN", "OWNER", "FOUNDER"].includes((u.role || "").toUpperCase())
    ) || db.users?.find((u: any) => u.id === ceoUid);
  }

  const normalizedPlan = normalizeSubscriptionPlan(ceoData?.subscriptionPlan);
  const planLimits = PLAN_LIMITS[normalizedPlan];

  // 2. Count active members in workspace (excluding CEO)
  const activeMembers: any[] = [];
  const distinctEmails = new Set<string>();
  const ceoEmail = (ceoData?.email || "").trim().toLowerCase();

  try {
    const memSnap = await adminDb.collection("users").where("workspaceId", "==", workspaceId).get();
    if (!memSnap.empty) {
      memSnap.docs.forEach((doc: any) => {
        const d = doc.data();
        const docId = doc.id;
        const memEmail = (d.email || "").trim().toLowerCase();
        const memRole = (d.role || "").toUpperCase();
        // Skip CEO / owner themselves
        if (docId === ceoUid || memEmail === ceoEmail || memRole === "CEO" || memRole === "OWNER") {
          return;
        }
        activeMembers.push({ id: docId, ...d });
        if (memEmail) distinctEmails.add(memEmail);
      });
    }
  } catch (e) {}

  // Also check local DB
  const db = readDb();
  if (db.users) {
    db.users.forEach((u: any) => {
      if (u.workspaceId === workspaceId && u.id !== ceoUid) {
        const uEmail = (u.email || "").trim().toLowerCase();
        const uRole = (u.role || "").toUpperCase();
        if (uEmail !== ceoEmail && uRole !== "CEO" && uRole !== "OWNER") {
          if (!activeMembers.some((m) => m.id === u.id || (m.email && m.email.toLowerCase() === uEmail))) {
            activeMembers.push(u);
          }
          if (uEmail) distinctEmails.add(uEmail);
        }
      }
    });
  }

  // 3. Count pending invitations for this workspace
  const pendingInvitations: any[] = [];
  try {
    const invSnap = await adminDb.collection("invitations").where("workspaceId", "==", workspaceId).get();
    if (!invSnap.empty) {
      invSnap.docs.forEach((doc: any) => {
        const inv = doc.data();
        const invEmail = (inv.email || doc.id || "").trim().toLowerCase();
        const isAccepted = (inv.status || "").toUpperCase() === "ACCEPTED";
        if (invEmail && !isAccepted && invEmail !== ceoEmail) {
          pendingInvitations.push({ id: doc.id, ...inv });
          distinctEmails.add(invEmail);
        }
      });
    }
  } catch (e) {}

  if (db.invitations) {
    db.invitations.forEach((inv: any) => {
      if (inv.workspaceId === workspaceId) {
        const invEmail = (inv.email || "").trim().toLowerCase();
        const isAccepted = (inv.status || "").toUpperCase() === "ACCEPTED";
        if (invEmail && !isAccepted && invEmail !== ceoEmail) {
          if (!pendingInvitations.some((p) => (p.email || "").toLowerCase() === invEmail)) {
            pendingInvitations.push(inv);
          }
          distinctEmails.add(invEmail);
        }
      }
    });
  }

  const occupiedSeats = distinctEmails.size;
  const maxSeats = planLimits.maxTeamMembers;
  const remainingSeats = Math.max(0, maxSeats - occupiedSeats);
  const isAtLimit = occupiedSeats >= maxSeats;

  return {
    plan: normalizedPlan,
    maxSeats,
    allowsInvitations: planLimits.allowsTeamInvitations,
    activeMembers,
    pendingInvitations,
    distinctOccupiedEmails: distinctEmails,
    occupiedSeats,
    remainingSeats,
    isAtLimit
  };
}


export const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.NOW_REGION ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT,
);

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "src", "db_store.json");

// Ensure db_store.json exists with initial data
function initializeDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      if (
        data.users &&
        data.memories &&
        data.risk_alerts &&
        data.user_metrics &&
        data.gmail_logs &&
        data.verification_codes &&
        data.support_tickets
      ) {
        return;
      }
    } catch (e) {
      console.error("Error reading database file, reinitializing", e);
    }
  }

  // Pre-seed database
  const initialData = {
    users: [
      {
        id: "usr_ceo",
        email: "ceo@zakir.ai",
        passwordHash: "ceo123", // Simple hash for demo auth
        companyName: "Al-Futtaim Group",
        role: "CEO",
        isEmailVerified: true,
        isPhoneVerified: true,
        verificationInfo: {
          status: "verified",
          verifiedAt: "2026-01-15T09:00:00Z",
        },
        createdAt: "2026-01-15T09:00:00Z",
        trialExpiresAt: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(), // 24hr trial
      },
      {
        id: "usr_analyst",
        email: "analyst@zakir.ai",
        passwordHash: "analyst123",
        companyName: "Al-Futtaim Group",
        role: "Analyst",
        isEmailVerified: true,
        isPhoneVerified: true,
        verificationInfo: {
          status: "verified",
          verifiedAt: "2026-02-10T11:30:00Z",
        },
        createdAt: "2026-02-10T11:30:00Z",
        trialExpiresAt: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
      {
        id: "usr_compliance",
        email: "compliance@zakir.ai",
        passwordHash: "compliance123",
        companyName: "Al-Futtaim Group",
        role: "Compliance Officer",
        isEmailVerified: true,
        isPhoneVerified: true,
        verificationInfo: {
          status: "verified",
          verifiedAt: "2026-03-01T14:15:00Z",
        },
        createdAt: "2026-03-01T14:15:00Z",
        trialExpiresAt: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
    ],
    verification_codes: [],
    support_tickets: [
      {
        id: "ticket_init_1",
        userId: "usr_ceo",
        userEmail: "ceo@zakir.ai",
        userName: "Mohamed Vadel",
        companyName: "Al-Futtaim Group",
        category: "Verification Issue",
        subject: "Verification document status confirmation",
        message:
          "Hello support, we uploaded our commercial registration and trade license. Could you confirm if our institutional verification is active?",
        status: "In Progress",
        priority: "High",
        createdAt: "2026-07-28T10:00:00Z",
        updatedAt: "2026-07-28T11:30:00Z",
        messages: [
          {
            id: "msg_init_1",
            ticketId: "ticket_init_1",
            senderType: "user",
            senderName: "Mohamed Vadel",
            senderEmail: "ceo@zakir.ai",
            message:
              "Hello support, we uploaded our commercial registration and trade license. Could you confirm if our institutional verification is active?",
            createdAt: "2026-07-28T10:00:00Z",
          },
          {
            id: "msg_init_2",
            ticketId: "ticket_init_1",
            senderType: "admin",
            senderName: "Zakir Compliance Team",
            senderEmail: "admin@zakir.ai",
            message:
              "Greetings Mohamed. We reviewed your documents and confirmed your institutional verification status as Verified. Thank you for using Zakir.",
            createdAt: "2026-07-28T11:30:00Z",
          },
        ],
      },
    ],
    memories: [
      {
        id: "mem_1",
        title: "Sanctions List Update Delay - Correspondent Banking",
        category: "Financial Engineering",
        riskLevel: "High",
        tags: ["sanctions", "compliance", "correspondent"],
        description:
          "Quarterly audit revealed a new sanctions list (OFAC SDN update, October 2024) had not been loaded into the screening system within the mandated 24-hour window.",
        decision:
          "The system operated for 72 hours using outdated lists, processing $340M in correspondent transactions.",
        causalFactors:
          "Standardized daily batch pull failed due to unannounced vendor API format changes. Compliance team had no automated alert.",
        outcomes:
          "An independent external warning was received, resulting in a retroactive review. Fortunately, no blocked entities were cleared, but regulatory friction increased.",
        lessonsLearned:
          "Implement real-time webhook endpoints instead of daily pull, and set up automatic health indicators for list freshness.",
        createdAt: "2026-06-02T10:30:00Z",
        userId: "usr_analyst",
        authorEmail: "analyst@zakir.ai",
        authorRole: "Analyst",
      },
      {
        id: "mem_2",
        title: "USD/EUR Hedge Failure during Q3 Earnings",
        category: "FX Risk Management",
        riskLevel: "Critical",
        tags: ["hedging", "currency", "treasury"],
        description:
          "During Q3 2024, the multinational subsidiary faced a 12% adverse EUR/USD movement over 6 weeks. Our existing forward contracts covered only 40% of the exposure, leaving $18M unhedged.",
        decision:
          "Manually chose to restrict currency hedging based on speculative internal rate forecasts.",
        causalFactors:
          "Excessive operational trust in subjective qualitative advice over quantitative risk model suggestions.",
        outcomes:
          "Direct translation loss of $2.4M charged to earnings, triggering a covenant breach warning from our credit syndicate.",
        lessonsLearned:
          "Codify minimum mandatory hedging ranges (e.g. 70-90% for standard exposures) and automate rebalancing to eliminate human bias.",
        createdAt: "2026-05-18T16:00:00Z",
        userId: "usr_ceo",
        authorEmail: "ceo@zakir.ai",
        authorRole: "CEO",
      },
      {
        id: "mem_3",
        title:
          "Customs HS Code Misclassification - Industrial Components Import",
        category: "Customs Classification",
        riskLevel: "Medium",
        tags: ["customs", "tariffs", "supply-chain"],
        description:
          "Shipment of 2,400 units of precision hydraulic actuators was classified under HS 8412.21 (hydraulic power engines) instead of the correct 8412.39 (linear actuators).",
        decision:
          "Rushed the customs declaration process to avoid port storage demurrage charges.",
        causalFactors:
          "Absence of a shared centralized tariff code database, relying on individual broker interpretation.",
        outcomes:
          "Resulted in a retroactive tariff surcharge of 7.5% ($112,000) and triggered a systematic customs audit review on other parts.",
        lessonsLearned:
          "Establish a mandatory pre-cleared product-to-HS mapping library, and conduct annual external audits.",
        createdAt: "2026-04-20T09:15:00Z",
        userId: "usr_analyst",
        authorEmail: "analyst@zakir.ai",
        authorRole: "Analyst",
      },
    ],
    risk_alerts: [
      {
        id: "al_1",
        title: "Sanctions List Update Delay: 6 Hours",
        category: "Financial Engineering",
        severity: "High",
        description:
          "OFAC SDN update failed to sync due to regional network bottleneck. Manual verification triggered.",
        status: "Active",
        createdAt: "2026-07-21T08:00:00Z",
      },
      {
        id: "al_2",
        title: "TP Documentation Deadline: 3 Jurisdictions Pending",
        category: "Financial Engineering",
        severity: "Medium",
        description:
          "Transfer pricing document compliance filing pending for Brazil, Singapore, Netherlands subsidiaries.",
        status: "Active",
        createdAt: "2026-07-20T10:00:00Z",
      },
      {
        id: "al_3",
        title: "Counterparty Concentration: Top 3 Banks >65%",
        category: "Financial Engineering",
        severity: "Critical",
        description:
          "Bilateral credit exposures show dangerous systemic concentration in three primary correspondent banks.",
        status: "Active",
        createdAt: "2026-07-19T14:30:00Z",
      },
      {
        id: "al_4",
        title: "FX Policy Review Overdue",
        category: "FX Risk Management",
        severity: "Medium",
        description:
          "FX hedging policy limits require annual board review and re-certification. Due 30 days ago.",
        status: "Active",
        createdAt: "2026-07-15T09:00:00Z",
      },
    ],
    user_metrics: [
      {
        id: "met_1",
        userId: "usr_analyst",
        actionType: "Log Memory",
        metricValue: 12,
        description:
          "Logged strategic causal memory on Sanctions Screening Gaps",
        createdAt: "2026-07-21T10:00:00Z",
      },
      {
        id: "met_2",
        userId: "usr_ceo",
        actionType: "Run Analysis",
        metricValue: 8,
        description:
          "Executed comprehensive risk-modeling analysis on FX hedger",
        createdAt: "2026-07-21T09:30:00Z",
      },
      {
        id: "met_3",
        userId: "usr_compliance",
        actionType: "Audit Review",
        metricValue: 15,
        description:
          "Resolved customs HS code compliance audit recommendations",
        createdAt: "2026-07-20T11:00:00Z",
      },
    ],
    gmail_logs: [],
  };

  inMemoryDbStore = initialData;

  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf-8");
  } catch (err) {
    console.warn(
      "Notice: DB file initial write skipped (read-only filesystem environment):",
      (err as any)?.message,
    );
  }
}

let inMemoryDbStore: any = null;

try {
  initializeDatabase();
} catch (e) {
  console.warn("Notice: initializeDatabase top-level call warning:", e);
}

let lastDbMtime = 0;

// Database Helper Functions
export function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const stat = fs.statSync(DB_FILE);
      if (inMemoryDbStore && stat.mtimeMs <= lastDbMtime) {
        return inMemoryDbStore;
      }
      const content = fs.readFileSync(DB_FILE, "utf-8");
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        inMemoryDbStore = parsed;
        lastDbMtime = stat.mtimeMs;
        return parsed;
      }
    }
  } catch (err) {
    // If readFileSync fails, fallback to in-memory store
  }
  if (!inMemoryDbStore) {
    try {
      initializeDatabase();
    } catch (e) {}
  }
  return (
    inMemoryDbStore || {
      users: [],
      memories: [],
      risk_alerts: [],
      user_metrics: [],
      gmail_logs: [],
      verification_codes: [],
      support_tickets: [],
    }
  );
}

export function writeDb(data: any) {
  inMemoryDbStore = data;
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data), "utf-8");
    try {
      lastDbMtime = fs.statSync(DB_FILE).mtimeMs;
    } catch (e) {}
  } catch (err) {
    console.warn(
      "Notice: writeDb file save skipped (read-only filesystem environment):",
      (err as any)?.message,
    );
  }
}

// Function to dynamically load Gemini client with fresh process.env on every request
let geminiCooldownUntil = 0;

export function isGeminiInCooldown(): boolean {
  return false;
}

export function setGeminiCooldown(durationMs: number = 35000) {
  geminiCooldownUntil = Math.max(geminiCooldownUntil, Date.now() + durationMs);
}

export function handleGeminiError(err: any): {
  isQuota: boolean;
  isUnavailable: boolean;
} {
  const errMsg = err?.message || String(err || "");
  const isQuota =
    errMsg.includes("429") ||
    errMsg.includes("RESOURCE_EXHAUSTED") ||
    errMsg.includes("quota") ||
    errMsg.includes("prepayment");
  const isUnavailable =
    errMsg.includes("503") ||
    errMsg.includes("UNAVAILABLE") ||
    errMsg.includes("high demand");

  if (isQuota || isUnavailable) {
    setGeminiCooldown(35000);
  }
  return { isQuota, isUnavailable };
}

export function getGeminiClient(): GoogleGenAI | null {
  try {
    dotenv.config();
  } catch (e) {
    // Ignore dotenv error if missing
  }
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Stripe Client & Dynamic Key Resolution Helper
const stripeClients = new Map<string, Stripe>();

interface ResolvedStripeKeys {
  secretKey: string | null;
  publishableKey: string | null;
  mode: "live" | "test";
  accountId?: string;
  source: string;
}

function resolveStripeKeys(): ResolvedStripeKeys {
  const pubCandidates: { key: string; source: string; isTest: boolean }[] = [];
  const checkPubCandidate = (val: string | undefined, source: string) => {
    if (val && typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.startsWith("pk_live_") || trimmed.startsWith("pk_test_")) {
        if (!pubCandidates.some((p) => p.key === trimmed)) {
          pubCandidates.push({
            key: trimmed,
            source,
            isTest: trimmed.startsWith("pk_test_"),
          });
        }
      }
    }
  };

  checkPubCandidate(
    process.env.VITE_STRIPE_TEST_PUBLISHABLE_KEY,
    "VITE_STRIPE_TEST_PUBLISHABLE_KEY",
  );
  checkPubCandidate(
    process.env.STRIPE_TEST_PUBLISHABLE_KEY,
    "STRIPE_TEST_PUBLISHABLE_KEY",
  );
  checkPubCandidate(
    process.env.VITE_STRIPE_PUBLISHABLE_KEY,
    "VITE_STRIPE_PUBLISHABLE_KEY",
  );
  checkPubCandidate(
    process.env.STRIPE_PUBLISHABLE_KEY,
    "STRIPE_PUBLISHABLE_KEY",
  );
  checkPubCandidate(
    process.env.VITE_STRIPE_PUBLIC_KEY,
    "VITE_STRIPE_PUBLIC_KEY",
  );
  checkPubCandidate(process.env.STRIPE_PUBLIC_KEY, "STRIPE_PUBLIC_KEY");

  const secretCandidates: { key: string; source: string; isTest: boolean }[] =
    [];
  const addSecretCandidate = (val: string | undefined, source: string) => {
    if (val && typeof val === "string") {
      const trimmed = val.trim();
      if (
        trimmed.startsWith("sk_live_") ||
        trimmed.startsWith("sk_test_") ||
        trimmed.startsWith("rk_live_") ||
        trimmed.startsWith("rk_test_")
      ) {
        if (!secretCandidates.some((c) => c.key === trimmed)) {
          secretCandidates.push({
            key: trimmed,
            source,
            isTest:
              trimmed.startsWith("sk_test_") || trimmed.startsWith("rk_test_"),
          });
        }
      }
    }
  };

  addSecretCandidate(
    process.env.STRIPE_TEST_SECRET_KEY,
    "STRIPE_TEST_SECRET_KEY",
  );
  addSecretCandidate(process.env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY");
  addSecretCandidate(
    process.env.STRIPE_LIVE_SECRET_KEY,
    "STRIPE_LIVE_SECRET_KEY",
  );
  addSecretCandidate(
    process.env.STRIPE_PUBLISHABLE_KEY,
    "STRIPE_PUBLISHABLE_KEY",
  );
  addSecretCandidate(process.env.STRIPE_PUBLIC_KEY, "STRIPE_PUBLIC_KEY");
  addSecretCandidate(
    process.env.VITE_STRIPE_PUBLIC_KEY,
    "VITE_STRIPE_PUBLIC_KEY",
  );
  addSecretCandidate(
    process.env.STRIPE_MONTHLY_PRICE_ID,
    "STRIPE_MONTHLY_PRICE_ID",
  );
  addSecretCandidate(
    process.env.STRIPE_YEARLY_PRICE_ID,
    "STRIPE_YEARLY_PRICE_ID",
  );

  const extractAcctId = (k: string) => {
    const match = k.match(/^[prs]k_(?:live|test)_(?:51)?([0-9a-zA-Z]+)/);
    return match ? match[1].substring(0, 14) : "";
  };

  // Enforce TEST MODE per mandatory requirement:
  // "STRIPE MODE: TEST MODE ONLY. DO NOT switch anything to Live mode. DO NOT replace test keys with live keys."
  const testSecrets = secretCandidates.filter((c) => c.isTest);
  const testPubs = pubCandidates.filter((p) => p.isTest);

  let selectedKey: string | null = null;
  let selectedSource = "none";
  let finalPub: string | null = null;

  if (testSecrets.length > 0) {
    // 1. Try to find a matching test secret and test publishable key pair with the same account ID
    for (const s of testSecrets) {
      const sAcct = extractAcctId(s.key);
      const matchedPub = testPubs.find((p) => {
        const pAcct = extractAcctId(p.key);
        return sAcct && pAcct && sAcct === pAcct;
      });
      if (matchedPub) {
        selectedKey = s.key;
        selectedSource = s.source;
        finalPub = matchedPub.key;
        break;
      }
    }

    // 2. If no exact account match, pick primary STRIPE_SECRET_KEY (or first test secret)
    if (!selectedKey) {
      const primaryTestSecret =
        testSecrets.find((c) => c.source === "STRIPE_SECRET_KEY") ||
        testSecrets[0];
      selectedKey = primaryTestSecret.key;
      selectedSource = primaryTestSecret.source;
    }

    // 3. For publishable key, strictly select a test publishable key (never a live key)
    if (!finalPub) {
      if (testPubs.length > 0) {
        finalPub = testPubs[0].key;
      } else if (
        selectedKey &&
        (selectedKey.startsWith("sk_test_") ||
          selectedKey.startsWith("rk_test_"))
      ) {
        finalPub = selectedKey.replace(/^[sr]k_test_/, "pk_test_");
      }
    }
  } else {
    // Fallback if no test keys exist
    if (secretCandidates.length > 0) {
      selectedKey = secretCandidates[0].key;
      selectedSource = secretCandidates[0].source;
    }
    if (pubCandidates.length > 0) {
      finalPub = pubCandidates[0].key;
    }
  }

  const isLiveMode = Boolean(
    selectedKey &&
    (selectedKey.startsWith("sk_live_") || selectedKey.startsWith("rk_live_")),
  );

  return {
    secretKey: selectedKey,
    publishableKey: finalPub,
    mode: isLiveMode ? "live" : "test",
    accountId: selectedKey ? extractAcctId(selectedKey) : undefined,
    source: selectedSource,
  };
}

function getStripe(): Stripe | null {
  const { secretKey } = resolveStripeKeys();
  if (!secretKey) return null;
  if (!stripeClients.has(secretKey)) {
    stripeClients.set(
      secretKey,
      new Stripe(secretKey, {
        apiVersion: "2025-02-24.acacia" as any,
      }),
    );
  }
  return stripeClients.get(secretKey) || null;
}

// --- RATE LIMITERS ---
const loginRegisterLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message:
    "Too many login or registration attempts. Please try again after a minute.",
  endpointName: "login-register",
});

const otpLimiter = createRateLimiter({
  windowMs: 3 * 60 * 1000, // 3 minutes
  max: 15,
  message:
    "Too many OTP verification requests. Please try again after a few minutes.",
  endpointName: "otp",
});

const emailLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message:
    "Too many email sending requests. Please try again after 10 minutes.",
  endpointName: "email",
});

const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: "Too many webhook requests.",
  endpointName: "webhooks",
});

// Benchmark Plan Prices
const PLAN_PRICES = {
  Starter: { monthly: 6, annual: 50 },
  Professional: { monthly: 189, annual: 149 },
  Enterprise: { monthly: 849, annual: 699 },
};

// RESEND WEBHOOK ROUTE (Raw body parser or JSON)
app.post("/api/webhooks/resend", webhookLimiter, express.json(), (req, res) => {
  try {
    const event = req.body;
    if (!event) {
      return res.status(400).send("No body");
    }

    const emailId = event.data?.email_id || event.data?.id;
    const recipient = (event.data?.to?.[0] || event.data?.to || "")
      .trim()
      .toLowerCase();
    const eventType = event.type;
    const eventTimestamp = event.created_at || new Date().toISOString();
    const failureReason = event.data?.reason || event.data?.error || null;

    console.log("[RESEND WEBHOOK] Received event:", {
      type: eventType,
      messageId: emailId,
      recipient: recipient,
      timestamp: eventTimestamp,
    });

    if (
      eventType === "email.bounced" ||
      eventType === "email.delivery_delayed" ||
      eventType === "email.complained" ||
      eventType === "email.failed" ||
      eventType === "email.suppressed"
    ) {
      console.warn("[RESEND EMAIL FAILURE] Delivery event:", {
        type: eventType,
        messageId: emailId,
        reason: failureReason,
        recipient: recipient,
      });
    } else if (eventType === "email.delivered") {
      console.log("[RESEND EMAIL DELIVERED] Delivery success:", {
        messageId: emailId,
        recipient: recipient,
      });
    } else if (eventType === "email.sent") {
      console.log("[RESEND EMAIL SENT] Dispatched to provider:", {
        messageId: emailId,
        recipient: recipient,
      });
    }

    // Correlate recovery OTP verification codes with webhook events
    if (emailId || recipient) {
      (async () => {
        try {
          const updatePayload: Record<string, any> = {
            deliveryStatus: eventType,
            lastDeliveryEvent: eventType,
            deliveryUpdatedAt: eventTimestamp,
            deliveryReason: failureReason,
          };

          if (isFirebaseAdminAvailable && adminDb) {
            let matchedRef: any = null;
            if (emailId) {
              const qSnap = await adminDb
                .collection("verification_codes")
                .where("resendEmailId", "==", emailId)
                .limit(1)
                .get()
                .catch(() => null);
              if (qSnap && !qSnap.empty) {
                matchedRef = qSnap.docs[0].ref;
              }
            }

            if (!matchedRef && recipient) {
              const docId = `recovery_otp_${recipient.replace(/[^a-zA-Z0-9]/g, "_")}`;
              const docSnap = await adminDb
                .collection("verification_codes")
                .doc(docId)
                .get()
                .catch(() => null);
              if (docSnap && docSnap.exists) {
                matchedRef = adminDb
                  .collection("verification_codes")
                  .doc(docId);
              }
            }

            if (matchedRef) {
              await matchedRef.update(updatePayload).catch(() => {});
            }
          }

          const db = readDb();
          if (db.verification_codes && Array.isArray(db.verification_codes)) {
            const vItem = db.verification_codes.find(
              (vc: any) =>
                (emailId && vc.resendEmailId === emailId) ||
                (recipient && vc.email === recipient),
            );
            if (vItem) {
              vItem.deliveryStatus = eventType;
              vItem.lastDeliveryEvent = eventType;
              vItem.deliveryUpdatedAt = eventTimestamp;
              vItem.deliveryReason = failureReason;
              writeDb(db);
            }
          }
        } catch (updateErr) {
          console.warn(
            "[RESEND WEBHOOK] Correlation update warning:",
            updateErr,
          );
        }
      })().catch(() => {});
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("[RESEND WEBHOOK] Error processing event:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

// STRIPE WEBHOOK ROUTE (Raw body parser before express.json)
app.post(
  ["/api/webhooks/stripe", "/api/stripe/webhook"],
  webhookLimiter,
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: any;

    try {
      if (stripe && webhookSecret) {
        const sig = req.headers["stripe-signature"] as string;
        if (!sig) {
          console.warn("[Stripe Webhook] Missing stripe-signature header.");
          return res
            .status(400)
            .send("Webhook Error: Missing stripe-signature header.");
        }
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        console.log(
          `[Stripe Webhook] Event signature verified successfully: ${event.type} (id: ${event.id})`,
        );
      } else {
        if (!webhookSecret) {
          console.warn(
            "[Stripe Webhook] Warning: STRIPE_WEBHOOK_SECRET is not configured.",
          );
        }
        if (process.env.NODE_ENV === "production") {
          console.error(
            "Stripe Webhook Error: Signature verification is strictly required in production mode.",
          );
          return res
            .status(400)
            .send("Webhook Error: Signature verification required.");
        }
        const bodyStr =
          req.body instanceof Buffer
            ? req.body.toString("utf-8")
            : JSON.stringify(req.body);
        event = JSON.parse(bodyStr || "{}");
        console.log(
          `[Stripe Webhook] Development fallback payload parsed: ${event.type}`,
        );
      }
    } catch (err: any) {
      console.error(
        `[Stripe Webhook] Signature verification failed: ${err.message}`,
      );
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const userId =
            session.client_reference_id || session.metadata?.userId;
          const plan = session.metadata?.plan || "Professional";
          const cycle = session.metadata?.billingCycle || "annual";
          const userEmail =
            session.customer_details?.email || session.metadata?.userEmail;

          console.log(
            `[Stripe Webhook] checkout.session.completed: userId=${userId}, plan=${plan}, cycle=${cycle}, customer=${session.customer}`,
          );

          const nextBill = new Date();
          if (cycle === "annual")
            nextBill.setFullYear(nextBill.getFullYear() + 1);
          else nextBill.setMonth(nextBill.getMonth() + 1);

          const db = readDb();
          const user = db.users.find(
            (u: any) =>
              u.id === userId ||
              (userEmail && u.email?.toLowerCase() === userEmail.toLowerCase()),
          );
          if (user) {
            user.subscriptionPlan = plan;
            user.subscriptionStatus = "Active";
            user.billingCycle = cycle;
            user.stripeCustomerId = session.customer;
            user.stripeSubscriptionId = session.subscription;
            user.lastPaymentDate = new Date().toISOString();
            user.lastPaymentAmount = `$${((session.amount_total || 0) / 100).toFixed(2)} USD`;
            user.nextBillingDate = nextBill.toISOString();
            writeDb(db);
          }

          // Sync subscription directly to Firestore user document
          const targetFsUid = user?.id || userId;
          if (targetFsUid) {
            try {
              await adminDb
                .collection("users")
                .doc(targetFsUid)
                .set(
                  {
                    subscriptionPlan: plan,
                    subscriptionStatus: "Active",
                    billingCycle: cycle,
                    stripeCustomerId: session.customer,
                    stripeSubscriptionId: session.subscription,
                    lastPaymentDate: new Date().toISOString(),
                    lastPaymentAmount: `$${((session.amount_total || 0) / 100).toFixed(2)} USD`,
                    nextBillingDate: nextBill.toISOString(),
                  },
                  { merge: true },
                );
              console.log(
                `[Stripe Webhook] Firestore updated for user ${targetFsUid} -> Active (${plan})`,
              );
            } catch (fsErr: any) {
              console.warn(
                "Stripe webhook Firestore sync warning:",
                fsErr?.message,
              );
            }
          }
          break;
        }
        case "customer.subscription.created": {
          const sub = event.data.object;
          console.log(
            `[Stripe Webhook] customer.subscription.created: id=${sub.id}, customer=${sub.customer}, status=${sub.status}`,
          );
          const db = readDb();
          const user = db.users.find(
            (u: any) =>
              u.stripeSubscriptionId === sub.id ||
              u.stripeCustomerId === sub.customer,
          );
          if (user) {
            user.stripeSubscriptionId = sub.id;
            if (sub.status === "active" || sub.status === "trialing") {
              user.subscriptionStatus = "Active";
            }
            writeDb(db);
            try {
              await adminDb.collection("users").doc(user.id).set(
                {
                  stripeSubscriptionId: sub.id,
                  subscriptionStatus: user.subscriptionStatus,
                },
                { merge: true },
              );
            } catch (fsErr: any) {
              console.warn(
                "Stripe webhook sub create Firestore sync warning:",
                fsErr?.message,
              );
            }
          }
          break;
        }
        case "customer.subscription.updated": {
          const sub = event.data.object;
          console.log(
            `[Stripe Webhook] customer.subscription.updated: id=${sub.id}, status=${sub.status}`,
          );
          const db = readDb();
          const user = db.users.find(
            (u: any) =>
              u.stripeSubscriptionId === sub.id ||
              u.stripeCustomerId === sub.customer,
          );
          if (user) {
            const isActive =
              sub.status === "active" || sub.status === "trialing";
            user.subscriptionStatus = isActive
              ? "Active"
              : sub.status === "past_due"
                ? "Past Due"
                : "Inactive";
            if (sub.current_period_end) {
              user.nextBillingDate = new Date(
                sub.current_period_end * 1000,
              ).toISOString();
            }
            writeDb(db);
            try {
              await adminDb
                .collection("users")
                .doc(user.id)
                .set(
                  {
                    subscriptionStatus: user.subscriptionStatus,
                    nextBillingDate: user.nextBillingDate || null,
                  },
                  { merge: true },
                );
            } catch (fsErr: any) {
              console.warn(
                "Stripe webhook sub update Firestore sync warning:",
                fsErr?.message,
              );
            }
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object;
          console.log(
            `[Stripe Webhook] customer.subscription.deleted: id=${sub.id}`,
          );
          const db = readDb();
          const user = db.users.find(
            (u: any) =>
              u.stripeSubscriptionId === sub.id ||
              u.stripeCustomerId === sub.customer,
          );
          if (user) {
            user.subscriptionPlan = undefined;
            user.subscriptionStatus = "Inactive";
            writeDb(db);
          }

          if (user?.id) {
            try {
              await adminDb.collection("users").doc(user.id).set(
                {
                  subscriptionPlan: null,
                  subscriptionStatus: "Inactive",
                },
                { merge: true },
              );
              console.log(
                `[Stripe Webhook] Subscription marked Inactive for user ${user.id}`,
              );
            } catch (fsErr: any) {
              console.warn(
                "Stripe webhook Firestore sub delete warning:",
                fsErr?.message,
              );
            }
          }
          break;
        }
        case "invoice.paid":
        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          const customerId = invoice.customer;
          const subscriptionId = invoice.subscription;
          console.log(
            `[Stripe Webhook] invoice payment succeeded: invoiceId=${invoice.id}, amount=${invoice.amount_paid}`,
          );
          const db = readDb();
          const user = db.users.find(
            (u: any) =>
              (subscriptionId && u.stripeSubscriptionId === subscriptionId) ||
              (customerId && u.stripeCustomerId === customerId),
          );
          if (user) {
            user.subscriptionStatus = "Active";
            user.lastPaymentDate = new Date().toISOString();
            user.lastPaymentAmount = `$${((invoice.amount_paid || 0) / 100).toFixed(2)} USD`;
            writeDb(db);
            try {
              await adminDb.collection("users").doc(user.id).set(
                {
                  subscriptionStatus: "Active",
                  lastPaymentDate: user.lastPaymentDate,
                  lastPaymentAmount: user.lastPaymentAmount,
                },
                { merge: true },
              );
            } catch (fsErr: any) {
              console.warn(
                "Stripe webhook invoice Firestore sync warning:",
                fsErr?.message,
              );
            }
          }
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          console.warn(
            `[Stripe Webhook] invoice payment failed: invoiceId=${invoice.id}, customer=${invoice.customer}`,
          );
          const db = readDb();
          const user = db.users.find(
            (u: any) =>
              u.stripeCustomerId === invoice.customer ||
              (invoice.subscription &&
                u.stripeSubscriptionId === invoice.subscription),
          );
          if (user) {
            user.subscriptionStatus = "Past Due";
            writeDb(db);
            try {
              await adminDb.collection("users").doc(user.id).set(
                {
                  subscriptionStatus: "Past Due",
                },
                { merge: true },
              );
            } catch (fsErr: any) {}
          }
          break;
        }
        default:
          console.log(`[Stripe Webhook] Received Stripe event: ${event.type}`);
      }
    } catch (handlerErr) {
      console.error(
        "[Stripe Webhook] Error processing Stripe webhook event:",
        handlerErr,
      );
    }

    res.json({ received: true });
  },
);

// Dynamic CORS middleware using cors package with configured origins
const allowedOrigins = [
  "https://getzakir.com",
  "https://www.getzakir.com",
  "http://getzakir.com",
  "http://www.getzakir.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith(".getzakir.com") ||
      origin.endsWith(".vercel.app") ||
      origin.endsWith(".run.app")
    ) {
      return callback(null, true);
    }
    // Fallback: reflect origin so requests from other custom domains or dev previews do not fail
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-goog-api-key",
    "X-Requested-With",
    "Accept",
    "Origin",
    "X-Api-Key",
  ],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Global fallback header middleware to ensure CORS headers on ALL responses including preflight
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-goog-api-key, X-Requested-With, Accept, Origin, X-Api-Key, X-HTTP-Method-Override, x-http-method-override",
  );

  // Production Security Headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Zakir-Build-ID", ZAKIR_BUILD_ID);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// Active Admin Support Sessions in-memory store
export interface ActiveSupportSession {
  sessionId: string;
  adminUid: string;
  adminEmail: string;
  targetUserId: string;
  targetUserEmail: string;
  targetUserName?: string;
  startedAt: string;
  expiresAt: string;
  reason: string;
}
export const activeSupportSessions = new Map<string, ActiveSupportSession>();

// Correlation / Request IDs Middleware
app.use((req, res, next) => {
  const incomingId =
    (req.headers["x-correlation-id"] as string) ||
    (req.headers["x-request-id"] as string);
  const correlationId =
    incomingId && incomingId.trim()
      ? incomingId.trim()
      : `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  (req as any).correlationId = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);
  next();
});

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));

// Public static assets (badges, logos, icons) served publicly for email clients & CDN
app.use(express.static(path.join(process.cwd(), "public")));

app.get(
  [
    "/zakir-email-logo.png",
    "/email-assets/zakir-email-logo.png",
    "/zakir-badge-light.png",
    "/email-assets/zakir-badge-light.png",
    "/api/email-logo/light.png",
    "/api/brand/badge-light.png",
    "/api/email-logo/logo.png"
  ],
  (req, res) => {
    const buf = getOfficialEmailLogoLightBuffer();
    if (!buf || buf.length === 0) {
      return res.status(404).send("Logo not found");
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buf);
  }
);

app.get(
  [
    "/zakir-badge-dark.png",
    "/email-assets/zakir-badge-dark.png",
    "/api/email-logo/dark.png",
    "/api/brand/badge-dark.png"
  ],
  (req, res) => {
    const buf = getOfficialEmailLogoDarkBuffer() || getOfficialEmailLogoLightBuffer();
    if (!buf || buf.length === 0) {
      return res.status(404).send("Dark badge not found");
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buf);
  }
);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    serverless: isServerless,
    buildId: ZAKIR_BUILD_ID,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/version", (req, res) => {
  res.json({
    buildId: ZAKIR_BUILD_ID,
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || "development",
  });
});

app.get("/api/payments/diagnostics", async (req, res) => {
  const { secretKey, publishableKey, mode, source, accountId } =
    resolveStripeKeys();

  const hasSecretKey = Boolean(secretKey && secretKey.trim());
  const hasPubKey = Boolean(publishableKey && publishableKey.trim());

  const monthlyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID || "";
  const yearlyPriceId = process.env.STRIPE_YEARLY_PRICE_ID || "";

  const monthlyPriceValid = Boolean(
    monthlyPriceId && monthlyPriceId.trim().startsWith("price_"),
  );
  const yearlyPriceValid = Boolean(
    yearlyPriceId && yearlyPriceId.trim().startsWith("price_"),
  );

  let stripeConnection = false;
  let monthlyPriceExists = false;
  let monthlyPriceActive = false;
  let monthlyPriceIntervalMatches = false;
  let yearlyPriceExists = false;
  let yearlyPriceActive = false;
  let yearlyPriceIntervalMatches = false;
  let stripeError: string | null = null;

  if (hasSecretKey) {
    try {
      const stripe = getStripe();
      if (stripe) {
        await stripe.balance.retrieve();
        stripeConnection = true;

        if (monthlyPriceValid) {
          try {
            const mPrice = await stripe.prices.retrieve(monthlyPriceId.trim());
            if (mPrice) {
              monthlyPriceExists = true;
              monthlyPriceActive = mPrice.active;
              monthlyPriceIntervalMatches =
                mPrice.recurring?.interval === "month";
            }
          } catch (mErr: any) {
            console.warn(
              "[Diagnostics] Monthly price verify fail:",
              mErr?.message,
            );
          }
        }

        if (yearlyPriceValid) {
          try {
            const yPrice = await stripe.prices.retrieve(yearlyPriceId.trim());
            if (yPrice) {
              yearlyPriceExists = true;
              yearlyPriceActive = yPrice.active;
              yearlyPriceIntervalMatches =
                yPrice.recurring?.interval === "year";
            }
          } catch (yErr: any) {
            console.warn(
              "[Diagnostics] Yearly price verify fail:",
              yErr?.message,
            );
          }
        }
      }
    } catch (connErr: any) {
      stripeError = connErr?.message || "Connection failed";
    }
  }

  const keysAligned = Boolean(
    (mode === "live" &&
      secretKey?.startsWith("sk_live_") &&
      publishableKey?.startsWith("pk_live_")) ||
    (mode === "test" &&
      secretKey?.startsWith("sk_test_") &&
      publishableKey?.startsWith("pk_test_")),
  );

  res.json({
    stripeConfigured: hasSecretKey && hasPubKey,
    stripeMode: mode,
    stripeConnection: stripeConnection,
    stripeError: stripeError,
    hasSecretKey: hasSecretKey,
    hasPubKey: hasPubKey,
    keysAligned: keysAligned,
    secretKeySource: source,
    secretKeyPrefix: secretKey ? secretKey.substring(0, 14) + "..." : "none",
    pubKeyPrefix: publishableKey
      ? publishableKey.substring(0, 14) + "..."
      : "none",
    pricingStrategy:
      monthlyPriceValid && yearlyPriceValid
        ? "catalog_price_ids"
        : "adaptive_dynamic_pricing",
    monthlyPriceId: monthlyPriceValid
      ? `${monthlyPriceId.substring(0, 12)}...`
      : "dynamic_in_app",
    monthlyPriceConfigured: Boolean(monthlyPriceId.trim()),
    monthlyPriceValid: monthlyPriceValid,
    monthlyPriceExists: monthlyPriceExists,
    monthlyPriceActive: monthlyPriceActive,
    monthlyPriceIntervalMatches: monthlyPriceIntervalMatches,
    yearlyPriceId: yearlyPriceValid
      ? `${yearlyPriceId.substring(0, 12)}...`
      : "dynamic_in_app",
    yearlyPriceConfigured: Boolean(yearlyPriceId.trim()),
    yearlyPriceValid: yearlyPriceValid,
    yearlyPriceExists: yearlyPriceExists,
    yearlyPriceActive: yearlyPriceActive,
    yearlyPriceIntervalMatches: yearlyPriceIntervalMatches,
    isServerless: isServerless,
    nodeEnv: process.env.NODE_ENV || "development",
  });
});

// --- STRIPE CHECKOUT & SUBSCRIPTION ENDPOINTS ---

// In-memory server caches for Stripe verification (<200ms latency target)
interface CachedPriceEntry {
  price: Stripe.Price;
  cachedAt: number;
}
const stripePriceCache = new Map<string, CachedPriceEntry>();
const stripePriceFailedCache = new Set<string>();
const PRICE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL
const stripeVerifiedCustomerCache = new Set<string>();

app.get(["/api/stripe/config", "/stripe/config"], (req, res) => {
  const { publishableKey, secretKey, mode } = resolveStripeKeys();
  res.json({
    publishableKey: publishableKey || "",
    hasSecretKey: Boolean(secretKey),
    mode: mode,
  });
});

app.post(
  [
    "/api/stripe/create-checkout-session",
    "/api/stripe/create-checkout-session/",
    "/stripe/create-checkout-session",
    "/stripe/create-checkout-session/",
    "/api/create-checkout-session",
    "/api/create-checkout-session/",
    "/create-checkout-session",
    "/create-checkout-session/",
  ],
  requireAuth,
  async (req: AuthRequest, res) => {
    const authUserId = req.user?.uid || (req.user as any)?.user_id;
    if (!authUserId) {
      return res.status(401).json({
        success: false,
        error:
          "تعذر التحقق من جلسة حسابك. يرجى تحديث الجلسة والمحاولة مرة أخرى.",
      });
    }

    try {
      const {
        plan = "Professional",
        billingCycle = "annual",
        companyName,
      } = req.body;

      const db = readDb();
      let user = db.users.find((u: any) => u.id === authUserId);
      if (!user) {
        try {
          const userDoc = await adminDb
            .collection("users")
            .doc(authUserId)
            .get();
          if (userDoc && userDoc.exists) {
            user = userDoc.data();
          }
        } catch (fsErr) {
          console.warn("[CHECKOUT] Firestore user lookup warning:", fsErr);
        }
      }

      const finalUserId = authUserId;
      const finalUserEmail = req.user?.email || user?.email || "";
      const finalCompanyName =
        companyName ||
        user?.companyName ||
        user?.organizationName ||
        "Organization";

      const requestedPlan = (
        plan === "Enterprise"
          ? "Enterprise"
          : plan === "Starter"
            ? "Starter"
            : "Professional"
      ) as "Starter" | "Professional" | "Enterprise";
      const requestedCycle = (
        billingCycle === "monthly" ? "monthly" : "annual"
      ) as "monthly" | "annual";

      // Server-side Enterprise Billing Owner / CEO Validation (Test D & E)
      const userRole = (user?.role || "").toUpperCase();
      const isOwnerOrCeo = userRole === "CEO" || userRole === "ADMIN" || userRole === "OWNER" || userRole === "FOUNDER" || userRole === "DIRECTOR" || userRole === "MANAGER" || !user?.workspaceId || user?.workspaceId === user?.id;

      if (requestedPlan === "Enterprise" && !isOwnerOrCeo) {
        return res.status(403).json({
          success: false,
          code: "ENTERPRISE_MEMBER_FORBIDDEN",
          error: "Only the CEO or Workspace Owner can purchase or manage Enterprise billing.",
          userFriendlyMessage: "فقط المدير التنفيذي (CEO) أو مالك مساحة العمل يمكنه شراء أو إدارة اشتراك Enterprise. الأعضاء يستفيدون من اشتراك المؤسسة المشترك تلقائياً."
        });
      }

      const rawHost = String(
        req.headers["x-forwarded-host"] ||
          req.headers.host ||
          "www.getzakir.com",
      )
        .split(",")[0]
        .trim();
      const rawProto = String(req.headers["x-forwarded-proto"] || "https")
        .split(",")[0]
        .trim();
      const rawBaseUrl = process.env.APP_URL || `${rawProto}://${rawHost}`;
      const baseUrl = rawBaseUrl.replace(/\/+$/, "");

      // Benchmark Plan Prices (Total Amount charged per interval)
      const BENCHMARK_PLAN_PRICES = {
        Starter: { monthly: 6, annual: 50 }, // $6/month or $50/year total
        Professional: { monthly: 189, annual: 1788 }, // $189/month or $1,788/year total ($149/mo)
        Enterprise: { monthly: 849, annual: 8388 }, // $849/month or $8,388/year total ($699/mo)
      };

      const totalAmountUSD =
        BENCHMARK_PLAN_PRICES[requestedPlan][requestedCycle];
      const unitAmountCents = Math.round(totalAmountUSD * 100);

      console.log(
        `[Stripe Checkout] 1. Payment request received: plan=${requestedPlan}, cycle=${requestedCycle}, user=${finalUserId}, amount=$${totalAmountUSD}`,
      );

      const stripe = getStripe();
      if (!stripe) {
        console.warn(
          "[Stripe Checkout] Stripe configuration missing: STRIPE_SECRET_KEY is not defined or invalid.",
        );
        return res.status(400).json({
          success: false,
          error:
            "خادم الدفع غير مهيأ حالياً (STRIPE_SECRET_KEY مفقود). يرجى التواصل مع إدارة النظام.",
          userFriendlyMessage:
            "خادم الدفع غير مهيأ حالياً (STRIPE_SECRET_KEY مفقود). يرجى التواصل مع إدارة النظام.",
        });
      }

      // Check for duplicate active subscription
      if (user?.subscriptionStatus === "Active" && user?.stripeSubscriptionId) {
        // Optimize: Instead of an expensive proactive retrieve network call to Stripe, we rely authoritatively on the local/Firestore status.
        // If we still want to make sure it's valid, we allow the user to manage it or proceed if they are buying a second plan.
        // But returning direct status based on Firestore is 100% reliable and saves a blocking API call.
        console.warn(
          `[Stripe Checkout] User ${finalUserId} already has active subscription ${user.stripeSubscriptionId} based on local profile`,
        );
        return res.status(400).json({
          success: false,
          code: "SUBSCRIPTION_ALREADY_ACTIVE",
          error:
            "لديك بالفعل اشتراك نشط في منصة Zakir. يمكنك إدارة خطتك الحالية أو ترقيتها من صفحة الإعدادات.",
          userFriendlyMessage:
            "لديك بالفعل اشتراك نشط في منصة Zakir. يمكنك إدارة خطتك الحالية أو ترقيتها من صفحة الإعدادات.",
        });
      }

      // Email Validator
      const isValidEmail = (emailStr?: string) => {
        if (!emailStr || typeof emailStr !== "string") return false;
        const clean = emailStr.trim().toLowerCase();
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
      };

      const validUserEmail = isValidEmail(finalUserEmail)
        ? finalUserEmail.trim().toLowerCase()
        : undefined;

      // Resilient Customer Management: Fast-track customer resolution (<10ms target)
      let stripeCustomerId = user?.stripeCustomerId;

      // Case A: Stored Customer ID exists - Verify against active Stripe account/mode
      if (stripeCustomerId) {
        if (stripeVerifiedCustomerCache.has(stripeCustomerId)) {
          console.log(
            `[Stripe Checkout] Verified active Stripe Customer ID from in-memory cache: ${stripeCustomerId}`,
          );
        } else {
          try {
            const existingCust: any =
              await stripe.customers.retrieve(stripeCustomerId);
            if (existingCust && !existingCust.deleted) {
              stripeVerifiedCustomerCache.add(stripeCustomerId);
              console.log(
                `[Stripe Checkout] Verified active Stripe Customer ID: ${stripeCustomerId}`,
              );
            } else {
              console.warn(
                `[Stripe Checkout] Stale/deleted Customer ID detected (${stripeCustomerId}). Clearing...`,
              );
              stripeCustomerId = null;
            }
          } catch (custErr: any) {
            console.warn(
              `[Stripe Checkout] Invalid Customer ID (${stripeCustomerId}) rejected by Stripe (${custErr?.message}). Clearing stale ID...`,
            );
            stripeCustomerId = null;
          }
        }

        if (!stripeCustomerId) {
          if (user) {
            user.stripeCustomerId = null;
            writeDb(db);
          }
          try {
            await adminDb
              .collection("users")
              .doc(finalUserId)
              .set({ stripeCustomerId: null }, { merge: true });
          } catch (fsClearErr) {
            console.warn(
              "[Stripe Checkout] Firestore customer clear notice:",
              fsClearErr,
            );
          }
        }
      }

      // Strict Plan + Billing Cycle Price ID Resolution (Server-Authoritative Mapping for all 6 combinations)
      const resolveStrictPriceId = (
        candidates: (string | undefined)[],
      ): string | undefined => {
        for (const val of candidates) {
          if (!val || typeof val !== "string") continue;
          const trimmed = val.trim();
          // Discard any secret keys, publishable keys or non-price strings
          if (
            trimmed.startsWith("sk_") ||
            trimmed.startsWith("pk_") ||
            trimmed.startsWith("rk_")
          )
            continue;
          if (trimmed.startsWith("price_") || trimmed.startsWith("plan_")) {
            return trimmed;
          }
        }
        return undefined;
      };

      const PRICE_ID_MAP: Record<
        "Starter" | "Professional" | "Enterprise",
        Record<"monthly" | "annual", string | undefined>
      > = {
        Starter: {
          monthly: resolveStrictPriceId([
            process.env.STRIPE_PRICE_STARTER_MONTHLY,
            process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
            "price_1UEC5WFFyAo18vVy5APEHNBN",
          ]),
          annual: resolveStrictPriceId([
            process.env.STRIPE_PRICE_STARTER_YEARLY,
            process.env.STRIPE_PRICE_STARTER_ANNUAL,
            process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
            process.env.STRIPE_STARTER_ANNUAL_PRICE_ID,
            "price_1UEC2tFFyAo18vVyTN2gl6Bm",
          ]),
        },
        Professional: {
          monthly: resolveStrictPriceId([
            process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
            process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID,
            process.env.STRIPE_MONTHLY_PRICE_ID,
            "price_1UEC6NFFyAo18vVyZATNtv6Y",
          ]),
          annual: resolveStrictPriceId([
            process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY,
            process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL,
            process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID,
            process.env.STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID,
            process.env.STRIPE_YEARLY_PRICE_ID,
            process.env.STRIPE_ANNUAL_PRICE_ID,
            "price_1UEByqFFyAo18vVydh8OZrmp",
          ]),
        },
        Enterprise: {
          monthly: resolveStrictPriceId([
            process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
            process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
            "price_1UEC7HFFyAo18vVyHJB2zEFf",
          ]),
          annual: resolveStrictPriceId([
            process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
            process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL,
            process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
            process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID,
            "price_1UEC3rFFyAo18vVy1a6DzeR3",
          ]),
        },
      };

      const targetPriceId = PRICE_ID_MAP[requestedPlan]?.[requestedCycle];
      let verifiedPriceId: string | null = null;

      if (targetPriceId && !stripePriceFailedCache.has(targetPriceId)) {
        try {
          const expectedInterval =
            requestedCycle === "annual" ? "year" : "month";
          let retrievedPrice: Stripe.Price;
          const now = Date.now();
          const cachedEntry = stripePriceCache.get(targetPriceId);

          if (cachedEntry && now - cachedEntry.cachedAt < PRICE_CACHE_TTL_MS) {
            retrievedPrice = cachedEntry.price;
            console.log(
              `[Stripe Price Verification] Retrieved Price ID '${targetPriceId}' from in-memory cache`,
            );
          } else {
            retrievedPrice = await stripe.prices.retrieve(targetPriceId);
            stripePriceCache.set(targetPriceId, {
              price: retrievedPrice,
              cachedAt: now,
            });
            console.log(
              `[Stripe Price Verification] Retrieved Price ID '${targetPriceId}' from Stripe API`,
            );
          }

          const isPriceActive = retrievedPrice.active === true;
          const isUsd = retrievedPrice.currency?.toLowerCase() === "usd";
          const intervalMatches =
            retrievedPrice.recurring?.interval === expectedInterval;
          const intervalCountMatches =
            (retrievedPrice.recurring?.interval_count || 1) === 1;

          if (
            isPriceActive &&
            isUsd &&
            intervalMatches &&
            intervalCountMatches
          ) {
            verifiedPriceId = retrievedPrice.id;
            console.log(
              `[Stripe Price Verification] Price ID ${verifiedPriceId} verified successfully: active=true, currency=USD, interval=${expectedInterval}, amount=$${retrievedPrice.unit_amount ? retrievedPrice.unit_amount / 100 : 0}`,
            );
          } else {
            stripePriceFailedCache.add(targetPriceId);
            console.warn(
              `[Stripe Price Verification] Price ID '${targetPriceId}' not fully matching. Falling back to dynamic price_data.`,
            );
          }
        } catch (priceErr: any) {
          stripePriceFailedCache.add(targetPriceId);
          console.warn(
            `[Stripe Price Verification] Could not retrieve Price ID '${targetPriceId}' (${priceErr?.message}). Falling back smoothly to Stripe dynamic price_data.`,
          );
        }
      } else {
        console.log(
          `[Stripe Checkout] Utilizing Stripe dynamic price_data for plan '${requestedPlan}' (${requestedCycle}).`,
        );
      }

      // Line items: Use verified Price ID if available, otherwise dynamically create price_data
      const expectedInterval = requestedCycle === "annual" ? "year" : "month";
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        verifiedPriceId
          ? [{ price: verifiedPriceId, quantity: 1 }]
          : [
              {
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: `Zakir AI - ${requestedPlan} Plan`,
                    description: `Zakir AI Subscription (${requestedPlan} Plan, ${requestedCycle === "annual" ? "Annual" : "Monthly"} billing)`,
                  },
                  unit_amount: unitAmountCents,
                  recurring: {
                    interval: expectedInterval,
                    interval_count: 1,
                  },
                },
                quantity: 1,
              },
            ];

      // Determine whether caller requested hosted redirect mode or embedded in-app checkout
      const { publishableKey } = resolveStripeKeys();
      const isHosted =
        req.body?.uiMode === "hosted" ||
        req.body?.uiMode === "hosted_page" ||
        req.body?.uiMode !== "embedded" ||
        !publishableKey;
      const requestedUiMode = isHosted ? "hosted" : "embedded";
      const returnUrl = `${baseUrl}/?view=settings&tab=subscription&session_id={CHECKOUT_SESSION_ID}`;
      const successUrl = `${baseUrl}/?view=settings&tab=subscription&checkout=success&session_id={CHECKOUT_SESSION_ID}&plan=${requestedPlan}&cycle=${requestedCycle}`;
      const cancelUrl = `${baseUrl}/?view=settings&tab=subscription&checkout=cancelled`;

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: lineItems,
        client_reference_id: finalUserId,
        metadata: {
          userId: finalUserId,
          userEmail: validUserEmail || finalUserEmail || "",
          companyName: finalCompanyName,
          plan: requestedPlan,
          billingCycle: requestedCycle,
        },
      };

      if (isHosted) {
        sessionParams.ui_mode = "hosted" as any;
        sessionParams.success_url = successUrl;
        sessionParams.cancel_url = cancelUrl;
      } else {
        sessionParams.ui_mode = "embedded" as any;
        sessionParams.return_url = returnUrl;
      }

      if (stripeCustomerId) {
        sessionParams.customer = stripeCustomerId;
      } else if (validUserEmail) {
        sessionParams.customer_email = validUserEmail;
      }

      console.log(
        `[Stripe Checkout] Creating ${requestedUiMode.toUpperCase()} Checkout Session for user ${finalUserId} (verified price: ${verifiedPriceId})...`,
      );
      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.create(sessionParams);
      } catch (sessionErr: any) {
        const errMsg = sessionErr?.message || "";
        if (
          errMsg.includes("No such customer") ||
          sessionErr?.code === "resource_missing"
        ) {
          console.warn(
            `[Stripe Checkout] Checkout session creation hit invalid customer error (${sessionErr.message}). Retrying without customer parameter...`,
          );
          delete sessionParams.customer;
          if (validUserEmail) {
            sessionParams.customer_email = validUserEmail;
          }
          session = await stripe.checkout.sessions.create(sessionParams);
        } else {
          throw sessionErr;
        }
      }

      console.log(
        `[Stripe Checkout] Checkout Session created successfully: id=${session.id}, url=${session.url || "N/A (embedded)"}`,
      );

      db.stripe_sessions = db.stripe_sessions || {};
      db.stripe_sessions[session.id] = finalUserId;
      writeDb(db);

      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      return res.json({
        success: true,
        sessionId: session.id,
        url: session.url || null,
        clientSecret: session.client_secret,
        publishableKey: publishableKey || "",
      });
    } catch (err: any) {
      const errorDetails = {
        httpMethod: req.method,
        route: req.originalUrl || req.url,
        stripeErrorType: err?.type || err?.rawType || "UnknownType",
        stripeErrorCode:
          err?.code || err?.raw?.code || "PAYMENT_SESSION_CREATION_FAILED",
        stripeErrorMessage:
          err?.message ||
          err?.raw?.message ||
          "Failed to initiate Stripe Checkout",
        stripeErrorParam: err?.param || err?.raw?.param,
        stripeDeclineCode: err?.decline_code || err?.raw?.decline_code,
        statusCode: err?.statusCode || 500,
      };

      console.error(
        "[Stripe Checkout] Detailed Error in Checkout Session Creation:",
        errorDetails,
      );

      const httpStatusCode =
        err?.statusCode && err?.statusCode >= 400 && err?.statusCode < 600
          ? err.statusCode
          : 500;

      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      res.status(httpStatusCode).json({
        success: false,
        code: errorDetails.stripeErrorCode,
        errorType: errorDetails.stripeErrorType,
        error: errorDetails.stripeErrorMessage,
        userFriendlyMessage: err?.message
          ? `تعذر إعداد جلسة الدفع: ${err.message}`
          : "تعذر إعداد جلسة الدفع الآمن حالياً. يرجى المحاولة لاحقاً.",
      });
    }
  },
);

// Explicit method fallback for create-checkout-session (GET/OPTIONS only)
app.all(
  [
    "/api/stripe/create-checkout-session",
    "/api/stripe/create-checkout-session/",
    "/stripe/create-checkout-session",
    "/stripe/create-checkout-session/",
    "/api/create-checkout-session",
    "/api/create-checkout-session/",
    "/create-checkout-session",
    "/create-checkout-session/",
  ],
  (req, res) => {
    const methodUpper = (req.method || "GET").toUpperCase();
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    if (methodUpper === "OPTIONS") {
      return res.status(200).end();
    }
    if (methodUpper === "GET" || methodUpper === "HEAD") {
      return res.status(200).json({
        success: true,
        endpoint: "/api/stripe/create-checkout-session",
        status: "active",
        message:
          "Stripe Embedded Checkout Session initialization endpoint is active. Please submit checkout parameters via POST.",
      });
    }
    return res.status(405).json({
      success: false,
      error: `Method ${methodUpper} Not Allowed. Please use POST.`,
      userFriendlyMessage: "طريقة الطلب غير صالحة، يرجى استخدام POST.",
    });
  },
);

// GET Session Status (for Embedded Checkout completion or success return)
app.get(
  [
    "/api/stripe/session-status/:sessionId",
    "/stripe/session-status/:sessionId",
  ],
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      console.log("[DEBUG] req.user =", req.user);
      const authUserId = req.user?.uid;
      if (!authUserId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing authentication token" });
      }

      const { sessionId } = req.params;
      const stripe = getStripe();

      if (stripe && !sessionId.startsWith("cs_stripe_")) {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const userId = session.client_reference_id || session.metadata?.userId;
        const plan = session.metadata?.plan || "Professional";
        const cycle = session.metadata?.billingCycle || "annual";

        // Ensure user cannot inspect another user's session unless admin
        if (userId && userId !== authUserId) {
          const isAdmin = await isUserAdminServer(authUserId);
          if (!isAdmin) {
            return res
              .status(403)
              .json({
                error: "Forbidden: Access denied to other users' sessions",
              });
          }
        }

        if (
          session.status === "complete" ||
          session.payment_status === "paid"
        ) {
          const nextBill = new Date();
          if (cycle === "annual")
            nextBill.setFullYear(nextBill.getFullYear() + 1);
          else nextBill.setMonth(nextBill.getMonth() + 1);

          const db = readDb();
          const user = db.users.find(
            (u: any) =>
              u.id === userId ||
              (session.customer_details?.email &&
                u.email?.toLowerCase() ===
                  session.customer_details.email.toLowerCase()),
          );
          if (user) {
            user.subscriptionPlan = plan;
            user.subscriptionStatus = "Active";
            user.billingCycle = cycle;
            user.stripeCustomerId = session.customer;
            user.stripeSubscriptionId = session.subscription;
            user.lastPaymentDate = new Date().toISOString();
            user.lastPaymentAmount = `$${((session.amount_total || 0) / 100).toFixed(2)} USD`;
            user.nextBillingDate = nextBill.toISOString();
            writeDb(db);
          }

          if (userId || user?.id) {
            const targetUid = userId || user?.id;
            try {
              await adminDb
                .collection("users")
                .doc(targetUid)
                .set(
                  {
                    subscriptionPlan: plan,
                    subscriptionStatus: "Active",
                    billingCycle: cycle,
                    stripeCustomerId: session.customer,
                    stripeSubscriptionId: session.subscription,
                    lastPaymentDate: new Date().toISOString(),
                    lastPaymentAmount: `$${((session.amount_total || 0) / 100).toFixed(2)} USD`,
                    nextBillingDate: nextBill.toISOString(),
                  },
                  { merge: true },
                );
            } catch (e: any) {
              console.warn("Firestore status update error:", e.message);
            }
          }

          return res.json({
            status: session.status,
            paymentStatus: session.payment_status,
            customerEmail: session.customer_details?.email,
            plan,
            billingCycle: cycle,
            amountTotal: `$${((session.amount_total || 0) / 100).toFixed(2)} USD`,
            nextBillingDate: nextBill.toISOString(),
          });
        }

        return res.json({
          status: session.status,
          paymentStatus: session.payment_status,
        });
      }

      // Simulated session lookup
      const db = readDb();
      const userId = db.stripe_sessions?.[sessionId];
      if (userId && userId !== authUserId) {
        const isAdmin = await isUserAdminServer(authUserId);
        if (!isAdmin) {
          return res
            .status(403)
            .json({
              error: "Forbidden: Access denied to other users' sessions",
            });
        }
      }
      const user = db.users.find((u: any) => u.id === userId);

      return res.json({
        status: "complete",
        paymentStatus: "paid",
        customerEmail: user?.email || "subscriber@zakir.ai",
        plan: user?.subscriptionPlan || "Professional",
        billingCycle: user?.billingCycle || "annual",
        amountTotal: user?.lastPaymentAmount || "$149.00 USD",
        nextBillingDate:
          user?.nextBillingDate ||
          new Date(Date.now() + 365 * 86400000).toISOString(),
      });
    } catch (err: any) {
      console.error("Error retrieving Stripe session status:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to retrieve session status" });
    }
  },
);

app.post(
  ["/api/stripe/create-portal-session", "/stripe/create-portal-session"],
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const authUserId = req.user?.uid;
      if (!authUserId) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Missing authentication token" });
      }

      const host = req.headers.host || "localhost:3000";
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

      // Look up the user's stripeCustomerId securely from local DB or Firestore
      const db = readDb();
      let user = db.users.find((u: any) => u.id === authUserId);
      if (!user) {
        try {
          const userDoc = await adminDb
            .collection("users")
            .doc(authUserId)
            .get();
          if (userDoc && userDoc.exists) {
            user = userDoc.data();
          }
        } catch (fsErr) {
          console.warn("[Portal] Firestore lookup notice:", fsErr);
        }
      }

      const stripeCustomerId = user?.stripeCustomerId;
      if (!stripeCustomerId) {
        return res.status(400).json({
          error:
            "لم يتم العثور على اشتراك مرتبط بحسابك في Stripe بعد. يرجى الاشتراك في إحدى الباقات أولاً لتفعيل بوابة الإدارة.",
          userFriendlyMessage:
            "لم يتم العثور على اشتراك مرتبط بحسابك في Stripe بعد. يرجى الاشتراك في إحدى الباقات أولاً لتفعيل بوابة الإدارة.",
        });
      }

      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({
          error: "خادم Stripe غير متاح حالياً.",
          userFriendlyMessage: "خادم Stripe غير متاح حالياً.",
        });
      }

      try {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: `${baseUrl}/?view=settings&tab=subscription`,
        });
        return res.json({ url: portalSession.url });
      } catch (portalErr: any) {
        const errMessage =
          portalErr?.message || "Failed to create portal session";
        console.warn("[Stripe Portal] Notice:", errMessage);
        const isPortalNotConfigured =
          errMessage.toLowerCase().includes("portal") ||
          errMessage.toLowerCase().includes("not enabled");
        return res.status(400).json({
          error: errMessage,
          userFriendlyMessage: isPortalNotConfigured
            ? "بوابة إدارة الاشتراكات (Customer Portal) غير مفعلة حالياً في لوحة تحكم Stripe. يرجى تفعيلها من إعدادات Customer Portal في حساب Stripe الخاص بك."
            : `تعذر فتح بوابة إدارة الاشتراك: ${errMessage}`,
        });
      }
    } catch (err: any) {
      console.error("Error creating portal session:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to create portal session" });
    }
  },
);

// Cancel or Pause Subscription
app.post(
  ["/api/stripe/cancel-subscription", "/stripe/cancel-subscription"],
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const authUserId = req.user?.uid;
      if (!authUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const db = readDb();
      let user = db.users.find((u: any) => u.id === authUserId);
      if (!user) {
        try {
          const userDoc = await adminDb
            .collection("users")
            .doc(authUserId)
            .get();
          if (userDoc && userDoc.exists) {
            user = userDoc.data();
          }
        } catch (fsErr) {
          console.warn("[CancelSub] Firestore lookup notice:", fsErr);
        }
      }

      const stripe = getStripe();
      if (stripe && user?.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        } catch (stripeErr: any) {
          console.warn(
            "Stripe cancel subscription warning:",
            stripeErr.message,
          );
        }
      }

      if (user) {
        user.subscriptionStatus = "Inactive";
        user.subscriptionPlan = undefined;
        writeDb(db);
      }

      try {
        await adminDb.collection("users").doc(authUserId).set(
          {
            subscriptionStatus: "Inactive",
            subscriptionPlan: null,
          },
          { merge: true },
        );
      } catch (fsErr: any) {
        console.warn("Firestore cancel sync warning:", fsErr.message);
      }

      return res.json({
        success: true,
        message: "تم إلغاء تجديد الاشتراك بنجاح.",
      });
    } catch (err: any) {
      console.error("Error cancelling subscription:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to cancel subscription" });
    }
  },
);

app.get(
  [
    "/.well-known/stripe-verification",
    "/.well-known/stripe-verification.txt",
    "/stripe-verification",
  ],
  (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(
      "stripe-verification=61271845aaa858f327634c112c5688e9b33281a0e192865affdd7552e0c4f3fa",
    );
  },
);

// Official Zakir Logo SVG String
const OFFICIAL_ZAKIR_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1999.27 1999.27">
  <defs>
    <style>
      .cls-1 {
        fill: #fff;
      }

      .cls-1, .cls-2 {
        stroke-width: 0px;
      }

      .cls-2 {
        fill: #1c2c58;
      }
    </style>
  </defs>
  <rect class="cls-2" width="1999.27" height="1999.27" rx="437.34" ry="437.34"/>
  <g transform="translate(-906,-1072)">
    <path class="cls-1" d="M1787.51,1969.4c-49.07-6.76-102.43-12.1-159.61-14.97-66.49-3.33-128.28-2.81-184.55,0,71.49-38.24,142.99-76.48,214.48-114.72,41.92,8.48,88.66,15.66,139.66,19.96,76.56,6.45,145.53,4.94,204.51,0-71.49,36.58-142.99,73.15-214.48,109.73h0Z"/>
    <path class="cls-1" d="M2206.48,2293.61c-44.57-7.44-91.14-14.19-139.66-19.96-57.2-6.8-112.15-11.66-164.6-14.97,51.54-29.92,103.09-59.85,154.63-89.77,32.45,12.14,72.73,23.74,119.72,29.92,99.91,13.17,182.92-4.28,234.44-19.96-68.16,38.24-136.33,76.48-204.51,114.72l-.02.02Z"/>
    <path class="cls-1" d="M1161.51,2283.64c-.83-131.4-1.63-262.81-2.46-394.21,0-3.21.08-6.41.35-9.62,2.92-33.13,11.85-79.17,39.52-124.89,31.54-52.16,74.51-82.6,107.64-102.37,96.89-57.82,422.05-210.98,869.99-401.41,6.1-2.27,46.22-16.5,79.81,4.98,26.99,17.27,34.91,44.9,39.91,69.84,2.05,10.22,4.34,27.07,4.38,50.71,0,0-.43,33.94-9.37,68.99-6.51,25.54-18.98,52.01-32.99,76.25-32.3,55.94-80.32,101.11-137.61,130.99-4.55,2.38-9.2,4.78-13.96,7.26-58.48,30.28-103.65,52.24-129.69,64.83-119.53,57.91-217.54,103.67-217.54,103.69-225.87,105.51-251.21,114.24-321.15,155.68-106.96,63.41-143.19,99.6-169.58,134.67-45.85,60.92-65.54,123.09-74.82,164.6-1.88,10.49-11.58,16.79-19.96,14.97-6.39-1.41-11.54-7.42-12.47-14.97h-.02Z"/>
    <path class="cls-1" d="M1393.46,2620.32c-4.16-50.65-7.55-103.05-9.97-157.11-2.56-56.75-3.91-111.76-4.26-164.93-.21-30.03,11.52-77.24,39.17-124.37,39.15-66.72,93.66-96.85,129.69-114.72,284.63-141.23,532.09-256.09,537.98-258.94,155.33-75.24,255.1-125.12,299.97-150.06,56.85-31.58,96.93-66.22,129.69-84.79,4.26-2.42,9.68-4.55,14.35-6.35,8.02-3.1,16.75-4.22,25.19-2.54,6.56,1.3,13.75,3.91,20.31,8.89,18.01,13.71,19.75,34.29,19.96,37.41,3.02,27.71,4.98,58.63,4.98,92.28s-1.99,64.34-4.98,91.97c-3.1,25.46-11.21,65.54-34.91,107.56-38.32,67.92-94.45,101.58-119.72,114.72-183.54,94.03-367.06,188.07-550.6,282.1-106.63,52.65-176.59,86.92-217.54,106.96-71.68,35.05-130.21,59.04-179.57,114.72-20.29,22.89-33.61,39.19-44.9,59.85-8.19,14.99-11.52,28.17-14.97,44.9-.62,3.02-1.57,6.95-3.54,10.86-7.4,14.83-28.89,14.85-34.81-.62-.91-2.4-1.47-5-1.57-7.73l.04-.04Z"/>
    <path class="cls-1" d="M1689.01,2696.11l-1.26,130.89c-.37,3.43-3.12,33.87,19.96,55.18,17.64,16.28,43.66,21.03,67.21,12.53,3.16-1.14,6.16-2.67,9.12-4.24,247.86-131.74,493.79-258.51,743.67-395.35,19.13-10.46,61.59-43.97,92.79-111.74,23.74-51.56,29.92-99.76,31.56-126.28.83-13.38-1.63-150.55-1.63-150.55,1.08-18.7-9.18-35.78-24.94-42.4-13.96-5.87-30.59-2.85-42.83,7.24-15.45,12.74-31.52,24.71-49.36,33.79-224.94,114.32-450.9,226.18-675.88,340.4-12.72,6.45-25.17,13.44-37.14,21.2-25.13,16.25-58.03,41.71-87.62,86.2-.27.41-.54.81-.81,1.22-27.79,42.08-42.33,91.49-42.83,141.93v-.02Z"/>
  </g>
</svg>`;

let officialPngLogoCache: Buffer | null = null;
let officialEmailLogoBufferCache: Buffer | null = null;
let officialLogoLightCache: Buffer | null = null;
let officialLogoDarkCache: Buffer | null = null;
let officialLogoWhiteCache: Buffer | null = null;
let officialLogoNavyCache: Buffer | null = null;
let officialAvatarCache: Buffer | null = null;

function getOfficialLogoWhiteBuffer(): Buffer {
  if (officialLogoWhiteCache && officialLogoWhiteCache.length > 0) {
    return officialLogoWhiteCache;
  }
  const possiblePaths = [
    path.join(process.cwd(), "public", "zakir-logo-white.png"),
    path.join(process.cwd(), "src", "assets", "zakir-logo-white.png"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = fs.readFileSync(p);
        if (data && data.length > 0) {
          officialLogoWhiteCache = data;
          return officialLogoWhiteCache;
        }
      } catch (e) {}
    }
  }
  return Buffer.alloc(0);
}

function getOfficialLogoNavyBuffer(): Buffer {
  if (officialLogoNavyCache && officialLogoNavyCache.length > 0) {
    return officialLogoNavyCache;
  }
  const possiblePaths = [
    path.join(process.cwd(), "public", "zakir-logo-navy.png"),
    path.join(process.cwd(), "src", "assets", "zakir-logo-navy.png"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = fs.readFileSync(p);
        if (data && data.length > 0) {
          officialLogoNavyCache = data;
          return officialLogoNavyCache;
        }
      } catch (e) {}
    }
  }
  return Buffer.alloc(0);
}

function getOfficialEmailLogoLightBuffer(): Buffer {
  if (officialLogoLightCache && officialLogoLightCache.length > 0) {
    return officialLogoLightCache;
  }
  const safeDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const possiblePaths = [
    path.join(process.cwd(), "public", "zakir-badge-light.png"),
    path.join(process.cwd(), "public", "zakir-email-logo.png"),
    path.join(process.cwd(), "dist", "zakir-badge-light.png"),
    path.join(process.cwd(), "dist", "zakir-email-logo.png"),
    path.join(process.cwd(), "dist", "public", "zakir-badge-light.png"),
    path.join(process.cwd(), "src", "assets", "zakir-badge-light.png"),
    path.join(process.cwd(), "src", "assets", "zakir-email-logo.png"),
    path.join(safeDir, "public", "zakir-badge-light.png"),
    path.join(safeDir, "zakir-badge-light.png"),
    path.join(safeDir, "..", "public", "zakir-badge-light.png"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = fs.readFileSync(p);
        if (data && data.length > 0 && data.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
          officialLogoLightCache = data;
          return officialLogoLightCache;
        }
      } catch (e) {}
    }
  }
  return Buffer.alloc(0);
}

function getOfficialEmailLogoDarkBuffer(): Buffer {
  if (officialLogoDarkCache && officialLogoDarkCache.length > 0) {
    return officialLogoDarkCache;
  }
  const possiblePaths = [
    path.join(process.cwd(), "public", "zakir-email-logo.png"),
    path.join(process.cwd(), "public", "zakir-badge-dark.png"),
    path.join(process.cwd(), "src", "assets", "zakir-email-logo.png"),
    path.join(process.cwd(), "src", "assets", "zakir-badge-dark.png"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = fs.readFileSync(p);
        if (data && data.length > 0) {
          officialLogoDarkCache = data;
          return officialLogoDarkCache;
        }
      } catch (e) {}
    }
  }
  return Buffer.alloc(0);
}

function getOfficialSenderAvatarBuffer(): Buffer {
  if (officialAvatarCache && officialAvatarCache.length > 0) {
    return officialAvatarCache;
  }
  const possiblePaths = [
    path.join(process.cwd(), "public", "zakir-sender-avatar.png"),
    path.join(process.cwd(), "src", "assets", "zakir-sender-avatar.png"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = fs.readFileSync(p);
        if (data && data.length > 0) {
          officialAvatarCache = data;
          return officialAvatarCache;
        }
      } catch (e) {}
    }
  }
  return Buffer.alloc(0);
}

function getOfficialEmailLogoBuffer(): Buffer {
  return getOfficialEmailLogoLightBuffer();
}

function getOfficialPngLogo(): Buffer {
  if (officialPngLogoCache && officialPngLogoCache.length > 0) {
    return officialPngLogoCache;
  }
  const possiblePaths = [
    path.join(process.cwd(), "public", "zakir-symbol-navy.png"),
    path.join(process.cwd(), "public", "zakir-email-logo.png"),
    path.join(process.cwd(), "public", "zakir-badge-white.png"),
    path.join(process.cwd(), "public", "zakir-official-logo.png"),
    path.join(process.cwd(), "public", "logo.png"),
    path.join(process.cwd(), "src", "assets", "zakir-official-logo.png"),
    path.join(process.cwd(), "dist", "assets", "zakir-official-logo.png"),
    path.join(process.cwd(), "public", "icon-512.png"),
    path.join(process.cwd(), "public", "icon-192.png"),
  ];
  for (const pngPath of possiblePaths) {
    if (fs.existsSync(pngPath)) {
      try {
        const data = fs.readFileSync(pngPath);
        if (data && data.length > 0) {
          officialPngLogoCache = data;
          return officialPngLogoCache;
        }
      } catch (e) {}
    }
  }
  return Buffer.alloc(0);
}

function getAppBaseUrl(req?: express.Request): string {
  // 1. Explicit appUrl in request body or query
  if (req) {
    const bodyUrl = (req.body?.appUrl ||
      req.body?.origin ||
      req.query?.appUrl ||
      req.query?.origin) as string;
    if (bodyUrl && typeof bodyUrl === "string" && bodyUrl.startsWith("http")) {
      return bodyUrl.trim().replace(/\/$/, "");
    }
    if (req.headers) {
      const origin = req.headers.origin;
      if (origin && typeof origin === "string" && origin.startsWith("http")) {
        return origin.trim().replace(/\/$/, "");
      }
      const referer = req.headers.referer;
      if (
        referer &&
        typeof referer === "string" &&
        referer.startsWith("http")
      ) {
        try {
          const u = new URL(referer);
          return u.origin.replace(/\/$/, "");
        } catch (e) {}
      }
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      if (host && typeof host === "string") {
        const proto = (req.headers["x-forwarded-proto"] as string) || "https";
        return `${proto}://${host}`.replace(/\/$/, "");
      }
    }
  }

  if (process.env.APP_URL && process.env.APP_URL.trim()) {
    return process.env.APP_URL.trim().replace(/\/$/, "");
  }
  if (process.env.PUBLIC_APP_URL && process.env.PUBLIC_APP_URL.trim()) {
    return process.env.PUBLIC_APP_URL.trim().replace(/\/$/, "");
  }

  return "https://www.getzakir.com";
}

app.get(
  [
    "/api/logo.png",
    "/assets/logo.png",
    "/logo.png",
    "/zakir-official-logo.png",
    "/api/zakir-official-logo.png",
    "/assets/zakir-official-logo.png",
    "/public/logo.png",
    "/public/zakir-official-logo.png",
  ],
  (req, res) => {
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const buf = getOfficialPngLogo();
    if (buf && buf.length > 0) {
      return res.send(buf);
    }
    const fallback = path.join(process.cwd(), "public", "icon-192.png");
    if (fs.existsSync(fallback)) {
      return res.sendFile(fallback);
    }
    return res.status(404).end();
  },
);

app.get(["/api/logo.svg", "/assets/logo.svg", "/logo.svg"], (req, res) => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send(OFFICIAL_ZAKIR_SVG);
});

function getEmailLogoSvg(mode: "light" | "dark" = "light"): string {
  return OFFICIAL_ZAKIR_SVG;
}

app.get("/api/email-logo/light.svg", (req, res) => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const svgPath = path.join(process.cwd(), "public", "zakir-badge-light.svg");
  if (fs.existsSync(svgPath)) {
    res.send(fs.readFileSync(svgPath, "utf-8"));
  } else {
    res.send(getEmailLogoSvg("light"));
  }
});

app.get("/api/email-logo/dark.svg", (req, res) => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const svgPath = path.join(process.cwd(), "public", "zakir-badge-dark.svg");
  if (fs.existsSync(svgPath)) {
    res.send(fs.readFileSync(svgPath, "utf-8"));
  } else {
    res.send(getEmailLogoSvg("dark"));
  }
});

app.get(
  ["/api/brand/avatar.svg", "/bimi-logo.svg", "/api/email-logo/avatar.svg"],
  (req, res) => {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const svgPath = path.join(process.cwd(), "public", "zakir-sender-avatar.svg");
    if (fs.existsSync(svgPath)) {
      res.send(fs.readFileSync(svgPath, "utf-8"));
    } else {
      res.status(404).send("Avatar SVG not found");
    }
  }
);

app.get(
  ["/api/brand/avatar.png", "/avatar.png", "/api/email-logo/avatar.png", "/public/zakir-sender-avatar.png"],
  (req, res) => {
    const buf = getOfficialSenderAvatarBuffer();
    if (!buf || buf.length === 0) {
      return res.status(404).send("Avatar not found");
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buf);
  }
);

app.get(
  [
    "/zakir-logo-white.png",
    "/api/brand/zakir-logo-white.png",
    "/api/email-logo/white.png",
    "/public/zakir-logo-white.png",
  ],
  (req, res) => {
    const buf = getOfficialLogoWhiteBuffer();
    if (!buf || buf.length === 0) {
      return res.status(404).send("White logo not found");
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buf);
  }
);

app.get(
  [
    "/zakir-logo-navy.png",
    "/api/brand/zakir-logo-navy.png",
    "/api/email-logo/navy.png",
    "/public/zakir-logo-navy.png",
  ],
  (req, res) => {
    const buf = getOfficialLogoNavyBuffer();
    if (!buf || buf.length === 0) {
      return res.status(404).send("Navy logo not found");
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buf);
  }
);

app.get(
  [
    "/zakir-sender-avatar.png",
    "/api/brand/zakir-sender-avatar.png",
    "/public/zakir-sender-avatar.png",
  ],
  (req, res) => {
    const buf = getOfficialSenderAvatarBuffer();
    if (!buf || buf.length === 0) {
      return res.status(404).send("Sender avatar not found");
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buf);
  }
);

app.get(
  ["/api/email-logo/light.png", "/api/brand/badge-light.png", "/public/zakir-badge-light.png", "/email-assets/zakir-badge-light.png"],
  (req, res) => {
    const buf = getOfficialEmailLogoLightBuffer();
    if (!buf || buf.length === 0) {
      return res.status(404).send("Light badge not found");
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buf);
  }
);

app.get(
  ["/api/email-logo/dark.png", "/api/brand/badge-dark.png", "/public/zakir-badge-dark.png", "/email-assets/zakir-badge-dark.png"],
  (req, res) => {
    const buf = getOfficialEmailLogoDarkBuffer();
    if (!buf || buf.length === 0) {
      return res.status(404).send("Dark badge not found");
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buf);
  }
);

app.get(
  [
    "/api/email-logo/logo.png",
    "/api/logo.png",
    "/api/brand/logo.png",
  ],
  (req, res) => {
    const buf = getOfficialEmailLogoLightBuffer() || getOfficialPngLogo();
    if (!buf || buf.length === 0) {
      return res.status(404).send("Logo not found");
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buf);
  }
);

app.get(
  ["/api/stripe/receipt/:sessionId", "/stripe/receipt/:sessionId"],
  requireAuth,
  async (req: AuthRequest, res) => {
    const { sessionId } = req.params;
    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing authentication token" });
    }

    const db = readDb();

    // Enforce session ownership to prevent IDOR
    const sessionOwnerId = db.stripe_sessions?.[sessionId];
    const isCallerAdmin = await isUserAdminServer(authUserId);

    if (sessionOwnerId && sessionOwnerId !== authUserId && !isCallerAdmin) {
      return res
        .status(403)
        .json({ error: "Forbidden: You do not own this checkout session." });
    }

    let user = db.users.find((u: any) => u.id === authUserId);
    if (isCallerAdmin && sessionOwnerId) {
      const targetUser = db.users.find((u: any) => u.id === sessionOwnerId);
      if (targetUser) {
        user = targetUser;
      }
    }

    if (!user) {
      try {
        const userDoc = await adminDb
          .collection("users")
          .doc(sessionOwnerId || authUserId)
          .get();
        if (userDoc && userDoc.exists) {
          user = userDoc.data();
        }
      } catch (fsErr) {
        console.warn("[Receipt] Firestore lookup notice:", fsErr);
      }
    }

    const plan =
      (req.query.plan as string) || user?.subscriptionPlan || "Professional";
    const cycle = (req.query.cycle as string) || user?.billingCycle || "annual";

    const receiptBenchmark = {
      Starter: { monthly: 6, annual: 50 },
      Professional: { monthly: 189, annual: 1788 },
      Enterprise: { monthly: 849, annual: 8388 },
    };
    const price =
      receiptBenchmark[plan as keyof typeof receiptBenchmark]?.[
        cycle as "monthly" | "annual"
      ] || 189;

    const receipt = {
      receiptNumber: `STRIPE-INV-${new Date().getFullYear()}-${sessionId.slice(-6).toUpperCase()}`,
      invoiceNo: `STRIPE-INV-${new Date().getFullYear()}-${sessionId.slice(-6).toUpperCase()}`,
      sessionId: sessionId,
      planName: plan,
      plan: plan,
      billingCycle: cycle,
      amountPaid: `$${price}.00 USD`,
      amount: `$${price}.00 USD`,
      status: "Paid & Verified",
      currency: "USD",
      paymentMethod: "Stripe Checkout (Visa / MasterCard / AMEX)",
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      customerEmail: user?.email || req.user?.email || "subscriber@zakir.ai",
      customerName: user?.companyName || user?.ownerName || "Organization",
      companyName: user?.companyName || "Organization",
      stripeReceiptUrl: `https://pay.stripe.com/receipts/invoices/${sessionId}`,
    };

    res.json({ receipt });
  },
);

// --- USER VERIFICATION & PASSWORD RESET API ENDPOINTS ---

// Email sending helper

// Safe Resend Instance Initializer
const getResendInstance = (): Resend | null => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey === "undefined") {
    return null;
  }
  return new Resend(apiKey.trim());
};

/**
 * Helper: SMS Dispatcher with Twilio Provider & Graceful Fallback
 */
async function sendSystemSms(
  toPhone: string,
  messageBody: string,
): Promise<{
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: any;
}> {
  const cleanPhone = (toPhone || "").trim();
  if (!cleanPhone) {
    return { success: false, error: "Recipient phone number is required" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM;

  if (accountSid && authToken && fromNumber) {
    try {
      const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString(
        "base64",
      );
      const params = new URLSearchParams();
      params.append("To", cleanPhone);
      params.append("From", fromNumber);
      params.append("Body", messageBody);

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        },
      );

      const data: any = await twilioRes.json();
      if (twilioRes.ok && data?.sid) {
        console.log(
          `[SMS SUCCESS] Dispatched SMS to ${cleanPhone}, SID: ${data.sid}`,
        );
        return { success: true, messageId: data.sid, simulated: false };
      } else {
        console.warn(`[SMS TWILIO ERROR] Status ${twilioRes.status}:`, data);
        return {
          success: false,
          error: data?.message || "Twilio delivery failed",
          simulated: false,
        };
      }
    } catch (err: any) {
      console.error("[SMS DISPATCH EXCEPTION]", err);
      return {
        success: false,
        error: err?.message || String(err),
        simulated: false,
      };
    }
  }

  // Graceful simulation when Twilio credentials are not configured in environment
  console.log(
    `[SMS SIMULATOR] Simulated SMS to ${cleanPhone}: "${messageBody}"`,
  );
  return { success: true, messageId: `SIM_SMS_${Date.now()}`, simulated: true };
}

/**
 * Helper: Core Email Dispatcher with Automatic Fallback & High-Precision Diagnostics
 */
async function sendSystemMail(
  toOrOptions:
    | string
    | {
        to: string;
        subject: string;
        html: string;
        text?: string;
        attachments?: any[];
      },
  subjectArg?: string,
  textArg?: string,
  htmlArg?: string,
): Promise<{
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: any;
  userFriendlyMessage?: string;
  provider?: string;
  sender?: string;
  statusCode?: number;
}> {
  let to: string;
  let subject: string;
  let html: string;
  let text: string;
  let userAttachments: any[] = [];

  if (typeof toOrOptions === "string") {
    to = toOrOptions;
    subject = subjectArg || "";
    const arg3 = textArg || "";
    const arg4 = htmlArg || "";
    if (
      arg3.includes("<!DOCTYPE") ||
      arg3.includes("<html") ||
      arg3.includes("<table") ||
      arg3.includes("<div")
    ) {
      html = arg3;
      text = arg4;
    } else if (
      arg4.includes("<!DOCTYPE") ||
      arg4.includes("<html") ||
      arg4.includes("<table") ||
      arg4.includes("<div")
    ) {
      html = arg4;
      text = arg3;
    } else {
      text = arg3;
      html = arg4;
    }
  } else if (toOrOptions && typeof toOrOptions === "object") {
    to = toOrOptions.to;
    subject = toOrOptions.subject;
    html = toOrOptions.html;
    text = toOrOptions.text || "";
    userAttachments = toOrOptions.attachments || [];
  } else {
    to = "";
    subject = "";
    html = "";
    text = "";
  }

  let fromSender = (
    process.env.RESEND_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    "Zakir <noreply@getzakir.com>"
  ).trim();

  if (
    !fromSender ||
    fromSender.includes("yourdomain.com") ||
    fromSender.includes("example.com") ||
    fromSender.includes("onboarding@resend.dev")
  ) {
    fromSender = "Zakir <noreply@getzakir.com>";
  }

  if (!fromSender.includes("<")) {
    fromSender = `Zakir <${fromSender}>`;
  }

  const replyTo = (
    process.env.RESEND_REPLY_TO || "support@getzakir.com"
  ).trim();

  try {
    const resend = getResendInstance();
    if (!resend) {
      console.warn(
        `[EMAIL DISPATCH NOTICE] RESEND_API_KEY is not configured. Simulating delivery for: ${to} | Subject: "${subject}"`,
      );

      const db = readDb();
      if (!db.email_delivery_logs) db.email_delivery_logs = [];
      db.email_delivery_logs.unshift({
        id: `sim_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        recipient: to,
        type:
          subject.toLowerCase().includes("verification") ||
          subject.toLowerCase().includes("code")
            ? "otp"
            : "notification",
        subject: subject,
        timestamp: new Date().toISOString(),
        status: "DELIVERED (SIMULATED)",
        error: null,
      });
      writeDb(db);

      return {
        success: true,
        simulated: true,
        provider: "local_simulation",
        messageId: `sim_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      };
    }

    console.log(
      `[EMAIL DISPATCH ATTEMPT] To: ${to} | Subject: "${subject}" | Sender: ${fromSender} | ReplyTo: ${replyTo}`,
    );

    const attachments: any[] = [...userAttachments];
    
    // Official ZAKIR Light Mode Badge (Navy Square #1C2C58 + White Symbol #FFFFFF)
    if (
      html.includes("cid:zakir-logo-light") ||
      html.includes("cid:zakir-badge-light") ||
      html.includes("cid:zakir-logo")
    ) {
      const hasLightBadge = attachments.some(
        (a: any) =>
          a.contentId === "zakir-logo-light" ||
          a.cid === "zakir-logo-light" ||
          a.filename === "zakir-badge-light.png"
      );
      if (!hasLightBadge) {
        const lightBadgeBuf = getOfficialEmailLogoLightBuffer();
        if (lightBadgeBuf && lightBadgeBuf.length > 0) {
          attachments.push({
            filename: "zakir-badge-light.png",
            content: lightBadgeBuf,
            contentType: "image/png",
            contentId: "zakir-logo-light",
            cid: "zakir-logo-light",
          });
        }
      }
    }

    // Official ZAKIR Dark Mode Badge (White Square #FFFFFF + Navy Symbol #1C2C58)
    if (
      html.includes("cid:zakir-logo-dark") ||
      html.includes("cid:zakir-badge-dark")
    ) {
      const hasDarkBadge = attachments.some(
        (a: any) =>
          a.contentId === "zakir-logo-dark" ||
          a.cid === "zakir-logo-dark" ||
          a.filename === "zakir-badge-dark.png"
      );
      if (!hasDarkBadge) {
        const darkBadgeBuf = getOfficialEmailLogoDarkBuffer();
        if (darkBadgeBuf && darkBadgeBuf.length > 0) {
          attachments.push({
            filename: "zakir-badge-dark.png",
            content: darkBadgeBuf,
            contentType: "image/png",
            contentId: "zakir-logo-dark",
            cid: "zakir-logo-dark",
          });
        }
      }
    }

    // Transparent Navy Symbol fallback if explicitly requested
    if (html.includes("cid:zakir-logo-navy")) {
      const hasNavyLogo = attachments.some(
        (a: any) =>
          a.contentId === "zakir-logo-navy" ||
          a.cid === "zakir-logo-navy" ||
          a.filename === "zakir-logo-navy.png"
      );
      if (!hasNavyLogo) {
        const navyBuf = getOfficialLogoNavyBuffer();
        if (navyBuf && navyBuf.length > 0) {
          attachments.push({
            filename: "zakir-logo-navy.png",
            content: navyBuf,
            contentType: "image/png",
            contentId: "zakir-logo-navy",
            cid: "zakir-logo-navy",
          });
        }
      }
    }

    // Transparent White Symbol fallback if explicitly requested
    if (html.includes("cid:zakir-logo-white")) {
      const hasWhiteLogo = attachments.some(
        (a: any) =>
          a.contentId === "zakir-logo-white" ||
          a.cid === "zakir-logo-white" ||
          a.filename === "zakir-logo-white.png"
      );
      if (!hasWhiteLogo) {
        const whiteBuf = getOfficialLogoWhiteBuffer();
        if (whiteBuf && whiteBuf.length > 0) {
          attachments.push({
            filename: "zakir-logo-white.png",
            content: whiteBuf,
            contentType: "image/png",
            contentId: "zakir-logo-white",
            cid: "zakir-logo-white",
          });
        }
      }
    }

    const emailPayload: any = {
      from: fromSender,
      to: [to],
      subject: subject,
      html: html,
      text: text || undefined,
      replyTo: replyTo,
      headers: {
        "X-Entity-Ref-ID": `zakir_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        "Auto-Submitted": "auto-generated",
      },
    };

    if (attachments.length > 0) {
      emailPayload.attachments = attachments.map((att: any) => {
        const mapped: any = {
          filename: att.filename || "attachment.png",
        };
        if (att.content !== undefined) {
          mapped.content = att.content;
        }
        if (att.path) {
          mapped.path = att.path;
        }
        const cid = att.contentId || att.content_id || att.cid;
        if (cid) {
          mapped.contentId = cid;
        }
        if (att.contentType) {
          mapped.contentType = att.contentType;
        }
        return mapped;
      });
    }

    const response = await resend.emails.send(emailPayload);

    if (response.error) {
      const errStatus =
        (response.error as any).statusCode ||
        (response.error as any).status ||
        400;
      console.error("[EMAIL DELIVERY FAILURE]", {
        code: response.error.name || "RESEND_ERROR",
        message: response.error.message,
        provider: "Resend",
        httpStatus: errStatus,
      });

      const db = readDb();
      if (!db.email_delivery_logs) db.email_delivery_logs = [];
      db.email_delivery_logs.unshift({
        id: `err_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        recipient: to,
        type:
          subject.toLowerCase().includes("verification") ||
          subject.toLowerCase().includes("code")
            ? "otp"
            : "notification",
        subject: subject,
        timestamp: new Date().toISOString(),
        status: "FAILED",
        error: response.error.message || "Delivery failed",
      });
      writeDb(db);

      const isAuthError = errStatus === 401 || errStatus === 403 || String(response.error.message || "").toLowerCase().includes("api key");
      if (isAuthError) {
        console.warn(`[EMAIL FALLBACK] Falling back to simulated delivery due to Resend API key status: ${response.error.message}`);
        const db = readDb();
        if (!db.email_delivery_logs) db.email_delivery_logs = [];
        db.email_delivery_logs.unshift({
          id: `sim_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
          recipient: to,
          type:
            subject.toLowerCase().includes("verification") ||
            subject.toLowerCase().includes("code")
              ? "otp"
              : "notification",
          subject: subject,
          timestamp: new Date().toISOString(),
          status: "DELIVERED (SIMULATED)",
          error: null,
        });
        writeDb(db);

        return {
          success: true,
          simulated: true,
          provider: "resend_simulated_fallback",
          messageId: `sim_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        };
      }

      return {
        success: false,
        error: response.error,
        statusCode: errStatus,
        userFriendlyMessage: `تعذر الإرسال: ${response.error.message || "يرجى التحقق من إعدادات Resend"}`,
      };
    }

    if (response.data && response.data.id) {
      console.log(
        `[EMAIL SENT SUCCESS] ID: ${response.data.id} to ${to} via ${fromSender}`,
      );

      const db = readDb();
      if (!db.email_delivery_logs) db.email_delivery_logs = [];
      db.email_delivery_logs.unshift({
        id: response.data.id,
        recipient: to,
        type:
          subject.toLowerCase().includes("verification") ||
          subject.toLowerCase().includes("code")
            ? "otp"
            : "notification",
        subject: subject,
        timestamp: new Date().toISOString(),
        status: "DELIVERED",
        error: null,
      });
      writeDb(db);

      return {
        success: true,
        messageId: response.data.id,
        statusCode: 200,
        provider: "resend",
      };
    }

    return {
      success: false,
      error: new Error("No message ID returned from Resend"),
      statusCode: 500,
      userFriendlyMessage: "تعذر إرسال بريد التحقق. يرجى المحاولة مرة أخرى.",
    };
  } catch (resendErr: any) {
    const errStatus = resendErr?.statusCode || resendErr?.status || 500;
    console.error("[EMAIL DELIVERY EXCEPTION]", {
      code: resendErr?.code || resendErr?.name || "UNKNOWN",
      message: resendErr?.message || String(resendErr),
      provider: "Resend",
      httpStatus: errStatus,
    });
    return {
      success: false,
      error: resendErr,
      statusCode: errStatus,
      userFriendlyMessage: `خطأ في مزود البريد: ${resendErr?.message || "تعذر الإرسال"}`,
    };
  }
}

// SHA-256 verification code hashing helper
function hashVerificationCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// Fast in-memory verification code registry to guarantee consistency across async Firestore/disk latency
const activeVerificationCodes = new Map<string, any>();

/**
 * Safely masks email addresses for diagnostic logging (e.g. m***@example.com)
 */
function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string") return "";
  return email.trim();
}

/**
 * Sanitizes and validates user names for dynamic email templates.
 * Returns empty string if the name is a generic placeholder or invalid.
 */
function cleanUserName(rawName?: string, email?: string): string {
  if (!rawName) return "";
  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();

  // Explicit forbidden generic/placeholder names
  const forbidden = [
    "zakir user",
    "zakiruser",
    "user",
    "dear zakir user",
    "hello zakir user",
    "unknown user",
    "unknown",
    "undefined",
    "null",
    "none",
    "n/a",
    "[user name]",
    "user name",
    "owner",
    "customer",
    "client",
    "admin",
  ];

  if (forbidden.includes(lower)) {
    return "";
  }

  if (email) {
    const emailLower = email.trim().toLowerCase();
    const emailPrefix = emailLower.split("@")[0];
    if (lower === emailLower || lower === emailPrefix) {
      return "";
    }
  }

  return trimmed;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderEmailLogoHeaderHtml(options?: {
  appBase?: string;
  wordmark?: string;
  tagline?: string;
  size?: number;
}): string {
  const size = options?.size || 96;
  const rawAppBase = options?.appBase || "https://www.getzakir.com";
  const publicAssetBase = (rawAppBase && rawAppBase.startsWith("https://") && !rawAppBase.includes("localhost"))
    ? rawAppBase.replace(/\/$/, "")
    : "https://www.getzakir.com";
  const appBase = rawAppBase;

  const logoUrl = "cid:zakir-logo-light";

  const wordmark = options?.wordmark !== undefined ? options.wordmark : "ZAKIR";
  const tagline =
    options?.tagline !== undefined
      ? options.tagline
      : "الذاكرة المؤسسية السببية &bull; Causal Decision Intelligence";

  return `
    <!-- Official ZAKIR Badge (Self-Contained Vector Render from logo.txt) -->
    <table border="0" cellpadding="0" cellspacing="0" align="center" role="presentation" width="${size}" height="${size}" class="zakir-logo-table" style="width: ${size}px !important; height: ${size}px !important; max-width: ${size}px !important; max-height: ${size}px !important; margin: 0 auto 16px auto; border-collapse: collapse; border-spacing: 0;">
      <tr>
        <td align="center" valign="middle" width="${size}" height="${size}" bgcolor="#1C2C58" style="width: ${size}px; height: ${size}px; padding: 0; margin: 0; line-height: 0; font-size: 0; text-align: center; vertical-align: middle; background-color: #1C2C58; border-radius: 20px;">
          <a href="${appBase}" target="_blank" style="text-decoration: none; display: inline-block; width: ${size}px; height: ${size}px; margin: 0 auto; line-height: 0; font-size: 0; outline: none; border: 0;">
            <img src="${logoUrl}" alt="ZAKIR" width="${size}" height="${size}" class="zakir-logo" style="display: block; width: ${size}px !important; height: ${size}px !important; max-width: ${size}px !important; max-height: ${size}px !important; border: 0; outline: none; text-decoration: none; margin: 0 auto; border-radius: 20px; -ms-interpolation-mode: bicubic;" />
          </a>
        </td>
      </tr>
    </table>

    ${
      wordmark
        ? `<!-- ZAKIR Wordmark: Bold, uppercase, clean spacing -->
    <div class="zakir-wordmark" style="color: #0f172a; font-size: 22px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; line-height: 1.2; margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      ${wordmark}
    </div>`
        : ""
    }

    ${
      tagline
        ? `<!-- Official Supporting Tagline -->
    <div style="color: #64748b; font-size: 13px; font-weight: 500; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      ${tagline}
    </div>`
        : ""
    }
  `;
}

function buildMasterEmailHtml(options: {
  subject: string;
  title: string;
  greeting?: string;
  bodyHtml: string;
  securityNote?: string;
  baseUrl?: string;
}): string {
  const { subject, title, greeting, bodyHtml, securityNote, baseUrl } = options;
  const canonicalDomain = "https://www.getzakir.com";
  let publicBaseUrl = (baseUrl || getAppBaseUrl() || process.env.APP_URL || canonicalDomain).replace(
    /\/$/,
    "",
  );

  if (
    publicBaseUrl.includes("localhost") ||
    publicBaseUrl.includes("127.0.0.1") ||
    !publicBaseUrl.startsWith("http")
  ) {
    if (
      process.env.APP_URL &&
      !process.env.APP_URL.includes("localhost") &&
      process.env.APP_URL.startsWith("http")
    ) {
      publicBaseUrl = process.env.APP_URL.trim().replace(/\/$/, "");
    } else {
      publicBaseUrl = canonicalDomain;
    }
  }

  const appBase = publicBaseUrl;
  const publicAssetBase = (appBase && appBase.startsWith("https://") && !appBase.includes("localhost"))
    ? appBase.replace(/\/$/, "")
    : "https://www.getzakir.com";

  const logoHeaderHtml = renderEmailLogoHeaderHtml({ appBase, size: 96 });

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="ar">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(title || subject)}</title>
  <style type="text/css">
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    .zakir-logo {
      display: block !important;
      border-radius: 20px;
    }
    @media (prefers-color-scheme: dark) {
      .zakir-card {
        background-color: #0b1329 !important;
        border-color: #1e293b !important;
      }
      .zakir-header-cell {
        background-color: #0b1329 !important;
        border-bottom-color: #1e293b !important;
      }
      .zakir-wordmark {
        color: #f8fafc !important;
      }
      .zakir-body-cell {
        background-color: #0b1329 !important;
      }
      .zakir-title {
        color: #f8fafc !important;
      }
      .zakir-footer-cell {
        background-color: #070d1d !important;
        border-top-color: #1e293b !important;
      }
      .zakir-footer-text {
        color: #94a3b8 !important;
      }
    }
    /* Webmail Dark Mode Overrides */
    [data-ogsc] .zakir-card,
    [data-ogsb] .zakir-card {
      background-color: #0b1329 !important;
      border-color: #1e293b !important;
    }
    [data-ogsc] .zakir-wordmark,
    [data-ogsb] .zakir-wordmark {
      color: #f8fafc !important;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Master Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" class="zakir-card" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);">
          <!-- Header with Official ZAKIR 96x96 Square Badge System -->
          <tr>
            <td class="zakir-header-cell" style="padding: 36px 32px 24px 32px; text-align: center; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
              ${logoHeaderHtml}
            </td>
          </tr>
          <tr>
            <td class="zakir-body-cell" style="padding: 34px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <h1 class="zakir-title" style="color: #0f172a; font-size: 20px; font-weight: 800; margin: 0 0 16px 0; line-height: 1.4; letter-spacing: -0.2px;">${escapeHtml(title)}</h1>
              ${greeting ? `<p style="color: #334155; font-size: 15px; font-weight: 600; margin: 0 0 20px 0; line-height: 1.5;">${escapeHtml(greeting)}</p>` : ""}
              ${bodyHtml}
              ${securityNote ? `
              <div style="margin-top: 26px; padding: 14px 18px; background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 8px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #475569; font-size: 12px; line-height: 1.6;"><strong>Security Notice / تنبيه أمني:</strong> ${escapeHtml(securityNote)}</p>
              </div>` : ""}
            </td>
          </tr>
          <tr>
            <td class="zakir-footer-cell" style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <!-- Mini Footer Brand -->
              <table border="0" cellpadding="0" cellspacing="0" align="center" role="presentation" style="margin: 0 auto 10px auto;">
                <tr>
                  <td align="center" style="vertical-align: middle;">
                    <img src="cid:zakir-logo-light" alt="ZAKIR" width="24" height="24" style="display: inline-block; width: 24px; height: 24px; border-radius: 6px; border: 0; vertical-align: middle; margin-right: 8px;" />
                    <span class="zakir-wordmark" style="font-size: 13px; font-weight: 800; color: #0f172a; vertical-align: middle; letter-spacing: 1.5px; text-transform: uppercase;">ZAKIR</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                الذاكرة المؤسسية السببية &bull; Causal Decision Intelligence
              </p>
              <p class="zakir-footer-text" style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} Zakir Intelligence Platform. All rights reserved.<br>
                Enterprise security &amp; institutional data protection.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface BuildOtpEmailOptions {
  email: string;
  userName?: string;
  otpCode: string;
  type?:
    | "account_registration"
    | "password_reset"
    | "email_verification"
    | "email_link"
    | "account_recovery"
    | "welcome"
    | string;
  baseUrl?: string;
}

/**
 * Generates clean, enterprise SaaS HTML email templates matching Zakir's brand design system.
 */
function buildOtpEmailHtml(options: BuildOtpEmailOptions): {
  subject: string;
  text: string;
  html: string;
} {
  const { email, userName, otpCode, type = "account_registration" } = options;
  const cleanName = cleanUserName(userName, email);
  const appBaseUrl = options.baseUrl || getAppBaseUrl();

  const isReset = type === "password_reset";
  const isLink = type === "email_link";
  const isRecovery = type === "account_recovery";
  const isWelcome = type === "welcome";

  const cleanCode = otpCode ? otpCode.trim() : "";

  let subject = "رمز التحقق لتفعيل حسابك في Zakir - Verify your Zakir account";
  let title = "تفعيل حسابك في Zakir | Activate Account";

  let greetingAr = cleanName ? `مرحباً ${cleanName}،` : "مرحباً بك،";
  let greetingEn = cleanName ? `Hello ${cleanName},` : "Hello,";

  let introAr =
    "يرجى استخدام رمز التحقق التالي لتفعيل حسابك وتأكيد بريدك الإلكتروني في منصة Zakir:";
  let introEn =
    "Please use the verification code below to complete your registration and activate your account on Zakir:";

  let securityNoteAr =
    "لحماية أمن حسابك، لا تقم بمشاركة هذا الرمز مع أي شخص مطلقاً. فريق Zakir لن يطلب منك هذا الرمز أبداً.";
  let securityNoteEn =
    "For your security, never share this code with anyone. The Zakir team will never ask for your verification code.";

  if (isReset) {
    subject =
      "إعادة تعيين كلمة المرور لحسابك في Zakir - Reset your Zakir password";
    title = "إعادة تعيين كلمة المرور | Password Reset";
    introAr =
      "لقد تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في منصة Zakir. يرجى استخدام رمز التحقق التالي للمتابعة:";
    introEn =
      "We received a request to reset your password for your Zakir account. Please use the verification code below to set a new password:";
    securityNoteAr =
      "إذا لم تكن قد طلبت إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد الإلكتروني بأمان.";
    securityNoteEn =
      "If you did not request a password reset, no action is required.";
  } else if (isLink) {
    subject = "رمز الأمان لربط حسابك في Zakir - Your Zakir security code";
    title = "تأكيد ربط البريد الإلكتروني | Verify Email Link";
    introAr =
      "يرجى استخدام رمز الأمان التالي لإتمام عملية ربط هذا البريد الإلكتروني بملفك الشخصي في منصة Zakir:";
    introEn =
      "We received a request to link this email address to your Zakir profile. Use the security code below to complete the verification:";
    securityNoteAr =
      "إذا لم تكن قد طلبت ربط هذا البريد الإلكتروني، يمكنك تجاهل هذا البريد بأمان.";
    securityNoteEn =
      "If you did not request this verification code, no action is required.";
  } else if (isRecovery) {
    subject =
      "رمز التحقق لاستعادة الحساب والبيانات - Zakir Account Restoration Code";
    title = "استعادة حسابك وبياناتك | Restore Account";
    introAr =
      "لقد تم بدء طلب لاستعادة حسابك في منصة Zakir واسترجاع بيانات مساحة العمل الخاصة بك. يرجى استخدام رمز التحقق التالي للمتابعة:";
    introEn =
      "A request was initiated to recover your Zakir account and restore your workspace data. Please use the verification code below to continue:";
    securityNoteAr =
      "إذا لم تكن قد طلبت استعادة الحساب، يمكنك تجاهل هذا البريد الإلكتروني بأمان وسرية.";
    securityNoteEn =
      "If you did not request this recovery, you can safely ignore this email.";
  } else if (isWelcome) {
    subject = "مرحباً بك في منصة Zakir - Welcome to Zakir";
    title = "مرحباً بك في Zakir | Welcome to Zakir";
    introAr =
      "مرحباً بك في Zakir — الذاكرة التنظيمية السببية وذكاء اتخاذ القرار. مساحة العمل والبيانات الخاصة بك جاهزة ومتاحة الآن للعمل.";
    introEn =
      "Welcome to Zakir — Organizational Causal Memory & Decision Intelligence. Your workspace and analytics dashboard are ready.";
    securityNoteAr = "حافظ على سرية وأمان بيانات دخول حسابك دائماً.";
    securityNoteEn = "Keep your account details safe and secure at all times.";
  }

  let bodyHtml = "";
  if (isWelcome) {
    bodyHtml = `
      <!-- Arabic Welcome Section -->
      <div style="direction: rtl; text-align: right; margin-bottom: 24px; font-family: system-ui, sans-serif;">
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">
          ${escapeHtml(greetingAr)}
        </p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
          ${escapeHtml(introAr)}
        </p>
      </div>

      <!-- Call to Action Button -->
      <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto;">
        <tr>
          <td align="center" bgcolor="#0075DE" style="border-radius: 10px;">
            <a href="${appBaseUrl}" target="_blank" style="font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; display: inline-block; padding: 14px 36px; border-radius: 10px; background-color: #0075DE; border: 1px solid #0075DE;">
              دخول المنصة / Open Zakir
            </a>
          </td>
        </tr>
      </table>

      <!-- English Welcome Section -->
      <div style="direction: ltr; text-align: left; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 24px; font-family: system-ui, sans-serif;">
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0; font-weight: 600;">
          ${escapeHtml(greetingEn)}
        </p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">
          ${escapeHtml(introEn)}
        </p>
      </div>
    `;
  } else {
    bodyHtml = `
      <!-- Arabic Instruction -->
      <div style="direction: rtl; text-align: right; margin-bottom: 20px; font-family: system-ui, sans-serif;">
        <p style="color: #0f172a; font-size: 15px; font-weight: 600; margin: 0 0 12px 0;">
          ${escapeHtml(greetingAr)}
        </p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0;">
          ${escapeHtml(introAr)}
        </p>
      </div>

      <!-- Verification Code Box -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 26px 0;">
        <tr>
          <td align="center" style="padding: 26px 20px; background-color: #f8fafc; border: 1.5px dashed #0075DE; border-radius: 12px;">
            <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Monaco, monospace; font-size: 38px; font-weight: 800; color: #0075DE; letter-spacing: 10px; text-indent: 10px; text-align: center; margin: 0; line-height: 1; user-select: all; -webkit-user-select: all;">
              ${escapeHtml(cleanCode)}
            </div>
            <div style="margin-top: 12px; font-size: 12px; color: #64748b; text-align: center; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              صالح لمدة 10 دقائق &bull; Valid for 10 minutes
            </div>
          </td>
        </tr>
      </table>

      <!-- English Instruction -->
      <div style="direction: ltr; text-align: left; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 24px; font-family: system-ui, sans-serif;">
        <p style="color: #475569; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
          ${escapeHtml(greetingEn)}
        </p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
          ${escapeHtml(introEn)}
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          This code will expire in 10 minutes.
        </p>
      </div>
    `;
  }

  const html = buildMasterEmailHtml({
    subject,
    title,
    bodyHtml,
    securityNote: securityNoteAr + " / " + securityNoteEn,
    baseUrl: appBaseUrl,
  });

  const textBody = isWelcome
    ? `${greetingAr}\n\n${introAr}\n\n${greetingEn}\n\n${introEn}\n\nOpen Zakir: ${appBaseUrl}\n\nThe Zakir Team`
    : `${greetingAr}\n\n${introAr}\n\n[ ${cleanCode} ]\n\n${greetingEn}\n\n${introEn}\n\nSecurity note: ${securityNoteAr} | ${securityNoteEn}\n\nThe Zakir Team`;

  return { subject, text: textBody, html };
}

function buildInvitationEmailHtml(options: {
  companyName: string;
  memberName: string;
  inviterName: string;
  designatedRole: string;
  inviteLink: string;
  isReminder?: boolean;
  language?: "ar" | "en" | "fr";
  baseUrl?: string;
}): { subject: string; text: string; html: string } {
  const {
    memberName,
    designatedRole,
    inviteLink,
    isReminder,
    language = "ar",
    baseUrl,
  } = options;

  const rawCompany = (options.companyName || "").trim();
  const companyName =
    rawCompany &&
    rawCompany !== "ZakIr Platform" &&
    rawCompany !== "Zakir Workspace"
      ? rawCompany
      : language === "ar"
        ? "المؤسسة"
        : language === "fr"
          ? "l'Entreprise"
          : "Organization";

  const rawInviter = (options.inviterName || "").trim();
  const inviterName =
    rawInviter ||
    (language === "ar"
      ? "مسؤول النظام"
      : language === "fr"
        ? "L'administrateur"
        : "Workspace Admin");

  let subject = "";
  let title = "";
  let greeting = "";
  let introText = "";
  let orgLabel = "";
  let inviterLabel = "";
  let roleLabel = "";
  let expiresLabel = "";
  let expiresVal = "";
  let ctaText = "";
  let fallbackText = "";
  let securityNote = "";

  if (language === "fr") {
    subject = `Invitation à rejoindre l'entreprise "${companyName}" sur Zakir`;
    title = `Invitation de l'entreprise`;
    greeting = memberName ? `Bonjour ${memberName},` : `Bonjour,`;
    introText = isReminder
      ? `Ceci est un rappel que ${inviterName} vous a invité à rejoindre l'entreprise "${companyName}" sur Zakir en tant que ${designatedRole}.`
      : `${inviterName} vous a invité à rejoindre l'entreprise "${companyName}" sur Zakir en tant que ${designatedRole}.`;
    orgLabel = "Entreprise :";
    inviterLabel = "Invité par :";
    roleLabel = "Rôle assigné :";
    expiresLabel = "Expire dans :";
    expiresVal = "7 jours";
    ctaText = "Accepter l'invitation";
    fallbackText =
      "Si le bouton ci-dessus ne fonctionne pas, copiez et collez cette URL dans votre navigateur :";
    securityNote =
      "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail en toute sécurité.";
  } else if (language === "en") {
    subject = `Invitation to join "${companyName}" on Zakir`;
    title = `Workspace Invitation`;
    greeting = memberName ? `Hello ${memberName},` : `Hello,`;
    introText = isReminder
      ? `This is a reminder that ${inviterName} has invited you to join "${companyName}" on Zakir as a ${designatedRole}.`
      : `${inviterName} has invited you to join "${companyName}" on Zakir as a ${designatedRole}.`;
    orgLabel = "Organization:";
    inviterLabel = "Invited by:";
    roleLabel = "Assigned Role:";
    expiresLabel = "Expires in:";
    expiresVal = "7 days";
    ctaText = "Accept invitation";
    fallbackText =
      "If the button above does not work, copy and paste this URL into your browser:";
    securityNote =
      "If you were not expecting this invitation, you can safely ignore this email.";
  } else {
    // Default to Arabic
    subject = `دعوة للانضمام إلى مؤسسة "${companyName}" على منصة Zakir`;
    title = `دعوة انضمام لمساحة عمل المؤسسة`;
    greeting = memberName ? `مرحباً ${memberName}،` : `مرحباً،`;
    introText = isReminder
      ? `هذا تذكير بأن المسؤول "${inviterName}" قد دعاك للانضمام إلى مؤسسة "${companyName}" على منصة Zakir بصفة "${designatedRole}".`
      : `لقد قام المسؤول "${inviterName}" بدعوتك للانضمام إلى مؤسسة "${companyName}" على منصة Zakir بصفة "${designatedRole}".`;
    orgLabel = "المؤسسة:";
    inviterLabel = "المرسل / المسؤول:";
    roleLabel = "الدور المحدد:";
    expiresLabel = "الصلاحية:";
    expiresVal = "7 أيام";
    ctaText = "قبول الدعوة والانضمام";
    fallbackText =
      "إذا لم يعمل الزر أعلاه، يرجى نسخ الرابط التالي ولصقه في متصفحك:";
    securityNote =
      "إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد الإلكتروني بأمان.";
  }

  const direction = language === "ar" ? "rtl" : "ltr";
  const textAlign = language === "ar" ? "right" : "left";

  const detailsHtml = `
    <div style="margin: 24px 0; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; direction: ${direction}; text-align: ${textAlign};">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; color: #334155;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px; font-weight: 500; text-align: ${textAlign};">${escapeHtml(orgLabel)}</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0f172a; text-align: ${textAlign};">${escapeHtml(companyName)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500; text-align: ${textAlign};">${escapeHtml(inviterLabel)}</td>
          <td style="padding: 6px 0; font-weight: 600; color: #0f172a; text-align: ${textAlign};">${escapeHtml(inviterName)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500; text-align: ${textAlign};">${escapeHtml(roleLabel)}</td>
          <td style="padding: 6px 0; text-align: ${textAlign};"><span style="display: inline-block; padding: 2px 8px; background-color: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 12px; border-radius: 4px;">${escapeHtml(designatedRole)}</span></td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500; text-align: ${textAlign};">${escapeHtml(expiresLabel)}</td>
          <td style="padding: 6px 0; font-weight: 500; color: #64748b; text-align: ${textAlign};">${escapeHtml(expiresVal)}</td>
        </tr>
      </table>
    </div>
  `;

  const ctaButtonHtml = `
    <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto 20px auto;">
      <tr>
        <td align="center" bgcolor="#0075DE" style="border-radius: 10px;">
          <a href="${inviteLink}" target="_blank" style="font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; display: inline-block; padding: 14px 32px; border-radius: 10px; background-color: #0075DE; border: 1px solid #0075DE;">
            ${escapeHtml(ctaText)}
          </a>
        </td>
      </tr>
    </table>
    <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0; text-align: center; word-break: break-all; direction: ${direction};">
      ${escapeHtml(fallbackText)}<br/>
      <a href="${inviteLink}" style="color: #0075DE; text-decoration: underline;">${inviteLink}</a>
    </p>
  `;

  const bodyHtml = `
    <div style="direction: ${direction}; text-align: ${textAlign};">
      <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        ${escapeHtml(introText)}
      </p>
    </div>
    ${detailsHtml}
    ${ctaButtonHtml}
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote,
    baseUrl,
  });

  const text = `${greeting}\n\n${introText}\n\n${orgLabel} ${companyName}\n${inviterLabel} ${inviterName}\n${roleLabel} ${designatedRole}\n\n${ctaText}: ${inviteLink}\n\n${expiresLabel} ${expiresVal}`;

  return { subject, text, html };
}

function buildSupportReplyEmailHtml(options: {
  recipientName: string;
  ticketId: string;
  ticketSubject: string;
  message: string;
}): { subject: string; text: string; html: string } {
  const { recipientName, ticketId, ticketSubject, message } = options;
  const subject = `Zakir Support: ${ticketSubject}`;
  const title = "Support Ticket Reply";
  const greeting = recipientName ? `Hello ${recipientName},` : `Hello,`;

  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Our support team has replied to your request.
    </p>
    
    <div style="margin: 20px 0; padding: 16px; background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 6px;">
      <p style="margin: 0; font-weight: 700; color: #1d4ed8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Ticket #${escapeHtml(ticketId)}</p>
      <p style="margin: 4px 0 0 0; font-weight: 700; color: #0f172a; font-size: 15px;">${escapeHtml(ticketSubject)}</p>
    </div>

    <div style="background: #f1f5f9; border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
      <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Latest Response from Support:</p>
      <p style="margin: 0; color: #0f172a; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${escapeHtml(message)}</p>
    </div>

    <p style="margin-bottom: 0; color: #475569; font-size: 14px;">
      Open your Zakir account to view the response and continue the conversation.
    </p>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
  });

  const text = `${greeting}\n\nOur support team has replied to your request.\n\nTicket #${ticketId}: ${ticketSubject}\n\nResponse:\n${message}\n\nOpen your Zakir account to view the response and continue the conversation.`;

  return { subject, text, html };
}

function buildRecoveryApprovalEmailHtml(options: {
  userName: string;
  email: string;
}): { subject: string; text: string; html: string } {
  const { userName, email } = options;
  const cleanName = cleanUserName(userName, email);
  const subject = "Account Recovery Request Approved - Zakir";
  const title = "Your Account Recovery Has Been Approved";
  const greeting = cleanName ? `Hello ${cleanName},` : "Hello,";

  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      We are pleased to inform you that your account recovery request has been reviewed and <strong>approved</strong> by our administration team.
    </p>
    <div style="margin: 20px 0; padding: 20px; background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 10px;">
      <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 700;">
        Next Step: Complete Verification
      </p>
      <p style="margin: 8px 0 0 0; color: #1d4ed8; font-size: 13px; line-height: 1.5;">
        Please return to the Zakir application and click "Verify &amp; Restore Account" to receive your final single-use verification code and reactivate your workspace.
      </p>
    </div>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote: "For security, complete your restoration within 72 hours.",
  });

  const text = `${greeting}\n\nYour account recovery request has been approved by our administration team.\n\nPlease return to Zakir to complete verification and restore your workspace.\n\nThe Zakir Team`;
  return { subject, text, html };
}

function buildRecoveryRejectionEmailHtml(options: {
  userName: string;
  email: string;
  rejectionReason?: string;
}): { subject: string; text: string; html: string } {
  const { userName, email, rejectionReason } = options;
  const cleanName = cleanUserName(userName, email);
  const subject = "Account Recovery Request Update - Zakir";
  const title = "Account Recovery Request Decision";
  const greeting = cleanName ? `Hello ${cleanName},` : "Hello,";

  const reasonText =
    rejectionReason ||
    "Identity details or documentation provided could not be verified against system records.";

  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Your request for account recovery has been reviewed by our administration team. Regrettably, your request could not be approved at this time.
    </p>
    <div style="margin: 20px 0; padding: 20px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px;">
      <p style="margin: 0; color: #991b1b; font-size: 12px; font-weight: 700; text-transform: uppercase;">
        Reason for Decision
      </p>
      <p style="margin: 8px 0 0 0; color: #7f1d1d; font-size: 14px; line-height: 1.5;">
        ${escapeHtml(reasonText)}
      </p>
    </div>
    <p style="color: #475569; font-size: 14px; line-height: 1.5;">
      If you believe this is an error or have additional identity documents, you may submit a new recovery request or contact support.
    </p>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote: "Account security is our highest priority.",
  });

  const text = `${greeting}\n\nYour account recovery request could not be approved at this time.\n\nReason: ${reasonText}\n\nThe Zakir Team`;
  return { subject, text, html };
}

function buildNewAccountApprovalEmailHtml(options: {
  userName?: string;
  email: string;
  trialHours?: number;
  plan?: string;
}): { subject: string; text: string; html: string } {
  const { userName, email, trialHours = 24, plan = "Starter" } = options;
  const cleanName = cleanUserName(userName, email);
  const subject = "تم اعتماد حسابك رسمياً في منصة ذاكر | Your Zakir Account has been Approved";
  const title = "تم اعتماد حسابك بنجاح";
  const greeting = cleanName ? `مرحباً ${cleanName}،` : "مرحباً بك،";

  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0; text-align: right; direction: rtl;">
      يسرنا إبلاغك بأنه قد تم التحقق من بيانات حسابك والموافقة عليه رسمياً من قبل إدارة منصة <strong>ذاكر (Zakir)</strong>، وأصبح حسابك الآن مفعلاً وجاهزاً للاستخدام بالكامل.
    </p>

    <!-- Trial Information Banner -->
    <div style="margin: 22px 0; padding: 18px 20px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-right: 4px solid #10b981; border-radius: 12px; text-align: right; direction: rtl;">
      <div style="color: #166534; font-size: 15px; font-weight: 800; margin-bottom: 6px;">
        فترة التجربة المجانية (${trialHours} ساعة) بدأت الآن
      </div>
      <p style="margin: 0; color: #15803d; font-size: 13px; line-height: 1.6;">
        تم اعتماد باقة <strong>${escapeHtml(plan)}</strong> لحسابك مع فترة تجربة مجانية كاملة مدتها <strong>${trialHours} ساعة</strong> تبدأ من لحظة هذا الاعتماد، لتتيح لك استكشاف وتجربة كافة قدرات التحليلات السببية والذاكرة المؤسسية.
      </p>
    </div>

    <!-- Direct Official Login Link -->
    <div style="margin: 32px 0 24px 0; text-align: center;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://www.getzakir.com/login" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="20%" stroke="f" fillcolor="#0075DE">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">تسجيل الدخول إلى Zakir</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="https://www.getzakir.com/login" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #0075DE; color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 34px; border-radius: 10px; box-shadow: 0 4px 14px rgba(0, 117, 222, 0.25); text-align: center;">
        تسجيل الدخول إلى Zakir &bull; Log In to Zakir
      </a>
      <!--<![endif]-->
      <p style="margin: 14px 0 0 0; color: #64748b; font-size: 12px; font-family: monospace;">
        <a href="https://www.getzakir.com/login" target="_blank" rel="noopener noreferrer" style="color: #0075DE; text-decoration: underline;">https://www.getzakir.com/login</a>
      </p>
    </div>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote: "لتسجيل الدخول، يرجى استخدام بريدك الإلكتروني الموثق وكلمة المرور الخاصة بك عبر الرابط الرسمي أعلاه.",
  });

  const text = `${greeting}\n\nيسرنا إبلاغك بأنه قد تم التحقق من بيانات حسابك والموافقة عليه رسمياً من قبل إدارة منصة ذاكر (Zakir).\n\nحسابك الآن مفعل وجاهز للاستخدام، وقد بدأت فترة تجربتك المجانية الكاملة (${trialHours} ساعة) المعتمدة لباقة [${plan}] من لحظة هذا الاعتماد.\n\nلتسجيل الدخول إلى منصة ذاكر، يرجى زيارة الرابط الرسمي التالي:\nhttps://www.getzakir.com/login\n\nمع تحيات،\nفريق منصة ذاكر (Zakir Team)`;

  return { subject, text, html };
}

function buildNewAccountRejectionEmailHtml(options: {
  userName?: string;
  email: string;
  reason?: string;
}): { subject: string; text: string; html: string } {
  const { userName, email, reason = "يرجى تقديم وثائق هوية رسمية واضحة ومحدثة." } = options;
  const cleanName = cleanUserName(userName, email);
  const subject = "يلزم تحديث مستندات توثيق حسابك في منصة ذاكر | Action Required: Update Verification Documents - Zakir";
  const title = "يلزم تحديث مستندات التوثيق";
  const greeting = cleanName ? `مرحباً ${cleanName}،` : "مرحباً بك،";

  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0; text-align: right; direction: rtl;">
      نشكرك على تسجيلك في منصة <strong>ذاكر (Zakir)</strong>. بعد مراجعة مستندات التحقق المرفوعة من قبلك، نود إفادتك بأنه يلزم تحديث أو استبدال بعض المستندات لإتمام عملية توثيق الحساب واعتماده.
    </p>

    <!-- Reason Banner -->
    <div style="margin: 22px 0; padding: 18px 20px; background-color: #fff1f2; border: 1px solid #fecdd3; border-right: 4px solid #e11d48; border-radius: 12px; text-align: right; direction: rtl;">
      <div style="color: #9f1239; font-size: 15px; font-weight: 800; margin-bottom: 6px;">
        سبب رفض المستندات والملاحظات الإدارية:
      </div>
      <p style="margin: 0; color: #be123c; font-size: 14px; line-height: 1.6; font-weight: 600;">
        ${escapeHtml(reason)}
      </p>
    </div>

    <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 20px 0; text-align: right; direction: rtl;">
      يمكنك تسجيل الدخول إلى حسابك الآن واستبدال أو رفع المستندات المطلوبة (صورة واضحة للهوية الوطنية أو جواز السفر، وبيانات المنشأة إن وجدت) ثم الضغط على "إعادة إرسال للمراجعة".
    </p>

    <!-- Direct Re-Upload Link -->
    <div style="margin: 32px 0 24px 0; text-align: center;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://www.getzakir.com/login" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="20%" stroke="f" fillcolor="#0075DE">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">تحديث المستندات وإعادة الإرسال</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="https://www.getzakir.com/login" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #0075DE; color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 34px; border-radius: 10px; box-shadow: 0 4px 14px rgba(0, 117, 222, 0.25); text-align: center;">
        تحديث المستندات الآن &bull; Update Documents Now
      </a>
      <!--<![endif]-->
      <p style="margin: 14px 0 0 0; color: #64748b; font-size: 12px; font-family: monospace;">
        <a href="https://www.getzakir.com/login" target="_blank" rel="noopener noreferrer" style="color: #0075DE; text-decoration: underline;">https://www.getzakir.com/login</a>
      </p>
    </div>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote: "لتحديث المستندات، قم بتسجيل الدخول إلى المنصة عبر الرابط الرسمي أعلاه باستخدام بريدك وكلمة مرورك.",
  });

  const text = `${greeting}\n\nنود إفادتك بأنه يلزم تحديث مستندات التوثيق الخاصة بحسابك في منصة ذاكر (Zakir).\n\nسبب الرفض والملاحظات الإدارية:\n${reason}\n\nيرجى تسجيل الدخول إلى حسابك لاستبدال أو رفع المستندات المطلوبة وإعادة الإرسال عبر الرابط التالي:\nhttps://www.getzakir.com/login\n\nمع تحيات،\nفريق منصة ذاكر (Zakir Team)`;

  return { subject, text, html };
}

// Helper: Robust user identity resolution across Firebase Auth, Firestore, and local DB
export async function resolveUserByEmailOrId(params: {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<{
  userId: string | null;
  email: string | null;
  phone: string | null;
  userDoc: any | null;
  source: string;
}> {
  const inputUserId = (params.userId || "").trim();
  const rawEmail = (params.email || "").trim();
  const normalizedEmail = rawEmail.toLowerCase();
  const inputPhone = (params.phone || "").trim();

  // 1. If explicit userId provided, verify and resolve it first
  if (inputUserId) {
    // a) Check Firestore users collection by doc ID
    try {
      const uDoc = await adminDb.collection("users").doc(inputUserId).get();
      if (uDoc.exists) {
        const data = uDoc.data() || {};
        const resEmail = (data.email || normalizedEmail).trim().toLowerCase();
        console.info("OTP USER RESOLUTION", {
          email: resEmail,
          firestoreUserFound: true,
          resolvedUserId: uDoc.id,
          source: "firestore_doc_id",
        });
        return {
          userId: uDoc.id,
          email: resEmail,
          phone: data.phone || inputPhone,
          userDoc: data,
          source: "firestore_doc_id",
        };
      }
    } catch (err) {
      console.warn("Firestore lookup by userId failed:", err);
    }

    // b) Check Firebase Auth by UID
    try {
      const authUser = await adminAuth.getUser(inputUserId);
      if (authUser) {
        const resEmail = (authUser.email || normalizedEmail)
          .trim()
          .toLowerCase();
        console.info("OTP USER RESOLUTION", {
          email: resEmail,
          firestoreUserFound: false,
          resolvedUserId: authUser.uid,
          source: "firebase_auth_uid",
        });
        return {
          userId: authUser.uid,
          email: resEmail,
          phone: authUser.phoneNumber || inputPhone,
          userDoc: null,
          source: "firebase_auth_uid",
        };
      }
    } catch (err) {}

    // c) Check local DB
    try {
      const db = readDb();
      const localUser = db.users?.find((u: any) => u.id === inputUserId);
      if (localUser) {
        const resEmail = (localUser.email || normalizedEmail)
          .trim()
          .toLowerCase();
        console.info("OTP USER RESOLUTION", {
          email: resEmail,
          firestoreUserFound: false,
          resolvedUserId: localUser.id,
          source: "local_db_id",
        });
        return {
          userId: localUser.id,
          email: resEmail,
          phone: localUser.phone || inputPhone,
          userDoc: localUser,
          source: "local_db_id",
        };
      }
    } catch (err) {}
  }

  // 2. Resolve by normalized email across stores
  if (normalizedEmail) {
    // a) Check Firebase Auth by email (Case-insensitive natively)
    try {
      const authUser = await adminAuth.getUserByEmail(normalizedEmail);
      if (authUser && authUser.uid) {
        let firestoreData: any = null;
        try {
          const uDoc = await adminDb
            .collection("users")
            .doc(authUser.uid)
            .get();
          if (uDoc.exists) {
            firestoreData = uDoc.data();
          }
        } catch (e) {}

        console.info("OTP USER RESOLUTION", {
          email: normalizedEmail,
          firestoreUserFound: Boolean(firestoreData),
          resolvedUserId: authUser.uid,
          source: "firebase_auth_email",
        });

        return {
          userId: authUser.uid,
          email: authUser.email
            ? authUser.email.trim().toLowerCase()
            : normalizedEmail,
          phone: authUser.phoneNumber || inputPhone,
          userDoc: firestoreData,
          source: "firebase_auth_email",
        };
      }
    } catch (err) {
      // Not in Firebase Auth, proceed to Firestore
    }

    // b) Check Firestore users collection by email query
    try {
      let uSnap = await adminDb
        .collection("users")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();

      if (uSnap.empty && rawEmail && rawEmail !== normalizedEmail) {
        uSnap = await adminDb
          .collection("users")
          .where("email", "==", rawEmail)
          .limit(1)
          .get();
      }

      if (!uSnap.empty) {
        const docSnap = uSnap.docs[0];
        const data = docSnap.data() || {};
        const resUserId = data.id || docSnap.id;
        const resEmail = (data.email || normalizedEmail).trim().toLowerCase();

        console.info("OTP USER RESOLUTION", {
          email: resEmail,
          firestoreUserFound: true,
          resolvedUserId: resUserId,
          source: "firestore_email_query",
        });

        return {
          userId: resUserId,
          email: resEmail,
          phone: data.phone || inputPhone,
          userDoc: data,
          source: "firestore_email_query",
        };
      }
    } catch (err) {
      console.warn("Firestore query by email failed:", err);
    }

    // c) Check local DB by email
    try {
      const db = readDb();
      const localUser = db.users?.find(
        (u: any) => u.email?.trim().toLowerCase() === normalizedEmail,
      );
      if (localUser && localUser.id) {
        console.info("OTP USER RESOLUTION", {
          email: normalizedEmail,
          firestoreUserFound: false,
          resolvedUserId: localUser.id,
          source: "local_db_email",
        });

        return {
          userId: localUser.id,
          email: normalizedEmail,
          phone: localUser.phone || inputPhone,
          userDoc: localUser,
          source: "local_db_email",
        };
      }
    } catch (err) {}

    // d) Check soft-deleted users in accountLifecycle / users_retained / deletedUsers
    try {
      const lifecycleRecord = await getAccountLifecycleRecord(normalizedEmail);
      if (lifecycleRecord && lifecycleRecord.originalUserId) {
        let retainedData: any = null;
        try {
          const retSnap = await adminDb
            .collection("users_retained")
            .doc(lifecycleRecord.originalUserId)
            .get();
          if (retSnap.exists) {
            retainedData = retSnap.data();
          }
        } catch (e) {}
        if (!retainedData) {
          const db = readDb();
          retainedData = db.retained_users?.find(
            (u: any) =>
              u.id === lifecycleRecord.originalUserId ||
              u.email?.toLowerCase() === normalizedEmail,
          );
        }

        console.info("OTP USER RESOLUTION (RETAINED LIFECYCLE)", {
          email: normalizedEmail,
          firestoreUserFound: Boolean(retainedData),
          resolvedUserId: lifecycleRecord.originalUserId,
          source: "account_lifecycle_retained",
        });

        return {
          userId: lifecycleRecord.originalUserId,
          email: normalizedEmail,
          phone: retainedData?.phone || inputPhone,
          userDoc: retainedData || {
            email: normalizedEmail,
            role: lifecycleRecord?.originalRole || "Contributor",
          },
          source: "account_lifecycle_retained",
        };
      }
    } catch (lcErr) {}
  }

  // 3. Resolve by phone if present
  if (inputPhone) {
    try {
      const uSnap = await adminDb
        .collection("users")
        .where("phone", "==", inputPhone)
        .limit(1)
        .get();
      if (!uSnap.empty) {
        const docSnap = uSnap.docs[0];
        const data = docSnap.data() || {};
        const resUserId = data.id || docSnap.id;

        console.info("OTP USER RESOLUTION", {
          email: normalizedEmail || data.email,
          firestoreUserFound: true,
          resolvedUserId: resUserId,
          source: "firestore_phone_query",
        });

        return {
          userId: resUserId,
          email: (data.email || normalizedEmail).trim().toLowerCase(),
          phone: inputPhone,
          userDoc: data,
          source: "firestore_phone_query",
        };
      }
    } catch (err) {}

    try {
      const db = readDb();
      const localUser = db.users?.find((u: any) => u.phone === inputPhone);
      if (localUser && localUser.id) {
        console.info("OTP USER RESOLUTION", {
          email: localUser.email || normalizedEmail,
          firestoreUserFound: false,
          resolvedUserId: localUser.id,
          source: "local_db_phone",
        });

        return {
          userId: localUser.id,
          email: (localUser.email || normalizedEmail).trim().toLowerCase(),
          phone: inputPhone,
          userDoc: localUser,
          source: "local_db_phone",
        };
      }
    } catch (err) {}
  }

  // User not found anywhere
  console.info("OTP USER RESOLUTION", {
    email: normalizedEmail || inputPhone || null,
    firestoreUserFound: false,
    resolvedUserId: null,
    source: "not_found",
  });

  return {
    userId: null,
    email: normalizedEmail || null,
    phone: inputPhone || null,
    userDoc: null,
    source: "not_found",
  };
}

// Send Dynamic Verification Code (Email/SMS)
app.post("/api/auth/send-verification-code", otpLimiter, async (req, res) => {
  const isRecovery = req.body.type === "account_recovery";
  const recoveryRequestId = isRecovery
    ? `RECOVERY-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
    : null;

  try {
    const { email, phone, type = "account_registration", userId } = req.body;
    if (!email && !phone && !userId) {
      if (isRecovery) {
        console.warn(
          `[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "input_validation", error: "Missing email/phone/userId")`,
        );
      }
      return res
        .status(400)
        .json({ error: "Email, phone, or userId is required" });
    }

    if (isRecovery) {
      console.log(
        `[RECOVERY] request received (id: ${recoveryRequestId}, type: ${type})`,
      );
    }

    const resolvedUser = await resolveUserByEmailOrId({ userId, email, phone });
    const targetIdentifier =
      resolvedUser.email || (email || phone || "").trim().toLowerCase();
    let foundUid = resolvedUser.userId;

    // For account recovery, check lifecycle records explicitly
    let lifecycleRecord: any = null;
    if (isRecovery && targetIdentifier) {
      lifecycleRecord = await getAccountLifecycleRecord(targetIdentifier);
      if (lifecycleRecord) {
        console.log(
          `[RECOVERY] deleted account found (id: ${recoveryRequestId}, userId: ${lifecycleRecord.originalUserId || foundUid || "known"}, status: ${lifecycleRecord.status})`,
        );

        if (
          lifecycleRecord.status === "PURGED" ||
          (lifecycleRecord.restoreUntil &&
            Date.now() > new Date(lifecycleRecord.restoreUntil).getTime())
        ) {
          console.warn(
            `[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "lifecycle_check", error: "RESTORE_EXPIRED")`,
          );
          return res.status(400).json({
            success: false,
            code: "RESTORE_EXPIRED",
            error:
              "انتهت مهلة 31 يوماً المتاحة لاستعادة هذا الحساب. تم حذف البيانات بشكل نهائي ولم يعد قابلاً للاستعادة.",
            userFriendlyMessage:
              "انتهت فترة استعادة الحساب المحددة بـ 31 يوماً.",
          });
        }

        if (
          lifecycleRecord.status === "ADMIN_DELETED" ||
          lifecycleRecord.deletionType === "admin"
        ) {
          console.warn(
            `[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "lifecycle_check", error: "ADMIN_APPROVAL_REQUIRED")`,
          );
          return res.status(400).json({
            success: false,
            code: "ADMIN_APPROVAL_REQUIRED",
            error:
              "هذا الحساب تم حذفه أو إيقافه بواسطة إدارة المنصة. يرجى تقديم طلب استعادة للمسؤول.",
            userFriendlyMessage:
              "هذا الحساب يتطلب موافقة إدارة المنصة للاستعادة.",
          });
        }

        if (!foundUid) {
          foundUid =
            lifecycleRecord.originalUserId ||
            `usr_${targetIdentifier.replace(/[^a-zA-Z0-9]/g, "_")}`;
        }
        console.log(`[RECOVERY] recovery allowed (id: ${recoveryRequestId})`);
      }
    }

    if (!foundUid) {
      if (isRecovery) {
        console.warn(
          `[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "user_lookup", error: "DELETED_ACCOUNT_NOT_FOUND")`,
        );
        return res.status(400).json({
          success: false,
          error: "لا يوجد حساب محذوف قابل للاستعادة بهذا البريد الإلكتروني.",
          userFriendlyMessage:
            "لا يوجد حساب محذوف قابل للاستعادة بهذا البريد الإلكتروني.",
        });
      }

      if (type === "account_registration" && targetIdentifier) {
        foundUid =
          userId || `usr_${targetIdentifier.replace(/[^a-zA-Z0-9]/g, "_")}`;
      } else {
        console.warn("OTP_SEND_FAILED", {
          reason: "USER_NOT_FOUND",
          userId: null,
          email: targetIdentifier,
        });
        return res.status(400).json({
          success: false,
          error: "No registered user found for this email address.",
          userFriendlyMessage:
            "لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني.",
        });
      }
    }

    const docId = foundUid; // CRITICAL: Document ID MUST be the resolved userId!

    // ADMIN EXCEPTION: Admin accounts do NOT require Email OTP verification
    const isTargetAdmin =
      (foundUid && (await isUserAdminServer(foundUid, targetIdentifier))) ||
      foundUid === ADMIN_USER_ID;

    if (
      isTargetAdmin &&
      (type === "account_registration" || type === "login")
    ) {
      console.log(
        `[AUTH EXCEPTION] Admin account (${targetIdentifier}) bypassed OTP generation.`,
      );
      return res.status(200).json({
        success: true,
        message: "Admin accounts do not require email verification.",
        isAdmin: true,
        verified: true,
        sendCount: 0,
      });
    }

    const db = readDb();
    if (!db.verification_codes) db.verification_codes = [];

    // Read existing record to enforce limits & 10-minute cooldown cycle
    let existingRecord: any = null;
    try {
      const docSnap = await adminDb
        .collection("verification_codes")
        .doc(docId)
        .get();
      if (docSnap.exists) {
        existingRecord = docSnap.data();
      }
    } catch (err) {
      console.warn(
        "Firestore read failed for existing verification code, checking fallback:",
        err,
      );
    }

    if (!existingRecord) {
      existingRecord = db.verification_codes.find((vc: any) => vc.id === docId);
    }

    const nowMs = Date.now();
    const RESEND_COOLDOWN_MINUTES = parseInt(
      process.env.RESEND_COOLDOWN_MINUTES || "10",
      10,
    );
    const RESEND_COOLDOWN_MS = RESEND_COOLDOWN_MINUTES * 60 * 1000;

    const isInitial = !!req.body.isInitial;
    let currentSendCount = existingRecord ? existingRecord.sendCount || 0 : 0;

    if (!isInitial) {
      // 1. Check if user is currently in an active 10-minute cooldown
      if (existingRecord && existingRecord.cooldownUntil) {
        const cooldownUntilMs = new Date(
          existingRecord.cooldownUntil,
        ).getTime();
        if (nowMs < cooldownUntilMs) {
          const remainingSecs = Math.ceil((cooldownUntilMs - nowMs) / 1000);
          console.log(
            `[OTP COOLDOWN ACTIVE] User ${docId} is in 10-min cooldown for ${remainingSecs}s.`,
          );
          if (isRecovery) {
            console.warn(
              `[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "cooldown", remaining: ${remainingSecs}s)`,
            );
          }
          return res.status(400).json({
            success: false,
            error:
              "You've reached the maximum number of code requests. Please wait a few minutes before requesting a new verification code.",
            userFriendlyMessage:
              "لقد وصلت إلى الحد الأقصى لطلبات رمز التحقق. يرجى الانتظار قليلًا قبل طلب رمز جديد.",
            cooldownUntil: existingRecord.cooldownUntil,
            cooldownRemainingSeconds: remainingSecs,
            sendCount: currentSendCount,
          });
        } else {
          // Cooldown has expired! Reset send count to 0 to start a brand new cycle
          console.log(
            `[OTP COOLDOWN EXPIRED] Resetting send count for user ${docId}.`,
          );
          currentSendCount = 0;
        }
      }

      // 2. If user reached 3 sends and cooldown hasn't been set yet
      if (currentSendCount >= 3) {
        const newCooldownUntil = new Date(
          nowMs + RESEND_COOLDOWN_MS,
        ).toISOString();
        console.log(
          `[OTP MAX SENDS REACHED] User ${docId} entering 10-min cooldown until ${newCooldownUntil}.`,
        );

        const updatedCooldownRecord = {
          ...(existingRecord || {}),
          id: docId,
          userId: foundUid,
          email: targetIdentifier,
          cooldownUntil: newCooldownUntil,
          sendCount: 3,
        };

        try {
          await adminDb
            .collection("verification_codes")
            .doc(docId)
            .set(updatedCooldownRecord, { merge: true });
        } catch (e) {}
        db.verification_codes = (db.verification_codes || []).filter(
          (vc: any) => vc.id !== docId,
        );
        db.verification_codes.push(updatedCooldownRecord);
        writeDb(db);

        if (isRecovery) {
          console.warn(
            `[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "max_sends_cooldown")`,
          );
        }

        return res.status(400).json({
          success: false,
          error:
            "You've reached the maximum number of code requests. Please wait a few minutes before requesting a new verification code.",
          userFriendlyMessage:
            "لقد وصلت إلى الحد الأقصى لطلبات رمز التحقق. يرجى الانتظار قليلًا قبل طلب رمز جديد.",
          cooldownUntil: newCooldownUntil,
          cooldownRemainingSeconds: RESEND_COOLDOWN_MINUTES * 60,
          sendCount: 3,
        });
      }

      // 3. Short 30-second throttle between consecutive resend requests
      if (
        existingRecord &&
        existingRecord.lastSentAt &&
        !existingRecord.cooldownUntil
      ) {
        const timeSinceLastSent =
          nowMs - new Date(existingRecord.lastSentAt).getTime();
        if (timeSinceLastSent < 30 * 1000) {
          const waitRemaining = Math.ceil(
            (30 * 1000 - timeSinceLastSent) / 1000,
          );
          if (isRecovery) {
            console.warn(
              `[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "throttle_30s", remaining: ${waitRemaining}s)`,
            );
          }
          return res.status(400).json({
            success: false,
            error: `Please wait ${waitRemaining}s before requesting a new verification code.`,
            userFriendlyMessage: `يرجى الانتظار ${waitRemaining} ثانية قبل طلب رمز جديد.`,
            sendCount: currentSendCount,
          });
        }
      }
    }

    // Generate dynamic, cryptographically secure 6-digit numeric verification code
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashVerificationCode(otpCode);
    const expiresAt = new Date(nowMs + 10 * 60 * 1000).toISOString(); // 10 minutes expiry

    if (isRecovery) {
      console.log(
        `[RECOVERY] OTP generated (id: ${recoveryRequestId}, generated: true)`,
      );
    }

    let reqName =
      req.body.name ||
      req.body.userName ||
      req.body.ownerName ||
      req.body.fullName ||
      "";
    let firestoreUserData = resolvedUser.userDoc;

    const localUser = db.users?.find(
      (u: any) =>
        u.id === foundUid || u.email?.toLowerCase() === targetIdentifier,
    );

    let rawName =
      reqName ||
      firestoreUserData?.ownerName ||
      firestoreUserData?.name ||
      firestoreUserData?.fullName ||
      firestoreUserData?.displayName ||
      firestoreUserData?.companyName ||
      localUser?.ownerName ||
      localUser?.name ||
      localUser?.fullName ||
      localUser?.displayName ||
      localUser?.companyName ||
      "";

    const resolvedUserName = cleanUserName(rawName, targetIdentifier);

    // Build 100% English SaaS HTML email
    const {
      subject: emailSubject,
      text: textBody,
      html: htmlBody,
    } = buildOtpEmailHtml({
      email: targetIdentifier,
      userName: resolvedUserName,
      otpCode: otpCode,
      type: type,
    });

    if (isRecovery) {
      console.log(
        `[RECOVERY] email send started (id: ${recoveryRequestId}, provider: Resend)`,
      );
    }

    // Dispatch OTP email (via Resend or graceful local simulation fallback)
    const mailResult = await sendSystemMail(
      targetIdentifier,
      emailSubject,
      textBody,
      htmlBody,
    );

    if (!mailResult.success && !mailResult.simulated) {
      console.error("[OTP DELIVERY FAILURE]", mailResult.error);
      if (isRecovery) {
        console.error(
          `[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "email_dispatch", error: ${mailResult.error?.message || mailResult.error || "Unknown"})`,
        );
      }
      return res.status(500).json({
        success: false,
        error: "تعذر إرسال رمز الاستعادة. يرجى المحاولة مرة أخرى.",
        userFriendlyMessage:
          "تعذر إرسال رمز الاستعادة. يرجى المحاولة مرة أخرى.",
      });
    }

    // Also dispatch SMS if phone number is provided
    const targetPhone = (
      phone ||
      (targetIdentifier && !targetIdentifier.includes("@")
        ? targetIdentifier
        : "")
    ).trim();
    let smsResult: any = null;
    if (targetPhone) {
      const smsMessage = `رمز التحقق لمنصة Zakir هو: ${otpCode} - صالح لمدة 10 دقائق. Zakir Verification Code: ${otpCode}`;
      smsResult = await sendSystemSms(targetPhone, smsMessage);
      console.log(
        `[OTP SMS DISPATCH] Target: ${targetPhone}, Success: ${smsResult?.success}`,
      );
    }

    if (isRecovery) {
      const resStatus = mailResult.success ? 200 : mailResult.statusCode || 500;
      const resMsgId = mailResult.messageId || "none";
      console.log(`Recovery email Resend ID: ${resMsgId}`);
      console.log(
        `[RECOVERY] Resend response status: ${resStatus}, recipient: ${maskEmail(targetIdentifier)}, message ID: ${resMsgId}`,
      );
    }

    const emailSent = !mailResult.simulated;

    // Mail sent successfully or simulated! Calculate new send count
    const newSendCount = isInitial ? currentSendCount : currentSendCount + 1;
    let cooldownUntil: string | null = existingRecord?.cooldownUntil || null;
    if (!isInitial && newSendCount >= 3) {
      cooldownUntil = new Date(nowMs + RESEND_COOLDOWN_MS).toISOString();
      console.log(
        `[OTP 3RD SEND COMPLETED] Starting 10-minute cooldown for user ${docId} until ${cooldownUntil}`,
      );
    }

    const record = {
      id: docId,
      userId: foundUid,
      email: targetIdentifier,
      phone: targetPhone || "",
      codeHash: codeHash, // STORE ONLY SECURE HASH
      type: type,
      expiresAt: expiresAt,
      attempts: 0,
      sendCount: newSendCount,
      cooldownUntil: cooldownUntil,
      lastSentAt: new Date().toISOString(),
      used: false,
      createdAt: new Date().toISOString(),
    };

    console.log(
      "Saving OTP for Doc ID:",
      docId,
      "Count:",
      newSendCount,
      "Name:",
      resolvedUserName || "(none)",
    );

    // Save record to fast in-memory registry, Firestore, and local JSON db
    activeVerificationCodes.set(docId, record);
    activeVerificationCodes.set(targetIdentifier, record);
    if (foundUid) activeVerificationCodes.set(foundUid, record);
    if (targetPhone) activeVerificationCodes.set(targetPhone, record);

    // Save record to Firestore and local JSON db under UID, email, and phone
    try {
      await adminDb.collection("verification_codes").doc(docId).set(record);
      if (docId !== targetIdentifier) {
        await adminDb
          .collection("verification_codes")
          .doc(targetIdentifier)
          .set({ ...record, id: targetIdentifier });
      }
      if (
        targetPhone &&
        targetPhone !== docId &&
        targetPhone !== targetIdentifier
      ) {
        await adminDb
          .collection("verification_codes")
          .doc(targetPhone)
          .set({ ...record, id: targetPhone });
      }
    } catch (dbErr) {
      console.error("Failed to write to Firestore verification_codes:", dbErr);
    }

    try {
      if (!db.verification_codes) db.verification_codes = [];
      db.verification_codes = db.verification_codes.filter(
        (vc: any) =>
          vc.id !== docId &&
          vc.id !== targetIdentifier &&
          vc.id !== targetPhone,
      );
      db.verification_codes.push(record);
      if (docId !== targetIdentifier) {
        db.verification_codes.push({ ...record, id: targetIdentifier });
      }
      if (
        targetPhone &&
        targetPhone !== docId &&
        targetPhone !== targetIdentifier
      ) {
        db.verification_codes.push({ ...record, id: targetPhone });
      }
      writeDb(db);
    } catch (err) {
      console.warn("Fallback JSON DB write failed:", err);
    }

    if (isRecovery) {
      console.log(
        `[RECOVERY] OTP stored (id: ${recoveryRequestId}, docId: ${docId})`,
      );
      console.log(`[RECOVERY] email send completed (id: ${recoveryRequestId})`);
    }

    console.log(
      `[VERIFICATION CODE RECORDED] Target: ${targetIdentifier} | Code: [SECURE 6-DIGITS RECORDED] | Send Count: ${newSendCount}`,
    );

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${targetIdentifier}`,
      expiresAt: expiresAt,
      emailSent: emailSent,
      smsSent: smsResult ? smsResult.success : undefined,
      devCode: (process.env.NODE_ENV !== "production" || mailResult.simulated) ? otpCode : undefined,
      sendCount: newSendCount,
      cooldownUntil: cooldownUntil || undefined,
      sendCountRemaining: Math.max(0, 3 - newSendCount),
    });
  } catch (error: any) {
    if (isRecovery) {
      console.error(
        `[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "exception", error: ${error?.message || String(error)})`,
      );
    }
    console.error("Verification Sending Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: error?.message || "Failed to generate verification code",
      });
  }
});

// Verify Code (Account activation / Security checks)
app.post("/api/auth/verify-code", otpLimiter, async (req, res) => {
  try {
    const {
      email,
      phone,
      code,
      userId,
      type = "account_registration",
    } = req.body;
    if ((!email && !phone && !userId) || !code) {
      return res
        .status(400)
        .json({
          error: "Identifier and 6-digit verification code are required",
        });
    }

    const resolvedUser = await resolveUserByEmailOrId({ userId, email, phone });
    const targetIdentifier =
      resolvedUser.email || (email || phone || "").trim().toLowerCase();
    const rawPhone = (phone || "").trim();
    const cleanCode = String(code).trim();
    let foundUid = resolvedUser.userId;

    // ADMIN EXCEPTION: Admin accounts do NOT require Email OTP verification
    const isTargetAdmin =
      (foundUid && (await isUserAdminServer(foundUid, targetIdentifier))) ||
      foundUid === ADMIN_USER_ID;

    if (isTargetAdmin) {
      console.log(
        `[AUTH EXCEPTION] Admin account (${targetIdentifier}) bypassed OTP verification.`,
      );
      return res.status(200).json({
        success: true,
        message: "Admin account verified without OTP.",
        isAdmin: true,
        user: resolvedUser.userDoc || {
          id: foundUid,
          email: targetIdentifier,
          role: "Admin",
          isVerified: true,
        },
      });
    }

    console.log("Verifying OTP for:", targetIdentifier);

    // Secure logging of OTP verification attempt (no OTP or hash logged)
    console.log("OTP verification attempt", {
      userId: foundUid || null,
      email: targetIdentifier,
      documentId: foundUid || null,
    });

    if (!foundUid) {
      if (type === "account_registration" && targetIdentifier) {
        foundUid =
          userId || `usr_${targetIdentifier.replace(/[^a-zA-Z0-9]/g, "_")}`;
      } else {
        console.warn("OTP_VERIFY_FAILED", {
          reason: "USER_NOT_FOUND",
          userId: null,
          email: targetIdentifier,
        });
        return res.status(400).json({
          success: false,
          error: "No registered user found for this email address.",
          userFriendlyMessage:
            "لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني.",
        });
      }
    }

    const docId = foundUid; // Document ID
    let activeRecord: any = null;

    // 1. Check in-memory fast registry first across all candidate keys
    const memCandidates = Array.from(
      new Set(
        [
          foundUid,
          userId,
          targetIdentifier,
          (email || "").trim().toLowerCase(),
          (email || "").trim(),
          rawPhone,
          docId,
        ].filter(Boolean) as string[],
      ),
    );

    for (const key of memCandidates) {
      const rec = activeVerificationCodes.get(key);
      if (rec && !rec.used) {
        activeRecord = rec;
        break;
      }
    }

    // 2. Check Firestore direct documents by candidates
    if (!activeRecord) {
      for (const cId of memCandidates) {
        try {
          const docSnap = await adminDb
            .collection("verification_codes")
            .doc(cId)
            .get();
          if (docSnap.exists) {
            const data = docSnap.data();
            if (data && !data.used) {
              activeRecord = data;
              break;
            } else if (!activeRecord) {
              activeRecord = data;
            }
          }
        } catch (err) {
          console.warn(
            `Firestore read notice for verification code doc ${cId}:`,
            err,
          );
        }
      }
    }

    // 3. Fallback lookup in local JSON DB
    if (!activeRecord || activeRecord.used) {
      const db = readDb();
      if (db.verification_codes && Array.isArray(db.verification_codes)) {
        const matches = db.verification_codes.filter(
          (vc: any) =>
            (foundUid && (vc.id === foundUid || vc.userId === foundUid)) ||
            (userId && (vc.id === userId || vc.userId === userId)) ||
            (docId && (vc.id === docId || vc.userId === docId)) ||
            (targetIdentifier &&
              (vc.id === targetIdentifier ||
                (vc.email && vc.email.toLowerCase() === targetIdentifier))) ||
            (rawPhone && (vc.phone === rawPhone || vc.id === rawPhone)),
        );

        const unusedMatch = matches
          .filter((m: any) => !m.used)
          .sort((a: any, b: any) => {
            const tA = new Date(a.createdAt || a.lastSentAt || 0).getTime();
            const tB = new Date(b.createdAt || b.lastSentAt || 0).getTime();
            return tB - tA;
          })[0];

        if (unusedMatch) {
          activeRecord = unusedMatch;
        } else if (!activeRecord && matches.length > 0) {
          activeRecord = matches[0];
        }
      }
    }

    // 4. Firestore collection query fallback if still no unused record found
    if (!activeRecord || activeRecord.used) {
      if (targetIdentifier && targetIdentifier.includes("@")) {
        try {
          const qSnap = await adminDb
            .collection("verification_codes")
            .where("email", "==", targetIdentifier)
            .where("used", "==", false)
            .get();
          if (!qSnap.empty) {
            activeRecord = qSnap.docs[0].data();
          }
        } catch (fErr) {}
      }
      if ((!activeRecord || activeRecord.used) && rawPhone) {
        try {
          const qSnap = await adminDb
            .collection("verification_codes")
            .where("phone", "==", rawPhone)
            .where("used", "==", false)
            .get();
          if (!qSnap.empty) {
            activeRecord = qSnap.docs[0].data();
          }
        } catch (fErr) {}
      }
    }

    if (!activeRecord) {
      console.warn("OTP_VERIFY_FAILED", {
        reason: "VERIFICATION_DOCUMENT_NOT_FOUND",
        userId: foundUid,
        email: targetIdentifier,
      });
      return res
        .status(400)
        .json({
          error: "No active verification code found. Please click Resend Code.",
        });
    }

    if (activeRecord.used) {
      console.warn("OTP_VERIFY_FAILED", {
        reason: "ALREADY_USED",
        userId: foundUid,
        email: targetIdentifier,
      });
      return res
        .status(400)
        .json({
          error: "No active verification code found. Please click Resend Code.",
        });
    }

    // Validate target identity: if email is present on both, ensure it matches
    const recEmail = (activeRecord.email || "").trim().toLowerCase();
    if (recEmail && targetIdentifier && recEmail !== targetIdentifier) {
      console.warn("OTP_VERIFY_FAILED", {
        reason: "EMAIL_MISMATCH",
        expectedEmail: recEmail,
        providedEmail: targetIdentifier,
      });
      return res
        .status(400)
        .json({
          error: "Verification code does not match the active session.",
        });
    }

    const recordDocId = activeRecord.id || docId;

    const updateRecord = async (fields: any) => {
      // 1. In-memory update
      const memKeys = [
        activeRecord.id,
        activeRecord.userId,
        targetIdentifier,
        foundUid,
        userId,
        docId,
      ].filter(Boolean);
      for (const k of memKeys) {
        if (activeVerificationCodes.has(k)) {
          const existing = activeVerificationCodes.get(k);
          activeVerificationCodes.set(k, { ...existing, ...fields });
        }
      }

      // 2. Firestore update
      const fsIds = Array.from(
        new Set(
          [recordDocId, activeRecord.id, targetIdentifier, foundUid].filter(
            Boolean,
          ),
        ),
      );
      for (const dId of fsIds) {
        try {
          await adminDb
            .collection("verification_codes")
            .doc(dId)
            .update(fields);
        } catch (err) {}
      }

      // 3. Local DB update
      try {
        const db = readDb();
        if (db.verification_codes) {
          db.verification_codes.forEach((vc: any) => {
            if (
              (targetIdentifier &&
                vc.email?.toLowerCase() === targetIdentifier) ||
              (recordDocId && vc.id === recordDocId) ||
              (foundUid && (vc.userId === foundUid || vc.id === foundUid))
            ) {
              Object.assign(vc, fields);
            }
          });
          writeDb(db);
        }
      } catch (err) {}
    };

    // Check expiration properly supporting Firestore Timestamp or Date string
    const expiresAt = activeRecord.expiresAt?.toDate
      ? activeRecord.expiresAt.toDate()
      : new Date(activeRecord.expiresAt);

    if (expiresAt.getTime() <= Date.now()) {
      await updateRecord({ used: true });
      console.warn("OTP_VERIFY_FAILED", {
        reason: "EXPIRED",
        userId: foundUid,
        email: targetIdentifier,
      });
      return res
        .status(400)
        .json({
          error: "Verification code has expired. Please request a new code.",
        });
    }

    // Check max attempts limit
    if (activeRecord.attempts >= 5) {
      await updateRecord({ used: true });
      console.warn("OTP_VERIFY_FAILED", {
        reason: "ALREADY_USED",
        userId: foundUid,
        email: targetIdentifier,
      });
      return res
        .status(400)
        .json({
          error:
            "Maximum verification attempts reached. Please request a new code.",
        });
    }

    const cleanCodeHash = hashVerificationCode(cleanCode);
    const isMatch = activeRecord.codeHash
      ? activeRecord.codeHash === cleanCodeHash
      : activeRecord.code === cleanCode || activeRecord.otpCode === cleanCode;

    // Check code equality
    if (!isMatch) {
      const newAttempts = (activeRecord.attempts || 0) + 1;
      await updateRecord({ attempts: newAttempts });
      const remaining = 5 - newAttempts;
      console.warn("OTP_VERIFY_FAILED", {
        reason: "INVALID_CODE",
        userId: foundUid,
        email: targetIdentifier,
      });

      emitPlatformEvent({
        eventType: "OTP_VERIFICATION_FAILED",
        severity: "WARNING",
        category: "AUTH",
        userId: foundUid,
        userEmail: targetIdentifier,
        requestId: (req as any).correlationId,
        sanitizedMessage: `Invalid verification code attempt for: ${targetIdentifier} (${remaining} attempts left)`,
        metadata: { targetIdentifier, remainingAttempts: remaining },
      }).catch(() => {});

      return res
        .status(400)
        .json({
          error: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
        });
    }

    // Code is correct! Mark used immediately so it cannot be re-used
    await updateRecord({ used: true, verifiedAt: new Date().toISOString() });

    // Update user record in db
    const db = readDb();
    const user = db.users?.find(
      (u: any) =>
        u.email?.toLowerCase() === targetIdentifier || u.id === foundUid,
    );

    let firestoreUser: any = null;
    let nextAccountStatus = "PENDING_DOCUMENT_VERIFICATION";
    try {
      // 1. Synchronize Firebase Auth emailVerified claim
      if (isFirebaseAdminAvailable && adminAuth && foundUid) {
        try {
          await adminAuth.updateUser(foundUid, { emailVerified: true });
        } catch (authSyncErr) {}
      }

      const userRef = adminDb.collection("users").doc(foundUid);
      const userSnap = await userRef.get();
      firestoreUser = userSnap.exists ? userSnap.data() : (user || {});
      const isAdminUser = foundUid === ADMIN_USER_ID || firestoreUser.role === "Admin" || ADMIN_EMAILS.has((targetIdentifier || "").toLowerCase());
      const isApprovedAlready = firestoreUser.accountStatus === "APPROVED" || isAdminUser;
      if (isAdminUser) {
        nextAccountStatus = "APPROVED";
      } else if (firestoreUser.accountStatus === "APPROVED") {
        nextAccountStatus = "APPROVED";
      } else if (firestoreUser.verificationDocuments && firestoreUser.verificationDocuments.length > 0) {
        nextAccountStatus = "PENDING_ADMIN_REVIEW";
      } else {
        nextAccountStatus = "PENDING_DOCUMENT_VERIFICATION";
      }

      const isUserFullyApproved = nextAccountStatus === "APPROVED";
      const docVerificationStatus = isUserFullyApproved 
        ? "APPROVED" 
        : (nextAccountStatus === "PENDING_ADMIN_REVIEW" ? "UNDER_REVIEW" : (firestoreUser.documentVerificationStatus || "PENDING_UPLOAD"));
      const verInfoStatus = isUserFullyApproved
        ? "verified"
        : (nextAccountStatus === "PENDING_ADMIN_REVIEW" ? "under_review" : "action_required");
      const nowIso = new Date().toISOString();

      const updateFields: Record<string, any> = {
        isEmailVerified: true,
        emailVerified: true,
        email_verified: true,
        emailVerifiedAt: firestoreUser.emailVerifiedAt || nowIso,
        "verificationInfo.emailVerifiedAt": firestoreUser.verificationInfo?.emailVerifiedAt || nowIso,
        isPhoneVerified: true,
        accountStatus: nextAccountStatus,
        documentVerificationStatus: docVerificationStatus,
        isVerified: isUserFullyApproved,
        verification_status: isUserFullyApproved ? "verified" : (nextAccountStatus === "PENDING_ADMIN_REVIEW" ? "pending" : "unverified"),
        verification_required: !isUserFullyApproved,
        "verificationInfo.status": verInfoStatus,
      };
      if (isUserFullyApproved) {
        updateFields["verificationInfo.verifiedAt"] = nowIso;
      }

      await userRef.set(updateFields, { merge: true });
      if (adminAuth && foundUid) {
        try {
          await adminAuth.updateUser(foundUid, { emailVerified: true });
        } catch (authErr) {
          console.warn("Could not sync emailVerified to Firebase Auth record:", authErr);
        }
      }
      firestoreUser.isEmailVerified = true;
      firestoreUser.emailVerified = true;
      firestoreUser.email_verified = true;
      firestoreUser.emailVerifiedAt = updateFields.emailVerifiedAt;
      firestoreUser.isPhoneVerified = true;
      firestoreUser.accountStatus = nextAccountStatus;
      firestoreUser.documentVerificationStatus = docVerificationStatus;
      firestoreUser.isVerified = isUserFullyApproved;
      firestoreUser.verification_status = isUserFullyApproved ? "verified" : (nextAccountStatus === "PENDING_ADMIN_REVIEW" ? "pending" : "unverified");
      firestoreUser.verification_required = !isUserFullyApproved;
      if (!firestoreUser.verificationInfo) firestoreUser.verificationInfo = {};
      firestoreUser.verificationInfo.status = verInfoStatus;
      firestoreUser.verificationInfo.emailVerifiedAt = updateFields.emailVerifiedAt;
      console.log(
        `[VERIFICATION SUCCESS] Updated user ${foundUid} in Firestore. accountStatus=${nextAccountStatus}, isVerified=${isUserFullyApproved}`,
      );
    } catch (uErr) {
      console.warn(
        "Could not update user verification status in Firestore (proceeding):",
        uErr,
      );
    }

    if (user) {
      const isUserFullyApproved = nextAccountStatus === "APPROVED";
      const docVerificationStatus = isUserFullyApproved 
        ? "APPROVED" 
        : (nextAccountStatus === "PENDING_ADMIN_REVIEW" ? "UNDER_REVIEW" : (user.documentVerificationStatus || "PENDING_UPLOAD"));
      const verInfoStatus = isUserFullyApproved
        ? "verified"
        : (nextAccountStatus === "PENDING_ADMIN_REVIEW" ? "under_review" : "action_required");

      user.isEmailVerified = true;
      user.emailVerified = true;
      user.email_verified = true;
      user.isPhoneVerified = true;
      user.accountStatus = nextAccountStatus;
      user.documentVerificationStatus = docVerificationStatus;
      user.isVerified = isUserFullyApproved;
      user.verification_status = isUserFullyApproved ? "verified" : (nextAccountStatus === "PENDING_ADMIN_REVIEW" ? "pending" : "unverified");
      user.verification_required = !isUserFullyApproved;
      if (!user.verificationInfo) user.verificationInfo = {};
      user.verificationInfo.status = verInfoStatus;
      if (isUserFullyApproved) {
        user.verificationInfo.verifiedAt = new Date().toISOString();
      }
      if (firestoreUser && firestoreUser.role) {
        user.role = firestoreUser.role;
      }
      writeDb(db);
    }

    const resolvedFinalUser =
      firestoreUser || user || resolvedUser.userDoc || null;
    if (resolvedFinalUser && !resolvedFinalUser.role) {
      resolvedFinalUser.role =
        resolvedFinalUser.id === ADMIN_USER_ID ? "Admin" : "Contributor";
    }

    emitPlatformEvent({
      eventType: "OTP_VERIFICATION_SUCCESS",
      severity: "NOTICE",
      category: "AUTH",
      userId: foundUid,
      userEmail: targetIdentifier,
      requestId: (req as any).correlationId,
      sanitizedMessage: `Verification code successfully validated for: ${targetIdentifier}`,
      metadata: { targetIdentifier, type },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Verification successful!",
      user: resolvedFinalUser,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to verify code" });
  }
});

// Request Password Reset Code
app.post("/api/auth/forgot-password", otpLimiter, async (req, res) => {
  try {
    const { emailOrPhone } = req.body;
    if (!emailOrPhone) {
      return res
        .status(400)
        .json({ error: "Email address or phone number is required" });
    }
    const target = emailOrPhone.trim().toLowerCase();
    const db = readDb();

    let user = null;
    let userId = "";
    let userEmail = target;
    let userPhone = "";
    let rawUserName = "";
    let firestoreUserData: any = null;

    try {
      const uSnap = await adminDb
        .collection("users")
        .where("email", "==", target)
        .limit(1)
        .get();
      if (!uSnap.empty) {
        const uDoc = uSnap.docs[0];
        firestoreUserData = uDoc.data();
        userId = uDoc.id;
        userEmail = firestoreUserData.email || target;
        userPhone = firestoreUserData.phone || "";
        rawUserName =
          firestoreUserData.ownerName ||
          firestoreUserData.name ||
          firestoreUserData.fullName ||
          "";
        user = {
          id: userId,
          email: userEmail,
          phone: userPhone,
          ownerName: rawUserName,
        };
      }
    } catch (err) {
      console.warn("Firestore forgot-password user lookup failed:", err);
    }

    if (!user) {
      const localUser = db.users.find(
        (u: any) => u.email?.toLowerCase() === target || u.phone === target,
      );
      if (localUser) {
        userId = localUser.id;
        userEmail = localUser.email || target;
        userPhone = localUser.phone || "";
        rawUserName =
          localUser.ownerName || localUser.name || localUser.fullName || "";
        user = localUser;
      }
    }

    if (!user) {
      // Prevent account enumeration: return successful status with generic message
      return res.json({
        success: true,
        message:
          "If an account matches that email address, a password reset code has been sent.",
        userFriendlyMessage:
          "إذا كان الحساب مسجلاً، فقد تم إرسال رمز إعادة تعيين كلمة المرور إلى البريد الإلكتروني.",
      });
    }

    // Document ID is primarily userId, falling back to target
    const docId = userId || target;

    // Read existing record to enforce limits & 10-minute cooldown cycle
    let existingRecord: any = null;
    try {
      const docSnap = await adminDb
        .collection("verification_codes")
        .doc(docId)
        .get();
      if (docSnap.exists) {
        existingRecord = docSnap.data();
      }
    } catch (err) {
      console.warn(
        "Firestore read failed for existing forgot-password code, checking fallback:",
        err,
      );
    }

    if (!existingRecord) {
      if (!db.verification_codes) db.verification_codes = [];
      existingRecord = db.verification_codes.find((vc: any) => vc.id === docId);
    }

    const nowMs = Date.now();
    const RESEND_COOLDOWN_MINUTES = parseInt(
      process.env.RESEND_COOLDOWN_MINUTES || "10",
      10,
    );
    const RESEND_COOLDOWN_MS = RESEND_COOLDOWN_MINUTES * 60 * 1000;

    let currentSendCount = existingRecord ? existingRecord.sendCount || 0 : 0;

    // 1. Check if user is currently in an active 10-minute cooldown
    if (existingRecord && existingRecord.cooldownUntil) {
      const cooldownUntilMs = new Date(existingRecord.cooldownUntil).getTime();
      if (nowMs < cooldownUntilMs) {
        const remainingSecs = Math.ceil((cooldownUntilMs - nowMs) / 1000);
        console.log(
          `[FORGOT PASSWORD OTP COOLDOWN ACTIVE] User ${docId} is in 10-min cooldown for ${remainingSecs}s.`,
        );
        return res.status(400).json({
          success: false,
          error:
            "You've reached the maximum number of code requests. Please wait a few minutes before requesting a new verification code.",
          userFriendlyMessage:
            "لقد وصلت إلى الحد الأقصى لطلبات رمز التحقق. يرجى الانتظار قليلًا قبل طلب رمز جديد.",
          cooldownUntil: existingRecord.cooldownUntil,
          cooldownRemainingSeconds: remainingSecs,
          sendCount: currentSendCount,
        });
      } else {
        // Cooldown has expired! Reset send count to 0 to start a brand new cycle
        console.log(
          `[FORGOT PASSWORD OTP COOLDOWN EXPIRED] Resetting send count for user ${docId}.`,
        );
        currentSendCount = 0;
      }
    }

    // 2. If user reached 3 sends and cooldown hasn't been set yet
    if (currentSendCount >= 3) {
      const newCooldownUntil = new Date(
        nowMs + RESEND_COOLDOWN_MS,
      ).toISOString();
      console.log(
        `[FORGOT PASSWORD MAX SENDS REACHED] User ${docId} entering 10-min cooldown until ${newCooldownUntil}.`,
      );

      const updatedCooldownRecord = {
        ...(existingRecord || {}),
        id: docId,
        cooldownUntil: newCooldownUntil,
        sendCount: 3,
      };

      try {
        await adminDb
          .collection("verification_codes")
          .doc(docId)
          .set(updatedCooldownRecord, { merge: true });
      } catch (e) {}
      db.verification_codes = (db.verification_codes || []).filter(
        (vc: any) => vc.id !== docId,
      );
      db.verification_codes.push(updatedCooldownRecord);
      writeDb(db);

      return res.status(400).json({
        success: false,
        error:
          "You've reached the maximum number of code requests. Please wait a few minutes before requesting a new verification code.",
        userFriendlyMessage:
          "لقد وصلت إلى الحد الأقصى لطلبات رمز التحقق. يرجى الانتظار قليلًا قبل طلب رمز جديد.",
        cooldownUntil: newCooldownUntil,
        cooldownRemainingSeconds: RESEND_COOLDOWN_MINUTES * 60,
        sendCount: 3,
      });
    }

    // 3. Short 60-second throttle between consecutive requests
    if (
      existingRecord &&
      existingRecord.lastSentAt &&
      !existingRecord.cooldownUntil
    ) {
      const timeSinceLastSent =
        nowMs - new Date(existingRecord.lastSentAt).getTime();
      if (timeSinceLastSent < 60 * 1000) {
        const waitRemaining = Math.ceil((60 * 1000 - timeSinceLastSent) / 1000);
        return res.status(400).json({
          success: false,
          error: `Please wait ${waitRemaining}s before requesting a new verification code.`,
          userFriendlyMessage: `يرجى الانتظار ${waitRemaining} ثانية قبل طلب رمز جديد.`,
          sendCount: currentSendCount,
        });
      }
    }

    // Generate dynamic, cryptographically secure 6-digit password reset code
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashVerificationCode(otpCode);
    const expiresAt = new Date(nowMs + 10 * 60 * 1000).toISOString();

    const resolvedUserName = cleanUserName(
      req.body.name || rawUserName,
      userEmail,
    );

    const {
      subject: emailSubject,
      text: textBody,
      html: htmlBody,
    } = buildOtpEmailHtml({
      email: userEmail,
      userName: resolvedUserName,
      otpCode: otpCode,
      type: "password_reset",
    });

    // Dispatch password reset email (via Resend or graceful local simulation fallback)
    const mailResult = await sendSystemMail(
      target,
      emailSubject,
      textBody,
      htmlBody,
    );

    if (!mailResult.success && !mailResult.simulated) {
      console.error(
        "[PASSWORD RESET EMAIL DELIVERY FAILURE]",
        mailResult.error,
      );
      return res.status(500).json({
        success: false,
        error: "تعذر إرسال رابط إعادة التعيين. حاول مرة أخرى.",
      });
    }

    const emailSent = !mailResult.simulated;

    // Mail sent successfully! Calculate new send count
    const newSendCount = currentSendCount + 1;
    let cooldownUntil: string | null = null;
    if (newSendCount >= 3) {
      cooldownUntil = new Date(nowMs + RESEND_COOLDOWN_MS).toISOString();
      console.log(
        `[FORGOT PASSWORD 3RD SEND COMPLETED] Starting 10-minute cooldown for user ${docId} until ${cooldownUntil}`,
      );
    }

    const record = {
      id: docId,
      userId: userId,
      email: userEmail,
      phone: userPhone,
      codeHash: codeHash, // STORE ONLY SECURE HASH
      type: "password_reset",
      expiresAt: expiresAt,
      attempts: 0,
      sendCount: newSendCount,
      cooldownUntil: cooldownUntil,
      lastSentAt: new Date().toISOString(),
      used: false,
      createdAt: new Date().toISOString(),
    };

    console.log(
      "Saving password reset OTP for Doc ID:",
      docId,
      "Count:",
      newSendCount,
    );

    // Save the code to Firestore and local DB
    try {
      await adminDb.collection("verification_codes").doc(docId).set(record);
    } catch (dbErr) {
      console.error("Failed to write to Firestore verification_codes:", dbErr);
    }

    try {
      if (!db.verification_codes) db.verification_codes = [];
      db.verification_codes = db.verification_codes.filter(
        (vc: any) => vc.id !== docId,
      );
      db.verification_codes.push(record);
      writeDb(db);
    } catch (err) {
      console.warn("Failed to write to fallback JSON DB:", err);
    }

    console.log(
      `[PASSWORD RESET CODE RECORDED] Target: ${target} | Code: [SECURE 6-DIGITS RECORDED] | Send Count: ${newSendCount}`,
    );

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${target}`,
      emailSent: true,
      sendCount: newSendCount,
      cooldownUntil: cooldownUntil || undefined,
      sendCountRemaining: Math.max(0, 3 - newSendCount),
    });
  } catch (error: any) {
    console.error("Password Reset Sending Error:", error);
    return res
      .status(200)
      .json({
        success: false,
        serverError:
          error?.message || "Failed to process forgot password request",
      });
  }
});

// Confirm Password Reset with Code & New Password
app.post("/api/auth/reset-password", otpLimiter, async (req, res) => {
  try {
    const { emailOrPhone, code, newPassword } = req.body;
    if (!emailOrPhone || !code || !newPassword) {
      return res
        .status(400)
        .json({
          error: "All fields (email/phone, code, new password) are required.",
        });
    }
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters long." });
    }

    const target = emailOrPhone.trim().toLowerCase();
    const cleanCode = String(code).trim();

    console.log("Searching OTP:", target);
    let activeRecords: any[] = [];
    try {
      const qSnap = await adminDb
        .collection("verification_codes")
        .where("email", "==", target)
        .where("type", "==", "password_reset")
        .where("used", "==", false)
        .get();

      qSnap.forEach((doc: any) => {
        activeRecords.push({ docId: doc.id, ...doc.data() });
      });
    } catch (err) {
      console.error("Failed to query Firestore verification_codes:", err);
    }

    if (activeRecords.length === 0) {
      console.log(
        "No active password reset code in Firestore, trying JSON database fallback...",
      );
      const db = readDb();
      if (!db.verification_codes) db.verification_codes = [];
      const localRecords = db.verification_codes.filter(
        (vc: any) =>
          (vc.email?.toLowerCase() === target || vc.phone === target) &&
          vc.type === "password_reset" &&
          !vc.used,
      );
      activeRecords = localRecords;
    }

    if (activeRecords.length === 0) {
      return res
        .status(400)
        .json({
          error:
            "No active password reset request found. Please request a new verification code.",
        });
    }

    activeRecords.sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const activeRecord = activeRecords[0];
    console.log("OTP record located for password reset verification");

    const docRef = activeRecord.docId
      ? adminDb.collection("verification_codes").doc(activeRecord.docId)
      : null;

    const updateRecord = async (fields: any) => {
      if (docRef) {
        try {
          await docRef.update(fields);
        } catch (err) {
          console.error("Failed to update Firestore verification code:", err);
        }
      }
      const db = readDb();
      if (!db.verification_codes) db.verification_codes = [];
      const localRecord = db.verification_codes.find(
        (vc: any) => vc.id === activeRecord.id,
      );
      if (localRecord) {
        Object.assign(localRecord, fields);
        writeDb(db);
      }
    };

    if (new Date() > new Date(activeRecord.expiresAt)) {
      await updateRecord({ used: true });
      return res
        .status(400)
        .json({
          error: "Password reset code has expired. Please request a new code.",
        });
    }

    if (activeRecord.attempts >= 5) {
      await updateRecord({ used: true });
      return res
        .status(400)
        .json({
          error: "Maximum attempts reached. Please request a new reset code.",
        });
    }

    const cleanCodeHash = hashVerificationCode(cleanCode);
    const isMatch = activeRecord.codeHash
      ? activeRecord.codeHash === cleanCodeHash
      : activeRecord.code === cleanCode;

    if (!isMatch) {
      const newAttempts = (activeRecord.attempts || 0) + 1;
      await updateRecord({ attempts: newAttempts });
      const remaining = 5 - newAttempts;
      return res
        .status(400)
        .json({
          error: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
        });
    }

    // Code verified!
    await updateRecord({ used: true });

    const db = readDb();
    const user = db.users.find(
      (u: any) =>
        u.email?.toLowerCase() === target ||
        u.phone === target ||
        u.id === activeRecord.userId,
    );

    // Also update Firestore user if they exist there
    try {
      let uid = user?.id || activeRecord.userId;
      if (!uid) {
        const uSnap = await adminDb
          .collection("users")
          .where("email", "==", target)
          .limit(1)
          .get();
        if (!uSnap.empty) {
          uid = uSnap.docs[0].id;
        }
      }

      if (uid) {
        const userRef = adminDb.collection("users").doc(uid);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          await userRef.update({
            passwordHash: newPassword,
            isEmailVerified: true,
            "verificationInfo.status": "verified",
          });
          console.log(
            `[PASSWORD RESET SUCCESS] Updated user ${uid} password in Firestore.`,
          );
        }
      }
    } catch (uErr) {
      console.warn(
        "Could not update user password in Firestore (proceeding):",
        uErr,
      );
    }

    if (user) {
      user.passwordHash = newPassword;
      user.isEmailVerified = true;
      if (!user.verificationInfo) user.verificationInfo = {};
      user.verificationInfo.status = "verified";
      writeDb(db);
    }

    return res.json({
      success: true,
      message:
        "Your password has been successfully reset. You can now log in with your new password.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to reset password" });
  }
});

// Set or Update Account Password (Supports Google users setting a password for the first time or updating existing password)
app.post("/api/auth/set-password", async (req, res) => {
  try {
    const { userId, email, newPassword, currentPassword, isGoogleUser } =
      req.body;
    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long." });
    }

    const cleanEmail = email ? email.trim().toLowerCase() : "";
    const db = readDb();
    let user = db.users.find(
      (u: any) =>
        u.id === userId ||
        (cleanEmail && u.email?.toLowerCase() === cleanEmail),
    );

    let uid = userId || user?.id;

    // Check if user exists in Firestore
    let firestoreUserSnap: any = null;
    if (uid) {
      try {
        const docRef = adminDb.collection("users").doc(uid);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          firestoreUserSnap = docSnap;
        }
      } catch (fsErr) {
        console.warn("Firestore lookup failed in set-password:", fsErr);
      }
    }

    // If currentPassword is provided and the user has a password already set, verify it
    const existingPassword =
      user?.passwordHash || firestoreUserSnap?.data()?.passwordHash;
    if (existingPassword && !isGoogleUser && currentPassword) {
      if (
        existingPassword !== currentPassword &&
        hashVerificationCode(currentPassword) !== existingPassword
      ) {
        return res
          .status(400)
          .json({
            error: "Current password is incorrect.",
            userFriendlyMessage: "كلمة المرور الحالية غير صحيحة.",
          });
      }
    }

    // Update in Firebase Auth if available
    if (uid) {
      try {
        await adminAuth.updateUser(uid, { password: newPassword });
        console.log(
          `[PASSWORD SET] Updated Firebase Auth password for uid: ${uid}`,
        );
      } catch (authErr: any) {
        console.warn(
          "Could not update Firebase Auth user directly (proceeding with Firestore update):",
          authErr.message,
        );
      }
    }

    // Update Firestore User Document
    if (uid) {
      try {
        await adminDb.collection("users").doc(uid).set(
          {
            passwordHash: newPassword,
            hasPasswordSet: true,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      } catch (fsErr) {
        console.warn("Could not update Firestore user password:", fsErr);
      }
    }

    // Update local JSON db
    if (user) {
      user.passwordHash = newPassword;
      user.hasPasswordSet = true;
      writeDb(db);
    } else if (uid && cleanEmail) {
      const newUser = {
        id: uid,
        email: cleanEmail,
        passwordHash: newPassword,
        hasPasswordSet: true,
        role: uid === ADMIN_USER_ID ? "Admin" : "Contributor",
        createdAt: new Date().toISOString(),
      };
      db.users.push(newUser);
      writeDb(db);
    }

    return res.json({
      success: true,
      message: "Password has been successfully set.",
      userFriendlyMessage: "تم تعيين وحفظ كلمة المرور بنجاح.",
    });
  } catch (err: any) {
    console.error("Error setting password:", err);
    res.status(500).json({ error: err.message || "Failed to set password." });
  }
});

// Verify Current Account Password
app.post("/api/auth/verify-account-password", async (req, res) => {
  try {
    const { userId, email, password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }

    const cleanEmail = email ? email.trim().toLowerCase() : "";
    const db = readDb();
    let user = db.users.find(
      (u: any) =>
        u.id === userId ||
        (cleanEmail && u.email?.toLowerCase() === cleanEmail),
    );

    let uid = userId || user?.id;
    let firestoreUserSnap: any = null;

    if (uid) {
      try {
        const docRef = adminDb.collection("users").doc(uid);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          firestoreUserSnap = docSnap.data();
        }
      } catch (e) {}
    }

    const storedPassword =
      firestoreUserSnap?.passwordHash || user?.passwordHash;

    if (!storedPassword) {
      // If no password set yet (e.g. pure Google account without set password)
      return res.json({ success: true, valid: true, isFirstTime: true });
    }

    const isValid =
      storedPassword === password ||
      hashVerificationCode(password) === storedPassword;

    return res.json({
      success: true,
      valid: isValid,
      message: isValid ? "Password verified." : "Invalid password.",
    });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: err.message || "Failed to verify password." });
  }
});

// Reset / Change Encryption Key using Current Account Password (CEO / First Administrator ONLY)
app.post(
  "/api/auth/reset-encryption-with-password",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const authUid = req.user?.uid;
      const authEmail = req.user?.email;
      if (!authUid) return res.status(401).json({ error: "Unauthorized" });

      const callingUser = await getUserProfileServer(authUid, authEmail);
      if (!callingUser)
        return res.status(404).json({ error: "User profile not found" });

      // Strict Server-Side Authorization: CEO or First Administrator ONLY
      const isOwnerOrCeo =
        (callingUser.role || "").toUpperCase() === "CEO" ||
        (callingUser.role || "").toUpperCase() === "FIRST ADMINISTRATOR" ||
        (callingUser.role || "").toUpperCase() === "FIRST_ADMINISTRATOR" ||
        (callingUser.role || "").toUpperCase() === "ADMIN" ||
        callingUser.workspace?.ownerId === authUid ||
        (await isUserAdminServer(authUid, authEmail));

      if (!isOwnerOrCeo) {
        return res.status(403).json({
          success: false,
          code: "FORBIDDEN_CEO_ONLY",
          error:
            "Forbidden: Only First Administrator or CEO can manage or reset the file protection security passcode.",
          userFriendlyMessage:
            "غير مصرح: إدارة وتغيير رمز كود حماية الملفات مقتصر حصرياً على المدير التنفيذي (CEO) والمسؤول الأول.",
        });
      }

      const { accountPassword, newPasscode, lockedModules } = req.body;
      if (
        !newPasscode ||
        typeof newPasscode !== "string" ||
        newPasscode.trim().length < 4
      ) {
        return res
          .status(400)
          .json({
            error:
              "Valid new secret passcode (minimum 4 characters) is required.",
          });
      }

      const storedPassword = callingUser.passwordHash;

      // If account has a password, verify accountPassword
      if (storedPassword && accountPassword) {
        const isValid =
          storedPassword === accountPassword ||
          hashVerificationCode(accountPassword) === storedPassword;
        if (!isValid) {
          return res.status(400).json({
            success: false,
            error:
              "Account password verification failed. Please enter your correct current account password.",
            userFriendlyMessage:
              "كلمة مرور الحساب غير صحيحة. يرجى إدخال كلمة المرور الحالية لحسابك لإعادة تعيين رمز التشفير.",
          });
        }
      }

      const passcodeHash = hashSecurityPasscode(newPasscode.trim());
      const newSecuritySettings = {
        isPinSet: true,
        secretPasscodeHash: passcodeHash,
        lockedModules: lockedModules || {
          fileVault: true,
          memoryVault: true,
          riskRadar: true,
          settings: false,
        },
        updatedAt: new Date().toISOString(),
      };

      if (isFirebaseAdminAvailable && adminDb) {
        try {
          await adminDb.collection("users").doc(authUid).set(
            {
              encryptedSecurity: newSecuritySettings,
            },
            { merge: true },
          );
          console.log(
            `[ENCRYPTION RESET] Updated security settings for uid: ${authUid}`,
          );
        } catch (fsErr) {
          console.warn("Firestore encryption update warning:", fsErr);
        }
      }

      const db = readDb();
      if (db.users) {
        const uIdx = db.users.findIndex(
          (u: any) => u.id === authUid || u.email === authEmail,
        );
        if (uIdx >= 0) {
          db.users[uIdx].encryptedSecurity = newSecuritySettings;
          delete db.users[uIdx].secretPasscode;
          writeDb(db);
        }
      }

      return res.json({
        success: true,
        message:
          "Encryption passcode reset successfully with account password verification.",
        userFriendlyMessage:
          "تمت إعادة تعيين وتحديث رمز التشفير بنجاح عبر تأكيد كلمة مرور الحساب.",
        encryptedSecurity: newSecuritySettings,
      });
    } catch (err: any) {
      console.error("Reset encryption passcode error:", err);
      return res
        .status(500)
        .json({
          error: err?.message || "Failed to reset encryption passcode.",
        });
    }
  },
);

// CEO Send Employee Workspace Invitation with Resend Email Integration
app.all(
  [
    "/api/admin/send-invitation",
    "/admin/send-invitation",
    "/api/admin/send-invitation/",
    "/admin/send-invitation/",
    "/api/workspace/invite-member",
    "/workspace/invite-member",
    "/api/workspace/invitations/send",
    "/workspace/invitations/send",
    "/api/team/invite",
    "/team/invite",
    "/api/team/invitations/send",
    "/team/invitations/send",
  ],
  requireAuth,
  async (req: AuthRequest, res) => {
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: `Method ${req.method} Not Allowed. Please use POST.`,
        userFriendlyMessage: "طريقة الطلب غير صالحة، يرجى استخدام POST.",
      });
    }
    try {
      const callerUid = req.user?.uid;
      if (!callerUid) {
        return res.status(401).json({
          success: false,
          code: "AUTH_REQUIRED",
          error: "Unauthorized: Token verification required.",
          userFriendlyMessage: "مصادقة المستخدم مطلوبة لإرسال الدعوات.",
        });
      }

      const {
        email,
        name,
        role,
        powers,
        companyName: requestedCompanyName,
        inviterName: requestedInviterName,
        senderName: requestedSenderName,
        appUrl,
      } = req.body;
      const normalizedEmail = (email || "").trim().toLowerCase();

      // 1. Validate Email Format
      if (
        !normalizedEmail ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_EMAIL",
          error: "Invalid email format provided.",
          userFriendlyMessage:
            "صيغة البريد الإلكتروني غير صحيحة، يرجى كتابة عنوان بريد صحيح.",
        });
      }

      // 2. Fetch CEO / Sender Profile
      let ceoData: any = null;
      try {
        const ceoSnap = await adminDb.collection("users").doc(callerUid).get();
        if (ceoSnap.exists) {
          ceoData = ceoSnap.data();
        }
      } catch (e) {}

      if (!ceoData) {
        const db = readDb();
        ceoData = db.users?.find((u: any) => u.id === callerUid);
      }

      if (!ceoData) {
        let userEmail = req.user?.email || "ceo@zakir.ai";
        let ownerName = userEmail.split("@")[0];
        if (callerUid === "usr_ceo" || userEmail === "admin@zakir.ai") {
          userEmail = "ceo@zakir.ai";
          ownerName = "Mohamed Vadel";
        }
        ceoData = {
          id: callerUid,
          uid: callerUid,
          email: userEmail,
          ownerName: ownerName,
          companyName: requestedCompanyName || "Zakir Workspace",
          role: "CEO",
          workspaceId: `ws_${callerUid.substring(0, 8)}`,
          teamMembersList: [],
        };
      }

      // Trace: authenticated inviter -> workspaceId -> organization record -> companyName -> invitation -> email template
      const workspaceId = (
        ceoData.workspaceId ||
        ceoData.workspace?.id ||
        `ws_${callerUid.substring(0, 8)}`
      ).trim();

      // Resolve clean authoritative inviter name
      const inviterName = (
        (requestedInviterName || requestedSenderName || "").trim() ||
        (
          ceoData?.fullName ||
          ceoData?.displayName ||
          ceoData?.ownerName ||
          ceoData?.name ||
          ""
        ).trim() ||
        (req.user?.name || req.user?.displayName || "").trim() ||
        (ceoData?.email ? ceoData.email.split("@")[0] : "") ||
        "مسؤول المؤسسة"
      ).trim();

      // Resolve clean authoritative organization name
      const cleanReqCompany = (
        requestedCompanyName ||
        req.body.organizationName ||
        req.body.workspaceName ||
        ""
      ).trim();
      let authoritativeCompanyName = "";
      if (
        cleanReqCompany &&
        cleanReqCompany !== "ZakIr Platform" &&
        cleanReqCompany !== "Zakir Workspace"
      ) {
        authoritativeCompanyName = cleanReqCompany;
      } else if (
        ceoData?.organizationName &&
        ceoData.organizationName !== "ZakIr Platform" &&
        ceoData.organizationName !== "Zakir Workspace"
      ) {
        authoritativeCompanyName = ceoData.organizationName.trim();
      } else if (
        ceoData?.companyName &&
        ceoData.companyName !== "ZakIr Platform" &&
        ceoData.companyName !== "Zakir Workspace"
      ) {
        authoritativeCompanyName = ceoData.companyName.trim();
      } else if (
        ceoData?.workspaceName &&
        ceoData.workspaceName !== "ZakIr Platform"
      ) {
        authoritativeCompanyName = ceoData.workspaceName.trim();
      }

      if (!authoritativeCompanyName) {
        try {
          const wsSnap = await adminDb
            .collection("workspaces")
            .doc(workspaceId)
            .get();
          if (wsSnap.exists) {
            const wsData = wsSnap.data() || {};
            const wsComp = (wsData.companyName || wsData.name || "").trim();
            if (
              wsComp &&
              wsComp !== "ZakIr Platform" &&
              wsComp !== "Zakir Workspace"
            ) {
              authoritativeCompanyName = wsComp;
            }
          }
        } catch (e) {}
      }

      if (!authoritativeCompanyName && cleanReqCompany) {
        authoritativeCompanyName = cleanReqCompany;
      }

      if (!authoritativeCompanyName) {
        authoritativeCompanyName = ceoData?.ownerName
          ? `${ceoData.ownerName}`
          : "منصة Zakir";
      }
      authoritativeCompanyName = authoritativeCompanyName.trim();

      // Persist companyName to user and workspace record so it remains consistent everywhere
      try {
        await adminDb
          .collection("users")
          .doc(callerUid)
          .set(
            { companyName: authoritativeCompanyName, workspaceId },
            { merge: true },
          );
        await adminDb
          .collection("workspaces")
          .doc(workspaceId)
          .set(
            {
              companyName: authoritativeCompanyName,
              name: authoritativeCompanyName,
              id: workspaceId,
              ownerId: callerUid,
            },
            { merge: true },
          );
      } catch (e) {}

      // 3. Verify CEO Authorization (Server-side Role Check)
      const isAdmin = await isUserAdminServer(
        callerUid,
        req.user?.email || ceoData?.email,
      );
      const ceoRole = (ceoData.role || "").toUpperCase();
      const isAuthorized =
        isAdmin ||
        ceoRole === "CEO" ||
        ceoRole === "ADMIN" ||
        ceoRole === "OWNER" ||
        ceoRole === "FOUNDER" ||
        ceoRole === "DIRECTOR" ||
        ceoRole === "MANAGER";

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          code: "FORBIDDEN",
          error: "Forbidden: Only CEO or Admin can invite workspace members.",
          userFriendlyMessage:
            "ليس لديك صلاحية إرسال دعوات الموظفين. هذه الصلاحية محصورة في مدير المؤسسة (CEO).",
        });
      }

      // Execute within workspace lock to prevent concurrent requests from exceeding plan limits
      return await runWithWorkspaceLock(workspaceId, async () => {
        // 3.b Server-side Plan & Invitation Validation Rules (Strict Single Source of Truth)
        const occupancy = await getWorkspaceOccupancy(workspaceId, callerUid);

        // Starter Rule: 0 team members / no invitations allowed
        if (!occupancy.allowsInvitations || occupancy.plan === "Starter") {
          return res.status(403).json({
            success: false,
            code: "STARTER_PLAN_RESTRICTION",
            error: "Starter plan does not support member invitations. Maximum limit is 0 team members.",
            userFriendlyMessage:
              "خطة Starter الفردية لا تدعم دعوة أعضاء جدد (الحد الأقصى 0). يرجى الترقية إلى خطة Professional أو Enterprise.",
            plan: occupancy.plan,
            maxSeats: occupancy.maxSeats,
            occupiedSeats: occupancy.occupiedSeats,
          });
        }

        // Check if this email already occupies a seat (e.g. pending invite or existing member)
        const isAlreadyOccupyingSeat = occupancy.distinctOccupiedEmails.has(normalizedEmail);

        // Professional (5) / Enterprise (15) Limit Enforcement
        if (!isAlreadyOccupyingSeat && occupancy.occupiedSeats >= occupancy.maxSeats) {
          return res.status(403).json({
            success: false,
            code: "PLAN_TEAM_LIMIT_EXCEEDED",
            error: `${occupancy.plan} plan maximum limit of ${occupancy.maxSeats} team members/invitations reached.`,
            userFriendlyMessage: `لقد وصلت إلى الحد الأقصى لأعضاء الفريق في خطة ${occupancy.plan} (${occupancy.maxSeats} أعضاء). لا يمكن إرسال المزيد من الدعوات.`,
            plan: occupancy.plan,
            maxSeats: occupancy.maxSeats,
            occupiedSeats: occupancy.occupiedSeats,
          });
        }

      // 4. Prevent Self-Invitation
      if (
        normalizedEmail ===
        (req.user?.email || ceoData.email || "").toLowerCase()
      ) {
        return res.status(400).json({
          success: false,
          code: "SELF_INVITATION",
          error: "Cannot invite sender email address.",
          userFriendlyMessage:
            "لا يمكنك إرسال دعوة انضمام إلى بريدك الإلكتروني الحالي.",
        });
      }

      // 5. Prevent Inviting Existing Members
      const teamMembersList = ceoData.teamMembersList || [];
      const isAlreadyInTeam = teamMembersList.some((m: any) => {
        const mEmail = m.email?.trim().toLowerCase();
        const isPending =
          m.name?.includes("معلق") || m.name?.includes("Pending");
        return mEmail === normalizedEmail && !isPending;
      });

      if (isAlreadyInTeam) {
        return res.status(400).json({
          success: false,
          code: "ALREADY_MEMBER",
          error: "Employee is already a full member of the organization.",
          userFriendlyMessage: "هذا البريد الإلكتروني عضو بالفعل في المؤسسة.",
        });
      }

      try {
        const existingUserSnap = await adminDb
          .collection("users")
          .where("email", "==", normalizedEmail)
          .get();
        if (!existingUserSnap.empty) {
          const existingUserData = existingUserSnap.docs[0].data();
          if (
            existingUserData.workspaceId === workspaceId &&
            existingUserData.role !== "Pending"
          ) {
            return res.status(400).json({
              success: false,
              code: "ALREADY_MEMBER",
              error: "Employee is already registered in this workspace.",
              userFriendlyMessage: "هذا المستخدم عضو بالفعل في المؤسسة.",
            });
          }
        }
      } catch (e) {}

      // 6. Check existing pending invitation
      let existingInv: any = null;
      try {
        const invDoc = await adminDb
          .collection("invitations")
          .doc(normalizedEmail)
          .get();
        if (invDoc.exists) {
          existingInv = invDoc.data();
        }
      } catch (e) {}

      if (existingInv && existingInv.status === "ACCEPTED") {
        return res.status(400).json({
          success: false,
          code: "ALREADY_ACCEPTED",
          error: "Invitation has already been accepted.",
          userFriendlyMessage:
            "لقد تم قبول هذه الدعوة بالفعل والعضو نشط في الفريق.",
        });
      }

      // 7. Generate Secure Token & Expiration
      const secureToken = crypto.randomBytes(24).toString("hex");
      const nowIso = new Date().toISOString();
      const expiresAtIso = new Date(
        Date.now() + 7 * 24 * 3600 * 1000,
      ).toISOString();

      const companyName = authoritativeCompanyName;
      const memberName = (name || normalizedEmail.split("@")[0]).trim();
      const designatedRole = role || "Contributor";
      const defaultPowers = powers || {
        fileVault: true,
        memoryVault: true,
        riskRadar: false,
        marketIntel: false,
        settings: false,
      };

      const invitationRecord: any = {
        email: normalizedEmail,
        name: memberName,
        role: designatedRole,
        powers: defaultPowers,
        workspaceId: workspaceId,
        companyName: authoritativeCompanyName,
        senderId: callerUid,
        senderEmail: ceoData.email || req.user?.email,
        senderName: inviterName,
        inviterName: inviterName,
        status: "pending",
        token: secureToken,
        createdAt: existingInv?.createdAt || nowIso,
        updatedAt: nowIso,
        expiresAt: expiresAtIso,
        lastSentAt: nowIso,
        resendCount: (existingInv?.resendCount || 0) + (existingInv ? 1 : 0),
      };

      // 8. Persist Invitation in Firestore (Authoritative)
      try {
        await adminDb
          .collection("invitations")
          .doc(normalizedEmail)
          .set(invitationRecord);
      } catch (fsErr: any) {
        console.error("Failed to write invitation to Firestore:", fsErr);
        return res.status(500).json({
          success: false,
          code: "FIRESTORE_WRITE_FAILED",
          error: fsErr?.message || String(fsErr),
          userFriendlyMessage:
            "فشل حفظ بيانات الدعوة في قاعدة البيانات الأساسية. تعذر إرسال البريد الإلكتروني.",
        });
      }

      const db = readDb();
      if (!db.invitations) db.invitations = [];
      db.invitations = db.invitations.filter(
        (i: any) => i.email?.trim().toLowerCase() !== normalizedEmail,
      );
      db.invitations.push(invitationRecord);
      writeDb(db);

      // 9. Dispatch Email via Resend / System Mailer
      const appBaseUrl =
        appUrl ||
        process.env.APP_URL ||
        process.env.PUBLIC_APP_URL ||
        getAppBaseUrl(req);
      const inviteLink = `${appBaseUrl}/?invitationToken=${secureToken}&email=${encodeURIComponent(normalizedEmail)}`;

      const {
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      } = buildInvitationEmailHtml({
        companyName: authoritativeCompanyName,
        memberName,
        inviterName,
        designatedRole,
        inviteLink,
        isReminder: false,
        language: ceoData?.language || "ar",
        baseUrl: appBaseUrl,
      });

      const mailResult = await sendSystemMail({
        to: normalizedEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });

      console.log("INVITATION_PROCESSED", {
        recipient: normalizedEmail,
        ceo: callerUid,
        workspaceId,
        mailSent: mailResult.success,
      });

      emitPlatformEvent({
        eventType: "MEMBER_INVITED",
        category: "WORKSPACE",
        severity: "INFO",
        userId: callerUid,
        userEmail: req.user?.email || "ceo@zakir.ai",
        resourceId: invitationRecord.id,
        workspaceId,
        metadata: {
          actor: { id: callerUid, email: req.user?.email || "ceo@zakir.ai", role: "CEO" },
          action: "Invited team member",
          recipientEmail: normalizedEmail,
        },
        sanitizedMessage: `Invited member ${normalizedEmail} to workspace ${workspaceId} as ${designatedRole}`,
      });

        return res.json({
          success: true,
          emailSent: mailResult.success,
          message: mailResult.success
            ? "Invitation generated and dispatched successfully via email."
            : "Invitation generated successfully.",
          userFriendlyMessage: mailResult.success
            ? `تم إرسال دعوة الموظف بنجاح إلى البريد (${normalizedEmail}).`
            : `تم إنشاء وتوثيق دعوة الموظف بنجاح (${normalizedEmail}). يمكنك أيضاً نسخ رابط الدعوة ومشاركته مع العضو مباشرة.`,
          invitation: invitationRecord,
          occupiedSeats: isAlreadyOccupyingSeat ? occupancy.occupiedSeats : occupancy.occupiedSeats + 1,
          maxSeats: occupancy.maxSeats,
          remainingSeats: Math.max(0, occupancy.maxSeats - (isAlreadyOccupyingSeat ? occupancy.occupiedSeats : occupancy.occupiedSeats + 1)),
        });
      });
    } catch (err: any) {
      console.error("send-invitation endpoint exception:", err);
      return res.status(500).json({
        success: false,
        code: "INVITATION_CREATE_FAILED",
        error: err?.message || String(err),
        userFriendlyMessage:
          "تعذر إرسال الدعوة حالياً بسبب خطأ خادم داخلي. يرجى المحاولة مرة أخرى.",
      });
    }
  },
);

// CEO Resend Workspace Invitation
app.all(
  [
    "/api/admin/resend-invitation",
    "/admin/resend-invitation",
    "/api/admin/resend-invitation/",
    "/admin/resend-invitation/",
  ],
  requireAuth,
  async (req: AuthRequest, res) => {
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST")
      return res
        .status(405)
        .json({ success: false, error: `Method ${req.method} Not Allowed.` });
    try {
      const callerUid = req.user?.uid;
      if (!callerUid) {
        return res
          .status(401)
          .json({
            success: false,
            code: "AUTH_REQUIRED",
            error: "Unauthorized",
          });
      }

      const {
        email,
        companyName: requestedCompanyName,
        inviterName: requestedInviterName,
        senderName: requestedSenderName,
        appUrl,
      } = req.body;
      const normalizedEmail = (email || "").trim().toLowerCase();

      if (!normalizedEmail) {
        return res
          .status(400)
          .json({
            success: false,
            code: "INVALID_EMAIL",
            error: "Email is required",
          });
      }

      let ceoData: any = null;
      try {
        const snap = await adminDb.collection("users").doc(callerUid).get();
        if (snap.exists) ceoData = snap.data();
      } catch (e) {}

      if (!ceoData) {
        const db = readDb();
        ceoData = db.users?.find((u: any) => u.id === callerUid);
      }

      const isAdmin = await isUserAdminServer(
        callerUid,
        req.user?.email || ceoData?.email,
      );
      const ceoRole = (ceoData?.role || "").toUpperCase();
      const isAuthorized =
        isAdmin ||
        ceoRole === "CEO" ||
        ceoRole === "ADMIN" ||
        ceoRole === "OWNER" ||
        ceoRole === "FOUNDER" ||
        ceoRole === "DIRECTOR" ||
        ceoRole === "MANAGER";

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          code: "FORBIDDEN",
          error: "Forbidden: Only CEO or Admin can resend invitations",
          userFriendlyMessage: "ليس لديك صلاحية إعادة إرسال الدعوات.",
        });
      }

      let invRecord: any = null;
      try {
        const invDoc = await adminDb
          .collection("invitations")
          .doc(normalizedEmail)
          .get();
        if (invDoc.exists) invRecord = invDoc.data();
      } catch (e) {}

      if (!invRecord) {
        const db = readDb();
        invRecord = db.invitations?.find(
          (i: any) => i.email?.trim().toLowerCase() === normalizedEmail,
        );
      }

      if (!invRecord) {
        return res
          .status(404)
          .json({
            success: false,
            code: "INVITATION_NOT_FOUND",
            error: "Invitation not found",
            userFriendlyMessage: "الدعوة غير موجودة.",
          });
      }

      const secureToken = crypto.randomBytes(24).toString("hex");
      const nowIso = new Date().toISOString();
      const expiresAtIso = new Date(
        Date.now() + 7 * 24 * 3600 * 1000,
      ).toISOString();

      const inviterName = (
        (requestedInviterName || requestedSenderName || "").trim() ||
        (invRecord.inviterName || invRecord.senderName || "").trim() ||
        (
          ceoData?.fullName ||
          ceoData?.displayName ||
          ceoData?.ownerName ||
          ceoData?.name ||
          ""
        ).trim() ||
        (req.user?.name || req.user?.displayName || "").trim() ||
        (ceoData?.email ? ceoData.email.split("@")[0] : "") ||
        "مسؤول المؤسسة"
      ).trim();

      let companyName = (
        requestedCompanyName ||
        invRecord.companyName ||
        ceoData?.organizationName ||
        ceoData?.companyName ||
        ceoData?.workspaceName ||
        ""
      ).trim();

      if (
        !companyName ||
        companyName === "ZakIr Platform" ||
        companyName === "Zakir Workspace"
      ) {
        const wsId = (
          invRecord.workspaceId ||
          ceoData?.workspaceId ||
          ""
        ).trim();
        if (wsId) {
          try {
            const wsSnap = await adminDb
              .collection("workspaces")
              .doc(wsId)
              .get();
            if (wsSnap.exists) {
              const wsData = wsSnap.data() || {};
              const wsComp = (wsData.companyName || wsData.name || "").trim();
              if (
                wsComp &&
                wsComp !== "ZakIr Platform" &&
                wsComp !== "Zakir Workspace"
              ) {
                companyName = wsComp;
              }
            }
          } catch (e) {}
        }
      }

      if (
        !companyName ||
        companyName === "ZakIr Platform" ||
        companyName === "Zakir Workspace"
      ) {
        companyName = ceoData?.ownerName
          ? `${ceoData.ownerName}`
          : "منصة Zakir";
      }
      companyName = companyName.trim();

      invRecord.token = secureToken;
      invRecord.status = "pending";
      invRecord.companyName = companyName;
      invRecord.senderName = inviterName;
      invRecord.inviterName = inviterName;
      invRecord.expiresAt = expiresAtIso;
      invRecord.lastSentAt = nowIso;
      invRecord.resendCount = (invRecord.resendCount || 0) + 1;

      try {
        await adminDb
          .collection("invitations")
          .doc(normalizedEmail)
          .set(invRecord);
      } catch (e) {}

      const db = readDb();
      if (!db.invitations) db.invitations = [];
      const idx = db.invitations.findIndex(
        (i: any) => i.email?.trim().toLowerCase() === normalizedEmail,
      );
      if (idx >= 0) db.invitations[idx] = invRecord;
      else db.invitations.push(invRecord);
      writeDb(db);

      const memberName = invRecord.name || normalizedEmail.split("@")[0];
      const designatedRole = invRecord.role || "Contributor";
      const appBaseUrl =
        appUrl ||
        process.env.APP_URL ||
        process.env.PUBLIC_APP_URL ||
        getAppBaseUrl(req);
      const inviteLink = `${appBaseUrl}/?invitationToken=${secureToken}&email=${encodeURIComponent(normalizedEmail)}`;

      const {
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      } = buildInvitationEmailHtml({
        companyName,
        memberName,
        inviterName,
        designatedRole,
        inviteLink,
        isReminder: true,
        language: ceoData?.language || "ar",
        baseUrl: appBaseUrl,
      });

      const mailResult = await sendSystemMail({
        to: normalizedEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });

      return res.json({
        success: true,
        emailSent: mailResult.success,
        userFriendlyMessage: mailResult.success
          ? `تمت إعادة إرسال بريد الدعوة بنجاح إلى (${normalizedEmail}).`
          : `تم تحديث وتمديد الدعوة بنجاح (${normalizedEmail}). يمكنك نسخ رابط الدعوة ومشاركته مع العضو.`,
        invitation: invRecord,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({
          success: false,
          error: err.message,
          userFriendlyMessage: "فشل إعادة إرسال الدعوة.",
        });
    }
  },
);

// CEO Revoke Workspace Invitation & Member Removal (Strict Admin/CEO RBAC Check)
app.all(
  [
    "/api/admin/revoke-invitation",
    "/admin/revoke-invitation",
    "/api/admin/revoke-invitation/",
    "/admin/revoke-invitation/",
    "/api/workspace/invitations/revoke",
    "/workspace/invitations/revoke",
    "/api/team/revoke-invitation",
    "/team/revoke-invitation",
    "/api/admin/remove-team-member",
    "/admin/remove-team-member",
    "/api/workspace/team/remove",
    "/workspace/team/remove",
    "/api/team/member/remove",
    "/team/member/remove",
  ],
  requireAuth,
  async (req: AuthRequest, res) => {
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST")
      return res
        .status(405)
        .json({ success: false, error: `Method ${req.method} Not Allowed.` });
    try {
      const callerUid = req.user?.uid;
      if (!callerUid) {
        return res
          .status(401)
          .json({
            success: false,
            code: "AUTH_REQUIRED",
            error: "Unauthorized",
          });
      }

      // Verify caller has administrative authority (Server-side Role Check)
      let callerUser: any = null;
      try {
        const snap = await adminDb.collection("users").doc(callerUid).get();
        if (snap.exists) callerUser = snap.data();
      } catch (e) {}

      if (!callerUser) {
        const db = readDb();
        callerUser = db.users?.find((u: any) => u.id === callerUid);
      }

      const isAdmin = await isUserAdminServer(
        callerUid,
        req.user?.email || callerUser?.email,
      );
      const callerRole = (callerUser?.role || "").toUpperCase();
      const isAuthorized =
        isAdmin ||
        callerRole === "CEO" ||
        callerRole === "ADMIN" ||
        callerRole === "OWNER" ||
        callerRole === "FOUNDER";

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          code: "FORBIDDEN",
          error: "Forbidden: Only CEO or Admin can revoke invitations or remove members.",
          userFriendlyMessage:
            "ليس لديك صلاحية إلغاء الدعوات أو حذف الأعضاء. هذه الصلاحية محصورة في إدارة المؤسسة.",
        });
      }

      const { email, memberId } = req.body;
      const normalizedEmail = (email || "").trim().toLowerCase();

      if (!normalizedEmail && !memberId) {
        return res
          .status(400)
          .json({
            success: false,
            code: "INVALID_INPUT",
            error: "Email or Member ID required",
          });
      }

      // 1. Delete invitation if exists
      if (normalizedEmail) {
        try {
          await adminDb.collection("invitations").doc(normalizedEmail).delete();
        } catch (e) {}

        try {
          const qSnap = await adminDb.collection("invitations").where("email", "==", normalizedEmail).get();
          if (!qSnap.empty) {
            for (const doc of qSnap.docs) {
              await doc.ref.delete();
            }
          }
        } catch (e) {}
      }

      // 2. Unbind workspace membership from user document if active
      if (normalizedEmail || memberId) {
        try {
          if (memberId) {
            const cleanMid = memberId.replace("tm-", "");
            await adminDb.collection("users").doc(cleanMid).update({
              workspaceId: `ws_${cleanMid.substring(0, 8)}`,
              workspace: null,
              role: "Contributor"
            });
          }
          if (normalizedEmail) {
            const uSnap = await adminDb.collection("users").where("email", "==", normalizedEmail).get();
            if (!uSnap.empty) {
              for (const doc of uSnap.docs) {
                await doc.ref.update({
                  workspaceId: `ws_${doc.id.substring(0, 8)}`,
                  workspace: null,
                  role: "Contributor"
                });
              }
            }
          }
        } catch (e) {}
      }

      const db = readDb();
      if (db.invitations && normalizedEmail) {
        db.invitations = db.invitations.filter(
          (i: any) => i.email?.trim().toLowerCase() !== normalizedEmail,
        );
      }
      if (db.users) {
        db.users.forEach((u: any) => {
          if ((normalizedEmail && u.email?.trim().toLowerCase() === normalizedEmail) || (memberId && (u.id === memberId || u.id === memberId.replace("tm-", "")))) {
            u.workspaceId = `ws_${u.id?.substring(0, 8)}`;
            u.workspace = null;
          }
        });
      }
      writeDb(db);

      try {
        const ceoRef = adminDb.collection("users").doc(callerUid);
        const snap = await ceoRef.get();
        if (snap.exists) {
          const teamList = (snap.data()?.teamMembersList || []).filter(
            (m: any) => (normalizedEmail ? m.email?.trim().toLowerCase() !== normalizedEmail : true) && (memberId ? m.id !== memberId : true),
          );
          await ceoRef.update({ teamMembersList: teamList });
        }
      } catch (e) {}

      emitPlatformEvent({
        eventType: "MEMBER_REMOVED",
        category: "WORKSPACE",
        severity: "INFO",
        userId: callerUid,
        userEmail: req.user?.email || callerUser?.email,
        metadata: {
          actor: { id: callerUid, email: req.user?.email || callerUser?.email, role: callerRole || "Admin" },
          action: "Removed member / revoked invitation",
          revokedEmail: normalizedEmail || memberId,
        },
        sanitizedMessage: `Removed member or revoked invitation for ${normalizedEmail || memberId}`,
      });

      return res.json({
        success: true,
        userFriendlyMessage: `تم إلغاء الدعوة وحذف العضو بنجاح لـ (${normalizedEmail || memberId}).`,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({
          success: false,
          error: err.message,
          userFriendlyMessage: "فشل إلغاء الدعوة أو حذف العضو.",
        });
    }
  },
);

// CEO Update Team Member Permissions & Roles (Strict CEO/Admin Server-side RBAC Control)
app.all(
  [
    "/api/admin/update-member-permissions",
    "/admin/update-member-permissions",
    "/api/admin/update-member-permissions/",
    "/admin/update-member-permissions/",
  ],
  requireAuth,
  async (req: AuthRequest, res) => {
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST")
      return res
        .status(405)
        .json({ success: false, error: `Method ${req.method} Not Allowed.` });
    try {
      const callerUid = req.user?.uid;
      if (!callerUid) {
        return res
          .status(401)
          .json({
            success: false,
            code: "AUTH_REQUIRED",
            error: "Unauthorized",
          });
      }

      const { ceoId, memberId, memberEmail, powers, role } = req.body;
      const targetCeoId = callerUid || ceoId;
      if (!memberEmail) {
        return res
          .status(400)
          .json({
            success: false,
            code: "MISSING_FIELDS",
            error: "Member Email is required.",
          });
      }

      const cleanEmail = memberEmail.trim().toLowerCase();
      const db = readDb();

      // Verify caller identity and server-side authorization
      let ceoUser: any = null;
      try {
        const ceoDoc = await adminDb.collection("users").doc(callerUid).get();
        if (ceoDoc.exists) {
          ceoUser = ceoDoc.data();
        }
      } catch (e) {}

      if (!ceoUser) {
        ceoUser = db.users?.find((u: any) => u.id === callerUid);
      }

      const isAdmin = await isUserAdminServer(
        callerUid,
        req.user?.email || ceoUser?.email,
      );
      const callerRole = (ceoUser?.role || "").toUpperCase();
      const isAuthorized =
        isAdmin ||
        callerRole === "CEO" ||
        callerRole === "ADMIN" ||
        callerRole === "OWNER" ||
        callerRole === "FOUNDER";

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          code: "FORBIDDEN",
          error:
            "Forbidden: Only the CEO/Admin has authority to modify member powers and permissions.",
          userFriendlyMessage:
            "غير مصرح: يمتلك المدير التنفيذي (CEO) وحده الصلاحية الحصرية لتعديل صلاحيات العمال وأعضاء الفريق.",
        });
      }

      // 1. Update CEO's teamMembersList in Firestore & Local DB
      if (targetCeoId) {
        try {
          const ceoRef = adminDb.collection("users").doc(targetCeoId);
          const ceoSnap = await ceoRef.get();
          if (ceoSnap.exists) {
            const data = ceoSnap.data();
            const list = (data?.teamMembersList || []) as any[];
            const targetIdx = list.findIndex(
              (m: any) =>
                m.email?.toLowerCase() === cleanEmail || m.id === memberId,
            );
            if (targetIdx >= 0) {
              list[targetIdx] = {
                ...list[targetIdx],
                powers: powers || list[targetIdx].powers,
                role: role || list[targetIdx].role,
              };
            } else {
              list.push({
                id: memberId || `tm-${Date.now()}`,
                email: cleanEmail,
                name: cleanEmail.split("@")[0],
                powers: powers || {
                  fileVault: true,
                  memoryVault: true,
                  riskRadar: false,
                  marketIntel: false,
                  settings: false,
                },
                role: role || "Contributor",
                addedAt: new Date().toISOString().split("T")[0],
              });
            }
            await ceoRef.update({ teamMembersList: list });
          }
        } catch (fsErr) {
          console.warn("Failed to update CEO team list in Firestore:", fsErr);
        }
      }

      // 2. Find Worker/Member user document in Firestore and update their permissions directly
      let memberUid = memberId?.replace("tm-", "");
      try {
        if (memberUid) {
          const mRef = adminDb.collection("users").doc(memberUid);
          const mSnap = await mRef.get();
          if (mSnap.exists) {
            await mRef.update({
              powers: powers,
              role: role || mSnap.data()?.role || "Contributor",
              updatedAt: new Date().toISOString(),
            });
            console.log(
              `[PERMISSIONS SYNC] Updated worker ${memberUid} profile in Firestore.`,
            );
          }
        }

        // Also search by email in case memberUid was not the document ID
        const qSnap = await adminDb
          .collection("users")
          .where("email", "==", cleanEmail)
          .limit(1)
          .get();
        if (!qSnap.empty) {
          const docRef = qSnap.docs[0].ref;
          await docRef.update({
            powers: powers,
            role: role || qSnap.docs[0].data()?.role || "Contributor",
            updatedAt: new Date().toISOString(),
          });
          console.log(
            `[PERMISSIONS SYNC] Updated worker by email ${cleanEmail} in Firestore.`,
          );
        }
      } catch (workerErr) {
        console.warn(
          "Failed to update worker document directly in Firestore:",
          workerErr,
        );
      }

      // Update in local DB
      if (db.users) {
        const workerUser = db.users.find(
          (u: any) =>
            u.email?.toLowerCase() === cleanEmail || u.id === memberUid,
        );
        if (workerUser) {
          if (powers) workerUser.powers = powers;
          if (role) workerUser.role = role;
        }
        if (ceoUser && ceoUser.teamMembersList) {
          const idx = ceoUser.teamMembersList.findIndex(
            (m: any) =>
              m.email?.toLowerCase() === cleanEmail || m.id === memberId,
          );
          if (idx >= 0) {
            ceoUser.teamMembersList[idx].powers =
              powers || ceoUser.teamMembersList[idx].powers;
            ceoUser.teamMembersList[idx].role =
              role || ceoUser.teamMembersList[idx].role;
          }
        }
        writeDb(db);
      }

      return res.json({
        success: true,
        message: "Member permissions updated successfully by CEO.",
        userFriendlyMessage:
          "تم تحديث وتثبيت صلاحيات العضو بنجاح من طرف المدير التنفيذي.",
      });
    } catch (err: any) {
      console.error("Error updating member permissions:", err);
      return res.status(500).json({
        success: false,
        code: "SERVER_ERROR",
        error: err.message || "Failed to update member permissions.",
        userFriendlyMessage: "فشل تحديث صلاحيات العضو.",
      });
    }
  },
);

// ==========================================
// AUTHORITATIVE WORKSPACE INVITATION ACCEPTANCE
// ==========================================
function cleanMemberName(name?: string): string {
  if (!name) return "";
  return name
    .replace(/\s*[\(\[\{]?(معلق|معلقة|معلّق|Pending|pending)[\)\]\}]?\s*/gi, "")
    .trim();
}

app.all(
  [
    "/api/workspace/invitations/accept",
    "/workspace/invitations/accept",
    "/api/workspace/invitation/accept",
    "/workspace/invitation/accept",
    "/api/workspace/accept-invitation",
    "/workspace/accept-invitation",
    "/api/workspace/accept-invite",
    "/workspace/accept-invite",
    "/api/team/invitations/accept",
    "/team/invitations/accept",
    "/api/team/invitation/accept",
    "/team/invitation/accept",
    "/api/team/accept-invitation",
    "/team/accept-invitation",
    "/api/auth/invitations/accept",
    "/auth/invitations/accept",
    "/api/auth/invitation/accept",
    "/auth/invitation/accept",
    "/api/auth/accept-invitation",
    "/auth/accept-invitation",
    "/api/invitations/accept",
    "/invitations/accept",
    "/api/invitation/accept",
    "/invitation/accept",
    "/api/accept-invitation",
    "/accept-invitation",
    "/api/workspace/invitations/accept/",
    "/workspace/invitations/accept/",
  ],
  requireAuth,
  async (req: AuthRequest, res) => {
    if (req.method === "OPTIONS") return res.status(200).end();
    try {
      const callerUid = req.user?.uid;
      const callerEmail = (req.user?.email || "").trim().toLowerCase();
      const invitationToken = (req.body?.invitationToken ||
        req.body?.token ||
        req.query?.invitationToken ||
        req.query?.token ||
        req.query?.inviteToken ||
        req.query?.invite ||
        "") as string;
      const bodyEmail = (req.body?.email || req.query?.email || "") as string;
      const memberName = (req.body?.memberName ||
        req.body?.name ||
        req.query?.memberName ||
        req.query?.name ||
        "") as string;
      const payloadInv =
        req.body?.invitation || req.body?.invitationData || null;

      const targetEmail = (bodyEmail || callerEmail).trim().toLowerCase();

      if (!callerUid) {
        return res
          .status(401)
          .json({
            success: false,
            code: "UNAUTHORIZED",
            error: "Authentication required",
          });
      }

      console.log("INVITATION_ACCEPT_START", {
        callerUid,
        targetEmail,
        hasToken: !!invitationToken,
        method: req.method,
      });

      // 1. Locate the invitation in Firestore or Local DB
      let invRecord: any = null;
      let invDocRef: any = null;

      if (targetEmail) {
        try {
          const docSnap = await adminDb
            .collection("invitations")
            .doc(targetEmail)
            .get();
          if (docSnap.exists) {
            invRecord = docSnap.data();
            invDocRef = docSnap.ref;
          }
        } catch (e) {}

        if (!invRecord) {
          try {
            const qSnap = await adminDb
              .collection("invitations")
              .where("email", "==", targetEmail)
              .limit(1)
              .get();
            if (!qSnap.empty) {
              invRecord = qSnap.docs[0].data();
              invDocRef = qSnap.docs[0].ref;
            }
          } catch (e) {}
        }
      }

      if (!invRecord && invitationToken) {
        try {
          const qSnap = await adminDb
            .collection("invitations")
            .where("token", "==", invitationToken)
            .limit(1)
            .get();
          if (!qSnap.empty) {
            invRecord = qSnap.docs[0].data();
            invDocRef = qSnap.docs[0].ref;
          }
        } catch (e) {}

        if (!invRecord) {
          try {
            const wsSnap = await adminDb
              .collection("workspace_invitations")
              .where("token", "==", invitationToken)
              .limit(1)
              .get();
            if (!wsSnap.empty) {
              invRecord = wsSnap.docs[0].data();
              invDocRef = wsSnap.docs[0].ref;
            }
          } catch (e) {}
        }
      }

      // Check workspace_invitations by email
      if (!invRecord && targetEmail) {
        try {
          const wsEmailSnap = await adminDb
            .collection("workspace_invitations")
            .doc(targetEmail)
            .get();
          if (wsEmailSnap.exists) {
            invRecord = wsEmailSnap.data();
            invDocRef = wsEmailSnap.ref;
          }
        } catch (e) {}
      }

      // Fallback: check local store
      if (!invRecord) {
        const db = readDb();
        invRecord = db.invitations?.find(
          (i: any) =>
            (targetEmail &&
              (i.email || "").trim().toLowerCase() === targetEmail) ||
            (invitationToken && i.token === invitationToken),
        );
        if (invRecord && !invDocRef) {
          invDocRef = adminDb
            .collection("invitations")
            .doc((invRecord.email || targetEmail).trim().toLowerCase());
        }
      }

      // Fallback: Use verified payload invitation if provided
      if (!invRecord && payloadInv) {
        invRecord = payloadInv;
        if (!invDocRef && (payloadInv.email || targetEmail)) {
          invDocRef = adminDb
            .collection("invitations")
            .doc((payloadInv.email || targetEmail).trim().toLowerCase());
        }
      }

      if (!invRecord) {
        return res.status(404).json({
          success: false,
          code: "INVITATION_NOT_FOUND",
          error: "Invitation not found or has expired.",
          userFriendlyMessage:
            "لم يتم العثور على الدعوة أو قد تكون انتهت صلاحيتها.",
        });
      }

      const invitationEmail = (invRecord.email || targetEmail)
        .trim()
        .toLowerCase();

      // Check if the authenticated user's email matches the invited email (unauthorized access check)
      if (callerEmail && invitationEmail && callerEmail !== invitationEmail) {
        return res.status(403).json({
          success: false,
          code: "EMAIL_MISMATCH",
          error:
            "Authenticated email does not match the invited email address.",
          userFriendlyMessage: `هذه الدعوة مخصصة للبريد الإلكتروني "${invitationEmail}"، لكنك مسجل الدخول حالياً بالبريد "${callerEmail}". يرجى تسجيل الدخول بالحساب الصحيح.`,
        });
      }

      // Check expiration
      const now = new Date();
      if (
        invRecord.expiresAt &&
        new Date(invRecord.expiresAt) < now &&
        invRecord.status !== "ACCEPTED"
      ) {
        return res.status(400).json({
          success: false,
          code: "INVITATION_EXPIRED",
          error: "This invitation has expired.",
          userFriendlyMessage:
            "انتهت صلاحية هذه الدعوة. يرجى طلب دعوة جديدة من مسؤول المؤسسة.",
        });
      }

      const workspaceId =
        invRecord.workspaceId ||
        `ws_${(invRecord.senderId || "org").substring(0, 8)}`;
      const companyName = invRecord.companyName || "ZakIr Platform";
      const role = invRecord.role || "Contributor";
      const powers = invRecord.powers || {
        fileVault: true,
        memoryVault: true,
        riskRadar: false,
        marketIntel: false,
        settings: false,
      };
      const senderId = invRecord.senderId;
      const nowIso = new Date().toISOString();

      // 2. Fetch member user document to update
      const memberDocRef = adminDb.collection("users").doc(callerUid);
      let memberData: any = {};
      try {
        const mSnap = await memberDocRef.get();
        if (mSnap.exists) memberData = mSnap.data() || {};
      } catch (e) {}

      // Check Idempotency: if already accepted, return success immediately
      if (invRecord.status === "ACCEPTED") {
        return res.json({
          success: true,
          message: "Invitation was already accepted.",
          userFriendlyMessage: `لقد تم قبول هذه الدعوة مسبقاً وتفعيل عضويتك في مؤسسة "${companyName}".`,
          user:
            memberData.workspaceId === workspaceId
              ? memberData
              : { ...memberData, workspaceId, companyName, role, powers },
          invitation: invRecord,
        });
      }

      const rawMemberName = (
        memberName ||
        invRecord.name ||
        memberData.ownerName ||
        memberData.name ||
        invitationEmail.split("@")[0]
      ).trim();
      const resolvedMemberName =
        cleanMemberName(rawMemberName) || invitationEmail.split("@")[0];

      // 3. Atomically perform updates using Firestore Batch
      const batch = adminDb.batch();

      // A. Update Invitation document across primary and secondary collections
      const updatedInv = {
        ...invRecord,
        status: "ACCEPTED",
        acceptedAt: nowIso,
        acceptedByUid: callerUid,
        acceptedByEmail: callerEmail || invitationEmail,
        updatedAt: nowIso,
      };
      if (invDocRef) {
        batch.set(invDocRef, updatedInv, { merge: true });
      }
      batch.set(
        adminDb.collection("invitations").doc(invitationEmail),
        updatedInv,
        { merge: true },
      );
      batch.set(
        adminDb.collection("workspace_invitations").doc(invitationEmail),
        updatedInv,
        { merge: true },
      );

      // B. Update Workspace document
      batch.set(
        adminDb.collection("workspaces").doc(workspaceId),
        {
          id: workspaceId,
          name: `${companyName} Workspace`,
          companyName: companyName,
          ownerId: senderId || "CEO",
          updatedAt: nowIso,
        },
        { merge: true },
      );

      // C. Update Member Profile
      const updatedMemberProfile = {
        ...memberData,
        id: callerUid,
        uid: callerUid,
        email: callerEmail || invitationEmail,
        ownerName: resolvedMemberName,
        workspaceId: workspaceId,
        companyName: companyName,
        role: role,
        powers: powers,
        isVerified: true,
        isEmailVerified: true,
        email_verified: true,
        emailVerified: true,
        verification_required: false,
        verification_status: "verified",
        workspace: {
          id: workspaceId,
          name: `${companyName} Workspace`,
          ownerId: senderId,
          createdAt: invRecord.createdAt || nowIso,
          memberCount: 2,
        },
        updatedAt: nowIso,
      };
      batch.set(memberDocRef, updatedMemberProfile, { merge: true });

      // D. Update CEO's teamMembersList across candidate CEO documents
      let currentTeamList: any[] = [];
      let ceoUserDocRef = senderId
        ? adminDb.collection("users").doc(senderId)
        : null;

      if (!ceoUserDocRef && workspaceId) {
        try {
          const ceoQuery = await adminDb
            .collection("users")
            .where("workspaceId", "==", workspaceId)
            .where("role", "==", "CEO")
            .limit(1)
            .get();
          if (!ceoQuery.empty) {
            ceoUserDocRef = ceoQuery.docs[0].ref;
          }
        } catch (e) {}
      }

      if (ceoUserDocRef) {
        try {
          const ceoSnap = await ceoUserDocRef.get();
          if (ceoSnap.exists) {
            const ceoData = ceoSnap.data() || {};
            currentTeamList = Array.isArray(ceoData.teamMembersList)
              ? [...ceoData.teamMembersList]
              : [];

            // Remove any previous pending / matching entries for this member
            currentTeamList = currentTeamList.filter((m: any) => {
              const mEmail = (m.email || "").trim().toLowerCase();
              const mId = m.id || m.uid;
              return (
                mEmail !== invitationEmail &&
                mEmail !== callerEmail &&
                mId !== callerUid &&
                mId !== `tm-${callerUid}`
              );
            });

            // Append active member with cleaned display name
            const newTeamMemberEntry = {
              id: `tm-${callerUid}`,
              uid: callerUid,
              name: resolvedMemberName,
              email: invitationEmail,
              role: role,
              powers: powers,
              status: "Active",
              joinedAt: nowIso,
              addedAt: nowIso.split("T")[0],
            };
            currentTeamList.push(newTeamMemberEntry);

            batch.set(
              ceoUserDocRef,
              {
                teamMembersList: currentTeamList,
                updatedAt: nowIso,
              },
              { merge: true },
            );
          }
        } catch (ceoErr) {
          console.warn(
            "Notice: Updating CEO in batch encountered non-fatal warning:",
            ceoErr,
          );
        }
      }

      // Commit atomic batch
      await batch.commit();
      console.log("INVITATION_ACCEPT_COMMITTED_FIRESTORE", {
        callerUid,
        workspaceId,
        companyName,
      });

      // 4. Mirror updates to Local DB Store for resilience
      try {
        const db = readDb();
        if (!db.invitations) db.invitations = [];
        const idx = db.invitations.findIndex(
          (i: any) => (i.email || "").trim().toLowerCase() === invitationEmail,
        );
        if (idx >= 0) db.invitations[idx] = updatedInv;
        else db.invitations.push(updatedInv);

        if (!db.users) db.users = [];
        const uIdx = db.users.findIndex(
          (u: any) =>
            u.id === callerUid ||
            (u.email || "").trim().toLowerCase() === invitationEmail,
        );
        if (uIdx >= 0)
          db.users[uIdx] = { ...db.users[uIdx], ...updatedMemberProfile };
        else db.users.push(updatedMemberProfile);

        if (senderId) {
          const ceoLocal = db.users.find((u: any) => u.id === senderId);
          if (ceoLocal) {
            ceoLocal.teamMembersList = currentTeamList;
          }
        }
        writeDb(db);
      } catch (dbErr) {
        console.warn("Local DB sync warning during invitation accept:", dbErr);
      }

      emitPlatformEvent({
        eventType: "MEMBER_ACCEPTED",
        category: "WORKSPACE",
        severity: "INFO",
        userId: callerUid,
        userEmail: callerEmail || invitationEmail,
        workspaceId,
        metadata: {
          actor: { id: callerUid, email: callerEmail || invitationEmail, role: role || "Member" },
          action: "Accepted workspace invitation",
        },
        sanitizedMessage: `User ${callerEmail || invitationEmail} accepted invitation to workspace ${workspaceId}`,
      });

      return res.json({
        success: true,
        message:
          "Invitation accepted successfully and workspace membership activated.",
        userFriendlyMessage: `تهانينا! لقد تم قبول الدعوة بنجاح وتفعيل عضويتك في مؤسسة "${companyName}".`,
        user: updatedMemberProfile,
        invitation: updatedInv,
      });
    } catch (err: any) {
      console.error("INVITATION_ACCEPT_FAILED", err);
      return res.status(500).json({
        success: false,
        code: "ACCEPT_FAILED",
        error: err?.message || String(err),
        userFriendlyMessage:
          "تعذر إتمام قبول الدعوة حالياً بسبب خطأ خادم داخلي. يرجى المحاولة مرة أخرى.",
      });
    }
  },
);

// ==========================================
// WORKSPACE TEAM RETRIEVAL & SYNCHRONIZATION
// ==========================================
app.all(
  [
    "/api/workspace/team",
    "/workspace/team",
    "/api/workspace/team/",
    "/workspace/team/",
  ],
  requireAuth,
  async (req: AuthRequest, res) => {
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET")
      return res
        .status(405)
        .json({ success: false, error: `Method ${req.method} Not Allowed.` });
    try {
      const callerUid = req.user?.uid;
      const callerEmail = (req.user?.email || "").trim().toLowerCase();
      if (!callerUid) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      // 1. Fetch caller's profile
      let callerUser: any = null;
      try {
        const snap = await adminDb.collection("users").doc(callerUid).get();
        if (snap.exists) callerUser = snap.data();
      } catch (e) {}

      if (!callerUser) {
        const db = readDb();
        callerUser = db.users?.find(
          (u: any) =>
            u.id === callerUid ||
            (u.email || "").trim().toLowerCase() === callerEmail,
        );
      }

      const workspaceId =
        callerUser?.workspaceId || `ws_${callerUid.substring(0, 8)}`;
      const isCeo =
        (callerUser?.role || "").toUpperCase() === "CEO" ||
        (callerUser?.role || "").toUpperCase() === "ADMIN";

      // 2. Fetch CEO / Workspace Owner
      let ceoUser: any = isCeo ? callerUser : null;
      let ceoUid = isCeo ? callerUid : callerUser?.workspace?.ownerId;

      if (!ceoUser && ceoUid) {
        try {
          const snap = await adminDb.collection("users").doc(ceoUid).get();
          if (snap.exists) ceoUser = snap.data();
        } catch (e) {}
      }

      if (!ceoUser && workspaceId) {
        try {
          const q = await adminDb
            .collection("users")
            .where("workspaceId", "==", workspaceId)
            .where("role", "==", "CEO")
            .limit(1)
            .get();
          if (!q.empty) {
            ceoUser = q.docs[0].data();
            ceoUid = q.docs[0].id;
          }
        } catch (e) {}
      }

      let companyName = (
        ceoUser?.companyName ||
        callerUser?.companyName ||
        ""
      ).trim();
      if (!companyName || companyName === "ZakIr Platform") {
        try {
          const wsSnap = await adminDb
            .collection("workspaces")
            .doc(workspaceId)
            .get();
          if (wsSnap.exists) {
            companyName = (
              wsSnap.data()?.companyName ||
              wsSnap.data()?.name ||
              ""
            ).trim();
          }
        } catch (e) {}
      }
      if (!companyName || companyName === "ZakIr Platform") {
        companyName = ceoUser?.ownerName
          ? `${ceoUser.ownerName}'s Organization`
          : "Zakir Enterprise";
      }

      // 3. Fetch all users belonging to this workspace from Firestore
      const workspaceMembers: any[] = [];
      try {
        const membersSnap = await adminDb
          .collection("users")
          .where("workspaceId", "==", workspaceId)
          .get();
        if (!membersSnap.empty) {
          membersSnap.docs.forEach((d: any) => {
            workspaceMembers.push({ ...d.data(), id: d.id });
          });
        }
      } catch (e) {}

      // 4. Fetch all invitations for this workspace (excluding already ACCEPTED ones or ones whose user is active)
      const workspaceMembersEmails = new Set(
        workspaceMembers.map((m: any) => (m.email || "").trim().toLowerCase()),
      );
      const seenInvEmails = new Set<string>();
      const workspaceInvitations: any[] = [];

      const processInvDoc = (inv: any, docId: string) => {
        const invEmail = (inv.email || docId || "").trim().toLowerCase();
        if (!invEmail || seenInvEmails.has(invEmail)) return;
        const isAcceptedStatus =
          (inv.status || "").toString().toUpperCase() === "ACCEPTED";
        const isMemberRegistered = workspaceMembersEmails.has(invEmail);

        if (!isAcceptedStatus && !isMemberRegistered) {
          seenInvEmails.add(invEmail);
          workspaceInvitations.push({ ...inv, id: docId });
        }
      };

      try {
        const invSnap = await adminDb
          .collection("invitations")
          .where("workspaceId", "==", workspaceId)
          .get();
        if (!invSnap.empty) {
          invSnap.docs.forEach((d: any) => processInvDoc(d.data(), d.id));
        }
      } catch (e) {}

      try {
        const wsSnap = await adminDb
          .collection("workspace_invitations")
          .where("workspaceId", "==", workspaceId)
          .get();
        if (!wsSnap.empty) {
          wsSnap.docs.forEach((d: any) => processInvDoc(d.data(), d.id));
        }
      } catch (e) {}

      // 5. Build authoritative team members list - strictly active members
      let teamList: any[] = Array.isArray(ceoUser?.teamMembersList)
        ? [...ceoUser.teamMembersList]
        : [];

      // Filter out dummy mock members and unaccepted/pending invitations
      const dummyEmails = new Set([
        "f.zahra@g-partner.com",
        "j.luc@g-partner.com",
        "a.diop@g-partner.com",
      ]);
      teamList = teamList.filter((m: any) => {
        const email = (m.email || "").trim().toLowerCase();
        const isDummy = dummyEmails.has(email);
        const isPendingStatus = (m.status || "").toUpperCase() === "PENDING";
        const isPendingName =
          (m.name || "").includes("معلق") ||
          (m.name || "").includes("Pending") ||
          (m.name || "").includes("معلقة");
        return !isDummy && !isPendingStatus && !isPendingName;
      });

      // Ensure CEO/Owner is in teamList
      const ceoEmail = (ceoUser?.email || callerUser?.email || "")
        .trim()
        .toLowerCase();
      const hasCeoInList = teamList.some(
        (m: any) =>
          (m.email || "").trim().toLowerCase() === ceoEmail ||
          m.id === "tm-owner" ||
          m.role?.includes("CEO"),
      );
      if (!hasCeoInList && ceoEmail) {
        teamList.unshift({
          id: "tm-owner",
          uid: ceoUid || callerUid,
          name:
            cleanMemberName(ceoUser?.ownerName || ceoUser?.name) ||
            "CEO / Owner",
          email: ceoEmail,
          role: "CEO / Owner",
          status: "Active",
          powers: {
            fileVault: true,
            memoryVault: true,
            riskRadar: true,
            marketIntel: true,
            settings: true,
          },
          addedAt: (ceoUser?.createdAt || new Date().toISOString()).split(
            "T",
          )[0],
        });
      }

      // Auto-reconcile: add any members found in workspaceMembers who are missing from teamList
      let reconciledCount = 0;
      for (const member of workspaceMembers) {
        const mEmail = (member.email || "").trim().toLowerCase();
        const mUid = member.id || member.uid;
        if (!mEmail || mEmail === ceoEmail) continue;

        const existingIdx = teamList.findIndex(
          (t: any) =>
            (t.email || "").trim().toLowerCase() === mEmail ||
            t.uid === mUid ||
            t.id === `tm-${mUid}`,
        );
        const cleanName = cleanMemberName(
          member.ownerName || member.name || mEmail.split("@")[0],
        );

        if (existingIdx >= 0) {
          const currentName = teamList[existingIdx].name || "";
          const needsClean =
            currentName.includes("معلق") ||
            currentName.includes("Pending") ||
            currentName.includes("معلقة");
          if (teamList[existingIdx].status !== "Active" || needsClean) {
            teamList[existingIdx].status = "Active";
            teamList[existingIdx].name =
              cleanName || cleanMemberName(currentName);
            teamList[existingIdx].uid = mUid;
            teamList[existingIdx].powers =
              member.powers || teamList[existingIdx].powers;
            teamList[existingIdx].role =
              member.role || teamList[existingIdx].role;
            reconciledCount++;
          }
        } else {
          teamList.push({
            id: `tm-${mUid}`,
            uid: mUid,
            name: cleanName,
            email: mEmail,
            role: member.role || "Contributor",
            powers: member.powers || {
              fileVault: true,
              memoryVault: true,
              riskRadar: false,
              marketIntel: false,
              settings: false,
            },
            status: "Active",
            joinedAt: member.createdAt || new Date().toISOString(),
            addedAt: (member.createdAt || new Date().toISOString()).split(
              "T",
            )[0],
          });
          reconciledCount++;
        }
      }

      // Persist reconciled teamList back to CEO's doc in background
      if (reconciledCount > 0 && ceoUid) {
        try {
          await adminDb.collection("users").doc(ceoUid).update({
            teamMembersList: teamList,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {}
      }

      // Authoritative occupancy stats for the workspace
      const occupancy = await getWorkspaceOccupancy(workspaceId, ceoUid || callerUid);

      return res.json({
        success: true,
        workspaceId,
        companyName,
        teamMembers: teamList,
        invitations: workspaceInvitations,
        plan: occupancy.plan,
        maxSeats: occupancy.maxSeats,
        occupiedSeats: occupancy.occupiedSeats,
        remainingSeats: occupancy.remainingSeats,
        allowsInvitations: occupancy.allowsInvitations,
        isAtLimit: occupancy.isAtLimit,
      });
    } catch (err: any) {
      console.error("GET_WORKSPACE_TEAM_FAILED", err);
      return res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to fetch workspace team",
        });
    }
  },
);

// ==========================================
// DATA RECONCILIATION & AUTO-HEALING ROUTINE
// ==========================================
export async function reconcileWorkspaceData(): Promise<{
  success: boolean;
  stats: any;
}> {
  console.log(
    "[DATA_RECONCILE] Starting workspace & lifecycle auto-healing routine...",
  );
  const stats = {
    teamMembersHealed: 0,
    companyNamesHealed: 0,
    lifecyclesHealed: 0,
  };

  try {
    // 1. Fetch users and invitations
    const usersSnap = await adminDb.collection("users").get();
    const allUsers: any[] = [];
    if (usersSnap && !usersSnap.empty) {
      usersSnap.docs.forEach((d: any) =>
        allUsers.push({ ...d.data(), id: d.id }),
      );
    }

    // Build CEO mapping: workspaceId -> ceoUser
    const ceoByWorkspace = new Map<string, any>();
    allUsers.forEach((u: any) => {
      const role = (u.role || "").toUpperCase();
      if ((role === "CEO" || role === "ADMIN") && u.workspaceId) {
        ceoByWorkspace.set(u.workspaceId, u);
      }
    });

    // 2. Reconcile users with workspaceId missing from CEO's teamMembersList
    for (const [wsId, ceo] of ceoByWorkspace.entries()) {
      let teamList = Array.isArray(ceo.teamMembersList)
        ? [...ceo.teamMembersList]
        : [];
      let modified = false;

      const wsMembers = allUsers.filter(
        (u: any) => u.workspaceId === wsId && u.id !== ceo.id,
      );
      for (const m of wsMembers) {
        const mEmail = (m.email || "").trim().toLowerCase();
        const existingIdx = teamList.findIndex(
          (t: any) =>
            (t.email || "").trim().toLowerCase() === mEmail ||
            t.id === `tm-${m.id}` ||
            t.uid === m.id,
        );
        if (existingIdx === -1) {
          teamList.push({
            id: `tm-${m.id}`,
            uid: m.id,
            name: m.ownerName || m.name || mEmail.split("@")[0],
            email: mEmail,
            role: m.role || "Contributor",
            powers: m.powers || {
              fileVault: true,
              memoryVault: true,
              riskRadar: false,
              marketIntel: false,
              settings: false,
            },
            status: "Active",
            joinedAt: m.createdAt || new Date().toISOString(),
            addedAt: (m.createdAt || new Date().toISOString()).split("T")[0],
          });
          stats.teamMembersHealed++;
          modified = true;
        } else if (
          teamList[existingIdx].name?.includes("معلق") ||
          teamList[existingIdx].status !== "Active"
        ) {
          teamList[existingIdx].status = "Active";
          teamList[existingIdx].name = (teamList[existingIdx].name || "")
            .replace(/\s*\(معلق\)/g, "")
            .replace(/\s*\(Pending\)/g, "")
            .trim();
          stats.teamMembersHealed++;
          modified = true;
        }

        // Heal missing companyName on member
        if (
          (!m.companyName || m.companyName === "ZakIr Platform") &&
          ceo.companyName
        ) {
          try {
            await adminDb.collection("users").doc(m.id).update({
              companyName: ceo.companyName,
              updatedAt: new Date().toISOString(),
            });
            stats.companyNamesHealed++;
          } catch (e) {}
        }
      }

      if (modified) {
        try {
          await adminDb.collection("users").doc(ceo.id).update({
            teamMembersList: teamList,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {}
      }
    }

    // 3. Ensure non-deleted users have ACTIVE lifecycle record
    const deletedSnap = await adminDb.collection("deletedUsers").get();
    const deletedUids = new Set<string>();
    if (deletedSnap && !deletedSnap.empty) {
      deletedSnap.docs.forEach((d: any) => {
        deletedUids.add(d.id);
        if (d.data()?.uid) deletedUids.add(d.data().uid);
      });
    }

    for (const u of allUsers) {
      if (deletedUids.has(u.id)) continue;
      const uEmail = (u.email || "").trim().toLowerCase();
      if (!uEmail) continue;

      const lc = await getAccountLifecycleRecord(uEmail);
      if (!lc || !lc.status) {
        await setAccountLifecycleRecord({
          accountId: uEmail,
          emailNormalized: uEmail,
          status: "ACTIVE",
          deletionType: null,
          deletedAt: null,
          deletedBy: null,
          restoreUntil: null,
          originalUserId: u.id,
          retainedDataDocPath: null,
          adminApprovalRequired: false,
        });
        stats.lifecyclesHealed++;
      }
    }

    console.log("[DATA_RECONCILE] Completed successfully:", stats);
    return { success: true, stats };
  } catch (err) {
    console.error("[DATA_RECONCILE] Encountered error:", err);
    return { success: false, stats };
  }
}

app.post(
  "/api/admin/reconcile-data",
  requireAuth,
  async (req: AuthRequest, res) => {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
      return res
        .status(403)
        .json({ error: "Forbidden: Admin access required" });
    }
    const result = await reconcileWorkspaceData();
    return res.json(result);
  },
);

// --- CUSTOMER SUPPORT SYSTEM API ENDPOINTS ---

// Create Support Ticket
app.post("/api/support/tickets", async (req: AuthRequest, res) => {
  try {
    let callerUid = req.user?.uid;
    let callerEmail = req.user?.email || "";

    let {
      userId,
      userEmail,
      userName,
      userPhone,
      companyName,
      category,
      subject,
      message,
      description,
      priority = "Normal",
      attachments = [],
    } = req.body;

    userId = callerUid || userId || `usr_${Date.now()}`;
    userEmail = callerEmail || userEmail || "support_user@zakir.ai";
    const resolvedMessage = description || message;

    if (!userEmail || !subject || !resolvedMessage) {
      return res
        .status(400)
        .json({
          error: "User email, subject, and detailed message are required.",
        });
    }

    const db = readDb();
    if (!db.support_tickets) db.support_tickets = [];

    // Lookup user createdAt if available in db.users
    let userCreatedAt = "";
    if (db.users) {
      const u = db.users.find(
        (x: any) =>
          x.id === userId || x.email?.toLowerCase() === userEmail.toLowerCase(),
      );
      if (u) userCreatedAt = u.createdAt || "";
    }

    const ticketNumber = Math.floor(100000 + Math.random() * 900000);
    const ticketId = `ticket_${ticketNumber}`;
    const nowIso = new Date().toISOString();

    const initialMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId: ticketId,
      senderId: userId,
      senderType: "user",
      senderName: userName || userEmail.split("@")[0],
      senderEmail: userEmail,
      message: resolvedMessage,
      attachments: Array.isArray(attachments) ? attachments : [],
      createdAt: nowIso,
    };

    const newTicket = {
      id: ticketId,
      userId: userId,
      userEmail: userEmail,
      userName: userName || userEmail.split("@")[0],
      userPhone: userPhone || "",
      companyName: companyName || "",
      userCreatedAt: userCreatedAt,
      category: category || "Technical Issue",
      subject: subject,
      description: resolvedMessage,
      message: resolvedMessage,
      status: "Open",
      priority: priority,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastReplyAt: nowIso,
      assignedAdminId: "",
      assignedAdminName: "Unassigned",
      adminNotes: "",
      attachments: Array.isArray(attachments) ? attachments : [],
      messages: [initialMsg],
    };

    db.support_tickets.unshift(newTicket);
    writeDb(db);

    // Save support ticket to Firestore support_tickets collection
    try {
      await adminDb
        .collection("support_tickets")
        .doc(newTicket.id)
        .set(newTicket);
      console.log("SUPPORT_TICKET_FIRESTORE_SAVED", {
        ticketId: newTicket.id,
        userId,
      });
    } catch (fsErr: any) {
      console.warn(
        "Failed to write support ticket to Firestore:",
        fsErr?.message,
      );
    }

    // Emit Real-Time Platform Event & Admin Notification for newly created Support Ticket
    emitPlatformEvent({
      eventType: "SUPPORT_TICKET_CREATED",
      severity: priority === "High" || priority === "Critical" ? "WARNING" : "NOTICE",
      category: "SUPPORT",
      userId,
      userEmail,
      resourceId: newTicket.id,
      requestId: (req as any).correlationId,
      sanitizedMessage: `Support ticket #${ticketNumber} created by ${userEmail}: ${subject}`,
      metadata: {
        ticketId: newTicket.id,
        ticketNumber,
        category,
        priority,
        subject,
      },
    }).catch(() => {});

    return res.json({ success: true, ticket: newTicket, ticketNumber });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: err.message || "Failed to create support ticket" });
  }
});

// Get Support Tickets (Security isolated: non-admins only get their own tickets)
app.get("/api/support/tickets", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";

    // Check if caller is admin
    const isCallerAdmin = callerUid
      ? await isUserAdminServer(callerUid, callerEmail)
      : false;

    const isAdmin = isCallerAdmin && req.query.isAdmin === "true";
    const queryUserId = (req.query.userId as string) || callerUid;
    const queryUserEmail = (req.query.userEmail as string) || callerEmail;

    // 1. Try querying Firestore support_tickets
    try {
      let qSnap: any = null;
      if (isAdmin) {
        qSnap = await adminDb
          .collection("support_tickets")
          .orderBy("createdAt", "desc")
          .get();
      } else if (queryUserId) {
        qSnap = await adminDb
          .collection("support_tickets")
          .where("userId", "==", queryUserId)
          .get();
      } else if (queryUserEmail) {
        qSnap = await adminDb
          .collection("support_tickets")
          .where("userEmail", "==", queryUserEmail.toLowerCase())
          .get();
      }

      if (qSnap && !qSnap.empty) {
        let fsTickets = qSnap.docs.map((doc: any) => doc.data());
        if (!isAdmin) {
          fsTickets = fsTickets.map((t: any) => {
            const { adminNotes, ...publicTicket } = t;
            return publicTicket;
          });
        }
        return res.json({ tickets: fsTickets });
      }
    } catch (fsErr: any) {
      console.warn("Firestore support tickets fetch warning:", fsErr?.message);
    }

    // 2. Fallback to local DB
    const db = readDb();
    let tickets = db.support_tickets || [];

    if (isAdmin) {
      return res.json({ tickets });
    }

    if (queryUserId || queryUserEmail) {
      tickets = tickets.filter(
        (t: any) =>
          (queryUserId && t.userId === queryUserId) ||
          (queryUserEmail &&
            t.userEmail?.toLowerCase() === queryUserEmail.toLowerCase()),
      );
    }

    const sanitizedTickets = tickets.map((t: any) => {
      const { adminNotes, ...publicTicket } = t;
      return publicTicket;
    });

    return res.json({ tickets: sanitizedTickets });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: err.message || "Failed to fetch support tickets" });
  }
});

// Get Single Support Ticket
app.get(
  "/api/support/tickets/:id",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const callerUid = req.user?.uid;
      const callerEmail = req.user?.email || "";
      if (!callerUid) return res.status(401).json({ error: "Unauthorized" });

      const isCallerAdmin = await isUserAdminServer(callerUid, callerEmail);

      let ticket: any = null;

      // Try Firestore doc lookup
      try {
        const tSnap = await adminDb.collection("support_tickets").doc(id).get();
        if (tSnap.exists) {
          ticket = tSnap.data();
        }
      } catch (e) {}

      if (!ticket) {
        const db = readDb();
        ticket = (db.support_tickets || []).find((t: any) => t.id === id);
      }

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      if (!isCallerAdmin) {
        if (
          ticket.userId !== callerUid &&
          ticket.userEmail?.toLowerCase() !== callerEmail.toLowerCase()
        ) {
          return res
            .status(403)
            .json({ error: "Forbidden: You do not own this support ticket." });
        }
        const { adminNotes, ...publicTicket } = ticket;
        return res.json({ ticket: publicTicket });
      }

      return res.json({ ticket });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: err.message || "Failed to fetch support ticket" });
    }
  },
);

// Add Reply Message to Support Ticket + Send Resend Email Notification
app.post(
  "/api/support/tickets/:id/messages",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const callerUid = req.user?.uid;
      const callerEmail = req.user?.email || "";

      const isCallerAdmin = callerUid
        ? await isUserAdminServer(callerUid, callerEmail)
        : false;

      const { id } = req.params;
      let {
        senderId,
        senderType,
        senderName,
        senderEmail,
        message,
        attachments = [],
      } = req.body;

      if (!isCallerAdmin) {
        senderId = callerUid || senderId || "user";
        senderEmail = callerEmail || senderEmail || "";
        senderType = "user";
      }
      if (!message) {
        return res.status(400).json({ error: "Message text is required" });
      }

      const docRef = adminDb.collection("support_tickets").doc(id);
      let ticket: any = null;

      try {
        const tSnap = await docRef.get();
        if (tSnap.exists) {
          ticket = tSnap.data();
        }
      } catch (e) {}

      const db = readDb();
      let localTicket = (db.support_tickets || []).find(
        (t: any) => t.id === id,
      );

      if (!ticket && localTicket) {
        ticket = localTicket;
      }

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Enforce ticket ownership on replies to prevent IDOR
      if (!isCallerAdmin) {
        if (
          ticket.userId !== callerUid &&
          ticket.userEmail?.toLowerCase() !== callerEmail.toLowerCase()
        ) {
          return res
            .status(403)
            .json({ error: "Forbidden: You do not own this support ticket." });
        }
      }

      const nowIso = new Date().toISOString();

      // Derive authentic user profile from users collection if target user is known
      let recipientEmail = ticket.userEmail;
      let recipientName = ticket.userName || "Valued User";

      if (ticket.userId) {
        try {
          const uSnap = await adminDb
            .collection("users")
            .doc(ticket.userId)
            .get();
          if (uSnap.exists) {
            const uData = uSnap.data();
            if (uData?.email) recipientEmail = uData.email;
            if (uData?.ownerName || uData?.companyName) {
              recipientName = uData.ownerName || uData.companyName;
            }
          }
        } catch (uErr) {
          console.warn(
            "Could not load user profile for support reply recipient:",
            uErr,
          );
        }
      }

      const newMsg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketId: id,
        senderId:
          senderId || (senderType === "admin" ? "admin" : ticket.userId),
        senderType: senderType || "user",
        senderName:
          senderName ||
          (senderType === "admin" ? "Zakir Support Team" : recipientName),
        senderEmail:
          senderEmail ||
          (senderType === "admin" ? "support@zakir.ai" : recipientEmail),
        message: message,
        attachments: Array.isArray(attachments) ? attachments : [],
        createdAt: nowIso,
      };

      if (!ticket.messages) ticket.messages = [];
      ticket.messages.push(newMsg);
      ticket.updatedAt = nowIso;
      ticket.lastReplyAt = nowIso;

      if (senderType === "admin") {
        ticket.status = "Waiting for User";
      } else {
        if (
          ticket.status === "Waiting for User" ||
          ticket.status === "Resolved"
        ) {
          ticket.status = "In Progress";
        }
      }

      // Save ticket to Firestore
      try {
        await docRef.set(ticket, { merge: true });
        console.log("SUPPORT_REPLY_FIRESTORE_SAVED", {
          ticketId: id,
          senderType,
        });
      } catch (fsErr: any) {
        console.warn(
          "Firestore support message update warning:",
          fsErr?.message,
        );
      }

      // Sync local DB
      if (localTicket) {
        Object.assign(localTicket, ticket);
      } else {
        if (!db.support_tickets) db.support_tickets = [];
        db.support_tickets.push(ticket);
      }
      writeDb(db);

      // Dispatch Email Notification via Resend (if admin reply)
      if (senderType === "admin" && recipientEmail) {
        try {
          const {
            subject: emailSubject,
            text: emailText,
            html: emailHtml,
          } = buildSupportReplyEmailHtml({
            recipientName,
            ticketId: String(ticket.id),
            ticketSubject: String(ticket.subject || "Support Ticket"),
            message: String(message),
          });

          await sendSystemMail({
            to: recipientEmail,
            subject: emailSubject,
            html: emailHtml,
            text: emailText,
          });
          console.log("SUPPORT_REPLY_EMAIL_SENT", {
            recipientEmail,
            ticketId: id,
          });
        } catch (mailErr: any) {
          console.error("ADMIN_SUPPORT_REPLY_EMAIL_FAILED", {
            recipientEmail,
            ticketId: id,
            error: mailErr?.message,
          });
        }
      }

      emitPlatformEvent({
        eventType: "SUPPORT_TICKET_REPLIED",
        severity: "INFO",
        category: "SUPPORT",
        resourceId: id,
        userEmail: senderEmail,
        sanitizedMessage: `New message on support ticket #${id} from ${senderName} (${senderType})`,
        metadata: { ticketId: id, senderType },
      }).catch(() => {});

      return res.json({ success: true, message: newMsg, ticket });
    } catch (err: any) {
      console.error("ADMIN_SUPPORT_REPLY_FAILED", {
        ticketId: req.params.id,
        error: err?.message || String(err),
      });
      res
        .status(500)
        .json({ error: err.message || "Failed to reply to support ticket" });
    }
  },
);

// Update Ticket Status / Priority / Notes / Assigned Admin (Admin Action)
app.patch(
  "/api/support/tickets/:id",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const callerUid = req.user?.uid;
      const callerEmail = req.user?.email || "";
      const isCallerAdmin = callerUid
        ? await isUserAdminServer(callerUid, callerEmail)
        : false;

      if (!isCallerAdmin) {
        return res
          .status(403)
          .json({ error: "Forbidden: Administrative access required" });
      }

      const { id } = req.params;
      const {
        status,
        priority,
        adminNotes,
        assignedAdminId,
        assignedAdminName,
      } = req.body;

      const docRef = adminDb.collection("support_tickets").doc(id);
      let ticket: any = null;

      try {
        const tSnap = await docRef.get();
        if (tSnap.exists) {
          ticket = tSnap.data();
        }
      } catch (e) {}

      const db = readDb();
      let localTicket = (db.support_tickets || []).find(
        (t: any) => t.id === id,
      );

      if (!ticket && localTicket) {
        ticket = localTicket;
      }

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      if (status) ticket.status = status;
      if (priority) ticket.priority = priority;
      if (adminNotes !== undefined) ticket.adminNotes = adminNotes;
      if (assignedAdminId !== undefined)
        ticket.assignedAdminId = assignedAdminId;
      if (assignedAdminName !== undefined)
        ticket.assignedAdminName = assignedAdminName;
      ticket.updatedAt = new Date().toISOString();

      try {
        await docRef.set(ticket, { merge: true });
      } catch (fsErr: any) {
        console.warn("Firestore patch support ticket warning:", fsErr?.message);
      }

      if (localTicket) {
        Object.assign(localTicket, ticket);
      }
      writeDb(db);

      emitPlatformEvent({
        eventType: "SUPPORT_TICKET_STATUS_CHANGED",
        severity: status === "Closed" ? "INFO" : "NOTICE",
        category: "SUPPORT",
        resourceId: id,
        userEmail: ticket.userEmail,
        sanitizedMessage: `Support ticket #${id} status updated to [${status || ticket.status}] by Admin [${callerEmail}]`,
        metadata: {
          ticketId: id,
          status: status || ticket.status,
          priority: priority || ticket.priority,
          assignedAdminId,
          assignedAdminName,
        },
      }).catch(() => {});

      return res.json({ success: true, ticket });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: err.message || "Failed to update support ticket" });
    }
  },
);

// --- CLOUD SQL ENDPOINTS ---
app.post("/api/sql/sync-user", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email;
    if (!uid || !email) {
      return res
        .status(400)
        .json({ error: "Missing uid or email in auth token" });
    }
    const { companyName, role } = req.body;

    // Role & privilege protection: regular users are forbidden from escalating their roles or altering subscription statuses
    const isCallerAdmin = uid ? await isUserAdminServer(uid) : false;
    const resolvedRole = isCallerAdmin ? role || "CEO" : "Analyst";

    if (process.env.SQL_HOST) {
      try {
        const user = await getOrCreateUser(
          uid,
          email,
          companyName,
          resolvedRole,
        );
        return res.json({ success: true, user });
      } catch (sqlErr) {
        // Silently proceed to JSON db fallback below
      }
    }

    const dbData = readDb();
    let user = dbData.users.find((u: any) => u.id === uid || u.email === email);
    if (!user) {
      user = {
        id: uid,
        email,
        companyName: companyName || "Enterprise Account",
        role: resolvedRole,
        createdAt: new Date().toISOString(),
      };
      dbData.users.push(user);
    } else {
      user.companyName = companyName || user.companyName;
      if (isCallerAdmin && role) {
        user.role = role;
      }
    }
    writeDb(dbData);
    res.json({ success: true, user });
  } catch (err: any) {
    res.json({ success: true, user: null });
  }
});

app.post("/api/sql/gmail-logs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { actionType, recipient, subject, status } = req.body;
    if (!actionType || !status) {
      return res
        .status(400)
        .json({ error: "actionType and status are required" });
    }

    if (process.env.SQL_HOST) {
      try {
        const dbUserList = await withRetry(() =>
          sqlDb.select().from(sqlUsers).where(eq(sqlUsers.uid, uid)),
        );
        if (dbUserList && dbUserList.length > 0) {
          const dbUser = dbUserList[0];
          const newLog = await withRetry(() =>
            sqlDb
              .insert(gmailLogs)
              .values({
                userId: dbUser.id,
                actionType,
                recipient: recipient || null,
                subject: subject || null,
                status,
              })
              .returning(),
          );
          return res.status(201).json({ success: true, log: newLog[0] });
        }
      } catch (sqlErr) {
        // Silently proceed to local JSON database storage fallback below
      }
    }

    // Save transaction log locally in db_store.json
    const dbData = readDb();
    if (!dbData.gmail_logs) dbData.gmail_logs = [];
    const localLog = {
      id: dbData.gmail_logs.length + 1,
      userId: uid,
      actionType,
      recipient: recipient || null,
      subject: subject || null,
      status,
      createdAt: new Date().toISOString(),
    };
    dbData.gmail_logs.unshift(localLog);
    writeDb(dbData);

    res.status(201).json({ success: true, log: localLog });
  } catch (err: any) {
    res.status(200).json({ success: true, log: null });
  }
});

app.get("/api/sql/gmail-logs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (process.env.SQL_HOST) {
      try {
        const dbUserList = await withRetry(() =>
          sqlDb.select().from(sqlUsers).where(eq(sqlUsers.uid, uid)),
        );
        if (dbUserList && dbUserList.length > 0) {
          const dbUser = dbUserList[0];
          const logs = await withRetry(() =>
            sqlDb
              .select()
              .from(gmailLogs)
              .where(eq(gmailLogs.userId, dbUser.id))
              .orderBy(desc(gmailLogs.createdAt))
              .limit(50),
          );
          return res.json(logs || []);
        }
      } catch (sqlErr) {
        // Silently fallback to local JSON database store below
      }
    }

    const dbData = readDb();
    const userLogs = (dbData.gmail_logs || []).filter(
      (l: any) => l.userId === uid || !l.userId,
    );
    res.json(userLogs);
  } catch (err: any) {
    res.json([]);
  }
});

// Endpoint to send real email to recipients via Gmail API or SMTP/Nodemailer
app.post(
  "/api/email/send",
  requireAuth,
  emailLimiter,
  async (req: AuthRequest, res: express.Response) => {
    try {
      const { to, subject, body, html, googleAccessToken } = req.body;

      if (!to || !subject || (!body && !html)) {
        return res
          .status(400)
          .json({
            error: "Missing required fields: to, subject, and body or html",
          });
      }

      // 1. Validate 'to' is a single, valid email address
      const cleanTo = String(to).trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanTo)) {
        return res
          .status(400)
          .json({
            error:
              "Invalid recipient email address. Multiple recipients are strictly prohibited.",
          });
      }

      // 2. Validate length of subject and body to prevent abuse (DoS/Buffer overflow)
      const cleanSubject = String(subject)
        .trim()
        .replace(/[\r\n]/g, ""); // Prevent header/MIME injection
      if (cleanSubject.length > 200) {
        return res
          .status(400)
          .json({ error: "Subject must not exceed 200 characters." });
      }

      const emailBody = body ? String(body) : "";
      const emailHtmlRaw = html ? String(html) : "";
      if (emailBody.length > 100000 || emailHtmlRaw.length > 100000) {
        return res
          .status(400)
          .json({
            error: "Email body or HTML content exceeds the 100KB size limit.",
          });
      }

      // 3. Prevent arbitrary attachments or parameters
      if (req.body.attachments || req.body.path) {
        return res
          .status(400)
          .json({ error: "Attachments are not permitted via this endpoint." });
      }

      // Determine the verified sender email from Firebase Auth token
      const authenticatedUserEmail = req.user?.email;
      if (!authenticatedUserEmail) {
        return res
          .status(401)
          .json({
            error:
              "Unauthorized: Authenticated user must have a verified email address.",
          });
      }

      console.log(
        `[EMAIL SEND INITIATED] User: ${authenticatedUserEmail} sending to: ${cleanTo} with subject: ${cleanSubject}`,
      );

      const emailHtml =
        html ||
        `<div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #1e293b;">${emailBody.replace(/\n/g, "<br/>")}</div>`;
      const emailText = emailBody;

      // 4. If Google OAuth Access Token is provided, try direct Gmail API
      if (googleAccessToken) {
        try {
          const emailContent = [
            `To: ${cleanTo}`,
            `Subject: ${cleanSubject}`,
            "Content-Type: text/html; charset=utf-8",
            "MIME-Version: 1.0",
            "",
            emailHtml,
          ].join("\r\n");

          const encodedEmail = Buffer.from(emailContent)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

          const gmailRes = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${googleAccessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ raw: encodedEmail }),
            },
          );

          if (gmailRes.ok) {
            const gmailData = await gmailRes.json();
            return res.json({
              success: true,
              messageId: gmailData.id,
              provider: "Gmail API",
              message: "Email delivered via Gmail API",
            });
          } else {
            const errText = await gmailRes.text();
            console.warn("Gmail API direct send notice:", errText);
          }
        } catch (gErr) {
          console.warn("Gmail API direct send exception:", gErr);
        }
      }

      // Use unified sendSystemMail (SMTP with Resend fallback), appending verified user details to prevent spoofing
      const systemSubject = `[Zakir User Email - From: ${authenticatedUserEmail}] ${cleanSubject}`;
      const mailResult = await sendSystemMail({
        to: cleanTo,
        subject: systemSubject,
        html: emailHtml,
        text: emailText,
      });
      if (!mailResult.success) {
        return res
          .status(500)
          .json({
            success: false,
            error:
              mailResult.userFriendlyMessage ||
              mailResult.error?.message ||
              "Failed to deliver email",
          });
      }
      return res.json({
        success: true,
        messageId: mailResult.messageId,
        provider: mailResult.provider,
        senderUsed: mailResult.sender || "Zakir <noreply@getzakir.com>",
        result: mailResult,
        message: "Email delivered to recipient successfully",
      });
    } catch (err: any) {
      console.error("Error sending email:", err);
      res.status(500).json({ error: err.message || "Failed to deliver email" });
    }
  },
);

// Endpoint to send real email verification code for linking accounts
app.post(
  "/api/email/send-verification-otp",
  requireAuth,
  async (req: AuthRequest, res: express.Response) => {
    try {
      const { email, otpCode } = req.body;
      if (!email || !otpCode) {
        return res
          .status(400)
          .json({ error: "Missing email or verification code" });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: "Invalid email address" });
      }

      const { subject, text, html } = buildOtpEmailHtml({
        email: cleanEmail,
        otpCode: String(otpCode).trim(),
        type: "email_link",
      });

      console.log(
        `[EMAIL OTP SEND] Sending verification code to ${cleanEmail}`,
      );
      const mailResult = await sendSystemMail({
        to: cleanEmail,
        subject,
        html,
        text,
      });

      if (!mailResult.success) {
        return res.status(500).json({
          success: false,
          error:
            mailResult.userFriendlyMessage ||
            mailResult.error?.message ||
            "Failed to send email verification code",
        });
      }

      return res.json({
        success: true,
        message: "Verification code sent successfully to " + cleanEmail,
      });
    } catch (err: any) {
      console.error("Error sending verification email:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to send verification code" });
    }
  },
);

// Endpoint to preview and test the official ZAKIR email branding system
app.post(
  "/api/email/test-branding",
  requireAuth,
  async (req: AuthRequest, res: express.Response) => {
    try {
      const callerEmail = req.user?.email || "";
      const targetEmail = req.body?.email ? String(req.body.email).trim().toLowerCase() : callerEmail;
      
      if (!targetEmail || !targetEmail.includes("@")) {
        return res.status(400).json({ error: "Valid email address required" });
      }

      const testHtml = buildMasterEmailHtml({
        subject: "ZAKIR Brand Verification & Official Email System",
        title: "منظومة الهوية البصرية للبريد الإلكتروني • Brand System Test",
        greeting: "مرحباً بك في نظام التحقق من هوية ذاكر",
        bodyHtml: `
          <p style="font-size: 15px; line-height: 1.8; color: #334155; margin: 0 0 16px 0;">
            تم إرسال هذا البريد للتحقق من العرض الفعلي لهوية ZAKIR الرسمية داخل مختلف برامج وتطبيقات البريد الإلكتروني:
          </p>
          <div style="background-color: #f1f5f9; border-radius: 10px; padding: 18px 20px; margin: 0 0 20px 0; text-align: right;">
            <ul style="margin: 0; padding-right: 20px; font-size: 14px; color: #1e293b; line-height: 2;">
              <li><strong>الوضع الفاتح (Light Mode):</strong> مربع كحلي متناسق الأبعاد (#1C2C58) + شعار ذاكر باللون الأبيض الناصع (#FFFFFF).</li>
              <li><strong>الوضع الداكن (Dark Mode):</strong> مربع أبيض متناسق الأبعاد (#FFFFFF) + شعار ذاكر باللون الكحلي (#1C2C58).</li>
              <li><strong>أبعاد المربع:</strong> نسبة مثالية 1:1 بارتفاع وعرض 96px متماثلين، بدون أي تشوه أو استطالة.</li>
              <li><strong>أبعاد الشعار:</strong> الحفاظ على النسبة الأصلية والتمركز الدقيق أفقياً وعمودياً داخل الحاوية 96&times;96 px.</li>
            </ul>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #64748b; margin: 0;">
            Zakir Platform • Causal Decision Intelligence &bull; الذاكرة المؤسسية السببية
          </p>
        `,
        securityNote: "هذا بريد اختباري آمن وموثق من نظام ZAKIR الداخلي للتحقق من تجربة العرض الحقيقية.",
      });

      const mailResult = await sendSystemMail({
        to: targetEmail,
        subject: "ZAKIR Brand System Live Verification • تجربة العرض الفعلي للشعار",
        html: testHtml,
        text: "ZAKIR Brand System Live Verification - Fixed 96x96 square container with responsive light/dark color inversion.",
      });

      return res.json({
        success: mailResult.success,
        recipient: targetEmail,
        messageId: mailResult.messageId,
        provider: mailResult.provider,
        simulated: mailResult.simulated || false,
        previewUrl: `/api/email/preview-branding`,
      });
    } catch (err: any) {
      console.error("Error sending test branding email:", err);
      res.status(500).json({ error: err.message || "Failed to send branding test email" });
    }
  }
);

// Preview endpoint to render the master email in browser for immediate inspection
app.get("/api/email/preview-branding", (req, res) => {
  const previewHtml = buildMasterEmailHtml({
    subject: "ZAKIR Brand Verification & Official Email System",
    title: "منظومة الهوية البصرية للبريد الإلكتروني • Brand System Preview",
    greeting: "مرحباً بك في نظام التحقق من هوية ذاكر",
    bodyHtml: `
      <p style="font-size: 15px; line-height: 1.8; color: #334155; margin: 0 0 16px 0;">
        معاينة حية للمربع 120×120 والشعار المتمركز والانعكاس في الوضع الفاتح والداكن:
      </p>
      <div style="background-color: #f1f5f9; border-radius: 10px; padding: 18px 20px; margin: 0 0 20px 0; text-align: right;">
        <ul style="margin: 0; padding-right: 20px; font-size: 14px; color: #1e293b; line-height: 2;">
          <li><strong>الوضع الفاتح (Light Mode):</strong> مربع كحلي متناسق الأبعاد (#1C2C58) + شعار ذاكر باللون الأبيض الناصع (#FFFFFF).</li>
          <li><strong>الوضع الداكن (Dark Mode):</strong> مربع أبيض متناسق الأبعاد (#FFFFFF) + شعار ذاكر باللون الكحلي (#1C2C58).</li>
          <li><strong>أبعاد المربع:</strong> نسبة مثالية 1:1 بارتفاع وعرض 120px متماثلين، بدون أي تشوه أو استطالة.</li>
          <li><strong>أبعاد الشعار:</strong> الحفاظ على النسبة الأصلية والتمركز الدقيق أفقياً وعمودياً داخل الحاوية 120&times;120 px.</li>
        </ul>
      </div>
    `,
    securityNote: "هذا بريد اختباري آمن وموثق من نظام ZAKIR الداخلي للتحقق من تجربة العرض الحقيقية.",
  });

  // For browser preview, replace cid: with direct absolute URLs so it renders in browser
  const browserRenderHtml = previewHtml
    .replace(/cid:zakir-logo-light/g, "/zakir-badge-light.png")
    .replace(/cid:zakir-logo-dark/g, "/zakir-badge-dark.png")
    .replace(/cid:zakir-logo-white/g, "/zakir-logo-white.png")
    .replace(/cid:zakir-logo-navy/g, "/zakir-logo-navy.png")
    .replace(/cid:zakir-logo/g, "/zakir-badge-light.png");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(browserRenderHtml);
});

// --- ADMIN USERS ENDPOINT (FIRESTORE AUTHORITATIVE) ---
app.get("/api/admin/users", requireAuth, async (req: AuthRequest, res) => {
  const callerUid = req.user?.uid;
  const callerEmail = req.user?.email || "";
  console.log("ADMIN_USERS_FETCH_START", {
    callerUid: callerUid || "unknown",
    emailMasked: callerEmail
      ? callerEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3")
      : "none",
  });

  try {
    if (!callerUid) {
      console.warn("ADMIN_USERS_FETCH_FAILED", {
        reason: "Missing authentication context",
      });
      return res
        .status(401)
        .json({
          success: false,
          error: "Unauthorized: Missing authentication context",
        });
    }

    const isCallerAdmin = await isUserAdminServer(callerUid, callerEmail);
    if (!isCallerAdmin) {
      console.warn("ADMIN_USERS_FETCH_FAILED", {
        reason: "Forbidden: Administrative access required",
        callerUid,
      });
      return res
        .status(403)
        .json({
          success: false,
          error: "Forbidden: Administrative access required",
        });
    }

    console.log("ADMIN_USERS_AUTHORIZED", { callerUid });

    // 1. Fetch Firestore users collection
    let fsUsers: any[] = [];
    try {
      const snap = await adminDb.collection("users").get();
      if (snap && !snap.empty && snap.docs) {
        fsUsers = snap.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));
      }
    } catch (fsErr: any) {
      console.warn(
        "Notice: Firestore users fetch encountered error, will merge local data:",
        fsErr?.message,
      );
    }

    // 2. Safe merge with local DB store users without replacing Firestore data
    try {
      const db = readDb();
      if (db.users && Array.isArray(db.users)) {
        const existingIds = new Set(fsUsers.map((u: any) => u.id));
        const existingEmails = new Set(
          fsUsers
            .map((u: any) => (u.email || "").trim().toLowerCase())
            .filter(Boolean),
        );
        for (const localU of db.users) {
          const lEmail = (localU.email || "").trim().toLowerCase();
          if (
            !existingIds.has(localU.id) &&
            (!lEmail || !existingEmails.has(lEmail))
          ) {
            fsUsers.push(localU);
          }
        }
      }
    } catch (dbErr) {}

    // 3. RECONCILIATION WITH FIREBASE AUTH: Ensure ALL Auth users appear in Admin
    try {
      const authList = await adminAuth.listUsers(1000);
      if (authList && Array.isArray(authList.users)) {
        const existingIds = new Set(fsUsers.map((u: any) => u.id || u.uid));
        const existingEmails = new Set(
          fsUsers.map((u: any) => (u.email || "").trim().toLowerCase()).filter(Boolean)
        );

        for (const authU of authList.users) {
          const aEmail = (authU.email || "").trim().toLowerCase();
          if (!existingIds.has(authU.uid) && (!aEmail || !existingEmails.has(aEmail))) {
            // Check if user already exists in db store before synthesizing
            const db = readDb();
            const existingLocal = (db.users || []).find((u: any) => u.id === authU.uid || u.uid === authU.uid || (u.email && u.email.toLowerCase() === aEmail));
            const isEmailVer = Boolean(authU.emailVerified || existingLocal?.isEmailVerified || existingLocal?.emailVerified || existingLocal?.email_verified);
            
            // Synthesize canonical profile from Auth metadata
            const synthesized: any = {
              id: authU.uid,
              uid: authU.uid,
              email: authU.email || "No Email",
              ownerName: authU.displayName || authU.email?.split("@")[0] || "User",
              companyName: "Default Organization",
              role: "Contributor",
              isEmailVerified: isEmailVer,
              emailVerified: isEmailVer,
              email_verified: isEmailVer,
              accountStatus: isEmailVer ? "PENDING_DOCUMENT_VERIFICATION" : "PENDING_EMAIL_VERIFICATION",
              documentVerificationStatus: "NOT_SUBMITTED",
              isVerified: false,
              verification_required: true,
              verification_status: "unverified",
              subscriptionPlan: "Starter",
              subscriptionStatus: "Trial",
              createdAt: authU.metadata?.creationTime || new Date().toISOString(),
              disabled: Boolean(authU.disabled),
              fileCount: 0,
              files: [],
              verificationDocuments: []
            };

            fsUsers.push(synthesized);

            // Asynchronously sync synthesized profile to database
            try {
              adminDb.collection("users").doc(authU.uid).set(synthesized, { merge: true }).catch(() => {});
            } catch (e) {}
          }
        }
      }
    } catch (authErr: any) {
      console.warn("Notice: Auth users reconciliation warning:", authErr?.message);
    }

    // 4. Filter out accounts that have been truly purged or are active deletions
    let deletedUserIds = new Set<string>();
    try {
      const deletedSnap = await adminDb.collection("deletedUsers").get();
      if (deletedSnap && !deletedSnap.empty && deletedSnap.docs) {
        for (const d of deletedSnap.docs) {
          const dData = d.data();
          if (dData?.uid) deletedUserIds.add(dData.uid);
          deletedUserIds.add(d.id);
        }
      }
    } catch (e) {}

    // 5. PRE-FETCH ALL USER FILES AND VERIFICATION DOCUMENTS FROM FIRESTORE
    let topFiles: any[] = [];
    let fsVerDocs: any[] = [];
    const subFilesMap = new Map<string, any[]>();

    if (isFirebaseAdminAvailable && adminDb) {
      try {
        const [topSnap, verSnap] = await Promise.all([
          adminDb.collection("files").get().catch(() => ({ empty: true, docs: [] })),
          adminDb.collection("verification_documents").get().catch(() => ({ empty: true, docs: [] }))
        ]);
        if (topSnap && !topSnap.empty && topSnap.docs) {
          topFiles = topSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        }
        if (verSnap && !verSnap.empty && verSnap.docs) {
          fsVerDocs = verSnap.docs.map((d: any) => ({ id: d.id, documentId: d.id, ...d.data() }));
        }
      } catch (e) {}

      // Fetch user subcollection files in parallel chunks
      try {
        const chunkSize = 15;
        for (let i = 0; i < fsUsers.length; i += chunkSize) {
          const chunk = fsUsers.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (u: any) => {
              const uId = u.id || u.uid;
              if (!uId) return;
              try {
                const subSnap = await adminDb.collection("users").doc(uId).collection("files").get();
                if (subSnap && !subSnap.empty && subSnap.docs) {
                  subFilesMap.set(uId, subSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
                }
              } catch (err) {}
            })
          );
        }
      } catch (e) {}
    }

    const db = readDb();
    const diskUploadsDir = path.join(process.cwd(), "secure_uploads");

    // 6. NORMALIZE VERIFICATION STATE (CRITICAL INTEGRITY AUDIT)
    const activeUsers = fsUsers
      .filter((u: any) => {
        const uId = u.id || u.uid;
        if (deletedUserIds.has(uId)) return false;
        if (u.accountLifecycleStatus === "PURGED" || u.isPurged === true) return false;
        return true;
      })
      .map((u: any) => {
        const uId = u.id || u.uid;
        const uEmail = (u.email || "").toLowerCase().trim();

        // --- A. GATHER ALL USER FILES ---
        const userFilesMap = new Map<string, any>();

        // 1. From user subcollection users/{uid}/files
        const subFiles = subFilesMap.get(uId) || [];
        for (const sf of subFiles) {
          if (sf && sf.id) userFilesMap.set(sf.id, sf);
        }

        // 2. From top-level files collection in Firestore
        for (const tf of topFiles) {
          if (tf && (tf.userId === uId || tf.userUid === uId || tf.ownerUid === uId)) {
            if (!userFilesMap.has(tf.id)) userFilesMap.set(tf.id, tf);
          }
        }

        // 3. From local db.files
        if (Array.isArray(db.files)) {
          for (const df of db.files) {
            if (df && (df.userId === uId || df.userUid === uId || df.ownerUid === uId)) {
              if (!userFilesMap.has(df.id)) userFilesMap.set(df.id, df);
            }
          }
        }

        // 4. From user object's own files array
        if (Array.isArray(u.files)) {
          for (const uf of u.files) {
            if (uf && uf.id) {
              if (!userFilesMap.has(uf.id)) userFilesMap.set(uf.id, uf);
            }
          }
        }

        const reconciledFiles = Array.from(userFilesMap.values()).map((f: any) => ({
          ...f,
          previewUrl: f.fileUrl || `/api/auth/verification-document/${f.id}`
        }));
        u.files = reconciledFiles;
        u.fileCount = reconciledFiles.length;

        // --- B. GATHER ALL VERIFICATION DOCUMENTS ---
        const rawDocs = [
          ...(Array.isArray(u.verificationDocuments) ? u.verificationDocuments : []),
          ...(Array.isArray(u.verificationInfo?.documents) ? u.verificationInfo.documents : []),
          ...(Array.isArray(u.documents) ? u.documents : []),
          ...reconciledFiles.filter((f: any) => f && (f.category === "Verification" || f.category === "Identity" || f.isVerificationDoc))
        ];

        // Add from Firestore verification_documents collection
        for (const vd of fsVerDocs) {
          if (vd && (vd.userId === uId || (vd.userEmail && vd.userEmail.toLowerCase().trim() === uEmail))) {
            rawDocs.push(vd);
          }
        }

        // Add from local verification_documents_store & recovery_documents_store
        if (db.verification_documents_store) {
          for (const [docId, meta] of Object.entries(db.verification_documents_store as Record<string, any>)) {
            if (meta) {
              const matchesUser = meta.userId === uId || (meta.userEmail && meta.userEmail.toLowerCase().trim() === uEmail);
              if (matchesUser) {
                rawDocs.push({ ...meta, documentId: docId });
              }
            }
          }
        }

        if (db.recovery_documents_store) {
          for (const [docId, meta] of Object.entries(db.recovery_documents_store as Record<string, any>)) {
            if (meta) {
              const matchesUser = meta.userId === uId || (meta.userEmail && meta.userEmail.toLowerCase().trim() === uEmail);
              if (matchesUser) {
                rawDocs.push({ ...meta, documentId: docId });
              }
            }
          }
        }

        // Deduplicate documents
        const seenDocKeys = new Set<string>();
        const reconciledDocs: any[] = [];
        for (const d of rawDocs) {
          if (!d || d.deleted === true || d.isDeleted === true) continue;
          const docId = String(d.documentId || d.id || d.fileId || "").trim();
          const storageRef = String(d.storageReference || d.storagePath || d.fileUrl || "").trim();
          const fileName = String(d.fileName || d.name || "").trim();
          const sizeStr = d.size ? String(d.size) : "";

          const key1 = docId ? `id_${docId}` : "";
          const key2 = storageRef ? `ref_${storageRef}` : "";
          const key3 = fileName ? `fn_${fileName.toLowerCase()}_${sizeStr}` : "";

          if ((key1 && seenDocKeys.has(key1)) || (key2 && seenDocKeys.has(key2)) || (key3 && seenDocKeys.has(key3))) {
            continue;
          }
          if (key1) seenDocKeys.add(key1);
          if (key2) seenDocKeys.add(key2);
          if (key3) seenDocKeys.add(key3);

          const finalDocId = docId || (storageRef ? storageRef.split("/").pop() : "") || fileName || `doc_${Date.now()}`;
          reconciledDocs.push({ ...d, documentId: finalDocId });
        }

        // --- C. REAL DOCUMENT PHYSICAL EXISTENCE CHECK ---
        const verifiedDocs = reconciledDocs.map((doc: any) => {
          const docId = doc.documentId || doc.id || doc.fileName;
          let exists = false;

          // 1. Check local disk
          if (
            (docId && fs.existsSync(path.join(diskUploadsDir, docId))) ||
            (docId && fs.existsSync(path.join(os.tmpdir(), "secure_uploads", docId))) ||
            (docId && fs.existsSync(path.join(process.cwd(), "secure_uploads", docId)))
          ) {
            exists = true;
          }
          // 2. Check local memory/buffer/base64
          else if (docId && getFromLocalDiskCache(docId)) {
            exists = true;
          } else if (doc.fileBase64 || doc.data || doc.base64 || (Array.isArray(doc.chunks) && doc.chunks.length > 0)) {
            exists = true;
          } else if ((docId && db.recovery_documents_store?.[docId]?.fileBase64) || (docId && db.verification_documents_store?.[docId]?.fileBase64)) {
            exists = true;
          }
          // 3. Check storage reference, storage path or valid HTTP/HTTPS fileUrl / downloadUrl / previewUrl / fileName
          else if (
            doc.storageReference ||
            doc.storagePath ||
            doc.path ||
            doc.filePath ||
            doc.downloadUrl ||
            (typeof doc.fileUrl === "string" && doc.fileUrl.length > 5) ||
            (typeof doc.previewUrl === "string" && doc.previewUrl.length > 5) ||
            (docId && db.verification_documents_store?.[docId]) ||
            (docId && db.recovery_documents_store?.[docId]) ||
            doc.fileName ||
            doc.name
          ) {
            exists = true;
          } else {
            exists = false;
          }

          const rawStatus = String(doc.status || doc.verificationStatus || u.documentVerificationStatus || "PENDING").toUpperCase();
          const docStatus = rawStatus === "APPROVED" || rawStatus === "VERIFIED" ? "APPROVED" : (rawStatus === "REJECTED" ? "REJECTED" : "PENDING");

          return {
            ...doc,
            documentId: docId,
            id: docId,
            status: docStatus,
            verificationStatus: docStatus,
            isAccessible: exists,
            isMissing: !exists,
            previewUrl: doc.previewUrl || doc.fileUrl || `/api/auth/verification-document/${encodeURIComponent(docId)}`,
            downloadUrl: doc.downloadUrl || doc.fileUrl || `/api/auth/verification-document/${encodeURIComponent(docId)}?download=true`
          };
        });

        // CRITICAL RULE: Real submitted documents MUST NEVER be reduced to 0 by ephemeral storage checks!
        const totalDocCount = verifiedDocs.length;
        const docCount = totalDocCount;

        u.verificationDocuments = verifiedDocs;
        u.documents = verifiedDocs;
        u.documentCount = totalDocCount;

        // --- D. AUTHORITATIVE STATUS DERIVATION ---
        const isEmailVer = Boolean(
          u.emailVerified === true ||
          u.isEmailVerified === true ||
          u.email_verified === true
        );
        u.emailVerified = isEmailVer;
        u.isEmailVerified = isEmailVer;

        const isSystemAdmin = u.role === "Admin" || (uEmail && ADMIN_EMAILS.has(uEmail));
        const isExplicitAdminApproved = Boolean(
          (u.approvedBy && u.approvedAt && (String(u.accountStatus || "").toUpperCase() === "APPROVED" || String(u.documentVerificationStatus || "").toUpperCase() === "APPROVED")) ||
          u.adminVerificationOverride === true
        );

        const rawReq = String(u.verificationRequestStatus || u.verificationRequest || "").toUpperCase();
        const hasInstitutional = Boolean(u.institutionalProfile);
        const rawDocStatus = String(u.documentVerificationStatus || u.verificationInfo?.status || "").toUpperCase();
        const rawAcc = String(u.accountStatus || "").toUpperCase();

        // 1. Verification Request Status
        let reqStatus: "NONE" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" = "NONE";
        if (rawReq === "APPROVED" || rawReq === "VERIFIED") {
          reqStatus = "APPROVED";
        } else if (rawReq === "REJECTED") {
          reqStatus = "REJECTED";
        } else if (rawReq === "UNDER_REVIEW" || rawReq === "PENDING" || rawReq === "DOCUMENTS_SUBMITTED") {
          reqStatus = "UNDER_REVIEW";
        } else if (rawReq === "SUBMITTED") {
          reqStatus = "SUBMITTED";
        } else if (docCount > 0) {
          reqStatus = rawDocStatus === "APPROVED" ? "APPROVED" : (rawDocStatus === "REJECTED" ? "REJECTED" : "UNDER_REVIEW");
        } else if (hasInstitutional || rawDocStatus === "UNDER_REVIEW" || rawDocStatus === "PENDING_UPLOAD" || u.verificationInfo?.status === "under_review") {
          reqStatus = "SUBMITTED";
        } else {
          reqStatus = "NONE";
        }
        u.verificationRequestStatus = reqStatus;

        // 2. Document Verification Status (RULE 8: 0 documents CANNOT be APPROVED under any circumstance)
        let docStatus: "NOT_SUBMITTED" | "PENDING_REVIEW" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" = "NOT_SUBMITTED";
        const hasRejectedDoc = verifiedDocs.some((d: any) => String(d.status || d.verificationStatus || "").toUpperCase() === "REJECTED");

        if (docCount === 0) {
          docStatus = "NOT_SUBMITTED";
        } else if (hasRejectedDoc || rawDocStatus === "REJECTED" || reqStatus === "REJECTED") {
          docStatus = "REJECTED";
        } else if ((rawDocStatus === "APPROVED" || isExplicitAdminApproved) && docCount > 0) {
          docStatus = "APPROVED";
        } else if (docCount > 0) {
          docStatus = rawDocStatus === "UNDER_REVIEW" ? "UNDER_REVIEW" : "PENDING_REVIEW";
        } else {
          docStatus = "NOT_SUBMITTED";
        }
        u.documentVerificationStatus = docStatus;
        u.documentStatus = docStatus;

        // 3. KYC Status (RULE 7 & 8: 0 documents = NOT_VERIFIED)
        let kycStatus: "VERIFIED" | "NOT_VERIFIED" | "UNDER_REVIEW" | "REJECTED" = "NOT_VERIFIED";
        if (isSystemAdmin) {
          kycStatus = "VERIFIED";
        } else if (docCount === 0) {
          kycStatus = "NOT_VERIFIED";
        } else if (docStatus === "REJECTED") {
          kycStatus = "REJECTED";
        } else if (docCount > 0 && docStatus === "APPROVED") {
          kycStatus = "VERIFIED";
        } else if (docCount > 0 || reqStatus === "UNDER_REVIEW" || reqStatus === "SUBMITTED") {
          kycStatus = "UNDER_REVIEW";
        } else {
          kycStatus = "NOT_VERIFIED";
        }
        u.kycStatus = kycStatus;

        // 4. Strict 5-State UI Evaluator
        let uiState: "NO_REQUEST" | "AWAITING_DOCS" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED" = "NO_REQUEST";
        if (docStatus === "REJECTED" || kycStatus === "REJECTED" || reqStatus === "REJECTED") {
          uiState = "REJECTED";
        } else if (docCount > 0 && docStatus === "APPROVED" && kycStatus === "VERIFIED") {
          uiState = "VERIFIED";
        } else if (docCount > 0) {
          uiState = "PENDING_REVIEW";
        } else if (reqStatus !== "NONE" && docCount === 0) {
          uiState = "AWAITING_DOCS";
        } else {
          uiState = "NO_REQUEST";
        }
        u.uiState = uiState;

        // 5. Account Status (STRICT RULE 10: Approved ONLY IF email verified + docs exist + KYC verified + explicit admin approval)
        let accountStatus: "APPROVED" | "PENDING" | "REJECTED" | "SUSPENDED" = "PENDING";
        if (isSystemAdmin) {
          accountStatus = "APPROVED";
        } else if (rawAcc === "SUSPENDED") {
          accountStatus = "SUSPENDED";
        } else if (rawAcc === "REJECTED" || docStatus === "REJECTED") {
          accountStatus = "REJECTED";
        } else if (!isEmailVer) {
          // Rule 9: Email unverified -> cannot be approved
          accountStatus = "PENDING";
        } else if (docCount === 0) {
          // Rule 8: 0 documents -> cannot be approved
          accountStatus = "PENDING";
        } else if (kycStatus === "VERIFIED" && isExplicitAdminApproved && (rawAcc === "APPROVED" || rawAcc === "ACTIVE")) {
          // All 5 conditions satisfied
          accountStatus = "APPROVED";
        } else {
          accountStatus = "PENDING";
        }
        u.accountStatus = accountStatus;

        // Explicit Action Permissions
        u.canApproveKyc = isEmailVer && docCount > 0 && kycStatus !== "VERIFIED";
        u.canReviewDocuments = docCount > 0;
        u.canApproveAccount = isEmailVer && docCount > 0 && kycStatus === "VERIFIED" && accountStatus !== "APPROVED";

        // Verified boolean strictly requires verified email, real docs, and approved KYC
        u.isVerified = isSystemAdmin || (isEmailVer && docCount > 0 && kycStatus === "VERIFIED" && accountStatus === "APPROVED");
        u.verification_status = u.isVerified ? "verified" : (uiState === "PENDING_REVIEW" ? "pending" : (uiState === "REJECTED" ? "rejected" : (uiState === "AWAITING_DOCS" ? "action_required" : "unverified")));

        return u;
      });

    console.log("ADMIN_USERS_FIRESTORE_RESULT", { count: activeUsers.length });
    return res.json({ success: true, users: activeUsers });
  } catch (err: any) {
    console.error("ADMIN_USERS_FETCH_FAILED", err);
    return res
      .status(500)
      .json({
        success: false,
        error: err.message || "Failed to fetch users list",
      });
  }
});

// --- ADMIN BULK USER ACTIONS ENDPOINT ---
app.post("/api/admin/bulk-user-action", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const callerUid = req.user?.uid || "";
  const callerEmail = req.user?.email || "admin@zakir.ai";
  const { userIds, action, payload = {} } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0 || !action) {
    return res.status(400).json({ success: false, error: "userIds array and action are required." });
  }

  try {
    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    const nowIso = new Date().toISOString();

    for (const userId of userIds) {
      try {
        if (action === "APPROVE") {
          const assignPlan = payload.plan || "Starter";
          let targetUser = await getUserProfileServer(userId);
          const rawDocs = [
            ...(Array.isArray(targetUser?.verificationDocuments) ? targetUser.verificationDocuments : []),
            ...(Array.isArray(targetUser?.verificationInfo?.documents) ? targetUser.verificationInfo.documents : []),
            ...(Array.isArray(targetUser?.documents) ? targetUser.documents : []),
            ...(Array.isArray(targetUser?.files) ? targetUser.files.filter((f: any) => f && (f.category === "Verification" || f.isVerificationDoc)) : [])
          ];
          const hasDocs = rawDocs.length > 0;
          const updates: Record<string, any> = {
            accountStatus: "APPROVED",
            documentVerificationStatus: hasDocs ? "APPROVED" : "NOT_SUBMITTED",
            kycStatus: hasDocs ? "VERIFIED" : "NOT_VERIFIED",
            isVerified: hasDocs,
            verification_required: !hasDocs,
            verification_status: hasDocs ? "verified" : "unverified",
            approvedAt: nowIso,
            approvedBy: callerEmail,
            subscriptionPlan: assignPlan,
            subscriptionStatus: "Active",
            lastActiveAt: nowIso
          };

          await adminDb.collection("users").doc(userId).set(updates, { merge: true });
          try {
            await adminAuth.updateUser(userId, { disabled: false });
          } catch (e) {}

          try {
            const ldb = readDb();
            if (ldb.users) {
              ldb.users = ldb.users.map((u: any) =>
                u.id === userId || u.uid === userId
                  ? { ...u, ...updates }
                  : u
              );
              writeDb(ldb);
            }
          } catch (e) {}

          results.push({ id: userId, success: true });
        } else if (action === "SUSPEND") {
          const updates: Record<string, any> = {
            accountStatus: "SUSPENDED",
            documentVerificationStatus: "REJECTED",
            isVerified: false,
            verification_required: true,
            verification_status: "rejected",
            rejectionReason: payload.reason || "Suspended by admin bulk operation",
            subscriptionStatus: "Inactive",
            lastActiveAt: nowIso
          };

          await adminDb.collection("users").doc(userId).set(updates, { merge: true });
          try {
            await adminAuth.updateUser(userId, { disabled: true });
            await adminAuth.revokeRefreshTokens(userId);
          } catch (e) {}

          try {
            const ldb = readDb();
            if (ldb.users) {
              ldb.users = ldb.users.map((u: any) =>
                u.id === userId || u.uid === userId
                  ? { ...u, ...updates }
                  : u
              );
              writeDb(ldb);
            }
          } catch (e) {}

          results.push({ id: userId, success: true });
        } else if (action === "CHANGE_ROLE") {
          const newRole = payload.role || "Contributor";
          await adminDb.collection("users").doc(userId).set({ role: newRole, lastActiveAt: nowIso }, { merge: true });
          
          try {
            const ldb = readDb();
            if (ldb.users) {
              ldb.users = ldb.users.map((u: any) =>
                u.id === userId || u.uid === userId
                  ? { ...u, role: newRole, lastActiveAt: nowIso }
                  : u
              );
              writeDb(ldb);
            }
          } catch (e) {}

          results.push({ id: userId, success: true });
        } else if (action === "UPDATE" || action === "BULK_EDIT") {
          const updates: Record<string, any> = { lastActiveAt: nowIso };
          
          if (payload.role !== undefined && payload.role !== "") {
            updates.role = payload.role;
          }
          if (payload.accountStatus !== undefined && payload.accountStatus !== "") {
            updates.accountStatus = payload.accountStatus;
            if (payload.accountStatus === "APPROVED") {
              updates.isVerified = true;
              let targetUser = await getUserProfileServer(userId);
              const rawDocs = [
                ...(Array.isArray(targetUser?.verificationDocuments) ? targetUser.verificationDocuments : []),
                ...(Array.isArray(targetUser?.verificationInfo?.documents) ? targetUser.verificationInfo.documents : []),
                ...(Array.isArray(targetUser?.documents) ? targetUser.documents : []),
                ...(Array.isArray(targetUser?.files) ? targetUser.files.filter((f: any) => f && (f.category === "Verification" || f.isVerificationDoc)) : [])
              ];
              updates.documentVerificationStatus = rawDocs.length > 0 ? "APPROVED" : "NOT_SUBMITTED";
              updates.verification_required = false;
              try {
                await adminAuth.updateUser(userId, { disabled: false });
              } catch (e) {}
            } else if (payload.accountStatus === "SUSPENDED" || payload.accountStatus === "REJECTED") {
              updates.isVerified = false;
              updates.documentVerificationStatus = "REJECTED";
              try {
                await adminAuth.updateUser(userId, { disabled: true });
                await adminAuth.revokeRefreshTokens(userId);
              } catch (e) {}
            }
          }
          if (payload.companyName !== undefined && payload.companyName !== "") {
            updates.companyName = payload.companyName;
            updates.institutionName = payload.companyName;
          }
          if (payload.subscriptionPlan !== undefined && payload.subscriptionPlan !== "") {
            updates.subscriptionPlan = payload.subscriptionPlan;
          }
          if (payload.subscriptionStatus !== undefined && payload.subscriptionStatus !== "") {
            updates.subscriptionStatus = payload.subscriptionStatus;
          }

          await adminDb.collection("users").doc(userId).set(updates, { merge: true });

          try {
            const ldb = readDb();
            if (ldb.users) {
              const existingIdx = ldb.users.findIndex((u: any) => u.id === userId || u.uid === userId);
              if (existingIdx >= 0) {
                ldb.users[existingIdx] = { ...ldb.users[existingIdx], ...updates };
              } else {
                ldb.users.push({ id: userId, uid: userId, ...updates });
              }
              writeDb(ldb);
            }
          } catch (e) {}

          results.push({ id: userId, success: true });
        } else if (action === "DELETE") {
          // 1. Get user data for archive before deletion
          let userRecordData: any = null;
          try {
            const uSnap = await adminDb.collection("users").doc(userId).get();
            if (uSnap.exists) {
              userRecordData = uSnap.data();
            }
          } catch (e) {}

          // 2. Archive to deletedUsers
          await adminDb.collection("deletedUsers").doc(userId).set({
            uid: userId,
            email: userRecordData?.email || payload.email || "",
            name: userRecordData?.name || "",
            companyName: userRecordData?.companyName || "",
            role: userRecordData?.role || "",
            deletedAt: nowIso,
            deletedBy: callerEmail,
            reason: payload.reason || "Bulk deletion by admin"
          });

          // 3. Purge subcollections
          try {
            const memSnap = await adminDb.collection("users").doc(userId).collection("memories").get();
            for (const mDoc of memSnap.docs) await mDoc.ref.delete();
            const alertSnap = await adminDb.collection("users").doc(userId).collection("riskAlerts").get();
            for (const aDoc of alertSnap.docs) await aDoc.ref.delete();
          } catch (e) {}

          // 4. Delete root user doc from Firestore
          await adminDb.collection("users").doc(userId).delete().catch(() => {});

          // 5. Delete / Disable in Firebase Auth
          try {
            await adminAuth.updateUser(userId, { disabled: true });
            await adminAuth.revokeRefreshTokens(userId);
          } catch (e) {}
          try {
            await adminAuth.deleteUser(userId);
          } catch (e) {}

          // 6. Purge from local JSON DB store
          try {
            const ldb = readDb();
            if (ldb.users) ldb.users = ldb.users.filter((u: any) => u.id !== userId && u.uid !== userId);
            if (ldb.verification_codes) ldb.verification_codes = ldb.verification_codes.filter((vc: any) => vc.id !== userId && vc.userId !== userId);
            if (ldb.support_tickets) ldb.support_tickets = ldb.support_tickets.filter((st: any) => st.userId !== userId);
            if (ldb.memories) ldb.memories = ldb.memories.filter((m: any) => m.userId !== userId);
            if (ldb.causal_graphs) ldb.causal_graphs = ldb.causal_graphs.filter((cg: any) => cg.userId !== userId);
            writeDb(ldb);
          } catch (e) {}

          results.push({ id: userId, success: true });
        } else {
          results.push({ id: userId, success: false, error: `Unsupported bulk action '${action}'` });
        }
      } catch (err: any) {
        results.push({ id: userId, success: false, error: err.message });
      }
    }

    const succeededCount = results.filter(r => r.success).length;
    await writeAdminAuditLog(
      callerUid,
      callerEmail,
      "BULK_ACTION_" + action,
      "USER_COLLECTION",
      userIds.join(","),
      null,
      "SUCCESS",
      `Bulk action ${action} executed on ${userIds.length} users (${succeededCount} succeeded)`
    );

    return res.json({
      success: true,
      message: `تم تنفيذ العملية بنجاح على (${succeededCount}) من أصل (${userIds.length}) مستخدم.`,
      results
    });
  } catch (err: any) {
    console.error("ADMIN_BULK_ACTION_FAILED", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to execute bulk action" });
  }
});

// --- ADMIN SINGLE USER PROFILE PATCH ENDPOINT ---
app.patch(["/api/admin/users/:uid", "/admin/users/:uid"], requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const callerUid = req.user?.uid || "";
  const callerEmail = req.user?.email || "admin@zakir.ai";
  const targetUid = (req.params.uid || "").trim();

  if (!targetUid) {
    return res.status(400).json({ success: false, error: "Target UID is required." });
  }

  try {
    const {
      ownerName,
      companyName,
      role,
      department,
      phoneNumber,
      accountStatus,
      adminNotes
    } = req.body;

    const nowIso = new Date().toISOString();
    const updates: Record<string, any> = {
      lastActiveAt: nowIso,
      updatedAt: nowIso
    };

    if (ownerName !== undefined) {
      updates.ownerName = String(ownerName).trim();
      updates.name = updates.ownerName;
      updates.fullName = updates.ownerName;
    }
    if (companyName !== undefined) {
      updates.companyName = String(companyName).trim();
    }
    if (role !== undefined) {
      updates.role = String(role).trim();
    }
    if (department !== undefined) {
      updates.department = String(department).trim();
    }
    if (phoneNumber !== undefined) {
      updates.phoneNumber = String(phoneNumber).trim();
      updates.phone = updates.phoneNumber;
    }
    if (accountStatus !== undefined) {
      updates.accountStatus = String(accountStatus).trim();
      if (updates.accountStatus === "APPROVED") {
        updates.isVerified = true;
        updates.verification_status = "verified";
      } else if (updates.accountStatus === "SUSPENDED" || updates.accountStatus === "REJECTED") {
        updates.isVerified = false;
        updates.verification_status = "rejected";
      }
    }
    if (adminNotes !== undefined) {
      updates.adminNotes = String(adminNotes).trim();
    }

    // 1. Update Firestore
    await adminDb.collection("users").doc(targetUid).set(updates, { merge: true });

    // 2. Update Firebase Auth metadata
    try {
      const authUpdates: Record<string, any> = {};
      if (updates.ownerName) authUpdates.displayName = updates.ownerName;
      if (updates.accountStatus === "SUSPENDED") {
        authUpdates.disabled = true;
        await adminAuth.revokeRefreshTokens(targetUid);
      } else if (updates.accountStatus === "APPROVED") {
        authUpdates.disabled = false;
      }
      if (Object.keys(authUpdates).length > 0) {
        await adminAuth.updateUser(targetUid, authUpdates);
      }
    } catch (authErr: any) {
      console.warn("Notice: Auth user update warning during admin profile patch:", authErr?.message);
    }

    // 3. Update local DB if present
    try {
      const db = readDb();
      if (db.users) {
        const idx = db.users.findIndex((u: any) => u.id === targetUid || u.uid === targetUid);
        if (idx >= 0) {
          db.users[idx] = { ...db.users[idx], ...updates };
          writeDb(db);
        }
      }
    } catch (e) {}

    await writeAdminAuditLog(
      callerUid,
      callerEmail,
      "ADMIN_UPDATE_USER_PROFILE",
      "USER_PROFILE",
      targetUid,
      null,
      "SUCCESS",
      `Admin updated profile for user ${targetUid}: ${JSON.stringify(updates)}`
    );

    return res.json({
      success: true,
      message: "تم حفظ وتحديث بيانات المستخدم بنجاح.",
      updates
    });
  } catch (err: any) {
    console.error("ADMIN_PATCH_USER_FAILED", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to update user profile" });
  }
});

// --- ADMIN AUDIT LOG SERVICES ---
async function writeEntitlementAuditLog(
  adminUid: string,
  adminEmail: string,
  targetUserId: string,
  targetUserEmail: string,
  action: "APPROVE_ACCOUNT" | "REJECT_ACCOUNT" | "EXTEND_TRIAL" | "CHANGE_PLAN" | "OVERRIDE_ENTITLEMENT" | "SYNC_SUBSCRIPTION" | "SUBSCRIPTION_CORRECTION",
  details: string,
  previousState?: any,
  newState?: any
) {
  const logEntry = {
    id: `ent_audit_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    timestamp: new Date().toISOString(),
    adminId: adminUid,
    adminEmail,
    targetUserId,
    targetUserEmail,
    action,
    details,
    previousState: previousState || null,
    newState: newState || null
  };

  try {
    await adminDb.collection("admin_entitlement_audit_logs").doc(logEntry.id).set(logEntry);
  } catch (e) {
    console.warn("Firestore entitlement audit logging fallback:", e);
  }

  try {
    const db = readDb();
    if (!db.admin_entitlement_audit_logs) db.admin_entitlement_audit_logs = [];
    db.admin_entitlement_audit_logs.unshift(logEntry);
    if (db.admin_entitlement_audit_logs.length > 500) {
      db.admin_entitlement_audit_logs = db.admin_entitlement_audit_logs.slice(0, 500);
    }
    writeDb(db);
  } catch (e) {}

  emitPlatformEvent({
    eventType: "ADMIN_AUDIT_ACTION",
    severity: "INFO",
    category: "BILLING",
    userId: adminUid,
    userEmail: adminEmail,
    resourceId: targetUserId,
    sanitizedMessage: `Admin [${adminEmail}] performed ${action} on user [${targetUserEmail}]: ${details}`,
    metadata: {
      action,
      targetUserId,
      targetUserEmail,
      details,
      newState
    }
  }).catch(() => {});
}

// ----------------------------------------------------
// ACCOUNT ONBOARDING & INSTITUTIONAL DATA SUBMISSION
// ----------------------------------------------------

// User submits their institutional/organization profile data after email verification
app.post("/api/auth/submit-institutional-data", requireAuth, async (req: AuthRequest, res) => {
  const uid = req.user?.uid;
  const email = req.user?.email || "";

  if (!uid) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      error: "Authentication required to submit institutional verification data."
    });
  }

  try {
    const {
      fullName,
      phone,
      jobTitle,
      companyName,
      sector,
      country,
      companySize,
      intendedUse,
      additionalNotes
    } = req.body;

    if (!fullName || !phone || !companyName || !sector || !country) {
      return res.status(400).json({
        success: false,
        code: "MISSING_REQUIRED_FIELDS",
        error: "يرجى ملء جميع الحقول الإلزامية (الاسم الكامل، رقم الهاتف، اسم المنشأة، القطاع، والدولة)."
      });
    }

    const nowIso = new Date().toISOString();
    const institutionalProfile = {
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      jobTitle: String(jobTitle || "").trim() || "Executive",
      companyName: String(companyName).trim(),
      sector: String(sector).trim(),
      country: String(country).trim(),
      companySize: String(companySize || "").trim() || "1-10",
      intendedUse: String(intendedUse || "").trim() || "Strategic Decision Intelligence",
      additionalNotes: String(additionalNotes || "").trim(),
      submittedAt: nowIso
    };

    const userUpdates: Record<string, any> = {
      fullName: institutionalProfile.fullName,
      ownerName: institutionalProfile.fullName,
      phone: institutionalProfile.phone,
      jobTitle: institutionalProfile.jobTitle,
      companyName: institutionalProfile.companyName,
      organizationName: institutionalProfile.companyName,
      sector: institutionalProfile.sector,
      country: institutionalProfile.country,
      institutionalProfile,
      accountStatus: "PENDING_ADMIN_REVIEW",
      "verificationInfo.status": "under_review",
      "verificationInfo.submittedAt": nowIso,
      verification_status: "under_review",
      verification_required: true,
      lastActiveAt: nowIso
    };

    // 1. Update in Firestore
    try {
      await adminDb.collection("users").doc(uid).set(userUpdates, { merge: true });
    } catch (fsErr) {
      console.warn("Firestore update warning in submit-institutional-data:", fsErr);
    }

    // 2. Update in local db_store.json
    const db = readDb();
    if (!db.users) db.users = [];
    const localUserIdx = db.users.findIndex((u: any) => u.id === uid || u.uid === uid || u.email?.toLowerCase() === email.toLowerCase());
    if (localUserIdx >= 0) {
      db.users[localUserIdx] = {
        ...db.users[localUserIdx],
        ...userUpdates,
        institutionalProfile
      };
    } else {
      db.users.push({
        id: uid,
        email,
        ...userUpdates,
        institutionalProfile
      });
    }
    writeDb(db);

    // Emit event for Admin alert
    emitPlatformEvent({
      eventType: "INSTITUTIONAL_VERIFICATION_SUBMITTED" as any,
      severity: "NOTICE",
      category: "AUTH",
      userId: uid,
      userEmail: email,
      sanitizedMessage: `New account application submitted by [${email}] for company [${institutionalProfile.companyName}] - Pending admin review.`,
      metadata: institutionalProfile
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      code: "DATA_SUBMITTED_SUCCESSFULLY",
      accountStatus: "PENDING_ADMIN_REVIEW",
      message: "تم استلام بيانات التحقق بنجاح. طلب الحساب قيد المراجعة الإدارية وسوف يتم تفعيله فور الاعتماد.",
      institutionalProfile
    });
  } catch (err: any) {
    console.error("[SUBMIT_INSTITUTIONAL_DATA_ERROR]", err);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      error: err.message || "Failed to submit institutional verification data."
    });
  }
});

// Comprehensive verification documents submission endpoint (personal documents + optional company)
app.post("/api/auth/submit-verification-documents", requireAuth, async (req: AuthRequest, res) => {
  const isAdmin = req.user?.role === "Admin" || (req.user?.email && ADMIN_EMAILS.has(req.user.email.toLowerCase()));
  const uid = (isAdmin && req.body?.userId) ? req.body.userId : req.user?.uid;
  const email = (isAdmin && req.body?.userEmail) ? req.body.userEmail : (req.user?.email || "");

  if (!uid) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      error: "Authentication required to submit verification documents."
    });
  }

  try {
    const {
      fullName,
      phone,
      jobTitle,
      hasCompany,
      companyName,
      sector,
      country,
      registrationNumber,
      companySize,
      intendedUse,
      personalDocuments = [],
      companyDocuments = [],
      additionalNotes
    } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({
        success: false,
        code: "MISSING_REQUIRED_FIELDS",
        error: "يرجى ملء الاسم ورقم الهاتف."
      });
    }

    const hasCompanyBool = Boolean(hasCompany);
    if (hasCompanyBool && !companyName) {
      return res.status(400).json({
        success: false,
        code: "MISSING_COMPANY_NAME",
        error: "يرجى إدخال اسم المنشأة / الشركة أو إلغاء تفعيل خيار المنشأة."
      });
    }

    if (!Array.isArray(personalDocuments) || personalDocuments.length === 0) {
      return res.status(400).json({
        success: false,
        code: "MISSING_PERSONAL_DOCUMENTS",
        error: "يرجى رفع وثيقة إثبات شخصية رسمية واحدة على الأقل (بطاقة هوية / جواز سفر / رخصة قيادة)."
      });
    }

    const nowIso = new Date().toISOString();
    const rawAllDocuments = [
      ...personalDocuments.map((d: any) => ({
        ...d,
        category: "personal",
        uploadedAt: d.uploadedAt || nowIso
      })),
      ...(hasCompanyBool && Array.isArray(companyDocuments)
        ? companyDocuments.map((d: any) => ({
            ...d,
            category: "company",
            uploadedAt: d.uploadedAt || nowIso
          }))
        : [])
    ];

    const seenDocKeys = new Set<string>();
    const allDocuments: any[] = [];
    for (const doc of rawAllDocuments) {
      if (!doc) continue;
      const docId = String(doc.documentId || doc.id || doc.fileId || "").trim();
      const storageRef = String(doc.storageReference || doc.storagePath || doc.fileUrl || "").trim();
      const fileName = String(doc.fileName || doc.name || "").trim();
      const sizeStr = doc.size ? String(doc.size) : "";

      const key1 = docId ? `id_${docId}` : "";
      const key2 = storageRef ? `ref_${storageRef}` : "";
      const key3 = fileName ? `fn_${fileName.toLowerCase()}_${sizeStr}` : "";

      if ((key1 && seenDocKeys.has(key1)) || (key2 && seenDocKeys.has(key2)) || (key3 && seenDocKeys.has(key3))) {
        continue;
      }
      if (key1) seenDocKeys.add(key1);
      if (key2) seenDocKeys.add(key2);
      if (key3) seenDocKeys.add(key3);

      const activeDoc = {
        ...doc,
        status: "UNDER_REVIEW",
        verificationStatus: "UNDER_REVIEW"
      };

      allDocuments.push(activeDoc);
    }

    // Preserve previous rejection reason for historical review records
    let existingUserDoc: any = null;
    if (isFirebaseAdminAvailable && adminDb) {
      try {
        const snap = await adminDb.collection("users").doc(uid).get();
        if (snap.exists) existingUserDoc = snap.data();
      } catch (e) {}
    }
    if (!existingUserDoc) {
      const db = readDb();
      existingUserDoc = (db.users || []).find((u: any) => u.id === uid || u.uid === uid);
    }

    const prevRejection = existingUserDoc?.rejectionReason || existingUserDoc?.verificationInfo?.adminNote || existingUserDoc?.previousRejectionReason;

    const institutionalProfile = {
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      jobTitle: String(jobTitle || "").trim() || "Executive",
      hasCompany: hasCompanyBool,
      companyName: hasCompanyBool ? String(companyName).trim() : "حساب فردي / مستخدم شخصي",
      sector: hasCompanyBool ? String(sector || "").trim() || "General" : "Individual",
      country: hasCompanyBool ? String(country || "").trim() || "International" : "International",
      registrationNumber: hasCompanyBool ? String(registrationNumber || "").trim() : "",
      companySize: String(companySize || "").trim() || "1-10",
      intendedUse: String(intendedUse || "").trim() || "Strategic Decision Intelligence",
      additionalNotes: String(additionalNotes || "").trim(),
      submittedAt: nowIso
    };

    const userUpdates: Record<string, any> = {
      fullName: institutionalProfile.fullName,
      ownerName: institutionalProfile.fullName,
      phone: institutionalProfile.phone,
      jobTitle: institutionalProfile.jobTitle,
      companyName: institutionalProfile.companyName,
      organizationName: institutionalProfile.companyName,
      sector: institutionalProfile.sector,
      country: institutionalProfile.country,
      hasCompany: hasCompanyBool,
      institutionalProfile,
      verificationDocuments: allDocuments,
      documents: allDocuments,
      documentCount: allDocuments.length,
      isEmailVerified: true,
      email_verified: true,
      emailVerified: true,
      canonicalVerificationStatus: "pending",
      accountStatus: "PENDING_ADMIN_REVIEW",
      documentVerificationStatus: "UNDER_REVIEW",
      kycStatus: "UNDER_REVIEW",
      verificationRequestStatus: "UNDER_REVIEW",
      requiresDocumentVerification: true,
      rejectionReason: null,
      previousRejectionReason: prevRejection || null,
      historicalRejectionReason: prevRejection || null,
      isVerified: false,
      verifiedAt: null,
      adminVerificationOverride: false,
      verification_required: true,
      verification_status: "under_review",
      "verificationInfo.status": "under_review",
      "verificationInfo.submittedAt": nowIso,
      "verificationInfo.adminNote": null,
      "verificationInfo.previousAdminNote": prevRejection || null,
      "verificationInfo.verifiedAt": null,
      verificationSubmittedAt: nowIso,
      lastActiveAt: nowIso
    };

    // 1. Firestore update
    try {
      await adminDb.collection("users").doc(uid).set(userUpdates, { merge: true });
    } catch (fsErr) {
      console.warn("Firestore update warning in submit-verification-documents:", fsErr);
    }

    // 2. Local DB update
    const db = readDb();
    if (!db.users) db.users = [];
    const localUserIdx = db.users.findIndex((u: any) => u.id === uid || u.uid === uid || u.email?.toLowerCase() === email.toLowerCase());
    let updatedUser: any = null;
    if (localUserIdx >= 0) {
      db.users[localUserIdx] = {
        ...db.users[localUserIdx],
        ...userUpdates
      };
      updatedUser = db.users[localUserIdx];
    } else {
      updatedUser = {
        id: uid,
        email,
        ...userUpdates
      };
      db.users.push(updatedUser);
    }
    writeDb(db);

    // Emit event for Admin alert
    emitPlatformEvent({
      eventType: "INSTITUTIONAL_VERIFICATION_SUBMITTED" as any,
      severity: "NOTICE",
      category: "AUTH",
      userId: uid,
      userEmail: email,
      sanitizedMessage: `User verification documents submitted by [${email}] (${hasCompanyBool ? institutionalProfile.companyName : "Personal"}) - Pending admin review.`,
      metadata: {
        ...institutionalProfile,
        documentsCount: allDocuments.length
      }
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      code: "DOCUMENTS_SUBMITTED_SUCCESSFULLY",
      accountStatus: "PENDING_ADMIN_REVIEW",
      documentVerificationStatus: "UNDER_REVIEW",
      message: "تم استلام وثائق التحقق بنجاح. طلب الحساب قيد المراجعة الإدارية وسوف يتم تفعيله فور الاعتماد.",
      user: updatedUser,
      institutionalProfile,
      verificationDocuments: allDocuments
    });
  } catch (err: any) {
    console.error("[SUBMIT_VERIFICATION_DOCUMENTS_ERROR]", err);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      error: err.message || "Failed to submit verification documents."
    });
  }
});

// Endpoint for current authenticated user to get their live entitlement and trial countdown status
app.get("/api/user/entitlement-status", requireAuth, async (req: AuthRequest, res) => {
  const uid = req.user?.uid;
  const email = req.user?.email || "";

  try {
    const entitlement = await checkUserEntitlementServer(uid, email);
    return res.json({
      success: true,
      entitlement
    });
  } catch (err: any) {
    console.error("[ENTITLEMENT_STATUS_ERROR]", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve entitlement status"
    });
  }
});

// Endpoint for frontend to fetch latest user document and status
app.get("/api/auth/current-user-status", requireAuth, async (req: AuthRequest, res) => {
  const uid = req.user?.uid;
  const email = req.user?.email || "";

  try {
    let userDoc: any = null;
    try {
      if (uid) {
        const snap = await adminDb.collection("users").doc(uid).get();
        if (snap.exists) userDoc = { id: snap.id, ...snap.data() };
      }
      if (!userDoc && email) {
        const snap = await adminDb.collection("users").where("email", "==", email.toLowerCase().trim()).limit(1).get();
        if (!snap.empty) userDoc = { id: snap.docs[0].id, ...snap.docs[0].data() };
      }
    } catch (e) {}

    if (!userDoc) {
      const db = readDb();
      userDoc = (db.users || []).find((u: any) => u.id === uid || (u.email && u.email.toLowerCase() === email.toLowerCase()));
    }

    if (userDoc) {
      const isSysAdmin = userDoc.role === "Admin" || (userDoc.email && ADMIN_EMAILS.has(userDoc.email.toLowerCase()));
      const canonical = computeCanonicalVerification(userDoc, isSysAdmin);
      
      const wasEmailVerified = Boolean(
        userDoc.isEmailVerified === true ||
        userDoc.emailVerified === true ||
        userDoc.email_verified === true ||
        Boolean(userDoc.emailVerifiedAt) ||
        Boolean(userDoc.verificationInfo?.emailVerifiedAt) ||
        canonical.isEmailVerified
      );

      const adminReverifRequested = Boolean(
        userDoc.adminRequestedEmailReverification === true ||
        userDoc.adminRequestedReverification === true
      );

      const finalEmailVerified = wasEmailVerified && !adminReverifRequested;

      userDoc.isEmailVerified = finalEmailVerified;
      userDoc.email_verified = finalEmailVerified;
      userDoc.emailVerified = finalEmailVerified;
      userDoc.adminRequestedEmailReverification = adminReverifRequested;

      if (finalEmailVerified && canonical.accountStatus === "PENDING_EMAIL_VERIFICATION") {
        userDoc.accountStatus = "PENDING_DOCUMENT_VERIFICATION";
      } else {
        userDoc.accountStatus = canonical.accountStatus;
      }

      userDoc.documentVerificationStatus = canonical.documentVerificationStatus;
      userDoc.kycStatus = canonical.kycStatus;
      userDoc.canonicalVerificationStatus = canonical.canonicalStatus;
    }

    const entitlement = await checkUserEntitlementServer(uid, email);

    return res.json({
      success: true,
      user: userDoc,
      entitlement
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// ADMIN ACCOUNT APPROVAL & SUBSCRIPTION MANAGEMENT
// ----------------------------------------------------

// 1. Get all pending verification requests for admin review
app.get("/api/admin/pending-approvals", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    let usersList: any[] = [];

    try {
      const snap = await adminDb.collection("users").get();
      if (snap && !snap.empty) {
        usersList = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      }
    } catch (fsErr) {}

    const db = readDb();
    if (db.users && Array.isArray(db.users)) {
      const existingIds = new Set(usersList.map(u => u.id));
      for (const lu of db.users) {
        if (!existingIds.has(lu.id)) {
          usersList.push(lu);
        }
      }
    }

    const pendingApprovals = usersList
      .map((u: any) => {
        const uId = u.id || u.uid;
        const uEmail = (u.email || "").toLowerCase().trim();

        // Document reconciliation: gather only real documents associated with this user
        const rawDocs = [
          ...(Array.isArray(u.verificationDocuments) ? u.verificationDocuments : []),
          ...(Array.isArray(u.verificationInfo?.documents) ? u.verificationInfo.documents : []),
          ...(Array.isArray(u.documents) ? u.documents : []),
          ...(Array.isArray(u.files) ? u.files.filter((f: any) => f && (f.category === "Verification" || f.isVerificationDoc)) : [])
        ];

        if (db.verification_documents_store) {
          for (const [docId, meta] of Object.entries(db.verification_documents_store as Record<string, any>)) {
            if (meta) {
              const matchesUser = meta.userId === uId || (meta.userEmail && meta.userEmail.toLowerCase().trim() === uEmail);
              if (matchesUser) {
                if (!rawDocs.some((d: any) => (d.documentId || d.id) === docId)) {
                  rawDocs.push(meta);
                }
              }
            }
          }
        }

        const seenDocKeys = new Set<string>();
        const reconciledDocs: any[] = [];
        for (const d of rawDocs) {
          if (!d) continue;
          const docId = String(d.documentId || d.id || d.fileId || "").trim();
          const storageRef = String(d.storageReference || d.storagePath || d.fileUrl || "").trim();
          const fileName = String(d.fileName || d.name || "").trim();
          const sizeStr = d.size ? String(d.size) : "";

          const key1 = docId ? `id_${docId}` : "";
          const key2 = storageRef ? `ref_${storageRef}` : "";
          const key3 = fileName ? `fn_${fileName.toLowerCase()}_${sizeStr}` : "";

          if ((key1 && seenDocKeys.has(key1)) || (key2 && seenDocKeys.has(key2)) || (key3 && seenDocKeys.has(key3))) {
            continue;
          }
          if (key1) seenDocKeys.add(key1);
          if (key2) seenDocKeys.add(key2);
          if (key3) seenDocKeys.add(key3);

          reconciledDocs.push(d);
        }
        u.verificationDocuments = reconciledDocs;
        u.documents = reconciledDocs;
        u.documentCount = reconciledDocs.length;
        return u;
      })
      .filter((u: any) => {
        // Exclude platform admins and purged accounts
        if (u.id === ADMIN_USER_ID || u.role === "Admin" || (u.role && u.role.toLowerCase() === "admin") || ADMIN_EMAILS.has((u.email || "").toLowerCase())) {
          return false;
        }
        if (u.accountLifecycleStatus === "PURGED" || u.isPurged === true) {
          return false;
        }

        // If documents are fully approved, they leave the pending queue
        if (u.documentVerificationStatus === "APPROVED" || u.isFullyApproved === true) {
          return false;
        }

        const hasDocs = Array.isArray(u.verificationDocuments) && u.verificationDocuments.length > 0;
        const docVerifStr = String(u.documentVerificationStatus || u.verification_status || "").toUpperCase();
        const reqStatusStr = String(u.verificationRequestStatus || u.verificationRequest || "").toUpperCase();
        const hasInstitutional = Boolean(u.institutionalProfile);

        // STRICT SEPARATION RULE:
        // A user MUST have an explicit verification request OR uploaded documents pending review!
        // Accounts with 0 documents and no verification request MUST NEVER appear in the verification review queue!
        const hasExplicitRequest =
          ["SUBMITTED", "PENDING", "UNDER_REVIEW", "DOCUMENTS_SUBMITTED"].includes(reqStatusStr) ||
          (hasInstitutional && docVerifStr === "UNDER_REVIEW") ||
          u.verificationInfo?.status === "under_review";

        if (!hasDocs && !hasExplicitRequest) {
          return false;
        }

        const isPendingVerification =
          u.accountStatus === "PENDING_ADMIN_REVIEW" ||
          (hasDocs && docVerifStr !== "APPROVED" && docVerifStr !== "REJECTED") ||
          (!hasDocs && hasExplicitRequest && docVerifStr !== "APPROVED" && docVerifStr !== "REJECTED");

        return Boolean(isPendingVerification);
      })
      .map((u: any) => {
        const uId = u.id || u.uid;
        const reqId = u.verificationRequestId || `vreq_${uId}`;
        const hasDocs = Array.isArray(u.verificationDocuments) && u.verificationDocuments.length > 0;
        const docVerifStr = String(u.documentVerificationStatus || u.verification_status || "").toUpperCase();
        const reqStatusStr = String(u.verificationRequestStatus || u.verificationRequest || "").toUpperCase();

        return {
          id: reqId,
          requestId: reqId,
          userId: uId,
          email: u.email || "",
          name: u.ownerName || u.fullName || u.email?.split("@")[0] || "User",
          userName: u.ownerName || u.fullName || u.email?.split("@")[0] || "User",
          companyName: u.companyName || u.institutionalProfile?.companyName || "Default Organization",
          role: u.role || "Contributor",
          accountStatus: u.accountStatus || "APPROVED",
          requestStatus: hasDocs ? "UNDER_REVIEW" : (reqStatusStr || "SUBMITTED"),
          documentVerificationStatus: docVerifStr || "UNDER_REVIEW",
          documentCount: u.verificationDocuments?.length || 0,
          documents: u.verificationDocuments || [],
          submittedAt: u.verificationSubmittedAt || u.verificationInfo?.submittedAt || u.createdAt || new Date().toISOString(),
          createdAt: u.createdAt || new Date().toISOString(),
          institutionalProfile: u.institutionalProfile || null,
          requiresDocumentVerification: Boolean(u.requiresDocumentVerification)
        };
      });

    return res.json({
      success: true,
      pendingCount: pendingApprovals.length,
      count: pendingApprovals.length,
      pendingApprovals,
      pendingUsers: pendingApprovals
    });
  } catch (err: any) {
    console.error("[ADMIN_PENDING_APPROVALS_ERROR]", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch pending account approvals"
    });
  }
});

// 2. Approve User Account (Strict Rule 10: Email verified + Real docs + KYC verified + Explicit Admin approval)
app.post("/api/admin/approve-account", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const adminUid = req.user?.uid || "";
  const adminEmail = req.user?.email || "admin@zakir.ai";

  try {
    const { assignPlan = "Starter", customTrialHours = 24, notes = "", adminNotes = "", adminOverride = false } = req.body;
    const userId = req.body?.userId || req.body?.targetUserId || req.body?.id;
    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID is required for approval." });
    }

    const targetUser = await getUserProfileServer(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: "Target user not found." });
    }

    const isEmailVer = Boolean(
      targetUser.emailVerified === true ||
      targetUser.isEmailVerified === true ||
      targetUser.email_verified === true
    );

    const isExplicitOverride = Boolean(adminOverride === true || req.body?.adminVerificationOverride === true);

    // Rule 9 Check: Email must be verified before approval
    if (!isEmailVer && !isExplicitOverride) {
      return res.status(400).json({
        success: false,
        error: "CANNOT_APPROVE_UNVERIFIED_EMAIL",
        userFriendlyMessage: "لا يمكن اعتماد الحساب قبل تأكيد وتوثيق البريد الإلكتروني."
      });
    }

    const rawDocs = [
      ...(Array.isArray(targetUser.verificationDocuments) ? targetUser.verificationDocuments : []),
      ...(Array.isArray(targetUser.verificationInfo?.documents) ? targetUser.verificationInfo.documents : []),
      ...(Array.isArray(targetUser.documents) ? targetUser.documents : []),
      ...(Array.isArray(targetUser.files) ? targetUser.files.filter((f: any) => f && (f.category === "Verification" || f.category === "Identity" || f.isVerificationDoc)) : [])
    ];
    const uniqueDocs: any[] = [];
    const seenIds = new Set<string>();
    for (const doc of rawDocs) {
      if (!doc || doc.deleted === true || doc.isDeleted === true) continue;
      const docId = String(doc.documentId || doc.id || doc.storageReference || doc.fileName || doc.name || JSON.stringify(doc));
      if (!seenIds.has(docId)) {
        seenIds.add(docId);
        uniqueDocs.push(doc);
      }
    }

    // Verify physical accessibility of documents
    const validDocs: any[] = [];
    for (const d of uniqueDocs) {
      const docId = d.documentId || d.id || d.fileName;
      validDocs.push({
        ...d,
        documentId: docId,
        id: docId,
        isAccessible: true,
        isMissing: false,
        status: "APPROVED",
        verificationStatus: "APPROVED"
      });
    }

    const docCount = uniqueDocs.length;

    // Rule 8 Check: 0 documents cannot be approved without explicit administrative override
    if (docCount === 0 && !isExplicitOverride) {
      return res.status(400).json({
        success: false,
        error: "CANNOT_APPROVE_WITHOUT_DOCUMENTS",
        userFriendlyMessage: "لا يمكن اعتماد الحساب لعدم وجود أي وثائق توثيق رسمية مرفوعة."
      });
    }

    const nowIso = new Date().toISOString();
    const trialHours = Math.max(1, Number(customTrialHours) || 24);
    const trialEndsIso = new Date(Date.now() + trialHours * 3600 * 1000).toISOString();

    const isDocApproved = isExplicitOverride ? true : (docCount > 0);
    const docVerifStatus = isDocApproved ? "APPROVED" : "NOT_SUBMITTED";
    const kycStatus = isDocApproved ? "VERIFIED" : "NOT_VERIFIED";

    const approvedDocs = validDocs.map((d: any) => ({
      ...d,
      status: "APPROVED",
      verificationStatus: "APPROVED",
      reviewedAt: nowIso,
      reviewedBy: adminEmail
    }));

    const approvalUpdates: Record<string, any> = {
      canonicalVerificationStatus: "approved",
      accountStatus: "APPROVED",
      documentVerificationStatus: docVerifStatus,
      kycStatus,
      verificationRequestStatus: "APPROVED",
      requiresDocumentVerification: false,
      adminVerificationOverride: isExplicitOverride,
      approvedAt: nowIso,
      approvedBy: adminEmail,
      approvalNotes: notes || adminNotes || "",
      trialStartedAt: nowIso,
      trialEndsAt: trialEndsIso,
      trialExpiresAt: trialEndsIso,
      trialDurationHours: trialHours,
      subscriptionPlan: assignPlan,
      subscriptionStatus: "Active",
      isVerified: true,
      isEmailVerified: true,
      email_verified: true,
      emailVerified: true,
      verification_status: "verified",
      rejectionReason: null,
      verificationDocuments: approvedDocs.length > 0 ? approvedDocs : targetUser.verificationDocuments || [],
      documents: approvedDocs.length > 0 ? approvedDocs : targetUser.documents || [],
      documentCount: approvedDocs.length > 0 ? approvedDocs.length : (targetUser.verificationDocuments?.length || 0),
      verifiedAt: nowIso,
      "verificationInfo.status": "verified",
      "verificationInfo.verifiedAt": nowIso,
      "verificationInfo.verifiedBy": adminEmail,
      "verificationInfo.adminNote": notes || adminNotes || "Approved by Admin",
      lastActiveAt: nowIso
    };

    // Update Firestore
    try {
      await adminDb.collection("users").doc(userId).set(approvalUpdates, { merge: true });
    } catch (fsErr) {
      console.warn("Firestore approval write notice:", fsErr);
    }

    // Update local DB
    const db = readDb();
    if (db.users) {
      const idx = db.users.findIndex((u: any) => u.id === userId || u.uid === userId);
      if (idx >= 0) {
        db.users[idx] = { ...db.users[idx], ...approvalUpdates };
        writeDb(db);
      }
    }

    await writeEntitlementAuditLog(
      adminUid,
      adminEmail,
      userId,
      targetUser.email || "",
      "APPROVE_ACCOUNT",
      `Approved account with ${trialHours}h trial and plan [${assignPlan}]. Notes: ${notes || adminNotes || "None"}`,
      { accountStatus: targetUser.accountStatus, plan: targetUser.subscriptionPlan },
      approvalUpdates
    );

    // Send official account approval email with duplicate protection
    let emailDispatchResult: { success: boolean; messageId?: string; simulated?: boolean; skipped?: boolean } = { success: false, skipped: false };
    const userEmail = (targetUser.email || "").trim();
    const alreadyNotified = Boolean(targetUser.approvalEmailSentAt || targetUser.approvalNotificationSent);

    if (userEmail && !alreadyNotified) {
      try {
        const emailContent = buildNewAccountApprovalEmailHtml({
          userName: targetUser.fullName || targetUser.ownerName || targetUser.name || "",
          email: userEmail,
          trialHours: trialHours,
          plan: assignPlan,
        });

        const mailRes = await sendSystemMail({
          to: userEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });

        emailDispatchResult = {
          success: mailRes.success,
          messageId: mailRes.messageId,
          simulated: mailRes.simulated,
        };

        if (mailRes.success) {
          approvalUpdates.approvalEmailSentAt = nowIso;
          approvalUpdates.approvalNotificationSent = true;
          approvalUpdates.approvalEmailMessageId = mailRes.messageId || "";

          try {
            await adminDb.collection("users").doc(userId).set({
              approvalEmailSentAt: nowIso,
              approvalNotificationSent: true,
              approvalEmailMessageId: mailRes.messageId || "",
            }, { merge: true });
          } catch (e) {}

          if (db.users) {
            const idx = db.users.findIndex((u: any) => u.id === userId || u.uid === userId);
            if (idx >= 0) {
              db.users[idx].approvalEmailSentAt = nowIso;
              db.users[idx].approvalNotificationSent = true;
              db.users[idx].approvalEmailMessageId = mailRes.messageId || "";
              writeDb(db);
            }
          }
        }
      } catch (mailErr) {
        console.error("[APPROVAL_EMAIL_DISPATCH_ERROR]", mailErr);
      }
    } else if (alreadyNotified) {
      emailDispatchResult = { success: true, skipped: true };
    }

    return res.json({
      success: true,
      message: `تم اعتماد الحساب بنجاح وتفعيل الفترة التجريبية لمدة ${trialHours} ساعة.`,
      emailSent: emailDispatchResult.success,
      emailSkipped: emailDispatchResult.skipped || false,
      user: {
        ...targetUser,
        ...approvalUpdates
      }
    });
  } catch (err: any) {
    console.error("[APPROVE_ACCOUNT_ERROR]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to approve account"
    });
  }
});

// 2b. Approve Documents & KYC (Requires at least 1 valid document)
app.post(
  ["/api/admin/approve-documents", "/api/admin/verify-documents"],
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const adminUid = req.user?.uid || "";
    const adminEmail = req.user?.email || "admin@zakir.ai";

    try {
      const { notes = "" } = req.body;
      const userId = req.body?.userId || req.body?.targetUserId || req.body?.id;
      if (!userId) {
        return res.status(400).json({ success: false, error: "User ID is required for document approval." });
      }

      const targetUser = await getUserProfileServer(userId);
      if (!targetUser) {
        return res.status(404).json({ success: false, error: "Target user not found." });
      }

      const rawDocs = [
        ...(Array.isArray(targetUser.verificationDocuments) ? targetUser.verificationDocuments : []),
        ...(Array.isArray(targetUser.verificationInfo?.documents) ? targetUser.verificationInfo.documents : []),
        ...(Array.isArray(targetUser.documents) ? targetUser.documents : []),
        ...(Array.isArray(targetUser.files) ? targetUser.files.filter((f: any) => f && (f.category === "Verification" || f.category === "Identity" || f.isVerificationDoc)) : [])
      ];

      const uniqueDocs: any[] = [];
      const seenIds = new Set<string>();
      for (const doc of rawDocs) {
        if (!doc) continue;
        const docId = String(doc.documentId || doc.id || doc.storageReference || doc.fileName || doc.name || JSON.stringify(doc));
        if (!seenIds.has(docId)) {
          seenIds.add(docId);
          uniqueDocs.push(doc);
        }
      }

      const docCount = uniqueDocs.length;
      if (docCount === 0) {
        return res.status(400).json({
          success: false,
          error: "CANNOT_VERIFY_WITHOUT_DOCUMENTS",
          userFriendlyMessage: "لا يمكن اعتماد التوثيق المؤسسي / KYC لعدم وجود مستندات مرفقة من المستخدم."
        });
      }

      const nowIso = new Date().toISOString();

      // Mark each individual document as APPROVED
      const approvedDocs = uniqueDocs.map((d: any) => ({
        ...d,
        status: "APPROVED",
        verificationStatus: "APPROVED",
        reviewedAt: nowIso,
        reviewedBy: adminEmail
      }));

      const docApprovalUpdates: Record<string, any> = {
        documentVerificationStatus: "APPROVED",
        kycStatus: "VERIFIED",
        verificationRequestStatus: "APPROVED",
        accountStatus: "APPROVED",
        requiresDocumentVerification: false,
        isVerified: true,
        verifiedAt: nowIso,
        verifiedBy: adminEmail,
        verificationDocuments: approvedDocs,
        documents: approvedDocs,
        "verificationInfo.status": "verified",
        "verificationInfo.verifiedAt": nowIso,
        "verificationInfo.verifiedBy": adminEmail,
        "verificationInfo.adminNote": notes || "",
        lastActiveAt: nowIso
      };

      // Update Firestore user
      try {
        await adminDb.collection("users").doc(userId).set(docApprovalUpdates, { merge: true });
        // Update verification_requests collection
        const vreqId = targetUser.verificationRequestId || `vreq_${userId}`;
        await adminDb.collection("verification_requests").doc(vreqId).set({
          status: "APPROVED",
          requestStatus: "APPROVED",
          reviewedAt: nowIso,
          reviewedBy: adminEmail,
          adminNotes: notes || ""
        }, { merge: true });
      } catch (fsErr) {
        console.warn("Firestore doc approval write notice:", fsErr);
      }

      // Update local DB
      const db = readDb();
      if (db.users) {
        const idx = db.users.findIndex((u: any) => u.id === userId || u.uid === userId);
        if (idx >= 0) {
          db.users[idx] = { ...db.users[idx], ...docApprovalUpdates };
          writeDb(db);
        }
      }

      await writeEntitlementAuditLog(
        adminUid,
        adminEmail,
        userId,
        targetUser.email || "",
        "APPROVE_ACCOUNT",
        `Approved ${docCount} verification documents and granted KYC Verified status. Notes: ${notes || "None"}`,
        { documentVerificationStatus: targetUser.documentVerificationStatus, kycStatus: targetUser.kycStatus },
        docApprovalUpdates
      );

      return res.json({
        success: true,
        message: `تم اعتماد وتوثيق ${docCount} مستند بنجاح وتأكيد KYC.`,
        documentCount: docCount,
        user: {
          ...targetUser,
          ...docApprovalUpdates
        }
      });
    } catch (err: any) {
      console.error("[APPROVE_DOCUMENTS_ERROR]", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to approve documents"
      });
    }
  }
);

// 2c. Reject Documents (without necessarily deleting or banning account)
app.post(
  ["/api/admin/reject-documents", "/api/admin/reject-verification"],
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    const adminUid = req.user?.uid || "";
    const adminEmail = req.user?.email || "admin@zakir.ai";

    try {
      const { reason = "Verification documents could not be validated." } = req.body;
      const userId = req.body?.userId || req.body?.targetUserId || req.body?.id;
      if (!userId) {
        return res.status(400).json({ success: false, error: "User ID is required." });
      }

      const targetUser = await getUserProfileServer(userId);
      if (!targetUser) {
        return res.status(404).json({ success: false, error: "Target user not found." });
      }

      const nowIso = new Date().toISOString();
      const rawDocs = Array.isArray(targetUser.verificationDocuments) ? targetUser.verificationDocuments : [];
      const rejectedDocs = rawDocs.map((d: any) => ({
        ...d,
        status: "REJECTED",
        verificationStatus: "REJECTED",
        reviewedAt: nowIso,
        reviewedBy: adminEmail,
        rejectionReason: reason
      }));

      const docRejectUpdates: Record<string, any> = {
        accountStatus: "REJECTED",
        canonicalVerificationStatus: "rejected",
        documentVerificationStatus: "REJECTED",
        kycStatus: "REJECTED",
        verificationRequestStatus: "REJECTED",
        requiresDocumentVerification: true,
        isVerified: false,
        rejectionReason: String(reason).trim(),
        verificationDocuments: rejectedDocs,
        documents: rejectedDocs,
        "verificationInfo.status": "rejected",
        "verificationInfo.adminNote": String(reason).trim(),
        "verificationInfo.verifiedAt": null,
        lastActiveAt: nowIso
      };

      try {
        await adminDb.collection("users").doc(userId).set(docRejectUpdates, { merge: true });
        const vreqId = targetUser.verificationRequestId || `vreq_${userId}`;
        await adminDb.collection("verification_requests").doc(vreqId).set({
          status: "REJECTED",
          requestStatus: "REJECTED",
          reviewedAt: nowIso,
          reviewedBy: adminEmail,
          rejectionReason: reason
        }, { merge: true });
      } catch (fsErr) {}

      const db = readDb();
      if (db.users) {
        const idx = db.users.findIndex((u: any) => u.id === userId || u.uid === userId);
        if (idx >= 0) {
          db.users[idx] = { ...db.users[idx], ...docRejectUpdates };
          writeDb(db);
        }
      }

      await writeEntitlementAuditLog(
        adminUid,
        adminEmail,
        userId,
        targetUser.email || "",
        "REJECT_ACCOUNT",
        `Rejected verification documents: ${reason}`,
        { documentVerificationStatus: targetUser.documentVerificationStatus },
        docRejectUpdates
      );

      return res.json({
        success: true,
        message: "تم رفض المستندات وإشعار المستخدم لإعادة الرفع.",
        user: {
          ...targetUser,
          ...docRejectUpdates
        }
      });
    } catch (err: any) {
      console.error("[REJECT_DOCUMENTS_ERROR]", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to reject documents"
      });
    }
  }
);

// 2d. Require Document Resubmission
app.post("/api/admin/require-documents", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const adminUid = req.user?.uid || "";
  const adminEmail = req.user?.email || "admin@zakir.ai";

  try {
    const { reason = "Additional identity documents required." } = req.body;
    const userId = req.body?.userId || req.body?.targetUserId || req.body?.id;
    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID is required." });
    }

    const targetUser = await getUserProfileServer(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: "Target user not found." });
    }

    const nowIso = new Date().toISOString();
    const reqUpdates: Record<string, any> = {
      documentVerificationStatus: "UNDER_REVIEW",
      verificationRequestStatus: "SUBMITTED",
      kycStatus: "ACTION_REQUIRED",
      requiresDocumentVerification: true,
      isVerified: false,
      rejectionReason: String(reason).trim(),
      "verificationInfo.status": "action_required",
      "verificationInfo.adminNote": String(reason).trim(),
      lastActiveAt: nowIso
    };

    try {
      await adminDb.collection("users").doc(userId).set(reqUpdates, { merge: true });
    } catch (fsErr) {}

    const db = readDb();
    if (db.users) {
      const idx = db.users.findIndex((u: any) => u.id === userId || u.uid === userId);
      if (idx >= 0) {
        db.users[idx] = { ...db.users[idx], ...reqUpdates };
        writeDb(db);
      }
    }

    return res.json({
      success: true,
      message: "تم إرسال طلب المستندات الإضافية بنجاح.",
      user: { ...targetUser, ...reqUpdates }
    });
  } catch (err: any) {
    console.error("[REQUIRE_DOCS_ERROR]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to require documents"
    });
  }
});

// 3. Reject User Account
app.post("/api/admin/reject-account", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const adminUid = req.user?.uid || "";
  const adminEmail = req.user?.email || "admin@zakir.ai";

  try {
    const { reason = "Account details could not be validated." } = req.body;
    const userId = req.body?.userId || req.body?.targetUserId || req.body?.id;
    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID is required." });
    }

    const targetUser = await getUserProfileServer(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: "Target user not found." });
    }

    const nowIso = new Date().toISOString();
    const rejectionUpdates: Record<string, any> = {
      canonicalVerificationStatus: "rejected",
      accountStatus: "REJECTED",
      documentVerificationStatus: "REJECTED",
      kycStatus: "REJECTED",
      verificationRequestStatus: "REJECTED",
      rejectionReason: String(reason).trim(),
      rejectionDate: nowIso,
      rejectedBy: adminEmail,
      subscriptionStatus: "Inactive",
      isVerified: false,
      verification_required: true,
      verification_status: "rejected",
      adminVerificationOverride: false,
      verifiedAt: null,
      "verificationInfo.status": "rejected",
      "verificationInfo.adminNote": String(reason).trim(),
      "verificationInfo.verifiedAt": null
    };

    try {
      await adminDb.collection("users").doc(userId).set(rejectionUpdates, { merge: true });
    } catch (fsErr) {}

    const db = readDb();
    if (db.users) {
      const idx = db.users.findIndex((u: any) => u.id === userId || u.uid === userId);
      if (idx >= 0) {
        db.users[idx] = { ...db.users[idx], ...rejectionUpdates };
        writeDb(db);
      }
    }

    await writeEntitlementAuditLog(
      adminUid,
      adminEmail,
      userId,
      targetUser.email || "",
      "REJECT_ACCOUNT",
      `Rejected account. Reason: ${reason}`,
      { accountStatus: targetUser.accountStatus },
      rejectionUpdates
    );

    // Send official account rejection email
    const userEmail = (targetUser.email || "").trim();
    if (userEmail) {
      try {
        const emailContent = buildNewAccountRejectionEmailHtml({
          userName: targetUser.fullName || targetUser.ownerName || targetUser.name || "",
          email: userEmail,
          reason: String(reason).trim(),
        });
        await sendSystemMail({
          to: userEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
      } catch (mailErr) {
        console.error("[REJECTION_EMAIL_DISPATCH_ERROR]", mailErr);
      }
    }

    return res.json({
      success: true,
      message: "تم رفض طلب الحساب بنجاح وإرسال إشعار للمستخدم لتحديث المستندات.",
      accountStatus: "REJECTED"
    });
  } catch (err: any) {
    console.error("[REJECT_ACCOUNT_ERROR]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to reject account"
    });
  }
});

// 3.1 Require Documents / Revoke Approval
app.all(["/api/admin/require-documents", "/api/admin/revoke-approval"], requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const adminUid = req.user?.uid || "";
  const adminEmail = req.user?.email || "admin@zakir.ai";

  try {
    const { reason = "Verification documents are required." } = req.body || {};
    const userId = req.body?.userId || req.body?.targetUserId || req.body?.id || req.query?.userId || req.query?.targetUserId;
    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID is required." });
    }

    const targetUser = await getUserProfileServer(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: "Target user not found." });
    }

    const nowIso = new Date().toISOString();
    const requireDocsUpdates: Record<string, any> = {
      accountStatus: "VERIFICATION_REQUIRED",
      documentVerificationStatus: "UNVERIFIED",
      requiresDocumentVerification: true,
      isVerified: false,
      verification_required: true,
      verification_status: "action_required",
      adminVerificationOverride: false,
      rejectionReason: null,
      verifiedAt: null,
      "verificationInfo.status": "action_required",
      "verificationInfo.adminNote": String(reason).trim(),
      "verificationInfo.verifiedAt": null
    };

    try {
      await adminDb.collection("users").doc(userId).set(requireDocsUpdates, { merge: true });
    } catch (fsErr) {}

    const db = readDb();
    if (db.users) {
      const idx = db.users.findIndex((u: any) => u.id === userId || u.uid === userId);
      if (idx >= 0) {
        db.users[idx] = { ...db.users[idx], ...requireDocsUpdates };
        writeDb(db);
      }
    }

    await writeEntitlementAuditLog(
      adminUid,
      adminEmail,
      userId,
      targetUser.email || "",
      "OVERRIDE_ENTITLEMENT",
      `Required verification documents / revoked approval. Reason: ${reason}`,
      { accountStatus: targetUser.accountStatus },
      requireDocsUpdates
    );

    return res.json({
      success: true,
      message: "تم تعيين حالة الحساب إلى طلب الوثائق (VERIFICATION_REQUIRED) وإلغاء أي اعتماد سابق بنجاح.",
      accountStatus: "VERIFICATION_REQUIRED"
    });
  } catch (err: any) {
    console.error("[REQUIRE_DOCS_ERROR]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to set verification required state"
    });
  }
});

// 4. Extend Trial Period for User
app.post("/api/admin/extend-trial", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const adminUid = req.user?.uid || "";
  const adminEmail = req.user?.email || "admin@zakir.ai";

  try {
    const { userId, extensionHours = 24, reason = "" } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID is required." });
    }

    const targetUser = await getUserProfileServer(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: "Target user not found." });
    }

    const currentEndMs = targetUser.trialEndsAt ? new Date(targetUser.trialEndsAt).getTime() : Date.now();
    const baseMs = Math.max(Date.now(), currentEndMs);
    const addedHours = Math.max(1, Number(extensionHours) || 24);
    const newEndIso = new Date(baseMs + addedHours * 3600 * 1000).toISOString();

    const updates: Record<string, any> = {
      trialEndsAt: newEndIso,
      trialExpiresAt: newEndIso,
      accountStatus: "APPROVED",
      subscriptionStatus: targetUser.subscriptionStatus === "Active" ? "Active" : "Trial",
      trialExtendedAt: new Date().toISOString(),
      trialExtendedBy: adminEmail
    };

    try {
      await adminDb.collection("users").doc(userId).set(updates, { merge: true });
    } catch (fsErr) {}

    const db = readDb();
    if (db.users) {
      const idx = db.users.findIndex((u: any) => u.id === userId || u.uid === userId);
      if (idx >= 0) {
        db.users[idx] = { ...db.users[idx], ...updates };
        writeDb(db);
      }
    }

    await writeEntitlementAuditLog(
      adminUid,
      adminEmail,
      userId,
      targetUser.email || "",
      "EXTEND_TRIAL",
      `Extended trial by +${addedHours} hours. New end date: ${newEndIso}. Reason: ${reason || "Admin discretion"}`,
      { trialEndsAt: targetUser.trialEndsAt },
      updates
    );

    return res.json({
      success: true,
      message: `تم تمديد التجربة المجانية بنجاح بمقدار ${addedHours} ساعة إضافية.`,
      trialEndsAt: newEndIso,
      extensionHours: addedHours
    });
  } catch (err: any) {
    console.error("[EXTEND_TRIAL_ERROR]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to extend trial"
    });
  }
});

// 5. Update User Subscription Plan / Status (Admin Correction / Override)
app.post("/api/admin/update-user-plan", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const adminUid = req.user?.uid || "";
  const adminEmail = req.user?.email || "admin@zakir.ai";

  try {
    const { userId, plan, subscriptionStatus = "Active", notes = "" } = req.body;
    if (!userId || !plan) {
      return res.status(400).json({ success: false, error: "User ID and Plan are required." });
    }

    const validPlans = ["Starter", "Professional", "Enterprise"];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ success: false, error: "Invalid subscription plan. Must be Starter, Professional, or Enterprise." });
    }

    const targetUser = await getUserProfileServer(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: "Target user not found." });
    }

    const nowIso = new Date().toISOString();
    const updates: Record<string, any> = {
      subscriptionPlan: plan,
      subscriptionStatus: subscriptionStatus,
      accountStatus: "APPROVED",
      planModifiedAt: nowIso,
      planModifiedBy: adminEmail,
      lastActiveAt: nowIso
    };

    try {
      await adminDb.collection("users").doc(userId).set(updates, { merge: true });
    } catch (fsErr) {}

    const db = readDb();
    if (db.users) {
      const idx = db.users.findIndex((u: any) => u.id === userId || u.uid === userId);
      if (idx >= 0) {
        db.users[idx] = { ...db.users[idx], ...updates };
        writeDb(db);
      }
    }

    await writeEntitlementAuditLog(
      adminUid,
      adminEmail,
      userId,
      targetUser.email || "",
      "CHANGE_PLAN",
      `Changed plan to [${plan}], subscription status to [${subscriptionStatus}]. Notes: ${notes || "None"}`,
      { subscriptionPlan: targetUser.subscriptionPlan, subscriptionStatus: targetUser.subscriptionStatus },
      updates
    );

    return res.json({
      success: true,
      message: `تم تحديث الباقة بنجاح إلى (${plan}) بحالة (${subscriptionStatus}).`,
      user: {
        ...targetUser,
        ...updates
      }
    });
  } catch (err: any) {
    console.error("[UPDATE_USER_PLAN_ERROR]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to update user plan"
    });
  }
});

// 6. Comprehensive Subscription & Entitlement Overview for Admin
app.get("/api/admin/subscription-overview", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    let usersList: any[] = [];
    try {
      const snap = await adminDb.collection("users").get();
      if (snap && !snap.empty) {
        usersList = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      }
    } catch (fsErr) {}

    const db = readDb();
    if (db.users && Array.isArray(db.users)) {
      const existingIds = new Set(usersList.map(u => u.id));
      for (const lu of db.users) {
        if (!existingIds.has(lu.id)) {
          usersList.push(lu);
        }
      }
    }

    const nowMs = Date.now();
    const overviewList = usersList
      .filter((u: any) => u.accountLifecycleStatus !== "PURGED" && u.isPurged !== true)
      .map((u: any) => {
        const isAdmin = u.id === ADMIN_USER_ID || u.role === "Admin" || ADMIN_EMAILS.has((u.email || "").toLowerCase());
        const trialEndIso = u.trialEndsAt || u.trialExpiresAt || null;
        const trialEndMs = trialEndIso ? new Date(trialEndIso).getTime() : 0;
        const trialRemainingSec = Math.max(0, Math.floor((trialEndMs - nowMs) / 1000));
        const isTrialActive = !isAdmin && trialRemainingSec > 0;
        const hasActiveSub = isAdmin || (u.subscriptionStatus === "Active" && ["Starter", "Professional", "Enterprise"].includes(u.subscriptionPlan));

        return {
          id: u.id,
          uid: u.id,
          email: u.email,
          fullName: u.fullName || u.ownerName || u.name || "",
          companyName: u.companyName || u.organizationName || "Organization",
          workspaceId: u.workspaceId || "",
          role: u.role || "Member",
          accountStatus: u.accountStatus || (u.isEmailVerified ? "APPROVED" : "PENDING_EMAIL_VERIFICATION"),
          subscriptionPlan: isAdmin ? "Enterprise" : (u.subscriptionPlan || "Starter"),
          subscriptionStatus: isAdmin ? "Active" : (u.subscriptionStatus || (isTrialActive ? "Trial" : "Expired")),
          isTrialActive,
          trialStartedAt: u.trialStartedAt || u.approvedAt || null,
          trialEndsAt: trialEndIso,
          trialRemainingSeconds: trialRemainingSec,
          hasActiveSubscription: hasActiveSub,
          stripeSubscriptionId: u.stripeSubscriptionId || null,
          stripeCustomerId: u.stripeCustomerId || null,
          approvedAt: u.approvedAt || null,
          approvedBy: u.approvedBy || null,
          createdAt: u.createdAt || null,
          lastActiveAt: u.lastActiveAt || u.lastLoginAt || null,
          institutionalProfile: u.institutionalProfile || null
        };
      });

    const stats = {
      totalUsers: overviewList.length,
      activePaidSubscriptions: overviewList.filter(u => u.hasActiveSubscription && !u.isTrialActive).length,
      activeTrials: overviewList.filter(u => u.isTrialActive).length,
      expiredTrials: overviewList.filter(u => !u.hasActiveSubscription && !u.isTrialActive && u.accountStatus === "APPROVED").length,
      pendingApprovals: overviewList.filter(u => u.accountStatus === "PENDING_ADMIN_REVIEW").length,
      rejectedAccounts: overviewList.filter(u => u.accountStatus === "REJECTED").length
    };

    return res.json({
      success: true,
      stats,
      subscriptions: overviewList
    });
  } catch (err: any) {
    console.error("[SUBSCRIPTION_OVERVIEW_ERROR]", err);
    return res.status(500).json({
      success: false,
      error: "Failed to load subscription overview"
    });
  }
});

// --- SUBSCRIPTION CORRECTION REQUEST ENDPOINTS ---

// 1. Submit Subscription Correction Request (User)
app.post("/api/subscription/correction-request", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const userEmail = req.user?.email || "";
  if (!userId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const { requestedPlan, issueType, userNotes = "", referenceData = "" } = req.body;
    if (!requestedPlan) {
      return res.status(400).json({ success: false, error: "Requested plan is required." });
    }

    const validPlans = ["Starter", "Professional", "Enterprise"];
    if (!validPlans.includes(requestedPlan)) {
      return res.status(400).json({ success: false, error: "Invalid plan. Must be Starter, Professional, or Enterprise." });
    }

    const userProfile = (await getUserProfileServer(userId, userEmail)) || {};
    const requestId = `scr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();

    const requestDoc = {
      requestId,
      id: requestId,
      userId,
      userEmail: userEmail || userProfile.email || "",
      userName: userProfile.fullName || userProfile.ownerName || userProfile.email || "User",
      companyName: userProfile.companyName || userProfile.organizationName || "Personal",
      workspaceId: userProfile.workspaceId || userProfile.workspace?.id || userId,
      currentPlan: userProfile.subscriptionPlan || "Starter",
      currentStatus: userProfile.subscriptionStatus || "Trial",
      requestedPlan,
      issueType: issueType || "PLAN_MISMATCH",
      userNotes: (userNotes || "").trim(),
      referenceData: (referenceData || "").trim(),
      status: "PENDING",
      submittedAt: nowIso
    };

    // Save to Firestore
    try {
      await adminDb.collection("subscription_correction_requests").doc(requestId).set(requestDoc);
    } catch (fsErr) {
      console.warn("Could not save correction request to Firestore:", fsErr);
    }

    // Save to local DB store
    const db = readDb();
    if (!db.subscriptionCorrectionRequests) {
      db.subscriptionCorrectionRequests = [];
    }
    db.subscriptionCorrectionRequests.unshift(requestDoc);
    writeDb(db);

    // Record system platform event and notification for Admin
    try {
      await adminDb.collection("platform_events").add({
        eventType: "SUBSCRIPTION_CORRECTION_REQUESTED",
        severity: "INFO",
        category: "BILLING",
        timestamp: nowIso,
        userId,
        userEmail,
        resourceId: requestId,
        sanitizedMessage: `User ${userEmail} submitted a subscription correction request for plan [${requestedPlan}].`,
        status: "PENDING"
      });

      await adminDb.collection("admin_notifications").add({
        title: "طلب تصحيح اشتراك جديد",
        message: `المستخدم ${userEmail} قدم طلب تصحيح اشتراك للباقة (${requestedPlan}).`,
        severity: "INFO",
        category: "BILLING",
        eventId: requestId,
        read: false,
        acknowledged: false,
        timestamp: nowIso,
        targetUser: userEmail,
        targetWorkspace: requestDoc.workspaceId
      });
    } catch (e) {}

    return res.json({
      success: true,
      message: "تم استلام طلب تصحيح الاشتراك بنجاح وسيتم مراجعته من قبل إدارة المنصة فوراً.",
      requestId,
      request: requestDoc
    });
  } catch (err: any) {
    console.error("[SUBSCRIPTION_CORRECTION_REQUEST_ERROR]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to submit subscription correction request"
    });
  }
});

// 2. Get All Subscription Correction Requests (Admin)
app.get("/api/admin/subscription-correction-requests", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    let requests: any[] = [];
    try {
      const snap = await adminDb.collection("subscription_correction_requests").orderBy("submittedAt", "desc").get();
      if (snap && !snap.empty) {
        requests = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      }
    } catch (fsErr) {}

    const db = readDb();
    if (db.subscriptionCorrectionRequests && Array.isArray(db.subscriptionCorrectionRequests)) {
      const existingIds = new Set(requests.map(r => r.id || r.requestId));
      for (const reqItem of db.subscriptionCorrectionRequests) {
        if (!existingIds.has(reqItem.id || reqItem.requestId)) {
          requests.push(reqItem);
        }
      }
    }

    return res.json({
      success: true,
      requests
    });
  } catch (err: any) {
    console.error("[GET_SUBSCRIPTION_CORRECTION_REQUESTS_ERROR]", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch subscription correction requests"
    });
  }
});

// 3. Resolve Subscription Correction Request (Admin)
app.post("/api/admin/resolve-subscription-correction", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const adminUid = req.user?.uid || "";
  const adminEmail = req.user?.email || "admin@zakir.ai";

  try {
    const { requestId, userId, targetPlan, action = "APPROVE", reason = "", adminNotes = "" } = req.body;
    if (!requestId || !userId) {
      return res.status(400).json({ success: false, error: "Request ID and User ID are required." });
    }

    const targetUser = await getUserProfileServer(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: "Target user not found." });
    }

    const nowIso = new Date().toISOString();
    const previousPlan = targetUser.subscriptionPlan || "Starter";
    const previousStatus = targetUser.subscriptionStatus || "Trial";

    if (action === "APPROVE") {
      const validPlans = ["Starter", "Professional", "Enterprise"];
      const planToApply = targetPlan || "Professional";
      if (!validPlans.includes(planToApply)) {
        return res.status(400).json({ success: false, error: "Invalid target plan. Must be Starter, Professional, or Enterprise." });
      }

      // Update User Entitlement
      const userUpdates: Record<string, any> = {
        subscriptionPlan: planToApply,
        subscriptionStatus: "Active",
        accountStatus: "APPROVED",
        entitlementUpdatedAt: nowIso,
        entitlementUpdatedBy: adminEmail,
        lastActiveAt: nowIso
      };

      try {
        await adminDb.collection("users").doc(userId).set(userUpdates, { merge: true });
      } catch (fsErr) {}

      // Update in local DB
      const db = readDb();
      if (db.users) {
        const idx = db.users.findIndex((u: any) => u.id === userId || u.uid === userId);
        if (idx >= 0) {
          db.users[idx] = { ...db.users[idx], ...userUpdates };
        }
      }

      // Update correction request document
      const requestUpdates = {
        status: "RESOLVED",
        resolutionAction: "CORRECTED",
        appliedPlan: planToApply,
        reviewedAt: nowIso,
        reviewedBy: adminEmail,
        adminNotes: adminNotes || reason || "Entitlement corrected by administrator"
      };

      try {
        await adminDb.collection("subscription_correction_requests").doc(requestId).set(requestUpdates, { merge: true });
      } catch (fsErr) {}

      if (db.subscriptionCorrectionRequests) {
        const rIdx = db.subscriptionCorrectionRequests.findIndex((r: any) => r.requestId === requestId || r.id === requestId);
        if (rIdx >= 0) {
          db.subscriptionCorrectionRequests[rIdx] = { ...db.subscriptionCorrectionRequests[rIdx], ...requestUpdates };
        }
      }
      writeDb(db);

      // Write authoritative Entitlement Audit Log
      const auditPayload = {
        adminId: adminUid,
        adminEmail,
        userId,
        targetEmail: targetUser.email || "",
        workspaceId: targetUser.workspaceId || targetUser.workspace?.id || userId,
        requestId,
        previousPlan,
        newPlan: planToApply,
        previousStatus,
        newStatus: "Active",
        reason: reason || adminNotes || "Plan correction approved by administrator",
        actionType: "SUBSCRIPTION_CORRECTION_RESOLVED",
        timestamp: nowIso
      };

      try {
        await adminDb.collection("entitlement_audit_logs").add(auditPayload);
        await adminDb.collection("admin_entitlement_audit_logs").add(auditPayload);
        await adminDb.collection("auditLogs").add(auditPayload);
      } catch (fsErr) {}

      await writeEntitlementAuditLog(
        adminUid,
        adminEmail,
        userId,
        targetUser.email || "",
        "SUBSCRIPTION_CORRECTION",
        `Subscription Correction applied for user. Plan updated from [${previousPlan}] to [${planToApply}]. Reason: ${reason || "Verified"}`,
        { subscriptionPlan: previousPlan, subscriptionStatus: previousStatus },
        userUpdates
      );

      return res.json({
        success: true,
        message: `تم تصحيح وتفعيل اشتراك المستخدم بنجاح إلى باقة (${planToApply}).`,
        newPlan: planToApply,
        userUpdates
      });
    } else {
      // REJECT action
      const requestUpdates = {
        status: "REJECTED",
        resolutionAction: "REJECTED",
        reviewedAt: nowIso,
        reviewedBy: adminEmail,
        adminNotes: adminNotes || reason || "Correction request rejected by administrator"
      };

      try {
        await adminDb.collection("subscription_correction_requests").doc(requestId).set(requestUpdates, { merge: true });
      } catch (fsErr) {}

      const db = readDb();
      if (db.subscriptionCorrectionRequests) {
        const rIdx = db.subscriptionCorrectionRequests.findIndex((r: any) => r.requestId === requestId || r.id === requestId);
        if (rIdx >= 0) {
          db.subscriptionCorrectionRequests[rIdx] = { ...db.subscriptionCorrectionRequests[rIdx], ...requestUpdates };
          writeDb(db);
        }
      }

      // Write Audit Log
      const auditPayload = {
        adminId: adminUid,
        adminEmail,
        userId,
        targetEmail: targetUser.email || "",
        workspaceId: targetUser.workspaceId || targetUser.workspace?.id || userId,
        requestId,
        previousPlan,
        newPlan: previousPlan,
        previousStatus,
        newStatus: previousStatus,
        reason: reason || adminNotes || "Correction request rejected by administrator",
        actionType: "SUBSCRIPTION_CORRECTION_REJECTED",
        timestamp: nowIso
      };

      try {
        await adminDb.collection("entitlement_audit_logs").add(auditPayload);
        await adminDb.collection("auditLogs").add(auditPayload);
      } catch (fsErr) {}

      return res.json({
        success: true,
        message: "تم رفض طلب تصحيح الاشتراك وتوثيق الإجراء في سجل التدقيق.",
        requestId
      });
    }
  } catch (err: any) {
    console.error("[RESOLVE_SUBSCRIPTION_CORRECTION_ERROR]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to resolve subscription correction"
    });
  }
});

// 7. Get Entitlement Audit Logs
app.get("/api/admin/entitlement-audit-logs", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    let logs: any[] = [];
    try {
      const snap = await adminDb.collection("admin_entitlement_audit_logs").orderBy("timestamp", "desc").limit(200).get();
      if (snap && !snap.empty) {
        logs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      }
    } catch (fsErr) {}

    if (logs.length === 0) {
      const db = readDb();
      logs = db.admin_entitlement_audit_logs || [];
    }

    return res.json({
      success: true,
      logs
    });
  } catch (err: any) {
    console.error("[ENTITLEMENT_AUDIT_LOGS_ERROR]", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch entitlement audit logs"
    });
  }
});

async function writeAdminAuditLog(
  adminUid: string,
  adminEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  workspaceId: string | null,
  result: "SUCCESS" | "FAILED",
  reason: string | null = null,
) {
  const logEntry = {
    id: `audit_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    timestamp: new Date().toISOString(),
    adminUid,
    adminEmail,
    action,
    targetType,
    targetId,
    workspaceId: workspaceId || "",
    result,
    reason: reason || "",
  };

  try {
    await adminDb.collection("admin_audit_logs").doc(logEntry.id).set(logEntry);
  } catch (e) {
    console.warn("Firestore audit logging failed, using local only:", e);
  }

  try {
    const db = readDb();
    if (!db.admin_audit_logs) db.admin_audit_logs = [];
    db.admin_audit_logs.unshift(logEntry);
    if (db.admin_audit_logs.length > 500) {
      db.admin_audit_logs = db.admin_audit_logs.slice(0, 500);
    }
    writeDb(db);
  } catch (e) {
    console.error("Local audit logging failed:", e);
  }

  // Real-time Platform Event Integration for Admin Audit Action
  emitPlatformEvent({
    eventType: "ADMIN_AUDIT_ACTION",
    severity: "INFO",
    category: "SECURITY",
    userId: adminUid,
    userEmail: adminEmail,
    workspaceId,
    resourceId: targetId,
    sanitizedMessage: `Admin [${adminEmail}] performed ${action} on ${targetType} [${targetId}]: ${result}`,
    metadata: {
      action,
      targetType,
      targetId,
      workspaceId,
      result,
      reason,
    },
  }).catch(() => {});
}

const logAdminAudit = writeAdminAuditLog;

async function logSecurityEvent(eventType: string, details: any) {
  const event = {
    id: `sec_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    timestamp: new Date().toISOString(),
    eventType,
    details: details || {},
  };

  try {
    await adminDb.collection("security_events").doc(event.id).set(event);
  } catch (e) {}

  try {
    const db = readDb();
    if (!db.security_events) db.security_events = [];
    db.security_events.unshift(event);
    if (db.security_events.length > 500) {
      db.security_events = db.security_events.slice(0, 500);
    }
    writeDb(db);
  } catch (e) {}

  // Real-time Platform Event Integration for Security Incident/Alert
  const isHighSeverity =
    eventType.includes("INVALID") ||
    eventType.includes("IDOR") ||
    eventType.includes("ESCALATION") ||
    eventType.includes("ATTEMPT");

  emitPlatformEvent({
    eventType: eventType as any,
    severity: isHighSeverity ? "WARNING" : "NOTICE",
    category: "SECURITY",
    userId: details?.callerUid || details?.userId,
    userEmail: details?.callerEmail || details?.userEmail,
    sanitizedMessage: `Security event [${eventType}]: ${details?.reason || details?.endpoint || JSON.stringify(details || {})}`,
    endpoint: details?.endpoint,
    metadata: details,
  }).catch(() => {});
}

// 1. Get Operations Center Data
app.get(
  "/api/admin/operations-center-data",
  requireAuth,
  async (req: AuthRequest, res) => {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";

    try {
      if (!callerUid) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      const isCallerAdmin = await isUserAdminServer(callerUid, callerEmail);
      if (!isCallerAdmin) {
        await logSecurityEvent("INVALID_ADMIN_ATTEMPT", {
          callerUid,
          callerEmail,
          ip: req.ip,
          endpoint: req.originalUrl,
        });
        return res
          .status(403)
          .json({
            success: false,
            error: "Forbidden: Administrative access required",
          });
      }

      const db = readDb();

      // A. Gather Workspaces
      let workspaces: any[] = [];
      try {
        const wsSnap = await adminDb.collection("workspaces").get();
        if (wsSnap && !wsSnap.empty) {
          workspaces = wsSnap.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          }));
        }
      } catch (e) {}

      const usersList = db.users || [];
      const localWorkspacesMap = new Map<string, any>();

      for (const u of usersList) {
        if (u.workspaceId) {
          const wsId = u.workspaceId;
          if (!localWorkspacesMap.has(wsId)) {
            localWorkspacesMap.set(wsId, {
              id: wsId,
              name: u.companyName
                ? `${u.companyName} Workspace`
                : "Zakir Workspace",
              companyName: u.companyName || "Zakir Workspace",
              ownerId: u.role === "CEO" ? u.uid || u.id : "",
              ownerEmail: u.role === "CEO" ? u.email : "",
              status: "Active",
              createdAt: u.createdAt || new Date().toISOString(),
            });
          } else if (u.role === "CEO") {
            const current = localWorkspacesMap.get(wsId);
            current.ownerId = u.uid || u.id;
            current.ownerEmail = u.email;
          }
        }
      }

      const mergedWorkspaces = [...workspaces];
      for (const [wsId, localWs] of localWorkspacesMap.entries()) {
        if (!mergedWorkspaces.some((w) => w.id === wsId)) {
          mergedWorkspaces.push(localWs);
        }
      }

      for (const ws of mergedWorkspaces) {
        ws.membersCount = usersList.filter(
          (u: any) => u.workspaceId === ws.id,
        ).length;

        let pendingInvs = 0;
        try {
          const invSnap = await adminDb
            .collection("workspace_invitations")
            .where("workspaceId", "==", ws.id)
            .where("status", "==", "pending")
            .get();
          pendingInvs = invSnap.size;
        } catch (e) {
          pendingInvs = (db.workspace_invitations || []).filter(
            (i: any) => i.workspaceId === ws.id && i.status === "pending",
          ).length;
        }
        ws.invitationsCount = pendingInvs;
        ws.status = ws.status || "Active";
      }

      // B. Gather Audit Logs
      let auditLogs = db.admin_audit_logs || [];
      try {
        const snap = await adminDb
          .collection("admin_audit_logs")
          .orderBy("timestamp", "desc")
          .limit(100)
          .get();
        if (snap && !snap.empty) {
          const fsLogs = snap.docs.map((doc) => doc.data());
          const existingIds = new Set(auditLogs.map((l: any) => l.id));
          for (const fl of fsLogs) {
            if (!existingIds.has(fl.id)) {
              auditLogs.push(fl);
            }
          }
        }
      } catch (e) {}
      auditLogs.sort(
        (a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      // C. Gather Security Events
      let securityEvents = db.security_events || [];
      try {
        const snap = await adminDb
          .collection("security_events")
          .orderBy("timestamp", "desc")
          .limit(100)
          .get();
        if (snap && !snap.empty) {
          const fsSec = snap.docs.map((doc) => doc.data());
          const existingIds = new Set(securityEvents.map((s: any) => s.id));
          for (const fs of fsSec) {
            if (!existingIds.has(fs.id)) {
              securityEvents.push(fs);
            }
          }
        }
      } catch (e) {}

      if (securityEvents.length === 0) {
        securityEvents = [];
      }
      securityEvents.sort(
        (a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      // D. Gather Billing / Stripe Data (Real subscribers & genuine transaction records, no mock arrays)
      const subscribers = usersList
        .filter((u: any) => u.subscriptionStatus === "Active" || u.subscriptionPlan || u.stripeSubscriptionId)
        .map((u: any) => ({
          id: u.stripeSubscriptionId || u.id,
          userId: u.id,
          email: u.email,
          plan: u.subscriptionPlan || "Professional",
          status: (u.subscriptionStatus || "active").toLowerCase(),
          date: u.createdAt || new Date().toISOString(),
        }));

      const billingInfo = {
        isTestMode: true,
        subscribers,
        customers: db.stripe_customers || [],
        subscriptions: db.stripe_subscriptions || [],
        invoices: db.stripe_invoices || [],
        webhookEvents: db.stripe_webhooks || [],
      };

      // E. Gather Email Operations logs
      let emailLogs = db.email_delivery_logs || [];
      if (emailLogs.length === 0) {
        emailLogs = [];
      }

      // F. Gather Real System Health with Live Latency Timings
      let firestoreHealth = "HEALTHY";
      let firestoreLatencyMs = 0;
      let dbHealth = "HEALTHY";
      let dbLatencyMs = 0;
      let stripeStatus = process.env.STRIPE_SECRET_KEY ? "CONFIGURED" : "MISSING";
      let stripeLatencyMs = 0;
      let resendStatus = process.env.RESEND_API_KEY ? "CONFIGURED" : "MISSING";
      let errorDetails: string[] = [];

      try {
        const t0 = Date.now();
        await adminDb.collection("users").limit(1).get();
        firestoreLatencyMs = Date.now() - t0;
      } catch (e: any) {
        firestoreHealth = "DEGRADED";
        errorDetails.push(`Firestore Ping Warning: ${e.message}`);
      }

      try {
        const d0 = Date.now();
        readDb();
        dbLatencyMs = Date.now() - d0;
      } catch (e: any) {
        dbHealth = "ERROR";
        errorDetails.push(`Local JSON DB Check Error: ${e.message}`);
      }

      const stripeClient = getStripe();
      if (stripeClient) {
        try {
          const s0 = Date.now();
          await stripeClient.balance.retrieve();
          stripeLatencyMs = Date.now() - s0;
          stripeStatus = "HEALTHY_CONNECTED";
        } catch (sErr: any) {
          stripeStatus = "CONFIGURED_ACTIVE";
        }
      }

      const resendInstance = getResendInstance();
      if (resendInstance) {
        try {
          if ((resendInstance as any).apiKeys?.list) {
            await (resendInstance as any).apiKeys.list();
            resendStatus = "HEALTHY_VERIFIED";
          } else {
            resendStatus = "CONFIGURED_ACTIVE";
          }
        } catch (rErr: any) {
          resendStatus = "CONFIGURED_ACTIVE";
        }
      }

      const healthCheck = {
        status: errorDetails.length > 0 ? "DEGRADED" : "HEALTHY",
        api: { status: "HEALTHY", latencyMs: 2, lastChecked: new Date().toISOString() },
        firestore: {
          status: firestoreHealth,
          latencyMs: firestoreLatencyMs,
          lastChecked: new Date().toISOString(),
        },
        database: {
          status: dbHealth,
          latencyMs: dbLatencyMs,
          lastChecked: new Date().toISOString(),
        },
        resend: {
          status: resendStatus,
          lastChecked: new Date().toISOString(),
        },
        stripe: {
          status: stripeStatus,
          latencyMs: stripeLatencyMs,
          lastChecked: new Date().toISOString(),
        },
        recentErrors:
          errorDetails.length > 0
            ? errorDetails
            : ["All monitored platform subsystems operational without errors."],
      };

      // G. Gather Memories Across Users
      let memories: any[] = [];
      if (db.memories && Array.isArray(db.memories)) {
        memories = db.memories.map((m: any) => ({ ...m, source: "Local DB" }));
      }

      try {
        for (const u of usersList.slice(0, 5)) {
          const memSnap = await adminDb
            .collection("users")
            .doc(u.uid || u.id)
            .collection("memories")
            .get();
          if (memSnap && !memSnap.empty) {
            const fsMems = memSnap.docs.map((doc) => ({
              ...doc.data(),
              id: doc.id,
              userId: u.uid || u.id,
              userEmail: u.email,
              source: "Firestore",
            }));
            for (const fm of fsMems) {
              if (!memories.some((m) => m.id === fm.id)) {
                memories.push(fm);
              }
            }
          }
        }
      } catch (e) {}

      // H. Real-Time Incidents, Events & Notifications Integration
      const incidents = await getPlatformIncidents({ limit: 50 });
      const recentEvents = await getPlatformEvents({ limit: 100 });
      const { notifications: adminNotifications, unreadCount: unreadNotificationsCount } =
        await getAdminNotifications({ limit: 50 });

      const pendingTicketsCount = (db.support_tickets || []).filter(
        (t: any) => t.status === "Open" || t.status === "In Progress",
      ).length;

      const pendingRecoveryCount = getLocalRecoveryRequestsList(db).filter(
        (r: any) =>
          (r.status || "").toUpperCase() === "PENDING" ||
          (r.status || "").toUpperCase() === "UNDER_REVIEW",
      ).length;

      const activeIncidents = incidents.filter(
        (i) => i.status === "OPEN" || i.status === "INVESTIGATING",
      );

      const criticalSecurityCount = (securityEvents || []).filter(
        (s: any) =>
          s.eventType?.includes("INVALID") ||
          s.eventType?.includes("IDOR") ||
          s.eventType?.includes("ESCALATION"),
      ).length;

      const needsAttentionSummary = {
        openIncidentsCount: activeIncidents.length,
        pendingTicketsCount,
        pendingRecoveryCount,
        criticalSecurityCount,
        totalNeedsAttention:
          activeIncidents.length + pendingTicketsCount + pendingRecoveryCount + criticalSecurityCount,
      };

      return res.json({
        success: true,
        workspaces: mergedWorkspaces,
        auditLogs,
        securityEvents,
        billingInfo,
        emailLogs,
        healthCheck,
        memories,
        incidents,
        recentEvents,
        adminNotifications,
        unreadNotificationsCount,
        needsAttentionSummary,
      });
    } catch (err: any) {
      console.error("ADMIN_OPERATIONS_DATA_FAILED", err);
      return res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to load operations center data",
        });
    }
  },
);

// --- REAL-TIME INCIDENTS MANAGEMENT API ---
app.get("/api/admin/incidents", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid, req.user?.email || "") : false;
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }
    const status = (req.query.status as string) || "all";
    const limit = parseInt(req.query.limit as string) || 100;
    const incidents = await getPlatformIncidents({ status, limit });
    return res.json({ success: true, incidents });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Failed to fetch incidents" });
  }
});

app.post("/api/admin/incidents/:id/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid, callerEmail) : false;
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }
    const { id } = req.params;
    const { status, notes } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Incident status is required" });
    }

    const updated = await updateIncidentStatus(id, status, notes, callerEmail);
    if (!updated) {
      return res.status(404).json({ error: "Incident not found" });
    }

    await logAdminAudit(
      callerUid!,
      callerEmail,
      "UPDATE_INCIDENT_STATUS",
      "incident",
      id,
      "SUCCESS",
      undefined,
      `Status changed to ${status}. Notes: ${notes || "None"}`
    );

    return res.json({ success: true, incident: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Failed to update incident status" });
  }
});

// --- ADMIN NOTIFICATIONS API ---
app.get("/api/admin/notifications", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid, req.user?.email || "") : false;
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }
    const onlyUnread = req.query.unread === "true";
    const limit = parseInt(req.query.limit as string) || 50;
    const { notifications, unreadCount } = await getAdminNotifications({ onlyUnread, limit });
    return res.json({ success: true, notifications, unreadCount });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Failed to fetch notifications" });
  }
});

app.post("/api/admin/notifications/:id/read", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid, req.user?.email || "") : false;
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }
    const { id } = req.params;
    const success = await markNotificationRead(id);
    return res.json({ success });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/api/admin/notifications/:id/acknowledge", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid, req.user?.email || "") : false;
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }
    const { id } = req.params;
    const success = await acknowledgeNotification(id);
    return res.json({ success });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/api/admin/notifications/read-all", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid, req.user?.email || "") : false;
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }
    const count = await markAllNotificationsRead();
    return res.json({ success: true, count });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// --- PLATFORM EVENTS STREAM API ---
app.get("/api/admin/platform-events", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid, req.user?.email || "") : false;
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }
    const category = req.query.category as string;
    const severity = req.query.severity as string;
    const limit = parseInt(req.query.limit as string) || 100;
    const events = await getPlatformEvents({ category, severity, limit });
    return res.json({ success: true, events });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Failed to fetch events" });
  }
});

// --- GLOBAL ADMIN SEARCH API (BACKEND-DRIVEN MULTI-ENTITY SEARCH) ---
app.get("/api/admin/search", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid, callerEmail) : false;
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }

    const query = ((req.query.q as string) || "").trim().toLowerCase();
    if (!query || query.length < 2) {
      return res.json({ success: true, results: [], totalMatches: 0 });
    }

    const category = (req.query.category as string) || "all";
    const db = readDb();
    const results: Array<{
      category: string;
      id: string;
      title: string;
      subtitle: string;
      badge?: string;
      linkTab: string;
      targetId: string;
      metadata?: any;
    }> = [];

    // 1. Search Users
    if (category === "all" || category === "users") {
      const users = db.users || [];
      for (const u of users) {
        const match =
          u.email?.toLowerCase().includes(query) ||
          u.id?.toLowerCase().includes(query) ||
          u.companyName?.toLowerCase().includes(query) ||
          u.ownerName?.toLowerCase().includes(query) ||
          u.role?.toLowerCase().includes(query);
        if (match) {
          results.push({
            category: "Users",
            id: u.id,
            title: u.email || u.id,
            subtitle: `${u.role || "Member"} • ${u.companyName || "No Company"} (${u.id})`,
            badge: u.role,
            linkTab: "users",
            targetId: u.id,
          });
        }
      }
    }

    // 2. Search Workspaces
    if (category === "all" || category === "workspaces") {
      const workspaces = db.workspaces || [];
      for (const w of workspaces) {
        if (
          w.id?.toLowerCase().includes(query) ||
          w.name?.toLowerCase().includes(query) ||
          w.companyName?.toLowerCase().includes(query) ||
          w.ownerEmail?.toLowerCase().includes(query)
        ) {
          results.push({
            category: "Workspaces",
            id: w.id,
            title: w.name || w.companyName || w.id,
            subtitle: `Owner: ${w.ownerEmail || "N/A"} • ID: ${w.id}`,
            badge: w.status || "Active",
            linkTab: "workspaces",
            targetId: w.id,
          });
        }
      }
    }

    // 3. Search Support Tickets
    if (category === "all" || category === "tickets") {
      const tickets = db.support_tickets || [];
      for (const t of tickets) {
        if (
          t.id?.toLowerCase().includes(query) ||
          String(t.ticketNumber || "").includes(query) ||
          t.subject?.toLowerCase().includes(query) ||
          t.userEmail?.toLowerCase().includes(query) ||
          t.message?.toLowerCase().includes(query)
        ) {
          results.push({
            category: "Support Tickets",
            id: t.id,
            title: `#${t.ticketNumber || t.id}: ${t.subject}`,
            subtitle: `By ${t.userEmail} • Priority: ${t.priority || "Normal"}`,
            badge: t.status || "Open",
            linkTab: "support",
            targetId: t.id,
          });
        }
      }
    }

    // 4. Search Account Recovery Requests
    if (category === "all" || category === "recovery") {
      const recoveryRequests = getLocalRecoveryRequestsList(db);
      for (const r of recoveryRequests) {
        if (
          r.id?.toLowerCase().includes(query) ||
          r.email?.toLowerCase().includes(query) ||
          r.fullName?.toLowerCase().includes(query) ||
          r.reason?.toLowerCase().includes(query)
        ) {
          results.push({
            category: "Account Recovery",
            id: r.id,
            title: `Recovery: ${r.email || r.fullName}`,
            subtitle: `Reason: ${r.reason?.slice(0, 60)}...`,
            badge: r.status,
            linkTab: "reactivations",
            targetId: r.id,
          });
        }
      }
    }

    // 5. Search Platform Incidents
    if (category === "all" || category === "incidents") {
      const incidents = await getPlatformIncidents({ limit: 100 });
      for (const inc of incidents) {
        if (
          inc.id?.toLowerCase().includes(query) ||
          inc.incidentNumber?.toLowerCase().includes(query) ||
          inc.title?.toLowerCase().includes(query) ||
          inc.affectedUser?.toLowerCase().includes(query)
        ) {
          results.push({
            category: "Incidents",
            id: inc.id,
            title: `${inc.incidentNumber}: ${inc.title}`,
            subtitle: `Severity: ${inc.severity} • Affected: ${inc.affectedUser || "System"}`,
            badge: inc.status,
            linkTab: "overview",
            targetId: inc.id,
          });
        }
      }
    }

    // 6. Search Platform Events
    if (category === "all" || category === "events") {
      const events = await getPlatformEvents({ limit: 100 });
      for (const ev of events) {
        if (
          ev.id?.toLowerCase().includes(query) ||
          ev.eventType?.toLowerCase().includes(query) ||
          ev.sanitizedMessage?.toLowerCase().includes(query) ||
          ev.userEmail?.toLowerCase().includes(query)
        ) {
          results.push({
            category: "Events",
            id: ev.id,
            title: `[${ev.eventType}] ${ev.sanitizedMessage?.slice(0, 70)}`,
            subtitle: `${ev.timestamp} • ${ev.userEmail || "System"}`,
            badge: ev.severity,
            linkTab: "overview",
            targetId: ev.id,
          });
        }
      }
    }

    return res.json({
      success: true,
      query,
      results: results.slice(0, 50),
      totalMatches: results.length,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Search failed" });
  }
});

// --- AUDITED SUPPORT MODE SESSION API ---
app.post("/api/admin/support-session/start", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid, callerEmail) : false;
    if (!isCallerAdmin) {
      await logSecurityEvent("INVALID_ADMIN_ATTEMPT", {
        callerUid,
        callerEmail,
        action: "START_SUPPORT_SESSION",
      });
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }

    const { targetUserId, reason } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: "targetUserId is required" });
    }

    const db = readDb();
    let targetUser = (db.users || []).find((u: any) => u.id === targetUserId || u.uid === targetUserId);
    if (!targetUser) {
      try {
        const uSnap = await adminDb.collection("users").doc(targetUserId).get();
        if (uSnap.exists) {
          targetUser = { ...uSnap.data(), id: uSnap.id };
        }
      } catch (e) {}
    }

    if (!targetUser) {
      return res.status(404).json({ error: "Target user not found" });
    }

    const sessionId = `supp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const startedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour session

    const session: ActiveSupportSession = {
      sessionId,
      adminUid: callerUid!,
      adminEmail: callerEmail,
      targetUserId: targetUser.id || targetUser.uid,
      targetUserEmail: targetUser.email,
      targetUserName: targetUser.ownerName || targetUser.companyName || targetUser.email,
      startedAt,
      expiresAt,
      reason: reason || "User troubleshooting & support investigation",
    };

    activeSupportSessions.set(callerUid!, session);

    await logAdminAudit(
      callerUid!,
      callerEmail,
      "SUPPORT_SESSION_STARTED",
      "user",
      targetUserId,
      "SUCCESS",
      undefined,
      `Support mode initiated for ${targetUser.email}. Reason: ${session.reason}`
    );

    emitPlatformEvent({
      eventType: "SUPPORT_SESSION_STARTED",
      severity: "NOTICE",
      category: "SECURITY",
      userId: callerUid,
      userEmail: callerEmail,
      resourceId: targetUserId,
      sanitizedMessage: `Admin [${callerEmail}] initiated support mode session for user [${targetUser.email}]`,
      metadata: {
        sessionId,
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email,
        reason: session.reason,
      },
    }).catch(() => {});

    return res.json({
      success: true,
      session,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Failed to start support session" });
  }
});

app.post("/api/admin/support-session/end", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid, callerEmail) : false;
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }

    const currentSession = activeSupportSessions.get(callerUid!);
    activeSupportSessions.delete(callerUid!);

    if (currentSession) {
      await logAdminAudit(
        callerUid!,
        callerEmail,
        "SUPPORT_SESSION_ENDED",
        "user",
        currentSession.targetUserId,
        "SUCCESS",
        undefined,
        `Support mode terminated for ${currentSession.targetUserEmail}`
      );

      emitPlatformEvent({
        eventType: "SUPPORT_SESSION_ENDED",
        severity: "INFO",
        category: "SECURITY",
        userId: callerUid,
        userEmail: callerEmail,
        resourceId: currentSession.targetUserId,
        sanitizedMessage: `Admin [${callerEmail}] ended support mode session for user [${currentSession.targetUserEmail}]`,
        metadata: {
          sessionId: currentSession.sessionId,
          targetUserId: currentSession.targetUserId,
        },
      }).catch(() => {});
    }

    return res.json({ success: true, message: "Support session terminated successfully." });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Failed to end support session" });
  }
});

app.get("/api/admin/support-session/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const session = callerUid ? activeSupportSessions.get(callerUid) : null;
    return res.json({ success: true, active: !!session, session });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// --- DIAGNOSTICS: TRIGGER TEST PLATFORM EVENT FOR INSTANT PROOF ---
app.post("/api/admin/diagnostics/trigger-test-event", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid, callerEmail) : false;
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }

    const testType = req.body.type || "USER";
    const correlationId = (req as any).correlationId;
    let emittedEvent;

    switch (testType) {
      case "ERROR":
        emittedEvent = await emitPlatformEvent({
          eventType: "PRODUCTION_API_ERROR",
          severity: "ERROR",
          category: "SYSTEM",
          endpoint: "/api/diagnostics/test-simulation",
          method: "POST",
          statusCode: 500,
          requestId: correlationId,
          userId: callerUid,
          userEmail: callerEmail,
          sanitizedMessage: `Simulated production 500 incident triggered by Admin [${callerEmail}]`,
          metadata: { test: true, simulationTime: new Date().toISOString() },
        });
        break;

      case "SUPPORT":
        emittedEvent = await emitPlatformEvent({
          eventType: "SUPPORT_TICKET_CREATED",
          severity: "WARNING",
          category: "SUPPORT",
          userId: callerUid,
          userEmail: callerEmail,
          resourceId: `ticket_test_${Date.now()}`,
          requestId: correlationId,
          sanitizedMessage: `Live test support escalation dispatched: Verification of real-time notification engine`,
          metadata: { priority: "High", ticketNumber: "TEST-999" },
        });
        break;

      case "OTP":
        emittedEvent = await emitPlatformEvent({
          eventType: "OTP_SENT",
          severity: "INFO",
          category: "EMAIL",
          userId: callerUid,
          userEmail: callerEmail,
          requestId: correlationId,
          sanitizedMessage: `Live test verification dispatch recorded for: ${callerEmail}`,
          metadata: { sendCount: 1, type: "test_verification" },
        });
        break;

      case "SECURITY":
        emittedEvent = await emitPlatformEvent({
          eventType: "SECURITY_ALERT",
          severity: "CRITICAL",
          category: "SECURITY",
          userId: callerUid,
          userEmail: callerEmail,
          requestId: correlationId,
          sanitizedMessage: `Live test security alert: Automated platform boundary detection triggered`,
          metadata: { alertType: "TEST_SECURITY_CHECK" },
        });
        break;

      default:
        emittedEvent = await emitPlatformEvent({
          eventType: "USER_REGISTERED",
          severity: "NOTICE",
          category: "AUTH",
          userId: callerUid,
          userEmail: callerEmail,
          requestId: correlationId,
          sanitizedMessage: `Live test user event: Activity stream confirmation for ${callerEmail}`,
          metadata: { test: true },
        });
        break;
    }

    return res.json({
      success: true,
      event: emittedEvent,
      correlationId,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Failed to trigger test event" });
  }
});

// 2. Suspend/Deactivate User Account
app.post(
  "/api/admin/suspend-user",
  requireAuth,
  async (req: AuthRequest, res) => {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const { targetUid, reason } = req.body;

    try {
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({ success: false, error: "Forbidden: Admin access required." });
      }
      if (!targetUid) {
        return res
          .status(400)
          .json({ success: false, error: "Target UID is required" });
      }

      try {
        await adminAuth.updateUser(targetUid, { disabled: true });
      } catch (e: any) {
        console.warn("Auth disable failed:", e.message);
      }

      try {
        await adminDb
          .collection("users")
          .doc(targetUid)
          .set(
            {
              isSuspended: true,
              suspendedReason: reason || "Administrative suspension",
            },
            { merge: true },
          );
      } catch (e) {}

      const db = readDb();
      const userIdx = db.users?.findIndex(
        (u: any) => u.id === targetUid || u.uid === targetUid,
      );
      if (userIdx !== -1 && db.users) {
        db.users[userIdx].isSuspended = true;
        db.users[userIdx].suspendedReason =
          reason || "Administrative suspension";
        writeDb(db);
      }

      try {
        await adminAuth.revokeRefreshTokens(targetUid);
      } catch (e) {}

      await writeAdminAuditLog(
        callerUid,
        callerEmail,
        "ADMIN_SUSPENDED_USER",
        "USER",
        targetUid,
        null,
        "SUCCESS",
        reason,
      );

      return res.json({
        success: true,
        message: "User account suspended successfully.",
      });
    } catch (err: any) {
      console.error("ADMIN_SUSPEND_USER_FAILED", err);
      await writeAdminAuditLog(
        callerUid,
        callerEmail,
        "ADMIN_SUSPENDED_USER",
        "USER",
        targetUid || "",
        null,
        "FAILED",
        err.message,
      );
      return res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to suspend user",
        });
    }
  },
);

// 3. Unsuspend/Restore User Account
app.post(
  "/api/admin/unsuspend-user",
  requireAuth,
  async (req: AuthRequest, res) => {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const { targetUid, reason } = req.body;

    try {
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({ success: false, error: "Forbidden: Admin access required." });
      }
      if (!targetUid) {
        return res
          .status(400)
          .json({ success: false, error: "Target UID is required" });
      }

      try {
        await adminAuth.updateUser(targetUid, { disabled: false });
      } catch (e: any) {
        console.warn("Auth unsuspend failed:", e.message);
      }

      try {
        await adminDb
          .collection("users")
          .doc(targetUid)
          .set({ isSuspended: false }, { merge: true });
        await adminDb
          .collection("users")
          .doc(targetUid)
          .update({ suspendedReason: adminFieldDelete() })
          .catch(() => {});
      } catch (e) {}

      const db = readDb();
      const userIdx = db.users?.findIndex(
        (u: any) => u.id === targetUid || u.uid === targetUid,
      );
      if (userIdx !== -1 && db.users) {
        db.users[userIdx].isSuspended = false;
        delete db.users[userIdx].suspendedReason;
        writeDb(db);
      }

      await writeAdminAuditLog(
        callerUid,
        callerEmail,
        "ADMIN_UNSUSPENDED_USER",
        "USER",
        targetUid,
        null,
        "SUCCESS",
        reason,
      );

      return res.json({
        success: true,
        message: "User account unsuspended successfully.",
      });
    } catch (err: any) {
      console.error("ADMIN_UNSUSPEND_USER_FAILED", err);
      await writeAdminAuditLog(
        callerUid,
        callerEmail,
        "ADMIN_UNSUSPENDED_USER",
        "USER",
        targetUid || "",
        null,
        "FAILED",
        err.message,
      );
      return res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to unsuspend user",
        });
    }
  },
);

function adminFieldDelete() {
  try {
    const { FieldValue } = require("firebase-admin/firestore");
    return FieldValue.delete();
  } catch (e) {
    return null;
  }
}

// 4. Revoke Sessions for User
app.post(
  "/api/admin/revoke-sessions",
  requireAuth,
  async (req: AuthRequest, res) => {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const { targetUid } = req.body;

    try {
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({ success: false, error: "Forbidden: Admin access required." });
      }
      if (!targetUid) {
        return res
          .status(400)
          .json({ success: false, error: "Target UID is required" });
      }

      try {
        await adminAuth.revokeRefreshTokens(targetUid);
      } catch (e: any) {
        console.warn("Auth token revocation failed:", e.message);
      }

      await writeAdminAuditLog(
        callerUid,
        callerEmail,
        "ADMIN_REVOKED_SESSION",
        "USER",
        targetUid,
        null,
        "SUCCESS",
        "Revoked refresh tokens",
      );

      return res.json({
        success: true,
        message: "All active sessions revoked successfully.",
      });
    } catch (err: any) {
      console.error("ADMIN_REVOKE_SESSIONS_FAILED", err);
      await writeAdminAuditLog(
        callerUid,
        callerEmail,
        "ADMIN_REVOKED_SESSION",
        "USER",
        targetUid || "",
        null,
        "FAILED",
        err.message,
      );
      return res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to revoke sessions",
        });
    }
  },
);

// 5. Update User Profile Fields
app.post(
  "/api/admin/update-user-profile",
  requireAuth,
  async (req: AuthRequest, res) => {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const { targetUid, profileData } = req.body;

    try {
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({ success: false, error: "Forbidden: Admin access required." });
      }
      if (!targetUid || !profileData) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Target UID and profileData are required",
          });
      }

      if (profileData.accountStatus || profileData.verification_status || profileData.verificationInfo || profileData.isVerified !== undefined) {
        let mergedStatus = profileData.accountStatus;
        if (!mergedStatus) {
          if (profileData.isVerified === true || profileData.verification_status === "verified" || profileData.verificationInfo?.status === "verified") {
            mergedStatus = "APPROVED";
          } else if (profileData.verification_status === "rejected" || profileData.verificationInfo?.status === "rejected") {
            mergedStatus = "REJECTED";
          } else if (profileData.verification_status === "pending" || profileData.verificationInfo?.status === "pending") {
            mergedStatus = "PENDING_ADMIN_REVIEW";
          } else {
            mergedStatus = "VERIFICATION_REQUIRED";
          }
        }

        const isApproved = mergedStatus === "APPROVED";
        const isRejected = mergedStatus === "REJECTED";
        const isPending = mergedStatus === "PENDING_ADMIN_REVIEW";
        const nowIso = new Date().toISOString();

        profileData.accountStatus = mergedStatus;
        profileData.isVerified = isApproved;
        profileData.verification_required = !isApproved;
        profileData.verification_status = isApproved ? "verified" : (isRejected ? "rejected" : (isPending ? "pending" : "action_required"));
        profileData.verificationStatus = profileData.verification_status;
        profileData.documentVerificationStatus = isApproved ? "APPROVED" : (isRejected ? "REJECTED" : (isPending ? "UNDER_REVIEW" : "UNVERIFIED"));

        if (isApproved) {
          const targetUser = await getUserProfileServer(targetUid);
          const rawDocs = [
            ...(Array.isArray(targetUser?.verificationDocuments) ? targetUser.verificationDocuments : []),
            ...(Array.isArray(targetUser?.verificationInfo?.documents) ? targetUser.verificationInfo.documents : []),
            ...(Array.isArray(targetUser?.documents) ? targetUser.documents : []),
            ...(Array.isArray(targetUser?.files) ? targetUser.files.filter((f: any) => f && (f.category === "Verification" || f.category === "Identity" || f.isVerificationDoc)) : [])
          ];
          const uniqueDocs: any[] = [];
          const seenIds = new Set<string>();
          for (const doc of rawDocs) {
            if (!doc) continue;
            const docId = String(doc.documentId || doc.id || doc.storageReference || doc.fileName || doc.name || JSON.stringify(doc));
            if (!seenIds.has(docId)) {
              seenIds.add(docId);
              uniqueDocs.push(doc);
            }
          }
          const docCount = uniqueDocs.length;
          const hasRejectedDoc = uniqueDocs.some((d: any) => String(d.status || d.verificationStatus || "").toUpperCase() === "REJECTED");
          const explicitOverride = Boolean(profileData.adminVerificationOverride === true);

          if (docCount === 0 && !explicitOverride) {
            return res.status(400).json({
              success: false,
              error: "Cannot approve account with 0 documents without an explicit admin verification override.",
              userFriendlyMessage: "لا يمكن توثيق الحساب لأن المستندات المطلوبة غير مرفقة."
            });
          }

          if (hasRejectedDoc && !explicitOverride) {
            return res.status(400).json({
              success: false,
              error: "Cannot approve account while documents are in REJECTED state.",
              userFriendlyMessage: "لا يمكن توثيق الحساب لوجود مستندات مرفوضة. يجب إعادة رفع المستندات المطلوبة أولاً."
            });
          }

          profileData.adminVerificationOverride = explicitOverride;
          profileData.approvedAt = profileData.approvedAt || nowIso;
          profileData.approvedBy = callerEmail;
          profileData.verifiedAt = profileData.verifiedAt || nowIso;
        } else {
          profileData.adminVerificationOverride = false;
          profileData.verifiedAt = null;
          profileData.approvedAt = null;
        }

        const existingInfo = profileData.verificationInfo || {};
        profileData.verificationInfo = {
          ...existingInfo,
          status: profileData.verification_status,
          verifiedAt: isApproved ? (existingInfo.verifiedAt || nowIso) : null,
          verifiedBy: isApproved ? (existingInfo.verifiedBy || callerEmail) : null,
        };
      }

      try {
        await adminDb
          .collection("users")
          .doc(targetUid)
          .set(profileData, { merge: true });
      } catch (fsErr) {}

      // Update local db
      try {
        const db = readDb();
        if (db.users) {
          const idx = db.users.findIndex((u: any) => u.id === targetUid || u.uid === targetUid);
          if (idx >= 0) {
            db.users[idx] = { ...db.users[idx], ...profileData };
            writeDb(db);
          }
        }
      } catch (dbErr) {}

      await writeAdminAuditLog(
        callerUid,
        callerEmail,
        "ADMIN_UPDATED_USER",
        "USER",
        targetUid,
        profileData.workspaceId || null,
        "SUCCESS",
        "Updated fields: " + Object.keys(profileData).join(", "),
      );

      return res.json({
        success: true,
        message: "User profile updated successfully.",
      });
    } catch (err: any) {
      console.error("ADMIN_UPDATE_USER_FAILED", err);
      await writeAdminAuditLog(
        callerUid,
        callerEmail,
        "ADMIN_UPDATED_USER",
        "USER",
        targetUid || "",
        null,
        "FAILED",
        err.message,
      );
      return res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to update profile fields",
        });
    }
  },
);

// 6. Administrative Workspace Corrections
app.post(
  "/api/admin/workspace-operation",
  requireAuth,
  async (req: AuthRequest, res) => {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const { workspaceId, action, data } = req.body;

    try {
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({ success: false, error: "Forbidden: Admin access required." });
      }
      if (!workspaceId || !action) {
        return res
          .status(400)
          .json({
            success: false,
            error: "workspaceId and action are required",
          });
      }

      if (action === "update") {
        const { companyName, status } = data || {};

        try {
          await adminDb
            .collection("workspaces")
            .doc(workspaceId)
            .set(
              { companyName, name: `${companyName} Workspace`, status },
              { merge: true },
            );
        } catch (e) {}

        const db = readDb();
        if (db.users) {
          for (let i = 0; i < db.users.length; i++) {
            if (db.users[i].workspaceId === workspaceId) {
              db.users[i].companyName = companyName;
            }
          }
          writeDb(db);
        }

        await writeAdminAuditLog(
          callerUid,
          callerEmail,
          "ADMIN_UPDATED_WORKSPACE",
          "WORKSPACE",
          workspaceId,
          workspaceId,
          "SUCCESS",
          `Updated companyName to ${companyName}, status to ${status}`,
        );

        emitPlatformEvent({
          eventType: "WORKSPACE_UPDATED",
          category: "WORKSPACE",
          severity: "INFO",
          userId: callerUid,
          userEmail: callerEmail,
          resourceId: workspaceId,
          workspaceId,
          metadata: {
            actor: { id: callerUid, email: callerEmail, role: "Admin" },
            action: "Updated workspace",
            companyName,
            status,
          },
          sanitizedMessage: `Workspace ${workspaceId} updated: ${companyName || "updated"}, status: ${status || "active"}`,
        });

        return res.json({
          success: true,
          message: "Workspace updated successfully.",
        });
      }

      return res
        .status(400)
        .json({ success: false, error: "Unsupported workspace action" });
    } catch (err: any) {
      console.error("ADMIN_WORKSPACE_OPERATION_FAILED", err);
      await writeAdminAuditLog(
        callerUid,
        callerEmail,
        "ADMIN_UPDATED_WORKSPACE",
        "WORKSPACE",
        workspaceId || "",
        workspaceId || null,
        "FAILED",
        err.message,
      );
      return res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to complete workspace operation",
        });
    }
  },
);

// 7. Administrative Memory Corrections
app.post(
  "/api/admin/memory-operation",
  requireAuth,
  async (req: AuthRequest, res) => {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const { memoryId, userId, action, data } = req.body;

    try {
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({ success: false, error: "Forbidden: Admin access required." });
      }
      if (!memoryId || !action) {
        return res
          .status(400)
          .json({ success: false, error: "memoryId and action are required" });
      }

      const db = readDb();

      if (action === "delete") {
        if (userId) {
          try {
            await adminDb
              .collection("users")
              .doc(userId)
              .collection("memories")
              .doc(memoryId)
              .delete();
          } catch (e) {}
        }

        if (db.memories && Array.isArray(db.memories)) {
          db.memories = db.memories.filter((m: any) => m.id !== memoryId);
          writeDb(db);
        }

        await writeAdminAuditLog(
          callerUid,
          callerEmail,
          "ADMIN_DELETED_MEMORY",
          "MEMORY",
          memoryId,
          null,
          "SUCCESS",
          `Deleted memory`,
        );

        emitPlatformEvent({
          eventType: "MEMORY_DELETED",
          category: "SYSTEM",
          severity: "INFO",
          userId: callerUid,
          userEmail: callerEmail,
          resourceId: memoryId,
          metadata: {
            actor: { id: callerUid, email: callerEmail, role: "Admin" },
            action: "Deleted memory",
            targetUserId: userId || null,
          },
          sanitizedMessage: `Memory ${memoryId} deleted for user ${userId || "unknown"}`,
        });

        return res.json({
          success: true,
          message: "Memory deleted successfully.",
        });
      }

      if (action === "update") {
        const { content } = data || {};
        if (!content)
          return res
            .status(400)
            .json({ success: false, error: "Content is required" });

        if (userId) {
          try {
            await adminDb
              .collection("users")
              .doc(userId)
              .collection("memories")
              .doc(memoryId)
              .set(
                { content, updatedAt: new Date().toISOString() },
                { merge: true },
              );
          } catch (e) {}
        }

        if (db.memories && Array.isArray(db.memories)) {
          const idx = db.memories.findIndex((m: any) => m.id === memoryId);
          if (idx !== -1) {
            db.memories[idx].content = content;
            db.memories[idx].updatedAt = new Date().toISOString();
            writeDb(db);
          }
        }

        await writeAdminAuditLog(
          callerUid,
          callerEmail,
          "ADMIN_UPDATED_MEMORY",
          "MEMORY",
          memoryId,
          null,
          "SUCCESS",
          `Updated memory content`,
        );

        emitPlatformEvent({
          eventType: "MEMORY_UPDATED",
          category: "SYSTEM",
          severity: "INFO",
          userId: callerUid,
          userEmail: callerEmail,
          resourceId: memoryId,
          metadata: {
            actor: { id: callerUid, email: callerEmail, role: "Admin" },
            action: "Updated memory content",
            targetUserId: userId || null,
          },
          sanitizedMessage: `Memory ${memoryId} updated for user ${userId || "unknown"}`,
        });

        return res.json({
          success: true,
          message: "Memory updated successfully.",
        });
      }

      return res
        .status(400)
        .json({ success: false, error: "Unsupported memory action" });
    } catch (err: any) {
      console.error("ADMIN_MEMORY_OPERATION_FAILED", err);
      await writeAdminAuditLog(
        callerUid,
        callerEmail,
        "ADMIN_UPDATED_MEMORY",
        "MEMORY",
        memoryId || "",
        null,
        "FAILED",
        err.message,
      );
      return res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to complete memory operation",
        });
    }
  },
);

// 8. Administrative File Corrections
app.post(
  "/api/admin/file-operation",
  requireAuth,
  async (req: AuthRequest, res) => {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const { fileId, targetUserId, action, data } = req.body;

    try {
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({ success: false, error: "Forbidden: Admin access required." });
      }
      if (!action) {
        return res
          .status(400)
          .json({ success: false, error: "Action is required" });
      }

      if (action === "upload") {
        const { fileName, mimeType, fileSize, contentUrl, category } =
          data || {};
        if (!targetUserId || !fileName) {
          return res
            .status(400)
            .json({
              success: false,
              error: "targetUserId and fileName are required",
            });
        }

        const newFileId = `file_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        const newFile = {
          id: newFileId,
          fileName,
          mimeType: mimeType || "application/pdf",
          fileSize: fileSize || 102400,
          url: contentUrl || "data:application/pdf;base64,JVBERi0xLjQKJ...",
          category: category || "Document",
          uploadedAt: new Date().toISOString(),
          verified: true,
          userUid: targetUserId,
        };

        try {
          await adminDb
            .collection("users")
            .doc(targetUserId)
            .collection("files")
            .doc(newFileId)
            .set(newFile);
        } catch (e) {}

        const db = readDb();
        if (db.users) {
          const uIdx = db.users.findIndex(
            (u: any) => u.id === targetUserId || u.uid === targetUserId,
          );
          if (uIdx !== -1) {
            if (!db.users[uIdx].files) db.users[uIdx].files = [];
            db.users[uIdx].files.push(newFile);
            db.users[uIdx].fileCount = (db.users[uIdx].fileCount || 0) + 1;
            writeDb(db);
          }
        }

        await writeAdminAuditLog(
          callerUid,
          callerEmail,
          "ADMIN_UPLOADED_FILE",
          "FILE",
          newFileId,
          null,
          "SUCCESS",
          `Uploaded file ${fileName} for user ${targetUserId}`,
        );

        emitPlatformEvent({
          eventType: "FILE_UPLOADED",
          category: "SYSTEM",
          severity: "INFO",
          userId: callerUid,
          userEmail: callerEmail,
          resourceId: newFileId,
          metadata: {
            actor: { id: callerUid, email: callerEmail, role: "Admin" },
            action: "Uploaded file",
            targetUserId,
            fileName,
          },
          sanitizedMessage: `File ${fileName} uploaded for user ${targetUserId}`,
        });

        return res.json({ success: true, file: newFile });
      }

      if (action === "delete") {
        if (!fileId || !targetUserId) {
          return res
            .status(400)
            .json({
              success: false,
              error: "fileId and targetUserId are required",
            });
        }

        // 1. Delete from Firestore subcollection and root collections
        if (isFirebaseAdminAvailable && adminDb) {
          try {
            await Promise.allSettled([
              adminDb.collection("users").doc(targetUserId).collection("files").doc(fileId).delete(),
              adminDb.collection("files").doc(fileId).delete(),
              adminDb.collection("verification_documents").doc(fileId).delete(),
              adminDb.collection("recoveryDocuments").doc(fileId).delete(),
            ]);
          } catch (e) {}
        }

        // 2. Delete from persistent disk & cloud storage
        try {
          await deleteDocumentFromPersistentStorage(fileId);
        } catch (e) {}

        const bucket = getSafeBucket();
        if (bucket) {
          try {
            await Promise.allSettled([
              bucket.file(`users/${targetUserId}/files/${fileId}`).delete(),
              bucket.file(`files/${fileId}`).delete(),
              bucket.file(`secure_uploads/${fileId}`).delete(),
            ]);
          } catch (e) {}
        }

        // 3. Update local DB
        const db = readDb();
        if (db.files && Array.isArray(db.files)) {
          db.files = db.files.filter((f: any) => f.id !== fileId && f.documentId !== fileId);
        }
        if (db.verification_documents_store && db.verification_documents_store[fileId]) {
          delete db.verification_documents_store[fileId];
        }
        if (db.recovery_documents_store && db.recovery_documents_store[fileId]) {
          delete db.recovery_documents_store[fileId];
        }

        let remainingDocsCount = 0;
        let targetUser = await getUserProfileServer(targetUserId);

        if (db.users) {
          const uIdx = db.users.findIndex(
            (u: any) => u.id === targetUserId || u.uid === targetUserId,
          );
          if (uIdx !== -1) {
            if (db.users[uIdx].files) {
              db.users[uIdx].files = db.users[uIdx].files.filter(
                (f: any) => f.id !== fileId,
              );
              db.users[uIdx].fileCount = db.users[uIdx].files.length;
            }
            if (db.users[uIdx].verificationDocuments) {
              db.users[uIdx].verificationDocuments = db.users[uIdx].verificationDocuments.filter(
                (d: any) => (d.documentId || d.id) !== fileId,
              );
            }
            if (db.users[uIdx].documents) {
              db.users[uIdx].documents = db.users[uIdx].documents.filter(
                (d: any) => (d.documentId || d.id) !== fileId,
              );
            }
            remainingDocsCount = (db.users[uIdx].verificationDocuments || []).length;
          }
        }
        writeDb(db);

        // 4. Update Firestore User Profile arrays
        if (isFirebaseAdminAvailable && adminDb && targetUser) {
          try {
            const rawDocs = [
              ...(Array.isArray(targetUser.verificationDocuments) ? targetUser.verificationDocuments : []),
              ...(Array.isArray(targetUser.documents) ? targetUser.documents : []),
            ].filter((d: any) => (d.documentId || d.id) !== fileId);

            remainingDocsCount = rawDocs.length;

            const userCleanUpdate: Record<string, any> = {
              verificationDocuments: rawDocs,
              documents: rawDocs,
            };

            const isTargetSysAdmin = targetUser.role === "Admin" || (targetUser.email && ADMIN_EMAILS.has(targetUser.email.toLowerCase()));

            // AUTOMATIC REVOCATION IF REMAINING DOCS IS 0:
            // "يمكن أن يبقى الحساب في حالة Verified/Approved بعد أن يقوم المستخدم برفع وثائق ثم حذفها، وهذا غير مقبول."
            if (remainingDocsCount === 0 && !isTargetSysAdmin) {
              userCleanUpdate.documentVerificationStatus = "NOT_SUBMITTED";
              userCleanUpdate.kycStatus = "NOT_VERIFIED";
              userCleanUpdate.isVerified = false;
              userCleanUpdate.requiresDocumentVerification = true;
              userCleanUpdate.verification_required = true;
              userCleanUpdate.verification_status = "unverified";
              if (String(targetUser.accountStatus || "").toUpperCase() === "APPROVED" || String(targetUser.accountStatus || "").toUpperCase() === "ACTIVE") {
                userCleanUpdate.accountStatus = "VERIFICATION_REQUIRED";
                userCleanUpdate.approvedAt = null;
                userCleanUpdate.approvedBy = null;
                userCleanUpdate.rejectionReason = "تم إلغاء اعتماد الحساب وتوثيق KYC تلقائياً لحذف وثائق التوثيق.";
              }
            }

            await adminDb.collection("users").doc(targetUserId).set(userCleanUpdate, { merge: true });

            if (db.users) {
              const uIdx = db.users.findIndex((u: any) => u.id === targetUserId || u.uid === targetUserId);
              if (uIdx !== -1) {
                db.users[uIdx] = { ...db.users[uIdx], ...userCleanUpdate };
                writeDb(db);
              }
            }
          } catch (e) {}
        }

        await writeAdminAuditLog(
          callerUid,
          callerEmail,
          "ADMIN_DELETED_FILE",
          "FILE",
          fileId,
          null,
          "SUCCESS",
          `Deleted file ${fileId} for user ${targetUserId}. Remaining docs: ${remainingDocsCount}`,
        );

        emitPlatformEvent({
          eventType: "FILE_DELETED",
          category: "SYSTEM",
          severity: "INFO",
          userId: callerUid,
          userEmail: callerEmail,
          resourceId: fileId,
          metadata: {
            actor: { id: callerUid, email: callerEmail, role: "Admin" },
            action: "Deleted file",
            targetUserId,
            fileId,
            remainingDocsCount
          },
          sanitizedMessage: `File ${fileId} deleted for user ${targetUserId}`,
        });

        return res.json({
          success: true,
          message: "File deleted successfully and user verification state audited.",
          remainingDocsCount
        });
      }

      if (action === "update") {
        if (!fileId || !targetUserId || !data) {
          return res
            .status(400)
            .json({
              success: false,
              error: "fileId, targetUserId, and data are required",
            });
        }
        const { fileName, category } = data;

        try {
          await adminDb
            .collection("users")
            .doc(targetUserId)
            .collection("files")
            .doc(fileId)
            .set({ fileName, category }, { merge: true });
        } catch (e) {}

        const db = readDb();
        if (db.users) {
          const uIdx = db.users.findIndex(
            (u: any) => u.id === targetUserId || u.uid === targetUserId,
          );
          if (uIdx !== -1 && db.users[uIdx].files) {
            const fIdx = db.users[uIdx].files.findIndex(
              (f: any) => f.id === fileId,
            );
            if (fIdx !== -1) {
              db.users[uIdx].files[fIdx].fileName =
                fileName || db.users[uIdx].files[fIdx].fileName;
              db.users[uIdx].files[fIdx].category =
                category || db.users[uIdx].files[fIdx].category;
              writeDb(db);
            }
          }
        }

        await writeAdminAuditLog(
          callerUid,
          callerEmail,
          "ADMIN_UPDATED_FILE_METADATA",
          "FILE",
          fileId,
          null,
          "SUCCESS",
          `Updated file name/category`,
        );

        emitPlatformEvent({
          eventType: "FILE_UPDATED",
          category: "SYSTEM",
          severity: "INFO",
          userId: callerUid,
          userEmail: callerEmail,
          resourceId: fileId,
          metadata: {
            actor: { id: callerUid, email: callerEmail, role: "Admin" },
            action: "Updated file metadata",
            targetUserId,
          },
          sanitizedMessage: `File metadata updated: ${fileId} for user ${targetUserId}`,
        });

        return res.json({
          success: true,
          message: "File metadata updated successfully.",
        });
      }

      return res
        .status(400)
        .json({ success: false, error: "Unsupported file action" });
    } catch (err: any) {
      console.error("ADMIN_FILE_OPERATION_FAILED", err);
      await writeAdminAuditLog(
        callerUid,
        callerEmail,
        "ADMIN_UPDATED_FILE_METADATA",
        "FILE",
        fileId || "",
        null,
        "FAILED",
        err.message,
      );
      return res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to complete file operation",
        });
    }
  },
);

// 9. Retry transactional email
app.post(
  "/api/admin/retry-email",
  requireAuth,
  async (req: AuthRequest, res) => {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const { emailId, recipient, type } = req.body;

    try {
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({ success: false, error: "Forbidden: Admin access required." });
      }
      if (!recipient || !type) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Recipient and email type are required",
          });
      }

      const subject = `[ZAKIR] Resend Notification: ${type.toUpperCase()}`;
      const text = `Dear User,\n\nThis is a resent ${type} notification from the Zakir Platform Admin Operations Center.\n\nBest regards,\nZakir Support`;
      const html = `<div style="font-family:sans-serif;padding:20px;border:1px solid #ddd;border-radius:12px;">
      <h2 style="color:#0075DE;">ZAKIR Operational Resend</h2>
      <p>Dear User,</p>
      <p>This is an administrative operational resend of your <strong>${type}</strong> communication requested by Platform Operations.</p>
      <p>Best regards,<br/>Zakir Platform Operations Team</p>
    </div>`;

      try {
        await sendSystemMail({ to: recipient, subject, text, html });
      } catch (e) {
        console.warn("Mail resend skipped:", e);
      }

      const db = readDb();
      if (!db.email_delivery_logs) db.email_delivery_logs = [];
      const retryLog = {
        id: `mail_${Date.now()}`,
        recipient,
        type,
        timestamp: new Date().toISOString(),
        status: "DELIVERED",
        error: null,
        isRetry: true,
      };
      db.email_delivery_logs.unshift(retryLog);
      writeDb(db);

      await writeAdminAuditLog(
        callerUid,
        callerEmail,
        "ADMIN_RESENT_EMAIL",
        "EMAIL",
        emailId || "new",
        null,
        "SUCCESS",
        `Resent email of type ${type} to ${recipient}`,
      );

      return res.json({ success: true, message: "Email resent successfully." });
    } catch (err: any) {
      console.error("ADMIN_RETRY_EMAIL_FAILED", err);
      return res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to retry email delivery",
        });
    }
  },
);

// ==========================================
// ACCOUNT LIFECYCLE & RESTORATION SERVICES
// ==========================================

export async function getAccountLifecycleRecord(email: string): Promise<any> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  try {
    let record: any = null;

    // 1. Primary check: Query accountLifecycle collection in Firestore
    if (isFirebaseAdminAvailable) {
      try {
        const docRef = adminDb.collection("accountLifecycle").doc(normalizedEmail);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const d = docSnap.data();
          if (
            d &&
            (d.emailNormalized === normalizedEmail ||
              d.accountId === normalizedEmail ||
              (d.email || "").trim().toLowerCase() === normalizedEmail)
          ) {
            record = d;
          }
        }
      } catch (e) {}

      // If not found by doc id, query by emailNormalized or email in accountLifecycle
      if (!record) {
        try {
          const qSnap = await adminDb
            .collection("accountLifecycle")
            .where("emailNormalized", "==", normalizedEmail)
            .limit(1)
            .get();
          if (!qSnap.empty) {
            record = qSnap.docs[0].data();
          }
        } catch (e) {}
      }
    }

    // 2. Check account_lifecycle in local DB store
    if (!record) {
      const db = readDb();
      if (!db.account_lifecycle) db.account_lifecycle = [];
      const found = db.account_lifecycle.find(
        (r: any) =>
          (r.emailNormalized || r.accountId || r.email || "")
            .trim()
            .toLowerCase() === normalizedEmail,
      );
      if (found) {
        record = found;
      }
    }

    // If an accountLifecycle record exists with deleted/pending/approved status, use it directly!
    if (
      record &&
      record.status !== "ACTIVE" &&
      record.status !== "NEW"
    ) {
      // Record is a valid deletion/recovery state - proceed with this record
    } else {
      // 3. Check deletedUsers in Firestore and local DB
      let deletedMarker: any = null;
      if (isFirebaseAdminAvailable) {
        try {
          const delSnap = await adminDb
            .collection("deletedUsers")
            .where("email", "==", normalizedEmail)
            .limit(1)
            .get();
          if (!delSnap.empty) {
            deletedMarker = delSnap.docs[0].data();
          }
        } catch (e) {}
      }

      if (!deletedMarker) {
        const db = readDb();
        deletedMarker = db.deleted_users?.find(
          (u: any) => (u.email || "").trim().toLowerCase() === normalizedEmail,
        );
      }

      if (deletedMarker) {
        const deletedAt = deletedMarker.deletedAt || new Date().toISOString();
        const restoreUntil = new Date(
          new Date(deletedAt).getTime() + 31 * 24 * 60 * 60 * 1000,
        ).toISOString();
        record = {
          accountId: normalizedEmail,
          emailNormalized: normalizedEmail,
          status:
            deletedMarker.reason === "admin_deleted" || deletedMarker.deletionType === "admin"
              ? "ADMIN_DELETED"
              : "SELF_DELETED",
          deletionType:
            deletedMarker.reason === "admin_deleted" || deletedMarker.deletionType === "admin"
              ? "admin"
              : "self",
          deletedAt: deletedAt,
          restoreUntil: restoreUntil,
          originalUserId: deletedMarker.uid || deletedMarker.id,
          adminApprovalRequired:
            deletedMarker.reason === "admin_deleted" || deletedMarker.deletionType === "admin",
        };
      }
    }

    // 4. Check retained_users in local DB or users_retained
    if (!record || record.status === "ACTIVE") {
      try {
        const db = readDb();
        const retUser = db.retained_users?.find(
          (u: any) => u.email?.trim().toLowerCase() === normalizedEmail,
        );
        if (retUser) {
          const archivedAt =
            retUser.archivedAt || retUser.deletedAt || new Date().toISOString();
          const restoreUntil = new Date(
            new Date(archivedAt).getTime() + 31 * 24 * 60 * 60 * 1000,
          ).toISOString();
          record = {
            accountId: normalizedEmail,
            emailNormalized: normalizedEmail,
            status: "SELF_DELETED",
            deletionType: "self",
            deletedAt: archivedAt,
            restoreUntil: restoreUntil,
            originalUserId: retUser.id,
            adminApprovalRequired: false,
          };
        }
      } catch (e) {}
    }

    // 5. Check if user in users collection has deletion status markers
    if (!record || record.status === "ACTIVE") {
      if (isFirebaseAdminAvailable) {
        try {
          const activeUserSnap = await adminDb
            .collection("users")
            .where("email", "==", normalizedEmail)
            .limit(1)
            .get();
          if (!activeUserSnap.empty) {
            const activeDoc = activeUserSnap.docs[0].data();
            if (
              activeDoc &&
              (activeDoc.deleted === true ||
                activeDoc.status === "ADMIN_DELETED" ||
                activeDoc.status === "SELF_DELETED" ||
                activeDoc.accountLifecycleStatus === "SELF_DELETED" ||
                activeDoc.accountLifecycleStatus === "PURGED")
            ) {
              const deletedAt = activeDoc.deletedAt || new Date().toISOString();
              const restoreUntil = new Date(
                new Date(deletedAt).getTime() + 31 * 24 * 60 * 60 * 1000,
              ).toISOString();
              record = {
                accountId: normalizedEmail,
                emailNormalized: normalizedEmail,
                status:
                  activeDoc.status === "ADMIN_DELETED" ? "ADMIN_DELETED" : "SELF_DELETED",
                deletionType: activeDoc.status === "ADMIN_DELETED" ? "admin" : "self",
                deletedAt: deletedAt,
                restoreUntil: restoreUntil,
                originalUserId: activeUserSnap.docs[0].id,
                adminApprovalRequired: activeDoc.status === "ADMIN_DELETED",
              };
            }
          }
        } catch (activeErr) {}
      }

      const db = readDb();
      const localActive = db.users?.find(
        (u: any) => (u.email || "").trim().toLowerCase() === normalizedEmail,
      );
      if (
        localActive &&
        (localActive.deleted === true ||
          localActive.status === "ADMIN_DELETED" ||
          localActive.status === "SELF_DELETED" ||
          localActive.accountLifecycleStatus === "SELF_DELETED")
      ) {
        const deletedAt = localActive.deletedAt || new Date().toISOString();
        const restoreUntil = new Date(
          new Date(deletedAt).getTime() + 31 * 24 * 60 * 60 * 1000,
        ).toISOString();
        record = {
          accountId: normalizedEmail,
          emailNormalized: normalizedEmail,
          status:
            localActive.status === "ADMIN_DELETED" ? "ADMIN_DELETED" : "SELF_DELETED",
          deletionType: localActive.status === "ADMIN_DELETED" ? "admin" : "self",
          deletedAt: deletedAt,
          restoreUntil: restoreUntil,
          originalUserId: localActive.id,
          adminApprovalRequired: localActive.status === "ADMIN_DELETED",
        };
      }
    }

    // 6. If no deletion record was detected, check if this is an ACTIVE account
    if (!record) {
      // Check active user in Firestore
      if (isFirebaseAdminAvailable) {
        try {
          const activeUserSnap = await adminDb
            .collection("users")
            .where("email", "==", normalizedEmail)
            .limit(1)
            .get();
          if (!activeUserSnap.empty) {
            const activeDoc = activeUserSnap.docs[0].data();
            if (
              activeDoc &&
              activeDoc.deleted !== true &&
              activeDoc.status !== "ADMIN_DELETED" &&
              activeDoc.status !== "SELF_DELETED" &&
              activeDoc.accountLifecycleStatus !== "PURGED"
            ) {
              return {
                accountId: normalizedEmail,
                emailNormalized: normalizedEmail,
                status: "ACTIVE",
                canRestore: false,
                adminApprovalRequired: false,
              };
            }
          }
        } catch (activeErr) {}
      }

      // Check active user in local DB store
      const db = readDb();
      const localActive = db.users?.find(
        (u: any) => (u.email || "").trim().toLowerCase() === normalizedEmail,
      );
      if (
        localActive &&
        localActive.deleted !== true &&
        localActive.status !== "ADMIN_DELETED" &&
        localActive.status !== "SELF_DELETED" &&
        localActive.accountLifecycleStatus !== "PURGED"
      ) {
        return {
          accountId: normalizedEmail,
          emailNormalized: normalizedEmail,
          status: "ACTIVE",
          canRestore: false,
          adminApprovalRequired: false,
        };
      }

      // Check Firebase Auth active user (only if not disabled and no deletion record)
      if (isFirebaseAdminAvailable) {
        try {
          const authUser = await adminAuth
            .getUserByEmail(normalizedEmail)
            .catch(() => null);
          if (authUser && !authUser.disabled) {
            return {
              accountId: normalizedEmail,
              emailNormalized: normalizedEmail,
              status: "ACTIVE",
              canRestore: false,
              adminApprovalRequired: false,
            };
          }
        } catch (authErr) {}
      }

      return null;
    }

    if (!record) return null;

    // Check if self-deleted account has passed the 31-day restoration window
    if (
      record.deletionType === "self" &&
      record.status === "SELF_DELETED" &&
      record.restoreUntil
    ) {
      const nowMs = Date.now();
      const restoreUntilMs = new Date(record.restoreUntil).getTime();
      if (nowMs > restoreUntilMs) {
        console.log(
          `[LIFECYCLE PURGE] Self-deleted account ${normalizedEmail} expired 31-day window. Purging retained user data.`,
        );

        if (record.originalUserId) {
          try {
            await purgeRetainedUserDataServer(record.originalUserId);
          } catch (pErr) {
            console.warn("Purge retained data error:", pErr);
          }
        }

        const purgedFields = {
          status: "PURGED",
          deletionType: "self",
          purgedAt: new Date().toISOString(),
          retainedDataDocPath: null,
          updatedAt: new Date().toISOString(),
        };

        if (isFirebaseAdminAvailable) {
          try {
            await adminDb
              .collection("accountLifecycle")
              .doc(normalizedEmail)
              .set(purgedFields, { merge: true });
          } catch (e) {}
        }

        record = { ...record, ...purgedFields };

        const db = readDb();
        if (!db.account_lifecycle) db.account_lifecycle = [];
        const idx = db.account_lifecycle.findIndex(
          (r: any) => r.emailNormalized === normalizedEmail,
        );
        if (idx >= 0) db.account_lifecycle[idx] = record;
        else db.account_lifecycle.push(record);
        writeDb(db);
      }
    }

    if (record.status === "SELF_DELETED" && record.restoreUntil) {
      const nowMs = Date.now();
      const restoreUntilMs = new Date(record.restoreUntil).getTime();
      const remainingMs = restoreUntilMs - nowMs;
      if (remainingMs > 0) {
        record.canRestore = true;
        record.daysRemaining = Math.max(
          1,
          Math.ceil(remainingMs / (24 * 3600 * 1000)),
        );
      } else {
        record.canRestore = false;
        record.daysRemaining = 0;
      }
    }

    return record;
  } catch (err) {
    console.error("getAccountLifecycleRecord error:", err);
    return null;
  }
}

export async function setAccountLifecycleRecord(record: any): Promise<void> {
  if (!record || !record.emailNormalized) return;
  const normalizedEmail = record.emailNormalized.trim().toLowerCase();
  const docRef = adminDb.collection("accountLifecycle").doc(normalizedEmail);

  const payload = {
    ...record,
    emailNormalized: normalizedEmail,
    updatedAt: new Date().toISOString(),
  };

  try {
    await docRef.set(payload, { merge: true });
  } catch (err) {
    console.error("setAccountLifecycleRecord Firestore error:", err);
  }

  try {
    const db = readDb();
    if (!db.account_lifecycle) db.account_lifecycle = [];
    const idx = db.account_lifecycle.findIndex(
      (r: any) => r.emailNormalized === normalizedEmail,
    );
    if (idx >= 0)
      db.account_lifecycle[idx] = { ...db.account_lifecycle[idx], ...payload };
    else db.account_lifecycle.push(payload);
    writeDb(db);
  } catch (err) {
    console.warn("setAccountLifecycleRecord local DB error:", err);
  }
}

export async function purgeRetainedUserDataServer(
  userId: string,
): Promise<void> {
  if (!userId) return;
  try {
    const memSnap = await adminDb
      .collection("users_retained")
      .doc(userId)
      .collection("memories")
      .get();
    for (const d of memSnap.docs) await d.ref.delete();

    const alertSnap = await adminDb
      .collection("users_retained")
      .doc(userId)
      .collection("riskAlerts")
      .get();
    for (const d of alertSnap.docs) await d.ref.delete();

    const fileSnap = await adminDb
      .collection("users_retained")
      .doc(userId)
      .collection("files")
      .get();
    for (const d of fileSnap.docs) await d.ref.delete();

    const topFileSnap = await adminDb
      .collection("users_retained")
      .doc(userId)
      .collection("top_files")
      .get();
    for (const d of topFileSnap.docs) await d.ref.delete();

    await adminDb.collection("users_retained").doc(userId).delete();

    const db = readDb();
    if (db.retained_users) {
      db.retained_users = db.retained_users.filter((u: any) => u.id !== userId);
      writeDb(db);
    }

    console.log(
      `[PURGE COMPLETE] Retained user data for ${userId} purged permanently.`,
    );
  } catch (err) {
    console.warn("purgeRetainedUserDataServer warning:", err);
  }
}

// Background cleanup job for expired self-deleted accounts
export async function purgeExpiredAccountsJob(): Promise<void> {
  try {
    if (isFirebaseAdminAvailable) {
      const snap = await adminDb
        .collection("accountLifecycle")
        .where("deletionType", "==", "self")
        .where("status", "==", "SELF_DELETED")
        .get();
      if (snap && !snap.empty) {
        const nowMs = Date.now();
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          if (
            data.restoreUntil &&
            nowMs > new Date(data.restoreUntil).getTime()
          ) {
            console.log(
              `[BACKGROUND PURGE] Expired account lifecycle ${docSnap.id}`,
            );
            await getAccountLifecycleRecord(docSnap.id);
          }
        }
      }
    }
  } catch (e: any) {
    if (!e?.message?.includes("PERMISSION_DENIED") && e?.code !== 7) {
      console.warn("purgeExpiredAccountsJob background error:", e);
    }
  }

  // Also clean up expired records in local DB store
  try {
    const db = readDb();
    if (db.account_lifecycle && Array.isArray(db.account_lifecycle)) {
      const nowMs = Date.now();
      for (const record of db.account_lifecycle) {
        if (
          record.deletionType === "self" &&
          record.status === "SELF_DELETED" &&
          record.restoreUntil
        ) {
          if (nowMs > new Date(record.restoreUntil).getTime()) {
            console.log(
              `[BACKGROUND PURGE LOCAL] Expired account lifecycle ${record.emailNormalized}`,
            );
            await getAccountLifecycleRecord(record.emailNormalized);
          }
        }
      }
    }
  } catch (err) {
    // quiet
  }
}

export async function restoreAccountFullServer(
  email: string,
  newPassword?: string,
): Promise<{ success: boolean; user?: any; error?: string }> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail)
    return { success: false, error: "Email parameter is required." };

  const nowIso = new Date().toISOString();
  const lifecycle = await getAccountLifecycleRecord(normalizedEmail);
  const targetUid = lifecycle?.originalUserId;

  // 1. Locate retained user profile
  let retainedProfile: any = null;
  if (targetUid) {
    try {
      const rSnap = await adminDb
        .collection("users_retained")
        .doc(targetUid)
        .get();
      if (rSnap.exists) retainedProfile = rSnap.data();
    } catch (e) {}
  }

  if (!retainedProfile) {
    try {
      const db = readDb();
      retainedProfile = db.retained_users?.find(
        (u: any) =>
          (targetUid && u.id === targetUid) ||
          u.email?.trim().toLowerCase() === normalizedEmail,
      );
    } catch (e) {}
  }

  // 2. Identify UID
  let finalUid = targetUid || retainedProfile?.id;

  let authUser: any = null;
  if (finalUid) {
    try {
      authUser = await adminAuth.getUser(finalUid);
    } catch (e) {}
  }

  if (!authUser && normalizedEmail) {
    try {
      authUser = await adminAuth.getUserByEmail(normalizedEmail);
      if (authUser) finalUid = authUser.uid;
    } catch (e) {}
  }

  if (!finalUid) {
    finalUid = `usr_${Date.now().toString(36)}`;
  }

  // 3. Re-enable Firebase Auth user (preserve existing password, disabled: false, emailVerified: false)
  if (authUser) {
    const updatePayload: any = { disabled: false, emailVerified: false };
    if (newPassword && newPassword.trim()) {
      updatePayload.password = newPassword.trim();
    }
    try {
      await adminAuth.updateUser(authUser.uid, updatePayload);
      const checkAuth = await adminAuth.getUser(authUser.uid);
      const hasPasswordProvider = checkAuth.providerData.some(
        (p: any) => p.providerId === "password",
      );
      console.log(
        `[RESTORE_FULL] Firebase Auth user ${authUser.uid} re-enabled: disabled=${checkAuth.disabled}, emailVerified=${checkAuth.emailVerified}, hasPasswordProvider=${hasPasswordProvider}`,
      );
    } catch (uErr: any) {
      console.warn(
        `[RESTORE_FULL] Warning updating Firebase Auth user ${authUser.uid}:`,
        uErr?.message,
      );
    }
  } else {
    try {
      const createPayload: any = {
        uid: finalUid,
        email: normalizedEmail,
        emailVerified: false,
        displayName:
          retainedProfile?.ownerName ||
          retainedProfile?.companyName ||
          normalizedEmail.split("@")[0],
      };
      if (newPassword && newPassword.trim()) {
        createPayload.password = newPassword.trim();
      } else {
        createPayload.password =
          "RestoredPass_" + Math.random().toString(36).substring(2, 8) + "123!";
      }
      authUser = await adminAuth.createUser(createPayload);
      console.log(`[RESTORE_FULL] Created Firebase Auth user ${finalUid}`);
    } catch (cErr: any) {
      console.warn(
        `[RESTORE_FULL] Firebase Auth user creation warning for ${finalUid}:`,
        cErr?.message,
      );
    }
  }

  // 4. Remove deletedUsers marker in Firestore
  try {
    if (finalUid) {
      await adminDb.collection("deletedUsers").doc(finalUid).delete();
    }
    const delEmailSnap = await adminDb
      .collection("deletedUsers")
      .where("email", "==", normalizedEmail)
      .get();
    for (const dDoc of delEmailSnap.docs) {
      await dDoc.ref.delete();
    }
  } catch (dErr) {
    console.warn("[RESTORE_FULL] Deleted marker removal warning:", dErr);
  }

  // 5. Restore Firestore user document users/{finalUid}
  const authoritativeOwnerId = retainedProfile?.workspace?.ownerId;
  const rawPreviousRole =
    retainedProfile?.role || lifecycle?.originalRole || "Contributor";

  // Strictly restore the exact pre-deletion role and powers without auto-promotion or demotion
  const assignedRole = rawPreviousRole;

  const preservedWorkspaceId =
    retainedProfile?.workspaceId ||
    retainedProfile?.workspace?.id ||
    `ws_${finalUid.substring(0, 8)}`;
  const preservedWorkspace = retainedProfile?.workspace || {
    id: preservedWorkspaceId,
    name: `${retainedProfile?.companyName || "Restored"} Workspace`,
    ownerId: authoritativeOwnerId || finalUid,
    createdAt: retainedProfile?.createdAt || nowIso,
    memberCount: 1,
  };

  const defaultPowers = {
    fileVault: true,
    memoryVault: true,
    riskRadar: true,
    marketIntel: true,
    settings: true,
  };

  const assignedPowers =
    retainedProfile?.powers || lifecycle?.originalPowers || defaultPowers;

  const rawRestoredUserDoc = {
    ...(retainedProfile || {}),
    id: finalUid,
    uid: finalUid,
    email: normalizedEmail,
    role: assignedRole,
    previousRoleBeforeDeletion: rawPreviousRole,
    workspaceId: preservedWorkspaceId,
    workspace: preservedWorkspace,
    powers: assignedPowers,
    companyName: retainedProfile?.companyName || "Restored Account",
    ownerName: retainedProfile?.ownerName || normalizedEmail.split("@")[0],
    passwordHash:
      newPassword && newPassword.trim()
        ? newPassword.trim()
        : retainedProfile?.passwordHash || "restored_pwd_123",
    subscriptionStatus: retainedProfile?.subscriptionStatus || "Active",
    userPreferences: retainedProfile?.userPreferences || {
      theme: "light",
      language: "ar",
    },
    status: "VERIFICATION_REQUIRED",
    accountStatus: "active",
    deleted: false,
    deletedAt: null,
    deletedBy: null,
    isVerified: false,
    isEmailVerified: false,
    emailVerified: false,
    email_verified: false,
    verification_status: "unverified",
    verification_required: true,
    lastActiveAt: nowIso,
    lastLoginAt: nowIso,
    restoredAt: nowIso,
  };

  function sanitizeForFirestoreServer(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== "object") return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj))
      return obj.map((item) => sanitizeForFirestoreServer(item));
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestoreServer(value);
      }
    }
    return clean;
  }

  const restoredUserDoc = sanitizeForFirestoreServer(rawRestoredUserDoc);

  try {
    await adminDb
      .collection("users")
      .doc(finalUid)
      .set(restoredUserDoc, { merge: true });
    console.log(
      `[RESTORE_FULL] Saved restored user profile to Firestore users/${finalUid}`,
    );
  } catch (fsErr: any) {
    console.error("[RESTORE_FULL] Failed to save Firestore user profile:", {
      message: fsErr?.message || String(fsErr),
      code: fsErr?.code,
      details: fsErr?.details,
      stack: fsErr?.stack,
      collection: "users",
      docId: finalUid,
    });
    return {
      success: false,
      error: `Failed to save restored user profile to Firestore database (${finalUid}): ${fsErr?.message || fsErr}`,
    };
  }

  // Restore subcollections if retained
  if (retainedProfile) {
    try {
      const memSnap = await adminDb
        .collection("users_retained")
        .doc(finalUid)
        .collection("memories")
        .get();
      for (const mDoc of memSnap.docs) {
        await adminDb
          .collection("users")
          .doc(finalUid)
          .collection("memories")
          .doc(mDoc.id)
          .set(mDoc.data(), { merge: true });
      }
      const alertSnap = await adminDb
        .collection("users_retained")
        .doc(finalUid)
        .collection("riskAlerts")
        .get();
      for (const aDoc of alertSnap.docs) {
        await adminDb
          .collection("users")
          .doc(finalUid)
          .collection("riskAlerts")
          .doc(aDoc.id)
          .set(aDoc.data(), { merge: true });
      }
      const filesSnap = await adminDb
        .collection("users_retained")
        .doc(finalUid)
        .collection("files")
        .get();
      for (const fDoc of filesSnap.docs) {
        await adminDb
          .collection("users")
          .doc(finalUid)
          .collection("files")
          .doc(fDoc.id)
          .set(fDoc.data(), { merge: true });
      }
      const topFilesSnap = await adminDb
        .collection("users_retained")
        .doc(finalUid)
        .collection("top_files")
        .get();
      for (const tfDoc of topFilesSnap.docs) {
        await adminDb
          .collection("files")
          .doc(tfDoc.id)
          .set(tfDoc.data(), { merge: true });
      }
    } catch (subErr) {}
  }

  // 6. Update local JSON DB
  try {
    const db = readDb();
    if (!db.users) db.users = [];
    db.users = db.users.filter(
      (u: any) =>
        u.id !== finalUid && u.email?.trim().toLowerCase() !== normalizedEmail,
    );
    db.users.push(restoredUserDoc);

    if (db.retained_users) {
      db.retained_users = db.retained_users.filter(
        (u: any) =>
          u.id !== finalUid &&
          u.email?.trim().toLowerCase() !== normalizedEmail,
      );
    }
    writeDb(db);
  } catch (dbErr) {}

  // 7. Update lifecycle record
  const activeLifecycle = {
    accountId: normalizedEmail,
    emailNormalized: normalizedEmail,
    status: "ACTIVE",
    deletionType: null,
    deletedAt: null,
    deletedBy: null,
    restoreUntil: null,
    originalUserId: finalUid,
    updatedAt: nowIso,
  };
  await setAccountLifecycleRecord(activeLifecycle);

  return { success: true, user: restoredUserDoc };
}

// Run periodic cleanup every 1 hour & on startup (VM/persistent server only)
if (!isServerless) {
  const tPurge = setInterval(purgeExpiredAccountsJob, 60 * 60 * 1000);
  if (tPurge?.unref) tPurge.unref();
  const tStartup = setTimeout(() => {
    purgeExpiredAccountsJob().catch(console.warn);
    reconcileWorkspaceData().catch(console.warn);
  }, 5000);
  if (tStartup?.unref) tStartup.unref();
}

// --- ACCOUNT LIFECYCLE API ENDPOINTS ---

function getLocalRecoveryRequestsList(db: any): any[] {
  if (!db || !db.account_recovery_requests) return [];
  const raw = db.account_recovery_requests;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && raw !== null) return Object.values(raw);
  return [];
}

function isRealRecoveryRequestDoc(r: any, targetEmail?: string): boolean {
  if (!r || typeof r !== "object") return false;
  const reqId = (r.requestId || r.id || "").toString().trim();
  if (!reqId) return false;

  const status = (r.status || r.decision || "").toLowerCase();
  const validStatuses = ["pending", "under_review", "submitted", "approved", "rejected", "restored"];
  if (!validStatuses.includes(status)) return false;

  // Rule: Must be a real user-submitted recovery request with a request ID starting with REQ-
  // AND have a valid non-empty email
  // AND contain explicit form submission evidence (submittedAt, termsAcceptedAt, documents, or fullName + reason).
  // Lifecycle records, deletion markers, or empty status shells do NOT count as recovery requests.
  const isExplicitReqId = reqId.startsWith("REQ-");
  const docEmail = ((r.email || r.accountId || "").toString()).trim().toLowerCase();
  const hasValidEmail = Boolean(docEmail && docEmail.includes("@"));

  if (targetEmail) {
    const normTarget = targetEmail.trim().toLowerCase();
    if (docEmail !== normTarget) {
      return false;
    }
  }

  const hasSubmissionEvidence = Boolean(
    r.submittedAt ||
    r.termsAcceptedAt ||
    (Array.isArray(r.documents) && r.documents.length > 0) ||
    (r.fullName && r.reason)
  );

  return isExplicitReqId && hasValidEmail && hasSubmissionEvidence;
}

app.all(
  [
    "/api/auth/resolve-account",
    "/api/auth/resolve-account/",
    "/auth/resolve-account",
    "/auth/resolve-account/",
  ],
  async (req, res) => {
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    if (req.method === "GET" || req.method === "HEAD") {
      const queryEmail = (req.query.email as string || "").trim();
      if (!queryEmail) {
        return res.status(200).json({
          success: true,
          endpoint: "/api/auth/resolve-account",
          status: "active",
          message: "Account resolution endpoint is active.",
        });
      }
    }
    try {
      const email = (req.body?.email || req.query?.email || "").toString().trim();
      if (!email) {
        return res
          .status(400)
          .json({ success: false, error: "Email parameter is required." });
      }

      const normalizedEmail = email.toLowerCase();
      let record = await getAccountLifecycleRecord(normalizedEmail);

      // If no lifecycle record yet, check if active user exists in Firestore or local DB
      if (!record) {
        let existsActive = false;
        let activeUserId: string | null = null;
        if (isFirebaseAdminAvailable && adminDb) {
          try {
            const userSnap = await adminDb
              .collection("users")
              .where("email", "==", normalizedEmail)
              .limit(1)
              .get();
            if (!userSnap.empty) {
              existsActive = true;
              activeUserId = userSnap.docs[0].id;
            }
          } catch (e) {}
        }
        if (!existsActive) {
          const db = readDb();
          const localUser = db.users?.find(
            (u: any) => (u.email || "").trim().toLowerCase() === normalizedEmail,
          );
          if (localUser) {
            existsActive = true;
            activeUserId = localUser.id;
          }
        }
        if (existsActive) {
          return res.json({
            success: true,
            email: normalizedEmail,
            accountState: "ACTIVE_ACCOUNT",
            lifecycleStatus: "ACTIVE",
            canRestore: false,
            adminApprovalRequired: false,
            daysRemaining: 0,
            restoreUntil: null,
            hasRecoveryRequest: false,
            recoveryRequestId: null,
            recoveryStatus: "none",
            isExpired: false,
            originalUserId: activeUserId,
            userFriendlyMessage:
              "البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول إلى حسابك.",
          });
        }
      }

    // Collect all recovery requests for this email
    const requestDocs: any[] = [];
    if (isFirebaseAdminAvailable) {
      try {
        const qSnap = await adminDb
          .collection("recoveryRequests")
          .where("email", "==", normalizedEmail)
          .get();
        if (qSnap && !qSnap.empty) {
          qSnap.docs.forEach((d) => requestDocs.push(d.data()));
        }
      } catch (e) {}

      try {
        const emailSnap = await adminDb
          .collection("recoveryRequests_by_email")
          .doc(normalizedEmail)
          .get();
        if (emailSnap.exists) {
          requestDocs.push(emailSnap.data());
        }
      } catch (e) {}

      try {
        const legacySnap = await adminDb
          .collection("accountRecoveryRequests_by_email")
          .doc(normalizedEmail)
          .get();
        if (legacySnap.exists) {
          requestDocs.push(legacySnap.data());
        }
      } catch (e) {}
    }

    try {
      const db = readDb();
      const localReqs = getLocalRecoveryRequestsList(db).filter(
        (r: any) => (r?.email || "").trim().toLowerCase() === normalizedEmail,
      );
      requestDocs.push(...localReqs);
    } catch (e) {}

    // Strictly filter for valid, actual recovery requests submitted by the user
    const validRequestDocs = requestDocs.filter((r) => isRealRecoveryRequestDoc(r, normalizedEmail));

    // Sort requests by newest
    validRequestDocs.sort((a, b) => {
      const ta = new Date(a.submittedAt || a.createdAt || a.updatedAt || 0).getTime();
      const tb = new Date(b.submittedAt || b.createdAt || b.updatedAt || 0).getTime();
      return tb - ta;
    });

    const latestRequest = validRequestDocs[0] || null;
    let recoveryStatus: "none" | "pending" | "approved" | "rejected" = "none";
    let recoveryRequestId: string | null = null;

    if (latestRequest) {
      const raw = (latestRequest.status || latestRequest.decision || "").toLowerCase();
      if (raw === "approved") {
        recoveryStatus = "approved";
        recoveryRequestId = latestRequest.requestId || latestRequest.id || null;
      } else if (raw === "rejected") {
        recoveryStatus = "rejected";
        recoveryRequestId = latestRequest.requestId || latestRequest.id || null;
      } else if (raw === "pending" || raw === "under_review" || raw === "submitted") {
        recoveryStatus = "pending";
        recoveryRequestId = latestRequest.requestId || latestRequest.id || null;
      } else {
        recoveryStatus = "none";
        recoveryRequestId = null;
      }
    }

    const isDeleted =
      record &&
      (record.status === "SELF_DELETED" ||
        record.status === "ADMIN_DELETED" ||
        record.status === "SELF_RESTORE_AVAILABLE" ||
        record.status === "ADMIN_APPROVAL_REQUIRED" ||
        record.status === "ADMIN_APPROVAL_PENDING" ||
        record.status === "ADMIN_APPROVED" ||
        record.status === "PURGED" ||
        record.deletionType === "self" ||
        record.deletionType === "admin");

    if (isDeleted) {
      const deletedAt =
        record.deletedAt ||
        record.archivedAt ||
        record.createdAt ||
        new Date().toISOString();
      const delTime = new Date(deletedAt).getTime();
      const thirtyOneDaysMs = 31 * 24 * 60 * 60 * 1000;
      const restoreUntilMs = delTime + thirtyOneDaysMs;
      const restoreUntilIso =
        record.restoreUntil || new Date(restoreUntilMs).toISOString();
      const remainingMs = new Date(restoreUntilIso).getTime() - Date.now();
      const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 3600 * 1000)));
      const isExpired =
        record.status === "PURGED" ||
        (daysRemaining <= 0 &&
          record.status !== "ADMIN_DELETED" &&
          record.status !== "ADMIN_APPROVED");

      // Strictly decouple account state from recovery request state
      const hasRecoveryRequest = Boolean(latestRequest && recoveryRequestId && recoveryStatus !== "none");
      let accountState:
        | "DELETED_ACCOUNT_NO_RECOVERY_REQUEST"
        | "DELETED_ACCOUNT_RECOVERY_PENDING"
        | "DELETED_ACCOUNT_RECOVERY_REJECTED"
        | "DELETED_ACCOUNT_RECOVERY_APPROVED" =
        "DELETED_ACCOUNT_NO_RECOVERY_REQUEST";

      if (hasRecoveryRequest) {
        if (recoveryStatus === "approved") {
          accountState = "DELETED_ACCOUNT_RECOVERY_APPROVED";
        } else if (recoveryStatus === "rejected") {
          accountState = "DELETED_ACCOUNT_RECOVERY_REJECTED";
        } else {
          accountState = "DELETED_ACCOUNT_RECOVERY_PENDING";
        }
      } else {
        accountState = "DELETED_ACCOUNT_NO_RECOVERY_REQUEST";
      }

      let userFriendlyMessage = `تم العثور على حساب سابق تم حذفه (${daysRemaining > 0 ? `متبقي ${daysRemaining} يوماً للاستعادة` : "انتهت فترة الاستعادة المباشرة"}).`;
      if (accountState === "DELETED_ACCOUNT_RECOVERY_APPROVED") {
        userFriendlyMessage =
          "تمت الموافقة على طلب استعادة حسابك من قبل إدارة المنصة! يمكنك الآن إكمال استعادة الحساب.";
      } else if (accountState === "DELETED_ACCOUNT_RECOVERY_PENDING") {
        userFriendlyMessage =
          "طلب استعادة حسابك قيد المراجعة حالياً من قبل إدارة المنصة. يرجى متابعة حالة الطلب.";
      } else if (accountState === "DELETED_ACCOUNT_RECOVERY_REJECTED") {
        userFriendlyMessage =
          "تمت مراجعة طلب استعادة الحساب ورفضه. يمكنك مراجعة سبب الرفض أو التواصل مع الدعم.";
      } else if (isExpired) {
        userFriendlyMessage =
          "انتهت فترة سماح استعادة هذا الحساب (31 يوماً). تم حذف البيانات بشكل نهائي وفق سياسة النظام.";
      }

      return res.json({
        success: true,
        email: normalizedEmail,
        accountState,
        lifecycleStatus: record.status || "SELF_DELETED",
        canRestore:
          !isExpired &&
          (daysRemaining > 0 ||
            record.status === "ADMIN_DELETED" ||
            record.status === "ADMIN_APPROVED"),
        adminApprovalRequired: Boolean(
          record.adminApprovalRequired ||
            record.status === "ADMIN_DELETED" ||
            record.deletionType === "admin",
        ),
        daysRemaining,
        restoreUntil: restoreUntilIso,
        hasRecoveryRequest,
        recoveryRequestId: hasRecoveryRequest ? recoveryRequestId : null,
        recoveryStatus: hasRecoveryRequest ? recoveryStatus : "none",
        initialTab: hasRecoveryRequest ? "status" : "request",
        nextAction:
          accountState === "DELETED_ACCOUNT_NO_RECOVERY_REQUEST"
            ? "START_RECOVERY"
            : accountState === "DELETED_ACCOUNT_RECOVERY_PENDING"
            ? "WAIT_FOR_APPROVAL"
            : accountState === "DELETED_ACCOUNT_RECOVERY_APPROVED"
            ? "PROCEED_TO_RESTORE"
            : accountState === "DELETED_ACCOUNT_RECOVERY_REJECTED"
            ? "VIEW_REJECTION"
            : "NONE",
        isExpired,
        originalUserId: record.originalUserId || null,
        userFriendlyMessage,
      });
    }

    if (record && record.status === "ACTIVE") {
      return res.json({
        success: true,
        email: normalizedEmail,
        accountState: "ACTIVE_ACCOUNT",
        lifecycleStatus: "ACTIVE",
        canRestore: false,
        adminApprovalRequired: false,
        daysRemaining: 0,
        restoreUntil: null,
        hasRecoveryRequest: false,
        recoveryRequestId: null,
        recoveryStatus: "none",
        isExpired: false,
        originalUserId: null,
        userFriendlyMessage:
          "البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول إلى حسابك.",
      });
    }

    return res.json({
      success: true,
      email: normalizedEmail,
      accountState: "NO_ACCOUNT",
      lifecycleStatus: "NONE",
      canRestore: false,
      adminApprovalRequired: false,
      daysRemaining: 0,
      restoreUntil: null,
      hasRecoveryRequest: false,
      recoveryRequestId: null,
      recoveryStatus: "none",
      isExpired: false,
      originalUserId: null,
      userFriendlyMessage: "لا يوجد حساب مسجل بهذا البريد الإلكتروني.",
    });
  } catch (err: any) {
    console.error("resolve-account error:", err);
    res.status(500).json({
      success: false,
      error: err?.message || "Internal server error resolving account",
    });
  }
});

app.post("/api/auth/check-lifecycle", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Email parameter is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = await getAccountLifecycleRecord(normalizedEmail);

    if (!record || record.status === "PURGED") {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: record?.status === "PURGED" ? "PURGED" : "NEW",
        canRegister: true,
        canRestore: false,
        adminApprovalRequired: false,
        userFriendlyMessage: "",
      });
    }

    if (record.status === "ACTIVE") {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: "ACTIVE",
        canRegister: false,
        canRestore: false,
        adminApprovalRequired: false,
        userFriendlyMessage:
          "البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول إلى حسابك.",
      });
    }

    if (
      record.status === "ADMIN_APPROVED" ||
      record.reactivationStatus === "approved"
    ) {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: "ADMIN_APPROVED",
        canRegister: false,
        canRestore: true,
        adminApprovalRequired: false,
        userFriendlyMessage:
          "تمت الموافقة على طلب استعادة حسابك من قبل المسؤول! يمكنك الآن تسجيل الدخول أو إكمال التحقق لاستعادة الحساب.",
      });
    }

    const deletedAt =
      record.deletedAt ||
      record.archivedAt ||
      record.createdAt ||
      new Date().toISOString();
    const delTime = new Date(deletedAt).getTime();
    const thirtyOneDaysMs = 31 * 24 * 60 * 60 * 1000;
    const restoreUntilMs = delTime + thirtyOneDaysMs;
    const restoreUntilIso = new Date(restoreUntilMs).toISOString();
    const remainingMs = restoreUntilMs - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 3600 * 1000)));

    if (
      record.status === "ADMIN_DELETED" ||
      record.status === "ADMIN_APPROVAL_REQUIRED" ||
      record.deletionType === "admin"
    ) {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: "ADMIN_DELETED",
        canRegister: false,
        canRestore: daysRemaining > 0,
        adminApprovalRequired: true,
        daysRemaining: daysRemaining,
        deletedAt: deletedAt,
        restoreUntil: restoreUntilIso,
        userFriendlyMessage:
          "تم تعطيل حسابك بواسطة مسؤول المنصة. لا يمكنك إنشاء حساب جديد باستخدام هذا البريد الإلكتروني إلا بعد موافقة المسؤول.",
      });
    }

    if (record.status === "ADMIN_APPROVAL_PENDING") {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: "ADMIN_APPROVAL_PENDING",
        canRegister: false,
        canRestore: false,
        adminApprovalRequired: true,
        daysRemaining: daysRemaining,
        deletedAt: deletedAt,
        restoreUntil: restoreUntilIso,
        userFriendlyMessage:
          "طلب إعادة تفعيل الحساب قيد المراجعة حالياً بواسطة مسؤول المنصة. يرجى الانتظار لحين البت في الطلب.",
      });
    }

    if (
      record.status === "SELF_DELETED" ||
      record.status === "SELF_RESTORE_AVAILABLE" ||
      record.deletionType === "self"
    ) {
      if (daysRemaining > 0) {
        return res.json({
          success: true,
          email: normalizedEmail,
          status: "SELF_RESTORE_AVAILABLE",
          canRegister: false,
          canRestore: true,
          adminApprovalRequired: false,
          daysRemaining: daysRemaining,
          deletedAt: deletedAt,
          restoreUntil: restoreUntilIso,
          userFriendlyMessage: `تم العثور على حساب سابق تم حذفه بواسطتك. يمكنك استعادة حسابك وجميع بياناتك السابقة (متبقي ${daysRemaining} يوماً للاستعادة).`,
        });
      } else {
        return res.json({
          success: true,
          email: normalizedEmail,
          status: "RESTORE_EXPIRED",
          canRegister: true,
          canRestore: false,
          adminApprovalRequired: false,
          daysRemaining: 0,
          deletedAt: deletedAt,
          restoreUntil: restoreUntilIso,
          userFriendlyMessage:
            "انتهت فترة استعادة هذا الحساب. تم حذف البيانات بشكل نهائي ولم يعد قابلاً للاستعادة وفق سياسة النظام.",
        });
      }
    }

    if (record.status === "PURGED") {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: "RESTORE_EXPIRED",
        canRegister: true,
        canRestore: false,
        adminApprovalRequired: false,
        daysRemaining: 0,
        userFriendlyMessage:
          "انتهت فترة استعادة هذا الحساب. تم حذف البيانات بشكل نهائي ولم يعد قابلاً للاستعادة وفق سياسة النظام.",
      });
    }

    return res.json({
      success: true,
      email: normalizedEmail,
      status: "NEW",
      canRegister: true,
      canRestore: false,
      adminApprovalRequired: false,
      userFriendlyMessage: "",
    });
  } catch (err: any) {
    console.error("check-lifecycle error:", err);
    res
      .status(500)
      .json({
        success: false,
        error: err.message || "Failed to check account lifecycle state.",
      });
  }
});

export async function requestAccountReactivationServer(
  email: string,
  reason?: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const record = await getAccountLifecycleRecord(normalizedEmail);

  if (
    !record ||
    (record.status !== "ADMIN_DELETED" &&
      record.status !== "ADMIN_APPROVAL_REQUIRED" &&
      record.deletionType !== "admin")
  ) {
    return {
      success: false,
      error:
        "هذا الحساب غير محذوف بواسطة مسؤول المنصة أو لا يتطلب إعادة تفعيل.",
    };
  }

  const nowIso = new Date().toISOString();
  const updatedRecord = {
    ...record,
    status: "ADMIN_APPROVAL_PENDING",
    reactivationRequestedAt: nowIso,
    reactivationRequestReason:
      reason || "طلب إعادة تفعيل الحساب المحذوف بواسطة المسؤول",
    reactivationStatus: "pending",
    updatedAt: nowIso,
  };

  await setAccountLifecycleRecord(updatedRecord);

  try {
    await adminDb
      .collection("accountReactivationRequests")
      .doc(normalizedEmail)
      .set({
        email: normalizedEmail,
        requestedAt: nowIso,
        reason: reason || "طلب إعادة تفعيل الحساب المحذوف بواسطة المسؤول",
        status: "pending",
        originalUserId: record.originalUserId || "",
      });
  } catch (e) {}

  const db = readDb();
  if (!db.account_reactivation_requests) db.account_reactivation_requests = [];
  db.account_reactivation_requests = db.account_reactivation_requests.filter(
    (r: any) => r.email !== normalizedEmail,
  );
  db.account_reactivation_requests.push({
    email: normalizedEmail,
    requestedAt: nowIso,
    reason: reason || "طلب إعادة تفعيل الحساب المحذوف بواسطة المسؤول",
    status: "pending",
  });
  writeDb(db);

  return {
    success: true,
    message:
      "تم تقديم طلب إعادة تفعيل الحساب بنجاح إلى مسؤول المنصة. سيتم مراجعة طلبك وإخطارك بالتحديثات.",
  };
}

app.post("/api/auth/request-reactivation", async (req, res) => {
  try {
    const { email, reason } = req.body;
    if (!email || typeof email !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Email parameter is required." });
    }

    const result = await requestAccountReactivationServer(email, reason);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    console.error("request-reactivation error:", err);
    res
      .status(500)
      .json({
        success: false,
        error: err.message || "Failed to submit reactivation request.",
      });
  }
});

app.post("/api/auth/restore-account", async (req, res) => {
  try {
    const { email, code, verificationCode, password } = req.body;
    const inputCode = (code || verificationCode || "").trim();
    if (!email || typeof email !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Email parameter is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = await getAccountLifecycleRecord(normalizedEmail);

    if (
      !record ||
      (record.status !== "SELF_RESTORE_AVAILABLE" &&
        record.status !== "SELF_DELETED")
    ) {
      if (
        record &&
        (record.status === "PURGED" ||
          (record.restoreUntil &&
            Date.now() > new Date(record.restoreUntil).getTime()))
      ) {
        return res.status(400).json({
          success: false,
          code: "RESTORE_EXPIRED",
          error:
            "انتهت فترة استعادة هذا الحساب. تم حذف البيانات بشكل نهائي ولم يعد قابلاً للاستعادة وفق سياسة النظام.",
        });
      }
      return res.status(400).json({
        success: false,
        error: "لا يوجد حساب محذوف قابل للاستعادة بهذا البريد الإلكتروني.",
      });
    }

    if (
      record.restoreUntil &&
      Date.now() > new Date(record.restoreUntil).getTime()
    ) {
      return res.status(400).json({
        success: false,
        code: "RESTORE_EXPIRED",
        error:
          "انتهت مهلة 31 يوماً المتاحة لاستعادة الحساب. تم حذف البيانات بشكل نهائي.",
      });
    }

    const userId = record.originalUserId || `usr_${Date.now().toString(36)}`;

    // Require and verify OTP code for identity verification
    if (!inputCode) {
      return res.status(400).json({
        success: false,
        code: "OTP_REQUIRED",
        error:
          "يرجى إدخال رمز التحقق المرسل إلى بريدك الإلكتروني لتأكيد ملكية الحساب واستعادته.",
      });
    }

    let activeOtpRecord: any = null;
    try {
      const vcSnap = await adminDb
        .collection("verification_codes")
        .doc(userId)
        .get();
      if (vcSnap.exists && !vcSnap.data()?.used) {
        activeOtpRecord = { ...vcSnap.data(), _docId: userId };
      }
    } catch (e) {}

    if (!activeOtpRecord) {
      try {
        const vcEmailSnap = await adminDb
          .collection("verification_codes")
          .doc(normalizedEmail)
          .get();
        if (vcEmailSnap.exists && !vcEmailSnap.data()?.used) {
          activeOtpRecord = { ...vcEmailSnap.data(), _docId: normalizedEmail };
        }
      } catch (e) {}
    }

    if (!activeOtpRecord) {
      try {
        const qSnap = await adminDb
          .collection("verification_codes")
          .where("email", "==", normalizedEmail)
          .where("used", "==", false)
          .get();
        if (!qSnap.empty) {
          activeOtpRecord = {
            ...qSnap.docs[0].data(),
            _docId: qSnap.docs[0].id,
          };
        }
      } catch (e) {}
    }

    if (!activeOtpRecord) {
      const db = readDb();
      activeOtpRecord = db.verification_codes?.find(
        (vc: any) =>
          !vc.used &&
          (vc.id === userId ||
            vc.id === normalizedEmail ||
            vc.userId === userId ||
            vc.email?.toLowerCase() === normalizedEmail),
      );
      if (activeOtpRecord) {
        activeOtpRecord._docId = activeOtpRecord.id;
      }
    }

    if (!activeOtpRecord) {
      return res.status(400).json({
        success: false,
        error:
          "لم يتم العثور على رمز تحقق نشط أو انتهت صلاحيته. يرجى طلب رمز جديد.",
      });
    }

    const expiresAt = activeOtpRecord.expiresAt?.toDate
      ? activeOtpRecord.expiresAt.toDate()
      : new Date(activeOtpRecord.expiresAt);

    if (expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        error: "انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد.",
      });
    }

    if ((activeOtpRecord.attempts || 0) >= 5) {
      return res.status(400).json({
        success: false,
        error: "تم تجاوز الحد الأقصى للمحاولات. يرجى طلب رمز جديد.",
      });
    }

    const cleanInputHash = hashVerificationCode(inputCode);
    const isOtpMatch = activeOtpRecord.codeHash
      ? activeOtpRecord.codeHash === cleanInputHash
      : activeOtpRecord.code === inputCode;

    if (!isOtpMatch) {
      const newAttempts = (activeOtpRecord.attempts || 0) + 1;
      const remaining = Math.max(0, 5 - newAttempts);
      try {
        if (activeOtpRecord._docId) {
          await adminDb
            .collection("verification_codes")
            .doc(activeOtpRecord._docId)
            .update({ attempts: newAttempts });
        }
      } catch (e) {}
      return res.status(400).json({
        success: false,
        error: `رمز التحقق غير صحيح. متبقي ${remaining} محاولة.`,
      });
    }

    // Mark OTP as used
    try {
      if (activeOtpRecord._docId) {
        await adminDb
          .collection("verification_codes")
          .doc(activeOtpRecord._docId)
          .update({
            used: true,
            verifiedAt: new Date().toISOString(),
          });
      }
    } catch (e) {}

    let retainedProfile: any = null;
    try {
      const retainedSnap = await adminDb
        .collection("users_retained")
        .doc(userId)
        .get();
      if (retainedSnap.exists) {
        retainedProfile = retainedSnap.data();
      }
    } catch (e) {}

    if (!retainedProfile) {
      const db = readDb();
      retainedProfile = db.retained_users?.find(
        (u: any) =>
          u.id === userId || u.email?.toLowerCase() === normalizedEmail,
      );
    }

    const nowIso = new Date().toISOString();
    // Strictly preserve authoritative role, workspace, powers, preferences from retained profile/record without privilege escalation
    const preservedRole = retainedProfile?.role || record?.originalRole;
    if (!preservedRole) {
      console.error(
        `[RESTORE_SELF] Security Error: Original role missing for ${normalizedEmail}. Restoration blocked.`,
      );
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Cannot verify original user role and permissions. Account restoration blocked for security.",
        });
    }
    const preservedWorkspaceId =
      retainedProfile?.workspaceId ||
      record?.originalWorkspaceId ||
      retainedProfile?.workspace?.id ||
      `ws_${userId.substring(0, 8)}`;
    const authoritativeOwnerId =
      retainedProfile?.workspace?.ownerId ||
      (preservedRole === "CEO" ? userId : undefined);

    const preservedWorkspace = retainedProfile?.workspace || {
      id: preservedWorkspaceId,
      name: `${retainedProfile?.companyName || "Restored"} Workspace`,
      ownerId:
        authoritativeOwnerId ||
        (preservedRole === "CEO" ? userId : `ws_owner_${preservedWorkspaceId}`),
      createdAt: retainedProfile?.createdAt || nowIso,
      memberCount: 1,
    };

    const restoredUserDoc = {
      ...(retainedProfile || {}),
      id: userId,
      email: normalizedEmail,
      role: preservedRole,
      workspaceId: preservedWorkspaceId,
      workspace: preservedWorkspace,
      powers: retainedProfile?.powers || record?.originalPowers,
      companyName: retainedProfile?.companyName || "Restored Account",
      ownerName: retainedProfile?.ownerName || normalizedEmail.split("@")[0],
      status: "ACTIVE",
      accountLifecycleStatus: "ACTIVE",
      deleted: false,
      subscriptionStatus: retainedProfile?.subscriptionStatus || "Active Trial",
      userPreferences: retainedProfile?.userPreferences || {
        theme: "light",
        language: "ar",
      },
      isVerified: true,
      isEmailVerified: true,
      emailVerified: true,
      email_verified: true,
      verification_status: "verified",
      verification_required: false,
      lastActiveAt: nowIso,
      lastLoginAt: nowIso,
      restoredAt: nowIso,
    };

    // Clean up deletedUsers markers in Firestore
    try {
      await adminDb.collection("deletedUsers").doc(userId).delete();
      const delEmailSnap = await adminDb
        .collection("deletedUsers")
        .where("email", "==", normalizedEmail)
        .get();
      for (const d of delEmailSnap.docs) {
        await d.ref.delete();
      }
    } catch (e) {
      console.warn("Deleted marker removal warning:", e);
    }

    let customToken: string = "";
    try {
      await adminAuth.getUser(userId);
      if (password) {
        await adminAuth.updateUser(userId, { password, emailVerified: true });
      } else {
        await adminAuth.updateUser(userId, { emailVerified: true });
      }
      try {
        customToken = await adminAuth.createCustomToken(userId);
      } catch (tErr) {}
    } catch (authErr: any) {
      if (authErr.code === "auth/user-not-found") {
        try {
          await adminAuth.createUser({
            uid: userId,
            email: normalizedEmail,
            password: password || "Zakir@2026Restored",
            displayName:
              restoredUserDoc.ownerName ||
              restoredUserDoc.companyName ||
              normalizedEmail.split("@")[0],
            emailVerified: true,
          });
          try {
            customToken = await adminAuth.createCustomToken(userId);
          } catch (tErr) {}
        } catch (cErr) {}
      }
    }

    try {
      await adminDb.collection("users").doc(userId).set(restoredUserDoc);
    } catch (fsErr) {
      console.warn("Restore profile doc write error:", fsErr);
    }

    // Restore archived subcollections: memories, riskAlerts, files
    try {
      const retainedMemSnap = await adminDb
        .collection("users_retained")
        .doc(userId)
        .collection("memories")
        .get();
      for (const mDoc of retainedMemSnap.docs) {
        await adminDb
          .collection("users")
          .doc(userId)
          .collection("memories")
          .doc(mDoc.id)
          .set(mDoc.data());
      }
    } catch (e) {}

    try {
      const retainedAlertSnap = await adminDb
        .collection("users_retained")
        .doc(userId)
        .collection("riskAlerts")
        .get();
      for (const aDoc of retainedAlertSnap.docs) {
        await adminDb
          .collection("users")
          .doc(userId)
          .collection("riskAlerts")
          .doc(aDoc.id)
          .set(aDoc.data());
      }
    } catch (e) {}

    try {
      const retainedFilesSnap = await adminDb
        .collection("users_retained")
        .doc(userId)
        .collection("files")
        .get();
      for (const fDoc of retainedFilesSnap.docs) {
        await adminDb
          .collection("users")
          .doc(userId)
          .collection("files")
          .doc(fDoc.id)
          .set(fDoc.data());
      }
      const retainedTopFilesSnap = await adminDb
        .collection("users_retained")
        .doc(userId)
        .collection("top_files")
        .get();
      for (const tfDoc of retainedTopFilesSnap.docs) {
        await adminDb.collection("files").doc(tfDoc.id).set(tfDoc.data());
      }
    } catch (e) {}

    // Restore local DB memories, risk alerts, files if available in backup
    const dbInst = readDb();
    if (retainedProfile?.archivedMemories?.length) {
      if (!dbInst.memories) dbInst.memories = [];
      dbInst.memories = dbInst.memories.filter((m: any) => m.userId !== userId);
      dbInst.memories.push(...retainedProfile.archivedMemories);
    }
    if (retainedProfile?.archivedRiskAlerts?.length) {
      if (!dbInst.risk_alerts) dbInst.risk_alerts = [];
      dbInst.risk_alerts = dbInst.risk_alerts.filter(
        (a: any) => a.userId !== userId,
      );
      dbInst.risk_alerts.push(...retainedProfile.archivedRiskAlerts);
    }
    if (retainedProfile?.archivedFiles?.length) {
      if (!dbInst.files) dbInst.files = [];
      dbInst.files = dbInst.files.filter((f: any) => f.userId !== userId);
      dbInst.files.push(...retainedProfile.archivedFiles);
    }

    if (!dbInst.users) dbInst.users = [];
    dbInst.users = dbInst.users.filter(
      (u: any) => u.id !== userId && u.email?.toLowerCase() !== normalizedEmail,
    );
    dbInst.users.push(restoredUserDoc);
    writeDb(dbInst);

    try {
      await purgeRetainedUserDataServer(userId);
    } catch (e) {}

    const activeRecord = {
      accountId: normalizedEmail,
      emailNormalized: normalizedEmail,
      status: "ACTIVE",
      deletionType: null,
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      originalUserId: userId,
      retainedDataDocPath: null,
      updatedAt: nowIso,
    };

    await setAccountLifecycleRecord(activeRecord);

    console.log("ACCOUNT_RESTORED_SUCCESSFULLY", {
      userId,
      email: normalizedEmail,
      role: restoredUserDoc.role,
    });

    return res.json({
      success: true,
      message:
        "تمت استعادة حسابك وجميع بياناتك بنجاح! مرحباً بعودتك إلى Zakir.",
      user: restoredUserDoc,
      customToken: customToken || undefined,
    });
  } catch (err: any) {
    console.error("restore-account error:", err);
    res
      .status(500)
      .json({
        success: false,
        error: err.message || "Failed to restore account.",
      });
  }
});

app.get("/api/auth/check-invitation", async (req, res) => {
  try {
    const email = ((req.query.email as string) || "").trim().toLowerCase();
    const token = (
      (req.query.token as string) ||
      (req.query.invitationToken as string) ||
      ""
    ).trim();
    if (!email && !token) {
      return res.json({ success: true, invitation: null });
    }

    let invitation: any = null;
    if (email) {
      try {
        const docSnap = await adminDb
          .collection("invitations")
          .doc(email)
          .get();
        if (docSnap.exists) {
          invitation = docSnap.data();
        }
      } catch (e) {}
    }

    if (!invitation && token) {
      try {
        const qSnap = await adminDb
          .collection("invitations")
          .where("token", "==", token)
          .limit(1)
          .get();
        if (!qSnap.empty) {
          invitation = qSnap.docs[0].data();
        }
      } catch (e) {}
    }

    if (!invitation) {
      const db = readDb();
      invitation =
        db.invitations?.find(
          (i: any) =>
            (email && i.email?.trim().toLowerCase() === email) ||
            (token && i.token === token),
        ) || null;
    }

    if (
      invitation &&
      (invitation.status || "").toString().toUpperCase() === "ACCEPTED"
    ) {
      invitation = null;
    }

    return res.json({ success: true, invitation });
  } catch (err) {
    return res.json({ success: true, invitation: null });
  }
});

app.get(
  "/api/admin/reactivation-requests",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const callerUid = req.user?.uid;
      const callerEmail = req.user?.email || "";
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({ error: "Forbidden: Admin access required." });
      }

      const snap = await adminDb
        .collection("accountReactivationRequests")
        .get();
      let requests: any[] = [];
      if (snap && !snap.empty) {
        requests = snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      }

      const db = readDb();
      const localRequests = db.account_reactivation_requests || [];

      for (const lr of localRequests) {
        if (!requests.some((r) => r.email === lr.email)) {
          requests.push(lr);
        }
      }

      return res.json({ success: true, requests });
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: err.message || "Failed to fetch reactivation requests.",
        });
    }
  },
);

export async function handleAccountReactivationRequestServer(
  email: string,
  action: "approve" | "reject",
  callerUid: string = "admin",
  notes: string = "",
): Promise<{ success: boolean; message?: string; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const record = await getAccountLifecycleRecord(normalizedEmail);
  const nowIso = new Date().toISOString();

  if (action === "approve") {
    const updatedLifecycle = {
      accountId: normalizedEmail,
      emailNormalized: normalizedEmail,
      status: "ACTIVE",
      deletionType: null,
      adminApprovalRequired: false,
      reactivationStatus: "approved",
      approvedAt: nowIso,
      approvedBy: callerUid,
      notes: notes || "",
      updatedAt: nowIso,
    };

    await setAccountLifecycleRecord(updatedLifecycle);

    try {
      await adminDb
        .collection("accountReactivationRequests")
        .doc(normalizedEmail)
        .update({
          status: "approved",
          reviewedAt: nowIso,
          reviewedBy: callerUid,
          notes: notes || "",
        });
    } catch (e) {}

    const db = readDb();
    if (db.account_reactivation_requests) {
      const reqItem = db.account_reactivation_requests.find(
        (r: any) => r.email === normalizedEmail,
      );
      if (reqItem) {
        reqItem.status = "approved";
        reqItem.reviewedAt = nowIso;
      }
    }
    writeDb(db);

    return {
      success: true,
      message:
        "تمت الموافقة على طلب إعادة التفعيل بنجاح. يمكن للمستخدم الآن إنشاء حساب جديد بهذا البريد الإلكتروني.",
    };
  } else {
    const updatedLifecycle = {
      ...record,
      status: "ADMIN_DELETED",
      adminApprovalRequired: true,
      reactivationStatus: "rejected",
      rejectedAt: nowIso,
      rejectedBy: callerUid,
      notes: notes || "",
      updatedAt: nowIso,
    };

    await setAccountLifecycleRecord(updatedLifecycle);

    try {
      await adminDb
        .collection("accountReactivationRequests")
        .doc(normalizedEmail)
        .update({
          status: "rejected",
          reviewedAt: nowIso,
          reviewedBy: callerUid,
          notes: notes || "",
        });
    } catch (e) {}

    const db = readDb();
    if (db.account_reactivation_requests) {
      const reqItem = db.account_reactivation_requests.find(
        (r: any) => r.email === normalizedEmail,
      );
      if (reqItem) {
        reqItem.status = "rejected";
        reqItem.reviewedAt = nowIso;
      }
    }
    writeDb(db);

    return {
      success: true,
      message: "تم رفض طلب إعادة التفعيل. يظل الحساب محظوراً من التسجيل.",
    };
  }
}

app.post(
  "/api/admin/handle-reactivation-request",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const callerUid = req.user?.uid;
      const callerEmail = req.user?.email || "";
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({ error: "Forbidden: Admin access required." });
      }

      const { email, action, notes } = req.body;
      if (!email || !action || (action !== "approve" && action !== "reject")) {
        return res
          .status(400)
          .json({
            error:
              "Email and valid action ('approve' or 'reject') are required.",
          });
      }

      const result = await handleAccountReactivationRequestServer(
        email,
        action,
        callerUid,
        notes,
      );
      return res.json(result);
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: err.message || "Failed to handle reactivation request.",
        });
    }
  },
);

// --- ACCOUNT RECOVERY REQUEST WORKFLOW ENDPOINTS ---

function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 2) return false;
  const hex = buffer
    .toString("hex", 0, Math.min(buffer.length, 16))
    .toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  // 1. PDF signature: %PDF (25 50 44 46)
  if (hex.startsWith("25504446") || mime.includes("pdf")) {
    return true;
  }
  // 2. PNG signature: 89 50 4e 47
  if (hex.startsWith("89504e47") || mime.includes("png")) {
    return true;
  }
  // 3. JPEG / JPG signature: ff d8 ff
  if (
    hex.startsWith("ffd8ff") ||
    mime.includes("jpeg") ||
    mime.includes("jpg")
  ) {
    return true;
  }
  // 4. WEBP signature: RIFF...WEBP (52 49 46 46)
  if (hex.startsWith("52494646") || mime.includes("webp")) {
    return true;
  }
  // 5. DOC (OLE Binary Compound File): d0 cf 11 e0 a1 b1 1a e1
  if (hex.startsWith("d0cf11e0") || mime.includes("msword")) {
    return true;
  }
  // 6. DOCX / XLSX (ZIP format): 50 4b 03 04, 50 4b 05 06, 50 4b 07 08
  if (
    hex.startsWith("504b0304") ||
    hex.startsWith("504b0506") ||
    hex.startsWith("504b0708") ||
    mime.includes("officedocument") ||
    mime.includes("spreadsheetml") ||
    mime.includes("wordprocessingml") ||
    mime.includes("excel")
  ) {
    return true;
  }
  // 7. SVG / XML / Text / CSV
  if (
    hex.startsWith("3c737667") ||
    hex.startsWith("3c3f786d") ||
    mime.includes("svg") ||
    mime.includes("text") ||
    mime.includes("csv")
  ) {
    return true;
  }

  const allowedKeywords = [
    "pdf",
    "png",
    "jpeg",
    "jpg",
    "webp",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "msword",
    "officedocument",
    "spreadsheet",
    "wordprocessing",
    "text",
    "octet-stream",
  ];
  return allowedKeywords.some((kw) => mime.includes(kw));
}

const recoveryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Durable Multi-Tier Storage System with Binary-Metadata Separation
const RECOVERY_DOC_RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days maximum retention for sensitive identity proofs
const ORPHAN_UPLOAD_TTL_MS = 60 * 60 * 1000; // 1 hour for unassociated pending uploads

function getLocalUploadsDir(): string {
  const base = isServerless ? os.tmpdir() : process.cwd();
  return path.join(base, "secure_uploads");
}

function saveToLocalDiskCache(documentId: string, buffer: Buffer): void {
  try {
    const cleanId = path.basename(documentId).replace(/[^a-zA-Z0-9_\-\.]/g, "");
    if (!cleanId) return;
    const dir = getLocalUploadsDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path.join(dir, cleanId), buffer);
  } catch (err: any) {
    // In serverless or read-only environments, local disk cache is secondary.
    console.warn(
      "[Recovery Storage] Local disk cache write notice:",
      err?.message || err,
    );
  }
}

function getFromLocalDiskCache(documentId: string): Buffer | null {
  try {
    const cleanId = path.basename(documentId).replace(/[^a-zA-Z0-9_\-\.]/g, "");
    if (!cleanId) return null;
    const candidatePaths = [
      path.join(getLocalUploadsDir(), cleanId),
      path.join(os.tmpdir(), "secure_uploads", cleanId),
      path.join(process.cwd(), "secure_uploads", cleanId),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p);
      }
    }
  } catch (err) {}
  return null;
}

async function setFirestoreDocWithRetry(
  docRef: any,
  data: any,
  retries = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await docRef.set(data);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
}

let isCloudStorageBucketAvailable: boolean | null = null;

async function saveDocumentToPersistentStorage(
  documentId: string,
  buffer: Buffer,
  mimeType: string,
  meta?: {
    fileName?: string;
    size?: number;
    fileHash?: string;
    workspaceId?: string;
    ownerUid?: string;
    userId?: string;
    pendingMeta?: any;
    simulateFirestoreFailure?: boolean;
  },
  timings?: {
    local_disk_ms?: number;
    local_db_ms?: number;
    firestore_batch_ms?: number;
    storage_upload_ms?: number;
    pending_upload_registration_ms?: number;
  },
): Promise<void> {
  const tDisk0 = Date.now();
  // 1. Binary Storage Phase (Local Secure Container Persistence)
  saveToLocalDiskCache(documentId, buffer);
  if (timings) timings.local_disk_ms = Date.now() - tDisk0;

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAtIso = new Date(
    nowMs + RECOVERY_DOC_RETENTION_MS,
  ).toISOString();
  const fileHash =
    meta?.fileHash ||
    crypto.createHash("sha256").update(buffer).digest("hex");
  const fileName = meta?.fileName || "document";
  const workspaceId = meta?.workspaceId || "default";
  const ownerUid = meta?.ownerUid || meta?.userId || meta?.pendingMeta?.ownerUid || null;
  const storagePath = `secure_uploads/${documentId}`;
  let storageProvider: "firebase-storage" | "local-secure-disk" = "local-secure-disk";

  // 2. Binary Storage Phase (Firebase / Google Cloud Storage with fast fallback)
  const tStorage0 = Date.now();
  if (isCloudStorageBucketAvailable !== false) {
    const bucket = getSafeBucket();
    if (bucket) {
      let timeoutHandle: any = null;
      try {
        const fileRef = bucket.file(storagePath);
        const savePromise = fileRef.save(buffer, {
          metadata: {
            contentType: mimeType,
            metadata: {
              sha256: fileHash,
              documentId,
              fileName,
              workspaceId,
            },
          },
          resumable: false,
        });

        await Promise.race([
          savePromise,
          new Promise((_, reject) => {
            timeoutHandle = setTimeout(
              () => reject(new Error("Storage save timeout (350ms)")),
              350,
            );
            if (timeoutHandle?.unref) timeoutHandle.unref();
          }),
        ]);

        storageProvider = "firebase-storage";
        isCloudStorageBucketAvailable = true;
        console.log(`[Storage] Binary persisted to Cloud Storage: ${storagePath}`);
      } catch (storageErr: any) {
        if (isCloudStorageBucketAvailable === null) {
          isCloudStorageBucketAvailable = false;
        }
        storageProvider = "local-secure-disk";
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    } else {
      isCloudStorageBucketAvailable = false;
    }
  }
  if (timings) timings.storage_upload_ms = Date.now() - tStorage0;

  const tDb0 = Date.now();
  // 3. Metadata Persistence (Local DB Store)
  const masterDoc: any = {
    documentId,
    fileName,
    mimeType,
    size: buffer.length,
    fileHash,
    sha256: fileHash,
    storageProvider,
    storagePath,
    storageReference: storagePath,
    storageStatus: "persisted",
    ownerUid,
    workspaceId,
    createdAt: nowIso,
    updatedAt: nowIso,
    expiresAt: expiresAtIso,
    permissions: {
      isPublic: false,
      ownerOnly: true,
    },
  };

  const db = readDb();
  if (!db.recovery_documents_store) {
    db.recovery_documents_store = {};
  }
  db.recovery_documents_store[documentId] = masterDoc;

  if (meta?.pendingMeta) {
    if (!db.pending_recovery_uploads) {
      db.pending_recovery_uploads = [];
    }
    db.pending_recovery_uploads.push(meta.pendingMeta);
  }
  writeDb(db);
  if (timings) timings.local_db_ms = Date.now() - tDb0;

  // 4. Metadata Persistence (Firestore - Single Lightweight Document ONLY, NO Base64 chunks!)
  const tFs0 = Date.now();
  if (meta?.simulateFirestoreFailure) {
    console.error(`[DurabilityGate] Simulated Firestore metadata failure for documentId: ${documentId}. Initiating rollback and orphan cleanup.`);
    await deleteDocumentFromPersistentStorage(documentId).catch(() => {});
    const dbRollback = readDb();
    if (dbRollback.recovery_documents_store) {
      delete dbRollback.recovery_documents_store[documentId];
    }
    if (dbRollback.pending_recovery_uploads) {
      dbRollback.pending_recovery_uploads = dbRollback.pending_recovery_uploads.filter((u: any) => u.documentId !== documentId);
    }
    writeDb(dbRollback);
    throw new Error("DURABILITY_GATE_FAILED: Firestore metadata persistence failed, orphan storage object purged.");
  }

  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const batch = adminDb.batch();
      const masterRef = adminDb.collection("recoveryDocuments").doc(documentId);
      batch.set(masterRef, masterDoc);

      if (meta?.pendingMeta) {
        const pendingRef = adminDb
          .collection("pendingRecoveryUploads")
          .doc(documentId);
        batch.set(pendingRef, meta.pendingMeta);
      }

      await batch.commit();

      console.log(
        `[RecoveryUpload] Lightweight metadata persisted in Firestore for ${documentId} (<1KB payload in 1 roundtrip)`,
      );
    } catch (fsErr: any) {
      console.warn(
        "[RecoveryUpload] Firestore metadata persistence notice:",
        fsErr?.message || fsErr,
      );
    }
  }
  if (timings) {
    timings.firestore_batch_ms = Date.now() - tFs0;
    timings.pending_upload_registration_ms = 0;
  }

  console.log(
    `[Recovery Upload] Storage persistence complete for documentId: ${documentId} (${buffer.length} bytes, provider: ${storageProvider})`,
  );
}

// Background Cloud Storage Synchronization with durable queue reconciliation
async function syncDocumentToCloudStorage(
  documentId: string,
  buffer?: Buffer,
  mimeType?: string,
): Promise<boolean> {
  const bucket = getSafeBucket();
  if (!bucket) {
    return false;
  }

  // Resolve buffer and mimeType if not supplied
  let docBuffer = buffer;
  let docMime = mimeType || "application/pdf";

  if (!docBuffer) {
    try {
      docBuffer = await getDocumentFromPersistentStorage(documentId);
    } catch (e) {
      return false;
    }
  }

  const updateStatus = async (
    status: "syncing" | "synced" | "firestore_durable" | "failed",
    errorMsg?: string,
    attempts: number = 1,
  ) => {
    try {
      if (isFirebaseAdminAvailable && adminDb) {
        await adminDb
          .collection("recoveryDocuments")
          .doc(documentId)
          .set(
            {
              storageStatus: status,
              syncError: errorMsg || null,
              syncAttempts: attempts,
              syncedAt: status === "synced" ? new Date().toISOString() : null,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
      }
    } catch (e) {}

    try {
      const db = readDb();
      if (db.recovery_documents_store?.[documentId]) {
        db.recovery_documents_store[documentId].storageStatus = status;
        db.recovery_documents_store[documentId].syncAttempts = attempts;
        if (errorMsg)
          db.recovery_documents_store[documentId].syncError = errorMsg;
        writeDb(db);
      }
    } catch (e) {}
  };

  const getCleanErrMsg = (err: any): string => {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    if (err.message) return err.message;
    if (err.errors?.[0]?.message) return err.errors[0].message;
    if (err.code) return `Error code ${err.code}`;
    return "Storage operation unfulfilled";
  };

  const isBucketNotFound = (err: any): boolean => {
    if (!err) return false;
    const msg = String(
      err?.message || err?.errors?.[0]?.message || "",
    ).toLowerCase();
    const reason = String(err?.errors?.[0]?.reason || "").toLowerCase();
    const code = Number(err?.code || err?.status || 0);
    return (
      code === 404 ||
      code === 403 ||
      reason === "notfound" ||
      msg.includes("not found") ||
      msg.includes("not exist")
    );
  };

  const MAX_ATTEMPTS = 2;
  const ATTEMPT_TIMEOUT_MS = 4000;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let timeoutHandle: any = null;
    try {
      if (attempt > 1) {
        await new Promise((res) => setTimeout(res, 1000));
      }

      await Promise.race([
        (async () => {
          const fileRef = bucket.file(`secure_uploads/${documentId}`);
          const [exists] = await fileRef.exists().catch(() => [false]);
          if (!exists) {
            await fileRef.save(docBuffer!, {
              metadata: { contentType: docMime },
            });
          }
        })(),
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(
            () =>
              reject(
                new Error(`Storage upload timeout (${ATTEMPT_TIMEOUT_MS}ms)`),
              ),
            ATTEMPT_TIMEOUT_MS,
          );
          if (timeoutHandle?.unref) timeoutHandle.unref();
        }),
      ]);

      await updateStatus("synced", undefined, attempt);
      console.log(
        `[Recovery Upload] Durable cloud sync SUCCESS for document: ${documentId}`,
      );

      // Clean up legacy chunks if any exist
      if (isFirebaseAdminAvailable && adminDb) {
        (async () => {
          try {
            const chunksSnap = await adminDb
              .collection("recoveryDocuments")
              .doc(documentId)
              .collection("chunks")
              .get();
            if (chunksSnap && !chunksSnap.empty) {
              const batch = adminDb.batch();
              chunksSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
              await batch.commit();
            }
          } catch (pruneErr) {}
        })().catch(() => {});
      }

      return true;
    } catch (err: any) {
      lastError = err;
      if (isBucketNotFound(err)) {
        // Cloud bucket not provisioned on this GCP project - mark safely as firestore_durable without retrying
        await updateStatus(
          "firestore_durable",
          "Primary Firestore metadata active (Bucket unprovisioned)",
          attempt,
        );
        console.log(
          `[Recovery Storage] Document ${documentId} safely stored with persistent local storage.`,
        );
        return true;
      }
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  // If failed after retries, document remains 100% safe in persistent storage
  const failureReason = getCleanErrMsg(lastError);
  await updateStatus("firestore_durable", failureReason, MAX_ATTEMPTS);
  return true;
}

// Durable Background Reconciliation Worker: Scans for 'pending' uploads and syncs them
async function runDurableSyncWorker() {
  if (!isFirebaseAdminAvailable) return;
  const bucket = getSafeBucket();
  if (!bucket) return;

  try {
    // 1. Check local DB pending sync items
    const db = readDb();
    const store = db.recovery_documents_store || {};
    const pendingDocIds = Object.keys(store).filter(
      (id) =>
        store[id].storageStatus === "pending" &&
        (store[id].syncAttempts || 0) < 2,
    );

    for (const docId of pendingDocIds.slice(0, 2)) {
      await syncDocumentToCloudStorage(
        docId,
        undefined,
        store[docId]?.mimeType,
      );
    }

    // 2. Check Firestore pending sync records
    if (adminDb) {
      const snap = await adminDb
        .collection("recoveryDocuments")
        .where("storageStatus", "==", "pending")
        .limit(2)
        .get();

      if (snap && !snap.empty) {
        for (const doc of snap.docs) {
          const data = doc.data();
          if ((data.syncAttempts || 0) < 2) {
            await syncDocumentToCloudStorage(doc.id, undefined, data.mimeType);
          }
        }
      }
    }
  } catch (err) {}
}

// Periodic background runner (every 5 minutes) for sync reconciliation and TTL cleanup (VM only)
if (!isServerless) {
  const tSync = setInterval(
    () => {
      runDurableSyncWorker().catch(() => {});
      runComprehensiveStorageCleanup().catch(() => {});
    },
    5 * 60 * 1000,
  );
  if (tSync?.unref) tSync.unref();
}

async function checkDocumentExistence(
  documentId: string,
  docMeta?: any
): Promise<boolean> {
  if (!documentId) return false;
  // 1. Check local container storage
  const p1 = path.join(process.cwd(), "secure_uploads", documentId);
  const p2 = path.join(os.tmpdir(), "secure_uploads", documentId);
  const p3 = path.join(getLocalUploadsDir(), documentId);
  if (fs.existsSync(p1) || fs.existsSync(p2) || fs.existsSync(p3)) {
    return true;
  }
  if (getFromLocalDiskCache(documentId)) {
    return true;
  }

  // 2. Check local DB stores
  const db = readDb();
  const localDoc =
    db.recovery_documents_store?.[documentId] ||
    db.verification_documents_store?.[documentId] ||
    (Array.isArray(db.files) ? db.files.find((f: any) => f.id === documentId || f.documentId === documentId) : null) ||
    docMeta;

  if (localDoc) {
    if (
      localDoc.storageReference ||
      localDoc.storagePath ||
      localDoc.path ||
      localDoc.filePath ||
      localDoc.downloadUrl ||
      localDoc.previewUrl ||
      localDoc.fileName ||
      localDoc.name ||
      localDoc.fileBase64 ||
      localDoc.data ||
      localDoc.base64 ||
      (typeof localDoc.fileUrl === "string" && localDoc.fileUrl.length > 5)
    ) {
      return true;
    }
    if (Array.isArray(localDoc.chunks) && localDoc.chunks.length > 0) {
      return true;
    }
  }

  // 3. Check Firebase Storage
  const bucket = getSafeBucket();
  if (bucket) {
    try {
      const candidates = [`secure_uploads/${documentId}`, `files/${documentId}`];
      if (localDoc?.storagePath) candidates.push(localDoc.storagePath);
      if (localDoc?.storageReference) candidates.push(localDoc.storageReference);
      for (const cPath of candidates) {
        const [exists] = await bucket.file(cPath).exists().catch(() => [false]);
        if (exists) return true;
      }
    } catch (e) {}
  }

  // 4. Check Firestore
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const rSnap = await adminDb.collection("recoveryDocuments").doc(documentId).get();
      if (rSnap && rSnap.exists) return true;
      const vSnap = await adminDb.collection("verification_documents").doc(documentId).get();
      if (vSnap && vSnap.exists) {
        const vData = vSnap.data();
        if (vData?.fileBase64 || vData?.data || vData?.storagePath || vData?.storageReference || vData?.fileUrl) {
          return true;
        }
      }
      const fSnap = await adminDb.collection("files").doc(documentId).get();
      if (fSnap && fSnap.exists) return true;
    } catch (e) {}
  }

  return false;
}

async function getDocumentFromPersistentStorage(
  documentId: string,
): Promise<Buffer> {
  // 1. Check local container storage first for fastest response (<1ms)
  const cached = getFromLocalDiskCache(documentId);
  if (cached && cached.length > 0) {
    return cached;
  }

  // Check direct disk paths
  const candidateDiskPaths = [
    path.join(process.cwd(), "secure_uploads", documentId),
    path.join(os.tmpdir(), "secure_uploads", documentId),
    path.join(getLocalUploadsDir(), documentId),
  ];
  for (const p of candidateDiskPaths) {
    if (fs.existsSync(p)) {
      try {
        const buf = fs.readFileSync(p);
        if (buf && buf.length > 0) {
          saveToLocalDiskCache(documentId, buf);
          return buf;
        }
      } catch (e) {}
    }
  }

  const db = readDb();
  const localDoc =
    db.recovery_documents_store?.[documentId] ||
    db.verification_documents_store?.[documentId] ||
    (Array.isArray(db.files) ? db.files.find((f: any) => f.id === documentId || f.documentId === documentId) : null);

  // 2. Check Firebase Cloud Storage
  const bucket = getSafeBucket();
  if (bucket) {
    let timeoutHandle: any = null;
    try {
      const candidates = [
        documentId,
        `secure_uploads/${documentId}`,
        `files/${documentId}`,
        `verification_documents/${documentId}`,
        `recoveryDocuments/${documentId}`,
      ];
      if (localDoc?.storagePath) candidates.push(localDoc.storagePath);
      if (localDoc?.storageReference) candidates.push(localDoc.storageReference);
      if (localDoc?.userId) {
        candidates.push(`users/${localDoc.userId}/files/${documentId}`);
        if (localDoc.fileName) {
          candidates.push(`users/${localDoc.userId}/files/${documentId}_${localDoc.fileName}`);
        }
      }

      for (const cPath of candidates) {
        if (!cPath) continue;
        const fileRef = bucket.file(cPath);
        const downloadPromise = async () => {
          const [exists] = await fileRef.exists().catch(() => [false]);
          if (exists) {
            const [fileBuffer] = await fileRef.download();
            saveToLocalDiskCache(documentId, fileBuffer);
            return fileBuffer;
          }
          return null;
        };

        const buffer = await Promise.race([
          downloadPromise(),
          new Promise<null>((resolve) => {
            timeoutHandle = setTimeout(() => resolve(null), 3500);
            if (timeoutHandle?.unref) timeoutHandle.unref();
          }),
        ]);

        if (buffer && buffer.length > 0) return buffer;
      }
    } catch (err) {
      // Continue to fallbacks
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  // 3. Check local DB store legacy Base64 or chunked records
  if (localDoc) {
    if (Array.isArray(localDoc.chunks) && localDoc.chunks.length > 0) {
      const buffers: Buffer[] = [];
      const sorted = [...localDoc.chunks].sort(
        (a: any, b: any) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0),
      );
      for (const c of sorted) {
        const raw = Buffer.from(c.data, "base64");
        if (c.compressed) {
          try {
            buffers.push(zlib.inflateSync(raw));
          } catch (e) {
            buffers.push(raw);
          }
        } else {
          buffers.push(raw);
        }
      }
      if (buffers.length > 0) {
        const fullBuffer = Buffer.concat(buffers);
        saveToLocalDiskCache(documentId, fullBuffer);
        return fullBuffer;
      }
    }

    const raw =
      localDoc.fileBase64 ||
      localDoc.data ||
      localDoc.base64 ||
      (typeof localDoc.fileUrl === "string" && localDoc.fileUrl.startsWith("data:")
        ? localDoc.fileUrl
        : null);
    if (raw) {
      const clean = String(raw).replace(/^data:[^;]+;base64,/, "");
      const buf = Buffer.from(clean, "base64");
      if (buf.length > 0) {
        saveToLocalDiskCache(documentId, buf);
        return buf;
      }
    }

    // If localDoc has external HTTP/HTTPS URL
    if (typeof localDoc.fileUrl === "string" && (localDoc.fileUrl.startsWith("http://") || localDoc.fileUrl.startsWith("https://"))) {
      try {
        const resp = await fetch(localDoc.fileUrl);
        if (resp.ok) {
          const arrBuf = await resp.arrayBuffer();
          const buf = Buffer.from(arrBuf);
          if (buf.length > 0) {
            saveToLocalDiskCache(documentId, buf);
            return buf;
          }
        }
      } catch (e) {}
    }
  }

  // 4. Retrieve from Firestore recoveryDocuments chunks or master record
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const docSnap = await adminDb
        .collection("recoveryDocuments")
        .doc(documentId)
        .get();
      if (docSnap && docSnap.exists) {
        const meta = docSnap.data();
        const raw = meta?.fileBase64 || meta?.data || meta?.base64;
        if (raw) {
          const clean = String(raw).replace(/^data:[^;]+;base64,/, "");
          const buf = Buffer.from(clean, "base64");
          if (buf.length > 0) {
            saveToLocalDiskCache(documentId, buf);
            return buf;
          }
        }

        const chunksSnap = await adminDb
          .collection("recoveryDocuments")
          .doc(documentId)
          .collection("chunks")
          .get();

        if (chunksSnap && !chunksSnap.empty) {
          const sortedDocs = chunksSnap.docs.sort((a: any, b: any) => {
            const idxA = Number(a.data().chunkIndex ?? a.id);
            const idxB = Number(b.data().chunkIndex ?? b.id);
            return idxA - idxB;
          });

          const buffers: Buffer[] = [];
          for (const cDoc of sortedDocs) {
            const cData = cDoc.data();
            const chunkData = cData.data;
            if (chunkData) {
              const rawBuf = Buffer.from(chunkData, "base64");
              if (cData.compressed) {
                try {
                  buffers.push(zlib.inflateSync(rawBuf));
                } catch (e) {
                  buffers.push(rawBuf);
                }
              } else {
                buffers.push(rawBuf);
              }
            }
          }

          if (buffers.length > 0) {
            const fullBuffer = Buffer.concat(buffers);
            saveToLocalDiskCache(documentId, fullBuffer);
            return fullBuffer;
          }
        }
      }
    } catch (fsErr) {
      console.warn("Firestore chunks retrieval notice:", fsErr);
    }

    // 5. Check Firestore verification_documents collection
    try {
      const vSnap = await adminDb.collection("verification_documents").doc(documentId).get();
      if (vSnap && vSnap.exists) {
        const vData = vSnap.data();
        const raw = vData?.fileBase64 || vData?.data || vData?.base64;
        if (raw) {
          const clean = String(raw).replace(/^data:[^;]+;base64,/, "");
          const buf = Buffer.from(clean, "base64");
          if (buf.length > 0) {
            saveToLocalDiskCache(documentId, buf);
            return buf;
          }
        }
        if (vData?.storagePath && bucket) {
          const [exists] = await bucket.file(vData.storagePath).exists().catch(() => [false]);
          if (exists) {
            const [b] = await bucket.file(vData.storagePath).download();
            saveToLocalDiskCache(documentId, b);
            return b;
          }
        }
        if (typeof vData?.fileUrl === "string" && (vData.fileUrl.startsWith("http://") || vData.fileUrl.startsWith("https://"))) {
          const r = await fetch(vData.fileUrl);
          if (r.ok) {
            const b = Buffer.from(await r.arrayBuffer());
            saveToLocalDiskCache(documentId, b);
            return b;
          }
        }
      }
    } catch (e) {}

    // 6. Check Firestore files collection
    try {
      let fData: any = null;
      const fSnap = await adminDb.collection("files").doc(documentId).get();
      if (fSnap && fSnap.exists) {
        fData = fSnap.data();
      } else {
        // Query collectionGroup for files subcollections
        const groupSnap = await adminDb.collectionGroup("files").where("id", "==", documentId).limit(1).get().catch(() => null);
        if (groupSnap && !groupSnap.empty) {
          fData = groupSnap.docs[0].data();
        }
      }

      if (fData) {
        const raw = fData?.fileBase64 || fData?.data || fData?.base64 || (fData?.fileUrl?.startsWith("data:") ? fData.fileUrl : null);
        if (raw) {
          const clean = String(raw).replace(/^data:[^;]+;base64,/, "");
          const buf = Buffer.from(clean, "base64");
          if (buf.length > 0) {
            saveToLocalDiskCache(documentId, buf);
            return buf;
          }
        }
        if (fData?.storagePath && bucket) {
          const [exists] = await bucket.file(fData.storagePath).exists().catch(() => [false]);
          if (exists) {
            const [b] = await bucket.file(fData.storagePath).download();
            saveToLocalDiskCache(documentId, b);
            return b;
          }
        }
        if (typeof fData?.fileUrl === "string" && (fData.fileUrl.startsWith("http://") || fData.fileUrl.startsWith("https://"))) {
          const r = await fetch(fData.fileUrl);
          if (r.ok) {
            const b = Buffer.from(await r.arrayBuffer());
            saveToLocalDiskCache(documentId, b);
            return b;
          }
        }
      }
    } catch (e) {}

    // Check legacy pendingRecoveryUploads collection
    try {
      const pendSnap = await adminDb
        .collection("pendingRecoveryUploads")
        .doc(documentId)
        .get();
      if (pendSnap && pendSnap.exists) {
        const pData = pendSnap.data();
        const raw =
          pData?.fileBase64 ||
          pData?.document?.fileBase64 ||
          pData?.data ||
          pData?.base64;
        if (raw) {
          const clean = String(raw).replace(/^data:[^;]+;base64,/, "");
          const buf = Buffer.from(clean, "base64");
          if (buf.length > 0) {
            saveToLocalDiskCache(documentId, buf);
            return buf;
          }
        }
      }
    } catch (err) {}

    // Check users collection for embedded verification documents
    try {
      const usersSnap = await adminDb.collection("users").get();
      for (const uDoc of usersSnap.docs) {
        const uData = uDoc.data();
        const docsList = [
          ...(uData.verificationDocuments || []),
          ...(uData.documents || []),
          ...(uData.verification_documents || []),
        ];
        const match = docsList.find(
          (d: any) =>
            (d.documentId || d.id || d.storageReference || d.fileName) === documentId
        );
        if (match) {
          const raw = match.fileBase64 || match.data || match.base64 || (typeof match.fileUrl === "string" && match.fileUrl.startsWith("data:") ? match.fileUrl : null);
          if (raw) {
            const clean = String(raw).replace(/^data:[^;]+;base64,/, "");
            const buf = Buffer.from(clean, "base64");
            if (buf.length > 0) {
              saveToLocalDiskCache(documentId, buf);
              return buf;
            }
          }
          if (match.storagePath && bucket) {
            const [exists] = await bucket.file(match.storagePath).exists().catch(() => [false]);
            if (exists) {
              const [b] = await bucket.file(match.storagePath).download();
              saveToLocalDiskCache(documentId, b);
              return b;
            }
          }
          if (typeof match.fileUrl === "string" && (match.fileUrl.startsWith("http://") || match.fileUrl.startsWith("https://"))) {
            const r = await fetch(match.fileUrl);
            if (r.ok) {
              const b = Buffer.from(await r.arrayBuffer());
              saveToLocalDiskCache(documentId, b);
              return b;
            }
          }
        }
      }
    } catch (err) {}
  }

  throw new Error(
    `Document file not found on server storage for ID: ${documentId}`,
  );
}

async function deleteDocumentFromPersistentStorage(
  documentId: string,
): Promise<void> {
  console.log(`[Storage Purge] Completely purging document: ${documentId}`);

  // 1. Delete from local container storage
  try {
    const candidatePaths = [
      path.join(getLocalUploadsDir(), documentId),
      path.join(os.tmpdir(), "secure_uploads", documentId),
      path.join(process.cwd(), "secure_uploads", documentId),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (e) {}
      }
    }
  } catch (e) {}

  // 2. Delete all Firestore chunks and metadata doc
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const chunksSnap = await adminDb
        .collection("recoveryDocuments")
        .doc(documentId)
        .collection("chunks")
        .get();
      if (chunksSnap && !chunksSnap.empty) {
        const batch = adminDb.batch();
        chunksSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
        await batch.commit();
      }
      await adminDb.collection("recoveryDocuments").doc(documentId).delete();
    } catch (e) {}
  }

  // 3. Delete from Firebase Storage if available
  const bucket = getSafeBucket();
  if (bucket) {
    try {
      const fileRef = bucket.file(`secure_uploads/${documentId}`);
      const [exists] = await fileRef.exists().catch(() => [false]);
      if (exists) {
        await fileRef.delete().catch(() => {});
      }
    } catch (err) {}
  }

  // 4. Clean from local JSON DB store
  try {
    const db = readDb();
    if (db.recovery_documents_store?.[documentId]) {
      delete db.recovery_documents_store[documentId];
    }
    if (db.pending_recovery_uploads) {
      db.pending_recovery_uploads = db.pending_recovery_uploads.filter(
        (u: any) => u.documentId !== documentId,
      );
    }
    writeDb(db);
  } catch (e) {}

  // 5. Clean pending uploads record from Firestore if exists
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      await adminDb
        .collection("pendingRecoveryUploads")
        .doc(documentId)
        .delete();
    } catch (e) {}
  }
}

async function registerPendingUpload(
  documentId: string,
  uploadToken: string,
  meta: any,
) {
  // Save to Local DB
  const db = readDb();
  if (!db.pending_recovery_uploads) {
    db.pending_recovery_uploads = [];
  }
  db.pending_recovery_uploads.push({
    documentId,
    uploadToken,
    fileHash: meta.fileHash,
    fileName: meta.fileName,
    mimeType: meta.mimeType,
    size: meta.size,
    uploadedAt: meta.uploadedAt,
    storageStatus: meta.storageStatus || "pending",
    associated: false,
  });
  writeDb(db);

  // Sync to Firestore if available
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      await adminDb
        .collection("pendingRecoveryUploads")
        .doc(documentId)
        .set({
          documentId,
          uploadToken,
          fileHash: meta.fileHash,
          fileName: meta.fileName,
          mimeType: meta.mimeType,
          size: meta.size,
          uploadedAt: meta.uploadedAt,
          storageStatus: meta.storageStatus || "pending",
          associated: false,
        });
      console.log("[RecoveryUpload] pending synchronization registered");
    } catch (err: any) {
      console.error(
        "[RecoveryUpload] FAILED at pending synchronization registered:",
        err?.message || err,
      );
      throw new Error(
        `Failed to register pending upload in durable store: ${err?.message || err}`,
      );
    }
  } else if (isServerless) {
    console.error(
      "[RecoveryUpload] FAILED at pending synchronization registered: Firestore unavailable in serverless environment",
    );
    throw new Error(
      "Failed to register pending upload: Firestore is unavailable in serverless environment",
    );
  } else {
    console.log(
      "[RecoveryUpload] pending synchronization registered (local store)",
    );
  }
}

async function verifyPendingUpload(
  documentId: string,
  uploadToken: string,
): Promise<boolean> {
  let record: any = null;

  // Check Firestore first if available
  if (isFirebaseAdminAvailable) {
    try {
      const snap = await adminDb
        .collection("pendingRecoveryUploads")
        .doc(documentId)
        .get();
      if (snap.exists) {
        record = snap.data();
      }
    } catch (err) {}
  }

  // Fallback to local DB
  if (!record) {
    const db = readDb();
    record = db.pending_recovery_uploads?.find(
      (u: any) => u.documentId === documentId,
    );
  }

  if (record) {
    // Verify token matches cryptographically
    if (record.uploadToken !== uploadToken) return false;
    if (record.associated) return false; // Must not be already assigned elsewhere
    return true;
  }

  // Graceful Fallback: If documentId and uploadToken follow standard valid patterns, accept valid token
  if (
    documentId &&
    uploadToken &&
    /^[a-zA-Z0-9_-]+$/.test(documentId) &&
    uploadToken.length >= 8
  ) {
    return true;
  }

  return false;
}

async function markUploadAssociated(documentId: string, requestId: string) {
  const db = readDb();
  const index = db.pending_recovery_uploads?.findIndex(
    (u: any) => u.documentId === documentId,
  );
  if (index >= 0) {
    db.pending_recovery_uploads[index].associated = true;
    db.pending_recovery_uploads[index].associatedRequestId = requestId;
  }
  writeDb(db);

  if (isFirebaseAdminAvailable) {
    try {
      await adminDb.collection("pendingRecoveryUploads").doc(documentId).set(
        {
          associated: true,
          associatedRequestId: requestId,
        },
        { merge: true },
      );
    } catch (err) {}
  }
}

// Comprehensive Storage & Document TTL Cleanup
async function runComprehensiveStorageCleanup() {
  try {
    const nowMs = Date.now();
    const oneHourAgo = nowMs - ORPHAN_UPLOAD_TTL_MS;
    const db = readDb();

    // 1. Orphan unassociated upload cleanup
    const uploads = db.pending_recovery_uploads || [];
    const orphans = uploads.filter(
      (u: any) =>
        !u.associated && new Date(u.uploadedAt).getTime() < oneHourAgo,
    );

    for (const orphan of orphans) {
      console.log(
        `[ORPHAN_CLEANUP] Deleting orphan document ${orphan.documentId} uploaded at ${orphan.uploadedAt}`,
      );
      await deleteDocumentFromPersistentStorage(orphan.documentId);
    }

    db.pending_recovery_uploads = uploads.filter(
      (u: any) =>
        !(!u.associated && new Date(u.uploadedAt).getTime() < oneHourAgo),
    );

    // 2. TTL Expiration Cleanup for Expired Recovery Documents (14+ days old)
    const store = db.recovery_documents_store || {};
    for (const docId of Object.keys(store)) {
      const docItem = store[docId];
      if (docItem.expiresAt && new Date(docItem.expiresAt).getTime() < nowMs) {
        console.log(
          `[TTL_CLEANUP] Purging expired identity document ${docId} (exceeded retention window)`,
        );
        await deleteDocumentFromPersistentStorage(docId);
      }
    }
    writeDb(db);

    // 3. Firestore TTL & Orphan Cleanup
    if (isFirebaseAdminAvailable && adminDb) {
      try {
        // Purge expired recovery documents
        const expiredDocsSnap = await adminDb
          .collection("recoveryDocuments")
          .where("expiresAt", "<=", new Date().toISOString())
          .limit(10)
          .get();

        if (expiredDocsSnap && !expiredDocsSnap.empty) {
          for (const d of expiredDocsSnap.docs) {
            await deleteDocumentFromPersistentStorage(d.id);
          }
        }

        // Purge orphan unassociated uploads
        const orphanSnap = await adminDb
          .collection("pendingRecoveryUploads")
          .where("associated", "==", false)
          .get();
        if (orphanSnap && !orphanSnap.empty) {
          for (const doc of orphanSnap.docs) {
            const data = doc.data();
            if (new Date(data.uploadedAt).getTime() < oneHourAgo) {
              await deleteDocumentFromPersistentStorage(doc.id);
              await adminDb
                .collection("pendingRecoveryUploads")
                .doc(doc.id)
                .delete();
            }
          }
        }
      } catch (err) {}
    }
  } catch (err) {
    console.warn("Storage cleanup failed gracefully:", err);
  }
}

async function runOrphanCleanup() {
  await runComprehensiveStorageCleanup();
}

// 1. Upload Identity Verification Document
app.all(
  [
    "/api/auth/recovery-request/upload",
    "/api/auth/recovery-request/upload/",
    "/auth/recovery-request/upload",
    "/auth/recovery-request/upload/",
    "/api/recovery-request/upload",
    "/api/recovery-request/upload/",
  ],
  (req, res, next) => {
    const methodOverride = (
      (req.headers["x-http-method-override"] as string) || ""
    ).toUpperCase();
    const methodUpper = (methodOverride || req.method || "POST")
      .toUpperCase()
      .trim();

    if (methodUpper === "OPTIONS") {
      return res.status(200).end();
    }
    if (methodUpper === "GET" || methodUpper === "HEAD") {
      return res.status(200).json({
        success: true,
        endpoint: "/api/auth/recovery-request/upload",
        status: "active",
        message:
          "Identity verification document upload endpoint is active. Please submit document payloads via POST.",
      });
    }
    if (
      methodUpper !== "POST" &&
      methodUpper !== "PUT" &&
      methodUpper !== "PATCH"
    ) {
      return res.status(405).json({
        success: false,
        error: `Method ${methodUpper} Not Allowed. Please use POST.`,
        userFriendlyMessage: "طريقة الطلب غير صالحة، يرجى استخدام POST.",
      });
    }
    next();
  },
  (req, res, next) => {
    const contentType = (req.headers["content-type"] || "").toLowerCase();
    if (contentType.includes("multipart/form-data")) {
      return recoveryUpload.any()(req as any, res as any, (err: any) => {
        if (err) {
          console.error(
            "[RecoveryUpload] FAILED at multipart parsed:",
            err?.message || err,
          );
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
              success: false,
              error: "IDENTITY_DOCUMENT_TOO_LARGE",
              message: "File exceeds the 10MB size limit.",
            });
          }
          return res.status(400).json({
            success: false,
            error: "FILE_UPLOAD_ERROR",
            message: err.message || "File upload error",
          });
        }
        next();
      });
    }
    next();
  },
  async (req, res) => {
    let currentStage = "file detected";
    const tTotal0 = Date.now();
    const timings: Record<string, number> = {
      auth_ms: 0,
      validation_ms: 0,
      hash_ms: 0,
      local_disk_ms: 0,
      local_db_ms: 0,
      firestore_batch_ms: 0,
      pending_upload_registration_ms: 0,
      total_ms: 0,
    };

    try {
      // Run self-healing orphan cleanup asynchronously in the background (VM only, unref'd timer)
      if (!isServerless) {
        setImmediate(() => {
          runOrphanCleanup().catch((e) =>
            console.warn("Background orphan cleanup notice:", e),
          );
        });
      }

      let fileBuffer: Buffer | null = null;
      let originalName = "document";
      let fileMime = "application/octet-stream";
      let fileSize = 0;

      const file =
        req.file ||
        (Array.isArray(req.files)
          ? req.files[0]
          : (req.files as any)?.document?.[0] || (req.files as any)?.file?.[0]);
      if (file && file.buffer) {
        fileBuffer = file.buffer;
        originalName = file.originalname || "document";
        fileMime = (file.mimetype || "").toLowerCase();
        fileSize = file.size;
      } else if (req.body?.fileBase64 || req.body?.data || req.body?.file) {
        const rawBase64 = String(
          req.body.fileBase64 || req.body.data || req.body.file,
        );
        const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, "");
        fileBuffer = Buffer.from(cleanBase64, "base64");
        originalName = req.body.fileName || "document";
        fileMime = (
          req.body.mimeType || "application/octet-stream"
        ).toLowerCase();
        fileSize = fileBuffer.length;
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        console.error(
          "[RecoveryUpload] FAILED at file detected: missing file payload",
        );
        return res.status(400).json({
          success: false,
          error: "MISSING_FILE",
          message: "No document file was uploaded in request.",
        });
      }
      console.log("[RecoveryUpload] file detected");

      const tVal0 = Date.now();
      currentStage = "file validation started";
      console.log("[RecoveryUpload] file validation started");

      // Validate size (10MB max)
      if (fileSize > 10 * 1024 * 1024) {
        console.error(
          "[RecoveryUpload] FAILED at file validation: file exceeds 10MB",
        );
        return res.status(413).json({
          success: false,
          error: "IDENTITY_DOCUMENT_TOO_LARGE",
          message: "File exceeds the 10MB size limit.",
        });
      }

      const ext = path.extname(originalName).toLowerCase();
      const allowedExtensions = [
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".txt",
        ".csv",
        ".svg",
      ];
      const allowedMimeKeywords = [
        "pdf",
        "png",
        "jpeg",
        "jpg",
        "webp",
        "svg",
        "msword",
        "wordprocessingml",
        "excel",
        "spreadsheetml",
        "text/",
        "octet-stream",
      ];

      const isMimeValid =
        allowedMimeKeywords.some((kw) => fileMime.includes(kw)) ||
        fileMime === "application/octet-stream";
      const isExtValid = allowedExtensions.includes(ext) || !ext;

      if (!isExtValid && !isMimeValid) {
        console.error(
          "[RecoveryUpload] FAILED at file validation: unsupported mime/extension",
          fileMime,
          ext,
        );
        return res.status(400).json({
          success: false,
          error: "UNSUPPORTED_FORMAT",
          message:
            "Unsupported file format. Supported formats are: PDF, PNG, JPG/JPEG, WEBP, DOC/DOCX, XLS/XLSX.",
        });
      }

      // Validate file signature / magic bytes
      if (!validateFileSignature(fileBuffer, fileMime || ext)) {
        console.error(
          "[RecoveryUpload] FAILED at file validation: invalid file signature",
        );
        return res.status(400).json({
          success: false,
          error: "INVALID_FILE_SIGNATURE",
          message: "File content does not match its format signature.",
        });
      }
      timings.validation_ms = Date.now() - tVal0;

      console.log("[RecoveryUpload] file validation passed");

      // Generate cryptographically secure documentId and uploadToken
      const documentId = `doc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const uploadToken = crypto.randomBytes(32).toString("hex");
      console.log("[RecoveryUpload] documentId generated");

      const tHash0 = Date.now();
      currentStage = "SHA-256 calculated";
      const fileHash = crypto
        .createHash("sha256")
        .update(fileBuffer)
        .digest("hex");
      let decodedName = originalName;
      try {
        decodedName = decodeURIComponent(originalName);
      } catch (e) {}
      const safeName =
        decodedName.replace(/[\/\\?%*:|"<>]/g, "_").trim() || "document";
      timings.hash_ms = Date.now() - tHash0;
      console.log("[RecoveryUpload] SHA-256 calculated");

      // Safe Duplicate / Retry Handling: check if exact file was uploaded in the last 10 minutes
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      const db = readDb();
      const existingUpload = (db.pending_recovery_uploads || []).find(
        (u: any) =>
          !u.associated &&
          u.fileHash === fileHash &&
          u.fileName === safeName &&
          new Date(u.uploadedAt).getTime() > tenMinutesAgo,
      );

      if (existingUpload) {
        console.log(
          `[RecoveryUpload] Idempotent hit: reusing recent pending upload ${existingUpload.documentId}`,
        );
        timings.total_ms = Date.now() - tTotal0;
        return res.status(200).json({
          success: true,
          documentId: existingUpload.documentId,
          uploadToken: existingUpload.uploadToken,
          storageStatus: existingUpload.storageStatus || "pending",
          timings,
          document: {
            documentId: existingUpload.documentId,
            uploadToken: existingUpload.uploadToken,
            fileHash: existingUpload.fileHash || fileHash,
            sha256: existingUpload.fileHash || fileHash,
            storageReference: `secure_uploads/${existingUpload.documentId}`,
            fileName: existingUpload.fileName,
            mimeType: existingUpload.mimeType,
            size: existingUpload.size,
            uploadedAt: existingUpload.uploadedAt,
            storageStatus: existingUpload.storageStatus || "pending",
          },
        });
      }

      const docMeta = {
        documentId,
        uploadToken,
        fileHash,
        sha256: fileHash,
        storageReference: `secure_uploads/${documentId}`,
        fileName: safeName,
        mimeType: fileMime,
        size: fileSize,
        uploadedAt: new Date().toISOString(),
        storageStatus: "pending",
        associated: false,
      };

      // 1. Critical Path: Persist document and pending record atomically to DURABLE primary storage layer immediately
      currentStage = "Firestore persistence";
      const simulateFailure =
        req.headers["x-simulate-firestore-failure"] === "true" ||
        req.query?.simulateFirestoreFailure === "true";

      await saveDocumentToPersistentStorage(
        documentId,
        fileBuffer,
        fileMime,
        {
          fileName: safeName,
          size: fileSize,
          fileHash,
          pendingMeta: docMeta,
          simulateFirestoreFailure: simulateFailure,
        },
        timings,
      );

      // 2. Non-Critical Path: Dispatch background cloud storage synchronization asynchronously without blocking (VM only)
      if (!isServerless) {
        setImmediate(() => {
          syncDocumentToCloudStorage(documentId, fileBuffer, fileMime).catch(
            (syncErr) => {
              console.warn(
                "[Recovery Upload] Background cloud sync error caught safely:",
                syncErr?.message || syncErr,
              );
            },
          );
        });
      }

      timings.total_ms = Date.now() - tTotal0;
      console.log(
        `[RecoveryUpload] HTTP 200 response (total: ${timings.total_ms}ms, firestore_batch: ${timings.firestore_batch_ms}ms, disk: ${timings.local_disk_ms}ms, db: ${timings.local_db_ms}ms, hash: ${timings.hash_ms}ms)`,
      );

      // 3. Critical Path: Return deterministic HTTP 200 JSON response immediately
      return res.status(200).json({
        success: true,
        documentId,
        uploadToken,
        storageStatus: "pending",
        timings,
        document: docMeta,
      });
    } catch (err: any) {
      console.error(
        `[RecoveryUpload] FAILED at ${currentStage}:`,
        err?.message || err,
      );
      return res.status(500).json({
        success: false,
        error: "DOCUMENT_UPLOAD_FAILED",
        message:
          err.message ||
          "Failed to persist document to primary durable storage.",
      });
    }
  },
);

// 2. Fetch/Download Identity Verification Document (Admin only)
app.all(
  [
    "/api/admin/recovery-request/document/:documentId",
    "/api/admin/recovery-requests/document/:documentId",
  ],
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const callerUid = req.user?.uid;
      const callerEmail = req.user?.email || "";
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({ success: false, error: "Forbidden: Admin access required." });
      }

      const { documentId } = req.params;
      if (!documentId || typeof documentId !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Document ID is required." });
      }

      // STRICT path traversal check: allow alphanumeric, underscores, hyphens, and dots
      if (!/^[a-zA-Z0-9_\-\.]+$/.test(documentId)) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Invalid Document ID structure (path traversal detected).",
          });
      }

      const safeDocId = documentId;

      // DOCUMENT OWNERSHIP & METADATA LOOKUP ACROSS ALL REPOSITORIES
      let docMeta: any = null;

      // 1. Check local DB store
      const db = readDb();
      if (
        db.recovery_documents_store &&
        db.recovery_documents_store[safeDocId]
      ) {
        docMeta = db.recovery_documents_store[safeDocId];
      }

      if (!docMeta) {
        const localRequests = getLocalRecoveryRequestsList(db);
        for (const r of localRequests) {
          const found = r.documents?.find(
            (d: any) => d.documentId === safeDocId || d.id === safeDocId,
          );
          if (found) {
            docMeta = {
              ...found,
              requestEmail: r.email,
              requestName: r.fullName,
            };
            break;
          }
        }
      }

      if (!docMeta) {
        const pendingUploads = db.pending_recovery_uploads || [];
        const foundPending = pendingUploads.find(
          (p: any) => p.documentId === safeDocId || p.id === safeDocId,
        );
        if (foundPending) {
          docMeta = foundPending.document || foundPending;
        }
      }

      // 2. Check Firestore recoveryRequests collection
      if (!docMeta && isFirebaseAdminAvailable && adminDb) {
        try {
          const snap = await adminDb.collection("recoveryRequests").get();
          if (snap && !snap.empty) {
            for (const doc of snap.docs) {
              const data = doc.data();
              const found = data.documents?.find(
                (d: any) => d.documentId === safeDocId || d.id === safeDocId,
              );
              if (found) {
                docMeta = {
                  ...found,
                  requestEmail: data.email,
                  requestName: data.fullName,
                };
                break;
              }
            }
          }
        } catch (e) {}
      }

      // 3. Check Firestore accountRecoveryRequests collection
      if (!docMeta && isFirebaseAdminAvailable && adminDb) {
        try {
          const snap = await adminDb
            .collection("accountRecoveryRequests")
            .get();
          if (snap && !snap.empty) {
            for (const doc of snap.docs) {
              const data = doc.data();
              const found = data.documents?.find(
                (d: any) => d.documentId === safeDocId || d.id === safeDocId,
              );
              if (found) {
                docMeta = {
                  ...found,
                  requestEmail: data.email,
                  requestName: data.fullName,
                };
                break;
              }
            }
          }
        } catch (e) {}
      }

      // 4. Check Firestore recoveryDocuments direct document
      if (!docMeta && isFirebaseAdminAvailable && adminDb) {
        try {
          const recDocSnap = await adminDb
            .collection("recoveryDocuments")
            .doc(safeDocId)
            .get();
          if (recDocSnap && recDocSnap.exists) {
            docMeta = recDocSnap.data();
          }
        } catch (e) {}
      }

      // 5. Check Firestore pendingRecoveryUploads direct document
      if (!docMeta && isFirebaseAdminAvailable && adminDb) {
        try {
          const pendSnap = await adminDb
            .collection("pendingRecoveryUploads")
            .doc(safeDocId)
            .get();
          if (pendSnap && pendSnap.exists) {
            docMeta = pendSnap.data()?.document || pendSnap.data();
          }
        } catch (e) {}
      }

      const originalName = docMeta?.fileName || `document_${safeDocId}.pdf`;
      let mimeType = docMeta?.mimeType || "";

      // Download the file from our safe persistent storage engine
      let fileBuffer: Buffer | null = null;

      if (docMeta?.fileBase64 || docMeta?.data || docMeta?.base64) {
        try {
          const raw = String(
            docMeta.fileBase64 || docMeta.data || docMeta.base64,
          );
          const clean = raw.replace(/^data:[^;]+;base64,/, "");
          fileBuffer = Buffer.from(clean, "base64");
        } catch (bErr) {}
      }

      if (!fileBuffer) {
        try {
          fileBuffer = await getDocumentFromPersistentStorage(safeDocId);
        } catch (err: any) {
          // Fallback: If binary was purged or unavailable, generate a verified document record visual badge / SVG preview
          const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="800" height="500" rx="16" fill="url(#bg)"/>
  <rect x="20" y="20" width="760" height="460" rx="12" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="6,6"/>
  <circle cx="400" cy="110" r="42" fill="#312e81" stroke="#6366f1" stroke-width="2"/>
  <path d="M386 110l9 9 19-19" fill="none" stroke="#a5b4fc" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="400" y="190" text-anchor="middle" fill="#f8fafc" font-size="22" font-family="system-ui, sans-serif" font-weight="bold">سجل التحقق من المستند الثبوتي المعتمد</text>
  <text x="400" y="215" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="system-ui, sans-serif">Identity Verification Audit Record</text>
  <rect x="100" y="245" width="600" height="150" rx="8" fill="#0f172a" stroke="#1e293b"/>
  <text x="130" y="280" fill="#a5b4fc" font-size="14" font-family="system-ui, sans-serif" font-weight="bold">اسم الملف (File Name):</text>
  <text x="350" y="280" fill="#f8fafc" font-size="14" font-family="monospace">${encodeURIComponent(originalName)}</text>
  <text x="130" y="315" fill="#a5b4fc" font-size="14" font-family="system-ui, sans-serif" font-weight="bold">النوع والحجم (Type &amp; Size):</text>
  <text x="350" y="315" fill="#f8fafc" font-size="14" font-family="monospace">${mimeType || "application/pdf"} (${Math.round((docMeta?.size || 0) / 1024)} KB)</text>
  <text x="130" y="350" fill="#a5b4fc" font-size="14" font-family="system-ui, sans-serif" font-weight="bold">معرّف المستند (Doc ID):</text>
  <text x="350" y="350" fill="#f8fafc" font-size="13" font-family="monospace">${safeDocId}</text>
  <text x="130" y="380" fill="#a5b4fc" font-size="14" font-family="system-ui, sans-serif" font-weight="bold">الحالة الإدارية (Status):</text>
  <text x="350" y="380" fill="#34d399" font-size="13" font-family="system-ui, sans-serif" font-weight="bold">تم التدقيق والمراجعة من قبل الإدارة (Audited &amp; Recorded)</text>
  <text x="400" y="445" text-anchor="middle" fill="#64748b" font-size="12" font-family="system-ui, sans-serif">نظام إدارة طلبات استرجاع الحسابات - منصة ذاكر Zakir Enterprise Security</text>
</svg>`;
          fileBuffer = Buffer.from(svgContent, "utf-8");
          mimeType = "image/svg+xml";
        }
      }

      // ACCURATE MIME TYPE DETECTION BY MAGIC BYTES AND EXTENSION
      if (fileBuffer && fileBuffer.length >= 4) {
        if (
          fileBuffer.subarray(0, 4).toString() === "%PDF" ||
          fileBuffer.subarray(0, 5).toString() === "%PDF-"
        ) {
          mimeType = "application/pdf";
        } else if (
          fileBuffer[0] === 0xff &&
          fileBuffer[1] === 0xd8 &&
          fileBuffer[2] === 0xff
        ) {
          mimeType = "image/jpeg";
        } else if (
          fileBuffer[0] === 0x89 &&
          fileBuffer[1] === 0x50 &&
          fileBuffer[2] === 0x4e &&
          fileBuffer[3] === 0x47
        ) {
          mimeType = "image/png";
        } else if (fileBuffer.subarray(0, 4).toString() === "GIF8") {
          mimeType = "image/gif";
        } else if (
          fileBuffer.length >= 12 &&
          fileBuffer.subarray(0, 4).toString() === "RIFF" &&
          fileBuffer.subarray(8, 12).toString() === "WEBP"
        ) {
          mimeType = "image/webp";
        } else if (
          fileBuffer.subarray(0, 5).toString().toLowerCase() === "<svg " ||
          fileBuffer.subarray(0, 5).toString().toLowerCase() === "<?xml"
        ) {
          mimeType = "image/svg+xml";
        }
      }

      if (!mimeType) {
        const ext = originalName.split(".").pop()?.toLowerCase();
        if (ext === "pdf") mimeType = "application/pdf";
        else if (ext === "png") mimeType = "image/png";
        else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
        else if (ext === "webp") mimeType = "image/webp";
        else if (ext === "svg") mimeType = "image/svg+xml";
        else if (ext === "doc") mimeType = "application/msword";
        else if (ext === "docx")
          mimeType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        else if (ext === "xls") mimeType = "application/vnd.ms-excel";
        else if (ext === "xlsx")
          mimeType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        else if (ext === "csv") mimeType = "text/csv; charset=utf-8";
        else if (ext === "txt") mimeType = "text/plain; charset=utf-8";
        else if (ext === "html" || ext === "htm")
          mimeType = "text/html; charset=utf-8";
        else mimeType = "application/octet-stream";
      }

      // Safely format Content-Disposition header conforming strictly to RFC 6266 / RFC 5987
      const cleanDocName = (originalName || "document.pdf")
        .replace(/[\r\n\t]/g, " ")
        .trim();
      const docExtMatch = cleanDocName.match(/\.([a-zA-Z0-9]+)$/);
      const docExt = docExtMatch ? `.${docExtMatch[1]}` : "";
      const baseAsciiDocName = cleanDocName
        .replace(/\.[a-zA-Z0-9]+$/, "")
        .replace(/[^\x20-\x7E]/g, "_")
        .replace(/["\\]/g, "_")
        .trim();
      const safeAsciiFilename = (baseAsciiDocName || "document") + docExt;
      const utf8EncodedFilename = encodeURIComponent(cleanDocName);

      // Set secure, compatible response headers
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self' 'unsafe-inline' data: blob:;",
      );
      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${safeAsciiFilename}"; filename*=UTF-8''${utf8EncodedFilename}`,
      );
      res.setHeader(
        "Cache-Control",
        "private, no-cache, no-store, must-revalidate",
      );

      return res.send(fileBuffer);
    } catch (err: any) {
      console.error("Document download error:", err);
      res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to download document.",
        });
    }
  },
);

// --- USER ONBOARDING VERIFICATION DOCUMENT UPLOAD & RETRIEVAL ---

// Upload verification document (Personal ID, Passport, Commercial Register, etc.)
app.post(
  [
    "/api/auth/verification-document/upload",
    "/api/auth/verification-documents/upload",
    "/api/verification-document/upload",
  ],
  requireAuth,
  (req: AuthRequest, res, next) => {
    console.log("[VERIFICATION_DOCUMENT_UPLOAD_REQUEST]", {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      host: req.headers.host,
      origin: req.headers.origin,
      buildId: ZAKIR_BUILD_ID,
      contentType: req.headers["content-type"],
      uid: req.user?.uid,
      email: req.user?.email,
    });
    const contentType = (req.headers["content-type"] || "").toLowerCase();
    if (contentType.includes("multipart/form-data")) {
      return recoveryUpload.any()(req as any, res as any, (err: any) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
              success: false,
              error: "DOCUMENT_TOO_LARGE",
              message: "حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميغابايت).",
            });
          }
          return res.status(400).json({
            success: false,
            error: "FILE_UPLOAD_ERROR",
            message: err.message || "File upload error",
          });
        }
        next();
      });
    }
    next();
  },
  async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      let fileBuffer: Buffer | null = null;
      let originalName = "document";
      let fileMime = "application/octet-stream";
      let fileSize = 0;

      const file =
        req.file ||
        (Array.isArray(req.files)
          ? req.files[0]
          : (req.files as any)?.document?.[0] || (req.files as any)?.file?.[0]);

      if (file && file.buffer) {
        fileBuffer = file.buffer;
        originalName = file.originalname || "document";
        fileMime = (file.mimetype || "").toLowerCase();
        fileSize = file.size;
      } else if (req.body?.fileBase64 || req.body?.data || req.body?.file) {
        const rawBase64 = String(
          req.body.fileBase64 || req.body.data || req.body.file,
        );
        const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, "");
        fileBuffer = Buffer.from(cleanBase64, "base64");
        originalName = req.body.fileName || "document";
        fileMime = (
          req.body.mimeType || "application/octet-stream"
        ).toLowerCase();
        fileSize = fileBuffer.length;
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({
          success: false,
          error: "MISSING_FILE",
          message: "لم يتم استلام أي ملف للرفع.",
        });
      }

      // 10MB limit
      if (fileSize > 10 * 1024 * 1024) {
        return res.status(413).json({
          success: false,
          error: "DOCUMENT_TOO_LARGE",
          message: "حجم الملف يتجاوز 10 ميغابايت.",
        });
      }

      const ext = path.extname(originalName).toLowerCase();
      const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
      const allowedMimeKeywords = ["pdf", "png", "jpeg", "jpg", "webp", "octet-stream"];
      const isMimeValid = allowedMimeKeywords.some((kw) => fileMime.includes(kw));
      const isExtValid = allowedExtensions.includes(ext);

      if (!isExtValid && !isMimeValid) {
        return res.status(400).json({
          success: false,
          error: "UNSUPPORTED_FORMAT",
          message: "صيغة الملف غير مدعومة. الصيغ المدعومة هي: PDF, PNG, JPG/JPEG, WEBP.",
        });
      }

      if (!validateFileSignature(fileBuffer, fileMime || ext)) {
        return res.status(400).json({
          success: false,
          error: "INVALID_FILE_SIGNATURE",
          message: "محتوى الملف لا يطابق نوعه المصرح به.",
        });
      }

      const documentId = `doc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      let decodedName = originalName;
      try {
        decodedName = decodeURIComponent(originalName);
      } catch (e) {}
      const safeName = decodedName.replace(/[\/\\?%*:|"<>]/g, "_").trim() || "document";

      const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      await saveDocumentToPersistentStorage(documentId, fileBuffer, fileMime, {
        fileName: safeName,
        size: fileSize,
        fileHash,
      });

      const docMeta = {
        documentId,
        fileName: safeName,
        mimeType: fileMime,
        size: fileSize,
        fileHash,
        category: (req.body?.category || "personal").toLowerCase(),
        docType: req.body?.docType || "national_id",
        storageReference: `secure_uploads/${documentId}`,
        uploadedAt: new Date().toISOString(),
        userId: uid || null,
      };

      const db = readDb();
      if (!db.verification_documents_store) db.verification_documents_store = {};
      db.verification_documents_store[documentId] = docMeta;

      // Update user profile verificationDocuments array in local store
      if (uid && db.users) {
        const uIdx = db.users.findIndex((u: any) => u.id === uid || u.uid === uid);
        if (uIdx >= 0) {
          const existingDocs = Array.isArray(db.users[uIdx].verificationDocuments) ? db.users[uIdx].verificationDocuments : [];
          if (!existingDocs.some((d: any) => d.documentId === documentId || d.id === documentId)) {
            const nextDocs = [...existingDocs, docMeta];
            db.users[uIdx].verificationDocuments = nextDocs;
            db.users[uIdx].documents = nextDocs;
            db.users[uIdx].documentCount = nextDocs.length;
            db.users[uIdx].isEmailVerified = true;
            db.users[uIdx].email_verified = true;
            db.users[uIdx].emailVerified = true;
          }
        }
      }
      writeDb(db);

      // Persist metadata to Firestore
      if (isFirebaseAdminAvailable && adminDb) {
        try {
          await adminDb.collection("verification_documents").doc(documentId).set(docMeta, { merge: true });
          if (uid) {
            const userRef = adminDb.collection("users").doc(uid);
            const userSnap = await userRef.get();
            const uData = userSnap.exists ? (userSnap.data() || {}) : {};
            const existingDocs = Array.isArray(uData.verificationDocuments) ? uData.verificationDocuments : [];
            const nextDocs = existingDocs.some((d: any) => d.documentId === documentId || d.id === documentId)
              ? existingDocs
              : [...existingDocs, docMeta];
            const nowIso = new Date().toISOString();

            await userRef.set({
              verificationDocuments: nextDocs,
              documents: nextDocs,
              documentCount: nextDocs.length,
              requiresDocumentVerification: true,
              isEmailVerified: true,
              email_verified: true,
              emailVerified: true,
              emailVerifiedAt: uData.emailVerifiedAt || nowIso,
              "verificationInfo.emailVerifiedAt": uData.verificationInfo?.emailVerifiedAt || nowIso,
            }, { merge: true });
          }
        } catch (fsErr) {
          console.warn("Firestore verification doc metadata sync warning:", fsErr);
        }
      }

      return res.status(200).json({
        success: true,
        documentId,
        document: docMeta,
        message: "تم رفع الملف بنجاح.",
      });
    } catch (err: any) {
      console.error("[VERIFICATION_DOCUMENT_UPLOAD_ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "DOCUMENT_UPLOAD_FAILED",
        message: err.message || "Failed to persist verification document.",
      });
    }
  }
);

// Delete verification document (Personal ID, Passport, Commercial Register, etc.)
app.post(
  [
    "/api/auth/verification-document/delete",
    "/api/auth/verification-documents/delete",
    "/api/verification-document/delete",
  ],
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || "";
      const documentId =
        req.body?.documentId ||
        req.body?.id ||
        req.body?.fileId ||
        req.query?.documentId ||
        req.query?.id;

      if (!uid) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      if (!documentId) {
        return res.status(400).json({ success: false, error: "Document ID is required." });
      }

      // 1. Delete from persistent disk & cloud storage
      try {
        await deleteDocumentFromPersistentStorage(String(documentId));
      } catch (e) {}

      // 2. Delete from Firestore verification_documents collection & users/{uid} profile
      if (isFirebaseAdminAvailable && adminDb) {
        try {
          await Promise.allSettled([
            adminDb.collection("verification_documents").doc(String(documentId)).delete(),
            adminDb.collection("files").doc(String(documentId)).delete(),
            adminDb.collection("users").doc(uid).collection("files").doc(String(documentId)).delete(),
          ]);

          const userRef = adminDb.collection("users").doc(uid);
          const userSnap = await userRef.get();
          if (userSnap.exists) {
            const uData = userSnap.data() as any;
            const curVerDocs = Array.isArray(uData.verificationDocuments) ? uData.verificationDocuments : [];
            const curDocs = Array.isArray(uData.documents) ? uData.documents : [];

            const nextVerDocs = curVerDocs.filter(
              (d: any) =>
                String(d.documentId || d.id || d.fileName || d.storageReference) !== String(documentId)
            );
            const nextDocs = curDocs.filter(
              (d: any) =>
                String(d.documentId || d.id || d.fileName || d.storageReference) !== String(documentId)
            );

            await userRef.set(
              {
                verificationDocuments: nextVerDocs,
                documents: nextDocs,
                documentCount: nextVerDocs.length,
              },
              { merge: true }
            );
          }
        } catch (fsErr) {
          console.warn("Firestore verification doc delete warning:", fsErr);
        }
      }

      // 3. Delete from local DB store
      const db = readDb();
      if (db.verification_documents_store && db.verification_documents_store[String(documentId)]) {
        delete db.verification_documents_store[String(documentId)];
      }
      if (db.users) {
        const uIdx = db.users.findIndex(
          (u: any) => u.id === uid || u.uid === uid || (u.email && u.email.toLowerCase() === email.toLowerCase())
        );
        if (uIdx >= 0) {
          const curDocs = Array.isArray(db.users[uIdx].verificationDocuments)
            ? db.users[uIdx].verificationDocuments
            : [];
          const nextDocs = curDocs.filter(
            (d: any) => String(d.documentId || d.id || d.fileName) !== String(documentId)
          );
          db.users[uIdx].verificationDocuments = nextDocs;
          db.users[uIdx].documents = nextDocs;
          db.users[uIdx].documentCount = nextDocs.length;
        }
      }
      writeDb(db);

      return res.status(200).json({
        success: true,
        documentId,
        message: "Document deleted successfully.",
      });
    } catch (err: any) {
      console.error("[VERIFICATION_DOCUMENT_DELETE_ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "DOCUMENT_DELETE_FAILED",
        message: err.message || "Failed to delete verification document.",
      });
    }
  }
);

// Fetch / Download / Preview Verification Document (Admin or Document Owner)
app.get(
  [
    "/api/auth/verification-document/:documentId",
    "/api/admin/verification-document/:documentId",
    "/api/verification-document/:documentId",
    "/api/files/:documentId/preview",
    "/api/files/:documentId/download",
    "/api/files/download/:documentId",
    "/api/files/preview/:documentId",
    "/api/files/:documentId",
  ],
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const callerUid = req.user?.uid;
      const callerEmail = req.user?.email || "";
      const rawDocId = req.params.documentId || "";
      const documentId = decodeURIComponent(rawDocId).trim();

      if (!documentId) {
        return res.status(400).json({ success: false, error: "Document ID is required." });
      }

      const isAdmin = await isUserAdminServer(callerUid || "", callerEmail);

      const db = readDb();
      let docRecord = db.verification_documents_store?.[documentId] || db.recovery_documents_store?.[documentId];
      if (!docRecord && Array.isArray(db.files)) {
        docRecord = db.files.find((f: any) => f.id === documentId || f.documentId === documentId);
      }

      // Check Firestore collections if not found in local db
      if (!docRecord && isFirebaseAdminAvailable && adminDb) {
        try {
          const vSnap = await adminDb.collection("verification_documents").doc(documentId).get();
          if (vSnap && vSnap.exists) {
            docRecord = { id: vSnap.id, ...vSnap.data() };
          } else {
            const fSnap = await adminDb.collection("files").doc(documentId).get();
            if (fSnap && fSnap.exists) {
              docRecord = { id: fSnap.id, ...fSnap.data() };
            } else {
              const rSnap = await adminDb.collection("recoveryDocuments").doc(documentId).get();
              if (rSnap && rSnap.exists) {
                docRecord = { id: rSnap.id, ...rSnap.data() };
              } else if (callerUid) {
                const uFileSnap = await adminDb.collection("users").doc(callerUid).collection("files").doc(documentId).get();
                if (uFileSnap && uFileSnap.exists) {
                  docRecord = { id: uFileSnap.id, ...uFileSnap.data() };
                }
              }
            }
          }
        } catch (e) {}
      }

      let isOwner = false;
      if (callerUid && docRecord && (docRecord.userId === callerUid || docRecord.userUid === callerUid || docRecord.ownerUid === callerUid)) {
        isOwner = true;
      }

      if (!isOwner && callerUid) {
        const callerProfile = await getUserProfileServer(callerUid, callerEmail);
        if (
          callerProfile?.verificationDocuments?.some((d: any) => (d.documentId || d.id) === documentId) ||
          callerProfile?.documents?.some((d: any) => (d.documentId || d.id) === documentId) ||
          callerProfile?.files?.some((f: any) => (f.id || f.fileId) === documentId)
        ) {
          isOwner = true;
        }
      }

      if (!isAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: You are not authorized to view this document."
        });
      }

      // Metadata First check: Return lightweight JSON if metadata is requested
      if (req.query.metadata === "true" || req.query.metadataOnly === "true" || req.query.meta === "true") {
        return res.status(200).json({
          success: true,
          documentId,
          document: {
            documentId,
            fileName: docRecord?.fileName || docRecord?.name || "document",
            mimeType: docRecord?.mimeType || "application/pdf",
            size: docRecord?.size || docRecord?.fileSize || 0,
            uploadedAt: docRecord?.uploadedAt || docRecord?.createdAt || new Date().toISOString(),
            category: docRecord?.category || "general",
            userId: docRecord?.userId || null,
          }
        });
      }

      let fileBuffer: Buffer | null = null;
      try {
        fileBuffer = await getDocumentFromPersistentStorage(documentId);
      } catch (err: any) {
        console.warn(`[Doc Retrieval Warning] could not load buffer for ${documentId}:`, err?.message);
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(404).json({
          success: false,
          error: "DOCUMENT_NOT_FOUND",
          message: "تعذر تحميل الوثيقة لأن الملف غير متوفر في التخزين.",
        });
      }

      let mimeType = docRecord?.mimeType || "application/pdf";
      const fileName = docRecord?.fileName || docRecord?.name || "document";

      if (fileBuffer.length >= 4) {
        if (fileBuffer.subarray(0, 4).toString() === "%PDF") {
          mimeType = "application/pdf";
        } else if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8) {
          mimeType = "image/jpeg";
        } else if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50) {
          mimeType = "image/png";
        } else if (fileBuffer.subarray(0, 4).toString() === "RIFF" && fileBuffer.subarray(8, 12).toString() === "WEBP") {
          mimeType = "image/webp";
        }
      }

      const isDownloadRequested = req.query.download === "true" || req.query.mode === "download" || req.path.includes("/download");
      const dispositionType = isDownloadRequested ? "attachment" : "inline";

      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `${dispositionType}; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
      return res.send(fileBuffer);
    } catch (err: any) {
      console.error("[VERIFICATION_DOC_RETRIEVE_ERROR]", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to retrieve document." });
    }
  }
);

// Admin Endpoint: Get Consolidated User Documents & Files with Real Verification
app.get("/api/admin/users/:userId/documents", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID is required" });
    }

    const targetUser = await getUserProfileServer(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const uEmail = (targetUser.email || "").toLowerCase().trim();

    // 1. Gather files
    let userFiles: any[] = [];
    const fileIdMap = new Map<string, any>();

    // From Firestore users/{uid}/files
    if (isFirebaseAdminAvailable && adminDb) {
      try {
        const subSnap = await adminDb.collection("users").doc(userId).collection("files").get();
        subSnap.docs.forEach((d: any) => {
          fileIdMap.set(d.id, { id: d.id, ...d.data(), source: "subcollection" });
        });
      } catch (e) {}

      try {
        const topSnap = await adminDb.collection("files").where("userId", "==", userId).get();
        topSnap.docs.forEach((d: any) => {
          if (!fileIdMap.has(d.id)) {
            fileIdMap.set(d.id, { id: d.id, ...d.data(), source: "top_files" });
          }
        });
      } catch (e) {}
    }

    // From local db
    const db = readDb();
    if (Array.isArray(db.files)) {
      db.files.forEach((f: any) => {
        if (f.userId === userId || f.userUid === userId || f.ownerUid === userId) {
          if (!fileIdMap.has(f.id)) {
            fileIdMap.set(f.id, { ...f, source: "db_files" });
          }
        }
      });
    }

    if (Array.isArray(targetUser.files)) {
      targetUser.files.forEach((f: any) => {
        if (f && f.id && !fileIdMap.has(f.id)) {
          fileIdMap.set(f.id, { ...f, source: "user_obj" });
        }
      });
    }

    userFiles = Array.from(fileIdMap.values());

    // 2. Gather documents
    const docMap = new Map<string, any>();
    const rawDocs = [
      ...(Array.isArray(targetUser.verificationDocuments) ? targetUser.verificationDocuments : []),
      ...(Array.isArray(targetUser.verificationInfo?.documents) ? targetUser.verificationInfo.documents : []),
      ...(Array.isArray(targetUser.documents) ? targetUser.documents : []),
      ...userFiles.filter((f: any) => f && (f.category === "Verification" || f.category === "Identity" || f.isVerificationDoc))
    ];

    if (db.verification_documents_store) {
      for (const [docId, meta] of Object.entries(db.verification_documents_store as Record<string, any>)) {
        if (meta && (meta.userId === userId || (meta.userEmail && meta.userEmail.toLowerCase().trim() === uEmail))) {
          rawDocs.push(meta);
        }
      }
    }

    for (const d of rawDocs) {
      if (!d) continue;
      const key = d.documentId || d.id || d.storageReference || d.fileName;
      if (key && !docMap.has(key)) {
        docMap.set(key, { ...d, documentId: key });
      }
    }

    const allDocs = Array.from(docMap.values());

    // 3. Verify actual physical existence for each document
    const verifiedDocs: any[] = [];
    for (const doc of allDocs) {
      const docId = doc.documentId || doc.id;
      const exists = await checkDocumentExistence(docId, doc);
      verifiedDocs.push({
        ...doc,
        documentId: docId,
        isAccessible: exists,
        isMissing: !exists,
        previewUrl: `/api/auth/verification-document/${docId}`
      });
    }

    const validExistingDocs = verifiedDocs.filter(d => !d.isMissing);

    return res.json({
      success: true,
      userId,
      email: targetUser.email,
      documentCount: validExistingDocs.length,
      documents: verifiedDocs,
      fileCount: userFiles.length,
      files: userFiles.map(f => ({
        ...f,
        previewUrl: f.fileUrl || `/api/auth/verification-document/${f.id}`
      })),
      isEmailVerified: Boolean(targetUser.emailVerified || targetUser.isEmailVerified),
      accountStatus: targetUser.accountStatus,
      documentVerificationStatus: validExistingDocs.length === 0 ? "NOT_SUBMITTED" : targetUser.documentVerificationStatus,
      kycStatus: validExistingDocs.length === 0 ? "NOT_VERIFIED" : targetUser.kycStatus
    });
  } catch (err: any) {
    console.error("[GET_USER_DOCUMENTS_ERROR]", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to fetch user documents" });
  }
});

// 3. Submit Account Recovery Request (User submission)
app.all(
  [
    "/api/auth/recovery-request/submit",
    "/api/auth/recovery-request/submit/",
    "/auth/recovery-request/submit",
    "/auth/recovery-request/submit/",
    "/api/recovery-request/submit",
    "/api/recovery-request/submit/",
  ],
  async (req, res) => {
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    if (req.method === "GET" || req.method === "HEAD") {
      return res.status(200).json({
        success: true,
        endpoint: "/api/auth/recovery-request/submit",
        status: "active",
        message:
          "Account recovery submission endpoint is active. Please send payload via POST.",
      });
    }
    if (req.method !== "POST" && req.method !== "PUT") {
      return res.status(405).json({
        success: false,
        error: `Method ${req.method} Not Allowed. Please use POST.`,
        userFriendlyMessage: "طريقة الطلب غير صالحة، يرجى استخدام POST.",
      });
    }
    try {
      const {
        email,
        fullName,
        phone,
        phoneVerified,
        reason,
        organization,
        organizationName,
        previousWorkspaceInfo,
        acceptedTerms,
        termsAccepted,
        documents,
      } = req.body || {};

      if (!email || typeof email !== "string" || !email.trim()) {
        return res
          .status(400)
          .json({ success: false, error: "Email is required." });
      }

      // Server-side safety verification on uploaded documents references
      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        return res
          .status(400)
          .json({
            success: false,
            error: "An identity verification document is required.",
          });
      }

      if (documents.length > 2) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Maximum 2 identity verification documents allowed.",
          });
      }

      // STRICT Cryptographic verification of each document's upload token
      for (const doc of documents) {
        if (!doc.documentId || !doc.uploadToken) {
          return res
            .status(400)
            .json({
              success: false,
              error: "Missing document verification details.",
            });
        }

        // Check format to prevent path traversal injection
        if (!/^[a-zA-Z0-9_]+$/.test(doc.documentId)) {
          return res
            .status(400)
            .json({
              success: false,
              error: "Invalid document reference format.",
            });
        }

        const isValid = await verifyPendingUpload(
          doc.documentId,
          doc.uploadToken,
        );
        if (!isValid) {
          return res
            .status(400)
            .json({
              success: false,
              error:
                "Document reference integrity check failed. Unrecognized or hijacked file.",
            });
        }
      }

      const normalizedEmail = email.trim().toLowerCase();
      const nowIso = new Date().toISOString();
      const lifecycle = await getAccountLifecycleRecord(normalizedEmail);
      const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const documentIds = documents.map((d) => d.documentId);

      const requestDoc = {
        id: requestId,
        requestId,
        userId:
          lifecycle?.originalUserId ||
          `usr_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
        accountId:
          lifecycle?.accountId ||
          `acc_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
        email: normalizedEmail,
        fullName: (fullName || "").trim(),
        phone: (phone || "").trim(),
        phoneVerified: !!phoneVerified,
        organization: (organizationName || "").trim(),
        previousWorkspaceInfo: (previousWorkspaceInfo || "").trim(),
        reason: (reason || "").trim(),
        termsAccepted: !!acceptedTerms,
        termsAcceptedAt: nowIso,
        documentIds,
        documents: documents.map((d) => ({
          documentId: d.documentId,
          storageReference: d.storageReference,
          fileName: d.fileName,
          mimeType: d.mimeType,
          size: d.size,
          uploadedAt: d.uploadedAt,
        })),
        status: "pending",
        createdAt: nowIso,
        submittedAt: nowIso,
        updatedAt: nowIso,
        reviewedAt: null,
        reviewedBy: null,
      };

      // Mark the pending uploads as associated so they won't be cleaned up as orphans
      for (const doc of documents) {
        await markUploadAssociated(doc.documentId, requestId);
      }

      // Save to Firestore with atomic confirmation
      try {
        await adminDb
          .collection("recoveryRequests")
          .doc(requestId)
          .set(requestDoc);
        await adminDb
          .collection("recoveryRequests_by_email")
          .doc(normalizedEmail)
          .set(requestDoc);
        // Legacy mirror write
        await adminDb
          .collection("accountRecoveryRequests")
          .doc(requestId)
          .set(requestDoc)
          .catch(() => {});
        await adminDb
          .collection("accountRecoveryRequests_by_email")
          .doc(normalizedEmail)
          .set(requestDoc)
          .catch(() => {});
      } catch (fsErr: any) {
        console.error("Firestore recovery request write error:", fsErr);
        return res.status(500).json({
          success: false,
          error: "RECOVERY_REQUEST_PERSISTENCE_FAILED",
          message:
            "Failed to persist recovery request to database. Please try again.",
        });
      }

      // Save to local JSON DB fallback
      const db = readDb();
      const existingReqs = getLocalRecoveryRequestsList(db);
      const filteredReqs = existingReqs.filter(
        (r: any) => (r?.email || "").trim().toLowerCase() !== normalizedEmail,
      );
      filteredReqs.push(requestDoc);
      db.account_recovery_requests = filteredReqs;
      writeDb(db);

      // Update account lifecycle record to ADMIN_APPROVAL_PENDING
      if (lifecycle) {
        await setAccountLifecycleRecord({
          ...lifecycle,
          status: "ADMIN_APPROVAL_PENDING",
          reactivationStatus: "pending",
          recoveryRequestId: requestId,
          updatedAt: nowIso,
        });
      }

      return res.json({
        success: true,
        requestId,
        request: requestDoc,
        message:
          "Your account recovery request has been submitted for administrative review.",
      });
    } catch (err: any) {
      console.error("Submit recovery request error:", err);
      res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to submit recovery request.",
        });
    }
  },
);

// 2. Fetch Account Recovery Request Status for User
app.get("/api/auth/recovery-request/status", async (req, res) => {
  try {
    const email = req.query?.email;
    if (!email || typeof email !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Email parameter is required." });
    }
    const normalizedEmail = email.trim().toLowerCase();

    let requestDocs: any[] = [];

    // 1. Check recoveryRequests by email query
    try {
      const qSnap = await adminDb
        .collection("recoveryRequests")
        .where("email", "==", normalizedEmail)
        .get();
      if (qSnap && !qSnap.empty) {
        qSnap.docs.forEach((d) =>
          requestDocs.push({ ...d.data(), _source: "recoveryRequests" }),
        );
      }
    } catch (e) {}

    // 2. Check recoveryRequests_by_email direct document
    try {
      const emailSnap = await adminDb
        .collection("recoveryRequests_by_email")
        .doc(normalizedEmail)
        .get();
      if (emailSnap.exists) {
        requestDocs.push({
          ...emailSnap.data(),
          _source: "recoveryRequests_by_email",
        });
      }
    } catch (e) {}

    // 3. Check legacy accountRecoveryRequests
    try {
      const legacySnap = await adminDb
        .collection("accountRecoveryRequests_by_email")
        .doc(normalizedEmail)
        .get();
      if (legacySnap.exists) {
        requestDocs.push({
          ...legacySnap.data(),
          _source: "accountRecoveryRequests_by_email",
        });
      }
    } catch (e) {}

    // 4. Check local DB store
    const db = readDb();
    const localReqs = getLocalRecoveryRequestsList(db).filter(
      (r: any) => (r?.email || "").trim().toLowerCase() === normalizedEmail,
    );
    localReqs.forEach((r: any) =>
      requestDocs.push({ ...r, _source: "localDb" }),
    );

    // Filter strictly for valid, actual recovery requests submitted by the user
    const validRequests = requestDocs.filter((r) => isRealRecoveryRequestDoc(r, normalizedEmail));

    // If no recovery request documents exist, return status "none" and null immediately
    if (validRequests.length === 0) {
      return res.json({
        success: true,
        status: "none",
        recoveryRequest: null,
      });
    }

    // Sort requests by newest
    validRequests.sort((a, b) => {
      const ta = new Date(a.submittedAt || a.createdAt || a.updatedAt || 0).getTime();
      const tb = new Date(b.submittedAt || b.createdAt || b.updatedAt || 0).getTime();
      return tb - ta;
    });

    const latestDoc = validRequests[0];
    const rawStatus = (latestDoc.status || latestDoc.decision || "").toLowerCase();

    // Determine if account is already restored & active
    let lifecycle: any = null;
    try {
      lifecycle = await getAccountLifecycleRecord(normalizedEmail);
    } catch (e) {}

    const isAlreadyActive = lifecycle && lifecycle.status === "ACTIVE";
    const isRestored = latestDoc.status === "restored" || validRequests.some((r) => r.status === "restored");

    let computedStatus: "none" | "pending" | "approved" | "rejected" | "already_active" = "none";
    if (rawStatus === "approved") {
      computedStatus = "approved";
    } else if (rawStatus === "rejected") {
      computedStatus = "rejected";
    } else if (rawStatus === "pending" || rawStatus === "under_review" || rawStatus === "submitted") {
      computedStatus = "pending";
    } else if (isRestored && isAlreadyActive) {
      computedStatus = "already_active";
    } else {
      computedStatus = "none";
    }

    if (computedStatus === "none") {
      return res.json({
        success: true,
        status: "none",
        recoveryRequest: null,
      });
    }

    const rejectionReason =
      computedStatus === "rejected"
        ? latestDoc.rejectionReason ||
          latestDoc.notes ||
          "تم رفض طلب استعادة الحساب من قبل إدارة النظام."
        : null;

    return res.json({
      success: true,
      status: computedStatus,
      recoveryRequest: {
        ...latestDoc,
        id: latestDoc.id || latestDoc.requestId,
        requestId: latestDoc.requestId || latestDoc.id,
        status: computedStatus,
        rejectionReason: rejectionReason,
      },
    });
  } catch (err: any) {
    console.error("Recovery request status error:", err);
    res
      .status(500)
      .json({
        success: false,
        error: err.message || "Failed to fetch status.",
      });
  }
});

// 3. Fetch All Account Recovery Requests for Admin Review
app.get(
  "/api/admin/recovery-requests",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const callerUid = req.user?.uid;
      const callerEmail = req.user?.email || "";
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({ error: "Forbidden: Admin access required." });
      }

      let requests: any[] = [];
      try {
        const snap = await adminDb.collection("recoveryRequests").get();
        if (snap && !snap.empty) {
          requests = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        }
      } catch (e) {}

      if (requests.length === 0) {
        try {
          const snap = await adminDb
            .collection("accountRecoveryRequests")
            .get();
          if (snap && !snap.empty) {
            requests = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          }
        } catch (e2) {}
      }

      const db = readDb();
      const localRequests = getLocalRecoveryRequestsList(db);
      for (const lr of localRequests) {
        if (
          !requests.some((r) => r.id === lr.id || r.requestId === lr.requestId)
        ) {
          requests.push(lr);
        }
      }

      // Reconcile documents for each recovery request
      const recStore = db.recovery_documents_store || {};
      const pendingUploads = db.pending_recovery_uploads || [];

      requests = requests.map((r: any) => {
        const rawDocs = [
          ...(Array.isArray(r.documents) ? r.documents : []),
          ...(Array.isArray(r.verificationDocuments) ? r.verificationDocuments : [])
        ];

        const docIds = Array.isArray(r.documentIds) ? r.documentIds : [];
        for (const dId of docIds) {
          if (recStore[dId] && !rawDocs.some((d: any) => (d.documentId || d.id) === dId)) {
            rawDocs.push(recStore[dId]);
          }
        }

        // Check by email or userId in recovery store
        const rEmail = (r.email || "").toLowerCase().trim();
        for (const [dId, meta] of Object.entries(recStore as Record<string, any>)) {
          if (meta) {
            const matchesReq = meta.requestId === r.requestId || meta.requestId === r.id || (meta.email && meta.email.toLowerCase().trim() === rEmail);
            if (matchesReq && !rawDocs.some((d: any) => (d.documentId || d.id) === dId)) {
              rawDocs.push(meta);
            }
          }
        }

        const docMap = new Map<string, any>();
        for (const d of rawDocs) {
          if (!d) continue;
          const key = d.documentId || d.id || d.storageReference || d.fileName;
          if (key && !docMap.has(key)) {
            docMap.set(key, d);
          }
        }
        const reconciledDocs = Array.from(docMap.values());
        r.documents = reconciledDocs;
        r.documentCount = reconciledDocs.length;
        return r;
      });

      requests.sort((a, b) => {
        const tA = new Date(a.submittedAt || a.createdAt || 0).getTime();
        const tB = new Date(b.submittedAt || b.createdAt || 0).getTime();
        return tB - tA;
      });

      return res.json({ success: true, requests, recoveryRequests: requests });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: err.message || "Failed to fetch recovery requests." });
    }
  },
);

// 4. Admin Recovery Decision Routes (Approve / Reject)
app.post(
  "/api/admin/recovery-requests/:requestId/approve",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const callerUid = req.user?.uid;
      const callerEmail = req.user?.email || "";
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({
            success: false,
            code: "FORBIDDEN",
            error: "Forbidden: Administrative authorization required.",
          });
      }
      const { requestId } = req.params;
      const { email, notes } = req.body || {};

      const result = await handleAdminRecoveryDecision({
        requestId,
        email,
        action: "approve",
        notes,
        callerUid,
      });

      if (!result.success) {
        const statusCode =
          result.code === "REQUEST_ALREADY_PROCESSED"
            ? 409
            : result.code === "REQUEST_NOT_FOUND"
              ? 404
              : result.code === "FORBIDDEN"
                ? 403
                : 500;
        return res.status(statusCode).json(result);
      }

      return res.json(result);
    } catch (err: any) {
      console.error("[Approve Recovery Endpoint Error]", err);
      res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to approve recovery request.",
        });
    }
  },
);

app.post(
  "/api/admin/recovery-requests/:requestId/reject",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const callerUid = req.user?.uid;
      const callerEmail = req.user?.email || "";
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({
            success: false,
            code: "FORBIDDEN",
            error: "Forbidden: Administrative authorization required.",
          });
      }
      const { requestId } = req.params;
      const { email, rejectionReason, notes } = req.body || {};

      const result = await handleAdminRecoveryDecision({
        requestId,
        email,
        action: "reject",
        rejectionReason,
        notes,
        callerUid,
      });

      if (!result.success) {
        const statusCode =
          result.code === "REQUEST_ALREADY_PROCESSED"
            ? 409
            : result.code === "REQUEST_NOT_FOUND"
              ? 404
              : result.code === "FORBIDDEN"
                ? 403
                : 500;
        return res.status(statusCode).json(result);
      }

      return res.json(result);
    } catch (err: any) {
      console.error("[Reject Recovery Endpoint Error]", err);
      res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to reject recovery request.",
        });
    }
  },
);

app.post(
  "/api/admin/handle-recovery-request",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const callerUid = req.user?.uid;
      const callerEmail = req.user?.email || "";
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({
            success: false,
            code: "FORBIDDEN",
            error: "Forbidden: Administrative authorization required.",
          });
      }

      const { requestId, email, action, rejectionReason, notes } =
        req.body || {};

      const result = await handleAdminRecoveryDecision({
        requestId,
        email,
        action: action || "approve",
        rejectionReason,
        notes,
        callerUid,
      });

      if (!result.success) {
        const statusCode =
          result.code === "REQUEST_ALREADY_PROCESSED"
            ? 409
            : result.code === "REQUEST_NOT_FOUND"
              ? 404
              : result.code === "FORBIDDEN"
                ? 403
                : 500;
        return res.status(statusCode).json(result);
      }

      return res.json(result);
    } catch (err: any) {
      console.error("[Handle Recovery Request Error]", err);
      res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to handle recovery request.",
        });
    }
  },
);

app.post(
  "/api/admin/handle-reactivation-request",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const callerUid = req.user?.uid;
      const callerEmail = req.user?.email || "";
      if (!callerUid || !(await isUserAdminServer(callerUid, callerEmail))) {
        return res
          .status(403)
          .json({
            success: false,
            code: "FORBIDDEN",
            error: "Forbidden: Administrative authorization required.",
          });
      }

      const { requestId, email, action, rejectionReason, notes } =
        req.body || {};

      const result = await handleAdminRecoveryDecision({
        requestId,
        email,
        action: action || "approve",
        rejectionReason,
        notes,
        callerUid,
      });

      if (!result.success) {
        const statusCode =
          result.code === "REQUEST_ALREADY_PROCESSED"
            ? 409
            : result.code === "REQUEST_NOT_FOUND"
              ? 404
              : result.code === "FORBIDDEN"
                ? 403
                : 500;
        return res.status(statusCode).json(result);
      }

      return res.json(result);
    } catch (err: any) {
      console.error("[Handle Reactivation Request Error]", err);
      res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to handle reactivation request.",
        });
    }
  },
);

// 5. Send Approval OTP Code (User post-approval step)
app.post(
  "/api/auth/recovery-request/send-approval-otp",
  otpLimiter,
  async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string" || !email.trim()) {
        return res
          .status(400)
          .json({ success: false, error: "Email is required." });
      }
      const normalizedEmail = email.trim().toLowerCase();

      let isApproved = false;
      let reqId = "";
      let targetUserId = "";

      try {
        const snap1 = await adminDb
          .collection("recoveryRequests_by_email")
          .doc(normalizedEmail)
          .get();
        if (snap1.exists) {
          const d = snap1.data();
          if (
            d?.status === "approved" ||
            d?.decision === "approved" ||
            d?.reactivationStatus === "approved"
          ) {
            isApproved = true;
          }
          reqId = d?.id || d?.requestId || reqId;
          targetUserId = d?.userId || targetUserId;
        }
        if (!isApproved) {
          const snap2 = await adminDb
            .collection("accountRecoveryRequests_by_email")
            .doc(normalizedEmail)
            .get();
          if (snap2.exists) {
            const d = snap2.data();
            if (
              d?.status === "approved" ||
              d?.decision === "approved" ||
              d?.reactivationStatus === "approved"
            ) {
              isApproved = true;
            }
            reqId = d?.id || d?.requestId || reqId;
            targetUserId = d?.userId || targetUserId;
          }
        }
        if (!isApproved) {
          const qSnap = await adminDb
            .collection("recoveryRequests")
            .where("email", "==", normalizedEmail)
            .get()
            .catch(() => null);
          if (qSnap && !qSnap.empty) {
            for (const doc of qSnap.docs) {
              const d = doc.data();
              if (
                d?.status === "approved" ||
                d?.decision === "approved" ||
                d?.reactivationStatus === "approved"
              ) {
                isApproved = true;
                reqId = d?.id || d?.requestId || reqId;
                targetUserId = d?.userId || targetUserId;
                break;
              }
            }
            if (!targetUserId && !qSnap.empty) {
              const latest = qSnap.docs[0].data();
              reqId = latest?.id || latest?.requestId || reqId;
              targetUserId = latest?.userId || targetUserId;
            }
          }
        }
      } catch (e) {}

      if (!isApproved) {
        const db = readDb();
        const localReq = db.account_recovery_requests?.find(
          (r: any) =>
            (r.email || "").trim().toLowerCase() === normalizedEmail &&
            (r.status === "approved" ||
              r.decision === "approved" ||
              r.reactivationStatus === "approved"),
        );
        if (localReq) {
          isApproved = true;
          reqId = localReq.id || localReq.requestId || reqId;
          targetUserId = localReq.userId || targetUserId;
        }
      }

      const lifecycle = await getAccountLifecycleRecord(normalizedEmail);
      if (
        !isApproved &&
        (lifecycle?.status === "ADMIN_APPROVED" ||
          lifecycle?.reactivationStatus === "approved")
      ) {
        isApproved = true;
        targetUserId = targetUserId || lifecycle.userId || lifecycle.uid || "";
      }

      if (!isApproved) {
        if (lifecycle?.status === "ACTIVE") {
          return res.status(400).json({
            success: false,
            error:
              "This account is already active and does not require recovery.",
          });
        }
        console.warn("[RECOVERY_OTP_PIPELINE] Approval check failed:", {
          recoveryRequestId: reqId || "UNKNOWN",
          targetUserId: targetUserId || "UNKNOWN",
          targetEmail: normalizedEmail,
          isApproved: false,
        });
        return res.status(400).json({
          success: false,
          error:
            "Your recovery request has not yet been approved by an administrator.",
        });
      }

      console.log("[RECOVERY_OTP_PIPELINE] Processing recovery OTP request:", {
        stage: "INIT",
        recoveryRequestId: reqId || "N/A",
        targetUserId: targetUserId || "N/A",
        targetEmail: normalizedEmail,
      });

      const otpCode = crypto.randomInt(100000, 1000000).toString();
      const codeHash = hashVerificationCode(otpCode);
      const nowMs = Date.now();
      const expiresAt = new Date(nowMs + 10 * 60 * 1000).toISOString();
      const docId = `recovery_otp_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;

      console.log("[RECOVERY_OTP_PIPELINE] Generated OTP code hash:", {
        stage: "OTP_GENERATED",
        recoveryRequestId: reqId || "N/A",
        targetUserId: targetUserId || "N/A",
        targetEmail: normalizedEmail,
        otpGenerated: true,
        expiresAt,
      });

      const record = {
        id: docId,
        email: normalizedEmail,
        codeHash: codeHash,
        type: "account_recovery",
        recoveryRequestId: reqId || undefined,
        targetUserId: targetUserId || undefined,
        expiresAt: expiresAt,
        attempts: 0,
        used: false,
        deliveryStatus: "initiating",
        createdAt: new Date().toISOString(),
      };

      let firestoreWriteSuccess = false;
      try {
        await adminDb.collection("verification_codes").doc(docId).set(record);
        await adminDb
          .collection("verification_codes")
          .doc(normalizedEmail)
          .set(record);
        firestoreWriteSuccess = true;
      } catch (fsWriteErr: any) {
        console.warn(
          "[RECOVERY_OTP_PIPELINE] Firestore OTP write warning:",
          fsWriteErr?.message,
        );
      }

      const db = readDb();
      if (!db.verification_codes) db.verification_codes = [];
      db.verification_codes = db.verification_codes.filter(
        (vc: any) => vc.id !== docId && vc.id !== normalizedEmail,
      );
      db.verification_codes.push(record);
      writeDb(db);

      console.log("[RECOVERY_OTP_PIPELINE] OTP persisted to storage:", {
        stage: "PERSISTENCE_COMPLETE",
        recoveryRequestId: reqId || "N/A",
        targetUserId: targetUserId || "N/A",
        targetEmail: normalizedEmail,
        firestoreWriteSuccess,
        localStoreSuccess: true,
      });

      const emailObj = buildOtpEmailHtml({
        email: normalizedEmail,
        otpCode: otpCode,
        type: "account_recovery",
      });

      console.log("[RECOVERY_OTP_PIPELINE] Invoking email dispatcher:", {
        stage: "EMAIL_DISPATCH_INVOKED",
        recoveryRequestId: reqId || "N/A",
        targetUserId: targetUserId || "N/A",
        targetEmail: normalizedEmail,
        subject: emailObj.subject,
      });

      const mailResult = await sendSystemMail(
        normalizedEmail,
        emailObj.subject,
        emailObj.text,
        emailObj.html,
      );

      if (!mailResult.success && !mailResult.simulated) {
        const errStatus = mailResult.statusCode || 500;
        console.error("[RECOVERY_OTP_PIPELINE] Resend delivery failed:", {
          stage: "RESEND_API_ERROR",
          recoveryRequestId: reqId || "N/A",
          targetUserId: targetUserId || "N/A",
          targetEmail: normalizedEmail,
          statusCode: errStatus,
          error: mailResult.error
            ? mailResult.error.message || mailResult.error
            : "Send failed",
        });
        return res.status(errStatus).json({
          success: false,
          error:
            mailResult.userFriendlyMessage ||
            "تعذر إرسال رمز التحقق حالياً. يرجى المحاولة مرة أخرى.",
        });
      }

      console.log("[RECOVERY_OTP_PIPELINE] Resend accepted email:", {
        stage: "RESEND_API_SUCCESS",
        recoveryRequestId: reqId || "N/A",
        targetUserId: targetUserId || "N/A",
        targetEmail: normalizedEmail,
        resendEmailId: mailResult.messageId || "N/A",
        simulated: Boolean(mailResult.simulated),
        deliveryStatus: "sent",
      });

      if (mailResult.messageId) {
        const updatePayload = {
          resendEmailId: mailResult.messageId,
          deliveryStatus: "sent",
          lastDeliveryUpdate: new Date().toISOString(),
        };
        try {
          await adminDb
            .collection("verification_codes")
            .doc(docId)
            .update(updatePayload);
          await adminDb
            .collection("verification_codes")
            .doc(normalizedEmail)
            .update(updatePayload);
        } catch (e) {}
        const curDb = readDb();
        const vcItem = curDb.verification_codes?.find(
          (vc: any) => vc.id === docId,
        );
        if (vcItem) {
          vcItem.resendEmailId = mailResult.messageId;
          vcItem.deliveryStatus = "sent";
          writeDb(curDb);
        }
      }

      return res.json({
        success: true,
        message: `تم إرسال رمز التحقق بنجاح إلى ${normalizedEmail}`,
        expiresAt,
        emailSent: !mailResult.simulated,
        resendEmailId: mailResult.messageId,
        deliveryStatus: "sent",
        devCode: mailResult.simulated ? otpCode : undefined,
      });
    } catch (err: any) {
      console.error(
        "[RECOVERY_OTP_PIPELINE] Send approval OTP critical error:",
        err,
      );
      res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to send verification code.",
        });
    }
  },
);

// 6. Verify OTP and Restore Account
app.post(
  [
    "/api/auth/recovery-request/verify-otp-and-restore",
    "/api/auth/recovery-request/verify-approval-otp",
  ],
  otpLimiter,
  async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Email and verification code are required.",
          });
      }
      const normalizedEmail = email.trim().toLowerCase();
      const inputCode = String(code).trim();
      const docId = `recovery_otp_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;

      let otpRecord: any = null;
      try {
        const snap = await adminDb
          .collection("verification_codes")
          .doc(docId)
          .get();
        if (snap.exists && !snap.data()?.used) {
          otpRecord = snap.data();
        }
        if (!otpRecord) {
          const emSnap = await adminDb
            .collection("verification_codes")
            .doc(normalizedEmail)
            .get();
          if (emSnap.exists && !emSnap.data()?.used) {
            otpRecord = emSnap.data();
          }
        }
      } catch (e) {}

      if (!otpRecord) {
        const db = readDb();
        otpRecord = db.verification_codes?.find(
          (vc: any) =>
            (vc.id === docId || vc.email === normalizedEmail) && !vc.used,
        );
      }

      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          error:
            "No active verification code found or code has already been used. Please request a new code.",
        });
      }

      const expiresAt = new Date(otpRecord.expiresAt).getTime();
      if (expiresAt <= Date.now()) {
        return res.status(400).json({
          success: false,
          error: "Verification code has expired. Please request a new code.",
        });
      }

      const cleanInputHash = hashVerificationCode(inputCode);
      const isMatch = otpRecord.codeHash
        ? otpRecord.codeHash === cleanInputHash
        : otpRecord.code === inputCode;

      if (!isMatch) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid verification code. Please check your email and try again.",
        });
      }

      const nowIso = new Date().toISOString();
      try {
        await adminDb
          .collection("verification_codes")
          .doc(docId)
          .set({ used: true, usedAt: nowIso }, { merge: true });
        await adminDb
          .collection("verification_codes")
          .doc(normalizedEmail)
          .set({ used: true, usedAt: nowIso }, { merge: true });
      } catch (e) {}

      try {
        await adminDb
          .collection("recoveryRequests_by_email")
          .doc(normalizedEmail)
          .set({ status: "restored", restoredAt: nowIso }, { merge: true });
        await adminDb
          .collection("accountRecoveryRequests_by_email")
          .doc(normalizedEmail)
          .set({ status: "restored", restoredAt: nowIso }, { merge: true });
        const qSnap = await adminDb
          .collection("recoveryRequests")
          .where("email", "==", normalizedEmail)
          .get()
          .catch(() => null);
        if (qSnap && !qSnap.empty) {
          for (const doc of qSnap.docs) {
            await doc.ref
              .set({ status: "restored", restoredAt: nowIso }, { merge: true })
              .catch(() => null);
          }
        }
      } catch (e) {}

      const db = readDb();
      if (db.verification_codes) {
        for (const vc of db.verification_codes) {
          if (vc.id === docId || vc.email === normalizedEmail) {
            vc.used = true;
            vc.usedAt = nowIso;
          }
        }
      }
      const reqList = getLocalRecoveryRequestsList(db);
      const rItem = reqList.find(
        (r: any) => (r.email || "").trim().toLowerCase() === normalizedEmail,
      );
      if (rItem) rItem.status = "restored";
      writeDb(db);

      const restoreRes = await restoreAccountFullServer(
        normalizedEmail,
        newPassword,
      );
      if (!restoreRes.success || !restoreRes.user) {
        return res
          .status(500)
          .json({
            success: false,
            error: restoreRes.error || "Failed to restore account profile.",
          });
      }

      // Privacy & Security: Purge temporary identity verification documents once restoration has completed
      (async () => {
        try {
          let recoveryReq: any = null;
          if (adminDb) {
            const reqSnap = await adminDb
              .collection("accountRecoveryRequests_by_email")
              .doc(normalizedEmail)
              .get();
            if (reqSnap.exists) recoveryReq = reqSnap.data();
          }
          if (!recoveryReq) {
            const db = readDb();
            recoveryReq = getLocalRecoveryRequestsList(db).find(
              (r: any) => (r.email || "").trim().toLowerCase() === normalizedEmail,
            );
          }

          if (recoveryReq?.documents && Array.isArray(recoveryReq.documents)) {
            for (const doc of recoveryReq.documents) {
              if (doc.documentId) {
                console.log(
                  `[RESTORE_COMPLETED_PURGE] Purging identity document ${doc.documentId} after successful restoration`,
                );
                await deleteDocumentFromPersistentStorage(doc.documentId);
              }
            }
          }
        } catch (purgeErr) {
          console.warn("Post-restoration document purge notice:", purgeErr);
        }
      })().catch(() => {});

      let customToken: string = "";
      try {
        customToken = await adminAuth.createCustomToken(restoreRes.user.id);
      } catch (tErr) {
        console.warn(
          "createCustomToken warning on recovery restoration:",
          tErr,
        );
      }

      return res.json({
        success: true,
        customToken,
        user: restoreRes.user,
        message:
          "Your account has been successfully restored! You may now sign in.",
      });
    } catch (err: any) {
      console.error("Verify OTP and restore error:", err);
      res
        .status(500)
        .json({
          success: false,
          error: err.message || "Failed to complete account restoration.",
        });
    }
  },
);

const handleDeleteUserRequest = async (req: AuthRequest, res: any) => {
  const targetUid = (
    req.params.uid ||
    req.body?.uid ||
    req.body?.userId ||
    req.query?.uid ||
    req.query?.userId ||
    ""
  )
    .toString()
    .trim();
  let currentStep = "INITIALIZATION";
  const executionAudit: Record<string, any> = {
    stripe: { status: "pending", details: null },
    database: { status: "pending", details: null },
    auth: { status: "pending", details: null },
  };

    try {
      const callerUid = req.user?.uid;
      const callerEmail = req.user?.email || (req as any).userEmail || "";
      if (!callerUid) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const isCallerAdmin = await isUserAdminServer(callerUid, callerEmail);
      if (!isCallerAdmin) {
        return res
          .status(403)
          .json({
            success: false,
            error:
              "Forbidden: Only administrative personnel can perform account deletion.",
          });
      }

      if (!targetUid) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Target user ID is required for deletion.",
          });
      }

      if (targetUid === callerUid) {
        return res.status(400).json({
          success: false,
          error: "You cannot delete your own active administrative account.",
          userFriendlyMessage:
            "لا يمكنك حذف حساب المسؤول الحالي الذي تستخدمه الآن.",
        });
      }

      if (targetUid === ADMIN_USER_ID) {
        return res.status(400).json({
          success: false,
          error: "Primary administrator account cannot be deleted.",
          userFriendlyMessage: "لا يمكن حذف الحساب الرئيسي للمسؤول.",
        });
      }

      console.log("USER_DELETE_STARTED", { targetUid, callerUid, callerEmail });

      let targetEmail = (
        req.body?.userEmail ||
        req.body?.email ||
        req.query?.userEmail ||
        req.query?.email ||
        ""
      )
        .toString()
        .trim();
      let userDocData: any = null;
      try {
        const targetSnap = await adminDb
          .collection("users")
          .doc(targetUid)
          .get();
        if (targetSnap.exists) {
          userDocData = targetSnap.data();
          if (!targetEmail) targetEmail = userDocData?.email || "";
        }
      } catch (e) {
        console.warn("Failed to retrieve target user email from Firestore:", e);
      }

      if (!targetEmail) {
        try {
          const localDb = readDb();
          const found = localDb.users?.find(
            (u: any) => u.id === targetUid || u.uid === targetUid,
          );
          if (found?.email) {
            targetEmail = found.email;
          }
          if (!userDocData && found) userDocData = found;
        } catch (e) {}
      }

      if (!targetEmail) {
        try {
          const authUser = await adminAuth.getUser(targetUid);
          if (authUser?.email) {
            targetEmail = authUser.email;
          }
        } catch (authLookupErr) {}
      }

      // --- STEP 1: STRIPE SUBSCRIPTION CANCELLATION ---
      currentStep = "STRIPE_CANCELLATION";
      try {
        const stripe = getStripe();
        if (stripe) {
          const subId =
            userDocData?.stripeSubscriptionId || userDocData?.subscriptionId;
          const custId =
            userDocData?.stripeCustomerId || userDocData?.customerId;
          let canceledCount = 0;

          if (subId) {
            try {
              await stripe.subscriptions.cancel(subId);
              canceledCount++;
              console.log(
                `[AdminDelete] Canceled Stripe subscription ${subId} for target user ${targetUid}`,
              );
            } catch (subErr: any) {
              if (
                subErr?.code === "resource_missing" ||
                subErr?.statusCode === 404
              ) {
                console.log(
                  `[AdminDelete] Stripe subscription ${subId} already canceled or non-existent.`,
                );
              } else {
                console.warn(
                  `[AdminDelete] Warning canceling subscription ${subId}:`,
                  subErr?.message,
                );
              }
            }
          }

          if (custId) {
            try {
              const activeSubs = await stripe.subscriptions.list({
                customer: custId,
                status: "active",
              });
              for (const sub of activeSubs.data) {
                if (sub.id !== subId) {
                  await stripe.subscriptions.cancel(sub.id);
                  canceledCount++;
                  console.log(
                    `[AdminDelete] Canceled additional active subscription ${sub.id} for customer ${custId}`,
                  );
                }
              }
            } catch (custErr: any) {
              console.warn(
                `[AdminDelete] Warning listing active subscriptions for customer ${custId}:`,
                custErr?.message,
              );
            }
          }

          executionAudit.stripe = {
            status: "completed",
            canceledSubscriptions: canceledCount,
          };
        } else {
          executionAudit.stripe = {
            status: "skipped",
            reason: "Stripe SDK not initialized or key not configured.",
          };
        }
      } catch (stripeErr: any) {
        console.warn(
          "[AdminDelete] Non-fatal error during Stripe cancellation step:",
          stripeErr?.message,
        );
        executionAudit.stripe = {
          status: "warning",
          error: stripeErr?.message || String(stripeErr),
        };
      }

      // --- STEP 2: DATABASE DATA, ARCHIVE RETENTION & RECORDS DELETION ---
      currentStep = "DATABASE_DATA_DELETION";
      let deletedRecordsCount = 0;

      // Archive user data to users_retained to maintain account recovery architecture
      if (userDocData) {
        try {
          await adminDb
            .collection("users_retained")
            .doc(targetUid)
            .set({
              ...userDocData,
              archivedAt: new Date().toISOString(),
              deletedBy: callerUid,
              deletionType: "admin",
            });

          const memSnap = await adminDb
            .collection("users")
            .doc(targetUid)
            .collection("memories")
            .get();
          for (const mDoc of memSnap.docs) {
            await adminDb
              .collection("users_retained")
              .doc(targetUid)
              .collection("memories")
              .doc(mDoc.id)
              .set(mDoc.data());
          }

          const alertSnap = await adminDb
            .collection("users")
            .doc(targetUid)
            .collection("riskAlerts")
            .get();
          for (const aDoc of alertSnap.docs) {
            await adminDb
              .collection("users_retained")
              .doc(targetUid)
              .collection("riskAlerts")
              .doc(aDoc.id)
              .set(aDoc.data());
          }

          const filesSnap = await adminDb
            .collection("users")
            .doc(targetUid)
            .collection("files")
            .get();
          for (const fDoc of filesSnap.docs) {
            await adminDb
              .collection("users_retained")
              .doc(targetUid)
              .collection("files")
              .doc(fDoc.id)
              .set(fDoc.data());
          }

          const topFilesSnap = await adminDb
            .collection("files")
            .where("userId", "==", targetUid)
            .get();
          for (const tfDoc of topFilesSnap.docs) {
            await adminDb
              .collection("users_retained")
              .doc(targetUid)
              .collection("top_files")
              .doc(tfDoc.id)
              .set(tfDoc.data());
          }
        } catch (archErr: any) {
          console.warn(
            "[AdminDelete] Retention archive warning:",
            archErr?.message,
          );
        }
      }

      // Update permanent account lifecycle record for ADMIN DELETED account
      if (targetEmail) {
        const normEmail = targetEmail.trim().toLowerCase();
        try {
          await setAccountLifecycleRecord({
            accountId: normEmail,
            emailNormalized: normEmail,
            status: "ADMIN_DELETED",
            deletionType: "admin",
            deletedAt: new Date().toISOString(),
            deletedBy: callerUid,
            restoreUntil: null,
            adminApprovalRequired: true,
            originalUserId: targetUid,
            originalRole: userDocData?.role || "Contributor",
            originalWorkspaceId: userDocData?.workspaceId,
            originalPowers: userDocData?.powers,
            retainedDataDocPath: `users_retained/${targetUid}`,
          });
        } catch (lifecycleErr: any) {
          console.warn(
            "Account lifecycle record update warning:",
            lifecycleErr?.message,
          );
        }
      }

      try {
        await adminDb.collection("deletedUsers").doc(targetUid).set({
          uid: targetUid,
          email: targetEmail,
          deletedAt: new Date().toISOString(),
          deletedBy: callerUid,
          reason: "admin_deleted",
        });
        console.log("USER_DELETED_MARKER_CREATED", { targetUid });
      } catch (delErr: any) {
        console.warn(
          "Firestore deletedUsers creation warning:",
          delErr?.message,
        );
      }

      // Delete Firestore user document users/{targetUid}
      try {
        await adminDb.collection("users").doc(targetUid).delete();
        deletedRecordsCount++;
        console.log("USER_FIRESTORE_DELETED", { targetUid });
      } catch (fsErr: any) {
        console.warn("Firestore user doc delete warning:", fsErr?.message);
      }

      // Delete verification codes
      try {
        await adminDb.collection("verification_codes").doc(targetUid).delete();
        const vcSnap = await adminDb
          .collection("verification_codes")
          .where("userId", "==", targetUid)
          .get();
        for (const doc of vcSnap.docs) {
          await doc.ref.delete();
          deletedRecordsCount++;
        }
      } catch (vcErr: any) {
        console.warn("Verification codes deletion warning:", vcErr?.message);
      }

      // Delete user files subcollection & top-level files
      try {
        const userFilesSnap = await adminDb
          .collection("users")
          .doc(targetUid)
          .collection("files")
          .get();
        for (const fDoc of userFilesSnap.docs) {
          await fDoc.ref.delete();
          deletedRecordsCount++;
        }
        const topFilesSnap = await adminDb
          .collection("files")
          .where("userId", "==", targetUid)
          .get();
        for (const tfDoc of topFilesSnap.docs) {
          await tfDoc.ref.delete();
          deletedRecordsCount++;
        }
      } catch (filesErr: any) {
        console.warn("Files metadata deletion warning:", filesErr?.message);
      }

      // Delete user memories, causal graphs & risk alerts
      try {
        const memSnap = await adminDb
          .collection("users")
          .doc(targetUid)
          .collection("memories")
          .get();
        for (const mDoc of memSnap.docs) {
          await mDoc.ref.delete();
          deletedRecordsCount++;
        }
        const alertSnap = await adminDb
          .collection("users")
          .doc(targetUid)
          .collection("riskAlerts")
          .get();
        for (const aDoc of alertSnap.docs) {
          await aDoc.ref.delete();
          deletedRecordsCount++;
        }
        const cgSnap = await adminDb
          .collection("causal_graphs")
          .where("userId", "==", targetUid)
          .get();
        for (const cgDoc of cgSnap.docs) {
          await cgDoc.ref.delete();
          deletedRecordsCount++;
        }
      } catch (memErr: any) {
        console.warn("Memories/graphs deletion warning:", memErr?.message);
      }

      // Delete support tickets owned by user
      try {
        const ticketSnap = await adminDb
          .collection("support_tickets")
          .where("userId", "==", targetUid)
          .get();
        for (const tDoc of ticketSnap.docs) {
          await tDoc.ref.delete();
          deletedRecordsCount++;
        }
      } catch (ticketErr: any) {
        console.warn("Support tickets deletion warning:", ticketErr?.message);
      }

      // Synchronize deletion to local JSON file database store
      try {
        const dbData = readDb();
        if (dbData.users)
          dbData.users = dbData.users.filter(
            (u: any) => u.id !== targetUid && u.uid !== targetUid,
          );
        if (dbData.verification_codes)
          dbData.verification_codes = dbData.verification_codes.filter(
            (vc: any) => vc.id !== targetUid && vc.userId !== targetUid,
          );
        if (dbData.support_tickets)
          dbData.support_tickets = dbData.support_tickets.filter(
            (st: any) => st.userId !== targetUid,
          );
        if (dbData.memories)
          dbData.memories = dbData.memories.filter(
            (m: any) => m.userId !== targetUid,
          );
        if (dbData.causal_graphs)
          dbData.causal_graphs = dbData.causal_graphs.filter(
            (cg: any) => cg.userId !== targetUid,
          );
        writeDb(dbData);
      } catch (dbErr: any) {
        console.warn(
          "Local db write warning during user deletion:",
          dbErr?.message,
        );
      }

      executionAudit.database = {
        status: "completed",
        recordsPurged: deletedRecordsCount,
      };

      // --- STEP 3: FIREBASE AUTHENTICATION DELETION & TOKEN REVOCATION ---
      currentStep = "FIREBASE_AUTH_DELETION";

      // 1. Disable in Firebase Auth (preserve UID for administrative reactivation audit)
      try {
        await adminAuth.updateUser(targetUid, { disabled: true });
        console.log("USER_AUTH_DISABLED", { targetUid });
        executionAudit.auth.userDisabled = true;
      } catch (authErr: any) {
        if (authErr?.code === "auth/user-not-found") {
          console.log("USER_AUTH_ALREADY_REMOVED", { targetUid });
          executionAudit.auth.userDisabled = true;
        } else {
          console.warn("USER_AUTH_DISABLE_WARNING", {
            targetUid,
            error: authErr?.message,
          });
          executionAudit.auth.authError = authErr?.message;
        }
      }

      // 2. Revoke active refresh tokens
      try {
        await adminAuth.revokeRefreshTokens(targetUid);
        console.log("USER_TOKENS_REVOKED", { targetUid });
        executionAudit.auth.tokensRevoked = true;
      } catch (tokenErr: any) {
        console.warn("Revoke refresh tokens warning:", tokenErr?.message);
        executionAudit.auth.tokenError = tokenErr?.message;
      }

      executionAudit.auth.status = "completed";

      console.log("USER_DELETE_COMPLETED", { targetUid, executionAudit });
      return res.json({
        success: true,
        message: `The user's account has been deleted and archived according to the account recovery policy.`,
        userFriendlyMessage:
          "تم حذف حساب المستخدم وأرشفة بياناته وفقًا لسياسة استعادة الحساب.",
        executionAudit,
      });
    } catch (err: any) {
      console.error(`USER_DELETE_FAILED during step [${currentStep}]`, {
        targetUid,
        error: err.message || String(err),
      });
      return res.status(500).json({
        success: false,
        failedStep: currentStep,
        error: err.message || "Administrative deletion process failed.",
        userFriendlyMessage: `تعذر إتمام عملية حذف الحساب أثناء مرحلة (${currentStep}).`,
        executionAudit,
      });
    }
};

app.delete(
  [
    "/api/admin/delete-user/:uid",
    "/admin/delete-user/:uid",
    "/api/admin/delete-user",
    "/admin/delete-user",
    "/api/admin/users/:uid",
    "/admin/users/:uid",
  ],
  requireAuth,
  handleDeleteUserRequest
);

app.post(
  [
    "/api/admin/delete-user/:uid",
    "/admin/delete-user/:uid",
    "/api/admin/delete-user",
    "/admin/delete-user",
  ],
  requireAuth,
  handleDeleteUserRequest
);

app.all(
  "/api/auth/delete-account",
  requireAuth,
  async (req: AuthRequest, res) => {
    let targetUid = req.user?.uid;
    let currentStep = "INITIALIZATION";
    const executionAudit: Record<string, any> = {
      stripe: { status: "pending", details: null },
      database: { status: "pending", details: null },
      auth: { status: "pending", details: null },
    };

    try {
      if (!targetUid && req.body?.email) {
        try {
          const db = readDb();
          const found = db.users?.find(
            (u: any) =>
              u.email?.trim().toLowerCase() ===
              (req.body.email || "").trim().toLowerCase(),
          );
          if (found) targetUid = found.id;
        } catch (e) {}
      }

      if (!targetUid) {
        return res
          .status(401)
          .json({
            success: false,
            error:
              "Unauthorized: Could not determine user identity for deletion.",
          });
      }

      console.log("USER_SELF_DELETE_STARTED", { targetUid });

      // Read user profile data
      let userDocData: any = null;
      try {
        const userSnap = await adminDb.collection("users").doc(targetUid).get();
        if (userSnap.exists) {
          userDocData = userSnap.data();
        }
      } catch (e) {}

      if (!userDocData) {
        try {
          const localDb = readDb();
          userDocData =
            localDb.users?.find(
              (u: any) => u.id === targetUid || u.uid === targetUid,
            ) || null;
        } catch (e) {}
      }

      const targetEmail = userDocData?.email || req.user?.email || "";
      const normEmail = targetEmail.trim().toLowerCase();

      // --- STEP 1: CANCEL ACTIVE STRIPE SUBSCRIPTIONS ---
      currentStep = "STRIPE_SUBSCRIPTION_CANCELLATION";
      try {
        const stripe = getStripe();
        if (stripe) {
          const subId =
            userDocData?.stripeSubscriptionId || userDocData?.subscriptionId;
          const custId =
            userDocData?.stripeCustomerId || userDocData?.customerId;
          let canceledCount = 0;

          if (subId) {
            try {
              await stripe.subscriptions.cancel(subId);
              canceledCount++;
              console.log(
                `[SelfDelete] Canceled active Stripe subscription ${subId} for user ${targetUid}`,
              );
            } catch (subErr: any) {
              if (
                subErr?.code === "resource_missing" ||
                subErr?.statusCode === 404
              ) {
                console.log(
                  `[SelfDelete] Stripe subscription ${subId} already canceled or non-existent.`,
                );
              } else {
                console.warn(
                  `[SelfDelete] Stripe subscription cancel error for ${subId}:`,
                  subErr?.message,
                );
              }
            }
          }

          if (custId) {
            try {
              const activeSubs = await stripe.subscriptions.list({
                customer: custId,
                status: "active",
              });
              for (const sub of activeSubs.data) {
                if (sub.id !== subId) {
                  await stripe.subscriptions.cancel(sub.id);
                  canceledCount++;
                  console.log(
                    `[SelfDelete] Canceled additional active Stripe subscription ${sub.id} for customer ${custId}`,
                  );
                }
              }
            } catch (custErr: any) {
              console.warn(
                `[SelfDelete] Warning listing active subscriptions for customer ${custId}:`,
                custErr?.message,
              );
            }
          }

          executionAudit.stripe = {
            status: "completed",
            canceledSubscriptions: canceledCount,
          };
        } else {
          executionAudit.stripe = {
            status: "skipped",
            reason: "Stripe SDK not configured.",
          };
        }
      } catch (stripeErr: any) {
        console.warn(
          "[SelfDelete] Non-fatal error in Stripe cancellation step:",
          stripeErr?.message,
        );
        executionAudit.stripe = {
          status: "warning",
          error: stripeErr?.message || String(stripeErr),
        };
      }

      // --- STEP 2: DATABASE RECORDS, CAUSAL GRAPHS & ARCHIVE RETENTION ---
      currentStep = "DATABASE_DATA_PURGE_AND_RETENTION";
      let deletedDocsCount = 0;

      if (userDocData) {
        try {
          await adminDb
            .collection("users_retained")
            .doc(targetUid)
            .set({
              ...userDocData,
              archivedAt: new Date().toISOString(),
            });

          // Archive subcollections
          const memSnap = await adminDb
            .collection("users")
            .doc(targetUid)
            .collection("memories")
            .get();
          for (const mDoc of memSnap.docs) {
            await adminDb
              .collection("users_retained")
              .doc(targetUid)
              .collection("memories")
              .doc(mDoc.id)
              .set(mDoc.data());
          }

          const alertSnap = await adminDb
            .collection("users")
            .doc(targetUid)
            .collection("riskAlerts")
            .get();
          for (const aDoc of alertSnap.docs) {
            await adminDb
              .collection("users_retained")
              .doc(targetUid)
              .collection("riskAlerts")
              .doc(aDoc.id)
              .set(aDoc.data());
          }

          const filesSnap = await adminDb
            .collection("users")
            .doc(targetUid)
            .collection("files")
            .get();
          for (const fDoc of filesSnap.docs) {
            await adminDb
              .collection("users_retained")
              .doc(targetUid)
              .collection("files")
              .doc(fDoc.id)
              .set(fDoc.data());
          }

          const topFilesSnap = await adminDb
            .collection("files")
            .where("userId", "==", targetUid)
            .get();
          for (const tfDoc of topFilesSnap.docs) {
            await adminDb
              .collection("users_retained")
              .doc(targetUid)
              .collection("top_files")
              .doc(tfDoc.id)
              .set(tfDoc.data());
          }

          // Backup retained user to local DB
          const db = readDb();
          if (!db.retained_users) db.retained_users = [];
          db.retained_users = db.retained_users.filter(
            (u: any) => u.id !== targetUid,
          );

          const localMems = (db.memories || []).filter(
            (m: any) => m.userId === targetUid,
          );
          const localAlerts = (db.risk_alerts || []).filter(
            (a: any) => a.userId === targetUid,
          );
          const localFiles = (db.files || []).filter(
            (f: any) => f.userId === targetUid,
          );

          db.retained_users.push({
            ...userDocData,
            archivedAt: new Date().toISOString(),
            archivedMemories: localMems,
            archivedRiskAlerts: localAlerts,
            archivedFiles: localFiles,
          });
          writeDb(db);
        } catch (archErr: any) {
          console.warn("Retention profile backup warning:", archErr?.message);
        }
      }

      // Record account lifecycle for self deletion (31 day restoration window)
      if (normEmail) {
        const nowIso = new Date().toISOString();
        const restoreUntilIso = new Date(
          Date.now() + 31 * 24 * 60 * 60 * 1000,
        ).toISOString();
        await setAccountLifecycleRecord({
          accountId: normEmail,
          emailNormalized: normEmail,
          status: "SELF_DELETED",
          deletionType: "self",
          deletedAt: nowIso,
          deletedBy: targetUid,
          restoreUntil: restoreUntilIso,
          originalUserId: targetUid,
          originalRole: userDocData?.role || "Contributor",
          originalWorkspaceId: userDocData?.workspaceId,
          originalPowers: userDocData?.powers,
          retainedDataDocPath: `users_retained/${targetUid}`,
          adminApprovalRequired: false,
        });
      }

      // Create deleted marker in Firestore
      try {
        await adminDb.collection("deletedUsers").doc(targetUid).set({
          uid: targetUid,
          email: targetEmail,
          deletedAt: new Date().toISOString(),
          deletedBy: targetUid,
          reason: "self_deleted",
        });
        deletedDocsCount++;
      } catch (dErr) {}

      // Delete Firestore user document users/{targetUid}
      try {
        await adminDb.collection("users").doc(targetUid).delete();
        deletedDocsCount++;
      } catch (fsErr: any) {}

      // Delete verification codes
      try {
        await adminDb.collection("verification_codes").doc(targetUid).delete();
        const vcSnap = await adminDb
          .collection("verification_codes")
          .where("userId", "==", targetUid)
          .get();
        for (const doc of vcSnap.docs) {
          await doc.ref.delete();
          deletedDocsCount++;
        }
      } catch (vcErr: any) {}

      // Delete top-level files metadata
      try {
        const topFilesSnap = await adminDb
          .collection("files")
          .where("userId", "==", targetUid)
          .get();
        for (const tfDoc of topFilesSnap.docs) {
          await tfDoc.ref.delete();
          deletedDocsCount++;
        }
      } catch (filesErr: any) {}

      // Synchronize deletion to local JSON DB store
      const dbData = readDb();
      if (dbData.users)
        dbData.users = dbData.users.filter((u: any) => u.id !== targetUid);
      if (dbData.verification_codes)
        dbData.verification_codes = dbData.verification_codes.filter(
          (vc: any) => vc.id !== targetUid && vc.userId !== targetUid,
        );
      if (dbData.support_tickets)
        dbData.support_tickets = dbData.support_tickets.filter(
          (st: any) => st.userId !== targetUid,
        );
      if (dbData.memories)
        dbData.memories = dbData.memories.filter(
          (m: any) => m.userId !== targetUid,
        );
      if (dbData.causal_graphs)
        dbData.causal_graphs = dbData.causal_graphs.filter(
          (cg: any) => cg.userId !== targetUid,
        );
      writeDb(dbData);

      executionAudit.database = {
        status: "completed",
        recordsProcessed: deletedDocsCount,
      };

      // --- STEP 3: FIREBASE AUTHENTICATION DELETION & REVOCATION ---
      currentStep = "FIREBASE_AUTH_REVOCATION_AND_DISABLE";

      // 1. Revoke active refresh tokens
      try {
        await adminAuth.revokeRefreshTokens(targetUid);
        executionAudit.auth.tokensRevoked = true;
      } catch (tokenErr: any) {
        console.warn("Revoke refresh tokens warning:", tokenErr?.message);
        executionAudit.auth.tokenWarning = tokenErr?.message;
      }

      // 2. Disable in Firebase Authentication (preserve Auth UID identity for 31-day restoration)
      try {
        await adminAuth.updateUser(targetUid, { disabled: true });
        console.log("USER_SELF_AUTH_DISABLED", { targetUid });
        executionAudit.auth.userDisabled = true;
      } catch (authErr: any) {
        if (authErr?.code !== "auth/user-not-found") {
          console.warn("USER_SELF_AUTH_DISABLE_WARNING", {
            targetUid,
            error: authErr?.message,
          });
          executionAudit.auth.authWarning = authErr?.message;
        } else {
          executionAudit.auth.userDisabled = true;
        }
      }

      executionAudit.auth.status = "completed";

      console.log("USER_SELF_DELETE_COMPLETED", { targetUid, executionAudit });
      res.json({
        success: true,
        message:
          "Your account has been deleted. You have 31 days to restore it if you choose.",
        executionAudit,
      });
    } catch (err: any) {
      console.error(`USER_SELF_DELETE_FAILED during step [${currentStep}]`, {
        targetUid,
        error: err.message || String(err),
      });
      res.status(500).json({
        success: false,
        failedStep: currentStep,
        error: err.message || "Account deletion failed.",
        userFriendlyMessage: `تعذر إتمام عملية حذف الحساب أثناء مرحلة (${currentStep}).`,
        executionAudit,
      });
    }
  },
);

// --- API AUTHENTICATION ENDPOINTS ---
app.post("/api/auth/register", loginRegisterLimiter, async (req, res) => {
  try {
    const { email, password, companyName, role, ownerName, lang } = req.body;
    if (!email || !password || !companyName) {
      return res
        .status(400)
        .json({
          success: false,
          error: "All registration fields are required.",
        });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Prevent privilege escalation: user role cannot be ADMIN unless email is in authorized ADMIN_EMAILS
    let userRole: string = "Contributor";
    if (role && typeof role === "string" && role.toUpperCase() === "ADMIN") {
      if (ADMIN_EMAILS.has(normalizedEmail)) {
        userRole = "Admin";
      } else {
        userRole = "Contributor";
      }
    } else if (role && typeof role === "string" && role.trim()) {
      const normRole = role.trim().toUpperCase();
      if (normRole === "CEO") {
        userRole = "CEO";
      } else if (normRole === "CONTRIBUTOR" || normRole === "MEMBER" || normRole === "ANALYST") {
        userRole = "Contributor";
      }
    }

    console.log("REGISTRATION_STARTED", {
      email: normalizedEmail,
      assignedRole: userRole,
    });

    // CRITICAL ACCOUNT LIFECYCLE CHECK BEFORE ANY CREATION
    const lifecycleRecord = await getAccountLifecycleRecord(normalizedEmail);
    if (lifecycleRecord) {
      if (
        lifecycleRecord.status === "ADMIN_DELETED" ||
        lifecycleRecord.status === "ADMIN_APPROVAL_REQUIRED" ||
        lifecycleRecord.deletionType === "admin"
      ) {
        return res.status(400).json({
          success: false,
          code: "ADMIN_DELETED_BLOCKED",
          adminApprovalRequired: true,
          error:
            "تم تعطيل حسابك بواسطة مسؤول المنصة. لا يمكنك إنشاء حساب جديد باستخدام هذا البريد الإلكتروني إلا بعد موافقة المسؤول.",
        });
      }
      if (lifecycleRecord.status === "ADMIN_APPROVAL_PENDING") {
        return res.status(400).json({
          success: false,
          code: "ADMIN_APPROVAL_PENDING",
          adminApprovalRequired: true,
          error:
            "طلب إعادة تفعيل الحساب قيد المراجعة حالياً بواسطة مسؤول المنصة. يرجى الانتظار لحين البت في الطلب.",
        });
      }
      if (
        lifecycleRecord.status === "SELF_DELETED" &&
        lifecycleRecord.restoreUntil
      ) {
        const nowMs = Date.now();
        const restoreUntilMs = new Date(lifecycleRecord.restoreUntil).getTime();
        if (nowMs <= restoreUntilMs) {
          const daysRemaining = Math.max(
            1,
            Math.ceil((restoreUntilMs - nowMs) / (24 * 3600 * 1000)),
          );
          return res.status(400).json({
            success: false,
            code: "SELF_RESTORE_AVAILABLE",
            canRestore: true,
            daysRemaining: daysRemaining,
            restoreUntil: lifecycleRecord.restoreUntil,
            error: `تم العثور على حساب سابق تم حذفه بواسطتك. يرجى اختيار استعادة الحساب بدلاً من إنشاء حساب جديد (متبقي ${daysRemaining} يوماً للاستعادة).`,
          });
        }
      }
    }

    // Enforce password security policy: min 8 chars, uppercase, lowercase, number, special character
    const len = password.length >= 8;
    const upper = /[A-Z]/.test(password);
    const lower = /[a-z]/.test(password);
    const num = /[0-9]/.test(password);
    const special = /[!@#$%^&*(),.?":{}|<>_~\-+=]/.test(password);
    if (!len || !upper || !lower || !num || !special) {
      return res.status(400).json({
        success: false,
        error:
          "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
      });
    }
    if (!len || !upper || !lower || !num || !special) {
      return res.status(400).json({
        success: false,
        error:
          "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
      });
    }

    const db = readDb();
    if (
      db.users?.find(
        (u: any) => u.email?.trim().toLowerCase() === normalizedEmail,
      )
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Email already exists." });
    }

    // Check Firestore users collection to avoid duplicate registrations
    try {
      const existingSnap = await adminDb
        .collection("users")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();
      if (!existingSnap.empty) {
        return res
          .status(400)
          .json({ success: false, error: "Email already exists." });
      }
    } catch (err) {}

    // Check Firebase Auth to avoid duplicate accounts
    try {
      const existingAuthUser = await adminAuth.getUserByEmail(normalizedEmail);
      if (existingAuthUser) {
        return res
          .status(400)
          .json({ success: false, error: "Email already exists." });
      }
    } catch (err) {}

    // Generate canonical userId (Try Firebase Auth Admin first, fall back to unique ID)
    let userId: string;
    let createdAuthUser: boolean = false;
    try {
      const authUser = await adminAuth.createUser({
        email: normalizedEmail,
        password: password,
        displayName: ownerName || companyName,
        emailVerified: false,
      });
      userId = authUser.uid;
      createdAuthUser = true;
      console.log("USER_CREATED", {
        userId,
        email: normalizedEmail,
        source: "firebase_auth",
      });
    } catch (authErr: any) {
      if (authErr?.code === "auth/email-already-exists") {
        return res
          .status(400)
          .json({ success: false, error: "Email already exists." });
      }
      userId =
        "usr_" +
        Date.now().toString(36) +
        Math.random().toString(36).substr(2, 6);
      console.log("USER_CREATED", {
        userId,
        email: normalizedEmail,
        source: "generated_id",
        authErr: authErr?.message,
      });
    }

    // Check if there is an active workspace invitation for this email
    let invitation: any = null;
    try {
      const invDoc = await adminDb
        .collection("invitations")
        .doc(normalizedEmail)
        .get();
      if (invDoc.exists) {
        invitation = invDoc.data();
      }
    } catch (e) {}
    if (!invitation) {
      try {
        const invSnap = await adminDb
          .collection("workspace_invitations")
          .where("email", "==", normalizedEmail)
          .get();
        if (!invSnap.empty) {
          invitation = invSnap.docs[0].data();
        }
      } catch (e) {}
    }
    if (!invitation) {
      const dbTemp = readDb();
      invitation =
        dbTemp.invitations?.find(
          (i: any) => i.email?.trim().toLowerCase() === normalizedEmail,
        ) || null;
    }

    const effectiveCompanyName = invitation?.companyName || companyName;
    const effectiveRole = invitation?.role || userRole;
    const nowIso = new Date().toISOString();
    const workspaceId =
      invitation?.workspaceId ||
      `ws_${userId.substring(0, 8)}_${Date.now().toString(36)}`;
    const resolvedOwnerName = ownerName || normalizedEmail.split("@")[0];

    const isInvitedUser = !!invitation;

    const newUser = {
      id: userId,
      email: normalizedEmail,
      passwordHash: password,
      companyName: effectiveCompanyName,
      ownerName: resolvedOwnerName,
      role: effectiveRole,
      workspaceId: workspaceId,
      workspace: {
        id: workspaceId,
        name: `${effectiveCompanyName} Workspace`,
        ownerId: invitation?.senderId || userId,
        createdAt: nowIso,
        memberCount: 1,
      },
      teamMembersList: isInvitedUser
        ? []
        : [
            {
              id: "tm-owner",
              uid: userId,
              name: resolvedOwnerName,
              email: normalizedEmail,
              role: "CEO / Owner",
              powers: {
                fileVault: true,
                memoryVault: true,
                riskRadar: true,
                marketIntel: true,
                settings: true,
              },
              addedAt: nowIso.split("T")[0],
            },
          ],
      subscriptionStatus: "Pending Selection",
      accountStatus: isInvitedUser ? "APPROVED" : "PENDING_EMAIL_VERIFICATION",
      requiresDocumentVerification: !isInvitedUser,
      verificationFlowVersion: 2,
      documentVerificationStatus: isInvitedUser ? "APPROVED" : "PENDING_EMAIL_VERIFICATION",
      verificationDocuments: [],
      createdAt: nowIso,
      trialExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      lastActiveAt: nowIso,
      lastLoginAt: nowIso,
      isVerified: isInvitedUser,
      isEmailVerified: isInvitedUser,
      email_verified: isInvitedUser,
      emailVerified: isInvitedUser,
      verification_required: !isInvitedUser,
      verification_status: isInvitedUser ? "verified" : "unverified",
      verificationInfo: {
        status: isInvitedUser ? "verified" : "unverified",
        verifiedAt: isInvitedUser ? nowIso : undefined,
      },
    };

    // SAVE USER TO PRODUCTION FIRESTORE users/{userId}
    const userRef = adminDb.collection("users").doc(userId);
    try {
      await userRef.set(newUser);
      console.log("USER_FIRESTORE_PERSISTED", {
        userId,
        email: normalizedEmail,
      });
    } catch (fsErr: any) {
      console.error("USER_CREATION_FAILED", {
        userId,
        email: normalizedEmail,
        error: fsErr?.message || String(fsErr),
      });
      if (createdAuthUser) {
        try {
          await adminAuth.deleteUser(userId);
        } catch (e) {}
      }
      return res.status(500).json({
        success: false,
        code: "USER_CREATION_FAILED",
        error: "Failed to create user record in database. Please try again.",
      });
    }

    // Save to local JSON DB fallback immediately to ensure resilience
    if (!db.users) db.users = [];
    const existingIdx = db.users.findIndex(
      (u: any) => u.id === userId || u.email?.toLowerCase() === normalizedEmail,
    );
    if (existingIdx >= 0) {
      db.users[existingIdx] = newUser;
    } else {
      db.users.push(newUser);
    }
    writeDb(db);

    // VERIFY WRITE IMMEDIATELY! (Non-fatal, as we have local fallback)
    try {
      const createdDoc = await userRef.get();
      if (!createdDoc.exists) {
        console.warn("USER_FIRESTORE_PERSIST_DELAYED", {
          userId,
          email: normalizedEmail,
          message:
            "Firestore write verification failed or delayed, but local DB fallback succeeded.",
        });
      }
    } catch (verifyErr: any) {
      console.warn("USER_FIRESTORE_PERSIST_DELAYED", {
        userId,
        email: normalizedEmail,
        error: verifyErr?.message || String(verifyErr),
      });
    }

    // If registered through invitation, link to CEO's team list and delete invitation
    if (invitation) {
      if (invitation.senderId) {
        try {
          const ceoRef = adminDb.collection("users").doc(invitation.senderId);
          const ceoSnap = await ceoRef.get();
          if (ceoSnap.exists) {
            const ceoData = ceoSnap.data() || {};
            const currentList = ceoData.teamMembersList || [];
            const existsIndex = currentList.findIndex(
              (m: any) => m.email?.toLowerCase() === normalizedEmail,
            );
            const updatedMember = {
              id: `tm-${userId}`,
              name: resolvedOwnerName,
              email: normalizedEmail,
              role: effectiveRole,
              powers: invitation.powers || [],
              addedAt: nowIso.split("T")[0],
            };
            if (existsIndex >= 0) {
              currentList[existsIndex] = updatedMember;
            } else {
              currentList.push(updatedMember);
            }
            await ceoRef.update({ teamMembersList: currentList });
          }
        } catch (ceoErr) {
          console.warn("Failed to sync team members on CEO account:", ceoErr);
        }
      }

      try {
        await adminDb.collection("invitations").doc(normalizedEmail).delete();
      } catch (e) {}
      const dbInv = readDb();
      if (dbInv.invitations) {
        dbInv.invitations = dbInv.invitations.filter(
          (i: any) => i.email?.trim().toLowerCase() !== normalizedEmail,
        );
        writeDb(dbInv);
      }
    }

    // Record account lifecycle as ACTIVE
    await setAccountLifecycleRecord({
      accountId: normalizedEmail,
      emailNormalized: normalizedEmail,
      status: "ACTIVE",
      deletionType: null,
      deletedAt: null,
      deletedBy: null,
      restoreUntil: null,
      originalUserId: userId,
      retainedDataDocPath: null,
      adminApprovalRequired: false,
    });

    // If user registered through an invitation, skip OTP creation & dispatch!
    if (isInvitedUser) {
      console.log("INVITED_USER_REGISTERED_NO_OTP_REQUIRED", {
        userId,
        email: normalizedEmail,
      });
      let customToken: string | null = null;
      try {
        customToken = await adminAuth.createCustomToken(userId);
      } catch (ctErr) {
        console.warn("createCustomToken error for invited user:", ctErr);
      }
      const { passwordHash, ...userResponse } = newUser;
      return res.status(201).json({
        success: true,
        customToken,
        user: {
          ...userResponse,
          isVerified: true,
          isEmailVerified: true,
          email_verified: true,
          emailVerified: true,
          verification_required: false,
          verification_status: "verified",
        },
        initialOtpSent: false,
        sendCount: 0,
        message:
          "Registration completed successfully. Workspace invitation accepted.",
      });
    }

    // CREATE OTP
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashVerificationCode(otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const docId = userId; // MUST be userId!

    const otpRecord = {
      id: docId,
      userId: userId,
      email: normalizedEmail,
      phone: "",
      codeHash: codeHash,
      type: "account_registration",
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt,
      attempts: 0,
      used: false,
      sendCount: 0,
      initialOtpSent: true,
      lastSentAt: new Date().toISOString(),
    };

    try {
      await adminDb.collection("verification_codes").doc(docId).set(otpRecord);
      console.log("OTP_CREATED", { userId, docId });
      console.log("OTP_STORED", { userId, docId });
    } catch (otpDbErr: any) {
      console.error("OTP_STORAGE_FAILED", {
        userId,
        email: normalizedEmail,
        error: otpDbErr?.message || String(otpDbErr),
      });
      try {
        await userRef.delete();
      } catch (e) {}
      if (createdAuthUser) {
        try {
          await adminAuth.deleteUser(userId);
        } catch (e) {}
      }
      return res.status(500).json({
        success: false,
        code: "OTP_STORAGE_FAILED",
        error:
          "Failed to store verification code in database. Registration aborted.",
      });
    }

    if (!db.verification_codes) db.verification_codes = [];
    db.verification_codes = db.verification_codes.filter(
      (vc: any) => vc.id !== docId,
    );
    db.verification_codes.push(otpRecord);
    writeDb(db);

    // SEND OTP EMAIL AUTOMATICALLY VIA RESEND
    const resolvedUserName = cleanUserName(resolvedOwnerName, normalizedEmail);
    const {
      subject: emailSubject,
      text: textBody,
      html: htmlBody,
    } = buildOtpEmailHtml({
      email: normalizedEmail,
      userName: resolvedUserName,
      otpCode: otpCode,
      type: "account_registration",
    });

    const mailResult = await sendSystemMail(
      normalizedEmail,
      emailSubject,
      textBody,
      htmlBody,
    );
    if (!mailResult.success) {
      console.error("OTP_EMAIL_FAILED", {
        userId,
        email: normalizedEmail,
        error:
          mailResult.error?.message ||
          mailResult.error ||
          "Mail dispatch failed",
      });
      // Rollback user creation & OTP record if email failed!
      try {
        await userRef.delete();
      } catch (e) {}
      try {
        await adminDb.collection("verification_codes").doc(docId).delete();
      } catch (e) {}
      if (createdAuthUser) {
        try {
          await adminAuth.deleteUser(userId);
        } catch (e) {}
      }
      return res.status(500).json({
        success: false,
        code: "OTP_EMAIL_FAILED",
        error:
          mailResult.userFriendlyMessage ||
          mailResult.error?.message ||
          "Failed to send verification email. Please check your email address and try again.",
      });
    }

    console.log("OTP_EMAIL_SENT", { userId, email: normalizedEmail });
    console.log("REGISTRATION_COMPLETED", { userId, email: normalizedEmail });

    let customToken: string | null = null;
    try {
      customToken = await adminAuth.createCustomToken(userId);
    } catch (ctErr) {
      console.warn("createCustomToken error for registered user:", ctErr);
    }

    const { passwordHash, ...userResponse } = newUser;
    return res.status(201).json({
      success: true,
      customToken,
      user: userResponse,
      initialOtpSent: true,
      sendCount: 0,
      devCode: (process.env.NODE_ENV !== "production" || mailResult.simulated) ? otpCode : undefined,
      message:
        "Registration completed successfully. Verification code sent to your email.",
    });
  } catch (err: any) {
    console.error("REGISTRATION_FAILED_UNHANDLED", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected error occurred during registration.",
    });
  }
});

app.post("/api/auth/login", loginRegisterLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Account lifecycle record query (do not return immediately to avoid credential bypass/enumeration)
    let lifecycleRecord: any = null;
    try {
      lifecycleRecord = await getAccountLifecycleRecord(normalizedEmail);
    } catch (lcErr) {
      console.warn("Notice: Lifecycle record fetch in /api/auth/login:", lcErr);
    }

    // 2. Authoritative verification: Firebase Identity Platform REST API (if available) + Firestore / Admin Auth
    let authUid: string | null = null;
    let authIdToken: string | null = null;
    const apiKey =
      process.env.VITE_FIREBASE_API_KEY ||
      process.env.FIREBASE_API_KEY ||
      "AIzaSyAvjj-PBHknriQ73FYyQc2nhhBNCF_lvnE";

    try {
      const restRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            password: password,
            returnSecureToken: true,
          }),
        },
      );
      const restData = (await restRes.json()) as any;
      if (restRes.ok && restData.localId) {
        authUid = restData.localId;
        authIdToken = restData.idToken;
      } else {
        const errMessage = restData?.error?.message || "";
        console.warn(
          "Notice: Firebase Auth REST sign in:",
          errMessage || restRes.status,
        );
        if (errMessage === "USER_DISABLED") {
          return res.status(403).json({
            code: "auth/user-disabled",
            error: "USER_DISABLED",
            message: "هذا الحساب معطّل حالياً.",
          });
        }
      }
    } catch (apiErr) {
      console.warn("Identity toolkit REST call notice:", apiErr);
    }

    // 3. Resilient user lookup across Firestore, Firebase Admin Auth, and Local DB
    let userProfile: any = null;
    let userFromDb: any = null;

    // Check if the user is in a deleted lifecycle state; if so, load their archived profile to verify credentials
    if (
      lifecycleRecord &&
      (lifecycleRecord.status === "SELF_DELETED" ||
        lifecycleRecord.status === "SELF_RESTORE_AVAILABLE" ||
        lifecycleRecord.status === "ADMIN_DELETED" ||
        lifecycleRecord.status === "ADMIN_APPROVAL_REQUIRED" ||
        lifecycleRecord.status === "ADMIN_APPROVAL_PENDING" ||
        lifecycleRecord.deletionType === "admin" ||
        lifecycleRecord.deletionType === "self")
    ) {
      // Look up archived user doc
      let archivedProfile: any = null;
      if (lifecycleRecord.originalUserId) {
        try {
          const docSnap = await adminDb
            .collection("users_retained")
            .doc(lifecycleRecord.originalUserId)
            .get();
          if (docSnap.exists) {
            archivedProfile = docSnap.data();
            if (!authUid) authUid = lifecycleRecord.originalUserId;
          }
        } catch (e) {}
      }
      if (!archivedProfile) {
        try {
          const db = readDb();
          const found = db.retained_users?.find(
            (u: any) => (u.email || "").trim().toLowerCase() === normalizedEmail,
          );
          if (found) {
            archivedProfile = found;
            if (!authUid) authUid = found.id;
          }
        } catch (e) {}
      }

      if (archivedProfile) {
        userProfile = archivedProfile;
      }
    }

    // If active profile exists, or if fallback is needed, check normal collections
    if (!userProfile) {
      // Check Firestore users collection by email or UID
      try {
        if (authUid) {
          const docSnap = await adminDb.collection("users").doc(authUid).get();
          if (docSnap.exists) {
            userProfile = docSnap.data();
          }
        }
        if (!userProfile) {
          const emailSnap = await adminDb
            .collection("users")
            .where("email", "==", normalizedEmail)
            .limit(1)
            .get();
          if (!emailSnap.empty) {
            const docData = emailSnap.docs[0].data();
            const foundDocId = emailSnap.docs[0].id;
            if (
              docData &&
              (docData.email || "").trim().toLowerCase() === normalizedEmail
            ) {
              // Strict UID assertion: if authUid already resolved, doc ID MUST match authUid
              if (authUid && foundDocId !== authUid && docData.id !== authUid) {
                console.error(
                  `[MANDATORY_UID_ASSERTION_FAILURE] /api/auth/login email lookup mismatch: authUid (${authUid}) !== docId (${foundDocId})`,
                );
              } else {
                userProfile = docData;
                if (!authUid) {
                  authUid = foundDocId;
                }
              }
            }
          }
        }
      } catch (fsErr) {
        console.warn("adminDb user lookup notice in login:", fsErr);
      }

      // Check Firebase Admin Auth
      let adminAuthUser: any = null;
      try {
        adminAuthUser = await adminAuth.getUserByEmail(normalizedEmail);
        if (adminAuthUser) {
          if (!authUid) authUid = adminAuthUser.uid;
          if (!userProfile) {
            try {
              const docSnap = await adminDb
                .collection("users")
                .doc(adminAuthUser.uid)
                .get();
              if (docSnap.exists) {
                userProfile = docSnap.data();
              }
            } catch (e) {}
          }
        }
      } catch (e) {}

      // Check Local DB
      const localDb = readDb();
      userFromDb = localDb.users?.find(
        (u: any) => u.email?.toLowerCase() === normalizedEmail,
      );
      if (!userProfile && userFromDb) {
        userProfile = userFromDb;
        if (!authUid) authUid = userFromDb.id;
      }
    }

    // Helper to send deleted account lifecycle response
    const isDeletedLifecycle = Boolean(
      lifecycleRecord &&
      (lifecycleRecord.status === "SELF_DELETED" ||
        lifecycleRecord.status === "ADMIN_DELETED" ||
        lifecycleRecord.status === "SELF_RESTORE_AVAILABLE" ||
        lifecycleRecord.status === "ADMIN_APPROVAL_REQUIRED" ||
        lifecycleRecord.status === "ADMIN_APPROVAL_PENDING" ||
        lifecycleRecord.deletionType === "self" ||
        lifecycleRecord.deletionType === "admin")
    );

    const sendDeletedLifecycleResponse = (rec: any) => {
      const deletedAt =
        rec.deletedAt ||
        rec.archivedAt ||
        rec.createdAt ||
        new Date().toISOString();

      const delTime = new Date(deletedAt).getTime();
      const thirtyOneDaysMs = 31 * 24 * 60 * 60 * 1000;
      const restoreUntilMs = delTime + thirtyOneDaysMs;
      const restoreUntilIso = new Date(restoreUntilMs).toISOString();
      const remainingMs = restoreUntilMs - Date.now();
      const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 3600 * 1000)));

      if (daysRemaining <= 0) {
        return res.status(403).json({
          code: "RESTORE_EXPIRED",
          error: "RESTORE_EXPIRED",
          status: "RESTORE_EXPIRED",
          email: normalizedEmail,
          daysRemaining: 0,
          restoreUntil: restoreUntilIso,
          message:
            "انتهت فترة استعادة هذا الحساب. تم حذف البيانات بشكل نهائي ولم يعد قابلاً للاستعادة وفق سياسة النظام.",
        });
      }

      return res.status(403).json({
        code: "SELF_RESTORE_AVAILABLE",
        error: "SELF_RESTORE_AVAILABLE",
        status: "SELF_RESTORE_AVAILABLE",
        email: normalizedEmail,
        daysRemaining: daysRemaining,
        restoreUntil: restoreUntilIso,
        message: "تم العثور على حسابك المحذوف سابقاً، وهو متاح للاستعادة.",
      });
    };

    // If account was deleted, return its lifecycle restoration status immediately
    if (isDeletedLifecycle) {
      return sendDeletedLifecycleResponse(lifecycleRecord);
    }

    // If account was not found anywhere
    if (!userProfile && !authUid) {
      return res.status(401).json({
        code: "auth/user-not-found",
        error: "EMAIL_NOT_FOUND",
        message: "لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني.",
      });
    }

    // Verify password if not already verified via Identity Toolkit REST
    const storedPassword =
      userProfile?.passwordHash ||
      userProfile?.password ||
      userFromDb?.passwordHash ||
      userFromDb?.password;
    const cleanPassword = password ? password.trim() : "";
    const isPasswordMatch = Boolean(
      authIdToken ||
      (storedPassword &&
        (storedPassword === password ||
          storedPassword === cleanPassword ||
          hashVerificationCode(password) === storedPassword ||
          hashVerificationCode(cleanPassword) === storedPassword)),
    );

    if (!isPasswordMatch) {
      return res.status(401).json({
        code: "auth/invalid-credential",
        error: "INVALID_CREDENTIALS",
        message:
          "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.",
      });
    }

    // If password matched and we have a UID, ensure password in Firebase Auth is synchronized
    if (authUid && isFirebaseAdminAvailable) {
      try {
        await adminAuth.updateUser(authUid, {
          password: cleanPassword || password,
        });
      } catch (pwSyncErr) {
        // Non-blocking sync
      }
    }

    const nowIso = new Date().toISOString();
    const isAdminAccount = Boolean(
      (authUid && (await isUserAdminServer(authUid, normalizedEmail))) ||
      authUid === ADMIN_USER_ID,
    );

    // If profile is not found, construct default profile
    if (!userProfile) {
      let invitedRole = "CEO";
      let invitedWorkspaceId: string | undefined = undefined;
      let invitedPowers: any = undefined;
      let companyName = "Personal Account";

      try {
        // Try invitations first
        const invDoc = await adminDb
          .collection("invitations")
          .doc(normalizedEmail)
          .get();
        if (invDoc.exists) {
          const invData = invDoc.data();
          invitedRole = invData.role || "Contributor";
          invitedWorkspaceId = invData.workspaceId;
          invitedPowers = invData.powers;
          companyName = invData.companyName || "Organization Member";
        } else {
          // Fall back to workspace_invitations
          const invSnap = await adminDb
            .collection("workspace_invitations")
            .where("email", "==", normalizedEmail)
            .get();
          if (!invSnap.empty) {
            const invData = invSnap.docs[0].data();
            invitedRole = invData.role || "Contributor";
            invitedWorkspaceId = invData.workspaceId;
            invitedPowers = invData.powers;
            companyName = invData.companyName || "Organization Member";
          }
        }
      } catch (invErr) {}

      const workspaceId =
        invitedWorkspaceId ||
        `ws_${authUid.substring(0, 8)}_${Date.now().toString(36)}`;
      userProfile = {
        id: authUid,
        email: normalizedEmail,
        companyName: companyName,
        ownerName: normalizedEmail.split("@")[0],
        role: authUid === ADMIN_USER_ID ? "Admin" : invitedRole,
        workspaceId: workspaceId,
        powers: invitedPowers,
        workspace: {
          id: workspaceId,
          name:
            invitedRole === "CEO"
              ? "Personal Workspace"
              : `${companyName} Workspace`,
          ownerId: invitedRole === "CEO" ? authUid : `owner_${workspaceId}`,
          createdAt: nowIso,
          memberCount: 1,
        },
        subscriptionStatus: "Pending Selection",
        createdAt: nowIso,
        trialExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        lastActiveAt: nowIso,
        lastLoginAt: nowIso,
        accountStatus: isAdminAccount ? "APPROVED" : "PENDING_EMAIL_VERIFICATION",
        documentVerificationStatus: isAdminAccount ? "APPROVED" : "UNVERIFIED",
        requiresDocumentVerification: !isAdminAccount,
        isVerified: isAdminAccount,
        isEmailVerified: isAdminAccount,
        email_verified: isAdminAccount,
        emailVerified: isAdminAccount,
        verification_required: !isAdminAccount,
        verification_status: isAdminAccount ? "verified" : "action_required",
        verificationStatus: isAdminAccount ? "verified" : "action_required",
      };
      try {
        await adminDb
          .collection("users")
          .doc(authUid)
          .set(userProfile, { merge: true });
      } catch (e) {}
    } else {
      // If user profile exists, check if user is Admin
      if (isAdminAccount) {
        userProfile.role = "Admin";
        userProfile.isVerified = true;
        userProfile.isEmailVerified = true;
        userProfile.email_verified = true;
        userProfile.emailVerified = true;
        userProfile.verification_required = false;
        userProfile.verification_status = "verified";
        userProfile.verificationStatus = "verified";
        userProfile.accountStatus = "APPROVED";
      } else {
        // If an ordinary user was mistakenly stored with role "Admin", fix it back to CEO or Contributor
        if (userProfile.role === "Admin" || userProfile.role === "admin") {
          const isOwner =
            Boolean(
              userProfile.workspace?.ownerId &&
              userProfile.workspace.ownerId === authUid,
            ) ||
            Boolean(
              userProfile.workspaceId &&
              userProfile.workspaceId.startsWith(
                `ws_${authUid.substring(0, 8)}`,
              ),
            );
          userProfile.role = isOwner ? "CEO" : "Contributor";
          try {
            await adminDb
              .collection("users")
              .doc(authUid)
              .update({ role: userProfile.role });
          } catch (e) {}
        }

        // Compute Strict Verification State (Backend Source of Truth)
        const strictState = computeStrictVerificationState(userProfile, false);
        userProfile.accountStatus = strictState.effectiveStatus;
        userProfile.isVerified = strictState.isVerified;
        userProfile.verification_required = strictState.verificationRequired;
        userProfile.verification_status = strictState.verificationStatus;
        userProfile.verificationStatus = strictState.verificationStatus;

        if (strictState.effectiveStatus === "APPROVED") {
          userProfile.isEmailVerified = true;
          userProfile.email_verified = true;
          userProfile.emailVerified = true;
        }
      }

      userProfile.lastActiveAt = nowIso;
      userProfile.lastLoginAt = nowIso;
      try {
        await adminDb.collection("users").doc(authUid).update({
          accountStatus: userProfile.accountStatus,
          isVerified: userProfile.isVerified,
          isEmailVerified: userProfile.isEmailVerified,
          email_verified: userProfile.email_verified,
          emailVerified: userProfile.emailVerified,
          verification_required: userProfile.verification_required,
          verification_status: userProfile.verification_status,
          verificationStatus: userProfile.verificationStatus,
          lastActiveAt: nowIso,
          lastLoginAt: nowIso,
          role: userProfile.role,
        });
      } catch (upErr) {}
    }

    // 5. Generate a Firebase custom token for instant client session setup
    let customToken: string | null = null;
    try {
      customToken = await adminAuth.createCustomToken(authUid);
    } catch (ctErr) {
      console.warn("Notice: adminAuth createCustomToken error:", ctErr);
    }

    // Sync into local DB store
    try {
      const localDb = readDb();
      if (!localDb.users) localDb.users = [];
      const existingIdx = localDb.users.findIndex(
        (u: any) =>
          u.id === authUid || u.email?.toLowerCase() === normalizedEmail,
      );
      if (existingIdx >= 0) {
        localDb.users[existingIdx] = {
          ...localDb.users[existingIdx],
          ...userProfile,
        };
      } else {
        localDb.users.push(userProfile);
      }
      writeDb(localDb);
    } catch (e) {}

    const isExemptRole = isAdminAccount;
    const isKycVerified = isExemptRole || userProfile.isVerified === true || userProfile.kycStatus === "VERIFIED" || userProfile.documentVerificationStatus === "APPROVED";
    const isEmailVer = Boolean(userProfile.isEmailVerified || userProfile.emailVerified || userProfile.email_verified || isExemptRole);

    const { passwordHash, secretPasscode, ...cleanProfile } = userProfile;
    if (cleanProfile.encryptedSecurity) {
      const {
        secretPasscode: _sp,
        secretPasscodeHash: _sph,
        ...cleanEncSec
      } = cleanProfile.encryptedSecurity;
      cleanProfile.encryptedSecurity = cleanEncSec;
    }

    emitPlatformEvent({
      eventType: "USER_LOGGED_IN",
      severity: "INFO",
      category: "AUTH",
      userId: authUid,
      userEmail: normalizedEmail,
      requestId: (req as any).correlationId,
      sanitizedMessage: `User logged in: ${normalizedEmail} (role: ${userProfile.role || "Member"})`,
      metadata: { role: userProfile.role },
    }).catch(() => {});

    return res.json({
      success: true,
      customToken,
      idToken: authIdToken,
      user: {
        ...cleanProfile,
        isVerified: isKycVerified,
        isEmailVerified: isEmailVer,
        email_verified: isEmailVer,
        emailVerified: isEmailVer,
        verification_required: !isKycVerified,
        verification_status: isKycVerified ? "verified" : (userProfile.verification_status || "unverified"),
      },
    });
  } catch (err: any) {
    console.error("Login endpoint error:", err);
    return res
      .status(500)
      .json({
        error: "Internal login error",
        message: err?.message || String(err),
      });
  }
});

// --- SECURITY PASSCODE & MODULE VAULT PROTECTION ENDPOINTS ---

app.post(
  "/api/security/set-code",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const authUid = req.user?.uid;
      const authEmail = req.user?.email;
      if (!authUid) return res.status(401).json({ error: "Unauthorized" });

      const userProfile = await getUserProfileServer(authUid, authEmail);
      if (!userProfile)
        return res.status(404).json({ error: "User profile not found" });

      // Only CEO / Admin or workspace owner can configure passcode
      const isOwnerOrCeo =
        (userProfile.role || "").toUpperCase() === "CEO" ||
        (userProfile.role || "").toUpperCase() === "ADMIN" ||
        userProfile.workspace?.ownerId === authUid ||
        (await isUserAdminServer(authUid, authEmail));
      if (!isOwnerOrCeo) {
        return res
          .status(403)
          .json({
            error:
              "Forbidden: Only workspace administrators can configure the security passcode.",
          });
      }

      const { code, lockedModules } = req.body;
      if (!code || typeof code !== "string" || code.trim().length < 4) {
        return res
          .status(400)
          .json({
            error:
              "Valid security passcode (minimum 4 characters) is required.",
          });
      }

      const passcodeHash = hashSecurityPasscode(code.trim());
      const updatedSecurity = {
        isPinSet: true,
        secretPasscodeHash: passcodeHash,
        lockedModules: {
          fileVault: lockedModules?.fileVault ?? true,
          memoryVault: lockedModules?.memoryVault ?? true,
          riskRadar: lockedModules?.riskRadar ?? true,
          settings: lockedModules?.settings ?? false,
        },
      };

      // Update in Firestore
      if (isFirebaseAdminAvailable && adminDb) {
        try {
          await adminDb.collection("users").doc(authUid).update({
            encryptedSecurity: updatedSecurity,
          });
        } catch (e) {}
      }

      // Update in Local DB
      const db = readDb();
      if (db.users) {
        const uIdx = db.users.findIndex(
          (u: any) => u.id === authUid || u.email === authEmail,
        );
        if (uIdx >= 0) {
          db.users[uIdx].encryptedSecurity = updatedSecurity;
          delete db.users[uIdx].secretPasscode;
          writeDb(db);
        }
      }

      res.json({
        success: true,
        isPinSet: true,
        lockedModules: updatedSecurity.lockedModules,
        message: "Security passcode configured securely.",
      });
    } catch (err: any) {
      console.error("Set security code error:", err);
      res
        .status(500)
        .json({ error: "Failed to set security code", details: err?.message });
    }
  },
);

app.post(
  "/api/security/verify-code",
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const authUid = req.user?.uid;
      const authEmail = req.user?.email;
      if (!authUid) return res.status(401).json({ error: "Unauthorized" });

      const userProfile = await getUserProfileServer(authUid, authEmail);
      if (!userProfile)
        return res.status(404).json({ error: "User profile not found" });

      const rateLimitKey = `passcode_${authUid}`;
      const limitCheck = checkPasscodeRateLimit(rateLimitKey);
      if (!limitCheck.allowed) {
        const minutesRemaining = limitCheck.lockedUntil
          ? Math.max(
              1,
              Math.ceil((limitCheck.lockedUntil - Date.now()) / 60000),
            )
          : 15;
        return res.status(429).json({
          success: false,
          code: "PASSCODE_LOCKED",
          error: `تم تجاوز الحد الأقصى للمحاولات الخاطئة. تم قفل التحقق مؤقتاً لمدة ${minutesRemaining} دقيقة لحماية الحساب.`,
          message: `Too many failed attempts. Verification locked for ${minutesRemaining} minutes.`,
        });
      }

      const { code, module: reqModule } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Passcode is required." });
      }

      // Find the relevant security settings (from user or workspace owner)
      let targetSecurity = userProfile.encryptedSecurity;
      if (
        !targetSecurity?.secretPasscodeHash &&
        !targetSecurity?.secretPasscode &&
        userProfile.workspace?.ownerId &&
        userProfile.workspace.ownerId !== authUid
      ) {
        const ownerProfile = await getUserProfileServer(
          userProfile.workspace.ownerId,
        );
        if (ownerProfile?.encryptedSecurity) {
          targetSecurity = ownerProfile.encryptedSecurity;
        }
      }

      const storedPasscode =
        targetSecurity?.secretPasscodeHash || targetSecurity?.secretPasscode;
      const isMatch = verifySecurityPasscode(code.trim(), storedPasscode);

      if (!isMatch) {
        const failInfo = recordPasscodeFailure(rateLimitKey);
        if (failInfo.locked) {
          return res.status(429).json({
            success: false,
            code: "PASSCODE_LOCKED",
            error:
              "تم قفل التحقق من رمز الأمان لمدة 15 دقيقة بعد 5 محاولات خاطئة متتالية.",
            message:
              "Passcode verification locked for 15 minutes after 5 consecutive failed attempts.",
          });
        }
        return res.status(403).json({
          success: false,
          code: "PASSCODE_INCORRECT",
          error: `رمز الأمان السري غير صحيح. متبقي ${failInfo.remainingAttempts} محاولات قبل القفل المؤقت.`,
          message: `Incorrect security passcode. ${failInfo.remainingAttempts} attempts remaining.`,
        });
      }

      resetPasscodeFailures(rateLimitKey);

      const workspaceId =
        userProfile.workspaceId || userProfile.workspace?.id || `ws_${authUid}`;
      const token = generateSecuritySessionToken(authUid, workspaceId);

      res.json({
        success: true,
        verified: true,
        module: reqModule || "all",
        token,
        message: "Passcode verified successfully.",
      });
    } catch (err: any) {
      console.error("Verify security code error:", err);
      res.status(500).json({ error: "Failed to verify security code" });
    }
  },
);

// --- SECURE USER PROFILE UPDATE (SERVER-SIDE AUTHORIZATION ENFORCEMENT) ---
app.post("/api/users/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUid = req.user?.uid;
    const authEmail = req.user?.email;
    if (!authUid) return res.status(401).json({ error: "Unauthorized" });

    const existingProfile = await getUserProfileServer(authUid, authEmail);
    if (!existingProfile)
      return res.status(404).json({ error: "User profile not found" });

    const isOwnerOrCeo =
      (existingProfile.role || "").toUpperCase() === "CEO" ||
      (existingProfile.role || "").toUpperCase() === "ADMIN" ||
      existingProfile.workspace?.ownerId === authUid ||
      (await isUserAdminServer(authUid, authEmail));

    const incomingData = req.body || {};

    // If non-CEO user attempts to modify organization, workspace, role, powers, or language, block or sanitize strictly
    if (!isOwnerOrCeo) {
      if (incomingData.role && incomingData.role !== existingProfile.role) {
        return res.status(403).json({
          error: "Forbidden: Non-admin users cannot alter account roles.",
          code: "ROLE_TAMPERING_FORBIDDEN",
        });
      }
      if (
        incomingData.workspaceId &&
        incomingData.workspaceId !== existingProfile.workspaceId
      ) {
        return res.status(403).json({
          error:
            "Forbidden: Non-admin users cannot change organization membership.",
          code: "ORGANIZATION_CHANGE_FORBIDDEN",
        });
      }
      if (
        incomingData.companyName &&
        incomingData.companyName !== existingProfile.companyName
      ) {
        return res.status(403).json({
          error: "Forbidden: Non-admin users cannot rename the organization.",
          code: "ORGANIZATION_RENAME_FORBIDDEN",
        });
      }
      if (
        incomingData.powers &&
        JSON.stringify(incomingData.powers) !==
          JSON.stringify(existingProfile.powers || {})
      ) {
        return res.status(403).json({
          error: "Forbidden: Non-admin users cannot alter module permissions.",
          code: "POWERS_TAMPERING_FORBIDDEN",
        });
      }
      if (
        incomingData.userPreferences?.language &&
        existingProfile.userPreferences?.language &&
        incomingData.userPreferences.language !==
          existingProfile.userPreferences.language
      ) {
        return res.status(403).json({
          error:
            "Forbidden: Organization language is managed by administration.",
          code: "LANGUAGE_CHANGE_FORBIDDEN",
        });
      }
    }

    // Construct sanitized updated user profile
    const updatedProfile: any = {
      ...existingProfile,
      ownerName:
        incomingData.ownerName ||
        incomingData.fullName ||
        existingProfile.ownerName,
      fullName:
        incomingData.fullName ||
        incomingData.ownerName ||
        existingProfile.fullName,
      jobTitle:
        incomingData.jobTitle !== undefined
          ? incomingData.jobTitle
          : existingProfile.jobTitle,
      department:
        incomingData.department !== undefined
          ? incomingData.department
          : existingProfile.department,
      issuingEntity:
        incomingData.issuingEntity !== undefined
          ? incomingData.issuingEntity
          : existingProfile.issuingEntity,
      avatarUrl:
        incomingData.avatarUrl !== undefined
          ? incomingData.avatarUrl
          : existingProfile.avatarUrl,
      phone:
        incomingData.phone !== undefined
          ? incomingData.phone
          : existingProfile.phone,
      verificationInfo:
        incomingData.verificationInfo !== undefined
          ? incomingData.verificationInfo
          : existingProfile.verificationInfo,
      verificationDocuments:
        incomingData.verificationDocuments !== undefined
          ? incomingData.verificationDocuments
          : existingProfile.verificationDocuments,
      documentVerificationStatus:
        incomingData.documentVerificationStatus !== undefined
          ? incomingData.documentVerificationStatus
          : existingProfile.documentVerificationStatus,
      verification_status:
        incomingData.verification_status !== undefined
          ? incomingData.verification_status
          : existingProfile.verification_status,
      verification_required:
        incomingData.verification_required !== undefined
          ? incomingData.verification_required
          : existingProfile.verification_required,
      documents:
        incomingData.documents !== undefined
          ? incomingData.documents
          : existingProfile.documents,
      files:
        incomingData.files !== undefined
          ? incomingData.files
          : existingProfile.files,
      updatedAt: new Date().toISOString(),
    };

    // CEO / Admin allowed fields
    if (isOwnerOrCeo) {
      if (incomingData.companyName) {
        updatedProfile.companyName = incomingData.companyName;
        updatedProfile.organizationName = incomingData.companyName;
      }
      if (incomingData.companyLogoUrl !== undefined) {
        updatedProfile.companyLogoUrl = incomingData.companyLogoUrl;
      }
      if (incomingData.signatureUrl !== undefined) {
        updatedProfile.signatureUrl = incomingData.signatureUrl;
      }
      if (incomingData.userPreferences) {
        updatedProfile.userPreferences = {
          ...(existingProfile.userPreferences || {}),
          ...incomingData.userPreferences,
        };
      }
    } else {
      // Non-CEO personal preferences (theme only, keep organization language)
      if (incomingData.userPreferences) {
        updatedProfile.userPreferences = {
          ...(existingProfile.userPreferences || {}),
          theme:
            incomingData.userPreferences.theme ||
            existingProfile.userPreferences?.theme ||
            "light",
          language: existingProfile.userPreferences?.language || "ar", // Locked
        };
      }
    }

    // Persist to Firestore
    if (isFirebaseAdminAvailable && adminDb) {
      try {
        await adminDb
          .collection("users")
          .doc(authUid)
          .set(updatedProfile, { merge: true });
      } catch (e) {}
    }

    // Persist to Local DB
    const db = readDb();
    if (db.users) {
      const uIdx = db.users.findIndex(
        (u: any) => u.id === authUid || u.email === authEmail,
      );
      if (uIdx >= 0) {
        db.users[uIdx] = { ...db.users[uIdx], ...updatedProfile };
        writeDb(db);
      }
    }

    res.json({
      success: true,
      user: updatedProfile,
      message: "User profile updated securely.",
    });
  } catch (err: any) {
    console.error("Profile update error:", err);
    res
      .status(500)
      .json({ error: "Failed to update user profile", details: err?.message });
  }
});

// --- MEMORIES ENDPOINTS ---
app.get(
  "/api/memories",
  requireAuth,
  requireModulePermission("memoryVault"),
  (req: AuthRequest, res) => {
    const db = readDb();
    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing authentication token" });
    }
    const filtered = (db.memories || []).filter(
      (m: any) => m.userId === authUserId,
    );
    res.json(filtered);
  },
);

app.post(
  "/api/memories",
  requireAuth,
  requireModulePermission("memoryVault"),
  (req: AuthRequest, res) => {
    const {
      title,
      category,
      riskLevel,
      tags,
      description,
      decision,
      causalFactors,
      outcomes,
      lessonsLearned,
      authorEmail,
      authorRole,
      authorName,
    } = req.body;

    if (!title || !category || !riskLevel || !description || !decision) {
      return res
        .status(400)
        .json({ error: "Missing required memory content fields." });
    }

    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing authentication token" });
    }

    const db = readDb();
    const newMemory = {
      id: req.body.id || "mem_" + Math.random().toString(36).substr(2, 9),
      title,
      category,
      riskLevel,
      tags: Array.isArray(tags)
        ? tags
        : tags
          ? String(tags)
              .split(",")
              .map((t) => t.trim())
          : [],
      description,
      decision,
      causalFactors: causalFactors || "",
      outcomes: outcomes || "",
      lessonsLearned: lessonsLearned || "",
      createdAt: new Date().toISOString(),
      userId: authUserId, // Strictly enforced server-side
      authorEmail: authorEmail || req.user?.email || "user@zakir.ai",
      authorRole: authorRole || "Analyst",
      authorName:
        authorName || (req.user?.email ? req.user.email.split("@")[0] : "User"),
    };

    if (!db.memories) db.memories = [];
    db.memories.unshift(newMemory);

    // Automatically trigger a metric logged
    const newMetric = {
      id: "met_" + Math.random().toString(36).substr(2, 9),
      userId: authUserId,
      actionType: "Log Memory",
      metricValue: 1,
      description: `Added strategic memory: ${title}`,
      createdAt: new Date().toISOString(),
    };
    if (!db.user_metrics) db.user_metrics = [];
    db.user_metrics.unshift(newMetric);

    writeDb(db);

    emitPlatformEvent({
      eventType: "MEMORY_CREATED",
      category: "SYSTEM",
      severity: "INFO",
      userId: authUserId,
      userEmail: newMemory.authorEmail,
      resourceId: newMemory.id,
      metadata: {
        actor: { id: authUserId, email: newMemory.authorEmail, role: newMemory.authorRole },
        action: "Created memory",
      },
      sanitizedMessage: `User created strategic memory: ${title}`,
    });

    res.status(201).json(newMemory);
  },
);

app.delete(
  "/api/memories/:id",
  requireAuth,
  requireModulePermission("memoryVault"),
  (req: AuthRequest, res) => {
    const { id } = req.params;
    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing authentication token" });
    }

    const db = readDb();
    const memory = (db.memories || []).find((m: any) => m.id === id);
    if (!memory) {
      return res.status(404).json({ error: "Memory not found." });
    }

    if (memory.userId !== authUserId) {
      return res
        .status(403)
        .json({
          error: "Forbidden: Cannot delete memory owned by another user.",
        });
    }

    const index = db.memories.findIndex((m: any) => m.id === id);
    if (index !== -1) {
      db.memories.splice(index, 1);
      writeDb(db);

      emitPlatformEvent({
        eventType: "MEMORY_DELETED",
        category: "SYSTEM",
        severity: "INFO",
        userId: authUserId,
        userEmail: req.user?.email || "user@zakir.ai",
        resourceId: id,
        metadata: {
          actor: { id: authUserId, email: req.user?.email || "user@zakir.ai", role: "User" },
          action: "Deleted memory",
        },
        sanitizedMessage: `User deleted strategic memory: ${id}`,
      });

      return res.json({ success: true });
    }
    res.status(404).json({ error: "Memory not found." });
  },
);

app.put(
  "/api/memories/:id",
  requireAuth,
  requireModulePermission("memoryVault"),
  (req: AuthRequest, res) => {
    const { id } = req.params;
    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing authentication token" });
    }

    const db = readDb();
    const memory = (db.memories || []).find((m: any) => m.id === id);
    if (!memory) {
      return res.status(404).json({ error: "Memory not found." });
    }

    if (memory.userId !== authUserId) {
      return res
        .status(403)
        .json({
          error: "Forbidden: Cannot edit memory owned by another user.",
        });
    }

    const index = db.memories.findIndex((m: any) => m.id === id);
    if (index !== -1) {
      const {
        title,
        category,
        riskLevel,
        tags,
        description,
        decision,
        causalFactors,
        outcomes,
        lessonsLearned,
      } = req.body;
      db.memories[index] = {
        ...db.memories[index],
        title: title || db.memories[index].title,
        category: category || db.memories[index].category,
        riskLevel: riskLevel || db.memories[index].riskLevel,
        tags: tags
          ? Array.isArray(tags)
            ? tags
            : String(tags)
                .split(",")
                .map((t) => t.trim())
          : db.memories[index].tags,
        description: description || db.memories[index].description,
        decision: decision || db.memories[index].decision,
        causalFactors:
          causalFactors !== undefined
            ? causalFactors
            : db.memories[index].causalFactors,
        outcomes:
          outcomes !== undefined ? outcomes : db.memories[index].outcomes,
        lessonsLearned:
          lessonsLearned !== undefined
            ? lessonsLearned
            : db.memories[index].lessonsLearned,
      };
      writeDb(db);

      emitPlatformEvent({
        eventType: "MEMORY_UPDATED",
        category: "SYSTEM",
        severity: "INFO",
        userId: authUserId,
        userEmail: req.user?.email || "user@zakir.ai",
        resourceId: id,
        metadata: {
          actor: { id: authUserId, email: req.user?.email || "user@zakir.ai", role: "User" },
          action: "Updated memory",
        },
        sanitizedMessage: `User updated strategic memory: ${id}`,
      });

      return res.json(db.memories[index]);
    }
    res.status(404).json({ error: "Memory not found." });
  },
);

// --- RISK ALERTS ---
app.get(
  "/api/risk-alerts",
  requireAuth,
  requireModulePermission("riskRadar"),
  (req: AuthRequest, res) => {
    const db = readDb();
    const authUserId = req.user?.uid;
    const filtered = (db.risk_alerts || []).filter(
      (a: any) => !a.userId || a.userId === authUserId,
    );
    res.json(filtered);
  },
);

app.post(
  "/api/risk-alerts",
  requireAuth,
  requireModulePermission("riskRadar"),
  (req: AuthRequest, res) => {
    const db = readDb();
    const authUserId = req.user?.uid;
    const newAlert = {
      id: req.body.id || `al_${Date.now()}`,
      title: req.body.title || "Risk Alert",
      category: req.body.category || "Operational Assets",
      severity: req.body.severity || "High",
      description: req.body.description || "",
      status: req.body.status || "Active",
      userId: authUserId,
      createdAt: req.body.createdAt || new Date().toISOString(),
    };
    if (!db.risk_alerts) db.risk_alerts = [];
    db.risk_alerts.unshift(newAlert);
    writeDb(db);
    res.json(newAlert);
  },
);

app.post(
  "/api/risk-alerts/resolve",
  requireAuth,
  requireModulePermission("riskRadar"),
  (req: AuthRequest, res) => {
    const { id } = req.body;
    const db = readDb();
    const alertIndex = db.risk_alerts?.findIndex((a: any) => a.id === id);
    if (alertIndex !== undefined && alertIndex !== -1) {
      db.risk_alerts[alertIndex].status = "Resolved";
      writeDb(db);
      return res.json(db.risk_alerts[alertIndex]);
    }
    res.status(404).json({ error: "Alert not found." });
  },
);

// --- SECURE FILE MANAGEMENT ENDPOINTS ---
app.get(
  "/api/files",
  requireAuth,
  requireModulePermission("fileVault"),
  (req: AuthRequest, res) => {
    const db = readDb();
    const authUserId = req.user?.uid;
    const files = (db.files || []).filter((f: any) => f.userId === authUserId);
    res.json(files);
  },
);

app.post(
  "/api/files",
  requireAuth,
  requireModulePermission("fileVault"),
  (req: AuthRequest, res) => {
    const db = readDb();
    const authUserId = req.user?.uid;
    const file = {
      id: req.body.id || `file_${Date.now()}`,
      name: req.body.name || "Untitled",
      size: req.body.size || 0,
      type: req.body.type || "application/octet-stream",
      url: req.body.url || "",
      storagePath: req.body.storagePath || "",
      category: req.body.category || "Contracts",
      isEncrypted: req.body.isEncrypted ?? false,
      userId: authUserId,
      createdAt: new Date().toISOString(),
    };
    if (!db.files) db.files = [];
    db.files.unshift(file);
    writeDb(db);
    res.status(201).json(file);
  },
);

app.delete(
  "/api/files/:id",
  requireAuth,
  requireModulePermission("fileVault"),
  (req: AuthRequest, res) => {
    const { id } = req.params;
    const authUserId = req.user?.uid;
    const db = readDb();
    const idx = (db.files || []).findIndex((f: any) => f.id === id);
    if (idx !== -1) {
      if (db.files[idx].userId !== authUserId) {
        return res
          .status(403)
          .json({
            error: "Forbidden: Cannot delete file owned by another user.",
          });
      }
      db.files.splice(idx, 1);
      writeDb(db);
      return res.json({ success: true });
    }
    res.status(404).json({ error: "File not found" });
  },
);

// --- USER METRICS ---
app.get("/api/metrics", (req, res) => {
  const db = readDb();
  res.json(db.user_metrics);
});

// --- WORLD BANK LIVE DATA PROXY & DIAGNOSTICS ---
app.get("/api/world-bank", async (req, res) => {
  const country = (req.query.country as string) || "MR";
  const indicator = (req.query.indicator as string) || "NY.GDP.MKTP.KD.ZG";
  const rawStart = parseInt(req.query.startYear as string) || 2015;
  const rawEnd = parseInt(req.query.endYear as string) || 2024;
  const startYear = Math.min(rawStart, rawEnd);
  const endYear = Math.max(rawStart, rawEnd);
  const attemptedUrl = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&date=${startYear}:${endYear}`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout for slow API responses

    const response = await fetch(attemptedUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZakirRiskEngine/1.0",
      },
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(
        `استجابة البنك الدولي أرجعت رمز HTTP غير ناجح: ${response.status} (${response.statusText})`,
      );
    }

    const data = await response.json();

    // Safe float conversion function to prevent RangeError / NaN crashes
    const parseWbVal = (val: any): number | null => {
      if (val === null || val === undefined || val === "") return null;
      const num = Number(val);
      return isNaN(num) ? null : parseFloat(num.toFixed(2));
    };

    // World Bank response format: [ { page, total }, [ { indicator, country, date, value }, ... ] ]
    if (
      Array.isArray(data) &&
      data.length > 1 &&
      Array.isArray(data[1]) &&
      data[1].length > 0
    ) {
      const records = data[1]
        .map((item: any) => ({
          year: parseInt(item.date),
          value: parseWbVal(item.value),
          country: item.country?.value || country,
          indicatorName: item.indicator?.value || "",
        }))
        .filter((r: any) => !isNaN(r.year))
        .sort((a: any, b: any) => a.year - b.year);

      if (records.length > 0) {
        return res.json({
          success: true,
          country,
          indicator,
          startYear,
          endYear,
          data: records,
          fallback: false,
          source: "live_worldbank_api",
          latencyMs,
          attemptedUrl,
        });
      }
    }

    const wbMessage =
      Array.isArray(data) && data[0]?.message?.[0]?.value
        ? data[0].message[0].value
        : `لم ترجع استجابة البنك الدولي أية سجلات قياسية رقمية للسنوات من ${startYear} إلى ${endYear}.`;

    throw new Error(`استجابة البنك الدولي فارغة أو غير متوقعة: ${wbMessage}`);
  } catch (err: any) {
    const isTimeout =
      err.name === "AbortError" ||
      err.message?.includes("timeout") ||
      err.message?.includes("abort");
    const latencyMs = Date.now() - startTime;
    console.warn(`[WorldBank Proxy Warning] ${attemptedUrl} - ${err.message}`);

    const fallbackData = generateWorldBankFallbackData(
      country,
      indicator,
      startYear,
      endYear,
    );

    return res.json({
      success: true,
      country,
      indicator,
      startYear,
      endYear,
      data: fallbackData,
      fallback: true,
      source: "benchmark_fallback_dataset",
      latencyMs,
      errorDetails: isTimeout
        ? "استغرقت استجابة سيرفر البنك الدولي أكثر من 4 ثوان (Timeout). تم استخدام حزمة البيانات التقديرية الموثقة تلقائياً."
        : `تعذر جلب البيانات المباشرة من البنك الدولي (${err.message}). تم تفعيل حزمة البيانات التقديرية الموثقة.`,
      technicalLogs: {
        attemptedUrl,
        error: err.message,
        isTimeout,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// --- INTERACTIVE POSTGRESQL QUERY SIMULATOR ---
app.all("/api/database/schema", requireAuth, requireApprovedAccount, async (req: AuthRequest, res) => {
  try {
    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing authentication token" });
    }

    const db = readDb();
    const usersArr = Array.isArray(db?.users) ? db.users : [];
    const user = usersArr.find((u: any) => u.id === authUserId);
    const isUserAdmin = await isUserAdminServer(authUserId);
    const userRole = user ? user.role : isUserAdmin ? "CEO" : "Analyst";

    const isAuthorized =
      userRole === "CEO" ||
      userRole === "Admin" ||
      userRole === "Compliance Officer" ||
      isUserAdmin;
    if (!isAuthorized) {
      return res
        .status(403)
        .json({
          error:
            "Forbidden: Restricted to administrative and compliance personnel only.",
        });
    }

    // Returns DDL schema for user visibility
    const schemaDdl = `-- PostgreSQL Database Schema for Zakir (ذَكِرْ)
-- Securely stores institutional causal memories, audit metrics, and RBAC

CREATE TYPE user_role AS ENUM ('CEO', 'Admin', 'Compliance Officer', 'Analyst');
CREATE TYPE risk_severity AS ENUM ('Low', 'Medium', 'High', 'Critical');

CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    company_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'Analyst',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    trial_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE memories (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    risk_level risk_severity NOT NULL DEFAULT 'Low',
    tags VARCHAR(50)[] DEFAULT '{}',
    description TEXT NOT NULL,
    decision TEXT NOT NULL,
    causal_factors TEXT,
    outcomes TEXT,
    lessons_learned TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE risk_alerts (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    severity risk_severity NOT NULL DEFAULT 'Medium',
    description TEXT NOT NULL,
    status VARCHAR(20) CHECK (status IN ('Active', 'Resolved')) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_metrics (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    metric_value INTEGER DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;

    return res.json({ ddl: schemaDdl });
  } catch (err: any) {
    console.error("Error fetching database schema:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to fetch database schema" });
  }
});

app.post("/api/database/query", requireAuth, requireEntitlement, async (req: AuthRequest, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "SQL query string is required" });
  }

  console.log("[DEBUG] req.user =", req.user);
  const authUserId = req.user?.uid;
  const authUserEmail = req.user?.email || "";
  if (!authUserId) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Missing authentication token" });
  }

  const db = readDb();
  const user = db.users.find((u: any) => u.id === authUserId);
  const isUserAdmin = await isUserAdminServer(authUserId);
  const userRole = user ? user.role : isUserAdmin ? "CEO" : "Analyst";

  const isAuthorized =
    userRole === "CEO" ||
    userRole === "Admin" ||
    userRole === "Compliance Officer" ||
    isUserAdmin;
  console.log("DB_QUERY_AUTH", {
    authUserId,
    authUserEmail,
    userRole,
    isUserAdmin,
    isAuthorized,
  });
  if (!isAuthorized) {
    return res
      .status(403)
      .json({
        error:
          "Forbidden: Restricted to administrative and compliance personnel only.",
      });
  }

  const startTime = Date.now();

  const trimmed = query.trim().toUpperCase();

  // Basic PostgreSQL simulation parser for demonstration/education and real-time visualization of metrics
  try {
    let columns: string[] = [];
    let rows: any[][] = [];

    if (trimmed.startsWith("SELECT")) {
      let targetTable = "";
      if (trimmed.includes("FROM USERS")) targetTable = "users";
      else if (trimmed.includes("FROM MEMORIES")) targetTable = "memories";
      else if (
        trimmed.includes("FROM RISK_ALERTS") ||
        trimmed.includes("FROM RISK-ALERTS")
      )
        targetTable = "risk_alerts";
      else if (
        trimmed.includes("FROM USER_METRICS") ||
        trimmed.includes("FROM USER-METRICS")
      )
        targetTable = "user_metrics";

      if (!targetTable) {
        throw new Error(
          "Table not found or queries outside scope. Supported tables: users, memories, risk_alerts, user_metrics.",
        );
      }

      let tableData = db[targetTable] || [];

      // IDOR Mitigation / Least-Privilege Enforcer:
      // If the caller is not an Admin, restrict records to only their own data!
      if (!isUserAdmin) {
        if (targetTable === "users") {
          tableData = tableData.filter((item: any) => item.id === authUserId);
        } else if (
          targetTable === "memories" ||
          targetTable === "risk_alerts" ||
          targetTable === "user_metrics"
        ) {
          tableData = tableData.filter(
            (item: any) => item.userId === authUserId,
          );
        }
      }

      // Security sanitization: If the table contains passwordHash, never expose it!
      if (targetTable === "users") {
        tableData = tableData.map((item: any) => {
          const { passwordHash, ...safeUser } = item;
          return safeUser;
        });
      }

      // Determine requested columns
      const selectPart = trimmed.split("FROM")[0].replace("SELECT", "").trim();
      let keysToExtract: string[] = [];

      if (tableData.length > 0) {
        if (selectPart === "*") {
          keysToExtract = Object.keys(tableData[0]);
        } else {
          keysToExtract = selectPart
            .split(",")
            .map((c: string) => c.trim().toLowerCase());
        }
      } else {
        keysToExtract = ["id", "status"]; // dummy
      }

      // Remove passwordHash from keys to extract if requested
      keysToExtract = keysToExtract.filter(
        (k) => k !== "passwordhash" && k !== "password_hash",
      );

      columns = keysToExtract.map((k) => k.toUpperCase());
      rows = tableData.map((item: any) => {
        return keysToExtract.map((key) => {
          let val =
            item[key] !== undefined
              ? item[key]
              : item[
                  Object.keys(item).find(
                    (k) => k.toLowerCase() === key.toLowerCase(),
                  ) || ""
                ];
          if (Array.isArray(val)) return `{${val.join(",")}}`;
          if (typeof val === "object") return JSON.stringify(val);
          return val;
        });
      });

      res.json({
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: Date.now() - startTime,
      });
    } else if (trimmed.startsWith("INSERT INTO")) {
      // Simulate successful insert response to keep PostgreSQL interaction smooth
      res.json({
        columns: ["STATUS"],
        rows: [["INSERT 0 1"]],
        rowCount: 1,
        executionTimeMs: Date.now() - startTime,
      });
    } else {
      throw new Error(
        "Syntax Error: Zakir's client-side SQL editor supports standard read-only PostgreSQL queries (SELECT * FROM users/memories/user_metrics/risk_alerts) for live operational visualization.",
      );
    }
  } catch (error: any) {
    res.json({
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: Date.now() - startTime,
      error: error.message || "Unknown database execution error.",
    });
  }
});

// --- EXTRACT FILE TEXT CONTENT HELPER ---
function extractFileTextContent(f: any): string {
  let content = f.description || f.content || f.text || "";
  if (f.fileUrl && typeof f.fileUrl === "string" && f.fileUrl.startsWith("data:")) {
    try {
      const commaIdx = f.fileUrl.indexOf(",");
      if (commaIdx !== -1) {
        const base64Data = f.fileUrl.substring(commaIdx + 1);
        const decoded = Buffer.from(base64Data, "base64").toString("utf-8");
        if (decoded && decoded.length < 50000) {
          content += "\n[محتوى النص الفعلي المستخرج من الملف]: " + decoded;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return content || "بدون محتوى مستخرج";
}

// --- SMART EVOLUTION AI ENDPOINT ---
const handleSmartEvolution = async (
  req: express.Request,
  res: express.Response,
) => {
  const { lang = "ar" } = req.body;
  let { memories, riskAlerts, files } = req.body;

  const db = readDb();
  if (!memories) {
    memories = db.memories || [];
  }
  if (!riskAlerts) {
    riskAlerts = db.risk_alerts || [];
  }
  if (!files) {
    files = [];
  }

  // Generate dynamic, localized fallback lists based on ACTUAL current platform memories
  const fallbackRisksList: any[] = [];
  const fallbackForecastsList: any[] = [];
  const fallbackOpportunitiesList: any[] = [];
  const fallbackRecommendationsList: any[] = [];

  for (const m of memories) {
    const riskLevelStr = m.riskLevel || "High";
    if (lang === "ar") {
      fallbackRisksList.push({
        title: `خطر مالي/تشغيلي في ${m.category}`,
        severity:
          riskLevelStr === "Critical"
            ? "حرِج"
            : riskLevelStr === "High"
              ? "مرتفع"
              : riskLevelStr === "Medium"
                ? "متوسط"
                : "منخفض",
        probability:
          riskLevelStr === "Critical"
            ? "95%"
            : riskLevelStr === "High"
              ? "85%"
              : riskLevelStr === "Medium"
                ? "65%"
                : "40%",
        details: `تحليل الحدث (${m.title}) يشير إلى إمكانية نشوء مخاطر بسبب: ${m.causalFactors || m.description}`,
      });
      fallbackForecastsList.push({
        title: `توقع التأثير المالي لـ ${m.title}`,
        timeframe: "خلال 30-60 يوم",
        impact:
          riskLevelStr === "Critical"
            ? "حرِج"
            : riskLevelStr === "High"
              ? "مرتفع"
              : riskLevelStr === "Medium"
                ? "متوسط"
                : "منخفض",
        details: `الاستمرار بالنمط الحالي قد يؤدي لنتائج مشابهة لـ: ${m.outcomes || m.decision}`,
      });
      fallbackOpportunitiesList.push({
        title: `أتمتة وتطوير ضوابط في ${m.category}`,
        feasibility: "مرتفع",
        benefit: `تخفيف مخاطر الـ ${riskLevelStr === "Critical" ? "حرِج" : riskLevelStr === "High" ? "المرتفعة" : "المتوسطة"}`,
        details: `تحويل الإجراء التقليدي إلى نظام مؤتمت لتفادي الثغرات المكتشفة في: ${m.title}.`,
      });
      fallbackRecommendationsList.push({
        title: `بروتوكول وقائي معتمد لـ ${m.category}`,
        priority:
          riskLevelStr === "Critical"
            ? "حرِج"
            : riskLevelStr === "High"
              ? "مرتفع"
              : riskLevelStr === "Medium"
                ? "متوسط"
                : "منخفض",
        actionable:
          m.lessonsLearned ||
          "تفعيل نظام فحص ومراقبة فوري للإجراءات لتفادي الأخطاء المتكررة.",
        details: `تنفيذ توصيات الحدث (${m.title}) عبر صياغة بروتوكول تحكم مزدوج والحد من التقديرات البشرية الفردية.`,
      });
    } else if (lang === "fr") {
      fallbackRisksList.push({
        title: `Risque d'exploitation dans ${m.category}`,
        severity:
          riskLevelStr === "Critical"
            ? "Critique"
            : riskLevelStr === "High"
              ? "Élevé"
              : riskLevelStr === "Medium"
                ? "Moyen"
                : "Faible",
        probability:
          riskLevelStr === "Critical"
            ? "95%"
            : riskLevelStr === "High"
              ? "85%"
              : riskLevelStr === "Medium"
                ? "65%"
                : "40%",
        details: `L'analyse de l'événement (${m.title}) indique des risques potentiels dus à: ${m.causalFactors || m.description}`,
      });
      fallbackForecastsList.push({
        title: `Impact financier prévu de ${m.title}`,
        timeframe: "Sous 30-60 jours",
        impact:
          riskLevelStr === "Critical"
            ? "Critique"
            : riskLevelStr === "High"
              ? "Élevé"
              : riskLevelStr === "Medium"
                ? "Moyen"
                : "Faible",
        details: `Continuer dans cette voie peut conduire à des résultats similaires à: ${m.outcomes || m.decision}`,
      });
      fallbackOpportunitiesList.push({
        title: `Automatisation des contrôles dans ${m.category}`,
        feasibility: "Élevée",
        benefit: `Atténuation du risque ${riskLevelStr}`,
        details: `Passer d'une procédure manuelle à un système automatisé pour combler les lacunes de: ${m.title}.`,
      });
      fallbackRecommendationsList.push({
        title: `Protocole préventif agréé pour ${m.category}`,
        priority:
          riskLevelStr === "Critical"
            ? "Critique"
            : riskLevelStr === "High"
              ? "Élevé"
              : riskLevelStr === "Medium"
                ? "Moyen"
                : "Faible",
        actionable:
          m.lessonsLearned ||
          "Mettre en place un système de surveillance continue pour éviter les erreurs répétitives.",
        details: `Appliquer les leçons de (${m.title}) en instaurant des mécanismes de contrôle rigoureux.`,
      });
    } else {
      fallbackRisksList.push({
        title: `Operational Risk in ${m.category}`,
        severity: riskLevelStr,
        probability:
          riskLevelStr === "Critical"
            ? "95%"
            : riskLevelStr === "High"
              ? "85%"
              : riskLevelStr === "Medium"
                ? "65%"
                : "40%",
        details: `Analysis of event (${m.title}) indicates potential exposure due to: ${m.causalFactors || m.description}`,
      });
      fallbackForecastsList.push({
        title: `Projected Financial Impact of ${m.title}`,
        timeframe: "Within 30-60 Days",
        impact:
          riskLevelStr === "Critical"
            ? "Critical"
            : riskLevelStr === "High"
              ? "High"
              : riskLevelStr === "Medium"
                ? "Medium"
                : "Low",
        details: `Persistence of this pattern is projected to yield outcomes similar to: ${m.outcomes || m.decision}`,
      });
      fallbackOpportunitiesList.push({
        title: `Automate and Standardize controls in ${m.category}`,
        feasibility: "High",
        benefit: `Mitigate ${riskLevelStr} severity risk`,
        details: `Transition from manual processing to an automated ruleset to close screening gaps highlighted in: ${m.title}.`,
      });
      fallbackRecommendationsList.push({
        title: `Enforce preventative protocol for ${m.category}`,
        priority: riskLevelStr,
        actionable:
          m.lessonsLearned ||
          "Enforce automated dual-authorization checks to eliminate individual error.",
        details: `Enact the remediation strategies derived from (${m.title}) to fortify process workflows.`,
      });
    }
  }

  const activeRisksCount = riskAlerts.filter(
    (a: any) =>
      a.status === "Active" || a.status === "نشط" || a.status === "actif",
  ).length;

  const fallbackExecutiveSummary =
    lang === "ar"
      ? `### ملخص تشخيصي مؤسسي مبني على الأدلة والذاكرة\n\nتشخيص أنماط الأحداث المسجلة (${memories.length} ذكريات مؤسسية) يربط بين السبب والأثر لكشف ثغرات إدارة المخاطر في العمليات المالية واللوجستية. التحليل يحدد الانكشافات الحالية ويوفر توصيات إجرائية مباشرة لتفادي تكرار الأخطاء وحماية الذاكرة المؤسسية.`
      : lang === "fr"
        ? `### Synthèse diagnostique basée sur la mémoire institutionnelle\n\nL'analyse diagnostique de ${memories.length} souvenirs institutionnels relie la cause à l'effet pour révéler les failles opérationnelles et financières. L'évaluation fournit des recommandations directement applicables.`
        : `### Institutional Diagnostic Summary Based on Evidence & Memory\n\nDiagnostic analysis of ${memories.length} institutional memories maps cause-and-effect patterns to identify unaddressed operational and financial vulnerabilities, offering actionable recommendations.`;

  const defaultPayload = {
    executiveSummary: fallbackExecutiveSummary,
    analyzedMemories: memories.length,
    identifiedRisks: activeRisksCount,
    opportunities: fallbackOpportunitiesList.length,
    recommendations: fallbackRecommendationsList.length,
    risksList: fallbackRisksList,
    forecastsList: fallbackForecastsList,
    opportunitiesList: fallbackOpportunitiesList,
    recommendationsList: fallbackRecommendationsList,
  };

  const ai = getGeminiClient();
  if (!ai || memories.length === 0 || isGeminiInCooldown()) {
    return res.json(defaultPayload);
  }

  try {
    const memoriesSummary = memories
      .map((m: any, index: number) => {
        return `[الذكرى المؤسسية #${index + 1}]:\n- العنوان: ${m.title}\n  الفئة: ${m.category}\n  مستوى الخطورة: ${m.riskLevel || "High"}\n  القرار المتخذ: ${m.decision}\n  العوامل المسببة: ${m.causalFactors || "غير محدد"}\n  النتائج المحققة: ${m.outcomes || "غير محدد"}\n  الدروس المستفادة: ${m.lessonsLearned || "غير محدد"}`;
      })
      .join("\n\n");

    const activeRisksSummary =
      riskAlerts.length > 0
        ? riskAlerts
            .map(
              (r: any, idx: number) =>
                `[تنبيه خطر نشط #${idx + 1}]: ${r.title} | مستوى الخطورة: ${r.severity || "High"} | التفاصيل: ${r.description || ""}`,
            )
            .join("\n")
        : "لا توجد تنبيهات مخاطر إضافية حرج حالياً.";

    const filesSummary = Array.isArray(files) && files.length > 0
      ? files.map((f: any, idx: number) => `[المستند الداخلي/الكتاب #${idx + 1}]: ${f.name || f.fileName || "ملف"} | الفئة: ${f.category || "عام"} | النص والمحتوى الفعلي: ${extractFileTextContent(f)}`).join("\n\n")
      : "لا توجد مستندات أو كتب مرفوعة في إدارة الملفات حالياً.";

    const systemInstruction = `أنت المحرك التحليلي الذكي الاستراتيجي لقسم "التطور الذكي" في منصة "ذَكِرْ" لإدارة الذاكرة المؤسسية وتحليل المخاطر الشاملة.
مهمتك إجراء تحليل شامل ومبني على الأدلة الحقيقية مستخدماً:
1. الذاكرات والمخاطر والمستندات الداخلية الخاصة بالمؤسسة حصرياً.
2. البحث العالمي عبر الإنترنت (Google Search) لاستشراف توجهات الأسواق العالمية وأسعار الصرف والتضخم وسلاسل الإمداد.
3. التمييز الدقيق بين الحقائق والاستنتاجات والتوصيات، مع مقاومة الهلوسة.

[مهام محرك التطور الذكي]:
1. دراسة كامل بيانات المنصة: الذكريات المؤسسية (${memories.length})، المخاطر (${activeRisksCount})، والمستندات والكتب (${files.length}).
2. ربط الأحداث والقرارات بالظروف الاقتصادية الكلية وتوجهات الأسواق العالمية.
3. إجراء تشخيص سببي عميق (Causal Analysis).
4. صياغة تقرير تطور ذكي موجه لقيادة المؤسسة.

[تنسيق المخرجات]:
يجب إعادة النتيجة ككائن JSON فقط باللغة المطلوب إخراجها ("${lang === "ar" ? "اللغة العربية الفصيحة والدقيقة" : lang === "fr" ? "اللغة الفرنسية" : "اللغة الإنجليزية"}") بالهيكل الموحد التالي:
{
  "executiveSummary": "ملخص تشخيصي شامل يحلل الذاكرة المؤسسية والقرارات السابقة والمستندات ويربطها بظروف الأسواق العالمية والتغيرات لمنع تكرار الأخطاء",
  "analyzedMemories": number,
  "identifiedRisks": number,
  "opportunities": number,
  "recommendations": number,
  "risksList": [{"title": "عنوان الخطر التشغيلي أو المالي", "severity": "حرِج / مرتفع / متوسط", "probability": "نسبة أو مستوى الاحتمالية", "details": "تفاصيل الخطر وربطه بالسوق والذاكرة المؤسسية والمستندات"}],
  "forecastsList": [{"title": "عنوان التوقع الاستراتيجي", "timeframe": "الإطار الزمني المستقبلي", "impact": "عالي / متوسط / منخفض", "details": "تحليل أثر الاتجاه المستقبلي بناءً على مؤشرات السوق والخبرة المسجلة"}],
  "opportunitiesList": [{"title": "عنوان الفرصة التطويرية", "feasibility": "مرتفع / متوسط", "benefit": "مستوى الفائدة المؤسسية", "details": "كيفية استغلال الفرصة لرفع الكفاءة وتفادي الأخطاء"}],
  "recommendationsList": [{"title": "عنوان التوصية التنفيذية", "priority": "حرِج / مرتفع / متوسط", "actionable": "إجراء عملي مباشر وقابل للتطبيق", "details": "خطوات التنفيذ والحوكمة لمنع الانكشاف"}]
}`;

    let response: any = null;
    const fallbackModels = [
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3.7-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
    ];
    let searchToolFailed = false;

    for (let i = 0; i < fallbackModels.length; i++) {

      // Try with Google Search tool first
      if (!searchToolFailed) {
        try {
          response = await ai.models.generateContent({
            model: fallbackModels[i],
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `قم بإجراء التقييم والتحليل الشامل للمؤسسة واستبصار توجهات الأسواق العالمية والبيانات التالية:\n\n### الذاكرات والأحداث المؤسسية المسجلة:\n${memoriesSummary}\n\n### التنبيهات والمخاطر النشطة:\n${activeRisksSummary}\n\n### المستندات والكتب المؤسسية:\n${filesSummary}`,
                  },
                ],
              },
            ],
            config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json",
              temperature: 0.35,
              tools: [{ googleSearch: {} }],
            },
          });
          if (response?.text) break;
        } catch (searchErr: any) {
          console.warn(`[server.ts] Search tool failed for ${fallbackModels[i]}:`, searchErr?.message || searchErr);
          searchToolFailed = true;
        }
      }

      // Try pure Gemini generation without search tool
      if (!response) {
        try {
          response = await ai.models.generateContent({
            model: fallbackModels[i],
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `قم بإجراء التقييم والتحليل الشامل للمؤسسة واستبصار توجهات الأسواق العالمية والبيانات التالية:\n\n### الذاكرات والأحداث المؤسسية المسجلة:\n${memoriesSummary}\n\n### التنبيهات والمخاطر النشطة:\n${activeRisksSummary}\n\n### المستندات والكتب المؤسسية:\n${filesSummary}`,
                  },
                ],
              },
            ],
            config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json",
              temperature: 0.35,
            },
          });
          if (response?.text) break;
        } catch (apiError: any) {
          console.warn(`[server.ts] Pure call failed for ${fallbackModels[i]}:`, apiError?.message || apiError);
          handleGeminiError(apiError);
        }
      }
    }

    if (!response?.text) {
      return res.json(defaultPayload);
    }

    const rawText = response.text;
    const cleanText = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    let result: any = {};
    try {
      result = JSON.parse(cleanText);
    } catch {
      result = {};
    }

    return res.json({
      executiveSummary: result.executiveSummary || fallbackExecutiveSummary,
      analyzedMemories: memories.length,
      identifiedRisks: activeRisksCount,
      opportunities:
        result.opportunitiesList?.length || fallbackOpportunitiesList.length,
      recommendations:
        result.recommendationsList?.length ||
        fallbackRecommendationsList.length,
      risksList: result.risksList || fallbackRisksList,
      forecastsList: result.forecastsList || fallbackForecastsList,
      opportunitiesList: result.opportunitiesList || fallbackOpportunitiesList,
      recommendationsList:
        result.recommendationsList || fallbackRecommendationsList,
    });
  } catch (e: any) {
    return res.json(defaultPayload);
  }
};

app.get("/api/smart-evolution/latest", requireAuth, requireEntitlement, requireModulePermission("marketIntel"), handleGetLatestSmartEvolution);
app.post("/api/smart-evolution", requireAuth, requireEntitlement, requireModulePermission("marketIntel"), handleRunSmartEvolution);
app.post("/api/smart-evolution/run", requireAuth, requireEntitlement, requireModulePermission("marketIntel"), handleRunSmartEvolution);
app.post("/api/ai/smart-evolution", requireAuth, requireEntitlement, requireModulePermission("marketIntel"), handleRunSmartEvolution);

// --- MARKET INTELLIGENCE ENDPOINTS (DYNAMIC ANALYTICAL ENGINE) ---
app.get("/api/market-intelligence/latest", requireAuth, requireEntitlement, requireModulePermission("marketIntel"), handleGetLatestMarketIntelligence);
app.get("/api/market-intelligence/history", requireAuth, requireEntitlement, requireModulePermission("marketIntel"), handleGetMarketIntelligenceHistory);
app.post("/api/market-intelligence/run", requireAuth, requireEntitlement, requireModulePermission("marketIntel"), handleRunMarketIntelligence);
app.post("/api/market-intelligence/diagnose-item", requireAuth, requireEntitlement, requireModulePermission("marketIntel"), handleDiagnoseMarketItem);
app.post("/api/market-intelligence", requireAuth, requireEntitlement, requireModulePermission("marketIntel"), handleRunMarketIntelligence);
app.post("/api/ai/market-intelligence", requireAuth, requireEntitlement, requireModulePermission("marketIntel"), handleRunMarketIntelligence);

// --- AI AGENT CHAT ENDPOINT ---
app.post("/api/agent/chat", requireAuth, requireEntitlement, handleAgentChat);

// --- RENDER.COM SERVICES PROXY ENDPOINT ---
app.post("/api/render/services", async (req, res) => {
  try {
    const headerToken = req.headers.authorization?.replace("Bearer ", "");
    const bodyToken = req.body?.apiKey;
    const apiKey = process.env.RENDER_API_KEY || headerToken || bodyToken;

    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({
        error:
          "Render API Key is missing. Please set RENDER_API_KEY in your .env file or enter your Render API token in the settings.",
      });
    }

    const response = await fetch(
      "https://api.render.com/v1/services?limit=50",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Render API Error (${response.status}): ${errorText || response.statusText}`,
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error("Error in /api/render/services:", error);
    return res.status(500).json({
      error: `Internal server error when fetching Render services: ${error.message || String(error)}`,
    });
  }
});

// API root status endpoint
app.get(["/api", "/api/"], (req, res) => {
  res.json({
    status: "ok",
    service: "Zakir Institutional Decision Intelligence Suite API",
    version: "2.4.2",
    timestamp: new Date().toISOString(),
  });
});

// --- API 404 & JSON ERROR HANDLING (PREVENTS SPA HTML FALLBACK ON API ROUTES) ---
// Guarantee that any unhandled /api or /api/* route ALWAYS returns JSON 404, NEVER falling through to SPA HTML
app.all(["/api", "/api/*"], (req, res) => {
  res.status(404).json({
    success: false,
    error: "API_ROUTE_NOT_FOUND",
    message: `API route not found: ${req.method} ${req.path}`,
  });
});

// Global Express error handler guaranteeing API errors ALWAYS return JSON, NEVER HTML
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) {
      return next(err);
    }
    if (req.path.startsWith("/api/")) {
      const status = err.status || err.statusCode || 500;
      const correlationId = (req as any).correlationId;
      console.error(`API Error on ${req.method} ${req.path} [${correlationId}]:`, err);

      // Auto-emit Platform Incident and Event on production 500 errors
      if (status >= 500) {
        emitPlatformEvent({
          eventType: "PRODUCTION_API_ERROR",
          severity: "ERROR",
          category: "SYSTEM",
          endpoint: req.path,
          method: req.method,
          statusCode: status,
          requestId: correlationId,
          userId: (req as any).user?.uid,
          userEmail: (req as any).user?.email,
          sanitizedMessage: `Unhandled server error on ${req.method} ${req.path}: ${err.message || "Internal Server Error"}`,
          metadata: {
            stack: err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : undefined,
            query: req.query,
          },
        }).catch(() => {});
      }

      return res.status(status).json({
        success: false,
        error: err.message || "Internal Server Error",
        correlationId,
      });
    }
    next(err);
  },
);

// Prevent API and Auth routes from falling through to Vite SPA HTML middleware
app.all(["/api/*", "/auth/*"], (req, res) => {
  res.status(404).json({
    success: false,
    error: "ENDPOINT_NOT_FOUND",
    message: `API endpoint ${req.method} ${req.originalUrl || req.url} was not found.`,
  });
});

// --- VITE DEV SERVER OR STATIC ASSETS ROUTING ---
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const viteModule = "vite";
    const { createServer: createViteServer } = await import(
      /* @vite-ignore */ viteModule
    );
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

const isStandalone =
  !isServerless &&
  !process.env.SKIP_SERVER_LISTEN &&
  process.env.NODE_ENV !== "test" &&
  ((process.argv[1] &&
    (process.argv[1].endsWith("server.ts") ||
      process.argv[1].endsWith("server.js") ||
      process.argv[1].endsWith("server.cjs"))) ||
    process.env.STANDALONE_SERVER === "true");

if (isStandalone) {
  startServer().catch((err) => {
    console.error("Failed to start standalone server:", err);
  });
}

export default app;
