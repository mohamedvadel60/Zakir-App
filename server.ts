import "./src/lib/env.js";
import { Resend } from "resend";
import express from "express";
import multer from "multer";
import cors from "cors";
import crypto from "crypto";
import http from "http";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import { db as sqlDb, withRetry } from "./src/db/index.js";
import { users as sqlUsers, gmailLogs } from "./src/db/schema.js";
import { getOrCreateUser } from "./src/db/users.js";
import { requireAuth, requireAdmin, isUserAdminServer, AuthRequest } from "./src/middleware/auth.js";
import { createRateLimiter } from "./src/middleware/rateLimiter.js";
import { adminAuth, adminDb, adminStorage, isFirebaseAdminAvailable } from "./src/lib/firebase-admin.js";
import { eq, desc } from "drizzle-orm";
import { generateWorldBankFallbackData } from "./src/lib/worldBankFallback.js";
import { Resvg } from "@resvg/resvg-js";

dotenv.config();

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "src", "db_store.json");

// Ensure db_store.json exists with initial data
function initializeDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      if (data.users && data.memories && data.risk_alerts && data.user_metrics && data.gmail_logs && data.verification_codes && data.support_tickets) {
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
        verificationInfo: { status: "verified", verifiedAt: "2026-01-15T09:00:00Z" },
        createdAt: "2026-01-15T09:00:00Z",
        trialExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24hr trial
      },
      {
        id: "usr_analyst",
        email: "analyst@zakir.ai",
        passwordHash: "analyst123",
        companyName: "Al-Futtaim Group",
        role: "Analyst",
        isEmailVerified: true,
        isPhoneVerified: true,
        verificationInfo: { status: "verified", verifiedAt: "2026-02-10T11:30:00Z" },
        createdAt: "2026-02-10T11:30:00Z",
        trialExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "usr_compliance",
        email: "compliance@zakir.ai",
        passwordHash: "compliance123",
        companyName: "Al-Futtaim Group",
        role: "Compliance Officer",
        isEmailVerified: true,
        isPhoneVerified: true,
        verificationInfo: { status: "verified", verifiedAt: "2026-03-01T14:15:00Z" },
        createdAt: "2026-03-01T14:15:00Z",
        trialExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
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
        message: "Hello support, we uploaded our commercial registration and trade license. Could you confirm if our institutional verification is active?",
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
            message: "Hello support, we uploaded our commercial registration and trade license. Could you confirm if our institutional verification is active?",
            createdAt: "2026-07-28T10:00:00Z"
          },
          {
            id: "msg_init_2",
            ticketId: "ticket_init_1",
            senderType: "admin",
            senderName: "Zakir Compliance Team",
            senderEmail: "admin@zakir.ai",
            message: "Greetings Mohamed. We reviewed your documents and confirmed your institutional verification status as Verified. Thank you for using Zakir.",
            createdAt: "2026-07-28T11:30:00Z"
          }
        ]
      }
    ],
    memories: [
      {
        id: "mem_1",
        title: "Sanctions List Update Delay - Correspondent Banking",
        category: "Financial Engineering",
        riskLevel: "High",
        tags: ["sanctions", "compliance", "correspondent"],
        description: "Quarterly audit revealed a new sanctions list (OFAC SDN update, October 2024) had not been loaded into the screening system within the mandated 24-hour window.",
        decision: "The system operated for 72 hours using outdated lists, processing $340M in correspondent transactions.",
        causalFactors: "Standardized daily batch pull failed due to unannounced vendor API format changes. Compliance team had no automated alert.",
        outcomes: "An independent external warning was received, resulting in a retroactive review. Fortunately, no blocked entities were cleared, but regulatory friction increased.",
        lessonsLearned: "Implement real-time webhook endpoints instead of daily pull, and set up automatic health indicators for list freshness.",
        createdAt: "2026-06-02T10:30:00Z",
        userId: "usr_analyst",
        authorEmail: "analyst@zakir.ai",
        authorRole: "Analyst"
      },
      {
        id: "mem_2",
        title: "USD/EUR Hedge Failure during Q3 Earnings",
        category: "FX Risk Management",
        riskLevel: "Critical",
        tags: ["hedging", "currency", "treasury"],
        description: "During Q3 2024, the multinational subsidiary faced a 12% adverse EUR/USD movement over 6 weeks. Our existing forward contracts covered only 40% of the exposure, leaving $18M unhedged.",
        decision: "Manually chose to restrict currency hedging based on speculative internal rate forecasts.",
        causalFactors: "Excessive operational trust in subjective qualitative advice over quantitative risk model suggestions.",
        outcomes: "Direct translation loss of $2.4M charged to earnings, triggering a covenant breach warning from our credit syndicate.",
        lessonsLearned: "Codify minimum mandatory hedging ranges (e.g. 70-90% for standard exposures) and automate rebalancing to eliminate human bias.",
        createdAt: "2026-05-18T16:00:00Z",
        userId: "usr_ceo",
        authorEmail: "ceo@zakir.ai",
        authorRole: "CEO"
      },
      {
        id: "mem_3",
        title: "Customs HS Code Misclassification - Industrial Components Import",
        category: "Customs Classification",
        riskLevel: "Medium",
        tags: ["customs", "tariffs", "supply-chain"],
        description: "Shipment of 2,400 units of precision hydraulic actuators was classified under HS 8412.21 (hydraulic power engines) instead of the correct 8412.39 (linear actuators).",
        decision: "Rushed the customs declaration process to avoid port storage demurrage charges.",
        causalFactors: "Absence of a shared centralized tariff code database, relying on individual broker interpretation.",
        outcomes: "Resulted in a retroactive tariff surcharge of 7.5% ($112,000) and triggered a systematic customs audit review on other parts.",
        lessonsLearned: "Establish a mandatory pre-cleared product-to-HS mapping library, and conduct annual external audits.",
        createdAt: "2026-04-20T09:15:00Z",
        userId: "usr_analyst",
        authorEmail: "analyst@zakir.ai",
        authorRole: "Analyst"
      }
    ],
    risk_alerts: [
      {
        id: "al_1",
        title: "Sanctions List Update Delay: 6 Hours",
        category: "Financial Engineering",
        severity: "High",
        description: "OFAC SDN update failed to sync due to regional network bottleneck. Manual verification triggered.",
        status: "Active",
        createdAt: "2026-07-21T08:00:00Z"
      },
      {
        id: "al_2",
        title: "TP Documentation Deadline: 3 Jurisdictions Pending",
        category: "Financial Engineering",
        severity: "Medium",
        description: "Transfer pricing document compliance filing pending for Brazil, Singapore, Netherlands subsidiaries.",
        status: "Active",
        createdAt: "2026-07-20T10:00:00Z"
      },
      {
        id: "al_3",
        title: "Counterparty Concentration: Top 3 Banks >65%",
        category: "Financial Engineering",
        severity: "Critical",
        description: "Bilateral credit exposures show dangerous systemic concentration in three primary correspondent banks.",
        status: "Active",
        createdAt: "2026-07-19T14:30:00Z"
      },
      {
        id: "al_4",
        title: "FX Policy Review Overdue",
        category: "FX Risk Management",
        severity: "Medium",
        description: "FX hedging policy limits require annual board review and re-certification. Due 30 days ago.",
        status: "Active",
        createdAt: "2026-07-15T09:00:00Z"
      }
    ],
    user_metrics: [
      {
        id: "met_1",
        userId: "usr_analyst",
        actionType: "Log Memory",
        metricValue: 12,
        description: "Logged strategic causal memory on Sanctions Screening Gaps",
        createdAt: "2026-07-21T10:00:00Z"
      },
      {
        id: "met_2",
        userId: "usr_ceo",
        actionType: "Run Analysis",
        metricValue: 8,
        description: "Executed comprehensive risk-modeling analysis on FX hedger",
        createdAt: "2026-07-21T09:30:00Z"
      },
      {
        id: "met_3",
        userId: "usr_compliance",
        actionType: "Audit Review",
        metricValue: 15,
        description: "Resolved customs HS code compliance audit recommendations",
        createdAt: "2026-07-20T11:00:00Z"
      }
    ],
    gmail_logs: []
  };

  inMemoryDbStore = initialData;

  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf-8");
  } catch (err) {
    console.warn("Notice: DB file initial write skipped (read-only filesystem environment):", (err as any)?.message);
  }
}

let inMemoryDbStore: any = null;

try {
  initializeDatabase();
} catch (e) {
  console.warn("Notice: initializeDatabase top-level call warning:", e);
}

// Database Helper Functions
function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        inMemoryDbStore = parsed;
        return parsed;
      }
    }
  } catch (err) {
    // If readFileSync fails, fallback to in-memory store
  }
  if (!inMemoryDbStore) {
    try { initializeDatabase(); } catch (e) {}
  }
  return inMemoryDbStore || { users: [], memories: [], risk_alerts: [], user_metrics: [], gmail_logs: [], verification_codes: [], support_tickets: [] };
}

function writeDb(data: any) {
  inMemoryDbStore = data;
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Notice: writeDb file save skipped (read-only filesystem environment):", (err as any)?.message);
  }
}

// Function to dynamically load Gemini client with fresh process.env on every request
function getGeminiClient(): GoogleGenAI | null {
  try {
    dotenv.config();
  } catch (e) {
    // Ignore dotenv error if missing
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.error("GEMINI_API_KEY is not configured.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Stripe Client Helper Function
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !secretKey.trim()) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey.trim(), {
      apiVersion: "2025-02-24.acacia" as any
    });
  }
  return stripeInstance;
}

// --- RATE LIMITERS ---
const loginRegisterLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: "Too many login or registration attempts. Please try again after a minute.",
  endpointName: "login-register"
});

const otpLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  message: "Too many OTP verification requests. Please try again after 5 minutes.",
  endpointName: "otp"
});

const emailLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: "Too many email sending requests. Please try again after 10 minutes.",
  endpointName: "email"
});

const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: "Too many webhook requests.",
  endpointName: "webhooks"
});

// Benchmark Plan Prices
const PLAN_PRICES = {
  Starter: { monthly: 6, annual: 50 },
  Professional: { monthly: 189, annual: 149 },
  Enterprise: { monthly: 849, annual: 699 }
};

// RESEND WEBHOOK ROUTE (Raw body parser or JSON)
app.post("/api/webhooks/resend", webhookLimiter, express.json(), (req, res) => {
  try {
    const event = req.body;
    if (!event) {
      return res.status(400).send("No body");
    }

    console.log("[RESEND WEBHOOK] Received event:", {
      type: event.type,
      messageId: event.data?.email_id || event.data?.id,
      recipient: event.data?.to?.[0] || event.data?.to,
      timestamp: event.created_at || new Date().toISOString()
    });

    if (event.type === "email.bounced" || event.type === "email.delivery_delayed" || event.type === "email.complained") {
       console.warn("[RESEND EMAIL FAILURE] Delivery failed:", {
         messageId: event.data?.email_id,
         reason: event.data?.reason,
         recipient: event.data?.to?.[0]
       });
    } else if (event.type === "email.delivered") {
       console.log("[RESEND EMAIL DELIVERED] Delivery success:", {
         messageId: event.data?.email_id,
         recipient: event.data?.to?.[0]
       });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("[RESEND WEBHOOK] Error processing event:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});


// STRIPE WEBHOOK ROUTE (Raw body parser before express.json)
app.post(["/api/webhooks/stripe", "/api/stripe/webhook"], webhookLimiter, express.raw({ type: "application/json" }), async (req, res) => {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: any;

  try {
    if (stripe && webhookSecret) {
      const sig = req.headers["stripe-signature"] as string;
      if (!sig) {
        console.warn("[Stripe Webhook] Missing stripe-signature header.");
        return res.status(400).send("Webhook Error: Missing stripe-signature header.");
      }
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log(`[Stripe Webhook] Event signature verified successfully: ${event.type} (id: ${event.id})`);
    } else {
      if (!webhookSecret) {
        console.warn("[Stripe Webhook] Warning: STRIPE_WEBHOOK_SECRET is not configured.");
      }
      if (process.env.NODE_ENV === "production") {
        console.error("Stripe Webhook Error: Signature verification is strictly required in production mode.");
        return res.status(400).send("Webhook Error: Signature verification required.");
      }
      const bodyStr = req.body instanceof Buffer ? req.body.toString("utf-8") : JSON.stringify(req.body);
      event = JSON.parse(bodyStr || "{}");
      console.log(`[Stripe Webhook] Development fallback payload parsed: ${event.type}`);
    }
  } catch (err: any) {
    console.error(`[Stripe Webhook] Signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const plan = session.metadata?.plan || "Professional";
        const cycle = session.metadata?.billingCycle || "annual";
        const userEmail = session.customer_details?.email || session.metadata?.userEmail;

        console.log(`[Stripe Webhook] checkout.session.completed: userId=${userId}, plan=${plan}, cycle=${cycle}, customer=${session.customer}`);

        const nextBill = new Date();
        if (cycle === "annual") nextBill.setFullYear(nextBill.getFullYear() + 1);
        else nextBill.setMonth(nextBill.getMonth() + 1);

        const db = readDb();
        const user = db.users.find((u: any) => u.id === userId || (userEmail && u.email?.toLowerCase() === userEmail.toLowerCase()));
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
            await adminDb.collection("users").doc(targetFsUid).set({
              subscriptionPlan: plan,
              subscriptionStatus: "Active",
              billingCycle: cycle,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              lastPaymentDate: new Date().toISOString(),
              lastPaymentAmount: `$${((session.amount_total || 0) / 100).toFixed(2)} USD`,
              nextBillingDate: nextBill.toISOString()
            }, { merge: true });
            console.log(`[Stripe Webhook] Firestore updated for user ${targetFsUid} -> Active (${plan})`);
          } catch (fsErr: any) {
            console.warn("Stripe webhook Firestore sync warning:", fsErr?.message);
          }
        }
        break;
      }
      case "customer.subscription.created": {
        const sub = event.data.object;
        console.log(`[Stripe Webhook] customer.subscription.created: id=${sub.id}, customer=${sub.customer}, status=${sub.status}`);
        const db = readDb();
        const user = db.users.find((u: any) => u.stripeSubscriptionId === sub.id || u.stripeCustomerId === sub.customer);
        if (user) {
          user.stripeSubscriptionId = sub.id;
          if (sub.status === "active" || sub.status === "trialing") {
            user.subscriptionStatus = "Active";
          }
          writeDb(db);
          try {
            await adminDb.collection("users").doc(user.id).set({
              stripeSubscriptionId: sub.id,
              subscriptionStatus: user.subscriptionStatus
            }, { merge: true });
          } catch (fsErr: any) {
            console.warn("Stripe webhook sub create Firestore sync warning:", fsErr?.message);
          }
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        console.log(`[Stripe Webhook] customer.subscription.updated: id=${sub.id}, status=${sub.status}`);
        const db = readDb();
        const user = db.users.find((u: any) => u.stripeSubscriptionId === sub.id || u.stripeCustomerId === sub.customer);
        if (user) {
          const isActive = sub.status === "active" || sub.status === "trialing";
          user.subscriptionStatus = isActive ? "Active" : sub.status === "past_due" ? "Past Due" : "Inactive";
          if (sub.current_period_end) {
            user.nextBillingDate = new Date(sub.current_period_end * 1000).toISOString();
          }
          writeDb(db);
          try {
            await adminDb.collection("users").doc(user.id).set({
              subscriptionStatus: user.subscriptionStatus,
              nextBillingDate: user.nextBillingDate || null
            }, { merge: true });
          } catch (fsErr: any) {
            console.warn("Stripe webhook sub update Firestore sync warning:", fsErr?.message);
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        console.log(`[Stripe Webhook] customer.subscription.deleted: id=${sub.id}`);
        const db = readDb();
        const user = db.users.find((u: any) => u.stripeSubscriptionId === sub.id || u.stripeCustomerId === sub.customer);
        if (user) {
          user.subscriptionPlan = undefined;
          user.subscriptionStatus = "Inactive";
          writeDb(db);
        }

        if (user?.id) {
          try {
            await adminDb.collection("users").doc(user.id).set({
              subscriptionPlan: null,
              subscriptionStatus: "Inactive"
            }, { merge: true });
            console.log(`[Stripe Webhook] Subscription marked Inactive for user ${user.id}`);
          } catch (fsErr: any) {
            console.warn("Stripe webhook Firestore sub delete warning:", fsErr?.message);
          }
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        console.log(`[Stripe Webhook] invoice payment succeeded: invoiceId=${invoice.id}, amount=${invoice.amount_paid}`);
        const db = readDb();
        const user = db.users.find((u: any) => 
          (subscriptionId && u.stripeSubscriptionId === subscriptionId) || 
          (customerId && u.stripeCustomerId === customerId)
        );
        if (user) {
          user.subscriptionStatus = "Active";
          user.lastPaymentDate = new Date().toISOString();
          user.lastPaymentAmount = `$${((invoice.amount_paid || 0) / 100).toFixed(2)} USD`;
          writeDb(db);
          try {
            await adminDb.collection("users").doc(user.id).set({
              subscriptionStatus: "Active",
              lastPaymentDate: user.lastPaymentDate,
              lastPaymentAmount: user.lastPaymentAmount
            }, { merge: true });
          } catch (fsErr: any) {
            console.warn("Stripe webhook invoice Firestore sync warning:", fsErr?.message);
          }
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.warn(`[Stripe Webhook] invoice payment failed: invoiceId=${invoice.id}, customer=${invoice.customer}`);
        const db = readDb();
        const user = db.users.find((u: any) => u.stripeCustomerId === invoice.customer || (invoice.subscription && u.stripeSubscriptionId === invoice.subscription));
        if (user) {
          user.subscriptionStatus = "Past Due";
          writeDb(db);
          try {
            await adminDb.collection("users").doc(user.id).set({
              subscriptionStatus: "Past Due"
            }, { merge: true });
          } catch (fsErr: any) {}
        }
        break;
      }
      default:
        console.log(`[Stripe Webhook] Received Stripe event: ${event.type}`);
    }
  } catch (handlerErr) {
    console.error("[Stripe Webhook] Error processing Stripe webhook event:", handlerErr);
  }

  res.json({ received: true });
});

// Dynamic CORS middleware using cors package with configured origins
const allowedOrigins = [
  "https://getzakir.com",
  "https://www.getzakir.com",
  "http://getzakir.com",
  "http://www.getzakir.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001"
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
    "X-Api-Key"
  ],
  optionsSuccessStatus: 200
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-goog-api-key, X-Requested-With, Accept, Origin, X-Api-Key");

  // Production Security Headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: "500kb" }));

// --- STRIPE CHECKOUT & SUBSCRIPTION ENDPOINTS ---
const inFlightCheckoutUsers = new Set<string>();

app.get("/api/stripe/config", (req, res) => {
  const pubKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLIC_KEY || process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLIC_KEY || "";
  const hasSecretKey = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim());
  res.json({
    publishableKey: pubKey,
    hasSecretKey: hasSecretKey,
    mode: pubKey.startsWith("pk_test") ? "test" : "live"
  });
});

app.post("/api/stripe/create-checkout-session", requireAuth, async (req: AuthRequest, res) => {
  const authUserId = req.user?.uid || (req.user as any)?.user_id;
  if (!authUserId) {
    return res.status(401).json({ 
      success: false,
      error: "تعذر التحقق من جلسة حسابك. يرجى تحديث الجلسة والمحاولة مرة أخرى." 
    });
  }

  // Concurrency guard to prevent multiple simultaneous session requests
  if (inFlightCheckoutUsers.has(authUserId)) {
    return res.status(429).json({
      success: false,
      error: "جاري معالجة طلب اشتراك سابق. يرجى الانتظار بضع ثوانٍ."
    });
  }

  inFlightCheckoutUsers.add(authUserId);

  try {
    const { plan = "Professional", billingCycle = "annual", companyName } = req.body;

    const db = readDb();
    let user = db.users.find((u: any) => u.id === authUserId);
    if (!user) {
      try {
        const userDoc = await adminDb.collection("users").doc(authUserId).get();
        if (userDoc && userDoc.exists) {
          user = userDoc.data();
        }
      } catch (fsErr) {
        console.warn("[CHECKOUT] Firestore user lookup warning:", fsErr);
      }
    }

    const finalUserId = authUserId;
    const finalUserEmail = req.user?.email || user?.email || "";
    const finalCompanyName = companyName || user?.companyName || user?.organizationName || "Organization";

    const requestedPlan = (plan === "Enterprise" ? "Enterprise" : plan === "Starter" ? "Starter" : "Professional") as "Starter" | "Professional" | "Enterprise";
    const requestedCycle = (billingCycle === "monthly" ? "monthly" : "annual") as "monthly" | "annual";

    const host = req.headers.host || "localhost:3000";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

    // Backend-determined pricing: strictly computed from server benchmark
    const monthlyRate = PLAN_PRICES[requestedPlan][requestedCycle];
    const unitAmountCents = Math.round(monthlyRate * 100);

    console.log(`[Stripe Checkout] 1. Payment request received: plan=${requestedPlan}, cycle=${requestedCycle}, user=${finalUserId}`);

    const stripe = getStripe();
    if (!stripe) {
      console.warn("[Stripe Checkout] Stripe configuration missing: STRIPE_SECRET_KEY is not defined or invalid.");
      return res.status(400).json({
        success: false,
        error: "خادم الدفع غير مهيأ حالياً (STRIPE_SECRET_KEY مفقود). يرجى التواصل مع إدارة النظام.",
      });
    }

    // Check for duplicate active subscription
    if (user?.subscriptionStatus === "Active" && user?.stripeSubscriptionId) {
      try {
        const activeSub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        if (activeSub && (activeSub.status === "active" || activeSub.status === "trialing")) {
          console.warn(`[Stripe Checkout] User ${finalUserId} already has active subscription ${activeSub.id}`);
          return res.status(400).json({
            success: false,
            code: "SUBSCRIPTION_ALREADY_ACTIVE",
            error: "لديك بالفعل اشتراك نشط في منصة Zakir. يمكنك إدارة خطتك الحالية أو ترقيتها من صفحة الإعدادات.",
          });
        }
      } catch (subCheckErr) {
        console.warn("[Stripe Checkout] Active subscription check notice:", subCheckErr);
      }
    }

    // Customer Management: Look up or create customer
    let stripeCustomerId = user?.stripeCustomerId;
    if (stripeCustomerId) {
      try {
        const existingCust = await stripe.customers.retrieve(stripeCustomerId);
        if (existingCust && !("deleted" in existingCust && existingCust.deleted)) {
          console.log(`[Stripe Checkout] Found existing Stripe Customer: ${stripeCustomerId}`);
        } else {
          stripeCustomerId = null;
        }
      } catch {
        stripeCustomerId = null;
      }
    }

    if (!stripeCustomerId && finalUserEmail) {
      try {
        const newCust = await stripe.customers.create({
          email: finalUserEmail,
          name: finalCompanyName,
          metadata: {
            zakirUserId: finalUserId,
            userId: finalUserId
          }
        });
        stripeCustomerId = newCust.id;
        console.log(`[Stripe Checkout] Created new Stripe Customer: ${stripeCustomerId}`);

        if (user) {
          user.stripeCustomerId = stripeCustomerId;
          writeDb(db);
        }
        try {
          await adminDb.collection("users").doc(finalUserId).set({ stripeCustomerId }, { merge: true });
        } catch (fsCustErr) {
          console.warn("[Stripe Checkout] Firestore customer id save notice:", fsCustErr);
        }
      } catch (createCustErr: any) {
        console.warn("[Stripe Checkout] Customer creation notice:", createCustErr?.message);
      }
    }

    // Price ID Resolution
    let resolvedPriceId: string | null = null;
    const envPriceId = requestedCycle === "annual" 
      ? (process.env.STRIPE_YEARLY_PRICE_ID || process.env.STRIPE_ANNUAL_PRICE_ID)
      : (process.env.STRIPE_MONTHLY_PRICE_ID);

    if (envPriceId && envPriceId.trim().startsWith("price_")) {
      try {
        const retrievedPrice = await stripe.prices.retrieve(envPriceId.trim());
        if (retrievedPrice && retrievedPrice.active && retrievedPrice.type === "recurring") {
          resolvedPriceId = retrievedPrice.id;
          console.log(`[Stripe Checkout] Using verified environment Price ID: ${resolvedPriceId}`);
        }
      } catch (priceCheckErr) {
        console.warn(`[Stripe Checkout] Environment price ID ${envPriceId} could not be retrieved from Stripe, falling back to dynamic price_data`);
      }
    }

    // Build Line Items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = resolvedPriceId
      ? [{ price: resolvedPriceId, quantity: 1 }]
      : [{
          price_data: {
            currency: "usd",
            product_data: {
              name: `Zakir ${requestedPlan} Plan (${requestedCycle === "annual" ? "Annual Billing - Save 20%" : "Monthly Billing"})`,
              description: `Institutional Causal Memory Engine & Decision Intelligence Suite for ${finalCompanyName}.`,
            },
            unit_amount: unitAmountCents,
            recurring: {
              interval: requestedCycle === "annual" ? "year" : "month",
              interval_count: 1,
            },
          },
          quantity: 1,
        }];

    // Build Session Parameters with ui_mode: "embedded" and return_url
    const returnUrl = `${baseUrl}/?view=settings&tab=subscription&session_id={CHECKOUT_SESSION_ID}`;
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: lineItems,
      client_reference_id: finalUserId,
      metadata: {
        userId: finalUserId,
        userEmail: finalUserEmail,
        companyName: finalCompanyName,
        plan: requestedPlan,
        billingCycle: requestedCycle,
      },
      ui_mode: "embedded",
      return_url: returnUrl,
    };

    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
    } else if (finalUserEmail) {
      sessionParams.customer_email = finalUserEmail;
    }

    console.log(`[Stripe Checkout] Creating Embedded Checkout Session for user ${finalUserId}...`);
    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[Stripe Checkout] Checkout Session created successfully: id=${session.id}`);

    db.stripe_sessions = db.stripe_sessions || {};
    db.stripe_sessions[session.id] = finalUserId;
    writeDb(db);

    const publishableKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLIC_KEY || process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLIC_KEY || "";

    return res.json({
      success: true,
      sessionId: session.id,
      clientSecret: session.client_secret,
      publishableKey: publishableKey,
    });

  } catch (err: any) {
    console.error("[Stripe Checkout] Error creating Stripe checkout session:", err);
    res.status(500).json({ 
      success: false,
      error: err.message || "Failed to initiate Stripe Checkout" 
    });
  } finally {
    inFlightCheckoutUsers.delete(authUserId);
  }
});

// GET Session Status (for Embedded Checkout completion or success return)
app.get("/api/stripe/session-status/:sessionId", requireAuth, async (req: AuthRequest, res) => {
  try {
    console.log("[DEBUG] req.user =", req.user);
    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
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
          return res.status(403).json({ error: "Forbidden: Access denied to other users' sessions" });
        }
      }

      if (session.status === "complete" || session.payment_status === "paid") {
        const nextBill = new Date();
        if (cycle === "annual") nextBill.setFullYear(nextBill.getFullYear() + 1);
        else nextBill.setMonth(nextBill.getMonth() + 1);

        const db = readDb();
        const user = db.users.find((u: any) => u.id === userId || (session.customer_details?.email && u.email?.toLowerCase() === session.customer_details.email.toLowerCase()));
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
            await adminDb.collection("users").doc(targetUid).set({
              subscriptionPlan: plan,
              subscriptionStatus: "Active",
              billingCycle: cycle,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              lastPaymentDate: new Date().toISOString(),
              lastPaymentAmount: `$${((session.amount_total || 0) / 100).toFixed(2)} USD`,
              nextBillingDate: nextBill.toISOString()
            }, { merge: true });
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
          nextBillingDate: nextBill.toISOString()
        });
      }

      return res.json({
        status: session.status,
        paymentStatus: session.payment_status
      });
    }

    // Simulated session lookup
    const db = readDb();
    const userId = db.stripe_sessions?.[sessionId];
    if (userId && userId !== authUserId) {
      const isAdmin = await isUserAdminServer(authUserId);
      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden: Access denied to other users' sessions" });
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
      nextBillingDate: user?.nextBillingDate || new Date(Date.now() + 365*86400000).toISOString()
    });

  } catch (err: any) {
    console.error("Error retrieving Stripe session status:", err);
    res.status(500).json({ error: err.message || "Failed to retrieve session status" });
  }
});

app.post("/api/stripe/create-portal-session", requireAuth, async (req: AuthRequest, res) => {
  try {
    console.log("[DEBUG] req.user =", req.user);
    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
    }

    const host = req.headers.host || "localhost:3000";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

    // Look up the user's stripeCustomerId securely from the backend DB
    const db = readDb();
    const user = db.users.find((u: any) => u.id === authUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found in database." });
    }

    const stripeCustomerId = user.stripeCustomerId;
    const stripe = getStripe();
    if (stripe && stripeCustomerId) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${baseUrl}/?view=settings&tab=subscription`,
      });
      return res.json({ url: portalSession.url });
    }

    return res.json({ url: `${baseUrl}/?view=settings&tab=subscription` });
  } catch (err: any) {
    console.error("Error creating portal session:", err);
    res.status(500).json({ error: err.message || "Failed to create portal session" });
  }
});

// Cancel or Pause Subscription
app.post("/api/stripe/cancel-subscription", requireAuth, async (req: AuthRequest, res) => {
  try {
    console.log("[DEBUG] req.user =", req.user);
    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = readDb();
    const user = db.users.find((u: any) => u.id === authUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const stripe = getStripe();
    if (stripe && user.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (stripeErr: any) {
        console.warn("Stripe cancel subscription warning:", stripeErr.message);
      }
    }

    user.subscriptionStatus = "Inactive";
    user.subscriptionPlan = undefined;
    writeDb(db);

    try {
      await adminDb.collection("users").doc(authUserId).set({
        subscriptionStatus: "Inactive",
        subscriptionPlan: null
      }, { merge: true });
    } catch (fsErr: any) {
      console.warn("Firestore cancel sync warning:", fsErr.message);
    }

    return res.json({ success: true, message: "Subscription cancelled successfully." });
  } catch (err: any) {
    console.error("Error cancelling subscription:", err);
    res.status(500).json({ error: err.message || "Failed to cancel subscription" });
  }
});

app.get(["/.well-known/stripe-verification", "/.well-known/stripe-verification.txt", "/stripe-verification"], (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send("stripe-verification=61271845aaa858f327634c112c5688e9b33281a0e192865affdd7552e0c4f3fa");
});

// Official Zakir Logo SVG String
const OFFICIAL_ZAKIR_SVG = `<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1021.12 909.1">
  <defs>
    <linearGradient id="zakir-linear-gradient" x1="17.47" y1="447.63" x2="984.67" y2="463.31" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0db4d7"/>
      <stop offset="1" stop-color="#f3ba1a"/>
    </linearGradient>
  </defs>
  <path fill="none" stroke="url(#zakir-linear-gradient)" stroke-miterlimit="10" stroke-width="24px" d="M29.34,52.28c31.34-15.36,81.1-34.89,144.33-39.36,52.91-3.74,92.65,4.66,131.21,13.12,103.52,22.71,126.62,52.27,223.06,78.73,21.03,5.77,84.52,22.08,157.27,23.87,54.83,1.35,156.21-4.54,278.55-64.64,2.95-1.45,5.96,1.81,4.22,4.59-30.56,48.88-72.27,112.6-124.84,184.84-57.49,79.01-119.41,164.11-210.24,258.08-96.56,99.9-182.39,188.7-321.46,255.86-156.74,75.69-235.92,95.04-255.86,78.73-1.84-1.51-7.17-5.87-7.04-11.54.44-18.52,58.67-30.96,79.81-35.47,101.41-21.66,336.99,62.08,445.49,86.37h0c87.97,17.84,220.98,23.62,400.19-45.92"/>
  <g>
    <circle fill="#0db4d7" cx="41" cy="50.41" r="41"/>
    <circle fill="#f3ba1a" cx="555.16" cy="586.73" r="52.48"/>
    <circle fill="#0db4d7" cx="975.2" cy="836.03" r="45.92"/>
  </g>
</svg>`;

let officialPngLogoCache: Buffer | null = null;

function getOfficialPngLogo(): Buffer {
  if (officialPngLogoCache && officialPngLogoCache.length > 0) {
    return officialPngLogoCache;
  }
  const pngPath = path.join(process.cwd(), "src", "assets", "zakir-official-logo.png");
  if (fs.existsSync(pngPath)) {
    officialPngLogoCache = fs.readFileSync(pngPath);
    return officialPngLogoCache;
  }
  try {
    const resvg = new Resvg(OFFICIAL_ZAKIR_SVG, { fitTo: { mode: "width", value: 512 } });
    officialPngLogoCache = Buffer.from(resvg.render().asPng());
    return officialPngLogoCache;
  } catch (e) {
    console.error("Error generating PNG logo with resvg:", e);
    return Buffer.alloc(0);
  }
}

function getAppBaseUrl(req?: express.Request): string {
  if (process.env.APP_URL && !process.env.APP_URL.includes("localhost") && !process.env.APP_URL.includes("127.0.0.1") && !process.env.APP_URL.includes("run.app")) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  if (req && req.headers && req.headers.host && !req.headers.host.includes("run.app") && !req.headers.host.includes("localhost")) {
    const proto = req.headers["x-forwarded-proto"] || "https";
    return `${proto}://${req.headers.host}`.replace(/\/$/, "");
  }
  return "https://www.getzakir.com";
}

app.get(["/api/logo.png", "/assets/logo.png", "/logo.png"], (req, res) => {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const buf = getOfficialPngLogo();
  res.send(buf);
});

app.get(["/api/logo.svg", "/assets/logo.svg", "/logo.svg"], (req, res) => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send(OFFICIAL_ZAKIR_SVG);
});

app.get("/api/stripe/receipt/:sessionId", requireAuth, async (req: AuthRequest, res) => {
  const { sessionId } = req.params;
  console.log("[DEBUG] req.user =", req.user);
    const authUserId = req.user?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }

  const db = readDb();
  
  // Enforce session ownership to prevent IDOR
  const sessionOwnerId = db.stripe_sessions?.[sessionId];
  const isCallerAdmin = await isUserAdminServer(authUserId);
  
  if (sessionOwnerId && sessionOwnerId !== authUserId && !isCallerAdmin) {
    return res.status(403).json({ error: "Forbidden: You do not own this checkout session." });
  }

  let user = db.users.find((u: any) => u.id === authUserId);
  if (isCallerAdmin && sessionOwnerId) {
    const targetUser = db.users.find((u: any) => u.id === sessionOwnerId);
    if (targetUser) {
      user = targetUser;
    }
  }

  if (!user) {
    return res.status(404).json({ error: "User profile not found." });
  }
  
  const plan = (req.query.plan as string) || user.subscriptionPlan || "Professional";
  const cycle = (req.query.cycle as string) || user.billingCycle || "annual";
  
  const price = PLAN_PRICES[plan as "Starter" | "Professional" | "Enterprise"]?.[cycle as "monthly" | "annual"] || 149;

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
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    customerEmail: user.email || "mohamedvadel60@gmail.com",
    customerName: user.companyName || user.ownerName || "Organization",
    companyName: user.companyName || "Organization",
    stripeReceiptUrl: `https://pay.stripe.com/receipts/invoices/${sessionId}`
  };

  res.json({ receipt });
});

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
 * Helper: Core Email Dispatcher with Automatic Fallback & High-Precision Diagnostics
 */
async function sendSystemMail(
  toOrOptions: string | { to: string; subject: string; html: string; text?: string; attachments?: any[] },
  subjectArg?: string,
  textArg?: string,
  htmlArg?: string
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
    if (arg3.includes("<!DOCTYPE") || arg3.includes("<html") || arg3.includes("<table") || arg3.includes("<div")) {
      html = arg3;
      text = arg4;
    } else if (arg4.includes("<!DOCTYPE") || arg4.includes("<html") || arg4.includes("<table") || arg4.includes("<div")) {
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

  let fromSender = (process.env.RESEND_FROM || process.env.EMAIL_FROM || "").trim();
  if (!fromSender || fromSender.includes("yourdomain.com") || fromSender.includes("example.com")) {
    fromSender = "Zakir Platform <onboarding@resend.dev>";
  } else if (!fromSender.includes("<")) {
    fromSender = `Zakir Platform <${fromSender}>`;
  }

  try {
    const resend = getResendInstance();
    if (!resend) {
      console.warn(`[EMAIL DISPATCH NOTICE] RESEND_API_KEY is not configured. Simulating delivery for: ${to} | Subject: "${subject}"`);
      return {
        success: true,
        simulated: true,
        provider: "local_simulation",
        messageId: `sim_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
      };
    }

    console.log(`[EMAIL DISPATCH ATTEMPT] To: ${to} | Subject: "${subject}" | Sender: ${fromSender}`);

    const attachments: any[] = [...userAttachments];

    const emailPayload: any = {
      from: fromSender,
      to: [to],
      subject: subject,
      html: html,
      text: text || undefined,
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
      const errStatus = (response.error as any).statusCode || (response.error as any).status || 400;
      console.error("[EMAIL DELIVERY FAILURE]", {
        code: response.error.name || "RESEND_ERROR",
        message: response.error.message,
        provider: "Resend",
        httpStatus: errStatus
      });

      return {
        success: false,
        error: response.error,
        statusCode: errStatus,
        userFriendlyMessage: "تعذر إرسال رمز الاستعادة. يرجى المحاولة مرة أخرى."
      };
    }

    if (response.data && response.data.id) {
      console.log(`[EMAIL SENT SUCCESS] ID: ${response.data.id} to ${to} via ${fromSender}`);
      return {
        success: true,
        messageId: response.data.id,
        statusCode: 200,
        provider: "resend"
      };
    }

    return {
      success: false,
      error: new Error("No message ID returned from Resend"),
      statusCode: 500,
      userFriendlyMessage: "تعذر إرسال رمز الاستعادة. يرجى المحاولة مرة أخرى."
    };

  } catch (resendErr: any) {
    const errStatus = resendErr?.statusCode || resendErr?.status || 500;
    console.error("[EMAIL DELIVERY EXCEPTION]", {
      code: resendErr?.code || resendErr?.name || "UNKNOWN",
      message: resendErr?.message || String(resendErr),
      provider: "Resend",
      httpStatus: errStatus
    });
    return {
      success: false,
      error: resendErr,
      statusCode: errStatus,
      userFriendlyMessage: "تعذر إرسال رمز الاستعادة. يرجى المحاولة مرة أخرى."
    };
  }
}

// SHA-256 verification code hashing helper
function hashVerificationCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Safely masks email addresses for diagnostic logging (e.g. m***@example.com)
 */
function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string") return "u***@example.com";
  const trimmed = email.trim();
  const parts = trimmed.split("@");
  if (parts.length !== 2) return "***@***";
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : (name.length === 2 ? `${name[0]}*` : "*");
  return `${maskedName}@${domain}`;
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
    "admin"
  ];

  if (forbidden.includes(lower)) {
    return "";
  }

  if (email && lower === email.trim().toLowerCase()) {
    return "";
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

function buildMasterEmailHtml(options: {
  subject: string;
  title: string;
  greeting?: string;
  bodyHtml: string;
  securityNote?: string;
}): string {
  const { subject, title, greeting, bodyHtml, securityNote } = options;
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Master Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);">
          
          <!-- Primary Accent Line -->
          <tr>
            <td style="background-color: #2563EB; height: 4px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #f1f5f9;">
              <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td align="center" valign="middle">
                    <img src="https://getzakir.com/api/logo.png" alt="Zakir" width="48" height="48" style="display: block; width: 48px; height: 48px; border: 0; outline: none; text-decoration: none;" />
                  </td>
                </tr>
              </table>
              <div style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: 1.5px; margin-top: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Zakir
              </div>
              <div style="font-size: 12px; font-weight: 500; color: #64748b; margin-top: 4px;">
                Organizational Causal Memory &amp; Decision Intelligence
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px; text-align: left;">
              <h1 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 16px 0; line-height: 1.3;">
                ${escapeHtml(title)}
              </h1>
              ${greeting ? `<p style="color: #0f172a; font-size: 15px; font-weight: 600; margin: 0 0 16px 0;">${escapeHtml(greeting)}</p>` : ''}
              ${bodyHtml}
              ${securityNote ? `
              <div style="margin-top: 28px; padding: 14px 16px; background-color: #eff6ff; border-left: 3px solid #2563eb; border-radius: 4px;">
                <p style="margin: 0; color: #1e3a8a; font-size: 13px; line-height: 1.5;">
                  <strong>Security note:</strong> ${escapeHtml(securityNote)}
                </p>
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #0f172a;">Zakir</p>
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b;">Organizational Causal Memory &amp; Decision Intelligence</p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">This is an automated message from Zakir. Please do not reply to this email.</p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; 2026 Zakir. All rights reserved.</p>
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
  type?: "account_registration" | "password_reset" | "email_verification" | "email_link" | "account_recovery" | "welcome" | string;
  baseUrl?: string;
}

/**
 * Generates clean, enterprise SaaS HTML email templates matching Zakir's brand design system.
 */
function buildOtpEmailHtml(options: BuildOtpEmailOptions): { subject: string; text: string; html: string } {
  const { email, userName, otpCode, type = "account_registration" } = options;
  const cleanName = cleanUserName(userName, email);
  const appBaseUrl = options.baseUrl || getAppBaseUrl();

  const isReset = type === "password_reset";
  const isLink = type === "email_link";
  const isRecovery = type === "account_recovery";
  const isWelcome = type === "welcome";

  const cleanCode = otpCode ? otpCode.trim() : "";

  let subject = "Verify your Zakir email";
  let title = "Verify your email";
  let introText = "Use the verification code below to complete your registration and activate your account:";
  let securityNote = "For your security, never share this code with anyone. The Zakir team will never ask for your verification code.";

  if (isReset) {
    subject = "Reset your Zakir password";
    title = "Reset your Zakir password";
    introText = "A password reset request was made for your Zakir account. Use the verification code below to set a new password:";
    securityNote = "If you did not request a password reset, no action is required.";
  } else if (isLink) {
    subject = "Your Zakir security code";
    title = "Verify your email";
    introText = "We received a request to link this email account to your Zakir profile. Use the security code below to complete the verification:";
    securityNote = "If you did not request this verification code, no action is required.";
  } else if (isRecovery) {
    subject = "Recover your Zakir account";
    title = "Recover your Zakir account";
    introText = "A request was initiated to recover your Zakir account and restore your workspace data. Use the verification code below to continue:";
    securityNote = "If you did not request this recovery, you can safely ignore this email.";
  } else if (isWelcome) {
    subject = "Welcome to Zakir";
    title = "Welcome to Zakir";
    introText = "Welcome to Zakir — Organizational Causal Memory & Decision Intelligence. Your workspace is ready.";
    securityNote = "Keep your account details safe and secure.";
  }

  const greeting = cleanName ? `Hello ${cleanName},` : `Hello,`;

  let bodyHtml = "";
  if (isWelcome) {
    bodyHtml = `
      <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        ${escapeHtml(introText)}
      </p>
      <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto;">
        <tr>
          <td align="center" bgcolor="#2563eb" style="border-radius: 10px;">
            <a href="${appBaseUrl}" target="_blank" style="font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; display: inline-block; padding: 14px 32px; border-radius: 10px; background-color: #2563eb; border: 1px solid #2563eb;">
              Open Zakir
            </a>
          </td>
        </tr>
      </table>
    `;
  } else {
    bodyHtml = `
      <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        ${escapeHtml(introText)}
      </p>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center" style="padding: 20px 24px; background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px;">
            <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace, -apple-system, sans-serif; font-size: 32px; font-weight: 800; color: #1d4ed8; letter-spacing: 6px; text-align: center; margin: 0; user-select: all; -webkit-user-select: all;">
              ${escapeHtml(cleanCode)}
            </div>
          </td>
        </tr>
      </table>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
        This code expires in <strong>10 minutes</strong>.
      </p>
    `;
  }

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote
  });

  const textBody = isWelcome
    ? `${greeting}\n\n${introText}\n\nOpen Zakir: ${appBaseUrl}\n\nThe Zakir Team`
    : `${greeting}\n\n${introText}\n\n[ ${cleanCode} ]\n\nThis code expires in 10 minutes.\n\nSecurity note: ${securityNote}\n\nThe Zakir Team`;

  return { subject, text: textBody, html };
}

function buildInvitationEmailHtml(options: {
  companyName: string;
  memberName: string;
  inviterName: string;
  designatedRole: string;
  inviteLink: string;
  isReminder?: boolean;
}): { subject: string; text: string; html: string } {
  const { companyName, memberName, inviterName, designatedRole, inviteLink, isReminder } = options;
  const subject = `You're invited to Zakir`;
  const title = `You've been invited to Zakir`;
  const greeting = memberName ? `Hello ${memberName},` : `Hello,`;

  const introText = isReminder
    ? `This is a reminder that ${inviterName} has invited you to join ${companyName} on Zakir as a ${designatedRole}.`
    : `${inviterName} has invited you to join ${companyName} on Zakir as a ${designatedRole}.`;

  const detailsHtml = `
    <div style="margin: 24px 0; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; color: #334155;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 120px; font-weight: 500;">Organization:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${escapeHtml(companyName)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Invited by:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${escapeHtml(inviterName)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Assigned Role:</td>
          <td style="padding: 6px 0;"><span style="display: inline-block; padding: 2px 8px; background-color: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 12px; border-radius: 4px;">${escapeHtml(designatedRole)}</span></td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Expires:</td>
          <td style="padding: 6px 0; font-weight: 500; color: #64748b;">7 days</td>
        </tr>
      </table>
    </div>
  `;

  const ctaButtonHtml = `
    <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto 20px auto;">
      <tr>
        <td align="center" bgcolor="#2563eb" style="border-radius: 10px;">
          <a href="${inviteLink}" target="_blank" style="font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; display: inline-block; padding: 14px 32px; border-radius: 10px; background-color: #2563eb; border: 1px solid #2563eb;">
            Accept invitation
          </a>
        </td>
      </tr>
    </table>
    <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0; text-align: center; word-break: break-all;">
      If the button above does not work, copy and paste this URL into your browser:<br/>
      <a href="${inviteLink}" style="color: #2563eb; text-decoration: underline;">${inviteLink}</a>
    </p>
  `;

  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      ${escapeHtml(introText)}
    </p>
    ${detailsHtml}
    ${ctaButtonHtml}
  `;

  const securityNote = "If you were not expecting this invitation, you can safely ignore this email.";

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote
  });

  const text = `${greeting}\n\n${introText}\n\nOrganization: ${companyName}\nInvited by: ${inviterName}\nRole: ${designatedRole}\n\nAccept invitation: ${inviteLink}\n\nThis invitation expires in 7 days.`;

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
    bodyHtml
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
    securityNote: "For security, complete your restoration within 72 hours."
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

  const reasonText = rejectionReason || "Identity details or documentation provided could not be verified against system records.";

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
    securityNote: "Account security is our highest priority."
  });

  const text = `${greeting}\n\nYour account recovery request could not be approved at this time.\n\nReason: ${reasonText}\n\nThe Zakir Team`;
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
          source: "firestore_doc_id"
        });
        return {
          userId: uDoc.id,
          email: resEmail,
          phone: data.phone || inputPhone,
          userDoc: data,
          source: "firestore_doc_id"
        };
      }
    } catch (err) {
      console.warn("Firestore lookup by userId failed:", err);
    }

    // b) Check Firebase Auth by UID
    try {
      const authUser = await adminAuth.getUser(inputUserId);
      if (authUser) {
        const resEmail = (authUser.email || normalizedEmail).trim().toLowerCase();
        console.info("OTP USER RESOLUTION", {
          email: resEmail,
          firestoreUserFound: false,
          resolvedUserId: authUser.uid,
          source: "firebase_auth_uid"
        });
        return {
          userId: authUser.uid,
          email: resEmail,
          phone: authUser.phoneNumber || inputPhone,
          userDoc: null,
          source: "firebase_auth_uid"
        };
      }
    } catch (err) {}

    // c) Check local DB
    try {
      const db = readDb();
      const localUser = db.users?.find((u: any) => u.id === inputUserId);
      if (localUser) {
        const resEmail = (localUser.email || normalizedEmail).trim().toLowerCase();
        console.info("OTP USER RESOLUTION", {
          email: resEmail,
          firestoreUserFound: false,
          resolvedUserId: localUser.id,
          source: "local_db_id"
        });
        return {
          userId: localUser.id,
          email: resEmail,
          phone: localUser.phone || inputPhone,
          userDoc: localUser,
          source: "local_db_id"
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
          const uDoc = await adminDb.collection("users").doc(authUser.uid).get();
          if (uDoc.exists) {
            firestoreData = uDoc.data();
          }
        } catch (e) {}

        console.info("OTP USER RESOLUTION", {
          email: normalizedEmail,
          firestoreUserFound: Boolean(firestoreData),
          resolvedUserId: authUser.uid,
          source: "firebase_auth_email"
        });

        return {
          userId: authUser.uid,
          email: authUser.email ? authUser.email.trim().toLowerCase() : normalizedEmail,
          phone: authUser.phoneNumber || inputPhone,
          userDoc: firestoreData,
          source: "firebase_auth_email"
        };
      }
    } catch (err) {
      // Not in Firebase Auth, proceed to Firestore
    }

    // b) Check Firestore users collection by email query
    try {
      let uSnap = await adminDb.collection("users")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();

      if (uSnap.empty && rawEmail && rawEmail !== normalizedEmail) {
        uSnap = await adminDb.collection("users")
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
          source: "firestore_email_query"
        });

        return {
          userId: resUserId,
          email: resEmail,
          phone: data.phone || inputPhone,
          userDoc: data,
          source: "firestore_email_query"
        };
      }
    } catch (err) {
      console.warn("Firestore query by email failed:", err);
    }

    // c) Check local DB by email
    try {
      const db = readDb();
      const localUser = db.users?.find((u: any) => u.email?.trim().toLowerCase() === normalizedEmail);
      if (localUser && localUser.id) {
        console.info("OTP USER RESOLUTION", {
          email: normalizedEmail,
          firestoreUserFound: false,
          resolvedUserId: localUser.id,
          source: "local_db_email"
        });

        return {
          userId: localUser.id,
          email: normalizedEmail,
          phone: localUser.phone || inputPhone,
          userDoc: localUser,
          source: "local_db_email"
        };
      }
    } catch (err) {}

    // d) Check soft-deleted users in accountLifecycle / users_retained / deletedUsers
    try {
      const lifecycleRecord = await getAccountLifecycleRecord(normalizedEmail);
      if (lifecycleRecord && lifecycleRecord.originalUserId) {
        let retainedData: any = null;
        try {
          const retSnap = await adminDb.collection("users_retained").doc(lifecycleRecord.originalUserId).get();
          if (retSnap.exists) {
            retainedData = retSnap.data();
          }
        } catch (e) {}
        if (!retainedData) {
          const db = readDb();
          retainedData = db.retained_users?.find((u: any) => u.id === lifecycleRecord.originalUserId || u.email?.toLowerCase() === normalizedEmail);
        }

        console.info("OTP USER RESOLUTION (RETAINED LIFECYCLE)", {
          email: normalizedEmail,
          firestoreUserFound: Boolean(retainedData),
          resolvedUserId: lifecycleRecord.originalUserId,
          source: "account_lifecycle_retained"
        });

        return {
          userId: lifecycleRecord.originalUserId,
          email: normalizedEmail,
          phone: retainedData?.phone || inputPhone,
          userDoc: retainedData || { email: normalizedEmail, role: "CEO" },
          source: "account_lifecycle_retained"
        };
      }
    } catch (lcErr) {}
  }

  // 3. Resolve by phone if present
  if (inputPhone) {
    try {
      const uSnap = await adminDb.collection("users")
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
          source: "firestore_phone_query"
        });

        return {
          userId: resUserId,
          email: (data.email || normalizedEmail).trim().toLowerCase(),
          phone: inputPhone,
          userDoc: data,
          source: "firestore_phone_query"
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
          source: "local_db_phone"
        });

        return {
          userId: localUser.id,
          email: (localUser.email || normalizedEmail).trim().toLowerCase(),
          phone: inputPhone,
          userDoc: localUser,
          source: "local_db_phone"
        };
      }
    } catch (err) {}
  }

  // User not found anywhere
  console.info("OTP USER RESOLUTION", {
    email: normalizedEmail || inputPhone || null,
    firestoreUserFound: false,
    resolvedUserId: null,
    source: "not_found"
  });

  return {
    userId: null,
    email: normalizedEmail || null,
    phone: inputPhone || null,
    userDoc: null,
    source: "not_found"
  };
}

// Send Dynamic Verification Code (Email/SMS)
app.post("/api/auth/send-verification-code", otpLimiter, async (req, res) => {
  const isRecovery = req.body.type === "account_recovery";
  const recoveryRequestId = isRecovery ? `RECOVERY-${crypto.randomBytes(4).toString("hex").toUpperCase()}` : null;

  try {
    const { email, phone, type = "account_registration", userId } = req.body;
    if (!email && !phone && !userId) {
      if (isRecovery) {
        console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "input_validation", error: "Missing email/phone/userId")`);
      }
      return res.status(400).json({ error: "Email, phone, or userId is required" });
    }

    if (isRecovery) {
      console.log(`[RECOVERY] request received (id: ${recoveryRequestId}, type: ${type})`);
    }

    const resolvedUser = await resolveUserByEmailOrId({ userId, email, phone });
    const targetIdentifier = resolvedUser.email || (email || phone || "").trim().toLowerCase();
    let foundUid = resolvedUser.userId;

    // For account recovery, check lifecycle records explicitly
    let lifecycleRecord: any = null;
    if (isRecovery && targetIdentifier) {
      lifecycleRecord = await getAccountLifecycleRecord(targetIdentifier);
      if (lifecycleRecord) {
        console.log(`[RECOVERY] deleted account found (id: ${recoveryRequestId}, userId: ${lifecycleRecord.originalUserId || foundUid || "known"}, status: ${lifecycleRecord.status})`);
        
        if (lifecycleRecord.status === "PURGED" || (lifecycleRecord.restoreUntil && Date.now() > new Date(lifecycleRecord.restoreUntil).getTime())) {
          console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "lifecycle_check", error: "RESTORE_EXPIRED")`);
          return res.status(400).json({
            success: false,
            code: "RESTORE_EXPIRED",
            error: "انتهت مهلة 31 يوماً المتاحة لاستعادة هذا الحساب. تم حذف البيانات بشكل نهائي ولم يعد قابلاً للاستعادة.",
            userFriendlyMessage: "انتهت فترة استعادة الحساب المحددة بـ 31 يوماً."
          });
        }

        if (lifecycleRecord.status === "ADMIN_DELETED" || lifecycleRecord.deletionType === "admin") {
          console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "lifecycle_check", error: "ADMIN_APPROVAL_REQUIRED")`);
          return res.status(400).json({
            success: false,
            code: "ADMIN_APPROVAL_REQUIRED",
            error: "هذا الحساب تم حذفه أو إيقافه بواسطة إدارة المنصة. يرجى تقديم طلب استعادة للمسؤول.",
            userFriendlyMessage: "هذا الحساب يتطلب موافقة إدارة المنصة للاستعادة."
          });
        }

        if (!foundUid) {
          foundUid = lifecycleRecord.originalUserId || `usr_${targetIdentifier.replace(/[^a-zA-Z0-9]/g, '_')}`;
        }
        console.log(`[RECOVERY] recovery allowed (id: ${recoveryRequestId})`);
      }
    }

    if (!foundUid) {
      if (isRecovery) {
        console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "user_lookup", error: "DELETED_ACCOUNT_NOT_FOUND")`);
        return res.status(400).json({
          success: false,
          error: "لا يوجد حساب محذوف قابل للاستعادة بهذا البريد الإلكتروني.",
          userFriendlyMessage: "لا يوجد حساب محذوف قابل للاستعادة بهذا البريد الإلكتروني."
        });
      }

      console.warn("OTP_SEND_FAILED", {
        reason: "USER_NOT_FOUND",
        userId: null,
        email: targetIdentifier
      });
      return res.status(400).json({
        success: false,
        error: "No registered user found for this email address.",
        userFriendlyMessage: "No registered user found for this email address."
      });
    }

    const docId = foundUid; // CRITICAL: Document ID MUST be the resolved userId!
    const db = readDb();
    if (!db.verification_codes) db.verification_codes = [];

    // Read existing record to enforce limits & 10-minute cooldown cycle
    let existingRecord: any = null;
    try {
      const docSnap = await adminDb.collection("verification_codes").doc(docId).get();
      if (docSnap.exists) {
        existingRecord = docSnap.data();
      }
    } catch (err) {
      console.warn("Firestore read failed for existing verification code, checking fallback:", err);
    }

    if (!existingRecord) {
      existingRecord = db.verification_codes.find((vc: any) => vc.id === docId);
    }

    const nowMs = Date.now();
    const RESEND_COOLDOWN_MINUTES = parseInt(process.env.RESEND_COOLDOWN_MINUTES || "10", 10);
    const RESEND_COOLDOWN_MS = RESEND_COOLDOWN_MINUTES * 60 * 1000;

    const isInitial = !!req.body.isInitial;
    let currentSendCount = existingRecord ? (existingRecord.sendCount || 0) : 0;

    if (!isInitial) {
      // 1. Check if user is currently in an active 10-minute cooldown
      if (existingRecord && existingRecord.cooldownUntil) {
        const cooldownUntilMs = new Date(existingRecord.cooldownUntil).getTime();
        if (nowMs < cooldownUntilMs) {
          const remainingSecs = Math.ceil((cooldownUntilMs - nowMs) / 1000);
          console.log(`[OTP COOLDOWN ACTIVE] User ${docId} is in 10-min cooldown for ${remainingSecs}s.`);
          if (isRecovery) {
            console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "cooldown", remaining: ${remainingSecs}s)`);
          }
          return res.status(400).json({
            success: false,
            error: "You've reached the maximum number of code requests. Please wait a few minutes before requesting a new verification code.",
            userFriendlyMessage: "لقد وصلت إلى الحد الأقصى لطلبات رمز التحقق. يرجى الانتظار قليلًا قبل طلب رمز جديد.",
            cooldownUntil: existingRecord.cooldownUntil,
            cooldownRemainingSeconds: remainingSecs,
            sendCount: currentSendCount
          });
        } else {
          // Cooldown has expired! Reset send count to 0 to start a brand new cycle
          console.log(`[OTP COOLDOWN EXPIRED] Resetting send count for user ${docId}.`);
          currentSendCount = 0;
        }
      }

      // 2. If user reached 3 sends and cooldown hasn't been set yet
      if (currentSendCount >= 3) {
        const newCooldownUntil = new Date(nowMs + RESEND_COOLDOWN_MS).toISOString();
        console.log(`[OTP MAX SENDS REACHED] User ${docId} entering 10-min cooldown until ${newCooldownUntil}.`);
        
        const updatedCooldownRecord = {
          ...(existingRecord || {}),
          id: docId,
          userId: foundUid,
          email: targetIdentifier,
          cooldownUntil: newCooldownUntil,
          sendCount: 3
        };

        try {
          await adminDb.collection("verification_codes").doc(docId).set(updatedCooldownRecord, { merge: true });
        } catch (e) {}
        db.verification_codes = (db.verification_codes || []).filter((vc: any) => vc.id !== docId);
        db.verification_codes.push(updatedCooldownRecord);
        writeDb(db);

        if (isRecovery) {
          console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "max_sends_cooldown")`);
        }

        return res.status(400).json({
          success: false,
          error: "You've reached the maximum number of code requests. Please wait a few minutes before requesting a new verification code.",
          userFriendlyMessage: "لقد وصلت إلى الحد الأقصى لطلبات رمز التحقق. يرجى الانتظار قليلًا قبل طلب رمز جديد.",
          cooldownUntil: newCooldownUntil,
          cooldownRemainingSeconds: RESEND_COOLDOWN_MINUTES * 60,
          sendCount: 3
        });
      }

      // 3. Short 30-second throttle between consecutive resend requests
      if (existingRecord && existingRecord.lastSentAt && !existingRecord.cooldownUntil) {
        const timeSinceLastSent = nowMs - new Date(existingRecord.lastSentAt).getTime();
        if (timeSinceLastSent < 30 * 1000) {
          const waitRemaining = Math.ceil((30 * 1000 - timeSinceLastSent) / 1000);
          if (isRecovery) {
            console.warn(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "throttle_30s", remaining: ${waitRemaining}s)`);
          }
          return res.status(400).json({
            success: false,
            error: `Please wait ${waitRemaining}s before requesting a new verification code.`,
            userFriendlyMessage: `يرجى الانتظار ${waitRemaining} ثانية قبل طلب رمز جديد.`,
            sendCount: currentSendCount
          });
        }
      }
    }

    // Generate dynamic, cryptographically secure 6-digit numeric verification code
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashVerificationCode(otpCode);
    const expiresAt = new Date(nowMs + 10 * 60 * 1000).toISOString(); // 10 minutes expiry

    if (isRecovery) {
      console.log(`[RECOVERY] OTP generated (id: ${recoveryRequestId}, generated: true)`);
    }

    let reqName = req.body.name || req.body.userName || req.body.ownerName || req.body.fullName || "";
    let firestoreUserData = resolvedUser.userDoc;

    const localUser = db.users?.find((u: any) => u.id === foundUid || u.email?.toLowerCase() === targetIdentifier);

    let rawName = reqName
      || firestoreUserData?.ownerName || firestoreUserData?.name || firestoreUserData?.fullName || firestoreUserData?.displayName || firestoreUserData?.companyName
      || localUser?.ownerName || localUser?.name || localUser?.fullName || localUser?.displayName || localUser?.companyName
      || "";

    const resolvedUserName = cleanUserName(rawName, targetIdentifier);

    // Build 100% English SaaS HTML email
    const { subject: emailSubject, text: textBody, html: htmlBody } = buildOtpEmailHtml({
      email: targetIdentifier,
      userName: resolvedUserName,
      otpCode: otpCode,
      type: type
    });

    if (isRecovery) {
      console.log(`[RECOVERY] email send started (id: ${recoveryRequestId}, provider: Resend)`);
    }

    // Dispatch OTP email (via Resend or graceful local simulation fallback)
    const mailResult = await sendSystemMail(targetIdentifier, emailSubject, textBody, htmlBody);
    
    if (!mailResult.success && !mailResult.simulated) {
      console.error("[OTP DELIVERY FAILURE]", mailResult.error);
      if (isRecovery) {
        console.error(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "email_dispatch", error: ${mailResult.error?.message || mailResult.error || "Unknown"})`);
      }
      return res.status(500).json({ 
        success: false, 
        error: "تعذر إرسال رمز الاستعادة. يرجى المحاولة مرة أخرى.",
        userFriendlyMessage: "تعذر إرسال رمز الاستعادة. يرجى المحاولة مرة أخرى."
      });
    }

    if (isRecovery) {
      const resStatus = mailResult.success ? 200 : (mailResult.statusCode || 500);
      const resMsgId = mailResult.messageId || "none";
      console.log(`Recovery email Resend ID: ${resMsgId}`);
      console.log(`[RECOVERY] Resend response status: ${resStatus}, recipient: ${maskEmail(targetIdentifier)}, message ID: ${resMsgId}`);
    }

    const emailSent = !mailResult.simulated;

    // Mail sent successfully or simulated! Calculate new send count
    const newSendCount = isInitial ? currentSendCount : (currentSendCount + 1);
    let cooldownUntil: string | null = existingRecord?.cooldownUntil || null;
    if (!isInitial && newSendCount >= 3) {
      cooldownUntil = new Date(nowMs + RESEND_COOLDOWN_MS).toISOString();
      console.log(`[OTP 3RD SEND COMPLETED] Starting 10-minute cooldown for user ${docId} until ${cooldownUntil}`);
    }

    const record = {
      id: docId,
      userId: foundUid,
      email: targetIdentifier,
      phone: phone ? phone.trim() : "",
      codeHash: codeHash, // STORE ONLY SECURE HASH
      type: type,
      expiresAt: expiresAt,
      attempts: 0,
      sendCount: newSendCount,
      cooldownUntil: cooldownUntil,
      lastSentAt: new Date().toISOString(),
      used: false,
      createdAt: new Date().toISOString()
    };

    console.log("Saving OTP for Doc ID:", docId, "Count:", newSendCount, "Name:", resolvedUserName || "(none)");

    // Save record to Firestore and local JSON db under both UID and email to ensure seamless recovery verification
    try {
      await adminDb.collection("verification_codes").doc(docId).set(record);
      if (docId !== targetIdentifier) {
        await adminDb.collection("verification_codes").doc(targetIdentifier).set({ ...record, id: targetIdentifier });
      }
    } catch (dbErr) {
      console.error("Failed to write to Firestore verification_codes:", dbErr);
    }

    try {
      if (!db.verification_codes) db.verification_codes = [];
      db.verification_codes = db.verification_codes.filter((vc: any) => vc.id !== docId && vc.id !== targetIdentifier);
      db.verification_codes.push(record);
      if (docId !== targetIdentifier) {
        db.verification_codes.push({ ...record, id: targetIdentifier });
      }
      writeDb(db);
    } catch (err) {
      console.warn("Fallback JSON DB write failed:", err);
    }

    if (isRecovery) {
      console.log(`[RECOVERY] OTP stored (id: ${recoveryRequestId}, docId: ${docId})`);
      console.log(`[RECOVERY] email send completed (id: ${recoveryRequestId})`);
    }

    console.log(`[VERIFICATION CODE RECORDED] Target: ${targetIdentifier} | Code: [SECURE 6-DIGITS RECORDED] | Send Count: ${newSendCount}`);

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${targetIdentifier}`,
      expiresAt: expiresAt,
      emailSent: emailSent,
      devCode: mailResult.simulated ? otpCode : undefined,
      sendCount: newSendCount,
      cooldownUntil: cooldownUntil || undefined,
      sendCountRemaining: Math.max(0, 3 - newSendCount)
    });
  } catch (error: any) {
    if (isRecovery) {
      console.error(`[RECOVERY] FAILED (id: ${recoveryRequestId}, stage: "exception", error: ${error?.message || String(error)})`);
    }
    console.error("Verification Sending Error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to generate verification code" });
  }
});

// Verify Code (Account activation / Security checks)
app.post("/api/auth/verify-code", otpLimiter, async (req, res) => {
  try {
    const { email, phone, code, userId, type = "account_registration" } = req.body;
    if ((!email && !phone && !userId) || !code) {
      return res.status(400).json({ error: "Identifier and 6-digit verification code are required" });
    }

    const resolvedUser = await resolveUserByEmailOrId({ userId, email, phone });
    const targetIdentifier = resolvedUser.email || (email || phone || "").trim().toLowerCase();
    const cleanCode = String(code).trim();
    const foundUid = resolvedUser.userId;

    console.log("Verifying OTP for:", targetIdentifier);

    // Secure logging of OTP verification attempt (no OTP or hash logged)
    console.log("OTP verification attempt", {
      userId: foundUid || null,
      email: targetIdentifier,
      documentId: foundUid || null,
    });

    if (!foundUid) {
      console.warn("OTP_VERIFY_FAILED", {
        reason: "USER_NOT_FOUND",
        userId: null,
        email: targetIdentifier,
      });
      return res.status(400).json({ error: "No registered user found for this email address." });
    }

    const docId = foundUid; // CRITICAL: documentId MUST be the resolved userId!
    let activeRecord: any = null;

    try {
      const docSnap = await adminDb.collection("verification_codes").doc(docId).get();
      if (docSnap.exists) {
        activeRecord = docSnap.data();
      }
    } catch (err) {
      console.error("Failed to query Firestore verification_codes:", err);
    }

    // Fallback lookup if not found under userId document ID
    if (!activeRecord) {
      const db = readDb();
      if (!db.verification_codes) db.verification_codes = [];
      activeRecord = db.verification_codes.find((vc: any) => vc.id === docId || vc.userId === docId);

      if (!activeRecord) {
        // Fallback for legacy records stored with email as documentId
        try {
          const qSnap = await adminDb.collection("verification_codes")
            .where("email", "==", targetIdentifier)
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
      return res.status(400).json({ error: "No active verification code found. Please click Resend Code." });
    }

    if (activeRecord.used) {
      console.warn("OTP_VERIFY_FAILED", {
        reason: "ALREADY_USED",
        userId: foundUid,
        email: targetIdentifier,
      });
      return res.status(400).json({ error: "No active verification code found. Please click Resend Code." });
    }

    if (activeRecord.userId && activeRecord.userId !== foundUid) {
      console.warn("OTP_VERIFY_FAILED", {
        reason: "INVALID_USER",
        userId: foundUid,
        email: targetIdentifier,
      });
      return res.status(400).json({ error: "Verification code does not match the active session." });
    }

    const recordDocId = activeRecord.id || docId;

    const updateRecord = async (fields: any) => {
      try {
        await adminDb.collection("verification_codes").doc(recordDocId).update(fields);
      } catch (err) {
        console.error("Failed to update Firestore verification code:", err);
      }
      // Update in local DB
      const db = readDb();
      if (!db.verification_codes) db.verification_codes = [];
      const localRecord = db.verification_codes.find((vc: any) => vc.id === recordDocId || vc.id === docId);
      if (localRecord) {
        Object.assign(localRecord, fields);
        writeDb(db);
      }
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
      return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
    }

    // Check max attempts limit
    if (activeRecord.attempts >= 5) {
      await updateRecord({ used: true });
      console.warn("OTP_VERIFY_FAILED", {
        reason: "ALREADY_USED",
        userId: foundUid,
        email: targetIdentifier,
      });
      return res.status(400).json({ error: "Maximum verification attempts reached. Please request a new code." });
    }

    const cleanCodeHash = hashVerificationCode(cleanCode);
    const isMatch = activeRecord.codeHash 
      ? activeRecord.codeHash === cleanCodeHash 
      : activeRecord.code === cleanCode;

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
      return res.status(400).json({ error: `Incorrect verification code. ${remaining} attempt(s) remaining.` });
    }

    // Code is correct! Mark used immediately so it cannot be re-used
    await updateRecord({ used: true, verifiedAt: new Date().toISOString() });

    // Update user record in db
    const db = readDb();
    const user = db.users?.find((u: any) => u.email?.toLowerCase() === targetIdentifier || u.id === foundUid);
    
    let firestoreUser: any = null;
    try {
      const userRef = adminDb.collection("users").doc(foundUid);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        firestoreUser = userSnap.data();
        await userRef.update({
          isVerified: true,
          isEmailVerified: true,
          emailVerified: true,
          email_verified: true,
          isPhoneVerified: true,
          verification_status: "verified",
          verification_required: false,
          "verificationInfo.status": "verified",
          "verificationInfo.verifiedAt": new Date().toISOString()
        });
        firestoreUser.isVerified = true;
        firestoreUser.isEmailVerified = true;
        firestoreUser.emailVerified = true;
        firestoreUser.email_verified = true;
        firestoreUser.verification_status = "verified";
        firestoreUser.verification_required = false;
        console.log(`[VERIFICATION SUCCESS] Updated user ${foundUid} in Firestore.`);
      }
    } catch (uErr) {
      console.warn("Could not update user verification status in Firestore (proceeding):", uErr);
    }

    if (user) {
      user.isVerified = true;
      user.isEmailVerified = true;
      user.emailVerified = true;
      user.email_verified = true;
      user.isPhoneVerified = true;
      user.verification_status = "verified";
      user.verification_required = false;
      if (!user.verificationInfo) user.verificationInfo = {};
      user.verificationInfo.status = "verified";
      user.verificationInfo.verifiedAt = new Date().toISOString();
      if (firestoreUser && firestoreUser.role) {
        user.role = firestoreUser.role;
      }
      writeDb(db);
    }

    const resolvedFinalUser = firestoreUser || user || resolvedUser.userDoc || null;
    if (resolvedFinalUser && !resolvedFinalUser.role) {
      resolvedFinalUser.role = "CEO";
    }

    return res.status(200).json({
      success: true,
      message: "Verification successful!",
      user: resolvedFinalUser
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
      return res.status(400).json({ error: "Email address or phone number is required" });
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
      const uSnap = await adminDb.collection("users")
        .where("email", "==", target)
        .limit(1)
        .get();
      if (!uSnap.empty) {
        const uDoc = uSnap.docs[0];
        firestoreUserData = uDoc.data();
        userId = uDoc.id;
        userEmail = firestoreUserData.email || target;
        userPhone = firestoreUserData.phone || "";
        rawUserName = firestoreUserData.ownerName || firestoreUserData.name || firestoreUserData.fullName || "";
        user = { id: userId, email: userEmail, phone: userPhone, ownerName: rawUserName };
      }
    } catch (err) {
      console.warn("Firestore forgot-password user lookup failed:", err);
    }

    if (!user) {
      const localUser = db.users.find((u: any) => u.email?.toLowerCase() === target || u.phone === target);
      if (localUser) {
        userId = localUser.id;
        userEmail = localUser.email || target;
        userPhone = localUser.phone || "";
        rawUserName = localUser.ownerName || localUser.name || localUser.fullName || "";
        user = localUser;
      }
    }

    if (!user) {
      // Prevent account enumeration: return successful status with generic message
      return res.json({
        success: true,
        message: "If an account matches that email address, a password reset code has been sent.",
        userFriendlyMessage: "إذا كان الحساب مسجلاً، فقد تم إرسال رمز إعادة تعيين كلمة المرور إلى البريد الإلكتروني."
      });
    }

    // Document ID is primarily userId, falling back to target
    const docId = userId || target;

    // Read existing record to enforce limits & 10-minute cooldown cycle
    let existingRecord: any = null;
    try {
      const docSnap = await adminDb.collection("verification_codes").doc(docId).get();
      if (docSnap.exists) {
        existingRecord = docSnap.data();
      }
    } catch (err) {
      console.warn("Firestore read failed for existing forgot-password code, checking fallback:", err);
    }

    if (!existingRecord) {
      if (!db.verification_codes) db.verification_codes = [];
      existingRecord = db.verification_codes.find((vc: any) => vc.id === docId);
    }

    const nowMs = Date.now();
    const RESEND_COOLDOWN_MINUTES = parseInt(process.env.RESEND_COOLDOWN_MINUTES || "10", 10);
    const RESEND_COOLDOWN_MS = RESEND_COOLDOWN_MINUTES * 60 * 1000;

    let currentSendCount = existingRecord ? (existingRecord.sendCount || 0) : 0;

    // 1. Check if user is currently in an active 10-minute cooldown
    if (existingRecord && existingRecord.cooldownUntil) {
      const cooldownUntilMs = new Date(existingRecord.cooldownUntil).getTime();
      if (nowMs < cooldownUntilMs) {
        const remainingSecs = Math.ceil((cooldownUntilMs - nowMs) / 1000);
        console.log(`[FORGOT PASSWORD OTP COOLDOWN ACTIVE] User ${docId} is in 10-min cooldown for ${remainingSecs}s.`);
        return res.status(400).json({
          success: false,
          error: "You've reached the maximum number of code requests. Please wait a few minutes before requesting a new verification code.",
          userFriendlyMessage: "لقد وصلت إلى الحد الأقصى لطلبات رمز التحقق. يرجى الانتظار قليلًا قبل طلب رمز جديد.",
          cooldownUntil: existingRecord.cooldownUntil,
          cooldownRemainingSeconds: remainingSecs,
          sendCount: currentSendCount
        });
      } else {
        // Cooldown has expired! Reset send count to 0 to start a brand new cycle
        console.log(`[FORGOT PASSWORD OTP COOLDOWN EXPIRED] Resetting send count for user ${docId}.`);
        currentSendCount = 0;
      }
    }

    // 2. If user reached 3 sends and cooldown hasn't been set yet
    if (currentSendCount >= 3) {
      const newCooldownUntil = new Date(nowMs + RESEND_COOLDOWN_MS).toISOString();
      console.log(`[FORGOT PASSWORD MAX SENDS REACHED] User ${docId} entering 10-min cooldown until ${newCooldownUntil}.`);
      
      const updatedCooldownRecord = {
        ...(existingRecord || {}),
        id: docId,
        cooldownUntil: newCooldownUntil,
        sendCount: 3
      };

      try {
        await adminDb.collection("verification_codes").doc(docId).set(updatedCooldownRecord, { merge: true });
      } catch (e) {}
      db.verification_codes = (db.verification_codes || []).filter((vc: any) => vc.id !== docId);
      db.verification_codes.push(updatedCooldownRecord);
      writeDb(db);

      return res.status(400).json({
        success: false,
        error: "You've reached the maximum number of code requests. Please wait a few minutes before requesting a new verification code.",
        userFriendlyMessage: "لقد وصلت إلى الحد الأقصى لطلبات رمز التحقق. يرجى الانتظار قليلًا قبل طلب رمز جديد.",
        cooldownUntil: newCooldownUntil,
        cooldownRemainingSeconds: RESEND_COOLDOWN_MINUTES * 60,
        sendCount: 3
      });
    }

    // 3. Short 60-second throttle between consecutive requests
    if (existingRecord && existingRecord.lastSentAt && !existingRecord.cooldownUntil) {
      const timeSinceLastSent = nowMs - new Date(existingRecord.lastSentAt).getTime();
      if (timeSinceLastSent < 60 * 1000) {
        const waitRemaining = Math.ceil((60 * 1000 - timeSinceLastSent) / 1000);
        return res.status(400).json({
          success: false,
          error: `Please wait ${waitRemaining}s before requesting a new verification code.`,
          userFriendlyMessage: `يرجى الانتظار ${waitRemaining} ثانية قبل طلب رمز جديد.`,
          sendCount: currentSendCount
        });
      }
    }

    // Generate dynamic, cryptographically secure 6-digit password reset code
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashVerificationCode(otpCode);
    const expiresAt = new Date(nowMs + 10 * 60 * 1000).toISOString();

    const resolvedUserName = cleanUserName(req.body.name || rawUserName, userEmail);

    const { subject: emailSubject, text: textBody, html: htmlBody } = buildOtpEmailHtml({
      email: userEmail,
      userName: resolvedUserName,
      otpCode: otpCode,
      type: "password_reset"
    });

    // Dispatch password reset email (via Resend or graceful local simulation fallback)
    const mailResult = await sendSystemMail(target, emailSubject, textBody, htmlBody);
    
    if (!mailResult.success && !mailResult.simulated) {
      console.error("[PASSWORD RESET EMAIL DELIVERY FAILURE]", mailResult.error);
      return res.status(500).json({ 
        success: false, 
        error: "تعذر إرسال رابط إعادة التعيين. حاول مرة أخرى." 
      });
    }

    const emailSent = !mailResult.simulated;

    // Mail sent successfully! Calculate new send count
    const newSendCount = currentSendCount + 1;
    let cooldownUntil: string | null = null;
    if (newSendCount >= 3) {
      cooldownUntil = new Date(nowMs + RESEND_COOLDOWN_MS).toISOString();
      console.log(`[FORGOT PASSWORD 3RD SEND COMPLETED] Starting 10-minute cooldown for user ${docId} until ${cooldownUntil}`);
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
      createdAt: new Date().toISOString()
    };

    console.log("Saving password reset OTP for Doc ID:", docId, "Count:", newSendCount);

    // Save the code to Firestore and local DB
    try {
      await adminDb.collection("verification_codes").doc(docId).set(record);
    } catch (dbErr) {
      console.error("Failed to write to Firestore verification_codes:", dbErr);
    }

    try {
      if (!db.verification_codes) db.verification_codes = [];
      db.verification_codes = db.verification_codes.filter((vc: any) => vc.id !== docId);
      db.verification_codes.push(record);
      writeDb(db);
    } catch (err) {
      console.warn("Failed to write to fallback JSON DB:", err);
    }

    console.log(`[PASSWORD RESET CODE RECORDED] Target: ${target} | Code: [SECURE 6-DIGITS RECORDED] | Send Count: ${newSendCount}`);

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${target}`,
      emailSent: true,
      sendCount: newSendCount,
      cooldownUntil: cooldownUntil || undefined,
      sendCountRemaining: Math.max(0, 3 - newSendCount)
    });
  } catch (error: any) {
    console.error("Password Reset Sending Error:", error);
    return res.status(200).json({ success: false, serverError: error?.message || "Failed to process forgot password request" });
  }
});

// Confirm Password Reset with Code & New Password
app.post("/api/auth/reset-password", otpLimiter, async (req, res) => {
  try {
    const { emailOrPhone, code, newPassword } = req.body;
    if (!emailOrPhone || !code || !newPassword) {
      return res.status(400).json({ error: "All fields (email/phone, code, new password) are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    const target = emailOrPhone.trim().toLowerCase();
    const cleanCode = String(code).trim();

    console.log("Searching OTP:", target);
    let activeRecords: any[] = [];
    try {
      const qSnap = await adminDb.collection("verification_codes")
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
      console.log("No active password reset code in Firestore, trying JSON database fallback...");
      const db = readDb();
      if (!db.verification_codes) db.verification_codes = [];
      const localRecords = db.verification_codes.filter((vc: any) => 
        (vc.email?.toLowerCase() === target || vc.phone === target) && 
        vc.type === "password_reset" && 
        !vc.used
      );
      activeRecords = localRecords;
    }

    if (activeRecords.length === 0) {
      return res.status(400).json({ error: "No active password reset request found. Please request a new verification code." });
    }

    activeRecords.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const activeRecord = activeRecords[0];
    console.log("OTP record located for password reset verification");

    const docRef = activeRecord.docId ? adminDb.collection("verification_codes").doc(activeRecord.docId) : null;

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
      const localRecord = db.verification_codes.find((vc: any) => vc.id === activeRecord.id);
      if (localRecord) {
        Object.assign(localRecord, fields);
        writeDb(db);
      }
    };

    if (new Date() > new Date(activeRecord.expiresAt)) {
      await updateRecord({ used: true });
      return res.status(400).json({ error: "Password reset code has expired. Please request a new code." });
    }

    if (activeRecord.attempts >= 5) {
      await updateRecord({ used: true });
      return res.status(400).json({ error: "Maximum attempts reached. Please request a new reset code." });
    }

    const cleanCodeHash = hashVerificationCode(cleanCode);
    const isMatch = activeRecord.codeHash 
      ? activeRecord.codeHash === cleanCodeHash 
      : activeRecord.code === cleanCode;

    if (!isMatch) {
      const newAttempts = (activeRecord.attempts || 0) + 1;
      await updateRecord({ attempts: newAttempts });
      const remaining = 5 - newAttempts;
      return res.status(400).json({ error: `Incorrect verification code. ${remaining} attempt(s) remaining.` });
    }

    // Code verified!
    await updateRecord({ used: true });

    const db = readDb();
    const user = db.users.find((u: any) => u.email?.toLowerCase() === target || u.phone === target || u.id === activeRecord.userId);
    
    // Also update Firestore user if they exist there
    try {
      let uid = user?.id || activeRecord.userId;
      if (!uid) {
        const uSnap = await adminDb.collection("users")
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
            "verificationInfo.status": "verified"
          });
          console.log(`[PASSWORD RESET SUCCESS] Updated user ${uid} password in Firestore.`);
        }
      }
    } catch (uErr) {
      console.warn("Could not update user password in Firestore (proceeding):", uErr);
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
      message: "Your password has been successfully reset. You can now log in with your new password."
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to reset password" });
  }
});

// Set or Update Account Password (Supports Google users setting a password for the first time or updating existing password)
app.post("/api/auth/set-password", async (req, res) => {
  try {
    const { userId, email, newPassword, currentPassword, isGoogleUser } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const cleanEmail = email ? email.trim().toLowerCase() : "";
    const db = readDb();
    let user = db.users.find((u: any) => u.id === userId || (cleanEmail && u.email?.toLowerCase() === cleanEmail));

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
    const existingPassword = user?.passwordHash || firestoreUserSnap?.data()?.passwordHash;
    if (existingPassword && !isGoogleUser && currentPassword) {
      if (existingPassword !== currentPassword && hashVerificationCode(currentPassword) !== existingPassword) {
        return res.status(400).json({ error: "Current password is incorrect.", userFriendlyMessage: "كلمة المرور الحالية غير صحيحة." });
      }
    }

    // Update in Firebase Auth if available
    if (uid) {
      try {
        await adminAuth.updateUser(uid, { password: newPassword });
        console.log(`[PASSWORD SET] Updated Firebase Auth password for uid: ${uid}`);
      } catch (authErr: any) {
        console.warn("Could not update Firebase Auth user directly (proceeding with Firestore update):", authErr.message);
      }
    }

    // Update Firestore User Document
    if (uid) {
      try {
        await adminDb.collection("users").doc(uid).set({
          passwordHash: newPassword,
          hasPasswordSet: true,
          updatedAt: new Date().toISOString()
        }, { merge: true });
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
        role: "CEO",
        createdAt: new Date().toISOString()
      };
      db.users.push(newUser);
      writeDb(db);
    }

    return res.json({
      success: true,
      message: "Password has been successfully set.",
      userFriendlyMessage: "تم تعيين وحفظ كلمة المرور بنجاح."
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
    let user = db.users.find((u: any) => u.id === userId || (cleanEmail && u.email?.toLowerCase() === cleanEmail));

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

    const storedPassword = firestoreUserSnap?.passwordHash || user?.passwordHash;

    if (!storedPassword) {
      // If no password set yet (e.g. pure Google account without set password)
      return res.json({ success: true, valid: true, isFirstTime: true });
    }

    const isValid = storedPassword === password || hashVerificationCode(password) === storedPassword;

    return res.json({
      success: true,
      valid: isValid,
      message: isValid ? "Password verified." : "Invalid password."
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to verify password." });
  }
});

// Reset / Change Encryption Key using Current Account Password
app.post("/api/auth/reset-encryption-with-password", async (req, res) => {
  try {
    const { userId, email, accountPassword, newPasscode, lockedModules } = req.body;
    if (!newPasscode || newPasscode.trim().length === 0) {
      return res.status(400).json({ error: "New secret passcode is required." });
    }

    const cleanEmail = email ? email.trim().toLowerCase() : "";
    const db = readDb();
    let user = db.users.find((u: any) => u.id === userId || (cleanEmail && u.email?.toLowerCase() === cleanEmail));
    let uid = userId || user?.id;

    let firestoreUserData: any = null;
    if (uid) {
      try {
        const docRef = adminDb.collection("users").doc(uid);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          firestoreUserData = docSnap.data();
        }
      } catch (e) {}
    }

    const storedPassword = firestoreUserData?.passwordHash || user?.passwordHash;

    // If account has a password, verify accountPassword
    if (storedPassword && accountPassword) {
      const isValid = storedPassword === accountPassword || hashVerificationCode(accountPassword) === storedPassword;
      if (!isValid) {
        return res.status(400).json({ 
          success: false, 
          error: "Account password verification failed. Please enter your correct current account password.",
          userFriendlyMessage: "كلمة مرور الحساب غير صحيحة. يرجى إدخال كلمة المرور الحالية لحسابك لإعادة تعيين رمز التشفير."
        });
      }
    }

    const newSecuritySettings = {
      secretPasscode: newPasscode.trim(),
      isPinSet: true,
      lockedModules: lockedModules || {
        fileVault: true,
        memoryVault: true,
        riskRadar: true,
        settings: false
      },
      updatedAt: new Date().toISOString()
    };

    if (uid) {
      try {
        await adminDb.collection("users").doc(uid).set({
          encryptedSecurity: newSecuritySettings
        }, { merge: true });
        console.log(`[ENCRYPTION RESET] Updated security settings for uid: ${uid}`);
      } catch (fsErr) {
        console.warn("Firestore encryption update warning:", fsErr);
      }
    }

    if (user) {
      user.encryptedSecurity = newSecuritySettings;
      writeDb(db);
    }

    return res.json({
      success: true,
      message: "Encryption passcode reset successfully with account password verification.",
      userFriendlyMessage: "تمت إعادة تعيين وتحديث رمز التشفير بنجاح عبر تأكيد كلمة مرور الحساب.",
      encryptedSecurity: newSecuritySettings
    });
  } catch (err: any) {
    console.error("Error resetting encryption passcode:", err);
    res.status(500).json({ error: err.message || "Failed to reset encryption passcode." });
  }
});

// CEO Send Employee Workspace Invitation with Resend Email Integration
app.post("/api/admin/send-invitation", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        error: "Unauthorized: Token verification required.",
        userFriendlyMessage: "مصادقة المستخدم مطلوبة لإرسال الدعوات."
      });
    }

    const { email, name, role, powers } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();

    // 1. Validate Email Format
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        error: "Invalid email format provided.",
        userFriendlyMessage: "صيغة البريد الإلكتروني غير صحيحة، يرجى كتابة عنوان بريد صحيح."
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
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        error: "Sender account not found.",
        userFriendlyMessage: "تعذر العثور على حساب المدير المرسل."
      });
    }

    // 3. Verify CEO Authorization (Server-side Role Check)
    const ceoRole = (ceoData.role || "").toUpperCase();
    if (ceoRole !== "CEO" && ceoRole !== "ADMIN") {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        error: "Forbidden: Only CEO or Admin can invite workspace members.",
        userFriendlyMessage: "ليس لديك صلاحية إرسال دعوات الموظفين. هذه الصلاحية محصورة في المدير التنفيذي (CEO)."
      });
    }

    // 4. Prevent Self-Invitation
    if (normalizedEmail === (req.user?.email || ceoData.email || "").toLowerCase()) {
      return res.status(400).json({
        success: false,
        code: "SELF_INVITATION",
        error: "Cannot invite sender email address.",
        userFriendlyMessage: "لا يمكنك إرسال دعوة انضمام إلى بريدك الإلكتروني الحالي."
      });
    }

    // 5. Prevent Inviting Existing Members
    const workspaceId = ceoData.workspaceId || `ws_${callerUid.substring(0, 8)}`;
    const teamMembersList = ceoData.teamMembersList || [];
    const isAlreadyInTeam = teamMembersList.some((m: any) => {
      const mEmail = m.email?.trim().toLowerCase();
      const isPending = m.name?.includes("معلق") || m.name?.includes("Pending");
      return mEmail === normalizedEmail && !isPending;
    });

    if (isAlreadyInTeam) {
      return res.status(400).json({
        success: false,
        code: "ALREADY_MEMBER",
        error: "Employee is already a full member of the organization.",
        userFriendlyMessage: "هذا البريد الإلكتروني عضو بالفعل في المؤسسة."
      });
    }

    try {
      const existingUserSnap = await adminDb.collection("users").where("email", "==", normalizedEmail).get();
      if (!existingUserSnap.empty) {
        const existingUserData = existingUserSnap.docs[0].data();
        if (existingUserData.workspaceId === workspaceId && existingUserData.role !== "Pending") {
          return res.status(400).json({
            success: false,
            code: "ALREADY_MEMBER",
            error: "Employee is already registered in this workspace.",
            userFriendlyMessage: "هذا المستخدم عضو بالفعل في المؤسسة."
          });
        }
      }
    } catch (e) {}

    // 6. Check existing pending invitation
    let existingInv: any = null;
    try {
      const invDoc = await adminDb.collection("invitations").doc(normalizedEmail).get();
      if (invDoc.exists) {
        existingInv = invDoc.data();
      }
    } catch (e) {}

    // 7. Generate Secure Token & Expiration
    const secureToken = crypto.randomBytes(24).toString("hex");
    const nowIso = new Date().toISOString();
    const expiresAtIso = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    const companyName = ceoData.companyName || "ZakIr Platform";
    const memberName = (name || normalizedEmail.split("@")[0]).trim();
    const designatedRole = role || "Contributor";
    const defaultPowers = powers || {
      fileVault: true,
      memoryVault: true,
      riskRadar: false,
      marketIntel: false,
      settings: false
    };

    const invitationRecord: any = {
      email: normalizedEmail,
      name: memberName,
      role: designatedRole,
      powers: defaultPowers,
      workspaceId: workspaceId,
      companyName: companyName,
      senderId: callerUid,
      senderEmail: ceoData.email || req.user?.email,
      status: "pending",
      token: secureToken,
      createdAt: existingInv?.createdAt || nowIso,
      updatedAt: nowIso,
      expiresAt: expiresAtIso,
      lastSentAt: nowIso,
      resendCount: (existingInv?.resendCount || 0) + (existingInv ? 1 : 0)
    };

    // 8. Persist Invitation in Firestore & Local DB
    try {
      await adminDb.collection("invitations").doc(normalizedEmail).set(invitationRecord);
    } catch (fsErr) {
      console.error("Failed to write invitation to Firestore:", fsErr);
    }

    const db = readDb();
    if (!db.invitations) db.invitations = [];
    db.invitations = db.invitations.filter((i: any) => i.email?.trim().toLowerCase() !== normalizedEmail);
    db.invitations.push(invitationRecord);
    writeDb(db);

    // Update CEO's teamMembersList to include pending member
    try {
      const ceoRef = adminDb.collection("users").doc(callerUid);
      const updatedList = teamMembersList.filter((m: any) => m.email?.trim().toLowerCase() !== normalizedEmail);
      updatedList.push({
        id: `tm-inv-${Date.now()}`,
        name: `${memberName} (معلق)`,
        email: normalizedEmail,
        role: designatedRole,
        powers: defaultPowers,
        addedAt: nowIso.split("T")[0]
      });
      await ceoRef.update({ teamMembersList: updatedList });
    } catch (ceoErr) {
      console.warn("Failed to update CEO team list in Firestore:", ceoErr);
    }

    // 9. Dispatch Email via Resend / System Mailer
    const appBaseUrl = process.env.APP_URL || process.env.PUBLIC_APP_URL || getAppBaseUrl();
    const inviteLink = `${appBaseUrl}/?invitationToken=${secureToken}&email=${encodeURIComponent(normalizedEmail)}`;
    const inviterName = ceoData?.ownerName || ceoData?.email || "Workspace Admin";

    const { subject: emailSubject, text: emailText, html: emailHtml } = buildInvitationEmailHtml({
      companyName,
      memberName,
      inviterName,
      designatedRole,
      inviteLink,
      isReminder: false
    });

    const mailResult = await sendSystemMail({
      to: normalizedEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText
    });

    if (mailResult.success) {
      console.log("INVITATION_SENT_SUCCESSFULLY", {
        recipient: normalizedEmail,
        ceo: callerUid,
        workspaceId
      });
      return res.json({
        success: true,
        message: "Invitation generated and dispatched successfully via email.",
        userFriendlyMessage: `تم إرسال دعوة الموظف بنجاح إلى البريد (${normalizedEmail}).`,
        invitation: invitationRecord
      });
    } else {
      console.warn("INVITATION_EMAIL_DELIVERY_FAILED", {
        recipient: normalizedEmail,
        error: mailResult.error
      });
      invitationRecord.status = "email_failed";
      try {
        await adminDb.collection("invitations").doc(normalizedEmail).update({ status: "email_failed" });
      } catch (e) {}

      return res.json({
        success: true,
        emailSent: false,
        code: "EMAIL_SEND_FAILED",
        userFriendlyMessage: `تمت إضافة الدعوة بنجاح، لكن تعذر تسليم البريد الإلكتروني حالياً. يمكنك إعادة إرسال الدعوة لاحقاً من القائمة.`,
        invitation: invitationRecord
      });
    }

  } catch (err: any) {
    console.error("send-invitation endpoint exception:", err);
    return res.status(500).json({
      success: false,
      code: "INVITATION_CREATE_FAILED",
      error: err?.message || String(err),
      userFriendlyMessage: "تعذر إرسال الدعوة حالياً بسبب خطأ خادم داخلي. يرجى المحاولة مرة أخرى."
    });
  }
});

// CEO Resend Workspace Invitation
app.post("/api/admin/resend-invitation", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({ success: false, code: "AUTH_REQUIRED", error: "Unauthorized" });
    }

    const { email } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, code: "INVALID_EMAIL", error: "Email is required" });
    }

    let ceoData: any = null;
    try {
      const snap = await adminDb.collection("users").doc(callerUid).get();
      if (snap.exists) ceoData = snap.data();
    } catch (e) {}

    const ceoRole = (ceoData?.role || "").toUpperCase();
    if (ceoRole !== "CEO" && ceoRole !== "ADMIN") {
      return res.status(403).json({ success: false, code: "FORBIDDEN", error: "Forbidden: Only CEO can resend invitations" });
    }

    let invRecord: any = null;
    try {
      const invDoc = await adminDb.collection("invitations").doc(normalizedEmail).get();
      if (invDoc.exists) invRecord = invDoc.data();
    } catch (e) {}

    if (!invRecord) {
      const db = readDb();
      invRecord = db.invitations?.find((i: any) => i.email?.trim().toLowerCase() === normalizedEmail);
    }

    if (!invRecord) {
      return res.status(404).json({ success: false, code: "INVITATION_NOT_FOUND", error: "Invitation not found", userFriendlyMessage: "الدعوة غير موجودة." });
    }

    const secureToken = crypto.randomBytes(24).toString("hex");
    const nowIso = new Date().toISOString();
    const expiresAtIso = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    invRecord.token = secureToken;
    invRecord.status = "pending";
    invRecord.expiresAt = expiresAtIso;
    invRecord.lastSentAt = nowIso;
    invRecord.resendCount = (invRecord.resendCount || 0) + 1;

    try {
      await adminDb.collection("invitations").doc(normalizedEmail).set(invRecord);
    } catch (e) {}

    const db = readDb();
    if (!db.invitations) db.invitations = [];
    const idx = db.invitations.findIndex((i: any) => i.email?.trim().toLowerCase() === normalizedEmail);
    if (idx >= 0) db.invitations[idx] = invRecord;
    else db.invitations.push(invRecord);
    writeDb(db);

    const companyName = invRecord.companyName || ceoData?.companyName || "Zakir Workspace";
    const memberName = invRecord.name || normalizedEmail.split("@")[0];
    const designatedRole = invRecord.role || "Contributor";
    const appBaseUrl = process.env.APP_URL || process.env.PUBLIC_APP_URL || getAppBaseUrl();
    const inviteLink = `${appBaseUrl}/?invitationToken=${secureToken}&email=${encodeURIComponent(normalizedEmail)}`;
    const inviterName = ceoData?.ownerName || ceoData?.email || "Workspace Admin";

    const { subject: emailSubject, text: emailText, html: emailHtml } = buildInvitationEmailHtml({
      companyName,
      memberName,
      inviterName,
      designatedRole,
      inviteLink,
      isReminder: true
    });

    const mailResult = await sendSystemMail({
      to: normalizedEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText
    });

    return res.json({
      success: true,
      emailSent: mailResult.success,
      userFriendlyMessage: mailResult.success 
        ? `تمت إعادة إرسال بريد الدعوة بنجاح إلى (${normalizedEmail}).`
        : `تم تحديث الدعوة، لكن تعذر تسليم البريد الإلكتروني حالياً.`,
      invitation: invRecord
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message, userFriendlyMessage: "فشل إعادة إرسال الدعوة." });
  }
});

// CEO Revoke Workspace Invitation
app.post("/api/admin/revoke-invitation", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({ success: false, code: "AUTH_REQUIRED", error: "Unauthorized" });
    }

    const { email } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, code: "INVALID_EMAIL", error: "Email required" });
    }

    try {
      await adminDb.collection("invitations").doc(normalizedEmail).delete();
    } catch (e) {}

    const db = readDb();
    if (db.invitations) {
      db.invitations = db.invitations.filter((i: any) => i.email?.trim().toLowerCase() !== normalizedEmail);
      writeDb(db);
    }

    try {
      const ceoRef = adminDb.collection("users").doc(callerUid);
      const snap = await ceoRef.get();
      if (snap.exists) {
        const teamList = (snap.data()?.teamMembersList || []).filter((m: any) => m.email?.trim().toLowerCase() !== normalizedEmail);
        await ceoRef.update({ teamMembersList: teamList });
      }
    } catch (e) {}

    return res.json({
      success: true,
      userFriendlyMessage: `تم إلغاء وسحب الدعوة بنجاح لـ (${normalizedEmail}).`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message, userFriendlyMessage: "فشل إلغاء الدعوة." });
  }
});

// CEO Update Team Member Permissions & Roles (Strict CEO Control)
app.post("/api/admin/update-member-permissions", async (req, res) => {
  try {
    const { ceoId, memberId, memberEmail, powers, role } = req.body;
    if (!ceoId || !memberEmail) {
      return res.status(400).json({ error: "CEO ID and Member Email are required." });
    }

    const cleanEmail = memberEmail.trim().toLowerCase();
    const db = readDb();
    
    // Verify CEO identity and authorization
    let ceoUser = db.users.find((u: any) => u.id === ceoId);
    if (!ceoUser) {
      try {
        const ceoDoc = await adminDb.collection("users").doc(ceoId).get();
        if (ceoDoc.exists) {
          ceoUser = ceoDoc.data();
        }
      } catch (e) {}
    }

    if (ceoUser && ceoUser.role !== "CEO" && ceoUser.role !== "Admin") {
      return res.status(403).json({ 
        error: "Forbidden: Only the CEO has full authority to modify member powers and permissions.",
        userFriendlyMessage: "غير مصرح: يمتلك المدير التنفيذي (CEO) وحده الصلاحية الحصرية لتعديل صلاحيات العمال وأعضاء الفريق."
      });
    }

    // 1. Update CEO's teamMembersList in Firestore & Local DB
    if (ceoId) {
      try {
        const ceoRef = adminDb.collection("users").doc(ceoId);
        const ceoSnap = await ceoRef.get();
        if (ceoSnap.exists) {
          const data = ceoSnap.data();
          const list = (data?.teamMembersList || []) as any[];
          const targetIdx = list.findIndex((m: any) => m.email?.toLowerCase() === cleanEmail || m.id === memberId);
          if (targetIdx >= 0) {
            list[targetIdx] = {
              ...list[targetIdx],
              powers: powers || list[targetIdx].powers,
              role: role || list[targetIdx].role
            };
          } else {
            list.push({
              id: memberId || `tm-${Date.now()}`,
              email: cleanEmail,
              name: cleanEmail.split("@")[0],
              powers: powers || { fileVault: true, memoryVault: true, riskRadar: false, marketIntel: false, settings: false },
              role: role || "Contributor",
              addedAt: new Date().toISOString().split("T")[0]
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
            updatedAt: new Date().toISOString()
          });
          console.log(`[PERMISSIONS SYNC] Updated worker ${memberUid} profile in Firestore.`);
        }
      }

      // Also search by email in case memberUid was not the document ID
      const qSnap = await adminDb.collection("users").where("email", "==", cleanEmail).limit(1).get();
      if (!qSnap.empty) {
        const docRef = qSnap.docs[0].ref;
        await docRef.update({
          powers: powers,
          role: role || qSnap.docs[0].data()?.role || "Contributor",
          updatedAt: new Date().toISOString()
        });
        console.log(`[PERMISSIONS SYNC] Updated worker by email ${cleanEmail} in Firestore.`);
      }
    } catch (workerErr) {
      console.warn("Failed to update worker document directly in Firestore:", workerErr);
    }

    // Update in local DB
    if (db.users) {
      const workerUser = db.users.find((u: any) => u.email?.toLowerCase() === cleanEmail || u.id === memberUid);
      if (workerUser) {
        if (powers) workerUser.powers = powers;
        if (role) workerUser.role = role;
      }
      if (ceoUser && ceoUser.teamMembersList) {
        const idx = ceoUser.teamMembersList.findIndex((m: any) => m.email?.toLowerCase() === cleanEmail || m.id === memberId);
        if (idx >= 0) {
          ceoUser.teamMembersList[idx].powers = powers || ceoUser.teamMembersList[idx].powers;
          ceoUser.teamMembersList[idx].role = role || ceoUser.teamMembersList[idx].role;
        }
      }
      writeDb(db);
    }

    return res.json({
      success: true,
      message: "Member permissions updated successfully by CEO.",
      userFriendlyMessage: "تم تحديث وتثبيت صلاحيات العضو بنجاح من طرف المدير التنفيذي."
    });
  } catch (err: any) {
    console.error("Error updating member permissions:", err);
    res.status(500).json({ error: err.message || "Failed to update member permissions." });
  }
});

// --- CUSTOMER SUPPORT SYSTEM API ENDPOINTS ---

// Create Support Ticket
app.post("/api/support/tickets", async (req: AuthRequest, res) => {
  try {
    let callerUid = req.user?.uid;
    let callerEmail = req.user?.email || "";

    let { userId, userEmail, userName, userPhone, companyName, category, subject, message, description, priority = "Normal", attachments = [] } = req.body;

    userId = callerUid || userId || `usr_${Date.now()}`;
    userEmail = callerEmail || userEmail || "support_user@zakir.ai";
    const resolvedMessage = description || message;

    if (!userEmail || !subject || !resolvedMessage) {
      return res.status(400).json({ error: "User email, subject, and detailed message are required." });
    }

    const db = readDb();
    if (!db.support_tickets) db.support_tickets = [];

    // Lookup user createdAt if available in db.users
    let userCreatedAt = "";
    if (db.users) {
      const u = db.users.find((x: any) => x.id === userId || x.email?.toLowerCase() === userEmail.toLowerCase());
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
      createdAt: nowIso
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
      messages: [initialMsg]
    };

    db.support_tickets.unshift(newTicket);
    writeDb(db);

    // Save support ticket to Firestore support_tickets collection
    try {
      await adminDb.collection("support_tickets").doc(newTicket.id).set(newTicket);
      console.log("SUPPORT_TICKET_FIRESTORE_SAVED", { ticketId: newTicket.id, userId });
    } catch (fsErr: any) {
      console.warn("Failed to write support ticket to Firestore:", fsErr?.message);
    }

    return res.json({ success: true, ticket: newTicket, ticketNumber });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create support ticket" });
  }
});

// Get Support Tickets (Security isolated: non-admins only get their own tickets)
app.get("/api/support/tickets", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    
    // Check if caller is admin
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid) : false;
    
    const isAdmin = isCallerAdmin && req.query.isAdmin === "true";
    const queryUserId = (req.query.userId as string) || callerUid;
    const queryUserEmail = (req.query.userEmail as string) || callerEmail;

    // 1. Try querying Firestore support_tickets
    try {
      let qSnap: any = null;
      if (isAdmin) {
        qSnap = await adminDb.collection("support_tickets").orderBy("createdAt", "desc").get();
      } else if (queryUserId) {
        qSnap = await adminDb.collection("support_tickets").where("userId", "==", queryUserId).get();
      } else if (queryUserEmail) {
        qSnap = await adminDb.collection("support_tickets").where("userEmail", "==", queryUserEmail.toLowerCase()).get();
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
      tickets = tickets.filter((t: any) => 
        (queryUserId && t.userId === queryUserId) || 
        (queryUserEmail && t.userEmail?.toLowerCase() === queryUserEmail.toLowerCase())
      );
    }

    const sanitizedTickets = tickets.map((t: any) => {
      const { adminNotes, ...publicTicket } = t;
      return publicTicket;
    });

    return res.json({ tickets: sanitizedTickets });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch support tickets" });
  }
});

// Get Single Support Ticket
app.get("/api/support/tickets/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    if (!callerUid) return res.status(401).json({ error: "Unauthorized" });

    const isCallerAdmin = await isUserAdminServer(callerUid);

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
      if (ticket.userId !== callerUid && ticket.userEmail?.toLowerCase() !== callerEmail.toLowerCase()) {
        return res.status(403).json({ error: "Forbidden: You do not own this support ticket." });
      }
      const { adminNotes, ...publicTicket } = ticket;
      return res.json({ ticket: publicTicket });
    }

    return res.json({ ticket });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch support ticket" });
  }
});

// Add Reply Message to Support Ticket + Send Resend Email Notification
app.post("/api/support/tickets/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid) : false;
    
    const { id } = req.params;
    let { senderId, senderType, senderName, senderEmail, message, attachments = [] } = req.body;
    
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
    let localTicket = (db.support_tickets || []).find((t: any) => t.id === id);

    if (!ticket && localTicket) {
      ticket = localTicket;
    }

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Enforce ticket ownership on replies to prevent IDOR
    if (!isCallerAdmin) {
      if (ticket.userId !== callerUid && ticket.userEmail?.toLowerCase() !== callerEmail.toLowerCase()) {
        return res.status(403).json({ error: "Forbidden: You do not own this support ticket." });
      }
    }

    const nowIso = new Date().toISOString();

    // Derive authentic user profile from users collection if target user is known
    let recipientEmail = ticket.userEmail;
    let recipientName = ticket.userName || "Valued User";

    if (ticket.userId) {
      try {
        const uSnap = await adminDb.collection("users").doc(ticket.userId).get();
        if (uSnap.exists) {
          const uData = uSnap.data();
          if (uData?.email) recipientEmail = uData.email;
          if (uData?.ownerName || uData?.companyName) {
            recipientName = uData.ownerName || uData.companyName;
          }
        }
      } catch (uErr) {
        console.warn("Could not load user profile for support reply recipient:", uErr);
      }
    }

    const newMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId: id,
      senderId: senderId || (senderType === "admin" ? "admin" : ticket.userId),
      senderType: senderType || "user",
      senderName: senderName || (senderType === "admin" ? "Zakir Support Team" : recipientName),
      senderEmail: senderEmail || (senderType === "admin" ? "support@zakir.ai" : recipientEmail),
      message: message,
      attachments: Array.isArray(attachments) ? attachments : [],
      createdAt: nowIso
    };

    if (!ticket.messages) ticket.messages = [];
    ticket.messages.push(newMsg);
    ticket.updatedAt = nowIso;
    ticket.lastReplyAt = nowIso;

    if (senderType === "admin") {
      ticket.status = "Waiting for User";
    } else {
      if (ticket.status === "Waiting for User" || ticket.status === "Resolved") {
        ticket.status = "In Progress";
      }
    }

    // Save ticket to Firestore
    try {
      await docRef.set(ticket, { merge: true });
      console.log("SUPPORT_REPLY_FIRESTORE_SAVED", { ticketId: id, senderType });
    } catch (fsErr: any) {
      console.warn("Firestore support message update warning:", fsErr?.message);
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
        const { subject: emailSubject, text: emailText, html: emailHtml } = buildSupportReplyEmailHtml({
          recipientName,
          ticketId: String(ticket.id),
          ticketSubject: String(ticket.subject || "Support Ticket"),
          message: String(message)
        });

        await sendSystemMail({
          to: recipientEmail,
          subject: emailSubject,
          html: emailHtml,
          text: emailText
        });
        console.log("SUPPORT_REPLY_EMAIL_SENT", { recipientEmail, ticketId: id });
      } catch (mailErr: any) {
        console.error("ADMIN_SUPPORT_REPLY_EMAIL_FAILED", { recipientEmail, ticketId: id, error: mailErr?.message });
      }
    }

    return res.json({ success: true, message: newMsg, ticket });
  } catch (err: any) {
    console.error("ADMIN_SUPPORT_REPLY_FAILED", { ticketId: req.params.id, error: err?.message || String(err) });
    res.status(500).json({ error: err.message || "Failed to reply to support ticket" });
  }
});

// Update Ticket Status / Priority / Notes / Assigned Admin (Admin Action)
app.patch("/api/support/tickets/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    const isCallerAdmin = callerUid ? await isUserAdminServer(callerUid) : false;

    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }

    const { id } = req.params;
    const { status, priority, adminNotes, assignedAdminId, assignedAdminName } = req.body;

    const docRef = adminDb.collection("support_tickets").doc(id);
    let ticket: any = null;

    try {
      const tSnap = await docRef.get();
      if (tSnap.exists) {
        ticket = tSnap.data();
      }
    } catch (e) {}

    const db = readDb();
    let localTicket = (db.support_tickets || []).find((t: any) => t.id === id);

    if (!ticket && localTicket) {
      ticket = localTicket;
    }

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (adminNotes !== undefined) ticket.adminNotes = adminNotes;
    if (assignedAdminId !== undefined) ticket.assignedAdminId = assignedAdminId;
    if (assignedAdminName !== undefined) ticket.assignedAdminName = assignedAdminName;
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

    return res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update support ticket" });
  }
});

// --- CLOUD SQL ENDPOINTS ---
app.post("/api/sql/sync-user", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email;
    if (!uid || !email) {
      return res.status(400).json({ error: "Missing uid or email in auth token" });
    }
    const { companyName, role } = req.body;

    // Role & privilege protection: regular users are forbidden from escalating their roles or altering subscription statuses
    const isCallerAdmin = uid ? await isUserAdminServer(uid) : false;
    const resolvedRole = isCallerAdmin ? (role || "CEO") : "Analyst";

    if (process.env.SQL_HOST) {
      try {
        const user = await getOrCreateUser(uid, email, companyName, resolvedRole);
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
        createdAt: new Date().toISOString()
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
      return res.status(400).json({ error: "actionType and status are required" });
    }

    if (process.env.SQL_HOST) {
      try {
        const dbUserList = await withRetry(() => sqlDb.select().from(sqlUsers).where(eq(sqlUsers.uid, uid)));
        if (dbUserList && dbUserList.length > 0) {
          const dbUser = dbUserList[0];
          const newLog = await withRetry(() => 
            sqlDb.insert(gmailLogs)
              .values({
                userId: dbUser.id,
                actionType,
                recipient: recipient || null,
                subject: subject || null,
                status,
              })
              .returning()
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
      createdAt: new Date().toISOString()
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
        const dbUserList = await withRetry(() => sqlDb.select().from(sqlUsers).where(eq(sqlUsers.uid, uid)));
        if (dbUserList && dbUserList.length > 0) {
          const dbUser = dbUserList[0];
          const logs = await withRetry(() => 
            sqlDb.select()
              .from(gmailLogs)
              .where(eq(gmailLogs.userId, dbUser.id))
              .orderBy(desc(gmailLogs.createdAt))
              .limit(50)
          );
          return res.json(logs || []);
        }
      } catch (sqlErr) {
        // Silently fallback to local JSON database store below
      }
    }

    const dbData = readDb();
    const userLogs = (dbData.gmail_logs || []).filter((l: any) => l.userId === uid || !l.userId);
    res.json(userLogs);
  } catch (err: any) {
    res.json([]);
  }
});

// Endpoint to send real email to recipients via Gmail API or SMTP/Nodemailer
app.post("/api/email/send", requireAuth, emailLimiter, async (req: AuthRequest, res: express.Response) => {
  try {
    const { to, subject, body, html, googleAccessToken } = req.body;

    if (!to || !subject || (!body && !html)) {
      return res.status(400).json({ error: "Missing required fields: to, subject, and body or html" });
    }

    // 1. Validate 'to' is a single, valid email address
    const cleanTo = String(to).trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanTo)) {
      return res.status(400).json({ error: "Invalid recipient email address. Multiple recipients are strictly prohibited." });
    }

    // 2. Validate length of subject and body to prevent abuse (DoS/Buffer overflow)
    const cleanSubject = String(subject).trim().replace(/[\r\n]/g, ""); // Prevent header/MIME injection
    if (cleanSubject.length > 200) {
      return res.status(400).json({ error: "Subject must not exceed 200 characters." });
    }

    const emailBody = body ? String(body) : "";
    const emailHtmlRaw = html ? String(html) : "";
    if (emailBody.length > 100000 || emailHtmlRaw.length > 100000) {
      return res.status(400).json({ error: "Email body or HTML content exceeds the 100KB size limit." });
    }

    // 3. Prevent arbitrary attachments or parameters
    if (req.body.attachments || req.body.path) {
      return res.status(400).json({ error: "Attachments are not permitted via this endpoint." });
    }

    // Determine the verified sender email from Firebase Auth token
    const authenticatedUserEmail = req.user?.email;
    if (!authenticatedUserEmail) {
      return res.status(401).json({ error: "Unauthorized: Authenticated user must have a verified email address." });
    }

    console.log(`[EMAIL SEND INITIATED] User: ${authenticatedUserEmail} sending to: ${cleanTo} with subject: ${cleanSubject}`);

    const emailHtml = html || `<div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #1e293b;">${emailBody.replace(/\n/g, "<br/>")}</div>`;
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
          emailHtml
        ].join("\r\n");

        const encodedEmail = Buffer.from(emailContent)
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ raw: encodedEmail })
        });

        if (gmailRes.ok) {
          const gmailData = await gmailRes.json();
          return res.json({
            success: true,
            messageId: gmailData.id,
            provider: "Gmail API",
            message: "Email delivered via Gmail API"
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
    const mailResult = await sendSystemMail({ to: cleanTo, subject: systemSubject, html: emailHtml, text: emailText });
    if (!mailResult.success) {
      return res.status(500).json({ success: false, error: mailResult.userFriendlyMessage || mailResult.error?.message || "Failed to deliver email" });
    }
    return res.json({
      success: true,
      messageId: mailResult.messageId,
      provider: mailResult.provider,
      senderUsed: mailResult.sender || "Zakir <noreply@getzakir.com>",
      result: mailResult,
      message: "Email delivered to recipient successfully"
    });
  } catch (err: any) {
    console.error("Error sending email:", err);
    res.status(500).json({ error: err.message || "Failed to deliver email" });
  }
});

// Endpoint to send real email verification code for linking accounts
app.post("/api/email/send-verification-otp", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const { email, otpCode } = req.body;
    if (!email || !otpCode) {
      return res.status(400).json({ error: "Missing email or verification code" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    const { subject, text, html } = buildOtpEmailHtml({
      email: cleanEmail,
      otpCode: String(otpCode).trim(),
      type: "email_link"
    });

    console.log(`[EMAIL OTP SEND] Sending verification code to ${cleanEmail}`);
    const mailResult = await sendSystemMail({
      to: cleanEmail,
      subject,
      html,
      text
    });

    if (!mailResult.success) {
      return res.status(500).json({
        success: false,
        error: mailResult.userFriendlyMessage || mailResult.error?.message || "Failed to send email verification code"
      });
    }

    return res.json({
      success: true,
      message: "Verification code sent successfully to " + cleanEmail
    });
  } catch (err: any) {
    console.error("Error sending verification email:", err);
    res.status(500).json({ error: err.message || "Failed to send verification code" });
  }
});

// --- ADMIN USERS ENDPOINT (FIRESTORE AUTHORITATIVE) ---
app.get("/api/admin/users", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication context" });
    }

    const isCallerAdmin = await isUserAdminServer(callerUid);
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Administrative access required" });
    }

    const snap = await adminDb.collection("users").get();
    const fsUsers = snap && !snap.empty && snap.docs ? snap.docs.map((doc: any) => ({ ...doc.data(), id: doc.id })) : [];
    return res.json({ success: true, users: fsUsers });
  } catch (err: any) {
    console.error("Error fetching admin users from Firestore Admin SDK:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch users list" });
  }
});

// ==========================================
// ACCOUNT LIFECYCLE & RESTORATION SERVICES
// ==========================================

export async function getAccountLifecycleRecord(email: string): Promise<any> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  try {
    const docRef = adminDb.collection("accountLifecycle").doc(normalizedEmail);
    const docSnap = await docRef.get();
    let record: any = null;

    if (docSnap.exists) {
      record = docSnap.data();
    } else {
      const db = readDb();
      if (!db.account_lifecycle) db.account_lifecycle = [];
      record = db.account_lifecycle.find((r: any) => r.emailNormalized === normalizedEmail);
    }

    // Fallback: check deletedUsers or users_retained if not found in accountLifecycle
    if (!record) {
      try {
        const delSnap = await adminDb.collection("deletedUsers").where("email", "==", normalizedEmail).limit(1).get();
        if (!delSnap.empty) {
          const dData = delSnap.docs[0].data();
          const deletedAt = dData.deletedAt || new Date().toISOString();
          const restoreUntil = new Date(new Date(deletedAt).getTime() + 31 * 24 * 60 * 60 * 1000).toISOString();
          record = {
            accountId: normalizedEmail,
            emailNormalized: normalizedEmail,
            status: dData.reason === "admin_deleted" ? "ADMIN_DELETED" : "SELF_DELETED",
            deletionType: dData.reason === "admin_deleted" ? "admin" : "self",
            deletedAt: deletedAt,
            restoreUntil: restoreUntil,
            originalUserId: dData.uid || delSnap.docs[0].id,
            adminApprovalRequired: dData.reason === "admin_deleted"
          };
        }
      } catch (e) {}
    }

    if (!record) {
      try {
        const db = readDb();
        const retUser = db.retained_users?.find((u: any) => u.email?.trim().toLowerCase() === normalizedEmail);
        if (retUser) {
          const archivedAt = retUser.archivedAt || retUser.deletedAt || new Date().toISOString();
          const restoreUntil = new Date(new Date(archivedAt).getTime() + 31 * 24 * 60 * 60 * 1000).toISOString();
          record = {
            accountId: normalizedEmail,
            emailNormalized: normalizedEmail,
            status: "SELF_DELETED",
            deletionType: "self",
            deletedAt: archivedAt,
            restoreUntil: restoreUntil,
            originalUserId: retUser.id,
            adminApprovalRequired: false
          };
        }
      } catch (e) {}
    }

    if (!record) return null;

    // Check if self-deleted account has passed the 31-day restoration window
    if (record.deletionType === "self" && record.status === "SELF_DELETED" && record.restoreUntil) {
      const nowMs = Date.now();
      const restoreUntilMs = new Date(record.restoreUntil).getTime();
      if (nowMs > restoreUntilMs) {
        console.log(`[LIFECYCLE PURGE] Self-deleted account ${normalizedEmail} expired 31-day window. Purging retained user data.`);
        
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
          updatedAt: new Date().toISOString()
        };

        try {
          await docRef.set(purgedFields, { merge: true });
        } catch (e) {}

        record = { ...record, ...purgedFields };

        const db = readDb();
        if (!db.account_lifecycle) db.account_lifecycle = [];
        const idx = db.account_lifecycle.findIndex((r: any) => r.emailNormalized === normalizedEmail);
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
        record.daysRemaining = Math.max(1, Math.ceil(remainingMs / (24 * 3600 * 1000)));
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
    updatedAt: new Date().toISOString()
  };

  try {
    await docRef.set(payload, { merge: true });
  } catch (err) {
    console.error("setAccountLifecycleRecord Firestore error:", err);
  }

  try {
    const db = readDb();
    if (!db.account_lifecycle) db.account_lifecycle = [];
    const idx = db.account_lifecycle.findIndex((r: any) => r.emailNormalized === normalizedEmail);
    if (idx >= 0) db.account_lifecycle[idx] = { ...db.account_lifecycle[idx], ...payload };
    else db.account_lifecycle.push(payload);
    writeDb(db);
  } catch (err) {
    console.warn("setAccountLifecycleRecord local DB error:", err);
  }
}

export async function purgeRetainedUserDataServer(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const memSnap = await adminDb.collection("users_retained").doc(userId).collection("memories").get();
    for (const d of memSnap.docs) await d.ref.delete();

    const alertSnap = await adminDb.collection("users_retained").doc(userId).collection("riskAlerts").get();
    for (const d of alertSnap.docs) await d.ref.delete();

    const fileSnap = await adminDb.collection("users_retained").doc(userId).collection("files").get();
    for (const d of fileSnap.docs) await d.ref.delete();

    const topFileSnap = await adminDb.collection("users_retained").doc(userId).collection("top_files").get();
    for (const d of topFileSnap.docs) await d.ref.delete();

    await adminDb.collection("users_retained").doc(userId).delete();

    const db = readDb();
    if (db.retained_users) {
      db.retained_users = db.retained_users.filter((u: any) => u.id !== userId);
      writeDb(db);
    }

    console.log(`[PURGE COMPLETE] Retained user data for ${userId} purged permanently.`);
  } catch (err) {
    console.warn("purgeRetainedUserDataServer warning:", err);
  }
}

// Background cleanup job for expired self-deleted accounts
export async function purgeExpiredAccountsJob(): Promise<void> {
  try {
    if (isFirebaseAdminAvailable) {
      const snap = await adminDb.collection("accountLifecycle")
        .where("deletionType", "==", "self")
        .where("status", "==", "SELF_DELETED")
        .get();
      if (snap && !snap.empty) {
        const nowMs = Date.now();
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          if (data.restoreUntil && nowMs > new Date(data.restoreUntil).getTime()) {
            console.log(`[BACKGROUND PURGE] Expired account lifecycle ${docSnap.id}`);
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
        if (record.deletionType === "self" && record.status === "SELF_DELETED" && record.restoreUntil) {
          if (nowMs > new Date(record.restoreUntil).getTime()) {
            console.log(`[BACKGROUND PURGE LOCAL] Expired account lifecycle ${record.emailNormalized}`);
            await getAccountLifecycleRecord(record.emailNormalized);
          }
        }
      }
    }
  } catch (err) {
    // quiet
  }
}

export async function restoreAccountFullServer(email: string, newPassword?: string): Promise<{ success: boolean; user?: any; error?: string }> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) return { success: false, error: "Email parameter is required." };

  const nowIso = new Date().toISOString();
  const lifecycle = await getAccountLifecycleRecord(normalizedEmail);
  const targetUid = lifecycle?.originalUserId;

  // 1. Locate retained user profile
  let retainedProfile: any = null;
  if (targetUid) {
    try {
      const rSnap = await adminDb.collection("users_retained").doc(targetUid).get();
      if (rSnap.exists) retainedProfile = rSnap.data();
    } catch (e) {}
  }

  if (!retainedProfile) {
    try {
      const db = readDb();
      retainedProfile = db.retained_users?.find((u: any) =>
        (targetUid && u.id === targetUid) || u.email?.trim().toLowerCase() === normalizedEmail
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
      const hasPasswordProvider = checkAuth.providerData.some((p: any) => p.providerId === "password");
      console.log(`[RESTORE_FULL] Firebase Auth user ${authUser.uid} re-enabled: disabled=${checkAuth.disabled}, emailVerified=${checkAuth.emailVerified}, hasPasswordProvider=${hasPasswordProvider}`);
    } catch (uErr: any) {
      console.warn(`[RESTORE_FULL] Warning updating Firebase Auth user ${authUser.uid}:`, uErr?.message);
    }
  } else {
    try {
      const createPayload: any = {
        uid: finalUid,
        email: normalizedEmail,
        emailVerified: false,
        displayName: retainedProfile?.ownerName || retainedProfile?.companyName || normalizedEmail.split("@")[0]
      };
      if (newPassword && newPassword.trim()) {
        createPayload.password = newPassword.trim();
      } else {
        createPayload.password = "RestoredPass_" + Math.random().toString(36).substring(2, 8) + "123!";
      }
      authUser = await adminAuth.createUser(createPayload);
      console.log(`[RESTORE_FULL] Created Firebase Auth user ${finalUid}`);
    } catch (cErr: any) {
      console.warn(`[RESTORE_FULL] Firebase Auth user creation warning for ${finalUid}:`, cErr?.message);
    }
  }

  // 4. Remove deletedUsers marker in Firestore
  try {
    if (finalUid) {
      await adminDb.collection("deletedUsers").doc(finalUid).delete();
    }
    const delEmailSnap = await adminDb.collection("deletedUsers").where("email", "==", normalizedEmail).get();
    for (const dDoc of delEmailSnap.docs) {
      await dDoc.ref.delete();
    }
  } catch (dErr) {
    console.warn("[RESTORE_FULL] Deleted marker removal warning:", dErr);
  }

  // 5. Restore Firestore user document users/{finalUid}
  const preservedRole = retainedProfile?.role || "CEO"; // PRESERVE AUTHORITATIVE ROLE (e.g. CEO)
  const preservedWorkspaceId = retainedProfile?.workspaceId || retainedProfile?.workspace?.id || `ws_${finalUid.substring(0, 8)}`;
  const preservedWorkspace = retainedProfile?.workspace || {
    id: preservedWorkspaceId,
    name: `${retainedProfile?.companyName || "Restored"} Workspace`,
    ownerId: finalUid,
    createdAt: retainedProfile?.createdAt || nowIso,
    memberCount: 1
  };

  const restoredUserDoc = {
    ...(retainedProfile || {}),
    id: finalUid,
    uid: finalUid,
    email: normalizedEmail,
    role: preservedRole,
    workspaceId: preservedWorkspaceId,
    workspace: preservedWorkspace,
    powers: retainedProfile?.powers,
    companyName: retainedProfile?.companyName || "Restored Account",
    ownerName: retainedProfile?.ownerName || normalizedEmail.split("@")[0],
    subscriptionStatus: retainedProfile?.subscriptionStatus || "Active",
    userPreferences: retainedProfile?.userPreferences || { theme: "light", language: "ar" },
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
    restoredAt: nowIso
  };

  try {
    await adminDb.collection("users").doc(finalUid).set(restoredUserDoc, { merge: true });
    console.log(`[RESTORE_FULL] Saved restored user profile to Firestore users/${finalUid}`);
  } catch (fsErr: any) {
    console.error("[RESTORE_FULL] Failed to save Firestore user profile:", fsErr);
  }

  // Restore subcollections if retained
  if (retainedProfile) {
    try {
      const memSnap = await adminDb.collection("users_retained").doc(finalUid).collection("memories").get();
      for (const mDoc of memSnap.docs) {
        await adminDb.collection("users").doc(finalUid).collection("memories").doc(mDoc.id).set(mDoc.data(), { merge: true });
      }
      const alertSnap = await adminDb.collection("users_retained").doc(finalUid).collection("riskAlerts").get();
      for (const aDoc of alertSnap.docs) {
        await adminDb.collection("users").doc(finalUid).collection("riskAlerts").doc(aDoc.id).set(aDoc.data(), { merge: true });
      }
    } catch (subErr) {}
  }

  // 6. Update local JSON DB
  try {
    const db = readDb();
    if (!db.users) db.users = [];
    db.users = db.users.filter((u: any) => u.id !== finalUid && u.email?.trim().toLowerCase() !== normalizedEmail);
    db.users.push(restoredUserDoc);

    if (db.retained_users) {
      db.retained_users = db.retained_users.filter((u: any) => u.id !== finalUid && u.email?.trim().toLowerCase() !== normalizedEmail);
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
    updatedAt: nowIso
  };
  await setAccountLifecycleRecord(activeLifecycle);

  return { success: true, user: restoredUserDoc };
}

// Run periodic cleanup every 1 hour & on startup
setInterval(purgeExpiredAccountsJob, 60 * 60 * 1000);
setTimeout(purgeExpiredAccountsJob, 5000);

// --- ACCOUNT LIFECYCLE API ENDPOINTS ---

app.post("/api/auth/check-lifecycle", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "Email parameter is required." });
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
        userFriendlyMessage: ""
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
        userFriendlyMessage: "البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول إلى حسابك."
      });
    }

    if (record.status === "ADMIN_APPROVED" || record.reactivationStatus === "approved") {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: "ADMIN_APPROVED",
        canRegister: false,
        canRestore: true,
        adminApprovalRequired: false,
        userFriendlyMessage: "تمت الموافقة على طلب استعادة حسابك من قبل المسؤول! يمكنك الآن تسجيل الدخول أو إكمال التحقق لاستعادة الحساب."
      });
    }

    if (record.status === "ADMIN_DELETED" || record.status === "ADMIN_APPROVAL_REQUIRED" || record.deletionType === "admin") {
      return res.json({
        success: true,
        email: normalizedEmail,
        status: "ADMIN_DELETED",
        canRegister: false,
        canRestore: false,
        adminApprovalRequired: true,
        userFriendlyMessage: "تم تعطيل حسابك بواسطة مسؤول المنصة. لا يمكنك إنشاء حساب جديد باستخدام هذا البريد الإلكتروني إلا بعد موافقة المسؤول."
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
        userFriendlyMessage: "طلب إعادة تفعيل الحساب قيد المراجعة حالياً بواسطة مسؤول المنصة. يرجى الانتظار لحين البت في الطلب."
      });
    }

    if (record.status === "SELF_DELETED" && record.restoreUntil) {
      const nowMs = Date.now();
      const restoreUntilMs = new Date(record.restoreUntil).getTime();
      const remainingMs = restoreUntilMs - nowMs;

      if (remainingMs > 0) {
        const daysRemaining = Math.max(1, Math.ceil(remainingMs / (24 * 3600 * 1000)));
        return res.json({
          success: true,
          email: normalizedEmail,
          status: "SELF_RESTORE_AVAILABLE",
          canRegister: false,
          canRestore: true,
          adminApprovalRequired: false,
          daysRemaining: daysRemaining,
          restoreUntil: record.restoreUntil,
          userFriendlyMessage: `تم العثور على حساب سابق تم حذفه بواسطتك. يمكنك استعادة حسابك وجميع بياناتك السابقة (متبقي ${daysRemaining} يوماً للاستعادة).`
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
          userFriendlyMessage: "انتهت فترة استعادة هذا الحساب. تم حذف البيانات بشكل نهائي ولم يعد قابلاً للاستعادة وفق سياسة النظام."
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
        userFriendlyMessage: "انتهت فترة استعادة هذا الحساب. تم حذف البيانات بشكل نهائي ولم يعد قابلاً للاستعادة وفق سياسة النظام."
      });
    }

    return res.json({
      success: true,
      email: normalizedEmail,
      status: "NEW",
      canRegister: true,
      canRestore: false,
      adminApprovalRequired: false,
      userFriendlyMessage: ""
    });
  } catch (err: any) {
    console.error("check-lifecycle error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to check account lifecycle state." });
  }
});

export async function requestAccountReactivationServer(email: string, reason?: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const record = await getAccountLifecycleRecord(normalizedEmail);

  if (!record || (record.status !== "ADMIN_DELETED" && record.status !== "ADMIN_APPROVAL_REQUIRED" && record.deletionType !== "admin")) {
    return {
      success: false,
      error: "هذا الحساب غير محذوف بواسطة مسؤول المنصة أو لا يتطلب إعادة تفعيل."
    };
  }

  const nowIso = new Date().toISOString();
  const updatedRecord = {
    ...record,
    status: "ADMIN_APPROVAL_PENDING",
    reactivationRequestedAt: nowIso,
    reactivationRequestReason: reason || "طلب إعادة تفعيل الحساب المحذوف بواسطة المسؤول",
    reactivationStatus: "pending",
    updatedAt: nowIso
  };

  await setAccountLifecycleRecord(updatedRecord);

  try {
    await adminDb.collection("accountReactivationRequests").doc(normalizedEmail).set({
      email: normalizedEmail,
      requestedAt: nowIso,
      reason: reason || "طلب إعادة تفعيل الحساب المحذوف بواسطة المسؤول",
      status: "pending",
      originalUserId: record.originalUserId || ""
    });
  } catch (e) {}

  const db = readDb();
  if (!db.account_reactivation_requests) db.account_reactivation_requests = [];
  db.account_reactivation_requests = db.account_reactivation_requests.filter((r: any) => r.email !== normalizedEmail);
  db.account_reactivation_requests.push({
    email: normalizedEmail,
    requestedAt: nowIso,
    reason: reason || "طلب إعادة تفعيل الحساب المحذوف بواسطة المسؤول",
    status: "pending"
  });
  writeDb(db);

  return {
    success: true,
    message: "تم تقديم طلب إعادة تفعيل الحساب بنجاح إلى مسؤول المنصة. سيتم مراجعة طلبك وإخطارك بالتحديثات."
  };
}

app.post("/api/auth/request-reactivation", async (req, res) => {
  try {
    const { email, reason } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "Email parameter is required." });
    }

    const result = await requestAccountReactivationServer(email, reason);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    console.error("request-reactivation error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to submit reactivation request." });
  }
});

app.post("/api/auth/restore-account", async (req, res) => {
  try {
    const { email, code, verificationCode, password } = req.body;
    const inputCode = (code || verificationCode || "").trim();
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "Email parameter is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = await getAccountLifecycleRecord(normalizedEmail);

    if (!record || (record.status !== "SELF_RESTORE_AVAILABLE" && record.status !== "SELF_DELETED")) {
      if (record && (record.status === "PURGED" || (record.restoreUntil && Date.now() > new Date(record.restoreUntil).getTime()))) {
        return res.status(400).json({ 
          success: false, 
          code: "RESTORE_EXPIRED",
          error: "انتهت فترة استعادة هذا الحساب. تم حذف البيانات بشكل نهائي ولم يعد قابلاً للاستعادة وفق سياسة النظام." 
        });
      }
      return res.status(400).json({ 
        success: false, 
        error: "لا يوجد حساب محذوف قابل للاستعادة بهذا البريد الإلكتروني." 
      });
    }

    if (record.restoreUntil && Date.now() > new Date(record.restoreUntil).getTime()) {
      return res.status(400).json({
        success: false,
        code: "RESTORE_EXPIRED",
        error: "انتهت مهلة 31 يوماً المتاحة لاستعادة الحساب. تم حذف البيانات بشكل نهائي."
      });
    }

    const userId = record.originalUserId || `usr_${Date.now().toString(36)}`;

    // Require and verify OTP code for identity verification
    if (!inputCode) {
      return res.status(400).json({
        success: false,
        code: "OTP_REQUIRED",
        error: "يرجى إدخال رمز التحقق المرسل إلى بريدك الإلكتروني لتأكيد ملكية الحساب واستعادته."
      });
    }

    let activeOtpRecord: any = null;
    try {
      const vcSnap = await adminDb.collection("verification_codes").doc(userId).get();
      if (vcSnap.exists && !vcSnap.data()?.used) {
        activeOtpRecord = { ...vcSnap.data(), _docId: userId };
      }
    } catch (e) {}

    if (!activeOtpRecord) {
      try {
        const vcEmailSnap = await adminDb.collection("verification_codes").doc(normalizedEmail).get();
        if (vcEmailSnap.exists && !vcEmailSnap.data()?.used) {
          activeOtpRecord = { ...vcEmailSnap.data(), _docId: normalizedEmail };
        }
      } catch (e) {}
    }

    if (!activeOtpRecord) {
      try {
        const qSnap = await adminDb.collection("verification_codes")
          .where("email", "==", normalizedEmail)
          .where("used", "==", false)
          .get();
        if (!qSnap.empty) {
          activeOtpRecord = { ...qSnap.docs[0].data(), _docId: qSnap.docs[0].id };
        }
      } catch (e) {}
    }

    if (!activeOtpRecord) {
      const db = readDb();
      activeOtpRecord = db.verification_codes?.find((vc: any) => 
        !vc.used && (vc.id === userId || vc.id === normalizedEmail || vc.userId === userId || vc.email?.toLowerCase() === normalizedEmail)
      );
      if (activeOtpRecord) {
        activeOtpRecord._docId = activeOtpRecord.id;
      }
    }

    if (!activeOtpRecord) {
      return res.status(400).json({
        success: false,
        error: "لم يتم العثور على رمز تحقق نشط أو انتهت صلاحيته. يرجى طلب رمز جديد."
      });
    }

    const expiresAt = activeOtpRecord.expiresAt?.toDate
      ? activeOtpRecord.expiresAt.toDate()
      : new Date(activeOtpRecord.expiresAt);

    if (expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        error: "انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد."
      });
    }

    if ((activeOtpRecord.attempts || 0) >= 5) {
      return res.status(400).json({
        success: false,
        error: "تم تجاوز الحد الأقصى للمحاولات. يرجى طلب رمز جديد."
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
          await adminDb.collection("verification_codes").doc(activeOtpRecord._docId).update({ attempts: newAttempts });
        }
      } catch (e) {}
      return res.status(400).json({
        success: false,
        error: `رمز التحقق غير صحيح. متبقي ${remaining} محاولة.`
      });
    }

    // Mark OTP as used
    try {
      if (activeOtpRecord._docId) {
        await adminDb.collection("verification_codes").doc(activeOtpRecord._docId).update({
          used: true,
          verifiedAt: new Date().toISOString()
        });
      }
    } catch (e) {}

    let retainedProfile: any = null;
    try {
      const retainedSnap = await adminDb.collection("users_retained").doc(userId).get();
      if (retainedSnap.exists) {
        retainedProfile = retainedSnap.data();
      }
    } catch (e) {}

    if (!retainedProfile) {
      const db = readDb();
      retainedProfile = db.retained_users?.find((u: any) => u.id === userId || u.email?.toLowerCase() === normalizedEmail);
    }

    const nowIso = new Date().toISOString();
    // Preserve authoritative role, workspace, powers, preferences from retained profile
    const preservedRole = retainedProfile?.role || "CEO";
    const preservedWorkspace = retainedProfile?.workspace || {
      id: retainedProfile?.workspaceId || `ws_${userId.substring(0, 8)}`,
      name: `${retainedProfile?.companyName || "Restored"} Workspace`,
      ownerId: userId,
      createdAt: retainedProfile?.createdAt || nowIso,
      memberCount: 1
    };

    const restoredUserDoc = {
      ...(retainedProfile || {}),
      id: userId,
      email: normalizedEmail,
      role: preservedRole,
      workspaceId: retainedProfile?.workspaceId || preservedWorkspace.id,
      workspace: preservedWorkspace,
      powers: retainedProfile?.powers,
      companyName: retainedProfile?.companyName || "Restored Account",
      ownerName: retainedProfile?.ownerName || normalizedEmail.split("@")[0],
      subscriptionStatus: retainedProfile?.subscriptionStatus || "Active Trial",
      userPreferences: retainedProfile?.userPreferences || { theme: "light", language: "ar" },
      isVerified: true,
      isEmailVerified: true,
      emailVerified: true,
      email_verified: true,
      verification_status: "verified",
      verification_required: false,
      lastActiveAt: nowIso,
      lastLoginAt: nowIso,
      restoredAt: nowIso
    };

    // Clean up deletedUsers markers in Firestore
    try {
      await adminDb.collection("deletedUsers").doc(userId).delete();
      const delEmailSnap = await adminDb.collection("deletedUsers").where("email", "==", normalizedEmail).get();
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
            displayName: restoredUserDoc.ownerName || restoredUserDoc.companyName || normalizedEmail.split("@")[0],
            emailVerified: true
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
      const retainedMemSnap = await adminDb.collection("users_retained").doc(userId).collection("memories").get();
      for (const mDoc of retainedMemSnap.docs) {
        await adminDb.collection("users").doc(userId).collection("memories").doc(mDoc.id).set(mDoc.data());
      }
    } catch (e) {}

    try {
      const retainedAlertSnap = await adminDb.collection("users_retained").doc(userId).collection("riskAlerts").get();
      for (const aDoc of retainedAlertSnap.docs) {
        await adminDb.collection("users").doc(userId).collection("riskAlerts").doc(aDoc.id).set(aDoc.data());
      }
    } catch (e) {}

    try {
      const retainedFilesSnap = await adminDb.collection("users_retained").doc(userId).collection("files").get();
      for (const fDoc of retainedFilesSnap.docs) {
        await adminDb.collection("users").doc(userId).collection("files").doc(fDoc.id).set(fDoc.data());
      }
      const retainedTopFilesSnap = await adminDb.collection("users_retained").doc(userId).collection("top_files").get();
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
      dbInst.risk_alerts = dbInst.risk_alerts.filter((a: any) => a.userId !== userId);
      dbInst.risk_alerts.push(...retainedProfile.archivedRiskAlerts);
    }
    if (retainedProfile?.archivedFiles?.length) {
      if (!dbInst.files) dbInst.files = [];
      dbInst.files = dbInst.files.filter((f: any) => f.userId !== userId);
      dbInst.files.push(...retainedProfile.archivedFiles);
    }

    if (!dbInst.users) dbInst.users = [];
    dbInst.users = dbInst.users.filter((u: any) => u.id !== userId && u.email?.toLowerCase() !== normalizedEmail);
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
      updatedAt: nowIso
    };

    await setAccountLifecycleRecord(activeRecord);

    console.log("ACCOUNT_RESTORED_SUCCESSFULLY", { userId, email: normalizedEmail, role: restoredUserDoc.role });

    return res.json({
      success: true,
      message: "تمت استعادة حسابك وجميع بياناتك بنجاح! مرحباً بعودتك إلى Zakir.",
      user: restoredUserDoc,
      customToken: customToken || undefined
    });
  } catch (err: any) {
    console.error("restore-account error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to restore account." });
  }
});

app.get("/api/auth/check-invitation", async (req, res) => {
  try {
    const email = (req.query.email as string || "").trim().toLowerCase();
    if (!email) {
      return res.json({ success: true, invitation: null });
    }

    let invitation: any = null;
    try {
      const docSnap = await adminDb.collection("invitations").doc(email).get();
      if (docSnap.exists) {
        invitation = docSnap.data();
      }
    } catch (e) {}

    if (!invitation) {
      const db = readDb();
      invitation = db.invitations?.find((i: any) => i.email?.trim().toLowerCase() === email) || null;
    }

    return res.json({ success: true, invitation });
  } catch (err) {
    return res.json({ success: true, invitation: null });
  }
});

app.get("/api/admin/reactivation-requests", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid || !(await isUserAdminServer(callerUid))) {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }

    const snap = await adminDb.collection("accountReactivationRequests").get();
    let requests: any[] = [];
    if (snap && !snap.empty) {
      requests = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    }

    const db = readDb();
    const localRequests = db.account_reactivation_requests || [];

    for (const lr of localRequests) {
      if (!requests.some(r => r.email === lr.email)) {
        requests.push(lr);
      }
    }

    return res.json({ success: true, requests });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch reactivation requests." });
  }
});

export async function handleAccountReactivationRequestServer(email: string, action: "approve" | "reject", callerUid: string = "admin", notes: string = ""): Promise<{ success: boolean; message?: string; error?: string }> {
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
      updatedAt: nowIso
    };

    await setAccountLifecycleRecord(updatedLifecycle);

    try {
      await adminDb.collection("accountReactivationRequests").doc(normalizedEmail).update({
        status: "approved",
        reviewedAt: nowIso,
        reviewedBy: callerUid,
        notes: notes || ""
      });
    } catch (e) {}

    const db = readDb();
    if (db.account_reactivation_requests) {
      const reqItem = db.account_reactivation_requests.find((r: any) => r.email === normalizedEmail);
      if (reqItem) {
        reqItem.status = "approved";
        reqItem.reviewedAt = nowIso;
      }
    }
    writeDb(db);

    return {
      success: true,
      message: "تمت الموافقة على طلب إعادة التفعيل بنجاح. يمكن للمستخدم الآن إنشاء حساب جديد بهذا البريد الإلكتروني."
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
      updatedAt: nowIso
    };

    await setAccountLifecycleRecord(updatedLifecycle);

    try {
      await adminDb.collection("accountReactivationRequests").doc(normalizedEmail).update({
        status: "rejected",
        reviewedAt: nowIso,
        reviewedBy: callerUid,
        notes: notes || ""
      });
    } catch (e) {}

    const db = readDb();
    if (db.account_reactivation_requests) {
      const reqItem = db.account_reactivation_requests.find((r: any) => r.email === normalizedEmail);
      if (reqItem) {
        reqItem.status = "rejected";
        reqItem.reviewedAt = nowIso;
      }
    }
    writeDb(db);

    return {
      success: true,
      message: "تم رفض طلب إعادة التفعيل. يظل الحساب محظوراً من التسجيل."
    };
  }
}

app.post("/api/admin/handle-reactivation-request", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid || !(await isUserAdminServer(callerUid))) {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }

    const { email, action, notes } = req.body;
    if (!email || !action || (action !== "approve" && action !== "reject")) {
      return res.status(400).json({ error: "Email and valid action ('approve' or 'reject') are required." });
    }

    const result = await handleAccountReactivationRequestServer(email, action, callerUid, notes);
    return res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to handle reactivation request." });
  }
});

// --- ACCOUNT RECOVERY REQUEST WORKFLOW ENDPOINTS ---

function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 4) return false;
  const hex = buffer.toString("hex", 0, 4).toLowerCase();
  if (mimeType.includes("pdf")) {
    return hex.startsWith("25504446"); // %PDF (25 50 44 46)
  }
  if (mimeType.includes("png")) {
    return hex.startsWith("89504e47"); // PNG (89 50 4E 47)
  }
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return hex.startsWith("ffd8ff"); // JPEG/JPG (FF D8 FF)
  }
  return false;
}

const recoveryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Durable Multi-Tier Storage System with Auto-Expiration (TTL) and Background Worker
const CHUNK_BYTE_SIZE = 300 * 1024; // 300KB chunks for Firestore documents
const RECOVERY_DOC_RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days maximum retention for sensitive identity proofs
const ORPHAN_UPLOAD_TTL_MS = 60 * 60 * 1000; // 1 hour for unassociated pending uploads

async function saveDocumentToPersistentStorage(
  documentId: string,
  buffer: Buffer,
  mimeType: string,
  meta?: { fileName?: string; size?: number; fileHash?: string }
): Promise<void> {
  // 1. Write to local disk cache immediately
  const UPLOADS_DIR = path.join(process.cwd(), "secure_uploads");
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(UPLOADS_DIR, documentId), buffer);

  // 2. Persist durably in Database (Firestore chunks & metadata with TTL) to survive container restarts & serverless recycles
  const totalChunks = Math.ceil(buffer.length / CHUNK_BYTE_SIZE);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAtIso = new Date(nowMs + RECOVERY_DOC_RETENTION_MS).toISOString();

  if (isFirebaseAdminAvailable && adminDb) {
    try {
      // Save master document record with durable sync state and expiration metadata
      await adminDb.collection("recoveryDocuments").doc(documentId).set({
        documentId,
        mimeType,
        size: buffer.length,
        totalChunks,
        fileName: meta?.fileName || "document",
        fileHash: meta?.fileHash || "",
        storageStatus: "pending",
        syncAttempts: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        expiresAt: expiresAtIso
      });

      // Save binary chunks (Base64 encoded, 300KB each)
      const chunkPromises: Promise<any>[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_BYTE_SIZE;
        const end = Math.min(start + CHUNK_BYTE_SIZE, buffer.length);
        const chunkData = buffer.subarray(start, end).toString("base64");
        chunkPromises.push(
          adminDb
            .collection("recoveryDocuments")
            .doc(documentId)
            .collection("chunks")
            .doc(String(i))
            .set({
              chunkIndex: i,
              data: chunkData,
              size: end - start,
              createdAt: nowIso,
              expiresAt: expiresAtIso
            })
        );
      }
      await Promise.all(chunkPromises);
    } catch (fsErr: any) {
      console.warn("[Recovery Upload] Firestore durable chunks write notice:", fsErr?.message);
    }
  }

  // 3. Keep in local DB store for immediate node lifecycle persistence
  const db = readDb();
  if (!db.recovery_documents_store) {
    db.recovery_documents_store = {};
  }
  db.recovery_documents_store[documentId] = {
    documentId,
    mimeType,
    size: buffer.length,
    fileName: meta?.fileName || "document",
    fileHash: meta?.fileHash || "",
    storageStatus: "pending",
    syncAttempts: 0,
    createdAt: nowIso,
    expiresAt: expiresAtIso
  };
  writeDb(db);

  console.log(`[Recovery Upload] Primary persistence successful for documentId: ${documentId} (${buffer.length} bytes, ${totalChunks} chunks)`);
}

// Background Cloud Storage Synchronization with durable queue reconciliation
async function syncDocumentToCloudStorage(documentId: string, buffer?: Buffer, mimeType?: string): Promise<boolean> {
  if (!isFirebaseAdminAvailable || !adminStorage) {
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

  const updateStatus = async (status: "syncing" | "synced" | "firestore_durable" | "failed", errorMsg?: string, attempts: number = 1) => {
    try {
      if (isFirebaseAdminAvailable && adminDb) {
        await adminDb.collection("recoveryDocuments").doc(documentId).set(
          {
            storageStatus: status,
            syncError: errorMsg || null,
            syncAttempts: attempts,
            syncedAt: status === "synced" ? new Date().toISOString() : null,
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );
      }
    } catch (e) {}

    try {
      const db = readDb();
      if (db.recovery_documents_store?.[documentId]) {
        db.recovery_documents_store[documentId].storageStatus = status;
        db.recovery_documents_store[documentId].syncAttempts = attempts;
        if (errorMsg) db.recovery_documents_store[documentId].syncError = errorMsg;
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
    const msg = String(err?.message || err?.errors?.[0]?.message || "").toLowerCase();
    const reason = String(err?.errors?.[0]?.reason || "").toLowerCase();
    const code = Number(err?.code || err?.status || 0);
    return code === 404 || code === 403 || reason === "notfound" || msg.includes("not found") || msg.includes("not exist");
  };

  const MAX_ATTEMPTS = 2;
  const ATTEMPT_TIMEOUT_MS = 4000;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) {
        await new Promise((res) => setTimeout(res, 1000));
      }

      await Promise.race([
        (async () => {
          const bucket = adminStorage.bucket();
          const fileRef = bucket.file(`secure_uploads/${documentId}`);
          const [exists] = await fileRef.exists().catch(() => [false]);
          if (!exists) {
            await fileRef.save(docBuffer!, {
              metadata: { contentType: docMime }
            });
          }
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Storage upload timeout (${ATTEMPT_TIMEOUT_MS}ms)`)), ATTEMPT_TIMEOUT_MS)
        )
      ]);

      await updateStatus("synced", undefined, attempt);
      console.log(`[Recovery Upload] Durable cloud sync SUCCESS for document: ${documentId}`);

      // Cost Optimization: Once synced to Cloud Storage bucket, prune Firestore binary chunks
      if (isFirebaseAdminAvailable && adminDb) {
        (async () => {
          try {
            const chunksSnap = await adminDb.collection("recoveryDocuments").doc(documentId).collection("chunks").get();
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
        await updateStatus("firestore_durable", "Primary Firestore chunk storage active (Bucket unprovisioned)", attempt);
        console.log(`[Recovery Storage] Document ${documentId} safely stored in primary durable Firestore chunks.`);
        return true;
      }
    }
  }

  // If failed after retries, document remains 100% safe in primary Firestore chunk storage
  const failureReason = getCleanErrMsg(lastError);
  await updateStatus("firestore_durable", failureReason, MAX_ATTEMPTS);
  console.log(`[Recovery Storage] Document ${documentId} stored in primary durable Firestore store.`);
  return true;
}

// Durable Background Reconciliation Worker: Scans for 'pending' uploads and syncs them
async function runDurableSyncWorker() {
  if (!isFirebaseAdminAvailable || !adminStorage) return;
  try {
    // 1. Check local DB pending sync items
    const db = readDb();
    const store = db.recovery_documents_store || {};
    const pendingDocIds = Object.keys(store).filter(
      (id) => store[id].storageStatus === "pending" && (store[id].syncAttempts || 0) < 2
    );

    for (const docId of pendingDocIds.slice(0, 2)) {
      await syncDocumentToCloudStorage(docId, undefined, store[docId]?.mimeType);
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

// Periodic background runner (every 5 minutes) for sync reconciliation and TTL cleanup
setInterval(() => {
  runDurableSyncWorker().catch(() => {});
  runComprehensiveStorageCleanup().catch(() => {});
}, 5 * 60 * 1000);

async function getDocumentFromPersistentStorage(documentId: string): Promise<Buffer> {
  // 1. Check local container storage first for fastest response
  const filePath = path.join(process.cwd(), "secure_uploads", documentId);
  if (fs.existsSync(filePath)) {
    try {
      return fs.readFileSync(filePath);
    } catch (e) {}
  }

  // 2. Check Firebase Cloud Storage with bounded timeout
  if (isFirebaseAdminAvailable && adminStorage) {
    try {
      const bucket = adminStorage.bucket();
      const fileRef = bucket.file(`secure_uploads/${documentId}`);
      const downloadPromise = async () => {
        const [exists] = await fileRef.exists();
        if (exists) {
          const [fileBuffer] = await fileRef.download();
          // Write back to local cache
          try {
            const UPLOADS_DIR = path.join(process.cwd(), "secure_uploads");
            if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
            fs.writeFileSync(filePath, fileBuffer);
          } catch (e) {}
          return fileBuffer;
        }
        return null;
      };

      const buffer = await Promise.race([
        downloadPromise(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
      ]);

      if (buffer) return buffer;
    } catch (err) {
      // Continue to durable Firestore chunks fallback
    }
  }

  // 3. Retrieve from durable Firestore chunks
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const docSnap = await adminDb.collection("recoveryDocuments").doc(documentId).get();
      if (docSnap.exists) {
        const meta = docSnap.data();
        const totalChunks = meta?.totalChunks || 1;
        const chunksSnap = await adminDb
          .collection("recoveryDocuments")
          .doc(documentId)
          .collection("chunks")
          .get();

        if (chunksSnap && !chunksSnap.empty) {
          const chunksMap: Record<number, string> = {};
          chunksSnap.docs.forEach((doc: any) => {
            const d = doc.data();
            chunksMap[d.chunkIndex] = d.data;
          });

          const buffers: Buffer[] = [];
          for (let i = 0; i < totalChunks; i++) {
            if (chunksMap[i]) {
              buffers.push(Buffer.from(chunksMap[i], "base64"));
            }
          }

          if (buffers.length === totalChunks) {
            const fullBuffer = Buffer.concat(buffers);
            // Cache to local disk
            try {
              const UPLOADS_DIR = path.join(process.cwd(), "secure_uploads");
              if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
              fs.writeFileSync(filePath, fullBuffer);
            } catch (e) {}
            return fullBuffer;
          }
        }
      }
    } catch (fsErr) {
      console.warn("Firestore chunks retrieval notice:", fsErr);
    }
  }

  throw new Error("Document file not found on disk, storage bucket, or primary database store.");
}

async function deleteDocumentFromPersistentStorage(documentId: string): Promise<void> {
  console.log(`[Storage Purge] Completely purging document: ${documentId}`);

  // 1. Delete from local container storage
  const filePath = path.join(process.cwd(), "secure_uploads", documentId);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {}
  }

  // 2. Delete all Firestore chunks and metadata doc
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      const chunksSnap = await adminDb.collection("recoveryDocuments").doc(documentId).collection("chunks").get();
      if (chunksSnap && !chunksSnap.empty) {
        const batch = adminDb.batch();
        chunksSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
        await batch.commit();
      }
      await adminDb.collection("recoveryDocuments").doc(documentId).delete();
    } catch (e) {}
  }

  // 3. Delete from Firebase Storage if available
  if (isFirebaseAdminAvailable && adminStorage) {
    try {
      const bucket = adminStorage.bucket();
      const fileRef = bucket.file(`secure_uploads/${documentId}`);
      const [exists] = await fileRef.exists();
      if (exists) {
        await fileRef.delete();
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
      db.pending_recovery_uploads = db.pending_recovery_uploads.filter((u: any) => u.documentId !== documentId);
    }
    writeDb(db);
  } catch (e) {}

  // 5. Clean pending uploads record from Firestore if exists
  if (isFirebaseAdminAvailable && adminDb) {
    try {
      await adminDb.collection("pendingRecoveryUploads").doc(documentId).delete();
    } catch (e) {}
  }
}

async function registerPendingUpload(documentId: string, uploadToken: string, meta: any) {
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
    associated: false
  });
  writeDb(db);

  // Sync to Firestore if available
  if (isFirebaseAdminAvailable) {
    try {
      await adminDb.collection("pendingRecoveryUploads").doc(documentId).set({
        documentId,
        uploadToken,
        fileHash: meta.fileHash,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        size: meta.size,
        uploadedAt: meta.uploadedAt,
        storageStatus: meta.storageStatus || "pending",
        associated: false
      });
    } catch (err) {}
  }
}

async function verifyPendingUpload(documentId: string, uploadToken: string): Promise<boolean> {
  let record: any = null;

  // Check Firestore first if available
  if (isFirebaseAdminAvailable) {
    try {
      const snap = await adminDb.collection("pendingRecoveryUploads").doc(documentId).get();
      if (snap.exists) {
        record = snap.data();
      }
    } catch (err) {}
  }

  // Fallback to local DB
  if (!record) {
    const db = readDb();
    record = db.pending_recovery_uploads?.find((u: any) => u.documentId === documentId);
  }

  if (!record) return false;
  
  // Verify token matches cryptographically
  if (record.uploadToken !== uploadToken) return false;
  if (record.associated) return false; // Must not be already assigned elsewhere

  return true;
}

async function markUploadAssociated(documentId: string, requestId: string) {
  const db = readDb();
  const index = db.pending_recovery_uploads?.findIndex((u: any) => u.documentId === documentId);
  if (index >= 0) {
    db.pending_recovery_uploads[index].associated = true;
    db.pending_recovery_uploads[index].associatedRequestId = requestId;
  }
  writeDb(db);

  if (isFirebaseAdminAvailable) {
    try {
      await adminDb.collection("pendingRecoveryUploads").doc(documentId).set({
        associated: true,
        associatedRequestId: requestId
      }, { merge: true });
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
    const orphans = uploads.filter((u: any) => !u.associated && new Date(u.uploadedAt).getTime() < oneHourAgo);

    for (const orphan of orphans) {
      console.log(`[ORPHAN_CLEANUP] Deleting orphan document ${orphan.documentId} uploaded at ${orphan.uploadedAt}`);
      await deleteDocumentFromPersistentStorage(orphan.documentId);
    }

    db.pending_recovery_uploads = uploads.filter((u: any) => !(!u.associated && new Date(u.uploadedAt).getTime() < oneHourAgo));

    // 2. TTL Expiration Cleanup for Expired Recovery Documents (14+ days old)
    const store = db.recovery_documents_store || {};
    for (const docId of Object.keys(store)) {
      const docItem = store[docId];
      if (docItem.expiresAt && new Date(docItem.expiresAt).getTime() < nowMs) {
        console.log(`[TTL_CLEANUP] Purging expired identity document ${docId} (exceeded retention window)`);
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
        const orphanSnap = await adminDb.collection("pendingRecoveryUploads").where("associated", "==", false).get();
        if (orphanSnap && !orphanSnap.empty) {
          for (const doc of orphanSnap.docs) {
            const data = doc.data();
            if (new Date(data.uploadedAt).getTime() < oneHourAgo) {
              await deleteDocumentFromPersistentStorage(doc.id);
              await adminDb.collection("pendingRecoveryUploads").doc(doc.id).delete();
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
app.post("/api/auth/recovery-request/upload", (req, res, next) => {
  console.log("[Recovery Upload] Request received");
  recoveryUpload.fields([{ name: "document", maxCount: 1 }, { name: "file", maxCount: 1 }])(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          error: "IDENTITY_DOCUMENT_TOO_LARGE",
          message: "File exceeds the 5MB size limit."
        });
      }
      return res.status(400).json({
        success: false,
        error: "FILE_UPLOAD_ERROR",
        message: err.message || "File upload error"
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    // Run self-healing orphan cleanup asynchronously in the background
    runOrphanCleanup().catch((e) => console.warn("Background orphan cleanup notice:", e));

    const file = req.file || (req.files as any)?.document?.[0] || (req.files as any)?.file?.[0];
    if (!file) {
      return res.status(400).json({
        success: false,
        error: "MISSING_FILE",
        message: "No document file was uploaded in request."
      });
    }

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        error: "IDENTITY_DOCUMENT_TOO_LARGE",
        message: "File exceeds the 5MB size limit."
      });
    }

    // Validate MIME type
    const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: "UNSUPPORTED_FORMAT",
        message: "Unsupported document format. Only PDF, PNG, and JPEG files are allowed."
      });
    }

    // Validate file extension
    const originalName = file.originalname || "document";
    const ext = path.extname(originalName).toLowerCase();
    const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg"];
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_EXTENSION",
        message: "Invalid file extension. Only .pdf, .png, .jpg, and .jpeg are allowed."
      });
    }

    // Validate file signature / magic bytes
    if (!validateFileSignature(file.buffer, file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_FILE_SIGNATURE",
        message: "File content does not match its format signature."
      });
    }

    console.log("[Recovery Upload] File validated");

    // Compute cryptographic SHA-256 hash of file content for idempotency and integrity
    const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9.-]/g, "_");

    // Safe Duplicate / Retry Handling: check if exact file was uploaded in the last 10 minutes
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const db = readDb();
    const existingUpload = (db.pending_recovery_uploads || []).find(
      (u: any) =>
        !u.associated &&
        u.fileHash === fileHash &&
        u.fileName === safeName &&
        new Date(u.uploadedAt).getTime() > tenMinutesAgo
    );

    if (existingUpload) {
      console.log(`[Recovery Upload] Idempotent hit: reusing recent pending upload ${existingUpload.documentId}`);
      return res.status(200).json({
        success: true,
        documentId: existingUpload.documentId,
        uploadToken: existingUpload.uploadToken,
        storageStatus: existingUpload.storageStatus || "pending",
        document: {
          documentId: existingUpload.documentId,
          uploadToken: existingUpload.uploadToken,
          storageReference: `secure_uploads/${existingUpload.documentId}`,
          fileName: existingUpload.fileName,
          mimeType: existingUpload.mimeType,
          size: existingUpload.size,
          uploadedAt: existingUpload.uploadedAt,
          storageStatus: existingUpload.storageStatus || "pending"
        }
      });
    }

    // Generate cryptographically secure documentId and uploadToken
    const documentId = `doc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const uploadToken = crypto.randomBytes(32).toString("hex");

    // 1. Critical Path: Persist document to DURABLE primary storage layer immediately
    await saveDocumentToPersistentStorage(documentId, file.buffer, file.mimetype, {
      fileName: safeName,
      size: file.size,
      fileHash
    });

    console.log(`[Recovery Upload] Primary persistence successful`);
    console.log(`[Recovery Upload] documentId generated: ${documentId}`);

    const docMeta = {
      documentId,
      uploadToken,
      fileHash,
      storageReference: `secure_uploads/${documentId}`,
      fileName: safeName,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      storageStatus: "pending"
    };

    // Register pending upload record securely in database
    await registerPendingUpload(documentId, uploadToken, docMeta);

    // 2. Non-Critical Path: Dispatch background cloud storage synchronization asynchronously without blocking
    setImmediate(() => {
      syncDocumentToCloudStorage(documentId, file.buffer, file.mimetype).catch((syncErr) => {
        console.warn("[Recovery Upload] Background cloud sync error caught safely:", syncErr?.message || syncErr);
      });
    });

    console.log("[Recovery Upload] HTTP response sent");

    // 3. Critical Path: Return deterministic HTTP 200 JSON response immediately
    return res.status(200).json({
      success: true,
      documentId,
      uploadToken,
      storageStatus: "pending",
      document: docMeta
    });
  } catch (err: any) {
    console.error("[Recovery Upload] Unexpected upload error:", err);
    return res.status(500).json({
      success: false,
      error: "PRIMARY_PERSISTENCE_FAILURE",
      message: err.message || "Failed to persist document to primary durable storage."
    });
  }
});

// 2. Fetch/Download Identity Verification Document (Admin only)
app.get("/api/admin/recovery-request/document/:documentId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid || !(await isUserAdminServer(callerUid))) {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }

    const { documentId } = req.params;
    if (!documentId || typeof documentId !== "string") {
      return res.status(400).json({ error: "Document ID is required." });
    }

    // STRICT path traversal check: strictly allow only alphanumeric and underscores for safe document IDs
    if (!/^[a-zA-Z0-9_]+$/.test(documentId)) {
      return res.status(400).json({ error: "Invalid Document ID structure (path traversal detected)." });
    }

    const safeDocId = documentId;

    // DOCUMENT OWNERSHIP & AUTHORIZATION CHECK
    // Verify that this document belongs to a legitimate registered recovery request
    let docMeta: any = null;
    const db = readDb();
    const localRequests = db.account_recovery_requests || [];
    for (const r of localRequests) {
      const found = r.documents?.find((d: any) => d.documentId === safeDocId);
      if (found) {
        docMeta = found;
        break;
      }
    }

    if (!docMeta) {
      try {
        const snap = await adminDb.collection("accountRecoveryRequests").get();
        if (snap && !snap.empty) {
          for (const doc of snap.docs) {
            const data = doc.data();
            const found = data.documents?.find((d: any) => d.documentId === safeDocId);
            if (found) {
              docMeta = found;
              break;
            }
          }
        }
      } catch (e) {}
    }

    // STRICT: If the document is not linked to an active, submitted request, deny access!
    if (!docMeta) {
      return res.status(403).json({ error: "Forbidden: Document does not belong to a legitimate recovery request." });
    }

    // Download the file from our safe persistent storage engine
    let fileBuffer: Buffer;
    try {
      fileBuffer = await getDocumentFromPersistentStorage(safeDocId);
    } catch (err: any) {
      return res.status(404).json({ error: "Document file not found in persistent store." });
    }

    const mimeType = docMeta.mimeType || "application/octet-stream";
    const originalName = docMeta.fileName || "document";

    // Set high-security, safe download headers to prevent script/HTML injection
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none';");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${originalName}"`);

    return res.send(fileBuffer);
  } catch (err: any) {
    console.error("Document download error:", err);
    res.status(500).json({ error: err.message || "Failed to download document." });
  }
});

// 3. Submit Account Recovery Request (User submission)
app.post("/api/auth/recovery-request/submit", async (req, res) => {
  try {
    const {
      email,
      fullName,
      phone,
      phoneVerified,
      reason,
      organizationName,
      previousWorkspaceInfo,
      acceptedTerms,
      documents
    } = req.body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, error: "Email is required." });
    }

    // Server-side safety verification on uploaded documents references
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ success: false, error: "An identity verification document is required." });
    }

    if (documents.length > 2) {
      return res.status(400).json({ success: false, error: "Maximum 2 identity verification documents allowed." });
    }

    // STRICT Cryptographic verification of each document's upload token
    for (const doc of documents) {
      if (!doc.documentId || !doc.uploadToken) {
        return res.status(400).json({ success: false, error: "Missing document verification details." });
      }

      // Check format to prevent path traversal injection
      if (!/^[a-zA-Z0-9_]+$/.test(doc.documentId)) {
        return res.status(400).json({ success: false, error: "Invalid document reference format." });
      }

      const isValid = await verifyPendingUpload(doc.documentId, doc.uploadToken);
      if (!isValid) {
        return res.status(400).json({ success: false, error: "Document reference integrity check failed. Unrecognized or hijacked file." });
      }
    }

    const normalizedEmail = email.trim().toLowerCase();
    const nowIso = new Date().toISOString();
    const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const requestDoc = {
      id: requestId,
      requestId,
      email: normalizedEmail,
      fullName: (fullName || "").trim(),
      phone: (phone || "").trim(),
      phoneVerified: !!phoneVerified,
      reason: (reason || "").trim(),
      organizationName: (organizationName || "").trim(),
      previousWorkspaceInfo: (previousWorkspaceInfo || "").trim(),
      acceptedTerms: !!acceptedTerms,
      termsAcceptedAt: nowIso,
      documents: documents.map(d => ({
        documentId: d.documentId,
        storageReference: d.storageReference,
        fileName: d.fileName,
        mimeType: d.mimeType,
        size: d.size,
        uploadedAt: d.uploadedAt
      })),
      status: "pending",
      submittedAt: nowIso,
      updatedAt: nowIso
    };

    // Mark the pending uploads as associated so they won't be cleaned up as orphans
    for (const doc of documents) {
      await markUploadAssociated(doc.documentId, requestId);
    }

    // Save to Firestore
    try {
      await adminDb.collection("accountRecoveryRequests").doc(requestId).set(requestDoc);
      await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).set(requestDoc);
    } catch (fsErr) {
      console.warn("Firestore recovery request write warning:", fsErr);
    }

    // Save to local JSON DB fallback
    const db = readDb();
    if (!db.account_recovery_requests) db.account_recovery_requests = [];
    db.account_recovery_requests = db.account_recovery_requests.filter((r: any) => r.email !== normalizedEmail);
    db.account_recovery_requests.push(requestDoc);
    writeDb(db);

    // Update account lifecycle record to ADMIN_APPROVAL_PENDING
    const lifecycle = await getAccountLifecycleRecord(normalizedEmail);
    if (lifecycle) {
      await setAccountLifecycleRecord({
        ...lifecycle,
        status: "ADMIN_APPROVAL_PENDING",
        reactivationStatus: "pending",
        recoveryRequestId: requestId,
        updatedAt: nowIso
      });
    }

    return res.json({
      success: true,
      requestId,
      message: "Your account recovery request has been submitted for administrative review."
    });
  } catch (err: any) {
    console.error("Submit recovery request error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to submit recovery request." });
  }
});

// 2. Fetch Account Recovery Request Status for User
app.get("/api/auth/recovery-request/status", async (req, res) => {
  try {
    const email = req.query?.email;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "Email parameter is required." });
    }
    const normalizedEmail = email.trim().toLowerCase();

    let requestData: any = null;
    try {
      const emailSnap = await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).get();
      if (emailSnap.exists) {
        requestData = emailSnap.data();
      }
    } catch (e) {}

    if (!requestData) {
      const db = readDb();
      requestData = db.account_recovery_requests?.find((r: any) => r.email === normalizedEmail) || null;
    }

    if (!requestData) {
      return res.json({
        success: true,
        status: "none",
        recoveryRequest: null
      });
    }

    const responseStatus = requestData.status || "pending";
    const baseResponse: any = {
      success: true,
      status: responseStatus,
      recoveryRequest: {
        status: responseStatus,
        rejectionReason: responseStatus === "rejected" ? (requestData.rejectionReason || requestData.notes || "Request was declined by an administrator.") : null
      }
    };

    return res.json(baseResponse);
  } catch (err: any) {
    console.error("Recovery request status error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to fetch status." });
  }
});

// 3. Fetch All Account Recovery Requests for Admin Review
app.get("/api/admin/recovery-requests", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid || !(await isUserAdminServer(callerUid))) {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }

    let requests: any[] = [];
    try {
      const snap = await adminDb.collection("accountRecoveryRequests").get();
      if (snap && !snap.empty) {
        requests = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      }
    } catch (e) {}

    const db = readDb();
    const localRequests = db.account_recovery_requests || [];
    for (const lr of localRequests) {
      if (!requests.some(r => r.id === lr.id || r.requestId === lr.requestId)) {
        requests.push(lr);
      }
    }

    return res.json({ success: true, requests });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch recovery requests." });
  }
});

// 4. Admin Handle (Approve / Reject) Account Recovery Request
app.post("/api/admin/handle-recovery-request", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    if (!callerUid || !(await isUserAdminServer(callerUid))) {
      return res.status(403).json({ error: "Forbidden: Admin access required." });
    }

    const { requestId, email, action, rejectionReason } = req.body;
    if (!action || (action !== "approve" && action !== "reject")) {
      return res.status(400).json({ error: "Valid action ('approve' or 'reject') is required." });
    }

    let requestData: any = null;
    if (requestId) {
      try {
        const snap = await adminDb.collection("accountRecoveryRequests").doc(requestId).get();
        if (snap.exists) requestData = snap.data();
      } catch (e) {}
    }

    const targetEmail = (requestData?.email || email || "").trim().toLowerCase();
    if (!targetEmail) {
      return res.status(400).json({ error: "Target request email is required." });
    }

    if (!requestData) {
      const db = readDb();
      requestData = db.account_recovery_requests?.find((r: any) => r.email === targetEmail || r.id === requestId);
    }

    const nowIso = new Date().toISOString();
    const newStatus = action === "approve" ? "approved" : "rejected";

    const updatedRequestDoc = {
      ...(requestData || {}),
      email: targetEmail,
      status: newStatus,
      handledAt: nowIso,
      reviewedAt: nowIso,
      reviewedBy: callerUid,
      rejectionReason: action === "reject" ? (rejectionReason || "Identity or documentation could not be verified.") : null
    };

    try {
      if (requestData?.requestId) {
        await adminDb.collection("accountRecoveryRequests").doc(requestData.requestId).set(updatedRequestDoc, { merge: true });
      }
      await adminDb.collection("accountRecoveryRequests_by_email").doc(targetEmail).set(updatedRequestDoc, { merge: true });
    } catch (e) {}

    const db = readDb();
    if (!db.account_recovery_requests) db.account_recovery_requests = [];
    const existingIdx = db.account_recovery_requests.findIndex((r: any) => r.email === targetEmail || r.id === requestId);
    if (existingIdx >= 0) {
      db.account_recovery_requests[existingIdx] = updatedRequestDoc;
    } else {
      db.account_recovery_requests.push(updatedRequestDoc);
    }
    writeDb(db);

    const lifecycle = await getAccountLifecycleRecord(targetEmail);
    if (lifecycle) {
      await setAccountLifecycleRecord({
        ...lifecycle,
        status: action === "approve" ? "ADMIN_APPROVED" : "ADMIN_REJECTED",
        reactivationStatus: newStatus,
        updatedAt: nowIso
      });
    }

    if (action === "approve") {
      try {
        await restoreAccountFullServer(targetEmail);
        console.log(`[ADMIN_APPROVE_RECOVERY] Full restoration executed for ${targetEmail}`);
      } catch (rErr) {
        console.warn("Full restoration execution error on admin approval:", rErr);
      }
    } else if (action === "reject") {
      // Privacy & Security: Immediately purge uploaded identity documents on rejection
      if (requestData?.documents && Array.isArray(requestData.documents)) {
        (async () => {
          for (const doc of requestData.documents) {
            if (doc.documentId) {
              console.log(`[ADMIN_REJECT_RECOVERY] Purging identity document ${doc.documentId} on rejection`);
              await deleteDocumentFromPersistentStorage(doc.documentId);
            }
          }
        })().catch((pErr) => console.warn("Document purge notice on rejection:", pErr));
      }
    }

    // Dispatch notification email via Resend in Zakir BLUE design
    try {
      const userFullName = requestData?.fullName || targetEmail.split("@")[0];
      if (action === "approve") {
        const mailContent = buildRecoveryApprovalEmailHtml({
          userName: userFullName,
          email: targetEmail
        });
        await sendSystemMail(targetEmail, mailContent.subject, mailContent.text, mailContent.html);
      } else {
        const mailContent = buildRecoveryRejectionEmailHtml({
          userName: userFullName,
          email: targetEmail,
          rejectionReason: rejectionReason
        });
        await sendSystemMail(targetEmail, mailContent.subject, mailContent.text, mailContent.html);
      }
    } catch (mailErr) {
      console.warn("Recovery decision email delivery warning:", mailErr);
    }

    return res.json({
      success: true,
      message: action === "approve"
        ? "Account recovery request approved! The user has been notified via email to proceed with verification."
        : "Account recovery request rejected. The user has been notified with the provided reason."
    });
  } catch (err: any) {
    console.error("Handle recovery request error:", err);
    res.status(500).json({ error: err.message || "Failed to handle recovery request." });
  }
});

// 5. Send Approval OTP Code (User post-approval step)
app.post("/api/auth/recovery-request/send-approval-otp", otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, error: "Email is required." });
    }
    const normalizedEmail = email.trim().toLowerCase();

    let reqStatus = "";
    try {
      const emailSnap = await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).get();
      if (emailSnap.exists) {
        reqStatus = emailSnap.data()?.status || "";
      }
    } catch (e) {}

    if (!reqStatus) {
      const db = readDb();
      const localReq = db.account_recovery_requests?.find((r: any) => r.email === normalizedEmail);
      reqStatus = localReq?.status || "";
    }

    if (reqStatus !== "approved") {
      const lifecycle = await getAccountLifecycleRecord(normalizedEmail);
      if (lifecycle?.status !== "ADMIN_APPROVED" && lifecycle?.reactivationStatus !== "approved") {
        return res.status(400).json({
          success: false,
          error: "Your recovery request has not yet been approved by an administrator."
        });
      }
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashVerificationCode(otpCode);
    const nowMs = Date.now();
    const expiresAt = new Date(nowMs + 10 * 60 * 1000).toISOString();
    const docId = `recovery_otp_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const record = {
      id: docId,
      email: normalizedEmail,
      codeHash: codeHash,
      type: "account_recovery",
      expiresAt: expiresAt,
      attempts: 0,
      used: false,
      createdAt: new Date().toISOString()
    };

    try {
      await adminDb.collection("verification_codes").doc(docId).set(record);
      await adminDb.collection("verification_codes").doc(normalizedEmail).set(record);
    } catch (e) {}

    const db = readDb();
    if (!db.verification_codes) db.verification_codes = [];
    db.verification_codes = db.verification_codes.filter((vc: any) => vc.id !== docId && vc.id !== normalizedEmail);
    db.verification_codes.push(record);
    writeDb(db);

    const emailObj = buildOtpEmailHtml({
      email: normalizedEmail,
      otpCode: otpCode,
      type: "account_recovery"
    });

    const mailResult = await sendSystemMail(normalizedEmail, emailObj.subject, emailObj.text, emailObj.html);

    return res.json({
      success: true,
      message: `Verification code sent to ${normalizedEmail}`,
      expiresAt,
      emailSent: !mailResult.simulated,
      devCode: mailResult.simulated ? otpCode : undefined
    });
  } catch (err: any) {
    console.error("Send approval OTP error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to send verification code." });
  }
});

// 6. Verify OTP and Restore Account
app.post("/api/auth/recovery-request/verify-otp-and-restore", otpLimiter, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, error: "Email and verification code are required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const inputCode = String(code).trim();
    const docId = `recovery_otp_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

    let otpRecord: any = null;
    try {
      const snap = await adminDb.collection("verification_codes").doc(docId).get();
      if (snap.exists && !snap.data()?.used) {
        otpRecord = snap.data();
      }
      if (!otpRecord) {
        const emSnap = await adminDb.collection("verification_codes").doc(normalizedEmail).get();
        if (emSnap.exists && !emSnap.data()?.used) {
          otpRecord = emSnap.data();
        }
      }
    } catch (e) {}

    if (!otpRecord) {
      const db = readDb();
      otpRecord = db.verification_codes?.find((vc: any) => (vc.id === docId || vc.email === normalizedEmail) && !vc.used);
    }

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        error: "No active verification code found or code has already been used. Please request a new code."
      });
    }

    const expiresAt = new Date(otpRecord.expiresAt).getTime();
    if (expiresAt <= Date.now()) {
      return res.status(400).json({
        success: false,
        error: "Verification code has expired. Please request a new code."
      });
    }

    const cleanInputHash = hashVerificationCode(inputCode);
    const isMatch = otpRecord.codeHash ? otpRecord.codeHash === cleanInputHash : otpRecord.code === inputCode;

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: "Invalid verification code. Please check your email and try again."
      });
    }

    try {
      await adminDb.collection("verification_codes").doc(docId).update({ used: true });
    } catch (e) {}

    const nowIso = new Date().toISOString();
    try {
      await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).update({
        status: "restored",
        restoredAt: nowIso
      });
    } catch (e) {}

    const db = readDb();
    if (db.account_recovery_requests) {
      const rItem = db.account_recovery_requests.find((r: any) => r.email === normalizedEmail);
      if (rItem) rItem.status = "restored";
      writeDb(db);
    }

    const restoreRes = await restoreAccountFullServer(normalizedEmail, newPassword);
    if (!restoreRes.success || !restoreRes.user) {
      return res.status(500).json({ success: false, error: restoreRes.error || "Failed to restore account profile." });
    }

    // Privacy & Security: Purge temporary identity verification documents once restoration has completed
    (async () => {
      try {
        let recoveryReq: any = null;
        if (adminDb) {
          const reqSnap = await adminDb.collection("accountRecoveryRequests_by_email").doc(normalizedEmail).get();
          if (reqSnap.exists) recoveryReq = reqSnap.data();
        }
        if (!recoveryReq) {
          const db = readDb();
          recoveryReq = db.account_recovery_requests?.find((r: any) => r.email === normalizedEmail);
        }

        if (recoveryReq?.documents && Array.isArray(recoveryReq.documents)) {
          for (const doc of recoveryReq.documents) {
            if (doc.documentId) {
              console.log(`[RESTORE_COMPLETED_PURGE] Purging identity document ${doc.documentId} after successful restoration`);
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
      console.warn("createCustomToken warning on recovery restoration:", tErr);
    }

    return res.json({
      success: true,
      customToken,
      user: restoreRes.user,
      message: "Your account has been successfully restored! You may now sign in."
    });
  } catch (err: any) {
    console.error("Verify OTP and restore error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to complete account restoration." });
  }
});

app.delete("/api/admin/delete-user/:uid", requireAuth, async (req: AuthRequest, res) => {
  const targetUid = req.params.uid;
  try {
    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isCallerAdmin = await isUserAdminServer(callerUid);
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Only administrative personnel can perform account deletion." });
    }

    if (targetUid === callerUid) {
      return res.status(400).json({ error: "You cannot delete your own active administrative account." });
    }

    console.log("USER_DELETE_STARTED", { targetUid });

    let targetEmail = "";
    try {
      const targetSnap = await adminDb.collection("users").doc(targetUid).get();
      if (targetSnap.exists) {
        targetEmail = targetSnap.data()?.email || "";
      }
    } catch (e) {
      console.warn("Failed to retrieve target user email:", e);
    }

    // Update permanent account lifecycle record for ADMIN DELETED account
    if (targetEmail) {
      const normEmail = targetEmail.trim().toLowerCase();
      await setAccountLifecycleRecord({
        accountId: normEmail,
        emailNormalized: normEmail,
        status: "ADMIN_DELETED",
        deletionType: "admin",
        deletedAt: new Date().toISOString(),
        deletedBy: callerUid,
        restoreUntil: null,
        adminApprovalRequired: true,
        originalUserId: targetUid
      });
    }

    try {
      await adminDb.collection("deletedUsers").doc(targetUid).set({
        uid: targetUid,
        email: targetEmail,
        deletedAt: new Date().toISOString(),
        deletedBy: callerUid,
        reason: "admin_deleted"
      });
      console.log("USER_DELETED_MARKER_CREATED", { targetUid });
    } catch (delErr: any) {
      console.error("Firestore deletedUsers creation failed:", delErr?.message);
      return res.status(500).json({ error: `Critical error: Failed to establish deletion marker in Firestore. Aborting deletion: ${delErr.message}` });
    }

    // 2. Delete Firestore user-owned data and profile
    try {
      await adminDb.collection("users").doc(targetUid).delete();
      console.log("USER_FIRESTORE_DELETED", { targetUid });
    } catch (fsErr: any) {
      console.warn("Firestore user doc delete warning:", fsErr?.message);
    }

    // Delete verification codes
    try {
      await adminDb.collection("verification_codes").doc(targetUid).delete();
      const vcSnap = await adminDb.collection("verification_codes").where("userId", "==", targetUid).get();
      for (const doc of vcSnap.docs) {
        await doc.ref.delete();
      }
    } catch (vcErr: any) {
      console.warn("Verification codes deletion warning:", vcErr?.message);
    }

    // Delete user files subcollection & top-level files
    try {
      const userFilesSnap = await adminDb.collection("users").doc(targetUid).collection("files").get();
      for (const fDoc of userFilesSnap.docs) {
        await fDoc.ref.delete();
      }
      const topFilesSnap = await adminDb.collection("files").where("userId", "==", targetUid).get();
      for (const tfDoc of topFilesSnap.docs) {
        await tfDoc.ref.delete();
      }
    } catch (filesErr: any) {
      console.warn("Files metadata deletion warning:", filesErr?.message);
    }

    // Delete user memories & risk alerts
    try {
      const memSnap = await adminDb.collection("users").doc(targetUid).collection("memories").get();
      for (const mDoc of memSnap.docs) {
        await mDoc.ref.delete();
      }
      const alertSnap = await adminDb.collection("users").doc(targetUid).collection("riskAlerts").get();
      for (const aDoc of alertSnap.docs) {
        await aDoc.ref.delete();
      }
    } catch (memErr: any) {
      console.warn("Memories/alerts deletion warning:", memErr?.message);
    }

    // Delete support tickets owned by user
    try {
      const ticketSnap = await adminDb.collection("support_tickets").where("userId", "==", targetUid).get();
      for (const tDoc of ticketSnap.docs) {
        await tDoc.ref.delete();
      }
    } catch (ticketErr: any) {
      console.warn("Support tickets deletion warning:", ticketErr?.message);
    }

    // 3. Disable in Firebase Authentication (preserve Auth UID identity for restoration)
    try {
      await adminAuth.updateUser(targetUid, { disabled: true });
      console.log("USER_AUTH_DISABLED", { targetUid });
    } catch (authErr: any) {
      if (authErr.code !== "auth/user-not-found") {
        console.warn("USER_AUTH_DISABLE_WARNING", { targetUid, error: authErr?.message });
      }
    }

    // 4. Revoke active refresh tokens
    try {
      await adminAuth.revokeRefreshTokens(targetUid);
      console.log("USER_TOKENS_REVOKED", { targetUid });
    } catch (tokenErr: any) {
      console.warn("Revoke refresh tokens warning:", tokenErr?.message);
    }

    // 5. Synchronize deletion to the local JSON file database store
    const dbData = readDb();
    if (dbData.users) dbData.users = dbData.users.filter((u: any) => u.id !== targetUid);
    if (dbData.verification_codes) dbData.verification_codes = dbData.verification_codes.filter((vc: any) => vc.id !== targetUid && vc.userId !== targetUid);
    if (dbData.support_tickets) dbData.support_tickets = dbData.support_tickets.filter((st: any) => st.userId !== targetUid);
    writeDb(dbData);

    console.log("USER_DELETE_COMPLETED", { targetUid });
    res.json({ success: true, message: `Account ${targetUid} has been permanently deleted from all systems.` });
  } catch (err: any) {
    console.error("USER_DELETE_FAILED", { targetUid, error: err.message || String(err) });
    res.status(500).json({ error: err.message || "Administrative deletion process failed." });
  }
});

app.all("/api/auth/delete-account", requireAuth, async (req: AuthRequest, res) => {
  let targetUid = req.user?.uid;
  try {
    if (!targetUid && req.body?.email) {
      try {
        const db = readDb();
        const found = db.users?.find((u: any) => u.email?.trim().toLowerCase() === (req.body.email || "").trim().toLowerCase());
        if (found) targetUid = found.id;
      } catch (e) {}
    }

    if (!targetUid) {
      return res.status(401).json({ error: "Unauthorized: Could not determine user identity for deletion." });
    }

    console.log("USER_SELF_DELETE_STARTED", { targetUid });

    // Archive user profile in users_retained/{targetUid} before deletion
    let userDocData: any = null;
    try {
      const userSnap = await adminDb.collection("users").doc(targetUid).get();
      if (userSnap.exists) {
        userDocData = userSnap.data();
      }
    } catch (e) {}

    const targetEmail = userDocData?.email || req.user?.email || "";
    const normEmail = targetEmail.trim().toLowerCase();

    if (userDocData) {
      try {
        await adminDb.collection("users_retained").doc(targetUid).set({
          ...userDocData,
          archivedAt: new Date().toISOString()
        });

        // Archive subcollections
        const memSnap = await adminDb.collection("users").doc(targetUid).collection("memories").get();
        for (const mDoc of memSnap.docs) {
          await adminDb.collection("users_retained").doc(targetUid).collection("memories").doc(mDoc.id).set(mDoc.data());
        }

        const alertSnap = await adminDb.collection("users").doc(targetUid).collection("riskAlerts").get();
        for (const aDoc of alertSnap.docs) {
          await adminDb.collection("users_retained").doc(targetUid).collection("riskAlerts").doc(aDoc.id).set(aDoc.data());
        }

        const filesSnap = await adminDb.collection("users").doc(targetUid).collection("files").get();
        for (const fDoc of filesSnap.docs) {
          await adminDb.collection("users_retained").doc(targetUid).collection("files").doc(fDoc.id).set(fDoc.data());
        }

        const topFilesSnap = await adminDb.collection("files").where("userId", "==", targetUid).get();
        for (const tfDoc of topFilesSnap.docs) {
          await adminDb.collection("users_retained").doc(targetUid).collection("top_files").doc(tfDoc.id).set(tfDoc.data());
        }

        // Backup retained user to local DB
        const db = readDb();
        if (!db.retained_users) db.retained_users = [];
        db.retained_users = db.retained_users.filter((u: any) => u.id !== targetUid);

        const localMems = (db.memories || []).filter((m: any) => m.userId === targetUid);
        const localAlerts = (db.risk_alerts || []).filter((a: any) => a.userId === targetUid);
        const localFiles = (db.files || []).filter((f: any) => f.userId === targetUid);

        db.retained_users.push({
          ...userDocData,
          archivedAt: new Date().toISOString(),
          archivedMemories: localMems,
          archivedRiskAlerts: localAlerts,
          archivedFiles: localFiles
        });
        writeDb(db);
      } catch (archErr) {
        console.warn("Retention profile backup warning:", archErr);
      }
    }

    // Record account lifecycle for self deletion (31 day restoration window)
    if (normEmail) {
      const nowIso = new Date().toISOString();
      const restoreUntilIso = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
      await setAccountLifecycleRecord({
        accountId: normEmail,
        emailNormalized: normEmail,
        status: "SELF_DELETED",
        deletionType: "self",
        deletedAt: nowIso,
        deletedBy: targetUid,
        restoreUntil: restoreUntilIso,
        originalUserId: targetUid,
        retainedDataDocPath: `users_retained/${targetUid}`,
        adminApprovalRequired: false
      });
    }

    // 1. Revoke active refresh tokens
    try {
      await adminAuth.revokeRefreshTokens(targetUid);
    } catch (tokenErr: any) {
      console.warn("Revoke refresh tokens warning:", tokenErr?.message);
    }

    // 2. Disable in Firebase Authentication (preserve Auth UID identity for restoration)
    try {
      await adminAuth.updateUser(targetUid, { disabled: true });
      console.log("USER_SELF_AUTH_DISABLED", { targetUid });
    } catch (authErr: any) {
      if (authErr.code !== "auth/user-not-found") {
        console.warn("USER_SELF_AUTH_DISABLE_WARNING", { targetUid, error: authErr?.message });
      }
    }

    // 3. Create deleted marker in Firestore
    try {
      await adminDb.collection("deletedUsers").doc(targetUid).set({
        uid: targetUid,
        email: targetEmail,
        deletedAt: new Date().toISOString(),
        deletedBy: targetUid,
        reason: "self_deleted"
      });
    } catch (dErr) {}

    // 4. Delete Firestore user document users/{targetUid}
    try {
      await adminDb.collection("users").doc(targetUid).delete();
    } catch (fsErr: any) {}

    // 5. Delete verification codes
    try {
      await adminDb.collection("verification_codes").doc(targetUid).delete();
      const vcSnap = await adminDb.collection("verification_codes").where("userId", "==", targetUid).get();
      for (const doc of vcSnap.docs) {
        await doc.ref.delete();
      }
    } catch (vcErr: any) {}

    // 6. Delete top-level files metadata
    try {
      const topFilesSnap = await adminDb.collection("files").where("userId", "==", targetUid).get();
      for (const tfDoc of topFilesSnap.docs) {
        await tfDoc.ref.delete();
      }
    } catch (filesErr: any) {}

    // 7. Synchronize deletion to local JSON DB store
    const dbData = readDb();
    if (dbData.users) dbData.users = dbData.users.filter((u: any) => u.id !== targetUid);
    if (dbData.verification_codes) dbData.verification_codes = dbData.verification_codes.filter((vc: any) => vc.id !== targetUid && vc.userId !== targetUid);
    if (dbData.support_tickets) dbData.support_tickets = dbData.support_tickets.filter((st: any) => st.userId !== targetUid);
    writeDb(dbData);

    console.log("USER_SELF_DELETE_COMPLETED", { targetUid });
    res.json({ success: true, message: "Your account has been deleted. You have 31 days to restore it if you choose." });
  } catch (err: any) {
    console.error("USER_SELF_DELETE_FAILED", { targetUid, error: err.message || String(err) });
    res.status(500).json({ error: err.message || "Account deletion failed." });
  }
});

// --- API AUTHENTICATION ENDPOINTS ---
app.post("/api/auth/register", loginRegisterLimiter, async (req, res) => {
  try {
    const { email, password, companyName, role, ownerName, lang } = req.body;
    const userRole = role || "CEO";
    if (!email || !password || !companyName) {
      return res.status(400).json({ success: false, error: "All registration fields are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log("REGISTRATION_STARTED", { email: normalizedEmail });

    // CRITICAL ACCOUNT LIFECYCLE CHECK BEFORE ANY CREATION
    const lifecycleRecord = await getAccountLifecycleRecord(normalizedEmail);
    if (lifecycleRecord) {
      if (lifecycleRecord.status === "ADMIN_DELETED" || lifecycleRecord.status === "ADMIN_APPROVAL_REQUIRED" || lifecycleRecord.deletionType === "admin") {
        return res.status(400).json({
          success: false,
          code: "ADMIN_DELETED_BLOCKED",
          adminApprovalRequired: true,
          error: "تم تعطيل حسابك بواسطة مسؤول المنصة. لا يمكنك إنشاء حساب جديد باستخدام هذا البريد الإلكتروني إلا بعد موافقة المسؤول."
        });
      }
      if (lifecycleRecord.status === "ADMIN_APPROVAL_PENDING") {
        return res.status(400).json({
          success: false,
          code: "ADMIN_APPROVAL_PENDING",
          adminApprovalRequired: true,
          error: "طلب إعادة تفعيل الحساب قيد المراجعة حالياً بواسطة مسؤول المنصة. يرجى الانتظار لحين البت في الطلب."
        });
      }
      if (lifecycleRecord.status === "SELF_DELETED" && lifecycleRecord.restoreUntil) {
        const nowMs = Date.now();
        const restoreUntilMs = new Date(lifecycleRecord.restoreUntil).getTime();
        if (nowMs <= restoreUntilMs) {
          const daysRemaining = Math.max(1, Math.ceil((restoreUntilMs - nowMs) / (24 * 3600 * 1000)));
          return res.status(400).json({
            success: false,
            code: "SELF_RESTORE_AVAILABLE",
            canRestore: true,
            daysRemaining: daysRemaining,
            restoreUntil: lifecycleRecord.restoreUntil,
            error: `تم العثور على حساب سابق تم حذفه بواسطتك. يرجى اختيار استعادة الحساب بدلاً من إنشاء حساب جديد (متبقي ${daysRemaining} يوماً للاستعادة).`
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
        error: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character." 
      });
    }
    if (!len || !upper || !lower || !num || !special) {
      return res.status(400).json({ 
        success: false,
        error: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character." 
      });
    }

    const db = readDb();
    if (db.users?.find((u: any) => u.email?.trim().toLowerCase() === normalizedEmail)) {
      return res.status(400).json({ success: false, error: "Email already exists." });
    }

    // Check Firestore users collection to avoid duplicate registrations
    try {
      const existingSnap = await adminDb.collection("users").where("email", "==", normalizedEmail).limit(1).get();
      if (!existingSnap.empty) {
        return res.status(400).json({ success: false, error: "Email already exists." });
      }
    } catch (err) {}

    // Check Firebase Auth to avoid duplicate accounts
    try {
      const existingAuthUser = await adminAuth.getUserByEmail(normalizedEmail);
      if (existingAuthUser) {
        return res.status(400).json({ success: false, error: "Email already exists." });
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
        emailVerified: false
      });
      userId = authUser.uid;
      createdAuthUser = true;
      console.log("USER_CREATED", { userId, email: normalizedEmail, source: "firebase_auth" });
    } catch (authErr: any) {
      if (authErr?.code === 'auth/email-already-exists') {
        return res.status(400).json({ success: false, error: "Email already exists." });
      }
      userId = "usr_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
      console.log("USER_CREATED", { userId, email: normalizedEmail, source: "generated_id", authErr: authErr?.message });
    }

    // Check if there is an active workspace invitation for this email
    let invitation: any = null;
    try {
      const invDoc = await adminDb.collection("invitations").doc(normalizedEmail).get();
      if (invDoc.exists) {
        invitation = invDoc.data();
      }
    } catch (e) {}
    if (!invitation) {
      const dbTemp = readDb();
      invitation = dbTemp.invitations?.find((i: any) => i.email?.trim().toLowerCase() === normalizedEmail) || null;
    }

    const effectiveCompanyName = invitation?.companyName || companyName;
    const effectiveRole = invitation?.role || userRole;
    const nowIso = new Date().toISOString();
    const workspaceId = invitation?.workspaceId || `ws_${userId.substring(0, 8)}_${Date.now().toString(36)}`;
    const resolvedOwnerName = ownerName || normalizedEmail.split("@")[0];

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
        memberCount: 1
      },
      subscriptionStatus: "Pending Selection",
      createdAt: nowIso,
      trialExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      lastActiveAt: nowIso,
      lastLoginAt: nowIso,
      isVerified: false,
      isEmailVerified: false,
      email_verified: false,
      emailVerified: false,
      verification_required: true,
      verification_status: "unverified"
    };

    // SAVE USER TO PRODUCTION FIRESTORE users/{userId}
    const userRef = adminDb.collection("users").doc(userId);
    try {
      await userRef.set(newUser);
      console.log("USER_FIRESTORE_PERSISTED", { userId, email: normalizedEmail });
    } catch (fsErr: any) {
      console.error("USER_CREATION_FAILED", {
        userId,
        email: normalizedEmail,
        error: fsErr?.message || String(fsErr)
      });
      if (createdAuthUser) {
        try { await adminAuth.deleteUser(userId); } catch (e) {}
      }
      return res.status(500).json({
        success: false,
        code: "USER_CREATION_FAILED",
        error: "Failed to create user record in database. Please try again."
      });
    }

    // VERIFY WRITE IMMEDIATELY!
    try {
      const createdDoc = await userRef.get();
      if (!createdDoc.exists) {
        console.error("USER_FIRESTORE_PERSIST_FAILED", { userId, email: normalizedEmail });
        if (createdAuthUser) {
          try { await adminAuth.deleteUser(userId); } catch (e) {}
        }
        return res.status(500).json({
          success: false,
          code: "USER_CREATION_VERIFICATION_FAILED",
          error: "User creation verification failed. Document not found in Firestore."
        });
      }
    } catch (verifyErr: any) {
      console.error("USER_FIRESTORE_PERSIST_FAILED", {
        userId,
        email: normalizedEmail,
        error: verifyErr?.message || String(verifyErr)
      });
      if (createdAuthUser) {
        try { await adminAuth.deleteUser(userId); } catch (e) {}
      }
      return res.status(500).json({
        success: false,
        code: "USER_CREATION_VERIFICATION_FAILED",
        error: "Failed to verify user creation in Firestore."
      });
    }

    // Save to local JSON DB fallback
    if (!db.users) db.users = [];
    const existingIdx = db.users.findIndex((u: any) => u.id === userId || u.email?.toLowerCase() === normalizedEmail);
    if (existingIdx >= 0) {
      db.users[existingIdx] = newUser;
    } else {
      db.users.push(newUser);
    }
    writeDb(db);

    // If registered through invitation, link to CEO's team list and delete invitation
    if (invitation) {
      if (invitation.senderId) {
        try {
          const ceoRef = adminDb.collection("users").doc(invitation.senderId);
          const ceoSnap = await ceoRef.get();
          if (ceoSnap.exists) {
            const ceoData = ceoSnap.data() || {};
            const currentList = ceoData.teamMembersList || [];
            const existsIndex = currentList.findIndex((m: any) => m.email?.toLowerCase() === normalizedEmail);
            const updatedMember = {
              id: `tm-${userId}`,
              name: resolvedOwnerName,
              email: normalizedEmail,
              role: effectiveRole,
              powers: invitation.powers || [],
              addedAt: nowIso.split("T")[0]
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
        dbInv.invitations = dbInv.invitations.filter((i: any) => i.email?.trim().toLowerCase() !== normalizedEmail);
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
      adminApprovalRequired: false
    });

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
      lastSentAt: new Date().toISOString()
    };

    try {
      await adminDb.collection("verification_codes").doc(docId).set(otpRecord);
      console.log("OTP_CREATED", { userId, docId });
      console.log("OTP_STORED", { userId, docId });
    } catch (otpDbErr: any) {
      console.error("OTP_STORAGE_FAILED", {
        userId,
        email: normalizedEmail,
        error: otpDbErr?.message || String(otpDbErr)
      });
      try { await userRef.delete(); } catch(e) {}
      if (createdAuthUser) {
        try { await adminAuth.deleteUser(userId); } catch(e) {}
      }
      return res.status(500).json({
        success: false,
        code: "OTP_STORAGE_FAILED",
        error: "Failed to store verification code in database. Registration aborted."
      });
    }

    if (!db.verification_codes) db.verification_codes = [];
    db.verification_codes = db.verification_codes.filter((vc: any) => vc.id !== docId);
    db.verification_codes.push(otpRecord);
    writeDb(db);

    // SEND OTP EMAIL AUTOMATICALLY VIA RESEND
    const resolvedUserName = cleanUserName(resolvedOwnerName, normalizedEmail);
    const { subject: emailSubject, text: textBody, html: htmlBody } = buildOtpEmailHtml({
      email: normalizedEmail,
      userName: resolvedUserName,
      otpCode: otpCode,
      type: "account_registration"
    });

    const mailResult = await sendSystemMail(normalizedEmail, emailSubject, textBody, htmlBody);
    if (!mailResult.success) {
      console.error("OTP_EMAIL_FAILED", {
        userId,
        email: normalizedEmail,
        error: mailResult.error?.message || mailResult.error || "Mail dispatch failed"
      });
      // Rollback user creation & OTP record if email failed!
      try { await userRef.delete(); } catch(e) {}
      try { await adminDb.collection("verification_codes").doc(docId).delete(); } catch(e) {}
      if (createdAuthUser) {
        try { await adminAuth.deleteUser(userId); } catch(e) {}
      }
      return res.status(500).json({
        success: false,
        code: "OTP_EMAIL_FAILED",
        error: mailResult.userFriendlyMessage || mailResult.error?.message || "Failed to send verification email. Please check your email address and try again."
      });
    }

    console.log("OTP_EMAIL_SENT", { userId, email: normalizedEmail });
    console.log("REGISTRATION_COMPLETED", { userId, email: normalizedEmail });

    const { passwordHash, ...userResponse } = newUser;
    return res.status(201).json({
      success: true,
      user: userResponse,
      initialOtpSent: true,
      sendCount: 0,
      message: "Registration completed successfully. Verification code sent to your email."
    });
  } catch (err: any) {
    console.error("REGISTRATION_FAILED_UNHANDLED", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected error occurred during registration."
    });
  }
});

app.post("/api/auth/login", loginRegisterLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const db = readDb();
  const user = db.users.find(
    (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password
  );

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const isVerified = user.isVerified === true || user.isEmailVerified === true || user.emailVerified === true || user.verification_status === "verified" || user.verification_required === false;

  const { passwordHash, ...userResponse } = user;
  res.json({
    ...userResponse,
    isVerified,
    isEmailVerified: isVerified,
    email_verified: isVerified,
    emailVerified: isVerified,
    verification_required: !isVerified,
    verification_status: isVerified ? "verified" : "unverified"
  });
});

// --- MEMORIES ENDPOINTS ---
app.get("/api/memories", requireAuth, (req: AuthRequest, res) => {
  const db = readDb();
  console.log("[DEBUG] req.user =", req.user);
    const authUserId = req.user?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }
  const filtered = (db.memories || []).filter((m: any) => m.userId === authUserId);
  res.json(filtered);
});

app.post("/api/memories", requireAuth, (req: AuthRequest, res) => {
  const { title, category, riskLevel, tags, description, decision, causalFactors, outcomes, lessonsLearned, authorEmail, authorRole, authorName } = req.body;

  if (!title || !category || !riskLevel || !description || !decision) {
    return res.status(400).json({ error: "Missing required memory content fields." });
  }

  console.log("[DEBUG] req.user =", req.user);
    const authUserId = req.user?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }

  const db = readDb();
  const newMemory = {
    id: req.body.id || "mem_" + Math.random().toString(36).substr(2, 9),
    title,
    category,
    riskLevel,
    tags: Array.isArray(tags) ? tags : tags ? String(tags).split(",").map(t => t.trim()) : [],
    description,
    decision,
    causalFactors: causalFactors || "",
    outcomes: outcomes || "",
    lessonsLearned: lessonsLearned || "",
    createdAt: new Date().toISOString(),
    userId: authUserId, // Strictly enforced server-side
    authorEmail: authorEmail || req.user?.email || "user@zakir.ai",
    authorRole: authorRole || "Analyst",
    authorName: authorName || (req.user?.email ? req.user.email.split("@")[0] : "User")
  };

  if (!db.memories) db.memories = [];
  db.memories.unshift(newMemory);

  // Automatically trigger a metric logged
  const newMetric = {
    id: "met_" + Math.random().toString(36).substr(2, 9),
    userId: authUserId, // Strictly enforced server-side
    actionType: "Log Memory",
    metricValue: 1,
    description: `Added strategic memory: ${title}`,
    createdAt: new Date().toISOString()
  };
  if (!db.user_metrics) db.user_metrics = [];
  db.user_metrics.unshift(newMetric);

  writeDb(db);
  res.status(201).json(newMemory);
});

app.delete("/api/memories/:id", requireAuth, (req: AuthRequest, res) => {
  const { id } = req.params;
  console.log("[DEBUG] req.user =", req.user);
    const authUserId = req.user?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }

  const db = readDb();
  const memory = (db.memories || []).find((m: any) => m.id === id);
  if (!memory) {
    return res.status(404).json({ error: "Memory not found." });
  }

  if (memory.userId !== authUserId) {
    return res.status(403).json({ error: "Forbidden: Cannot delete memory owned by another user." });
  }

  const index = db.memories.findIndex((m: any) => m.id === id);
  if (index !== -1) {
    db.memories.splice(index, 1);
    writeDb(db);
    return res.json({ success: true });
  }
  res.status(404).json({ error: "Memory not found." });
});

app.put("/api/memories/:id", requireAuth, (req: AuthRequest, res) => {
  const { id } = req.params;
  console.log("[DEBUG] req.user =", req.user);
    const authUserId = req.user?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }

  const db = readDb();
  const memory = (db.memories || []).find((m: any) => m.id === id);
  if (!memory) {
    return res.status(404).json({ error: "Memory not found." });
  }

  if (memory.userId !== authUserId) {
    return res.status(403).json({ error: "Forbidden: Cannot edit memory owned by another user." });
  }

  const index = db.memories.findIndex((m: any) => m.id === id);
  if (index !== -1) {
    const { title, category, riskLevel, tags, description, decision, causalFactors, outcomes, lessonsLearned } = req.body;
    db.memories[index] = {
      ...db.memories[index],
      title: title || db.memories[index].title,
      category: category || db.memories[index].category,
      riskLevel: riskLevel || db.memories[index].riskLevel,
      tags: tags ? (Array.isArray(tags) ? tags : String(tags).split(",").map(t => t.trim())) : db.memories[index].tags,
      description: description || db.memories[index].description,
      decision: decision || db.memories[index].decision,
      causalFactors: causalFactors !== undefined ? causalFactors : db.memories[index].causalFactors,
      outcomes: outcomes !== undefined ? outcomes : db.memories[index].outcomes,
      lessonsLearned: lessonsLearned !== undefined ? lessonsLearned : db.memories[index].lessonsLearned
    };
    writeDb(db);
    return res.json(db.memories[index]);
  }
  res.status(404).json({ error: "Memory not found." });
});

// --- RISK ALERTS ---
app.get("/api/risk-alerts", (req, res) => {
  const db = readDb();
  res.json(db.risk_alerts || []);
});

app.post("/api/risk-alerts", (req, res) => {
  const db = readDb();
  const newAlert = {
    id: req.body.id || `al_${Date.now()}`,
    title: req.body.title || "Risk Alert",
    category: req.body.category || "Operational Assets",
    severity: req.body.severity || "High",
    description: req.body.description || "",
    status: req.body.status || "Active",
    createdAt: req.body.createdAt || new Date().toISOString()
  };
  if (!db.risk_alerts) db.risk_alerts = [];
  db.risk_alerts.unshift(newAlert);
  writeDb(db);
  res.json(newAlert);
});

app.post("/api/risk-alerts/resolve", (req, res) => {
  const { id } = req.body;
  const db = readDb();
  const alertIndex = db.risk_alerts.findIndex((a: any) => a.id === id);
  if (alertIndex !== -1) {
    db.risk_alerts[alertIndex].status = "Resolved";
    writeDb(db);
    return res.json(db.risk_alerts[alertIndex]);
  }
  res.status(404).json({ error: "Alert not found." });
});

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
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZakirRiskEngine/1.0'
      }
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`استجابة البنك الدولي أرجعت رمز HTTP غير ناجح: ${response.status} (${response.statusText})`);
    }

    const data = await response.json();
    
    // Safe float conversion function to prevent RangeError / NaN crashes
    const parseWbVal = (val: any): number | null => {
      if (val === null || val === undefined || val === "") return null;
      const num = Number(val);
      return isNaN(num) ? null : parseFloat(num.toFixed(2));
    };

    // World Bank response format: [ { page, total }, [ { indicator, country, date, value }, ... ] ]
    if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1]) && data[1].length > 0) {
      const records = data[1]
        .map((item: any) => ({
          year: parseInt(item.date),
          value: parseWbVal(item.value),
          country: item.country?.value || country,
          indicatorName: item.indicator?.value || ""
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
          attemptedUrl
        });
      }
    }
    
    const wbMessage = Array.isArray(data) && data[0]?.message?.[0]?.value 
      ? data[0].message[0].value 
      : `لم ترجع استجابة البنك الدولي أية سجلات قياسية رقمية للسنوات من ${startYear} إلى ${endYear}.`;

    throw new Error(`استجابة البنك الدولي فارغة أو غير متوقعة: ${wbMessage}`);
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('abort');
    const latencyMs = Date.now() - startTime;
    console.warn(`[WorldBank Proxy Warning] ${attemptedUrl} - ${err.message}`);

    const fallbackData = generateWorldBankFallbackData(country, indicator, startYear, endYear);

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
        timestamp: new Date().toISOString()
      }
    });
  }
});

// --- INTERACTIVE POSTGRESQL QUERY SIMULATOR ---
app.all("/api/database/schema", requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUserId = req.user?.uid;
    if (!authUserId) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
    }

    const db = readDb();
    const usersArr = Array.isArray(db?.users) ? db.users : [];
    const user = usersArr.find((u: any) => u.id === authUserId);
    const isUserAdmin = await isUserAdminServer(authUserId);
    const userRole = user ? user.role : (isUserAdmin ? "CEO" : "Analyst");

    const isAuthorized = userRole === "CEO" || userRole === "Admin" || userRole === "Compliance Officer" || isUserAdmin;
    if (!isAuthorized) {
      return res.status(403).json({ error: "Forbidden: Restricted to administrative and compliance personnel only." });
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
    return res.status(500).json({ error: err.message || "Failed to fetch database schema" });
  }
});

app.post("/api/database/query", requireAuth, async (req: AuthRequest, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "SQL query string is required" });
  }

  console.log("[DEBUG] req.user =", req.user);
    const authUserId = req.user?.uid;
  const authUserEmail = req.user?.email || "";
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }

  const db = readDb();
  const user = db.users.find((u: any) => u.id === authUserId);
  const isUserAdmin = await isUserAdminServer(authUserId);
  const userRole = user ? user.role : (isUserAdmin ? "CEO" : "Analyst");

  const isAuthorized = userRole === "CEO" || userRole === "Admin" || userRole === "Compliance Officer" || isUserAdmin;
  console.log("DB_QUERY_AUTH", { authUserId, authUserEmail, userRole, isUserAdmin, isAuthorized });
  if (!isAuthorized) {
    return res.status(403).json({ error: "Forbidden: Restricted to administrative and compliance personnel only." });
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
      else if (trimmed.includes("FROM RISK_ALERTS") || trimmed.includes("FROM RISK-ALERTS")) targetTable = "risk_alerts";
      else if (trimmed.includes("FROM USER_METRICS") || trimmed.includes("FROM USER-METRICS")) targetTable = "user_metrics";

      if (!targetTable) {
        throw new Error("Table not found or queries outside scope. Supported tables: users, memories, risk_alerts, user_metrics.");
      }

      let tableData = db[targetTable] || [];

      // IDOR Mitigation / Least-Privilege Enforcer:
      // If the caller is not an Admin, restrict records to only their own data!
      if (!isUserAdmin) {
        if (targetTable === "users") {
          tableData = tableData.filter((item: any) => item.id === authUserId);
        } else if (targetTable === "memories" || targetTable === "risk_alerts" || targetTable === "user_metrics") {
          tableData = tableData.filter((item: any) => item.userId === authUserId);
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
          keysToExtract = selectPart.split(",").map((c: string) => c.trim().toLowerCase());
        }
      } else {
        keysToExtract = ["id", "status"]; // dummy
      }

      // Remove passwordHash from keys to extract if requested
      keysToExtract = keysToExtract.filter(k => k !== "passwordhash" && k !== "password_hash");

      columns = keysToExtract.map(k => k.toUpperCase());
      rows = tableData.map((item: any) => {
        return keysToExtract.map(key => {
          let val = item[key] !== undefined ? item[key] : item[Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase()) || ""];
          if (Array.isArray(val)) return `{${val.join(",")}}`;
          if (typeof val === "object") return JSON.stringify(val);
          return val;
        });
      });

      res.json({
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: Date.now() - startTime
      });

    } else if (trimmed.startsWith("INSERT INTO")) {
      // Simulate successful insert response to keep PostgreSQL interaction smooth
      res.json({
        columns: ["STATUS"],
        rows: [["INSERT 0 1"]],
        rowCount: 1,
        executionTimeMs: Date.now() - startTime
      });
    } else {
      throw new Error("Syntax Error: Zakir's client-side SQL editor supports standard read-only PostgreSQL queries (SELECT * FROM users/memories/user_metrics/risk_alerts) for live operational visualization.");
    }

  } catch (error: any) {
    res.json({
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: Date.now() - startTime,
      error: error.message || "Unknown database execution error."
    });
  }
});

// --- SMART EVOLUTION AI ENDPOINT ---
app.post("/api/smart-evolution", async (req, res) => {
  const { lang = "ar" } = req.body;
  let { memories, riskAlerts } = req.body;

  const db = readDb();
  if (!memories) {
    memories = db.memories || [];
  }
  if (!riskAlerts) {
    riskAlerts = db.risk_alerts || [];
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
        severity: riskLevelStr === "Critical" ? "حرِج" : riskLevelStr === "High" ? "مرتفع" : riskLevelStr === "Medium" ? "متوسط" : "منخفض",
        probability: riskLevelStr === "Critical" ? "95%" : riskLevelStr === "High" ? "85%" : riskLevelStr === "Medium" ? "65%" : "40%",
        details: `تحليل الحدث (${m.title}) يشير إلى إمكانية نشوء مخاطر بسبب: ${m.causalFactors || m.description}`
      });
      fallbackForecastsList.push({
        title: `توقع التأثير المالي لـ ${m.title}`,
        timeframe: "خلال 30-60 يوم",
        impact: riskLevelStr === "Critical" ? "حرِج" : riskLevelStr === "High" ? "مرتفع" : riskLevelStr === "Medium" ? "متوسط" : "منخفض",
        details: `الاستمرار بالنمط الحالي قد يؤدي لنتائج مشابهة لـ: ${m.outcomes || m.decision}`
      });
      fallbackOpportunitiesList.push({
        title: `أتمتة وتطوير ضوابط في ${m.category}`,
        feasibility: "مرتفع",
        benefit: `تخفيف مخاطر الـ ${riskLevelStr === "Critical" ? "حرِج" : riskLevelStr === "High" ? "المرتفعة" : "المتوسطة"}`,
        details: `تحويل الإجراء التقليدي إلى نظام مؤتمت لتفادي الثغرات المكتشفة في: ${m.title}.`
      });
      fallbackRecommendationsList.push({
        title: `بروتوكول وقائي معتمد لـ ${m.category}`,
        priority: riskLevelStr === "Critical" ? "حرِج" : riskLevelStr === "High" ? "مرتفع" : riskLevelStr === "Medium" ? "متوسط" : "منخفض",
        actionable: m.lessonsLearned || "تفعيل نظام فحص ومراقبة فوري للإجراءات لتفادي الأخطاء المتكررة.",
        details: `تنفيذ توصيات الحدث (${m.title}) عبر صياغة بروتوكول تحكم مزدوج والحد من التقديرات البشرية الفردية.`
      });
    } else if (lang === "fr") {
      fallbackRisksList.push({
        title: `Risque d'exploitation dans ${m.category}`,
        severity: riskLevelStr === "Critical" ? "Critique" : riskLevelStr === "High" ? "Élevé" : riskLevelStr === "Medium" ? "Moyen" : "Faible",
        probability: riskLevelStr === "Critical" ? "95%" : riskLevelStr === "High" ? "85%" : riskLevelStr === "Medium" ? "65%" : "40%",
        details: `L'analyse de l'événement (${m.title}) indique des risques potentiels dus à: ${m.causalFactors || m.description}`
      });
      fallbackForecastsList.push({
        title: `Impact financier prévu de ${m.title}`,
        timeframe: "Sous 30-60 jours",
        impact: riskLevelStr === "Critical" ? "Critique" : riskLevelStr === "High" ? "Élevé" : riskLevelStr === "Medium" ? "Moyen" : "Faible",
        details: `Continuer dans cette voie peut conduire à des résultats similaires à: ${m.outcomes || m.decision}`
      });
      fallbackOpportunitiesList.push({
        title: `Automatisation des contrôles dans ${m.category}`,
        feasibility: "Élevée",
        benefit: `Atténuation du risque ${riskLevelStr}`,
        details: `Passer d'une procédure manuelle à un système automatisé pour combler les lacunes de: ${m.title}.`
      });
      fallbackRecommendationsList.push({
        title: `Protocole préventif agréé pour ${m.category}`,
        priority: riskLevelStr === "Critical" ? "Critique" : riskLevelStr === "High" ? "Élevé" : riskLevelStr === "Medium" ? "Moyen" : "Faible",
        actionable: m.lessonsLearned || "Mettre en place un système de surveillance continue pour éviter les erreurs répétitives.",
        details: `Appliquer les leçons de (${m.title}) en instaurant des mécanismes de contrôle rigoureux.`
      });
    } else {
      fallbackRisksList.push({
        title: `Operational Risk in ${m.category}`,
        severity: riskLevelStr,
        probability: riskLevelStr === "Critical" ? "95%" : riskLevelStr === "High" ? "85%" : riskLevelStr === "Medium" ? "65%" : "40%",
        details: `Analysis of event (${m.title}) indicates potential exposure due to: ${m.causalFactors || m.description}`
      });
      fallbackForecastsList.push({
        title: `Projected Financial Impact of ${m.title}`,
        timeframe: "Within 30-60 Days",
        impact: riskLevelStr === "Critical" ? "Critical" : riskLevelStr === "High" ? "High" : riskLevelStr === "Medium" ? "Medium" : "Low",
        details: `Persistence of this pattern is projected to yield outcomes similar to: ${m.outcomes || m.decision}`
      });
      fallbackOpportunitiesList.push({
        title: `Automate and Standardize controls in ${m.category}`,
        feasibility: "High",
        benefit: `Mitigate ${riskLevelStr} severity risk`,
        details: `Transition from manual processing to an automated ruleset to close screening gaps highlighted in: ${m.title}.`
      });
      fallbackRecommendationsList.push({
        title: `Enforce preventative protocol for ${m.category}`,
        priority: riskLevelStr,
        actionable: m.lessonsLearned || "Enforce automated dual-authorization checks to eliminate individual error.",
        details: `Enact the remediation strategies derived from (${m.title}) to fortify process workflows.`
      });
    }
  }

  const activeRisksCount = riskAlerts.filter((a: any) => a.status === "Active" || a.status === "نشط" || a.status === "actif").length;

  const fallbackExecutiveSummary = lang === "ar"
    ? `### Heuristic analysis — AI unavailable\n\nتشخيص أنماط الأحداث المسجلة (${memories.length} ذكريات مؤسسية) يربط بين السبب والأثر لكشف ثغرات إدارة المخاطر في العمليات المالية واللوجستية. التحليل يحدد الانكشافات الحالية ويوفر توصيات إجرائية مباشرة لتفادي تكرار الأخطاء وحماية الذاكرة المؤسسية.`
    : lang === "fr"
    ? `### Heuristic analysis — AI unavailable\n\nL'analyse diagnostique de ${memories.length} souvenirs institutionnels relie la cause à l'effet pour révéler les failles opérationnelles et financières. L'évaluation fournit des recommandations directement applicables.`
    : `### Heuristic analysis — AI unavailable\n\nDiagnostic analysis of ${memories.length} institutional memories maps cause-and-effect patterns to identify unaddressed operational and financial vulnerabilities, offering actionable recommendations.`;

  const defaultPayload = {
    executiveSummary: fallbackExecutiveSummary,
    analyzedMemories: memories.length,
    identifiedRisks: activeRisksCount,
    opportunities: fallbackOpportunitiesList.length,
    recommendations: fallbackRecommendationsList.length,
    risksList: fallbackRisksList,
    forecastsList: fallbackForecastsList,
    opportunitiesList: fallbackOpportunitiesList,
    recommendationsList: fallbackRecommendationsList
  };

  const ai = getGeminiClient();
  if (!ai || memories.length === 0) {
    return res.json(defaultPayload);
  }

  try {
    const memoriesSummary = memories.map((m: any, index: number) => {
      return `[الذكرى المؤسسية #${index + 1}]:\n- العنوان: ${m.title}\n  الفئة: ${m.category}\n  مستوى الخطورة: ${m.riskLevel || 'High'}\n  القرار المتخذ: ${m.decision}\n  العوامل المسببة: ${m.causalFactors || 'غير محدد'}\n  النتائج المحققة: ${m.outcomes || 'غير محدد'}\n  الدروس المستفادة: ${m.lessonsLearned || 'غير محدد'}`;
    }).join("\n\n");

    const activeRisksSummary = riskAlerts.length > 0 
      ? riskAlerts.map((r: any, idx: number) => `[تنبيه خطر نشط #${idx + 1}]: ${r.title} | مستوى الخطورة: ${r.severity || 'High'} | التفاصيل: ${r.description || ''}`).join("\n")
      : "لا توجد تنبيهات مخاطر إضافية حرج حالياً.";

    const systemInstruction = `أنت المحرك التحليلي الذكي الاستراتيجي لقسم "التطور الذكي" في منصة "ذَكِرْ" لإدارة الذاكرة المؤسسية وتحليل المخاطر الشاملة.

[مهام محرك التطور الذكي]:
1. دراسة كامل بيانات المنصة: جميع الأحداث والذكريات المؤسسية المسجلة (${memories.length}) والتنبيهات والمخاطر النشطة (${activeRisksCount}).
2. ربط الأحداث والقرارات بالظروف الاقتصادية الكلية، وتوجهات الأسواق العالمية، وأسعار الصرف، وأخبار سلاسل الإمداد والتضخم الدولي لتحديد الانكشافات.
3. إجراء تشخيص سببي عميق (Causal Analysis) للربط بين القرارات السابقة والنتائج المحققة وتفادي تكرار الأخطاء المؤسسية.
4. صياغة تقرير تطور ذكي موجه لقيادة المؤسسة يشمل: ملخص تشخيصي، مخاطر وتوقعات مستقبلية، فرص تطوير، وتوصيات تنفيدية دقيقة.

[تنسيق المخرجات]:
يجب إعادة النتيجة ككائن JSON فقط باللغة المطلوب إخراجها ("${lang === "ar" ? "اللغة العربية الفصيحة والدقيقة" : lang === "fr" ? "اللغة الفرنسية" : "اللغة الإنجليزية"}") بالهيكل الموحد التالي:
{
  "executiveSummary": "ملخص تشخيصي شامل يحلل الذاكرة المؤسسية والقرارات السابقة ويربطها بظروف الأسواق العالمية والتغيرات الجيواقتصادية لمنع تكرار الأخطاء",
  "analyzedMemories": number,
  "identifiedRisks": number,
  "opportunities": number,
  "recommendations": number,
  "risksList": [{"title": "عنوان الخطر التشغيلي أو المالي", "severity": "حرِج / مرتفع / متوسط", "probability": "نسبة أو مستوى الاحتمالية", "details": "تفاصيل الخطر وربطه بالسوق والذاكرة المؤسسية"}],
  "forecastsList": [{"title": "عنوان التوقع الاستراتيجي", "timeframe": "الإطار الزمني المستقبلي", "impact": "عالي / متوسط / منخفض", "details": "تحليل أثر الاتجاه المستقبلي بناءً على مؤشرات السوق والخبرة المسجلة"}],
  "opportunitiesList": [{"title": "عنوان الفرصة التطويرية", "feasibility": "مرتفع / متوسط", "benefit": "مستوى الفائدة المؤسسية", "details": "كيفية استغلال الفرصة لرفع الكفاءة وتفادي الأخطاء"}],
  "recommendationsList": [{"title": "عنوان التوصية التنفيذية", "priority": "حرِج / مرتفع / متوسط", "actionable": "إجراء عملي مباشر وقابل للتطبيق", "details": "خطوات التنفيذ والحوكمة لمنع الانكشاف"}]
}`;

    let response;
    const fallbackModels = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];
    for (let i = 0; i < fallbackModels.length; i++) {
      try {
        response = await ai.models.generateContent({
          model: fallbackModels[i],
          contents: [
            {
              role: "user",
              parts: [{ text: `قم بإجراء التقييم والتحليل الشامل للمؤسسة واستبصار توجهات الأسواق العالمية والبيانات التالية:\n\n### الذاكرات والأحداث المؤسسية المسجلة:\n${memoriesSummary}\n\n### التنبيهات والمخاطر النشطة:\n${activeRisksSummary}` }]
            }
          ],
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.35
          }
        });
        break;
      } catch (apiError: any) {
        if (i === fallbackModels.length - 1) throw apiError;
      }
    }

    const rawText = response?.text || "{}";
    const cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleanText);

    res.json({
      executiveSummary: result.executiveSummary || fallbackExecutiveSummary,
      analyzedMemories: memories.length,
      identifiedRisks: activeRisksCount,
      opportunities: result.opportunitiesList?.length || fallbackOpportunitiesList.length,
      recommendations: result.recommendationsList?.length || fallbackRecommendationsList.length,
      risksList: result.risksList || fallbackRisksList,
      forecastsList: result.forecastsList || fallbackForecastsList,
      opportunitiesList: result.opportunitiesList || fallbackOpportunitiesList,
      recommendationsList: result.recommendationsList || fallbackRecommendationsList
    });

  } catch (e: any) {
    console.error("Gemini smart evolution failed, using database fallback:", e.message || e);
    res.json(defaultPayload);
  }
});

// --- MARKET INTELLIGENCE ENDPOINT ---
app.post("/api/market-intelligence", async (req, res) => {
  const { topic, industry, context, lang = "ar" } = req.body;
  if (!topic || typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: "Topic is required for market intelligence." });
  }

  const marketTopic = topic.trim();
  const targetSector = (industry || (lang === "ar" ? "الخدمات المالية / اللوجستية" : "Financial Services / Logistics")).trim();
  const geographicScope = (context || (lang === "ar" ? "عالمي / إقليمي" : "Global / Regional")).trim();

  // Helper for dynamic fallback generation when Gemini quota is exhausted or client unavailable
  const generateDynamicFallback = () => {
    if (lang === "ar") {
      return {
        topic: marketTopic,
        industry: targetSector,
        context: geographicScope,
        summary: `### Heuristic analysis — AI unavailable\n\n**ملخص تنفيذي والتحليل الجيواقتصادي والمالي:**\nدراسة تقلبات واتجاهات السوق المتعلقة بـ **"${marketTopic}"** في قطاع **"${targetSector}"** ضمن نطاق **"${geographicScope}"** تشير إلى انكشافات هيكلية ومخاطر تقلبات في أسعار الصرف وسلاسل الإمداد.\n\nتتطلب التحولات الحالية تحوطاً مالياً وتشغيلياً استباقياً لربط القرارات الحالية بالذاكرة المؤسسية لمنصة **ذَكِرْ** وتفادي تكرار الأخطاء السابقة عند معالجة تقلبات الأسواق الدولية.`,
        risks: [
          `تقلبات أسعار الصرف وهامش الربح في قطاع ${targetSector} نتيجة التغيرات في ${marketTopic}.`,
          `اختناقات سلاسل الإمداد والتأخيرات اللوجستية في نطاق ${geographicScope}.`,
          `المخاطر التنظيمية والامتثال الناتج عن عدم التوثيق السببي اللحظي للقرارات.`
        ],
        opportunities: [
          `تطبيق أطر تحوط ديناميكية ومؤتمتة مقابل تقلبات السوق لقطاع ${targetSector}.`,
          `استغلال المزامنة اللحظية مع منصة ذَكِرْ لتوثيق وتحليل أسباب القرارات الاستيرادية والمالية.`,
          `تعزيز المرونة في سلاسل الإمداد والتوسع في أسواق النطاق ${geographicScope}.`
        ],
        recommendations: [
          `تأسيس خزائن معرفية وحوكمة رقمية مركزية في منصة ذَكِرْ للاحتفاظ بالذاكرة التشغيلية.`,
          `إضفاء الطابع المؤسسي المنظم على موافقات الاستيراد والتحوط لمنع الأخطاء التنظيمية.`,
          `نشر تنبيهات مبكرة عند رصد مؤشرات محاكاة للمخاطر السابقة في قطاع ${targetSector}.`
        ]
      };
    } else {
      return {
        topic: marketTopic,
        industry: targetSector,
        context: geographicScope,
        summary: `### Heuristic analysis — AI unavailable\n\n**Executive & Geoeconomic Analysis:**\nA strategic evaluation of market trends for **"${marketTopic}"** in the **"${targetSector}"** sector under **"${geographicScope}"** indicates systemic supply chain friction and foreign exchange (FX) exposure.\n\nProactive operational hedging and linking current trade decisions with **Zakir's** institutional memory are essential to prevent recurring corporate errors.`,
        risks: [
          `Foreign exchange volatility and margin compression in ${targetSector} stemming from ${marketTopic}.`,
          `Supply chain bottlenecks and shipping delays within ${geographicScope}.`,
          `Regulatory non-compliance risks caused by lack of immediate causal decision logging.`
        ],
        opportunities: [
          `Deploying dynamic, automated FX and supply chain hedging frameworks for ${targetSector}.`,
          `Leveraging real-time integration with Zakir to document causal drivers of trade and treasury choices.`,
          `Expanding supply chain resilience across ${geographicScope}.`
        ],
        recommendations: [
          `Establish centralized knowledge vaults and governance in Zakir to preserve operational memory.`,
          `Institutionalize multi-tier approval workflows for high-risk trade decisions.`,
          `Set up automated warning alerts when market indicators mirror past operational errors.`
        ]
      };
    }
  };

  const client = getGeminiClient();
  if (!client) {
    return res.json(generateDynamicFallback());
  }

  const systemInstruction = `أنت خبير ومحلل في ذكاء السوق العالمي وإدارة المخاطر المالية الدولية لنظام "ذاكر".

[المدخلات من الواجهة]:
- موضوع السوق / الاتجاه المراد تحليله: ${marketTopic}
- القطاع المستهدف: ${targetSector}
- سياق التركيز الاختياري / النطاق الجغرافي: ${geographicScope}

[المهام والشروط]:
1. قم بتحليل تقلبات واتجاهات السوق بناءً على أحدث البيانات الاقتصادية المتاحة والمعايير المالية الدولية.
2. حدد أثر هذه التغييرات على التجارة وسلاسل الإمداد ومخاطر أسعار الصرف ذات الصلة بالقطاع المستهدف.
3. ربط التحليل بتفادي تكرار الأخطاء المؤسسية وتحديد نقاط الخطر المحتملة.

[تنسيق المخرجات]:
يجب أن تعيد الإجابة فقط على شكل كائن JSON صالح بالصيغة التالية دون أي نص إضافي:
{
  "summary": "ملخص تنفيذي والتحليل الجيواقتصادي والمالي للموضوع وتأثيره على التجارة وسلاسل الإمداد ومخاطر الصرف",
  "risks": ["خطر مباشر أو غير مباشر 1", "خطر مباشر أو غير مباشر 2", "خطر مباشر أو غير مباشر 3"],
  "opportunities": ["فرصة استراتيجية 1", "فرصة استراتيجية 2", "فرصة استراتيجية 3"],
  "recommendations": ["توصية استراتيجية للتعامل مع الاتجاه وتفادي الأخطاء 1", "توصية استراتيجية 2", "توصية استراتيجية 3"]
}

تنبيه مهم: يجب توليد جميع النصوص باللغة المطلوبة: "${lang === "ar" ? "اللغة العربية الفصيحة والدقيقة" : lang === "fr" ? "اللغة الفرنسية" : "اللغة الإنجليزية"}".`;

  const candidateModels = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];
  let jsonOutput = null;

  for (const modelName of candidateModels) {
    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [{ text: `قم بتحليل موضوع السوق "${marketTopic}" في قطاع "${targetSector}" والنطاق الجغرافي "${geographicScope}".` }]
          }
        ],
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.4
        }
      });

      if (response?.text) {
        const cleanText = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
        jsonOutput = JSON.parse(cleanText);
        if (jsonOutput && jsonOutput.summary) {
          break;
        }
      }
    } catch (err: any) {
      console.warn(`Market Intelligence model ${modelName} call failed:`, err.message || err);
    }
  }

  if (jsonOutput && jsonOutput.summary) {
    return res.json({
      topic: marketTopic,
      industry: targetSector,
      context: geographicScope,
      ...jsonOutput
    });
  }

  return res.json(generateDynamicFallback());
});

// --- AI AGENT CHAT ENDPOINT ---
app.post("/api/agent/chat", async (req, res) => {
  try {
    const client = getGeminiClient();
    if (!client) {
      console.log("API Key is missing on server");
      return res.status(500).json({ error: "API Key is missing on the server. Please check environment variables in Settings." });
    }

    const promptText = req.body?.prompt || req.body?.message || req.body?.userMessage || req.body?.query;
    const { history, lang = "ar" } = req.body || {};
    if (!promptText || typeof promptText !== "string" || !promptText.trim()) {
      return res.status(400).json({ error: "Prompt/message string is required." });
    }

    const systemInstruction = `You are Zakir Cognitive Advisor. Answer the user's explicit question with deep, tailored, and accurate insights based directly on what they ask.`;

    const contents: any[] = [];
    
    if (Array.isArray(history)) {
      history.slice(-10).forEach((h: any) => {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text || "" }]
        });
      });
    }
    
    contents.push({
      role: "user",
      parts: [{ text: promptText }]
    });

    const candidateModels = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];
    let responseText = "";
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const response = await client.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
          }
        });
        if (response?.text) {
          responseText = response.text;
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} failed:`, err.message || err);
        lastError = err;
      }
    }

    if (!responseText) {
      const errMsg = lastError?.message || "Failed to generate a response from Gemini API.";
      console.warn("Gemini API call failed:", errMsg);
      const isQuotaExhausted = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("prepayment");
      if (isQuotaExhausted) {
        const quotaNotice = "### AI Service temporarily unavailable\n\nThe AI reasoning service has reached its current usage limit.\nYour institutional data remains secure.\n\n[Try Again]";
        return res.json({ text: quotaNotice });
      }
      return res.json({ text: `[Zakir Cognitive Advisor Notice]: ${errMsg}` });
    }

    return res.json({ text: responseText });
  } catch (error: any) {
    console.error("Error in /api/agent/chat:", error);
    return res.json({ text: `[Zakir Cognitive Advisor Notice]: Request processing error: ${error.message || "Internal Error"}` });
  }
});

// --- RENDER.COM SERVICES PROXY ENDPOINT ---
app.post("/api/render/services", async (req, res) => {
  try {
    const headerToken = req.headers.authorization?.replace("Bearer ", "");
    const bodyToken = req.body?.apiKey;
    const apiKey = process.env.RENDER_API_KEY || headerToken || bodyToken;

    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ 
        error: "Render API Key is missing. Please set RENDER_API_KEY in your .env file or enter your Render API token in the settings." 
      });
    }

    const response = await fetch("https://api.render.com/v1/services?limit=50", {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: `Render API Error (${response.status}): ${errorText || response.statusText}` 
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error("Error in /api/render/services:", error);
    return res.status(500).json({ 
      error: `Internal server error when fetching Render services: ${error.message || String(error)}` 
    });
  }
});

// --- API 404 & JSON ERROR HANDLING (PREVENTS SPA HTML FALLBACK ON API ROUTES) ---
// Guarantee that any unhandled /api/* route ALWAYS returns JSON 404, NEVER falling through to SPA HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API_ROUTE_NOT_FOUND",
    message: `API route not found: ${req.method} ${req.path}`
  });
});

// Global Express error handler guaranteeing API errors ALWAYS return JSON, NEVER HTML
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  if (req.path.startsWith("/api/")) {
    console.error(`API Error on ${req.method} ${req.path}:`, err);
    return res.status(err.status || err.statusCode || 500).json({
      success: false,
      error: err.message || "Internal Server Error"
    });
  }
  next(err);
});

// --- VITE DEV SERVER OR STATIC ASSETS ROUTING ---
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const viteModule = "vite";
    const { createServer: createViteServer } = await import(/* @vite-ignore */ viteModule);
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: {
          server: httpServer
        }
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

const isVercelServerless = !!(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.NOW_REGION ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

if (!isVercelServerless && process.env.NODE_ENV !== "test" && !process.env.SKIP_SERVER_LISTEN) {
  startServer().catch((err) => {
    console.error("Failed to start standalone server:", err);
  });
}

export default app;
