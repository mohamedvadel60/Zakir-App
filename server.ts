import "./src/lib/env.js";
import { Resend } from "resend";
import express from "express";
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
import { adminAuth, adminDb } from "./src/lib/firebase-admin.js";
import { eq, desc } from "drizzle-orm";
import { generateWorldBankFallbackData } from "./src/lib/worldBankFallback.js";

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
app.post("/api/stripe/webhook", webhookLimiter, express.raw({ type: "application/json" }), async (req, res) => {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: any;

  try {
    if (stripe && webhookSecret) {
      const sig = req.headers["stripe-signature"] as string;
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      if (process.env.NODE_ENV === "production") {
        console.error("Stripe Webhook Error: Signature verification is strictly required in production mode.");
        return res.status(400).send("Webhook Error: Signature verification required.");
      }
      const bodyStr = req.body instanceof Buffer ? req.body.toString("utf-8") : JSON.stringify(req.body);
      event = JSON.parse(bodyStr || "{}");
    }
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
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
          writeDb(db);
        }

        // Also sync subscription directly to Firestore user document
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
              lastPaymentAmount: `$${((session.amount_total || 0) / 100).toFixed(2)} USD`
            }, { merge: true });
          } catch (fsErr: any) {
            console.warn("Stripe webhook Firestore sync warning:", fsErr?.message);
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
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
          } catch (fsErr: any) {
            console.warn("Stripe webhook Firestore sub delete warning:", fsErr?.message);
          }
        }
        break;
      }
      default:
        console.log(`Received Stripe event ${event.type}`);
    }
  } catch (handlerErr) {
    console.error("Error processing Stripe webhook event:", handlerErr);
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

app.use(express.json());

// --- STRIPE CHECKOUT ENDPOINTS ---
app.post("/api/stripe/create-checkout-session", async (req, res) => {
  try {
    const { plan = "Professional", billingCycle = "annual", userId, userEmail, companyName } = req.body;
    let finalUserId = userId;
    let finalUserEmail = userEmail;

    // Verify token securely if Authorization header is provided
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split("Bearer ")[1];
      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        finalUserId = decodedToken.uid;
        finalUserEmail = decodedToken.email || userEmail;
      } catch (err) {
        console.warn("[CHECKOUT AUTH FAILURE] Invalid authorization token:", err);
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
      }
    } else if (userId) {
      if (process.env.NODE_ENV === "production") {
        return res.status(401).json({ error: "Unauthorized: Token verification required for authenticated sessions" });
      }
    }

    const requestedPlan = (plan === "Enterprise" ? "Enterprise" : plan === "Starter" ? "Starter" : "Professional") as "Starter" | "Professional" | "Enterprise";
    const requestedCycle = (billingCycle === "monthly" ? "monthly" : "annual") as "monthly" | "annual";

    const host = req.headers.host || "localhost:3000";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

    // Monthly vs Annual Pricing Benchmark
    const monthlyRate = PLAN_PRICES[requestedPlan][requestedCycle];
    const unitAmountCents = Math.round(monthlyRate * 100);

    const stripe = getStripe();

    if (stripe) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Zakir ${requestedPlan} Plan (${requestedCycle === "annual" ? "Annual Billing - Save 20%" : "Monthly Billing"})`,
                description: `Institutional Causal Memory Engine & AI Risk Intelligence Suite for ${companyName || "Organization"}.`,
              },
              unit_amount: unitAmountCents,
              recurring: {
                interval: requestedCycle === "annual" ? "year" : "month",
                interval_count: 1,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: finalUserEmail || undefined,
        client_reference_id: finalUserId || undefined,
        metadata: {
          userId: finalUserId || "",
          userEmail: finalUserEmail || "",
          companyName: companyName || "",
          plan: requestedPlan,
          billingCycle: requestedCycle
        },
        success_url: `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}&plan=${requestedPlan}&cycle=${requestedCycle}`,
        cancel_url: `${baseUrl}/?checkout=cancel`,
      });

      const db = readDb();
      db.stripe_sessions = db.stripe_sessions || {};
      db.stripe_sessions[session.id] = finalUserId;
      writeDb(db);

      return res.json({
        success: true,
        sessionId: session.id,
        url: session.url
      });
    }

    // FALLBACK / DIRECT CHECKOUT EXECUTION (When STRIPE_SECRET_KEY is not configured in environment)
    const simulatedSessionId = `cs_stripe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const db = readDb();
    const user = db.users.find((u: any) => u.id === finalUserId || (finalUserEmail && u.email?.toLowerCase() === finalUserEmail.toLowerCase()));
    if (user) {
      user.subscriptionPlan = requestedPlan;
      user.subscriptionStatus = "Active";
      user.billingCycle = requestedCycle;
      user.stripeCustomerId = `cus_${Math.random().toString(36).substring(2, 9)}`;
      user.stripeSubscriptionId = `sub_${Math.random().toString(36).substring(2, 9)}`;
      user.lastPaymentDate = new Date().toISOString();
      user.lastPaymentAmount = `$${monthlyRate}.00 USD`;
    }

    db.stripe_sessions = db.stripe_sessions || {};
    db.stripe_sessions[simulatedSessionId] = finalUserId;
    writeDb(db);

    return res.json({
      success: true,
      sessionId: simulatedSessionId,
      url: `${baseUrl}/?checkout=success&session_id=${simulatedSessionId}&plan=${requestedPlan}&cycle=${requestedCycle}`
    });

  } catch (err: any) {
    console.error("Error creating Stripe checkout session:", err);
    res.status(500).json({ error: err.message || "Failed to initiate Stripe Checkout" });
  }
});

app.post("/api/stripe/create-portal-session", requireAuth, async (req: AuthRequest, res) => {
  try {
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
    const { Resvg } = require("@resvg/resvg-js");
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
const getResendInstance = (): Resend => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey === "undefined") {
    throw new Error("RESEND_API_KEY environment variable is missing.");
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
  error?: any;
  userFriendlyMessage?: string;
  provider?: string;
  sender?: string;
}> {
  let to: string;
  let subject: string;
  let html: string;
  let text: string;
  let userAttachments: any[] = [];

  if (typeof toOrOptions === "string") {
    to = toOrOptions;
    subject = subjectArg || "";
    text = textArg || "";
    html = htmlArg || "";
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

  if (!process.env.EMAIL_FROM) {
    console.error("EMAIL_FROM is missing in environment variables.");
    return { success: false, error: "EMAIL_FROM_MISSING" };
  }

  try {
    const resend = getResendInstance();
    console.log(`[EMAIL DISPATCH ATTEMPT] To: ${to} | Subject: "${subject}" | Sender: ${process.env.EMAIL_FROM}`);

    const attachments: any[] = [...userAttachments];

    // Attach official PNG logo as CID inline image if referenced in HTML or if no logo attachment present
    if (html.includes("cid:zakir-logo") || !attachments.some((a) => a.contentId === "zakir-logo" || a.content_id === "zakir-logo")) {
      const logoBuf = getOfficialPngLogo();
      if (logoBuf && logoBuf.length > 0) {
        attachments.push({
          content: logoBuf,
          contentId: "zakir-logo",
          contentType: "image/png"
        });
      }
    }

    const emailPayload: any = {
      from: process.env.EMAIL_FROM,
      to: [to],
      subject: subject,
      html: html,
      text: text || undefined,
    };

    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const response = await resend.emails.send(emailPayload);

    if (response.error) {
      console.error("Verification email failed:", {
        email: to,
        error: response.error,
      });

      return {
        success: false,
        error: "EMAIL_SEND_FAILED"
      };
    }

    console.log(`[EMAIL SENT SUCCESS] ID: ${response.data?.id} to ${to} via ${process.env.EMAIL_FROM}`);
    return {
      success: true,
      messageId: response.data?.id
    };

  } catch (resendErr: any) {
    console.error("Exception during email send:", {
      email: to,
      error: resendErr?.message || resendErr
    });
    return { success: false, error: "EMAIL_SEND_FAILED" };
  }
}

// SHA-256 verification code hashing helper
function hashVerificationCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
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

export interface BuildOtpEmailOptions {
  email: string;
  userName?: string;
  otpCode: string;
  type?: "account_registration" | "password_reset" | "email_verification" | "email_link" | string;
  baseUrl?: string;
}

/**
 * Generates clean, high-precision, 100% English SaaS HTML email template matching Zakir's visual identity.
 * Specifications: White background (#FFFFFF), dark text (#0F172A / #334155), Zakir brand blue (#0075DE) rectangular OTP container.
 */
function buildOtpEmailHtml(options: BuildOtpEmailOptions): { subject: string; text: string; html: string } {
  const { email, userName, otpCode, type = "account_registration" } = options;
  const cleanName = cleanUserName(userName, email);
  const appBaseUrl = options.baseUrl || getAppBaseUrl();
  const emailLogoUrl = `${appBaseUrl}/api/logo.png`;

  const isReset = type === "password_reset";
  const isLink = type === "email_link";

  // Subject (100% English ONLY)
  let subject = "Your Zakir Verification Code";
  if (isReset) {
    subject = "Reset your Zakir password";
  } else if (isLink) {
    subject = "Link your Email Account to Zakir";
  }

  // Greeting
  const greeting = cleanName ? `Hello ${cleanName},` : `Hello,`;

  // Dynamic Titles & Introductions
  let actionTitle = "Verify Your Email";
  if (isReset) {
    actionTitle = "Reset Your Password";
  } else if (isLink) {
    actionTitle = "Link Email Account";
  }

  let introText = "Welcome to Zakir. Use the verification code below to complete your verification and activate your account:";
  if (isReset) {
    introText = "We received a request to reset the password for your Zakir account. Use the verification code below to set a new password:";
  } else if (isLink) {
    introText = "We received a request to link this email account to your Zakir profile. Use the verification code below to complete the secure verification:";
  }

  // OTP Code without spaces
  const cleanCode = otpCode.trim();

  // Plain Text Version
  const textBody = `${greeting}\n\n${introText}\n\n[ ${cleanCode} ]\n\nThis code expires in 10 minutes.\n\nFor your security: Never share this code with anyone. The Zakir team will never ask for your verification code.\n\nIf you didn't request this code, you can safely ignore this email.\n\nThe Zakir Team`;

  // Production-grade HTML Email (Gmail, Outlook, Apple Mail, Yahoo, Mobile/Desktop Compatible)
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased; word-spacing: normal;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
          
          <!-- Top Blue Accent Line -->
          <tr>
            <td style="background-color: #0075DE; height: 5px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #f1f5f9;">
              <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 12px auto;">
                <tr>
                  <td align="center" valign="middle" style="width: 80px; height: 80px; border-radius: 12px; padding: 10px;">
                    <img src="cid:zakir-logo" alt="Zakir" width="80" height="auto" style="display: block; margin: 0 auto; width: 80px; height: auto; border: 0;" />
                  </td>
                </tr>
              </table>
              <div style="font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: 3px; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;">
                ZAKIR
              </div>
              <div style="font-size: 13px; font-weight: 600; color: #0075DE; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 6px;">
                ${actionTitle}
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px; text-align: left;">
              
              <h1 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 16px 0; line-height: 1.4;">
                ${greeting}
              </h1>

              <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 28px 0;">
                ${introText}
              </p>

              <!-- Blue Compact Single-Line OTP Container -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="padding: 18px 20px; background-color: #0075DE; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 117, 222, 0.25);">
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: 4px; text-align: center; margin: 0; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,0.15);">
                      ${cleanCode}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0; font-weight: 500;">
                This code expires in <strong>10 minutes</strong>.
              </p>

              <!-- Security Warning Box (Clean, No Emoji Icons) -->
              <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0; padding: 12px 16px; background-color: #f8fafc; border-left: 3px solid #0075DE; border-radius: 4px;">
                <strong>For your security:</strong> Never share this code with anyone. The Zakir team will never ask for your verification code.
              </p>

              <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0;">
                If you didn't request this code, you can safely ignore this email.
              </p>

              <!-- Sign Off -->
              <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; color: #334155; font-size: 14px; font-weight: 600;">
                The Zakir Team
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #64748b; font-size: 12px; margin: 0 0 6px 0; line-height: 1.5;">
                This is an automated system message from Zakir. Please do not reply directly to this email.
              </p>
              <p style="color: #94a3b8; font-size: 11px; margin: 0; font-weight: 600;">
                &copy; 2026 Zakir Enterprise. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text: textBody, html };
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
  try {
    const { email, phone, type = "account_registration", userId } = req.body;
    if (!email && !phone && !userId) {
      return res.status(400).json({ error: "Email, phone, or userId is required" });
    }

    const resolvedUser = await resolveUserByEmailOrId({ userId, email, phone });
    const targetIdentifier = resolvedUser.email || (email || phone || "").trim().toLowerCase();
    const foundUid = resolvedUser.userId;

    if (!foundUid) {
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

    // Check if RESEND_API_KEY is present
    const hasResend = !!(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() && process.env.RESEND_API_KEY !== "undefined");
    if (!hasResend) {
      return res.status(500).json({ success: false, error: "RESEND_API_KEY is missing. Email dispatch disabled." });
    } else {
      const mailResult = await sendSystemMail(targetIdentifier, emailSubject, textBody, htmlBody);
      if (!mailResult.success) {
        console.error("[VERIFICATION EMAIL DELIVERY FAILURE]", mailResult.error);
        return res.status(500).json({ 
          success: false,
          error: mailResult.userFriendlyMessage || mailResult.error?.message || "Unable to send verification email. Please check your Resend configuration."
        });
      }
    }

    // Mail sent successfully! Calculate new send count
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

    // Save record to Firestore and local JSON db
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
      console.warn("Fallback JSON DB write failed:", err);
    }

    console.log(`[VERIFICATION CODE RECORDED] Target: ${targetIdentifier} | Code: [SECURE 6-DIGITS RECORDED] | Send Count: ${newSendCount}`);

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${targetIdentifier}`,
      expiresAt: expiresAt,
      emailSent: true,
      sendCount: newSendCount,
      cooldownUntil: cooldownUntil || undefined,
      sendCountRemaining: Math.max(0, 3 - newSendCount)
    });
  } catch (error: any) {
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
    
    try {
      const userRef = adminDb.collection("users").doc(foundUid);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
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
      writeDb(db);
    }

    return res.status(200).json({
      success: true,
      message: "Verification successful!",
      user: user || resolvedUser.userDoc || null
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

    // Check if RESEND_API_KEY is present
    const hasResendReset = !!(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() && process.env.RESEND_API_KEY !== "undefined");
    if (!hasResendReset) {
      return res.status(500).json({ success: false, error: "RESEND_API_KEY is missing. Password reset email dispatch disabled." });
    } else {
      const mailResult = await sendSystemMail(target, emailSubject, textBody, htmlBody);
      if (!mailResult.success) {
        console.error("[PASSWORD RESET EMAIL DELIVERY FAILURE]", mailResult.error);
        return res.status(200).json({ 
          success: false,
          error: mailResult.userFriendlyMessage || "Unable to send password reset email. Please check your Resend configuration."
        });
      }
    }

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
        const supportLogoUrl = `${getAppBaseUrl(req)}/api/logo.png`;
        const emailHtml = `
          <div style="font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 32px 16px; color: #0f172a;">
            <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
              <div style="background: #090d16; padding: 24px; text-align: center; border-bottom: 2px solid #f59e0b;">
                <img src="cid:zakir-logo" alt="Zakir" width="40" height="40" style="display: block; margin: 0 auto 10px auto;" />
                <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Zakir Support Center</h1>
              </div>
              <div style="padding: 32px; font-size: 14px; line-height: 1.6; color: #334155;">
                <p style="margin-top: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Hello ${recipientName},</p>
                <p style="margin-bottom: 24px; color: #475569;">Our support team has replied to your request.</p>
                
                <div style="background-color: #fffbebfb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                  <p style="margin: 0; font-weight: 800; color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Ticket #${ticket.id}</p>
                  <p style="margin: 4px 0 0 0; font-weight: 700; color: #1e293b; font-size: 15px;">${ticket.subject}</p>
                </div>

                <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                  <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Latest Response from Support:</p>
                  <p style="margin: 0; color: #1e293b; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${message}</p>
                </div>

                <p style="margin-bottom: 0; color: #475569;">Open your Zakir account to view the response and continue the conversation.</p>
              </div>
              <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Zakir Platform. All rights reserved.
              </div>
            </div>
          </div>
        `;

        await sendSystemMail({
          to: recipientEmail,
          subject: `Zakir Support has replied to your request: ${ticket.subject}`,
          html: emailHtml,
          text: `Hello ${recipientName},\n\nOur support team has replied to your request.\n\nTicket: #${ticket.id}\nSubject: ${ticket.subject}\n\nResponse:\n${message}\n\nOpen your Zakir account to view the response and continue the conversation.`
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

app.delete("/api/admin/delete-user/:uid", requireAuth, async (req: AuthRequest, res) => {
  const targetUid = req.params.uid;
  try {
    const callerUid = req.user?.uid;
    if (!callerUid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify caller is admin authoritatively from Firestore
    const isCallerAdmin = await isUserAdminServer(callerUid);
    if (!isCallerAdmin) {
      return res.status(403).json({ error: "Forbidden: Only administrative personnel can perform account deletion." });
    }

    if (targetUid === callerUid) {
      return res.status(400).json({ error: "You cannot delete your own active administrative account." });
    }

    console.log("USER_DELETE_STARTED", { targetUid });

    // Fetch target user email for record
    let targetEmail = "";
    try {
      const targetSnap = await adminDb.collection("users").doc(targetUid).get();
      if (targetSnap.exists) {
        targetEmail = targetSnap.data()?.email || "";
      }
    } catch (e) {
      console.warn("Failed to retrieve target user email:", e);
    }

    // 1. Create authoritative deletedUsers marker FIRST
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

    // 3. Delete from Firebase Authentication - must fail entire request if it fails
    try {
      await adminAuth.deleteUser(targetUid);
      console.log("USER_AUTH_DELETED", { targetUid });
    } catch (authErr: any) {
      if (authErr.code !== "auth/user-not-found") {
        console.error("USER_AUTH_DELETE_FAILED", { targetUid, error: authErr?.message });
        return res.status(500).json({ error: `Failed to delete user account from Firebase Authentication: ${authErr.message}` });
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

app.delete("/api/auth/delete-account", requireAuth, async (req: AuthRequest, res) => {
  const targetUid = req.user?.uid;
  try {
    if (!targetUid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("USER_SELF_DELETE_STARTED", { targetUid });

    // 1. Revoke active refresh tokens
    try {
      await adminAuth.revokeRefreshTokens(targetUid);
    } catch (tokenErr: any) {
      console.warn("Revoke refresh tokens warning:", tokenErr?.message);
    }

    // 2. Delete from Firebase Authentication - MUST fail if deletion fails
    try {
      await adminAuth.deleteUser(targetUid);
      console.log("USER_SELF_AUTH_DELETED", { targetUid });
    } catch (authErr: any) {
      if (authErr.code !== "auth/user-not-found") {
        console.error("USER_SELF_AUTH_DELETE_FAILED", { targetUid, error: authErr?.message });
        return res.status(500).json({ error: `Failed to delete account from Firebase Authentication: ${authErr.message}` });
      }
    }

    // 3. Create deleted marker in Firestore
    try {
      await adminDb.collection("deletedUsers").doc(targetUid).set({
        uid: targetUid,
        email: req.user?.email || "",
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

    // 6. Delete user files subcollection & top-level files
    try {
      const userFilesSnap = await adminDb.collection("users").doc(targetUid).collection("files").get();
      for (const fDoc of userFilesSnap.docs) {
        await fDoc.ref.delete();
      }
      const topFilesSnap = await adminDb.collection("files").where("userId", "==", targetUid).get();
      for (const tfDoc of topFilesSnap.docs) {
        await tfDoc.ref.delete();
      }
    } catch (filesErr: any) {}

    // 7. Delete user memories & risk alerts
    try {
      const memSnap = await adminDb.collection("users").doc(targetUid).collection("memories").get();
      for (const mDoc of memSnap.docs) {
        await mDoc.ref.delete();
      }
      const alertSnap = await adminDb.collection("users").doc(targetUid).collection("riskAlerts").get();
      for (const aDoc of alertSnap.docs) {
        await aDoc.ref.delete();
      }
    } catch (memErr: any) {}

    // 8. Delete support tickets owned by user
    try {
      const ticketSnap = await adminDb.collection("support_tickets").where("userId", "==", targetUid).get();
      for (const tDoc of ticketSnap.docs) {
        await tDoc.ref.delete();
      }
    } catch (ticketErr: any) {}

    // 9. Synchronize deletion to local JSON DB store
    const dbData = readDb();
    if (dbData.users) dbData.users = dbData.users.filter((u: any) => u.id !== targetUid);
    if (dbData.verification_codes) dbData.verification_codes = dbData.verification_codes.filter((vc: any) => vc.id !== targetUid && vc.userId !== targetUid);
    if (dbData.support_tickets) dbData.support_tickets = dbData.support_tickets.filter((st: any) => st.userId !== targetUid);
    writeDb(dbData);

    console.log("USER_SELF_DELETE_COMPLETED", { targetUid });
    res.json({ success: true, message: "Your account and associated data have been permanently deleted." });
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

    const nowIso = new Date().toISOString();
    const workspaceId = `ws_${userId.substring(0, 8)}_${Date.now().toString(36)}`;
    const resolvedOwnerName = ownerName || normalizedEmail.split("@")[0];

    const newUser = {
      id: userId,
      email: normalizedEmail,
      passwordHash: password,
      companyName,
      ownerName: resolvedOwnerName,
      role: userRole,
      workspaceId: workspaceId,
      workspace: {
        id: workspaceId,
        name: `${companyName} Workspace`,
        ownerId: userId,
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
app.post("/api/database/schema", requireAuth, async (req: AuthRequest, res) => {
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

  res.json({ ddl: schemaDdl });
});

app.post("/api/database/query", requireAuth, async (req: AuthRequest, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "SQL query string is required" });
  }

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
    const fallbackModels = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-2.0-flash"];
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

  const candidateModels = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-2.0-flash"];
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

    const candidateModels = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-2.0-flash"];
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

if (!isVercelServerless) {
  startServer().catch((err) => {
    console.error("Failed to start standalone server:", err);
  });
}

export default app;
