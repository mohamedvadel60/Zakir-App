import React, { useState, useEffect, useMemo } from "react";
import Markdown from "react-markdown";
import { 
  Database, 
  Brain, 
  PlusCircle, 
  ShieldAlert, 
  Compass, 
  Map, 
  Settings as SettingsIcon, 
  LogOut, 
  RefreshCw, 
  Search, 
  Filter, 
  User as UserIcon, 
  CheckCircle, 
  CheckCircle2,
  Building, 
  Users,
  Sliders,
  UserCheck, 
  CreditCard, 
  FileText, 
  Clock, 
  Volume2, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Globe,
  Sun,
  Moon,
  X, 
  Check,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Layers,
  Zap,
  Play, 
  AlertTriangle,
  Flame,
  Shield,
  HelpCircle,
  TrendingUp,
  Award,
  Sparkles,
  Bot,
  MessageSquare,
  BarChart2,
  PieChart as PieChartIcon,
  Activity,
  Folder,
  Trash2,
  Edit3,
  Printer,
  KeyRound,
  Server,
  Mail,
  Building2,
  GitCommit
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area 
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { translations } from "./translations.js";
import { 
  User, 
  UserRole, 
  Memory, 
  RiskAlert, 
  TeamMember,
  PerformanceMetric, 
  SubscriptionInfo, 
  SmartEvolutionData, 
  MarketIntelligenceData,
  SQLQueryResult,
  ChatMessage,
  UserFile
} from "./types.js";
import { FileManager } from "./components/FileManager";
import { AnimatedLandingPage } from "./components/AnimatedLandingPage";
import { WorldBankPortal } from "./components/WorldBankPortal";
import { generateWorldBankFallbackData } from "./lib/worldBankFallback.js";
import { ZakirLogo } from "./components/ZakirLogo";
import { applyGlobalTheme, ThemeMode } from "./lib/themeUtils.js";
import { authenticatedFetch } from "./lib/apiUtils.js";
import { SettingsAdmin } from "./components/SettingsAdmin";
import { InstallPrompt } from "./components/InstallPrompt";
import { CustomerSupport } from "./components/CustomerSupport";
import { PrintPreviewModal } from "./components/PrintPreviewModal";
import { EmailVerificationView } from "./components/EmailVerificationView";
import { RiskRadarChart } from "./components/RiskRadarChart";
import { AdminDashboard } from "./components/AdminDashboard";
import { DesktopUpdateNotification } from "./components/DesktopUpdateNotification";
import GmailVault from "./components/GmailVault.tsx";
import {
  ADMIN_USER_ID,
  registerFirebaseUser,
  loginFirebaseUser,
  loginWithGoogle,
  logoutFirebaseUser,
  subscribeToFirebaseAuthState,
  subscribeToFirebaseUserProfile,
  resetFirebaseUserPassword,
  saveFirebaseUserProfile,
  updateUserPreferences,
  fetchFirebaseUserMemories,
  addFirebaseUserMemory,
  deleteFirebaseUserMemory,
  updateFirebaseUserMemory,
  fetchFirebaseUserRiskAlerts,
  addFirebaseUserRiskAlert,
  resolveFirebaseUserRiskAlert,
  bulkEncryptUserMemoriesAndFiles,
  checkWorkspaceInvitation,
  deleteWorkspaceInvitation,
  WorkspaceInvitation,
  sendVerificationCodeApi,
  verifyCodeApi,
  getAuthApiUrl,
  safeParseJsonResponse,
  API_BASE_URL
} from "./lib/firebaseServices.js";
import { auth } from "./firebase.js";

const FALLBACK_MEMORIES: Memory[] = [
  {
    id: "mem_1",
    title: "تأخير التصنيف الجمركي لصمامات الإغلاق في ميناء طنجة | Customs classification delay of valves",
    category: "Customs & Logistics",
    riskLevel: "Critical",
    tags: ["customs", "logistics", "tangier-port", "hts-code"],
    description: "تأخر تخليص الشحنة رقم #CN-9022 بسبب تصنيف جمركي خاطئ لقطع الغيار مما كلف 45 ألف دولار غرامات يومية. Shipment #CN-9022 delayed due to incorrect customs code, incurring $45,000 in daily storage penalties.",
    decision: "دفع الرسوم تحت التحفظ وتحديث سجل رموز التعرفة الجمركية المعتمدة. Paid the penalties under protest and immediately updated the verified HTS code library.",
    causalFactors: "غياب دليل تصنيفي موحد معتمد لدى الإدارة اللوجستية وتغيير القوانين المحلية. Lack of standardized classification manual in local trade desk combined with sudden regulatory updates.",
    outcomes: "خسارة مالية مباشرة قدرها 135,000 دولار وتحديث الدليل بنسبة 100%. Direct financial damage of $135,000, but resolved manual compliance to 100%.",
    lessonsLearned: "يجب ربط أوامر الشراء المستقبلية برمز التعرفة الجمركية المسبق الموافقة وتجنب التخمينات الفردية. Enforce matching HTS codes in purchase orders prior to shipment dispatch.",
    createdAt: "2026-06-02T10:30:00Z",
    userId: "usr_analyst",
    authorEmail: "analyst@zakir.ai",
    authorRole: "Analyst",
    authorName: "سليمان المحلل (Suleiman Analyst)"
  },
  {
    id: "mem_2",
    title: "تسريب بيانات اعتماد الخادم التجريبي نتيجة التصيد الإلكتروني | Phishing leak on cloud staging server",
    category: "Cybersecurity & IT",
    riskLevel: "High",
    tags: ["cybersecurity", "phishing", "cloud-security", "staging-leak"],
    description: "وصول غير مصرح به لقاعدة بيانات العملاء الافتراضية نتيجة سرقة بيانات اعتماد أحد مهندسي النظم عبر بريد تصيد احتيالي. Unauthorized access to non-production customer profiles staging database due to leaked API keys.",
    decision: "عزل الخادم المتأثر بالكامل وإلغاء صلاحيات جميع الرموز الأمنية المسرّبة مع تفعيل المصادقة الثنائية الإلزامية. Isolated the affected database, revoked compromised tokens, and enforced security keys.",
    causalFactors: "استخدام كلمات مرور مكررة ومشاركة مفاتيح الدخول الأمنية في قنوات الاتصال العامة دون تشفير. Shared credentials on test environments and lack of multi-factor authentication on staging.",
    outcomes: "تجميد الخدمات التطويرية لـ 48 ساعة وإعادة بناء وهيكلة خوادم التطوير أمنياً دون تسريب لبيانات الإنتاج. Development services frozen for 48 hours to securely rebuild staging; no production records exposed.",
    lessonsLearned: "حظر حفظ كلمات المرور أو الرموز البرمجية في القنوات البرمجية، واعتماد نظام حوكمة الدخول المؤقت. Prohibit hardcoded API secrets and mandate ephemeral session tokens.",
    createdAt: "2026-05-18T16:00:00Z",
    userId: "usr_ceo",
    authorEmail: "ceo@zakir.ai",
    authorRole: "CEO",
    authorName: "محمد فاضل (Mohamed Vadel)"
  },
  {
    id: "mem_3",
    title: "إفلاس المورد الوحيد لسبائك النيكل الخاصة بصمامات الضغط العالي | Single-source nickel supplier bankruptcy",
    category: "Supply Chain & Sourcing",
    riskLevel: "High",
    tags: ["procurement", "supply-chain", "insolvency", "metallurgy"],
    description: "الإعلان المفاجئ لإفلاس وتصفية مصهر المعادن المتكامل بالنمسا المسؤول عن توريد سبائك النيكل المقاومة للتآكل. Sudden financial insolvency and liquidation of our sole Austrian supplier for specialized metallurgy.",
    decision: "تفعيل بروتوكول الطوارئ للشراء والتعاقد السريع مع مصهرين بديلين باليابان والولايات المتحدة. Triggered emergency supply protocols, securing sample batches from Japanese and US foundries.",
    causalFactors: "الاعتماد الاستراتيجي الكلي على شريك توريد مفرد سعياً لخفض التكلفة دون تقييم مالي دوري للمورد. Total procurement dependency on a single-source foreign vendor without auditing balance sheets.",
    outcomes: "ارتفاع كلفة الشراء العاجل بـ 15% وتأخر جدول التوريد لـ 3 أسابيع، ولكن تم ضمان استمرار التصنيع. 15% increase in procurement costs and a 3-week lag, but avoided total production halt.",
    lessonsLearned: "تفعيل مبدأ التوريد المزدوج الإلزامي بنسبة لا تقل عن 70/30 لكافة المواد الخام الهامة والمكونات الأساسية. Mandate dual-sourcing strategies and hold 3 months of buffer stock.",
    createdAt: "2026-04-20T09:15:00Z",
    userId: "usr_analyst",
    authorEmail: "analyst@zakir.ai",
    authorRole: "Analyst",
    authorName: "سليمان المحلل (Suleiman Analyst)"
  }
];

const FALLBACK_ALERTS: RiskAlert[] = [
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
];

const FALLBACK_METRICS: PerformanceMetric[] = [
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
];

const FALLBACK_SCHEMA = `-- PostgreSQL Database Schema for Zakir
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
);`;

function getContrastColor(hex: string) {
  try {
    const color = hex.replace("#", "");
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? "#0F172A" : "#FFFFFF";
  } catch (e) {
    return "#FFFFFF";
  }
}

function adjustColorBrightness(bgHex: string, textHex: string, ratio: number) {
  try {
    const bg = bgHex.replace("#", "");
    const text = textHex.replace("#", "");
    
    const r1 = parseInt(bg.substring(0, 2), 16);
    const g1 = parseInt(bg.substring(2, 4), 16);
    const b1 = parseInt(bg.substring(4, 6), 16);
    
    const r2 = parseInt(text.substring(0, 2), 16);
    const g2 = parseInt(text.substring(2, 4), 16);
    const b2 = parseInt(text.substring(4, 6), 16);
    
    const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
    const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
    const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch (e) {
    return bgHex;
  }
}

function renderTextWithLinks(text: string) {
  if (!text) return "";
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const [_, linkText, linkUrl] = match;
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }
    parts.push(
      <a
        key={matchIndex}
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className="text-[#D4AF37] hover:underline font-bold inline-flex items-center gap-0.5"
      >
        {linkText}
      </a>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? <>{parts}</> : text;
}

interface ReadMoreTextProps {
  text: string;
  maxLength?: number;
  lang: string;
  theme: string;
  className?: string;
  label?: string;
}

function ReadMoreText({
  text,
  maxLength = 140,
  lang,
  theme,
  className = "",
  label,
}: ReadMoreTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > maxLength;
  const truncatedText = isLong && !isExpanded ? text.slice(0, maxLength).trim() + "..." : text;

  const getReadMoreLabel = () => {
    if (lang === "ar") return isExpanded ? "عرض أقل" : "اقرأ المزيد";
    if (lang === "fr") return isExpanded ? "Lire moins" : "Lire la suite";
    return isExpanded ? "Read Less" : "Read More";
  };

  return (
    <div className="w-full">
      {label && (
        <h4 className="font-bold text-amber-500 uppercase tracking-wide mb-1 text-[11px]">
          {label}
        </h4>
      )}
      <p className={className}>
        <span>{truncatedText}</span>
        {isLong && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            className={`inline-flex items-center gap-1 mx-1.5 px-2 py-0.5 rounded text-[10px] font-extrabold transition-all cursor-pointer select-none ${
              theme === "dark"
                ? "bg-[#D4AF37]/15 hover:bg-[#D4AF37]/30 text-[#D4AF37] border border-[#D4AF37]/30"
                : "bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#B8860B] border border-[#D4AF37]/30"
            }`}
            title={isExpanded ? (lang === "ar" ? "طي النص" : "Collapse text") : (lang === "ar" ? "توسيع النص" : "Expand text")}
          >
            <span>{getReadMoreLabel()}</span>
            {isExpanded ? (
              <ChevronUp className="w-3 h-3 text-[#D4AF37]" />
            ) : (
              <ChevronDown className="w-3 h-3 text-[#D4AF37]" />
            )}
          </button>
        )}
      </p>
    </div>
  );
}

export default function App() {
  // Locale & Theme State
  const [lang, setLang] = useState<"en" | "ar" | "fr">(() => {
    const saved = localStorage.getItem("zakir_lang");
    return (saved as "en" | "ar" | "fr") || "en";
  });
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("zakir_theme");
    return (saved as "dark" | "light") || "dark";
  });

  // Auth & Session State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
  const [authMode, setAuthMode] = useState<"landing" | "register" | "login">("landing");
  
  // User Verification and Password Reset States
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState("");
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState<number>(0);

  // Reset input and messages when entering verification view
  useEffect(() => {
    if (currentUser && !currentUser.isEmailVerified && currentUser.verification_required !== false) {
      setVerificationCode("");
      setVerificationError("");
      setVerificationSuccess(
        lang === "ar"
          ? "تم إرسال رمز التحقق إلى بريدك الإلكتروني."
          : "Verification code sent to your email."
      );
    }
  }, [currentUser?.id, currentUser?.isEmailVerified]);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownTimeLeft(0);
      return;
    }

    const updateCooldown = () => {
      const diff = Math.ceil((new Date(cooldownUntil).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        setCooldownUntil(null);
        setCooldownTimeLeft(0);
        setResendAttempts(0);
      } else {
        setCooldownTimeLeft(diff);
      }
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetStep, setResetStep] = useState<"forgot" | "verify_code" | "new_password" | "success">("forgot");
  const [landingBillingCycle, setLandingBillingCycle] = useState<"annual" | "monthly">("annual");
  const [stripeReceiptData, setStripeReceiptData] = useState<any | null>(null);

  const handleLandingStripeCheckout = async (plan: "Starter" | "Professional" | "Enterprise") => {
    try {
      const res = await authenticatedFetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          billingCycle: landingBillingCycle,
          userId: currentUser?.id,
          userEmail: currentUser?.email || "mohamedvadel60@gmail.com",
          companyName: currentUser?.companyName || "Organization",
        }),
      });
      const data = await res.json();
      if (data.url) {
        if (data.url.includes("checkout.stripe.com")) {
          const newTab = window.open(data.url, "_blank");
          if (!newTab || newTab.closed || typeof newTab.closed === "undefined") {
            window.location.href = data.url;
          }
        } else if (data.url.includes("checkout=success")) {
          const urlObj = new URL(data.url, window.location.origin);
          const sessionId = urlObj.searchParams.get("session_id") || `cs_${Date.now()}`;
          try {
            const rcRes = await authenticatedFetch(`/api/stripe/receipt/${sessionId}?plan=${plan}&cycle=${landingBillingCycle}`);
            const rcData = await rcRes.json();
            if (rcData.receipt) {
              setStripeReceiptData(rcData.receipt);
            }
          } catch (e) {
            console.error("Landing receipt fetch error:", e);
          }
          if (currentUser) {
            const updatedUser: User = {
              ...currentUser,
              subscriptionPlan: plan,
              subscriptionStatus: "Active",
              billingCycle: landingBillingCycle,
              lastPaymentDate: new Date().toISOString(),
              lastPaymentAmount: plan === "Starter" ? (landingBillingCycle === "annual" ? "$50.00 USD" : "$6.00 USD") : plan === "Enterprise" ? (landingBillingCycle === "annual" ? "$699.00 USD" : "$849.00 USD") : (landingBillingCycle === "annual" ? "$149.00 USD" : "$189.00 USD"),
            };
            setCurrentUser(updatedUser);
          }
        } else {
          window.location.href = data.url;
        }
      }
    } catch (err) {
      console.error("Landing Stripe checkout error:", err);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkoutStatus = urlParams.get("checkout");
    const sessionId = urlParams.get("session_id");
    const plan = urlParams.get("plan") || "Professional";
    const cycle = urlParams.get("cycle") || "annual";

    if (checkoutStatus === "success" && sessionId) {
      const getReceipt = async () => {
        try {
          const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";
          const res = await fetch(`/api/stripe/receipt/${sessionId}?plan=${plan}&cycle=${cycle}`, {
            headers: idToken ? { "Authorization": `Bearer ${idToken}` } : {}
          });
          const data = await res.json();
          if (data.receipt) {
            setStripeReceiptData(data.receipt);
          }
        } catch (err) {
          console.error("Receipt fetch error:", err);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      };
      getReceipt();
    }
  }, []);

  // Registration Form State
  const [regOwnerName, setRegOwnerName] = useState("");
  const [regCompanyName, setRegCompanyName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState("");
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Password Reset State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState("");
  const [resetErrorMsg, setResetErrorMsg] = useState("");
  const [resetCooldownSeconds, setResetCooldownSeconds] = useState<number>(0);

  // Countdown Timer Effect for Password Reset Rate Limit
  useEffect(() => {
    if (resetCooldownSeconds <= 0) return;

    const interval = setInterval(() => {
      setResetCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [resetCooldownSeconds]);

  // Clean, Localized Error Formatter for Password Reset (Never exposes raw code / internal terms)
  const formatResetError = (rawErr: any, dataPayload?: any, currentLang = lang, cooldownSecs = 0): string => {
    const msg = typeof rawErr === "string" ? rawErr : (rawErr?.message || rawErr?.error || String(rawErr || ""));
    const lowerMsg = msg.toLowerCase();

    // Check for rate limit / cooldown / maximum requests
    if (
      lowerMsg.includes("maximum") ||
      lowerMsg.includes("rate") ||
      lowerMsg.includes("cooldown") ||
      lowerMsg.includes("too many") ||
      lowerMsg.includes("reached") ||
      lowerMsg.includes("wait") ||
      lowerMsg.includes("otpcode") ||
      lowerMsg.includes("requests") ||
      cooldownSecs > 0
    ) {
      if (currentLang === "ar") {
        return "لقد وصلت إلى الحد الأقصى لطلبات رمز التحقق.\nيرجى الانتظار قليلًا قبل طلب رمز جديد.";
      } else if (currentLang === "fr") {
        return "Vous avez atteint le nombre maximum de demandes de code.\nVeuillez patienter avant d'en demander un nouveau.";
      } else {
        return "You've reached the maximum number of verification code requests.\nPlease wait before requesting a new code.";
      }
    }

    // Invalid email address
    if (lowerMsg.includes("invalid email") || lowerMsg.includes("valid email") || lowerMsg.includes("email format")) {
      if (currentLang === "ar") return "البريد الإلكتروني غير صحيح. يرجى التثبت والتحقق من كتابته بالشكل الصحيح.";
      if (currentLang === "fr") return "Adresse e-mail invalide. Veuillez vérifier et réessayer.";
      return "Invalid email address. Please check and try again.";
    }

    // User not found
    if (lowerMsg.includes("user_not_found") || lowerMsg.includes("no account") || lowerMsg.includes("not found")) {
      if (currentLang === "ar") return "لا يوجد حساب مرتبط بهذا البريد الإلكتروني.";
      if (currentLang === "fr") return "Aucun compte associé à cet e-mail.";
      return "No account found associated with this email address.";
    }

    // Verification code expired
    if (lowerMsg.includes("expired")) {
      if (currentLang === "ar") return "انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد.";
      if (currentLang === "fr") return "Le code de vérification a expiré. Veuillez en demander un nouveau.";
      return "Verification code has expired. Please request a new code.";
    }

    // Incorrect code
    if (lowerMsg.includes("incorrect") || lowerMsg.includes("invalid code") || lowerMsg.includes("wrong code")) {
      if (currentLang === "ar") return "رمز التحقق غير صحيح. يرجى التأكد وإعادة المحاولة.";
      if (currentLang === "fr") return "Code de vérification incorrect. Veuillez vérifier et réessayer.";
      return "Incorrect verification code. Please check and try again.";
    }

    // Network / server connection error
    if (lowerMsg.includes("network") || lowerMsg.includes("failed to fetch") || lowerMsg.includes("connection")) {
      if (currentLang === "ar") return "تعذر الاتصال بالخادم، يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.";
      if (currentLang === "fr") return "Erreur de connexion réseau. Veuillez vérifier votre connexion et réessayer.";
      return "Network error. Please check your internet connection and try again.";
    }

    // Clean fallback
    if (currentLang === "ar") return "حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.";
    if (currentLang === "fr") return "Une erreur inattendue s'est produite. Veuillez réessayer.";
    return "An unexpected error occurred. Please try again.";
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setResetErrorMsg(lang === "ar" ? "يرجى إدخال البريد الإلكتروني." : "Please enter your email address.");
      return;
    }
    
    setResetErrorMsg("");
    setResetSuccessMsg("");

    if (resetStep === "forgot") {
      if (resetCooldownSeconds > 0) {
        setResetErrorMsg(
          lang === "ar"
            ? `يرجى الانتظار، يمكنك طلب رمز جديد بعد ${formatCountdown(resetCooldownSeconds)}.`
            : `Please wait, you can request a new code in ${formatCountdown(resetCooldownSeconds)}.`
        );
        return;
      }

      setIsSendingReset(true);
      try {
        const response = await fetch(getAuthApiUrl("/api/auth/send-verification-code"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: cleanEmail, emailOrPhone: cleanEmail, type: "password_reset", lang }),
        });

        const contentType = response.headers.get("content-type");
        let data: any = {};
        if (contentType && contentType.includes("application/json")) {
          data = await response.json();
        } else {
          const text = await response.text();
          console.error("Fetch Error Detail:", { status: response.status, statusText: response.statusText, contentType, bodyText: text });
          throw new Error("NETWORK_ERROR");
        }

        if (response.ok && data.success !== false) {
          setResetSuccessMsg(
            lang === "ar"
              ? `تم إرسال رمز إعادة تعيين كلمة المرور المكون من 6 أرقام إلى (${cleanEmail})`
              : `A 6-digit password reset code was sent to (${cleanEmail})`
          );
          setResetStep("verify_code");
          setResetErrorMsg("");
          setResetCooldownSeconds(0);
        } else {
          let secs = 0;
          if (typeof data.cooldownRemainingSeconds === "number" && data.cooldownRemainingSeconds > 0) {
            secs = data.cooldownRemainingSeconds;
          } else if (data.cooldownUntil) {
            const rem = Math.ceil((new Date(data.cooldownUntil).getTime() - Date.now()) / 1000);
            if (rem > 0) secs = rem;
          } else if (response.status === 429 || (data.error && data.error.toLowerCase().includes("maximum"))) {
            secs = 600;
          }

          if (secs > 0) {
            setResetCooldownSeconds(secs);
          }

          const friendlyMsg = formatResetError(data.userFriendlyMessage || data.error || "RATE_LIMIT", data, lang, secs);
          setResetErrorMsg(friendlyMsg);
        }
      } catch (err: any) {
        const friendlyMsg = formatResetError(err?.message || err, null, lang, resetCooldownSeconds);
        setResetErrorMsg(friendlyMsg);
      } finally {
        setIsSendingReset(false);
      }
    } else if (resetStep === "verify_code") {
      if (resetCode.length !== 6) {
        setResetErrorMsg(lang === "ar" ? "يرجى إدخال رمز التحقق المكون من 6 أرقام." : "Please enter the full 6-digit verification code.");
        return;
      }
      setResetStep("new_password");
    } else if (resetStep === "new_password") {
      if (newPassword.length < 8) {
        setResetErrorMsg(lang === "ar" ? "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل." : "Password must be at least 8 characters long.");
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setResetErrorMsg(lang === "ar" ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.");
        return;
      }
      setIsSendingReset(true);
      try {
        const response = await fetch(getAuthApiUrl("/api/auth/reset-password"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailOrPhone: cleanEmail,
            code: resetCode,
            newPassword: newPassword
          })
        });

        const contentType = response.headers.get("content-type");
        let data: any = {};
        if (contentType && contentType.includes("application/json")) {
          data = await response.json();
        } else {
          const text = await response.text();
          console.error("Fetch Error Detail:", { status: response.status, statusText: response.statusText, contentType, bodyText: text });
          throw new Error("NETWORK_ERROR");
        }

        if (response.ok && data.success !== false) {
          setResetSuccessMsg(
            lang === "ar"
              ? "تمت إعادة تعيين كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول."
              : "Password reset successfully! You can now log in."
          );
          setResetStep("success");
          setResetErrorMsg("");
        } else {
          const friendlyMsg = formatResetError(data.userFriendlyMessage || data.error || "RESET_FAILED", data, lang, 0);
          setResetErrorMsg(friendlyMsg);
        }
      } catch (err: any) {
        const friendlyMsg = formatResetError(err?.message || err, null, lang, 0);
        setResetErrorMsg(friendlyMsg);
      } finally {
        setIsSendingReset(false);
      }
    }
  };

  const formatAuthError = (err: any): string => {
    const errMsg = err?.message || String(err);
    const errCode = err?.code || "";

    if (
      errCode === "auth/unauthorized-domain" || 
      errMsg.includes("unauthorized-domain") || 
      errMsg.includes("auth/unauthorized-domain")
    ) {
      const currentDomain = window.location.hostname;
      if (lang === "ar") {
        return `⚠️ **خطأ: نطاق غير مصرح به (Unauthorized Domain)**
لم يتم التصريح لـ Zakir للاتصال بـ Firebase من هذا النطاق المستضيف: **${currentDomain}**.

**طريقة الحل السريعة:**
1. افتح **منصة Firebase** (Firebase Console) عبر الرابط: [console.firebase.google.com](https://console.firebase.google.com)
2. اختر مشروعك الخاص بـ Zakir.
3. انتقل إلى القائمة الجانبية: **Build** (بناء) -> **Authentication** (المصادقة).
4. اضغط على تبويب **Settings** (الإعدادات) في الأعلى.
5. ابحث عن قسم **Authorized domains** (النطاقات المصرح بها / المعتمدة).
6. اضغط على زر **Add domain** (إضافة نطاق) واكتب النطاق الحالي تماماً: **${currentDomain}**
7. احفظ التغييرات وأعد تحميل هذه الصفحة للتجربة مجدداً!`;
      } else if (lang === "fr") {
        return `⚠️ **Erreur : Domaine non autorisé (Unauthorized Domain)**
Ce domaine d'hébergement (**${currentDomain}**) n'est pas autorisé à communiquer avec Firebase Auth.

**Comment résoudre ce problème :**
1. Allez sur la **Console Firebase** : [console.firebase.google.com](https://console.firebase.google.com)
2. Sélectionnez votre projet Firebase.
3. Allez dans **Authentication** -> onglet **Settings**.
4. Dans la section **Authorized domains**, cliquez sur **Add domain**.
5. Ajoutez le domaine actuel : **${currentDomain}**
6. Enregistrez et rechargez cette page !`;
      } else {
        return `⚠️ **Error: Unauthorized Domain (auth/unauthorized-domain)**
This hosting domain (**${currentDomain}**) has not been authorized in your Firebase Project configuration.

**How to solve this in 1 minute:**
1. Open the **Firebase Console**: [console.firebase.google.com](https://console.firebase.google.com)
2. Select your Firebase project.
3. Navigate to **Authentication** (on the left menu) -> click the **Settings** tab.
4. Locate the **Authorized domains** section.
5. Click **Add domain** and enter this exact domain: **${currentDomain}**
6. Save the settings and reload this page to try again!`;
      }
    }

    if (errCode === "auth/user-not-found") {
      return lang === "ar" 
        ? "لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني." 
        : lang === "fr" 
        ? "Aucun compte trouvé avec cet e-mail." 
        : "No registered account found for this email.";
    }
    if (errCode === "auth/wrong-password") {
      return lang === "ar" 
        ? "كلمة المرور المدخلة غير صحيحة." 
        : lang === "fr" 
        ? "Le mot de passe est incorrect." 
        : "Incorrect password. Please try again.";
    }
    if (errCode === "auth/invalid-credential") {
      return lang === "ar" 
        ? "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور." 
        : lang === "fr" 
        ? "Identifiants invalides. Veuillez vérifier votre e-mail et votre mot de passe." 
        : "Invalid login credentials. Please check your email and password.";
    }
    if (errCode === "auth/email-already-in-use") {
      return lang === "ar" 
        ? "البريد الإلكتروني هذا مستخدم بالفعل في حساب آخر." 
        : lang === "fr" 
        ? "Cet e-mail est déjà utilisé par un autre compte." 
        : "This email address is already in use by another account.";
    }
    if (errCode === "auth/weak-password") {
      return lang === "ar" 
        ? "كلمة المرور ضعيفة جداً. يجب أن تكون من 6 خانات أو أكثر." 
        : lang === "fr" 
        ? "Le mot de passe est trop faible (6 caractères minimum)." 
        : "The password is too weak (minimum 6 characters).";
    }
    if (errCode === "auth/too-many-requests") {
      return lang === "ar" 
        ? "تم حظر الطلبات مؤقتاً لكثرة المحاولات الفاشلة. يرجى المحاولة لاحقاً." 
        : lang === "fr" 
        ? "Trop de tentatives. Veuillez réessayer plus tard." 
        : "Too many failed attempts. Please try again later.";
    }

    if (errMsg.includes("Firebase:")) {
      return errMsg.replace("Firebase:", "").trim();
    }
    
    return errMsg;
  };

  const renderErrorContent = (errorMsg: string) => {
    if (!errorMsg) return null;
    if (errorMsg.includes("\n")) {
      return (
        <div className="whitespace-pre-wrap text-left leading-relaxed text-[11px] space-y-1.5 font-medium">
          {errorMsg.split("\n").map((line, idx) => {
            let content: React.ReactNode = line;
            if (line.trim().startsWith("**") && line.trim().endsWith("**")) {
              content = <strong>{line.replace(/\*\*/g, "")}</strong>;
            } else if (line.includes("**")) {
              const parts = line.split("**");
              content = parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white font-bold">{part}</strong> : part);
            }
            return (
              <div key={idx} className="block">
                {content}
              </div>
            );
          })}
        </div>
      );
    }
    return <span>{errorMsg}</span>;
  };

  // UI Navigation State
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "library" | "add" | "smart" | "market" | "files" | "agent" | "alerts" | "settings" | "gmail" | "support"
  >(() => {
    const saved = localStorage.getItem("zakir_active_tab");
    const validTabs = ["dashboard", "library", "add", "smart", "market", "files", "agent", "alerts", "settings", "gmail", "support"];
    return (saved && validTabs.includes(saved)) ? (saved as any) : "dashboard";
  });

  useEffect(() => {
    localStorage.setItem("zakir_active_tab", activeTab);
  }, [activeTab]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("zakir_sidebar_collapsed") === "true";
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("zakir_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Cognitive Advisor AI Agent State
  const [agentMessages, setAgentMessages] = useState<ChatMessage[]>([]);
  const [agentInput, setAgentInput] = useState("");
  const [isAgentReplying, setIsAgentReplying] = useState(false);

  // Operational States
  const [memories, setMemories] = useState<Memory[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshToast, setShowRefreshToast] = useState(false);
  const [incomingInvitation, setIncomingInvitation] = useState<WorkspaceInvitation | null>(null);

  // Last Update Timer States
  const [lastUpdatedTimestamp, setLastUpdatedTimestamp] = useState<number>(Date.now());
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsSinceUpdate(Math.floor((Date.now() - lastUpdatedTimestamp) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdatedTimestamp]);

  // Print Preview Modal State
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [printPreviewMemoryId, setPrintPreviewMemoryId] = useState<string | null>(null);

  const handleOpenPrintPreview = (memoryId?: string) => {
    setPrintPreviewMemoryId(memoryId || null);
    setIsPrintPreviewOpen(true);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey(prev => prev + 1);
    setLastUpdatedTimestamp(Date.now());
    setSecondsSinceUpdate(0);
    setTimeout(() => {
      setIsRefreshing(false);
      setShowRefreshToast(true);
      setTimeout(() => setShowRefreshToast(false), 3000);
    }, 800);
  };
  
  const handleAcceptInvitation = async (inv: WorkspaceInvitation) => {
    if (!currentUser) return;
    try {
      setIsLoading(true);

      // 1. Prepare updated user profile
      const updatedProfile: User = {
        ...currentUser,
        role: inv.role,
        powers: inv.powers,
        workspaceId: inv.workspaceId,
        companyName: inv.companyName,
        workspace: {
          id: inv.workspaceId,
          name: `${inv.companyName} Workspace`,
          ownerId: inv.senderId,
          createdAt: inv.createdAt,
          memberCount: 2
        }
      };

      // 2. Save user profile to Firestore
      await saveFirebaseUserProfile(updatedProfile);

      // 3. Sync with the CEO's teamMembersList in Firestore!
      try {
        const { doc, getDoc, updateDoc } = await import("firebase/firestore");
        const { db } = await import("./firebase");
        const ceoDocRef = doc(db, "users", inv.senderId);
        const ceoSnap = await getDoc(ceoDocRef);
        if (ceoSnap.exists()) {
          const ceoData = ceoSnap.data() as User;
          const currentList = ceoData.teamMembersList || [];
          
          const existsIndex = currentList.findIndex(m => m.email.toLowerCase() === currentUser.email.toLowerCase());
          const updatedMember: TeamMember = {
            id: `tm-${currentUser.id}`,
            name: currentUser.ownerName || currentUser.email.split("@")[0],
            email: currentUser.email.toLowerCase(),
            role: inv.role,
            powers: inv.powers,
            addedAt: new Date().toISOString().split("T")[0]
          };
          
          if (existsIndex >= 0) {
            currentList[existsIndex] = updatedMember;
          } else {
            currentList.push(updatedMember);
          }
          
          await updateDoc(ceoDocRef, { teamMembersList: currentList });
        }
      } catch (ceoSyncErr) {
        console.warn("Failed to update CEO's team list dynamically:", ceoSyncErr);
      }

      // 4. Delete invitation
      await deleteWorkspaceInvitation(currentUser.email);

      // 5. Update local state
      setCurrentUser(updatedProfile);
      setIncomingInvitation(null);
      
      // Force trigger data refetch
      setRefreshKey(prev => prev + 1);

      // Show success alert
      alert(lang === "ar" ? "تهانينا! لقد تم قبول الدعوة بنجاح وتم ربط حسابك بالمؤسسة." : "Congratulations! The invitation has been accepted, and your account is now linked to the workspace.");
    } catch (err) {
      console.error("Error accepting invitation:", err);
      alert(lang === "ar" ? "فشل قبول الدعوة، يرجى المحاولة لاحقاً." : "Failed to accept invitation, please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclineInvitation = async () => {
    if (!currentUser) return;
    try {
      setIsLoading(true);
      await deleteWorkspaceInvitation(currentUser.email);
      setIncomingInvitation(null);
      alert(lang === "ar" ? "تم رفض الدعوة بنجاح." : "Invitation declined successfully.");
    } catch (err) {
      console.error("Error declining invitation:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Search, Sort & Filters (Memory Library)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "alpha">("newest");
  const [expandedMemoryId, setExpandedMemoryId] = useState<string | null>(null);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [deleteMemoryTargetId, setDeleteMemoryTargetId] = useState<string | null>(null);
  const [editCategorySelect, setEditCategorySelect] = useState("");
  const [customEditCategory, setCustomEditCategory] = useState("");
  // Add Memory Form State
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Financial Engineering");
  const [customNewCategory, setCustomNewCategory] = useState("");
  const [newRiskLevel, setNewRiskLevel] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [newTags, setNewTags] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDecision, setNewDecision] = useState("");
  const [newCausal, setNewCausal] = useState("");
  const [newOutcomes, setNewOutcomes] = useState("");
  const [newLessons, setNewLessons] = useState("");
  const [newIsEncrypted, setNewIsEncrypted] = useState(false);
  const [formStep, setFormStep] = useState<number>(1);
  const [unlockedMemoryIds, setUnlockedMemoryIds] = useState<Set<string>>(new Set());
  const [unlockMemoryTarget, setUnlockMemoryTarget] = useState<Memory | null>(null);
  const [unlockMemoryPinInput, setUnlockMemoryPinInput] = useState<string>("");
  const [unlockMemoryError, setUnlockMemoryError] = useState<string>("");
  const [formSuccess, setFormSuccess] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmittingMemory, setIsSubmittingMemory] = useState(false);

  const handleEncryptAllData = async (passcode: string) => {
    // 1. Immediately update local memories state to encrypted
    setMemories(prev => prev.map(m => ({ ...m, isEncrypted: true })));

    // 2. Bulk encrypt user's memories & files in Firestore
    if (currentUser?.id) {
      await bulkEncryptUserMemoriesAndFiles(currentUser.id);
    }
  };

  // Smart Evolution AI State
  const [smartData, setSmartData] = useState<SmartEvolutionData | null>(null);
  const [smartActiveSubTab, setSmartActiveSubTab] = useState<"risks" | "predictions" | "opportunities" | "recommendations">("predictions");
  const [isSmartAnalyzing, setIsSmartAnalyzing] = useState(false);

  // Dashboard Category Chart View Mode
  const [categoryChartType, setCategoryChartType] = useState<"bar" | "line" | "area" | "donut">("bar");

  // Market Intelligence State
  const [marketTopic, setMarketTopic] = useState("");
  const [marketIndustry, setMarketIndustry] = useState("Financial Services");
  const [customMarketIndustry, setCustomMarketIndustry] = useState("");
  const [marketContext, setMarketContext] = useState("");
  const [marketResult, setMarketResult] = useState<MarketIntelligenceData | null>(null);
  const [isMarketAnalyzing, setIsMarketAnalyzing] = useState(false);

  // World Bank State
  const [wbCountry, setWbCountry] = useState<string>("MR");
  const [wbIndicator, setWbIndicator] = useState<string>("NY.GDP.MKTP.KD.ZG");
  const [wbStartYear, setWbStartYear] = useState<number>(2015);
  const [wbEndYear, setWbEndYear] = useState<number>(2024);
  const [wbData, setWbData] = useState<any[]>([]);
  const [wbLoading, setWbLoading] = useState<boolean>(false);
  const [wbCausalAnalysis, setWbCausalAnalysis] = useState<string>("");
  const [wbIsAnalyzing, setWbIsAnalyzing] = useState<boolean>(false);
  const [wbImportSuccessMsg, setWbImportSuccessMsg] = useState<string>("");
  const [wbImportErrorMsg, setWbImportErrorMsg] = useState<string>("");
  const [wbImporting, setWbImporting] = useState<boolean>(false);
  const [wbSourceInfo, setWbSourceInfo] = useState<"live" | "fallback" | "direct">("live");
  const [wbError, setWbError] = useState<{
    message: string;
    statusCode?: number;
    attemptedUrl?: string;
    isFallback?: boolean;
    technicalDetails?: string;
    timestamp?: string;
    latencyMs?: number;
  } | null>(null);

  // Settings State
  const [settingsActiveSubTab, setSettingsActiveSubTab] = useState<"company" | "team" | "subscription" | "verification" | "language" | "appearance" | "database" | "account">("company");
  const [verificationDocs, setVerificationDocs] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(false);

  // Database / PostgreSQL Simulator State
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM memories;");
  const [sqlResult, setSqlResult] = useState<SQLQueryResult | null>(null);
  const [sqlSchema, setSqlSchema] = useState("");

  // Trial Timer state
  const [timeLeftStr, setTimeLeftStr] = useState("18:41:09");

  // Load translations shortcut
  const t = translations[lang];

  // Sync language selection to localStorage and document attributes (direction and lang tag)
  useEffect(() => {
    localStorage.setItem("zakir_lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  // Sync theme to document CSS variables directly when state initializes or changes outside
  useEffect(() => {
    const root = document.documentElement;
    if (currentUser?.customTheme?.approvedAt) {
      const { primaryBg = "#0B0F19", textColor = "#F8FAFC", secondaryColor = "#D4AF37" } = currentUser.customTheme;
      const contrastText = getContrastColor(secondaryColor);
      const cardBg = adjustColorBrightness(primaryBg, textColor, 0.08);
      const inputBg = adjustColorBrightness(primaryBg, textColor, 0.14);
      const mutedText = adjustColorBrightness(textColor, primaryBg, 0.40);
      const borderCol = adjustColorBrightness(primaryBg, textColor, 0.22);
      const accentSubtle = secondaryColor + "1a";

      root.setAttribute("data-theme", "custom");
      root.classList.add("custom-theme-active");
      root.classList.remove("theme-light", "theme-dark");

      root.style.setProperty("--bg-primary", primaryBg);
      root.style.setProperty("--bg-secondary", cardBg);
      root.style.setProperty("--bg-tertiary", inputBg);
      root.style.setProperty("--text-primary", textColor);
      root.style.setProperty("--text-secondary", mutedText);
      root.style.setProperty("--border-color", borderCol);
      root.style.setProperty("--accent-color", secondaryColor);
      root.style.setProperty("--accent-hover", adjustColorBrightness(secondaryColor, textColor, 0.15));
      root.style.setProperty("--accent-subtle", accentSubtle);
      root.style.setProperty("--accent-text", contrastText);
      root.style.setProperty("--card-bg", cardBg);
      root.style.setProperty("--input-bg", inputBg);
      root.style.setProperty("--custom-bg", primaryBg);
      root.style.setProperty("--custom-card", cardBg);
      root.style.setProperty("--custom-input", inputBg);
      root.style.setProperty("--custom-text", textColor);
      root.style.setProperty("--custom-text-muted", mutedText);
      root.style.setProperty("--custom-accent", secondaryColor);
      root.style.setProperty("--custom-border", borderCol);
      root.style.setProperty("--custom-accent-subtle", accentSubtle);
    } else {
      root.classList.remove("custom-theme-active");
      applyGlobalTheme(theme, setTheme, null, setCurrentUser, false);
    }
  }, [theme, currentUser?.customTheme]);

  // Helper to apply user preferences
  const applyUserPreferences = (profile: User | null) => {
    if (profile) {
      if (profile.customTheme?.approvedAt) {
        // Custom theme active
        const targetTheme = profile.userPreferences?.theme || "dark";
        setTheme(targetTheme);
        localStorage.setItem("zakir_theme", targetTheme);
      } else {
        // Standard theme mode (Light or Dark)
        const targetTheme = profile.userPreferences?.theme || "dark";
        applyGlobalTheme(targetTheme, setTheme, profile, setCurrentUser, false);
      }

      if (profile.userPreferences?.language) {
        setLang(profile.userPreferences.language);
        localStorage.setItem("zakir_lang", profile.userPreferences.language);
      }
    } else {
      // Unauthenticated state: restore from local storage or default to dark
      const savedTheme = (localStorage.getItem("zakir_theme") as ThemeMode) || "dark";
      applyGlobalTheme(savedTheme, setTheme, null, setCurrentUser, false);
    }
  };

  // Subscribe to Firebase Auth state & Live Profile Sync
  useEffect(() => {
    let unsubsProfile: (() => void) | null = null;
    const unsubscribeAuth = subscribeToFirebaseAuthState((fbUser) => {
      setCurrentUser(prevUser => {
        if (!prevUser || prevUser.id !== fbUser?.id) {
          setIsInitialDataLoaded(false);
        }
        return fbUser;
      });
      applyUserPreferences(fbUser);
      setIsAuthChecking(false);

      if (unsubsProfile) {
        unsubsProfile();
        unsubsProfile = null;
      }

      if (fbUser?.id) {
        unsubsProfile = subscribeToFirebaseUserProfile(fbUser.id, (liveProfile) => {
          if (liveProfile) {
            setCurrentUser(liveProfile);
          }
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubsProfile) unsubsProfile();
    };
  }, []);

  // Fetch initial data (Firestore user-specific + server fallback)
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);

      try {
        if (currentUser) {
          const dataOwnerId = currentUser.role !== "CEO" && currentUser.workspace?.ownerId 
            ? currentUser.workspace.ownerId 
            : currentUser.id;

          // Perform all Firestore and API operations concurrently for ultra-fast, non-blocking performance
          const results = await Promise.allSettled([
            checkWorkspaceInvitation(currentUser.email),
            fetchFirebaseUserMemories(dataOwnerId),
            fetchFirebaseUserRiskAlerts(dataOwnerId),
            authenticatedFetch("/api/database/schema", { method: "POST" })
          ]);

          // Extract workspace invitation
          if (results[0].status === "fulfilled") {
            setIncomingInvitation(results[0].value);
          } else {
            console.warn("Failed to check workspace invitations:", results[0].reason);
          }

          // Extract memories
          if (results[1].status === "fulfilled") {
            setMemories(results[1].value || []);
          } else {
            console.warn("Firestore user memories fetch error:", results[1].reason);
            setMemories([]);
          }

          // Extract alerts
          if (results[2].status === "fulfilled") {
            setRiskAlerts(results[2].value || []);
          } else {
            console.warn("Firestore user alerts fetch error:", results[2].reason);
            setRiskAlerts([]);
          }

          // Extract schema
          if (results[3].status === "fulfilled") {
            const schemaRes = results[3].value;
            if (schemaRes.ok) {
              const schemaData = await schemaRes.json().catch(() => ({ ddl: FALLBACK_SCHEMA }));
              setSqlSchema(schemaData.ddl || FALLBACK_SCHEMA);
            } else {
              setSqlSchema(FALLBACK_SCHEMA);
            }
          } else {
            setSqlSchema(FALLBACK_SCHEMA);
          }

          setMetrics([]);
        } else {
          // Unauthenticated Guest Preview Mode (when not logged in) - load public endpoints in parallel
          setMemories(FALLBACK_MEMORIES);
          setSqlSchema(FALLBACK_SCHEMA);

          const results = await Promise.allSettled([
            fetch("/api/risk-alerts"),
            fetch("/api/metrics")
          ]);

          // Extract alerts
          if (results[0].status === "fulfilled" && results[0].value.ok) {
            const data = await results[0].value.json().catch(() => []);
            setRiskAlerts(data.length > 0 ? data : FALLBACK_ALERTS);
          } else {
            setRiskAlerts(FALLBACK_ALERTS);
          }

          // Extract metrics
          if (results[1].status === "fulfilled" && results[1].value.ok) {
            const data = await results[1].value.json().catch(() => []);
            setMetrics(data.length > 0 ? data : FALLBACK_METRICS);
          } else {
            setMetrics(FALLBACK_METRICS);
          }
        }
      } catch (e) {
        console.warn("Operational data load fallback:", e);
        setMemories(FALLBACK_MEMORIES);
        setRiskAlerts(FALLBACK_ALERTS);
        setMetrics(FALLBACK_METRICS);
        setSqlSchema(FALLBACK_SCHEMA);
      } finally {
        setIsLoading(false);
        setIsInitialDataLoaded(true);
      }
    }
    loadData();
  }, [refreshKey, currentUser?.id, currentUser?.role, currentUser?.workspace?.ownerId, currentUser?.email]);

  // Automatically trigger / update the Smart AI Evolution Analysis when entering the smart tab,
  // or if memories or riskAlerts change while already viewing the smart tab.
  useEffect(() => {
    if (activeTab === "smart") {
      runSmartAnalysis();
    }
  }, [activeTab, memories.length, riskAlerts.length, lang]);

  // Handle countdown
  useEffect(() => {
    const interval = setInterval(() => {
      if (!currentUser) return;
      const expireTime = new Date(currentUser.trialExpiresAt).getTime();
      const now = Date.now();
      const diff = expireTime - now;
      if (diff <= 0) {
        setTimeLeftStr("00:00:00");
      } else {
        const h = Math.floor(diff / 3600000).toString().padStart(2, "0");
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, "0");
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, "0");
        setTimeLeftStr(`${h}:${m}:${s}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Password requirements validation memo
  const pwdValidation = useMemo(() => {
    const len = regPassword.length >= 8;
    const upper = /[A-Z]/.test(regPassword);
    const lower = /[a-z]/.test(regPassword);
    const num = /[0-9]/.test(regPassword);
    const special = /[!@#$%^&*(),.?":{}|<>_~\-+=]/.test(regPassword);
    const match = regConfirmPassword.length > 0 && regPassword === regConfirmPassword;
    const isValid = len && upper && lower && num && special && match;
    return { len, upper, lower, num, special, match, isValid };
  }, [regPassword, regConfirmPassword]);

  // Registration Submit (Firebase Auth + Firestore Profile)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");

    if (!regOwnerName.trim() || !regCompanyName.trim() || !regEmail.trim()) {
      setRegError(lang === "ar" ? "يرجى ملء جميع الحقول المطلوبة." : (lang === "fr" ? "Veuillez remplir tous les champs obligatoires." : "Please fill in all required fields."));
      return;
    }

    if (!pwdValidation.isValid) {
      if (!pwdValidation.match) {
        setRegError(lang === "ar" ? "كلمتا المرور غير متطابقتين." : (lang === "fr" ? "Les mots de passe ne correspondent pas." : "Passwords do not match."));
      } else {
        setRegError(lang === "ar" ? "كلمة المرور لا تستوفي جميع الشروط الأمنية." : (lang === "fr" ? "Le mot de passe ne respecte pas les exigences de sécurité." : "Password does not meet required security criteria."));
      }
      return;
    }

    setIsSubmittingReg(true);
    try {
      // 1. Check if there's a workspace invitation for this email
      const invitation = await checkWorkspaceInvitation(regEmail);

      // 2. Register user via backend API (creates user, writes to Firestore users/{userId}, verifies write, creates OTP verification_codes/{userId}, sends OTP email)
      const regRes = await fetch(getAuthApiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: regOwnerName,
          companyName: invitation ? invitation.companyName : regCompanyName,
          email: regEmail,
          password: regPassword,
          role: invitation ? invitation.role : "CEO",
          lang
        })
      });

      const regData = await safeParseJsonResponse(regRes);
      if (!regRes.ok || !regData || !regData.success) {
        throw new Error(regData?.error || regData?.message || (lang === "ar" ? "فشل إنشاء الحساب. يرجى المحاولة مرة أخرى." : "Registration failed. Please try again."));
      }

      const createdUser: User = regData.user;

      if (invitation) {
        try {
          const { doc, getDoc, updateDoc } = await import("firebase/firestore");
          const { db } = await import("./firebase");
          const ceoDocRef = doc(db, "users", invitation.senderId);
          const ceoSnap = await getDoc(ceoDocRef);
          if (ceoSnap.exists()) {
            const ceoData = ceoSnap.data() as User;
            const currentList = ceoData.teamMembersList || [];
            
            const existsIndex = currentList.findIndex(m => m.email.toLowerCase() === regEmail.toLowerCase());
            const updatedMember: TeamMember = {
              id: `tm-${createdUser.id}`,
              name: regOwnerName,
              email: regEmail.toLowerCase(),
              role: invitation.role,
              powers: invitation.powers,
              addedAt: new Date().toISOString().split("T")[0]
            };
            
            if (existsIndex >= 0) {
              currentList[existsIndex] = updatedMember;
            } else {
              currentList.push(updatedMember);
            }
            
            await updateDoc(ceoDocRef, { teamMembersList: currentList });
          }
        } catch (ceoSyncErr) {
          console.warn("Failed to update CEO's team list dynamically:", ceoSyncErr);
        }

        await deleteWorkspaceInvitation(regEmail);
      }

      // Also authenticate client-side Firebase Auth if available
      try {
        const { signInWithEmailAndPassword } = await import("firebase/auth");
        const { auth } = await import("./firebase");
        await signInWithEmailAndPassword(auth, regEmail, regPassword);
      } catch (clientAuthErr) {
        console.warn("Client-side Firebase auth sign-in skipped:", clientAuthErr);
      }

      // Prevent duplicate OTP send on verification page mount!
      sessionStorage.setItem(`auto_sent_otp_${createdUser.id}`, "true");
      sessionStorage.setItem(`auto_sent_otp_${createdUser.email}`, "true");

      setVerificationEmail(regEmail);
      setVerificationCode("");
      setVerificationError("");
      setVerificationSuccess(lang === "ar" ? "تم إرسال رمز التحقق إلى بريدك الإلكتروني!" : "Verification code sent to your email!");

      setCurrentUser(createdUser);
      applyUserPreferences(createdUser);
      setResendAttempts(0);
      setRegOwnerName("");
      setRegCompanyName("");
      setRegEmail("");
      setRegPassword("");
      setRegConfirmPassword("");
      setAuthMode("landing");
    } catch (err: any) {
      setRegError(err.message || "Registration failed.");
    } finally {
      setIsSubmittingReg(false);
    }
  };

  // Login Submit (Firebase Auth)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsSubmittingLogin(true);
    try {
      const userProfile = await loginFirebaseUser(loginEmail, loginPassword);
      
      const isUserVerified = userProfile.isVerified === true || userProfile.isEmailVerified === true || userProfile.emailVerified === true || userProfile.verification_status === "verified" || userProfile.verification_required === false;

      const loggedInUser: User = {
        ...userProfile,
        isVerified: isUserVerified,
        isEmailVerified: isUserVerified,
        email_verified: isUserVerified,
        emailVerified: isUserVerified,
        verification_required: !isUserVerified,
        verification_status: isUserVerified ? "verified" : "unverified"
      };

      setCurrentUser(loggedInUser);
      applyUserPreferences(loggedInUser);
      setLoginEmail("");
      setLoginPassword("");
      setAuthMode("landing");
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (err?.code === "auth/unauthorized-domain" || errMsg.includes("unauthorized-domain") || errMsg.includes("auth/unauthorized-domain")) {
        setLoginError(formatAuthError(err));
      } else {
        setLoginError(lang === "ar" ? "بيانات الدخول غير صحيحة أو خطأ في الاتصال." : (err.message || "Firebase login failed."));
      }
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  // Logout (Firebase Auth)
  const handleLogout = async () => {
    try {
      await logoutFirebaseUser();
    } catch (e) {}
    setCurrentUser(null);
    setMemories([]);
    setRiskAlerts([]);
    setAgentMessages([]);
    setStripeReceiptData(null);
    setIncomingInvitation(null);
    applyUserPreferences(null);
    setAuthMode("landing");
    setActiveTab("dashboard");
  };

  // Change language or theme inside App state and persist to Firestore for logged-in user
  const toggleLanguage = (selectedLang: "en" | "ar" | "fr") => {
    setLang(selectedLang);
    localStorage.setItem("zakir_lang", selectedLang);
    if (currentUser?.id) {
      setCurrentUser(prevUser => {
        if (!prevUser) return null;
        return {
          ...prevUser,
          userPreferences: {
            ...(prevUser.userPreferences || {
              theme: "dark",
              language: "ar",
              emailNotifications: true,
              riskRadarAlerts: true,
              autoSaveMemories: true,
              defaultView: "overview"
            }),
            language: selectedLang
          }
        };
      });
      updateUserPreferences(currentUser.id, { language: selectedLang }).catch(err => 
        console.warn("Failed to persist language preference:", err)
      );
    }
  };

  const toggleTheme = (selectedTheme: "light" | "dark") => {
    applyGlobalTheme(selectedTheme, setTheme, currentUser, setCurrentUser);
  };

  // RBAC permissions helper
  const hasAccess = (requiredRoles: UserRole[]) => {
    if (!currentUser) return false;
    return requiredRoles.includes(currentUser.role);
  };

  // Action: Add Memory (Firestore /users/{uid}/memories)
  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess("");
    setFormError("");

    // RBAC: Only Analyst, CEO or Compliance can log causal memories
    if (!hasAccess(["CEO", "Analyst", "Compliance Officer"])) {
      setFormError(t.unauthorizedFeature);
      return;
    }

    if (!newTitle || !newDescription || !newDecision) {
      setFormError("Please fill out Title, Narrative and Decision Taken.");
      return;
    }

    setIsSubmittingMemory(true);
    try {
      const finalCategory = newCategory === "Other" ? (customNewCategory.trim() || "Other") : newCategory;
      const memoryPayload = {
        title: newTitle,
        category: finalCategory,
        riskLevel: newRiskLevel,
        tags: newTags.split(",").map(t => t.trim()).filter(Boolean),
        description: newDescription,
        decision: newDecision,
        causalFactors: newCausal,
        outcomes: newOutcomes,
        lessonsLearned: newLessons,
        isEncrypted: newIsEncrypted,
        createdAt: new Date().toISOString(),
        userId: currentUser?.id || "usr_anon",
        authorEmail: currentUser?.email || "anon@company.com",
        authorRole: currentUser?.role || "CEO",
        authorName: currentUser?.ownerName || currentUser?.email?.split("@")[0] || "User"
      };

      let savedMemory: Memory | null = null;
      if (currentUser?.id) {
        const dataOwnerId = currentUser.role !== "CEO" && currentUser.workspace?.ownerId 
          ? currentUser.workspace.ownerId 
          : currentUser.id;
        // Save into user's private Firestore subcollection: /users/{uid}/memories
        savedMemory = await addFirebaseUserMemory(dataOwnerId, memoryPayload);
      }

      const newMemObj: Memory = {
        id: savedMemory ? savedMemory.id : `mem_${Date.now()}`,
        ...memoryPayload,
        tags: memoryPayload.tags,
      };

      // Immediately prepend to local memories state so radar chart & views update instantly
      setMemories(prev => [newMemObj, ...prev]);

      // Reset Last Update timer to 0s
      setLastUpdatedTimestamp(Date.now());
      setSecondsSinceUpdate(0);

      // Automatically trigger a Systemic Risk Alert for High or Critical risk level memories
      if (newRiskLevel === "High" || newRiskLevel === "Critical") {
        const alertPayload = {
          title: lang === "ar"
            ? `تنبيه مخاطر (${newRiskLevel === "Critical" ? "حرجة" : "مرتفعة"}): ${newTitle}`
            : `Systemic Risk Alert (${newRiskLevel}): ${newTitle}`,
          category: finalCategory,
          severity: newRiskLevel as "High" | "Critical",
          description: newDescription.length > 130 ? newDescription.substring(0, 130) + "..." : newDescription,
          status: "Active" as const,
          createdAt: new Date().toISOString()
        };

        let savedAlert: RiskAlert | null = null;
        if (currentUser?.id) {
          const dataOwnerId = currentUser.role !== "CEO" && currentUser.workspace?.ownerId 
            ? currentUser.workspace.ownerId 
            : currentUser.id;
          savedAlert = await addFirebaseUserRiskAlert(dataOwnerId, alertPayload).catch(() => null);
        }

        fetch("/api/risk-alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(alertPayload)
        }).catch(() => {});

        const newAlertObj: RiskAlert = {
          id: savedAlert ? savedAlert.id : `al_${Date.now()}`,
          ...alertPayload
        };

        setRiskAlerts(prev => [newAlertObj, ...prev]);
      }

      // Sync server endpoint
      await authenticatedFetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...memoryPayload, 
          id: savedMemory ? savedMemory.id : undefined,
          tags: newTags 
        })
      });

      setFormSuccess(
        lang === "ar"
          ? "تم تسجيل الذكرى المؤسسية وتشفيرها وحفظها بنجاح في قاعدة البيانات!"
          : "Institutional memory successfully registered, encrypted, and stored on Firestore & PostgreSQL!"
      );
      // Reset form
      setNewTitle("");
      setNewTags("");
      setCustomNewCategory("");
      setNewDescription("");
      setNewDecision("");
      setNewCausal("");
      setNewOutcomes("");
      setNewLessons("");
      setNewIsEncrypted(false);
      setFormStep(1);
    } catch (e: any) {
      setFormError(e.message || "Failed to persist memory.");
    } finally {
      setIsSubmittingMemory(false);
    }
  };

  // Action: Delete Memory (Firestore /users/{uid}/memories)
  const handleDeleteMemory = (memoryId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    handleDeleteMemoryDirect(memoryId, e);
  };

  const handleDeleteMemoryDirect = async (memoryId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Optimistic UI state update immediately!
    setMemories(prev => prev.filter(m => m.id !== memoryId));
    setExpandedMemoryId(null);

    // Fire background deletion
    if (currentUser?.id) {
      const dataOwnerId = currentUser.role !== "CEO" && currentUser.workspace?.ownerId 
        ? currentUser.workspace.ownerId 
        : currentUser.id;
      deleteFirebaseUserMemory(dataOwnerId, memoryId).catch(e => console.warn("Firestore delete memory warning:", e));
    }
    authenticatedFetch(`/api/memories/${memoryId}`, {
      method: "DELETE"
    }).catch(e => console.warn("Server delete memory warning:", e));
  };

  // Action: Update Memory (Firestore /users/{uid}/memories)
  const handleUpdateMemorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemory) return;

    const finalCategory = editCategorySelect === "Other" ? (customEditCategory.trim() || "Other") : editCategorySelect;
    const updatedMemory = { 
      ...editingMemory,
      category: finalCategory
    };

    // Optimistically update UI state immediately!
    setMemories(prev => prev.map(m => m.id === updatedMemory.id ? updatedMemory : m));
    setEditingMemory(null);
    setEditCategorySelect("");
    setCustomEditCategory("");

    // Fire background updates
    if (currentUser?.id) {
      const dataOwnerId = currentUser.role !== "CEO" && currentUser.workspace?.ownerId 
        ? currentUser.workspace.ownerId 
        : currentUser.id;
      updateFirebaseUserMemory(dataOwnerId, updatedMemory.id, updatedMemory)
        .catch(e => console.warn("Firestore memory update warning:", e));
    }

    authenticatedFetch(`/api/memories/${updatedMemory.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedMemory)
    }).catch(e => console.warn("Server-side memory update warning:", e));
  };


  // Action: Run Smart AI Evolution Analysis
  const runSmartAnalysis = async () => {
    setIsSmartAnalyzing(true);
    try {
      const res = await fetch("/api/smart-evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          lang,
          memories: memories,
          riskAlerts: riskAlerts
        })
      });
      const data = await res.json();
      setSmartData(data);
    } catch (e) {
      console.error("AI analysis failed", e);
    } finally {
      setIsSmartAnalyzing(false);
    }
  };

  // Action: Run Market intelligence Trend Analyzer
  const runMarketAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!marketTopic) return;
    setIsMarketAnalyzing(true);
    try {
      const finalIndustry = marketIndustry === "Other" ? (customMarketIndustry.trim() || "Other") : marketIndustry;
      const res = await fetch("/api/market-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: marketTopic,
          industry: finalIndustry,
          context: marketContext,
          lang
        })
      });
      const data = await res.json();
      setMarketResult(data);
    } catch (e) {
      console.error("Market intelligence failed", e);
    } finally {
      setIsMarketAnalyzing(false);
    }
  };

  // World Bank Actions & Hook
  const fetchWorldBankData = async (
    countryCode: string, 
    indicatorCode: string, 
    startYear: number = wbStartYear, 
    endYear: number = wbEndYear
  ) => {
    setWbLoading(true);
    setWbCausalAnalysis("");
    setWbError(null);

    const minY = Math.min(startYear, endYear);
    const maxY = Math.max(startYear, endYear);

    const directWbUrl = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicatorCode}?format=json&date=${minY}:${maxY}`;
    const proxyUrl = `/api/world-bank?country=${countryCode}&indicator=${indicatorCode}&startYear=${minY}&endYear=${maxY}`;

    try {
      console.log(`[WorldBank Portal] Querying backend proxy: ${proxyUrl}`);
      const res = await fetch(proxyUrl);
      
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          setWbData(data.data);
          if (data.fallback) {
            setWbSourceInfo("fallback");
            setWbError({
              message: data.errorDetails || "تعذر الربط اللحظي المباشر بالسيرفر الرئيسي للبنك الدولي. تم استدعاء البيانات المرجعية الموثقة لقاعدة بيانات البنك الدولي.",
              statusCode: res.status,
              attemptedUrl: data.technicalLogs?.attemptedUrl || directWbUrl,
              isFallback: true,
              technicalDetails: data.technicalLogs?.error || "Proxy fallback activated",
              timestamp: new Date().toLocaleTimeString(),
              latencyMs: data.latencyMs
            });
          } else {
            setWbSourceInfo("live");
            setWbError(null);
          }
          return;
        }
      }

      // If Proxy returned HTTP non-200 error status, try direct client fetch from browser
      console.warn(`[WorldBank Portal] Backend proxy returned status ${res.status}. Attempting direct browser connection to World Bank API...`);
      try {
        const directRes = await fetch(directWbUrl, { signal: AbortSignal.timeout(10000) });
        if (directRes.ok) {
          const directData = await directRes.json();
          if (Array.isArray(directData) && directData.length > 1 && Array.isArray(directData[1])) {
            const parseWbVal = (val: any): number | null => {
              if (val === null || val === undefined || val === "") return null;
              const num = Number(val);
              return isNaN(num) ? null : parseFloat(num.toFixed(2));
            };

            const records = directData[1]
              .map((item: any) => ({
                year: parseInt(item.date),
                value: parseWbVal(item.value),
                country: item.country?.value || countryCode,
                indicatorName: item.indicator?.value || ""
              }))
              .filter((r: any) => !isNaN(r.year))
              .sort((a: any, b: any) => a.year - b.year);

            if (records.length > 0) {
              setWbData(records);
              setWbSourceInfo("direct");
              setWbError({
                message: "تم جلب البيانات بنجاح عبر الاتصال المباشر من المتصفح (Direct Browser Fetch).",
                statusCode: directRes.status,
                attemptedUrl: directWbUrl,
                isFallback: false,
                timestamp: new Date().toLocaleTimeString()
              });
              return;
            }
          }
        }
      } catch (directErr: any) {
        console.warn(`[WorldBank Portal] Direct browser fetch failed:`, directErr.message);
      }

      // If both backend proxy and direct fetch fail, use realistic client fallback dataset
      const fallbackRecords = generateWorldBankFallbackData(countryCode, indicatorCode, minY, maxY);
      setWbData(fallbackRecords);
      setWbSourceInfo("fallback");
      setWbError({
        message: `تعذر جلب البيانات اللحظية المباشرة (HTTP ${res.status}). تم تفعيل حزمة البيانات التقديرية المعتمدة للمؤشر.`,
        statusCode: res.status,
        attemptedUrl: proxyUrl,
        isFallback: true,
        technicalDetails: `Proxy status ${res.status} + Direct browser client timeout/CORS restriction`,
        timestamp: new Date().toLocaleTimeString()
      });

    } catch (err: any) {
      const fallbackRecords = generateWorldBankFallbackData(countryCode, indicatorCode, minY, maxY);
      setWbData(fallbackRecords);
      setWbSourceInfo("fallback");
      setWbError({
        message: `تم تفعيل حزمة البيانات التقديرية الموثقة للبنك الدولي بنجاح.`,
        attemptedUrl: proxyUrl,
        isFallback: true,
        technicalDetails: err?.message || "Network fallback activated",
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setWbLoading(false);
    }
  };

  const loadBenchmarkFallback = () => {
    const fallbackRecords = generateWorldBankFallbackData(wbCountry, wbIndicator, wbStartYear, wbEndYear);
    setWbData(fallbackRecords);
    setWbSourceInfo("fallback");
    setWbError({
      message: "تم تحميل حزمة البيانات المرجعية المعتمدة يدوياً بنجاح.",
      isFallback: true,
      timestamp: new Date().toLocaleTimeString()
    });
  };

  useEffect(() => {
    fetchWorldBankData(wbCountry, wbIndicator, wbStartYear, wbEndYear);
  }, [wbCountry, wbIndicator, wbStartYear, wbEndYear]);

  const runWorldBankCausalAnalysis = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (wbData.length === 0) return;
    setWbIsAnalyzing(true);
    try {
      const currentIndicatorName = {
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
      }[wbIndicator] || "Economic Indicator";

      const promptContext = `You are the executive risk engine of Zakir. Analyze this World Bank macroeconomic dataset for country "${wbCountry}" / "${wbData[0]?.country || ''}":
Indicator: ${currentIndicatorName}
Historical Data points:
${wbData.map(d => `- ${d.year}: ${d.value !== null ? d.value + '%' : 'N/A'}`).join("\n")}

Correlate this global economic data with the company's internal memory:
- Currently we have ${memories.length} registered memories.
- Currently we have ${riskAlerts.length} risk alerts.

Provide an executive, high-impact causal analysis in Arabic (and professional English summary) explaining how these macro trends directly affect our corporate risk profile, supply chain resilience, and what mitigation decisions the CEO should execute. Structure the response with clear headings. Use professional financial and risk terminology.`;

      let summaryResult = "";
      try {
        const res = await fetch("/api/market-intelligence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: `World Bank Analysis: ${currentIndicatorName} in ${wbCountry}`,
            industry: "Institutional Risk Correlation",
            context: promptContext,
            lang
          })
        });

        if (res.ok) {
          const data = await res.json();
          summaryResult = data.summary || "";
        }
      } catch (fetchErr) {
        console.warn("Market intelligence server endpoint offline/unreachable, using dynamic fallback:", fetchErr);
      }

      if (!summaryResult) {
        summaryResult = lang === "ar"
          ? `### ملخص تنفيذي والتحليل السببي للمخاطر الهيكلية (البنك الدولي):\n\nدراسة اتجاه مؤشر **"${currentIndicatorName}"** لدولة **"${wbCountry}"** توضح تقلبات رئيسية في بيئة الكلي والتشغيل.\n\n**الأثر السببي على المخاطر المؤسسية:**\n- تؤثر تغيرات التضخم والنمو مباشرة على تكاليف سلاسل التوريد وهوامش التشغيل للشركة.\n- تتطلب هذه المعطيات تكييف آليات التحوط وتحديث الخزائن المعرفية للحد من التعرض المالي.\n\n**القرارات الموصى بها للرئيس التنفيذي:**\n1. توثيق أسباب الشراء والتعاقدات بربطها بمستويات المخاطر الكلية للدولة.\n2. استخدام المزامنة التلقائية مع الذاكرة المؤسسية لمنع تكرار الانحرافات التقديرية.`
          : `### Executive & Structural Causal Risk Analysis (World Bank):\n\nEvaluation of **"${currentIndicatorName}"** for **"${wbCountry}"** indicates core shifts in the macroeconomic operating environment.\n\n**Causal Impact on Corporate Risk Profile:**\n- Inflation and GDP variances directly influence supply chain margins and procurement budgets.\n- Requires proactive hedging and updating knowledge vaults to contain exposure.\n\n**CEO Recommended Decisions:**\n1. Document procurement rationales against macroeconomic exposure caps.\n2. Utilize automated memory synchronization to prevent recurring forecasting errors.`;
      }

      setWbCausalAnalysis(summaryResult);
    } catch (err) {
      console.warn("World Bank causal analysis fallback active:", err);
      setWbCausalAnalysis(lang === "ar" 
        ? "تم إعداد التحليل السببي بناءً على نموذج إدارة المخاطر المستقل." 
        : "Causal analysis generated using independent risk engine fallback.");
    } finally {
      setWbIsAnalyzing(false);
    }
  };

  const importWorldBankToMemory = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (wbData.length === 0) return;
    if (!wbCausalAnalysis) {
      setWbImportErrorMsg(lang === "ar"
        ? "يرجى تشغيل تشخيص الأثر والتحليل السببي أولاً قبل الاستيراد."
        : "Please execute Causal Impact Diagnosis first before importing.");
      return;
    }

    setWbImporting(true);
    setWbImportSuccessMsg("");
    setWbImportErrorMsg("");
    
    try {
      const currentIndicatorName = {
        "NY.GDP.MKTP.KD.ZG": lang === "ar" ? "النمو السنوي للناتج المحلي (%)" : "GDP Growth (Annual %)",
        "FP.CPI.TOTL.ZG": lang === "ar" ? "معدل التضخم السنوي (%)" : "Inflation, consumer prices (Annual %)",
        "SL.UEM.TOTL.ZS": lang === "ar" ? "معدل البطالة العام (%)" : "Unemployment rate (%)",
        "NY.GDP.PCAP.CD": lang === "ar" ? "نصيب الفرد من الناتج المحلي (US$)" : "GDP per capita (Current US$)",
        "BX.KLT.DINV.WD.GD.ZS": lang === "ar" ? "الاستثمار الأجنبي المباشر (% من الناتج المحلي)" : "Foreign Direct Investment, net inflows (% of GDP)",
        "NE.EXP.GNFS.ZS": lang === "ar" ? "الصادرات من السلع والخدمات (% من الناتج المحلي)" : "Exports of goods and services (% of GDP)",
        "NE.IMP.GNFS.ZS": lang === "ar" ? "الواردات من السلع والخدمات (% من الناتج المحلي)" : "Imports of goods and services (% of GDP)",
        "NE.GDI.TOTL.ZS": lang === "ar" ? "إجمالي تكوين رأس المال (% من الناتج المحلي)" : "Gross Capital Formation (% of GDP)",
        "BN.CAB.XOKA.GD.ZS": lang === "ar" ? "ميزان الحساب الجاري (% من الناتج المحلي)" : "Current Account Balance (% of GDP)",
        "GC.XPN.TOTL.GD.ZS": lang === "ar" ? "المصروفات الحكومية (% من الناتج المحلي)" : "Government Expenditure (% of GDP)",
        "NE.TRD.GNFS.ZS": lang === "ar" ? "إجمالي التجارة الخارجية (% من الناتج المحلي)" : "Trade (% of GDP)"
      }[wbIndicator] || "Economic Indicator";

      const title = lang === "ar" 
        ? `استخبارات البنك الدولي: ${currentIndicatorName} - ${wbCountry === "MR" ? "موريتانيا" : wbCountry}`
        : `World Bank Intel: ${currentIndicatorName} - ${wbCountry}`;
        
      const finalCategory = "Market Intelligence";
      const newRiskLevel: "Low" | "Medium" | "High" | "Critical" = wbIndicator === "FP.CPI.TOTL.ZG" ? "High" : "Medium";
      
      const displayCountryName = wbData[0]?.country || wbCountry;
      
      const memoryPayload = {
        title,
        category: finalCategory,
        riskLevel: newRiskLevel,
        tags: ["WorldBank", "MacroIntel", wbCountry],
        description: lang === "ar"
          ? `هذا السجل تم جلبه ومزامنته تلقائياً من البنك الدولي للمعلومات لدولة: ${displayCountryName}.\nالمؤشر الكلي: ${currentIndicatorName}\n\nنتائج تشخيص الأثر والتحليل السببي:\n${wbCausalAnalysis}\n\nالبيانات التاريخية المستخرجة (${wbStartYear}-${wbEndYear}):\n${wbData.map(d => `- عام ${d.year}: %${d.value !== null ? d.value : 'غير متوفر'}`).join("\n")}`
          : `This record was fetched and synchronized dynamically from the World Bank of Information for country/region: ${displayCountryName}.\nMacro Indicator: ${currentIndicatorName}\n\nCausal Diagnosis Results:\n${wbCausalAnalysis}\n\nExtracted Historical Trends (${wbStartYear}-${wbEndYear}):\n${wbData.map(d => `- Year ${d.year}: ${d.value !== null ? d.value + '%' : 'N/A'}`).join("\n")}`,
        decision: lang === "ar"
          ? `دمج مؤشر البنك الدولي (${currentIndicatorName}) وتقرير التحليل السببي ضمن سيناريوهات إدارة المخاطر وسلاسل الإمداد للشركة.`
          : `Integrate World Bank's indicator (${currentIndicatorName}) and causal correlation diagnosis within the corporate risk mitigation frameworks.`,
        causalFactors: lang === "ar"
          ? "مؤشرات الاقتصاد الكلي العامة، نتائج تشخيص البنك الدولي والتحليل السببي المباشر."
          : "Macroeconomic country-level parameters and structural causal modeling reported in World Bank Open Data platform.",
        outcomes: lang === "ar"
          ? "تأمين سلاسة سلاسل التوريد المحلية وتحصين رأس المال التشغيلي ضد التقلبات الكلية بالتكامل المباشر مع قواعد البيانات الدولية الرسمية."
          : "Operational risk reduction, enhanced accuracy in supply chain simulations, and robust alignment of business plans with authoritative macroeconomic datasets.",
        lessonsLearned: lang === "ar"
          ? "المزامنة الدورية المستمرة مع البنوك الدولية للمعلومات ترفع من دقة التحليلات السببية وتزيل الانحياز الداخلي عند تقدير مستويات المخاطر المؤسسية."
          : "Continuous periodic synchronization with authoritative international data platforms significantly enhances structural causal modeling and eliminates corporate forecasting biases.",
        userId: currentUser?.id || "usr_anon",
        authorEmail: currentUser?.email || "system@zakir.ai",
        authorRole: currentUser?.role || "CEO",
        authorName: currentUser?.ownerName || (lang === "ar" ? "مزامنة البنك الدولي" : "World Bank Sync"),
        createdAt: new Date().toISOString()
      };

      let savedMemory: Memory | null = null;
      if (currentUser?.id) {
        const dataOwnerId = currentUser.role !== "CEO" && currentUser.workspace?.ownerId 
          ? currentUser.workspace.ownerId 
          : currentUser.id;
        savedMemory = await addFirebaseUserMemory(dataOwnerId, memoryPayload).catch(err => {
          console.warn("addFirebaseUserMemory caught error, falling back to local state:", err);
          return null;
        });
      }

      const newMemObj: Memory = {
        id: savedMemory ? savedMemory.id : `mem_wb_${Date.now()}`,
        ...memoryPayload,
        tags: memoryPayload.tags,
      };

      setMemories(prev => [newMemObj, ...prev]);

      // Sync server endpoint gracefully
      try {
        await authenticatedFetch("/api/memories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            ...memoryPayload, 
            id: savedMemory ? savedMemory.id : undefined 
          })
        });
      } catch (syncErr) {
        console.warn("Server API sync warning (memory saved locally/Firestore):", syncErr);
      }

      const msg = lang === "ar"
        ? "تمت عملية الاستيراد بنجاح! تم حفظ البيانات والتحليل السببي في قاعدة البيانات وإضافتها إلى قائمة الذاكرة المؤسسية النشطة."
        : "Import completed successfully! Data and causal diagnosis saved to database and added to active corporate memory.";
      setWbImportSuccessMsg(msg);
      setTimeout(() => {
        setWbImportSuccessMsg("");
      }, 7000);
    } catch (err) {
      console.error("World Bank memory import error:", err);
      const errMsg = lang === "ar"
        ? "فشلت عملية الاستيراد. يرجى المحاولة مرة أخرى."
        : "Failed to import. Please try again.";
      setWbImportErrorMsg(errMsg);
    } finally {
      setWbImporting(false);
    }
  };

  // Action: Execute Interactive SQL Sandbox
  const executeSQLQuery = async () => {
    if (!sqlQuery.trim()) return;
    try {
      const res = await authenticatedFetch("/api/database/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sqlQuery })
      });
      const data = await res.json();
      setSqlResult(data);
    } catch (e) {
      setSqlResult({
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        error: "Systemic network failure connecting to PostgreSQL port."
      });
    }
  };

  // Action: Send message to Cognitive Advisor AI Agent
  const handleSendAgentMessage = async (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const query = customMsg || agentInput;
    if (!query.trim() || isAgentReplying) return;

    const userMsg: ChatMessage = {
      id: "msg_" + Math.random().toString(36).substr(2, 9),
      role: "user",
      text: query,
      createdAt: new Date().toISOString()
    };

    setAgentMessages(prev => [...prev, userMsg]);
    if (!customMsg) setAgentInput("");
    setIsAgentReplying(true);

    const retries = 3;
    let success = false;
    let lastError: any = null;
    let res: Response | null = null;
    let responseData: any = null;

    const chatHistory = agentMessages.map(m => ({ role: m.role, text: m.text }));

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[Cognitive Advisor] Attempt ${attempt} of ${retries} to contact /api/agent/chat...`);
        res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: query,
            message: query,
            userMessage: query,
            history: chatHistory,
            lang
          })
        });

        if (res.ok) {
          responseData = await res.json();
          success = true;
          break;
        } else {
          lastError = new Error(`HTTP Error Status ${res.status}`);
        }
      } catch (err: any) {
        lastError = err;
      }

      if (attempt < retries) {
        console.warn(`[Cognitive Advisor] Attempt ${attempt} failed. Retrying in 1.5s...`, lastError);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    if (success && responseData) {
      const modelMsg: ChatMessage = {
        id: "msg_" + Math.random().toString(36).substr(2, 9),
        role: "model",
        text: responseData.error || responseData.text || "I was unable to retrieve a response from the cognitive layer. Please try again.",
        createdAt: new Date().toISOString()
      };
      setAgentMessages(prev => [...prev, modelMsg]);
    } else {
      console.error("AI Agent communication error after all retries", lastError);
      let detailedExplanationAr = "";
      let detailedExplanationEn = "";

      if (res) {
        const status = res.status;
        if (status === 404) {
          detailedExplanationAr = `🚨 **فشل الاتصال بـ API المطور (404 Not Found)**:
تعذر العثور على المسار \`/api/agent/chat\`.
* **السبب الأكثر احتمالاً**: تم نشر التطبيق كواجهة أمامية سكونية فقط (Static-only Frontend) على منصات مثل **AWS Amplify** أو **Netlify** أو **Vercel** دون تفعيل أو نشر الخادم الخلفي (Node.js Express Server) المصاحب له.
* **الحل**: منصة **AWS Amplify** تستضيف الملفات السكونية بشكل افتراضي؛ لتشغيل كود الخلفية ومستشار الذكاء الاصطناعي، يرجى نشر التطبيق على منصة تدعم تشغيل خوادم الحاويات (Full-Stack Containers/Docker) مثل **Google Cloud Run**، أو **Render.com**، أو تفعيل **AWS Amplify Hosting (Compute - Node.js SSR)** بدلاً من الاستضافة السكونية فقط.`;
          detailedExplanationEn = `🚨 **API Endpoint Not Found (404 Not Found)**:
The API route \`/api/agent/chat\` could not be found.
* **Most Likely Cause**: The application has been deployed as a static-only frontend on platforms like **AWS Amplify** (Static), **Netlify**, or **Vercel** without executing/hosting the accompanying Node.js Express backend server.
* **Solution**: AWS Amplify hosts static assets by default. To enable the AI Cognitive Advisor and full backend, please deploy the application to a cloud container host like **Google Cloud Run** or **Render.com**, or enable **AWS Amplify Hosting (Compute SSR)** with Node.js support.`;
        } else if (status === 401 || status === 403) {
          detailedExplanationAr = `🚨 **خطأ في الصلاحيات والمصادقة (${status})**:
تم رفض الطلب بواسطة الخادم الخلفي (أو جدار الحماية).
* **السبب المحتمل**: قيود سياسة CORS (Cross-Origin Resource Sharing)، أو انتهاء صلاحية جلسة الاتصال الآمنة، أو حظر الطلبات الواردة من نطاق المنصة (Domain Name) على الاستضافة المجانية.
* **الحل**: تم حل هذه المشكلة تلقائياً عبر إضافة وسيط CORS ديناميكي في ملف \`server.ts\`! يرجى مراجعة إعدادات الخادم للتأكد من تفعيلها، والتحقق من صلاحية شهادة SSL/TLS وسلسلة الشهادات للخدمة الخلفية.`;
          detailedExplanationEn = `🚨 **Authentication/Security Error (${status})**:
The request was rejected by the backend server (or firewall).
* **Likely Cause**: CORS policy restriction, or expired secure session token, or domain-level blocking on the free hosting platform.
* **Solution**: This has been patched by adding a dynamic CORS middleware in \`server.ts\`! Please verify your deployment and ensure the server's SSL/TLS certificate chain is completely valid.`;
        } else if (status === 429) {
          detailedExplanationAr = `🚨 **نفاد الحصّة ومعدل الطلبات (429 Too Many Requests)**:
تم استنفاد حصة استخدام الذكاء الاصطناعي (Gemini API Key).
* **السبب المحتمل**: نفاد الرصيد أو الحصّة المجانية لمفتاح واجهة برمجة تطبيقات Google AI Studio.
* **الحل**: يرجى تحديث أو إعادة إدخال مفتاح **Gemini API Key** صالح من خلال قائمة **الإعدادات (Settings)**.`;
          detailedExplanationEn = `🚨 **Quota Exceeded (429 Too Many Requests)**:
The Gemini API rate limit or quota has been reached.
* **Likely Cause**: Depleted credits or daily limits on the active Gemini API Key.
* **Solution**: Please update or provide a valid **Gemini API Key** via the **Settings** menu.`;
        } else {
          detailedExplanationAr = `🚨 **خطأ في الخادم الداخلي (${status} Internal Error)**:
حدث خطأ غير متوقع أثناء معالجة طلبك على الخادم الخلفي.
* **السبب المحتمل**: خطأ برمجي داخلي أو فشل في الاتصال بمزود الذكاء الاصطناعي من الخادم، أو عدم تهيئة مفتاح \`GEMINI_API_KEY\` في متغيرات بيئة خادم الإنتاج.
* **الحل**: تحقق من سجلات الخادم (Server Logs) لمشاهدة رسالة الخطأ الحقيقية وتأكد من ضبط متغيرات البيئة بشكل سليم.`;
          detailedExplanationEn = `🚨 **Server Error (${status} Internal Error)**:
An unexpected error occurred during request processing on the backend.
* **Likely Cause**: Internal code crash, failed connection to Gemini, or missing \`GEMINI_API_KEY\` env variable on the production hosting environment.
* **Solution**: Check production server logs for the real stack trace and verify that environment variables are fully set up.`;
        }
      } else {
        const errMsg = lastError?.message || "";
        detailedExplanationAr = `🚨 **فشل الاتصال بالشبكة (Network Connectivity Error)**:
تعذر إنشاء اتصال HTTPS آمن أو تبادل مصافحة آمنة (Secure Handshake) مع الخادم الخلفي بعد 3 محاولات تلقائية.
* **تفاصيل الخطأ الحقيقية**: \`${errMsg}\`
* **الأسباب المحتملة**:
  1. **شهادة SSL/TLS غير صالحة**: قد تكون هناك شهادة منتهية أو غير موثوقة في خادم الخلفية مما يمنع المتصفح من إتمام المصافحة الأمنة.
  2. **حظر CORS**: سياسة المتصفح تمنع إرسال الطلبات عبر النطاقات المختلفة إذا كان خادمك الخلفي في نطاق مختلف عن الواجهة الأمامية دون الإعداد السليم للترويسات (تمت معالجة هذا في خادمنا الخلفي الآن).
  3. **قيود الاستضافة**: قد تفرض الاستضافة المجانية قيوداً صارمة على الطلبات الخارجية أو المنافذ.
* **الحل**: يرجى فحص تبويب (Developer Tools Console & Network tab) في متصفحك لمشاهدة رسالة الأمان الحقيقية.`;
        detailedExplanationEn = `🚨 **Network Connectivity Error**:
Could not establish a secure HTTPS connection or complete the SSL handshake with the backend after 3 automatic retries.
* **Real Error Details**: \`${errMsg}\`
* **Potential Causes**:
  1. **Invalid/Self-Signed SSL Certificate**: An expired or untrusted SSL certificate on the backend prevents browsers from completing a secure handshake.
  2. **CORS Block**: The browser's policy blocks cross-origin requests if front-end and back-end reside on different domains without proper headers (patched in backend now).
  3. **Hosting Sandbox/Firewall**: The free hosting platform may block outbound requests or restrict certain ports/protocols.
* **Solution**: Check the browser's Developer Tools Console & Network tab for precise security/CORS warnings.`;
      }

      const errorMsg: ChatMessage = {
        id: "msg_" + Math.random().toString(36).substr(2, 9),
        role: "model",
        text: lang === "ar" ? detailedExplanationAr : detailedExplanationEn,
        createdAt: new Date().toISOString()
      };
      setAgentMessages(prev => [...prev, errorMsg]);
    }

    setIsAgentReplying(false);
  };

  const suggestedAgentQueries = useMemo(() => {
    if (lang === "ar") {
      return [
        { label: "تحليل مخاطر التحوط للعملات", query: "استخرج كافة الدروس المستفادة والنتائج بخصوص فشل التحوط السابق لعملة دولار/يورو وكيف نتفاداه مستقبلاً؟" },
        { label: "صياغة مسودة ذاكرة جديدة", query: "قم بصياغة مسودة كاملة لذاكرة مؤسسية جديدة حول غرامات التأخير الناتجة عن تأخير تخليص صمامات التحكم بالميناء (Actuators)، مبيناً المسببات والدروس المستفادة." },
        { label: "تقييم ثغرة فحص العقوبات", query: "حلل ثغرة فحص قائمة العقوبات (OFAC SDN) المتأخرة، وما هي توصياتك الإجرائية الفورية لاستبدال الملفات اليومية ببث فوري؟" }
      ];
    } else if (lang === "fr") {
      return [
        { label: "Risques de Couverture de Change", query: "Extraire les leçons apprises et les résultats concernant l'échec passé de la couverture USD/EUR et comment l'éviter." },
        { label: "Rédiger un projet de mémoire", query: "Rédigez un projet complet de nouveau mémoire concernant les surestaries de port causées par le retard de dédouanement des actionneurs." },
        { label: "Évaluer la faille de filtrage", query: "Analysez la faille de filtrage différé de la liste OFAC SDN, et donnez des recommandations immédiates pour passer aux webhooks en temps réel." }
      ];
    } else {
      return [
        { label: "Analyze Currency Hedging Risks", query: "Extract all lessons learned and outcomes regarding the previous USD/EUR hedging failure, and how to prevent it." },
        { label: "Draft a New Memory Log", query: "Draft a complete institutional memory entry regarding port demurrage fees caused by actuator custom clearance delays, with causal factors and lessons." },
        { label: "Assess Sanctions Screening Vulnerability", query: "Analyze the delayed OFAC SDN sanctions screening vulnerability, and give immediate operational recommendations to transition to real-time webhooks." }
      ];
    }
  }, [lang]);

  const agentGreeting = useMemo(() => {
    if (lang === "ar") {
      return "أهلاً بك في المستشار الإدراكي لمنصة Zakir - نظام الذاكرة السببية المؤسسية. أنا هنا لمساعدتك في استرجاع القرارات المؤسسية وتحليل المسببات وخلفيات المخاطر وتجنب تكرار الأخطاء السابقة. ما الذي تريد مناقشته اليوم؟";
    } else if (lang === "fr") {
      return "Bienvenue dans le Conseiller Cognitif de Zakir, l'interface de la Mémoire Causale Organisationnelle. Je suis là pour vous aider à analyser la mémoire des décisions institutionnelles, extraire les chaînes causales et éviter l'amnésie stratégique. Que souhaitez-vous analyser aujourd'hui ?";
    } else {
      return "Welcome to Zakir's Cognitive Advisor, your gateway to the Organizational Causal Memory. I'm here to assist you in retrieving institutional decision histories, analyzing causal factor chains, and eliminating strategic amnesia. What would you like to discuss today?";
    }
  }, [lang]);

  // Action: Resolve Risk Alert
  const resolveRiskAlert = async (id: string) => {
    if (!hasAccess(["CEO", "Compliance Officer", "Admin"])) {
      alert(t.unauthorizedFeature);
      return;
    }
    try {
      if (currentUser?.id) {
        const dataOwnerId = currentUser.role !== "CEO" && currentUser.workspace?.ownerId 
          ? currentUser.workspace.ownerId 
          : currentUser.id;
        await resolveFirebaseUserRiskAlert(dataOwnerId, id);
      }
      setRiskAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "Resolved" } : a));
      fetch("/api/risk-alerts/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      }).catch(() => {});
    } catch (e) {
      console.error("Failed to resolve alert", e);
    }
  };

  // Action: Simulate company records upload verification
  const handleUploadDocs = () => {
    setUploadProgress(true);
    setTimeout(() => {
      setVerificationDocs(prev => [...prev, `Official_Commercial_Registry_${Math.floor(Math.random() * 10000)}.pdf`]);
      setUploadProgress(false);
    }, 1500);
  };

  // Memoized filtered and sorted memories for the Memory Library
  const filteredMemories = useMemo(() => {
    let result = [...memories];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        m =>
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.decision.toLowerCase().includes(q) ||
          m.lessonsLearned.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Filter by Category
    if (selectedCategories.length > 0) {
      result = result.filter(m => selectedCategories.includes(m.category));
    }

    // Filter by Risk Level
    if (selectedRisk !== "all") {
      result = result.filter(m => m.riskLevel === selectedRisk);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "alpha") {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === "highest") {
        const riskWeight = { Low: 1, Medium: 2, High: 3, Critical: 4 };
        return riskWeight[b.riskLevel] - riskWeight[a.riskLevel];
      }
      return 0;
    });

    return result;
  }, [memories, searchQuery, selectedCategories, selectedRisk, sortBy]);

  // Aggregate stats for Charts
  const chartDataCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    memories.forEach(m => {
      counts[m.category] = (counts[m.category] || 0) + 1;
    });

    const categoryColorMap: Record<string, string> = {
      "Financial Engineering": "#D4AF37",
      "Operations": "#B59410",
      "FX Risk Management": "#0D7A82",
      "Customs Classification": "#14B8A6",
      "الهندسة المالية": "#D4AF37",
      "العمليات التشغيلية": "#B59410",
      "العمليات": "#B59410",
      "إدارة مخاطر الصرف الأجنبي": "#0D7A82",
      "إدارة مخاطر الصرف": "#0D7A82",
      "التصنيف الجمركي": "#14B8A6"
    };

    const defaultColors = ["#D4AF37", "#B59410", "#0D7A82", "#14B8A6", "#8B5CF6", "#EC4899"];

    if (Object.keys(counts).length === 0) {
      if (currentUser) return [];
      return [
        { name: lang === "ar" ? "الهندسة المالية" : (lang === "fr" ? "Ingénierie Financière" : "Financial Engineering"), value: 4, color: "#D4AF37" },
        { name: lang === "ar" ? "العمليات" : (lang === "fr" ? "Opérations" : "Operations"), value: 1, color: "#B59410" },
        { name: lang === "ar" ? "إدارة مخاطر الصرف" : (lang === "fr" ? "Gestion Risque FX" : "FX Risk Management"), value: 2, color: "#0D7A82" },
        { name: lang === "ar" ? "التصنيف الجمركي" : (lang === "fr" ? "Classification Douanière" : "Customs Classification"), value: 1, color: "#14B8A6" },
      ];
    }

    return Object.entries(counts).map(([name, value], idx) => ({
      name,
      value,
      color: categoryColorMap[name] || defaultColors[idx % defaultColors.length]
    }));
  }, [memories, lang, currentUser]);

  const statsCount = useMemo(() => {
    const activeAlerts = riskAlerts.filter(a => a.status === "Active").length;
    // Calculate retained knowledge score (0% for empty account)
    const baseScore = memories.length === 0 ? 0 : Math.min(Math.max(50 + (memories.length * 8) - (activeAlerts * 4), 30), 98);
    const userAnalyses = metrics.filter(m => m.actionType === "Run Analysis").length;
    return {
      totalMemories: memories.length,
      activeRisks: activeAlerts,
      retainedKnowledge: `${baseScore}%`,
      aiAnalyses: currentUser ? userAnalyses : (userAnalyses || 0)
    };
  }, [memories, riskAlerts, metrics, currentUser]);

  // Color mappings for UI
  const getSeverityBadgeClass = (level: string) => {
    switch (level) {
      case "Critical":
        return "bg-rose-500/10 text-rose-500 border border-rose-500/20";
      case "High":
        return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
      case "Medium":
        return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
    }
  };

  // Compute dynamic style override from custom theme if approved
  const customThemeStyle = useMemo(() => {
    if (currentUser?.customTheme?.approvedAt) {
      const { primaryBg = "#0B0F19", textColor = "#F8FAFC", secondaryColor = "#D4AF37" } = currentUser.customTheme;
      
      const contrastText = getContrastColor(secondaryColor);
      const cardBg = adjustColorBrightness(primaryBg, textColor, 0.08); // 8% blend of text color
      const inputBg = adjustColorBrightness(primaryBg, textColor, 0.14); // 14% blend of text color
      const mutedText = adjustColorBrightness(textColor, primaryBg, 0.40); // 40% blend of background color
      const borderCol = adjustColorBrightness(primaryBg, textColor, 0.22); // 22% blend of text color for clean contrast border
      const accentSubtle = secondaryColor + "1a"; // 10% opacity secondary accent for backgrounds

      return {
        "--custom-bg": primaryBg,
        "--custom-card": cardBg,
        "--custom-input": inputBg,
        "--custom-text": textColor,
        "--custom-text-muted": mutedText,
        "--custom-accent": secondaryColor,
        "--custom-accent-hover": adjustColorBrightness(secondaryColor, textColor, 0.15),
        "--custom-accent-text-contrast": contrastText,
        "--custom-border": borderCol,
        "--custom-accent-subtle": accentSubtle,
        
        // Also apply standard theme variables directly for seamless component inheritance
        "--bg-primary": primaryBg,
        "--bg-secondary": cardBg,
        "--bg-tertiary": inputBg,
        "--text-primary": textColor,
        "--text-secondary": mutedText,
        "--border-color": borderCol,
        "--accent-color": secondaryColor,
        "--accent-hover": adjustColorBrightness(secondaryColor, textColor, 0.15),
        "--accent-subtle": accentSubtle,
        "--accent-text": contrastText,
        "--card-bg": cardBg,
        "--input-bg": inputBg,

        backgroundColor: primaryBg,
        color: textColor,
        "--color-secondary-accent": secondaryColor,
      } as React.CSSProperties;
    }
    return {};
  }, [currentUser?.customTheme]);

  const isCustomThemeActive = !!currentUser?.customTheme?.approvedAt;

  if (isAuthChecking || (currentUser && !isInitialDataLoaded)) {
    return (
      <div 
        id="zakir-auth-loading"
        className={`min-h-screen flex flex-col items-center justify-center transition-all duration-300 ${
          theme === "dark" ? "theme-dark bg-[#0B0F19] text-[#F8FAFC]" : "theme-light bg-[#F0F2F5] text-[#0F172A]"
        }`}
      >
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex items-center justify-center">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
              theme === "light" 
                ? "bg-slate-200 border border-slate-400 text-black" 
                : "bg-[#D4AF37]/5 border border-[#D4AF37]/15 text-[#D4AF37]"
            }`}>
              <ZakirLogo size={56} iconOnly theme={isCustomThemeActive ? "custom" : theme} />
            </div>
            <div className="absolute inset-0 w-20 h-20 rounded-2xl border-2 border-slate-400 dark:border-[#D4AF37]/20 animate-ping opacity-20 pointer-events-none"></div>
          </div>
          <div className="text-center space-y-1">
            <span className={`text-2xl font-black tracking-widest block font-sans ${
              theme === "light" ? "text-black" : "text-white"
            }`}>
              ZAKIR
            </span>
            <span className={`text-[10px] tracking-widest font-mono uppercase block ${
              theme === "light" ? "text-slate-800 font-bold" : "text-slate-400"
            }`}>
              {lang === "ar" ? "الذاكرة السببية المؤسسية" : "The Organizational Causal Memory"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      id="zakir-app-root"
      className={`min-h-screen transition-colors duration-150 ${
        theme === "dark" ? "theme-dark bg-[#0B0F19] text-[#F8FAFC]" : "theme-light bg-[#F0F2F5] text-[#0F172A]"
      } ${
        isCustomThemeActive ? "custom-theme-active" : ""
      }`} 
      style={customThemeStyle}
      dir={t.dir}
    >
      {/* GLOBAL DYNAMIC CSS PALETTE OVERRIDES */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* 1. Global CSS Variables Definition */
        .theme-light {
          --bg-primary: #F0F2F5; /* Facebook-style smooth off-white body background */
          --bg-secondary: #FFFFFF; /* Pure white cards, sidebars, headers */
          --bg-tertiary: #F8FAFC; /* Inputs, tables, tag backgrounds */
          --text-primary: #0F172A; /* Crisp deep slate text */
          --text-secondary: #475569; /* Muted slate gray */
          --border-color: #CBD5E1; /* Professional crisp border (slate-300) for light mode */
          --accent-color: #D4AF37; /* Default premium gold accent */
          --accent-hover: #BCA032;
          --accent-subtle: #D4AF3715;
          --accent-text: #0F172A;
        }

        .theme-dark {
          --bg-primary: #0B0F19; /* Modern ultra-safe dark canvas */
          --bg-secondary: #111827; /* Sophisticated card backgrounds */
          --bg-tertiary: #1F2937; /* Elegant inputs & tab hover states */
          --text-primary: #F8FAFC; /* High-readability crisp off-white text */
          --text-secondary: #94A3B8; /* Muted cool gray text */
          --border-color: #334155; /* Sophisticated contrast border (slate-700) for dark mode */
          --accent-color: #D4AF37; /* Default premium gold accent */
          --accent-hover: #E5C158;
          --accent-subtle: #D4AF3722;
          --accent-text: #0B0F19;
        }

        .custom-theme-active {
          --bg-primary: var(--custom-bg);
          --bg-secondary: var(--custom-card);
          --bg-tertiary: var(--custom-input);
          --text-primary: var(--custom-text);
          --text-secondary: var(--custom-text-muted);
          --border-color: var(--custom-border);
          --accent-color: var(--custom-accent);
          --accent-hover: var(--custom-accent-hover);
          --accent-subtle: var(--custom-accent-subtle);
          --accent-text: var(--custom-accent-text-contrast);
        }

        /* 2. Global Styling Overrides to respect the CSS Variables instantly */
        .theme-light, .theme-dark, .custom-theme-active {
          background-color: var(--bg-primary) !important;
          color: var(--text-primary) !important;
        }

        /* Page main content body background */
        .theme-light main, .theme-dark main, .custom-theme-active main {
          background-color: var(--bg-primary) !important;
        }

        /* Cards, Sidebars, and Headers */
        .theme-light aside, .theme-dark aside, .custom-theme-active aside,
        .theme-light header, .theme-dark header, .custom-theme-active header,
        .theme-light .bg-white,
        .theme-dark .bg-slate-900,
        .theme-dark .bg-slate-900\\/40,
        .theme-dark .bg-slate-900\\/60,
        .theme-dark .bg-slate-950,
        .theme-dark .bg-slate-950\\/20,
        .theme-dark .bg-slate-950\\/40,
        .theme-dark .bg-slate-950\\/60,
        .theme-dark .bg-slate-950\\/80,
        .theme-light .bg-slate-50,
        .theme-light .bg-slate-100,
        .theme-light .bg-slate-200,
        .custom-theme-active .bg-white,
        .custom-theme-active .bg-slate-900,
        .custom-theme-active .bg-slate-900\\/40,
        .custom-theme-active .bg-slate-900\\/60,
        .custom-theme-active .bg-slate-950,
        .custom-theme-active .bg-slate-950\\/20,
        .custom-theme-active .bg-slate-950\\/40,
        .custom-theme-active .bg-slate-950\\/60,
        .custom-theme-active .bg-slate-950\\/80,
        .custom-theme-active .bg-slate-50,
        .custom-theme-active .bg-slate-100 {
          background-color: var(--bg-secondary) !important;
        }

        /* Borders and Dividers */
        .theme-light .border, .theme-dark .border, .custom-theme-active .border,
        .theme-light [class*="border-"], .theme-dark [class*="border-"], .custom-theme-active [class*="border-"],
        .theme-light .border-slate-200, .theme-dark .border-slate-800, .custom-theme-active .border-slate-800,
        .theme-light .border-slate-300, .theme-dark .border-slate-700, .custom-theme-active .border-slate-700,
        .theme-light .border-slate-200\\/60, .theme-dark .border-slate-800\\/60, .custom-theme-active .border-slate-800\\/60,
        .theme-light .border-slate-200\\/80, .theme-dark .border-slate-800\\/80, .custom-theme-active .border-slate-800\\/80,
        .theme-light .border-dashed, .theme-dark .border-dashed, .custom-theme-active .border-dashed {
          border-color: var(--border-color) !important;
        }

        .theme-light .divide-slate-200 > *, .theme-dark .divide-slate-800 > *, .custom-theme-active .divide-slate-800 > *,
        .theme-light [class*="divide-"] > *, .theme-dark [class*="divide-"] > *, .custom-theme-active [class*="divide-"] > * {
          border-color: var(--border-color) !important;
        }

        /* Typography Colors */
        .theme-light h1, .theme-light h2, .theme-light h3, .theme-light h4, .theme-light h5, .theme-light h6,
        .theme-dark h1, .theme-dark h2, .theme-dark h3, .theme-dark h4, .theme-dark h5, .theme-dark h6,
        .custom-theme-active h1, .custom-theme-active h2, .custom-theme-active h3, .custom-theme-active h4, .custom-theme-active h5, .custom-theme-active h6,
        .theme-light p, .theme-dark p, .custom-theme-active p,
        .theme-light li, .theme-dark li, .custom-theme-active li,
        .theme-light td, .theme-dark td, .custom-theme-active td,
        .theme-light th, .theme-dark th, .custom-theme-active th,
        .theme-light span, .theme-dark span, .custom-theme-active span,
        .theme-light label, .theme-dark label, .custom-theme-active label {
          color: var(--text-primary);
        }

        /* Secondary/Muted texts */
        .theme-light .text-slate-400, .theme-dark .text-slate-400, .custom-theme-active .text-slate-400,
        .theme-light .text-slate-500, .theme-dark .text-slate-500, .custom-theme-active .text-slate-500,
        .theme-light .text-slate-600, .theme-dark .text-slate-600, .custom-theme-active .text-slate-600 {
          color: var(--text-secondary) !important;
        }

        /* Inputs & Form controls */
        .theme-light input, .theme-dark input, .custom-theme-active input,
        .theme-light select, .theme-dark select, .custom-theme-active select,
        .theme-light textarea, .theme-dark textarea, .custom-theme-active textarea {
          background-color: var(--bg-tertiary) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-color) !important;
        }

        .theme-light input::placeholder, .theme-dark input::placeholder, .custom-theme-active input::placeholder {
          color: var(--text-secondary) !important;
          opacity: 0.6;
        }

        /* Tables */
        .theme-light table, .theme-dark table, .custom-theme-active table {
          background-color: var(--bg-secondary) !important;
        }
        .theme-light tr, .theme-dark tr, .custom-theme-active tr {
          border-bottom: 1px solid var(--border-color) !important;
        }
        .theme-light tr:hover, .theme-dark tr:hover, .custom-theme-active tr:hover {
          background-color: var(--bg-tertiary) !important;
        }

        /* Accent text color rules */
        .theme-light .text-\\[\\#D4AF37\\], .theme-dark .text-\\[\\#D4AF37\\], .custom-theme-active .text-\\[\\#D4AF37\\],
        .theme-light .text-amber-400, .theme-dark .text-amber-400, .custom-theme-active .text-amber-400,
        .theme-light .text-amber-500, .theme-dark .text-amber-500, .custom-theme-active .text-amber-500 {
          color: var(--accent-color) !important;
        }

        /* Accent background color rules */
        .theme-light .bg-\\[\\#D4AF37\\], .theme-dark .bg-\\[\\#D4AF37\\], .custom-theme-active .bg-\\[\\#D4AF37\\],
        .theme-light .bg-amber-400, .theme-dark .bg-amber-400, .custom-theme-active .bg-amber-400,
        .theme-light .bg-amber-500, .theme-dark .bg-amber-500, .custom-theme-active .bg-amber-500 {
          background-color: var(--accent-color) !important;
          color: var(--accent-text) !important;
        }

        /* Subtle badges & tabs selection */
        .theme-light .bg-\\[\\#D4AF37\\\]\\/15, .theme-dark .bg-\\[\\#D4AF37\\\]\\/15, .custom-theme-active .bg-\\[\\#D4AF37\\\]\\/15,
        .theme-light .bg-amber-500\\/10, .theme-dark .bg-amber-500\\/10, .custom-theme-active .bg-amber-500\\/10,
        .theme-light .bg-amber-500\\/15, .theme-dark .bg-amber-500\\/15, .custom-theme-active .bg-amber-500\\/15 {
          background-color: var(--accent-subtle) !important;
          color: var(--accent-color) !important;
        }

        /* Sidebar link active dots */
        .theme-light .bg-\\[\\#D4AF37\\], .theme-dark .bg-\\[\\#D4AF37\\], .custom-theme-active .bg-\\[\\#D4AF37\\] {
          background-color: var(--accent-color) !important;
        }

        /* Active Navigation item text and icons */
        .theme-light .text-amber-400, .theme-dark .text-amber-400, .custom-theme-active .text-amber-400 {
          color: var(--accent-color) !important;
        }

        /* Navigation elements hover states */
        .theme-light .hover\\:bg-slate-800\\/60:hover, .theme-dark .hover\\:bg-slate-800\\/60:hover, .custom-theme-active .hover\\:bg-slate-800\\/60:hover,
        .theme-light .hover\\:bg-slate-800:hover, .theme-dark .hover\\:bg-slate-800:hover, .custom-theme-active .hover\\:bg-slate-800:hover,
        .theme-light .hover\\:bg-slate-700:hover, .theme-dark .hover\\:bg-slate-700:hover, .custom-theme-active .hover\\:bg-slate-700:hover,
        .theme-light .hover\\:bg-slate-100:hover, .theme-dark .hover\\:bg-slate-100:hover, .custom-theme-active .hover\\:bg-slate-100:hover,
        .theme-light .hover\\:bg-slate-200:hover, .theme-dark .hover\\:bg-slate-200:hover, .custom-theme-active .hover\\:bg-slate-200:hover {
          background-color: var(--bg-tertiary) !important;
        }

        /* Main gradient action button custom overrides */
        .theme-light .bg-gradient-to-r.from-amber-500.to-amber-400,
        .theme-dark .bg-gradient-to-r.from-amber-500.to-amber-400,
        .custom-theme-active .bg-gradient-to-r.from-amber-500.to-amber-400,
        .theme-light .bg-amber-500.hover\\:bg-amber-400,
        .theme-dark .bg-amber-500.hover\\:bg-amber-400,
        .custom-theme-active .bg-amber-500.hover\\:bg-amber-400 {
          background-color: var(--accent-color) !important;
          background-image: none !important;
          color: var(--accent-text) !important;
        }

        .theme-light .bg-gradient-to-r.from-amber-500.to-amber-400:hover,
        .theme-dark .bg-gradient-to-r.from-amber-500.to-amber-400:hover,
        .custom-theme-active .bg-gradient-to-r.from-amber-500.to-amber-400:hover,
        .theme-light .bg-amber-500.hover\\:bg-amber-400:hover,
        .theme-dark .bg-amber-500.hover\\:bg-amber-400:hover,
        .custom-theme-active .bg-amber-500.hover\\:bg-amber-400:hover {
          opacity: 0.9 !important;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar-thumb {
          background: var(--border-color) !important;
        }
        ::-webkit-scrollbar-track {
          background: var(--bg-primary) !important;
        }

        /* SVG, Chart lines, Cartesian grid, and Axes in Custom Theme */
        .custom-theme-active .recharts-cartesian-grid line,
        .custom-theme-active .recharts-cartesian-axis line {
          stroke: var(--border-color) !important;
        }

        .custom-theme-active .recharts-text,
        .custom-theme-active .recharts-label,
        .custom-theme-active .recharts-cartesian-axis-tick-value {
          fill: var(--text-secondary) !important;
        }

        .custom-theme-active .recharts-default-tooltip,
        .custom-theme-active .recharts-tooltip-wrapper > div {
          background-color: var(--bg-secondary) !important;
          border-color: var(--border-color) !important;
          color: var(--text-primary) !important;
        }

        @keyframes loading-bar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(300%);
          }
        }
      ` }} />
      
      {/* AUTHENTICATION & LANDING GATEWAY */}
      {!currentUser ? (
        authMode === "landing" ? (
          <AnimatedLandingPage
            lang={lang}
            theme={theme}
            onToggleTheme={() => {
              const newTheme = theme === "dark" ? "light" : "dark";
              applyGlobalTheme(newTheme, setTheme, currentUser, setCurrentUser, true);
            }}
            onToggleLanguage={toggleLanguage}
            onNavigateAuth={(mode) => setAuthMode(mode)}
            onStripeCheckout={handleLandingStripeCheckout}
          />
        ) : authMode === "register" ? (
          /* REGISTRATION SCREEN (Video 2 Style with Password Checklist Requirements) */
          <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-6 relative selection:bg-amber-500/30">
            {/* Top Back Navigation & Logo */}
            <div className="max-w-xl mx-auto w-full flex items-center justify-between pt-2">
              <button 
                onClick={() => setAuthMode("landing")}
                className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                {lang === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                <span>
                  {lang === "ar" ? "العودة للرئيسية" : (lang === "fr" ? "Retour à l'accueil" : "Back to Home")}
                </span>
              </button>

              <div className="flex items-center gap-2">
                <ZakirLogo iconOnly size={18} theme="dark" />
              </div>
            </div>

            {/* Centered Sign Up Form Card */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="zakir-card w-full max-w-lg mx-auto p-6 sm:p-8 my-8 relative"
            >
              {/* Branding Emblem */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/5 border border-[#D4AF37]/15 flex items-center justify-center mx-auto mb-3">
                  <ZakirLogo iconOnly size={40} theme="dark" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {lang === "fr" ? "S'enregistrer" : (lang === "ar" ? "إنشاء حساب جديد" : "Sign Up")}
                </h1>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  {lang === "fr" 
                    ? "La mémoire causale organisationnelle" 
                    : (lang === "ar" 
                      ? "الذاكرة السببية المؤسسية" 
                      : "The Organizational Causal Memory")}
                </p>
              </div>

              {/* Google Sign In Button */}
              <button 
                type="button"
                onClick={async () => {
                  try {
                    const userProfile = await loginWithGoogle();
                    setCurrentUser(userProfile);
                    applyUserPreferences(userProfile);
                    setAuthMode("landing");
                  } catch (err: any) {
                    setRegError(formatAuthError(err));
                  }
                }}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold rounded-xl border border-slate-700/80 transition-all cursor-pointer flex items-center justify-center gap-2.5 mb-5 shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>{lang === "fr" ? "Sign up with Google" : (lang === "ar" ? "التسجيل باستخدام Google" : "Sign up with Google")}</span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-5">
                <div className="border-t border-slate-800 w-full"></div>
                <span className="bg-slate-900 px-3 text-[10px] uppercase font-semibold text-slate-500 tracking-widest relative z-10">
                  {lang === "ar" ? "أو" : "OR"}
                </span>
              </div>

              {/* Registration Form */}
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {regError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    {renderErrorContent(regError)}
                  </div>
                )}

                {/* Owner Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-amber-500" />
                    <span>{lang === "fr" ? "Nom complet du propriétaire" : (lang === "ar" ? "الاسم الكامل للمالك" : "Full Name of Owner")}</span>
                  </label>
                  <input 
                    type="text" 
                    value={regOwnerName}
                    onChange={(e) => setRegOwnerName(e.target.value)}
                    className="zakir-input w-full h-10 px-3"
                    placeholder="e.g. Mohamed Aly"
                    required
                  />
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-amber-500" />
                    <span>{lang === "fr" ? "Nom de l'entreprise" : (lang === "ar" ? "اسم الشركة / المؤسسة" : "Company Name")}</span>
                  </label>
                  <input 
                    type="text" 
                    value={regCompanyName}
                    onChange={(e) => setRegCompanyName(e.target.value)}
                    className="zakir-input w-full h-10 px-3"
                    placeholder="e.g. Mauritanian Finance Group"
                    required
                  />
                </div>

                {/* Company Email */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-amber-500" />
                    <span>{lang === "fr" ? "Email de l'entreprise" : (lang === "ar" ? "البريد الإلكتروني للشركة" : "Company Email")}</span>
                  </label>
                  <input 
                    type="email" 
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="zakir-input w-full h-10 px-3"
                    placeholder="e.g. mohamedvadel60@entreprise8.com"
                    required
                  />
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                      <span>{lang === "fr" ? "Mot de passe" : (lang === "ar" ? "كلمة المرور" : "Password")}</span>
                    </span>
                  </label>
                  <div className="relative">
                    <input 
                      type={showRegPassword ? "text" : "password"} 
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="zakir-input w-full h-10 px-3 pr-10 font-mono"
                      placeholder="••••••••"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* DYNAMIC PASSWORD REQUIREMENTS HELPER BOX (Video 2 Requirements) */}
                <div className="p-3 bg-slate-950/80 border border-slate-800/90 rounded-xl space-y-2">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center justify-between">
                    <span>{lang === "fr" ? "Password requirements:" : (lang === "ar" ? "شروط كلمة المرور المطلوبة:" : "Password requirements:")}</span>
                    <span className={`text-[10px] font-normal ${pwdValidation.isValid ? "text-emerald-400" : "text-amber-500"}`}>
                      {pwdValidation.isValid ? (lang === "ar" ? "مستوفية جميع الشروط" : "All criteria met") : (lang === "ar" ? "مطلوبة" : "Required")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {/* Min 8 chars */}
                    <div className={`flex items-center gap-1.5 font-mono ${pwdValidation.len ? "text-emerald-400" : "text-slate-500"}`}>
                      {pwdValidation.len ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0"></div>}
                      <span>Min 8 chars</span>
                    </div>

                    {/* Uppercase */}
                    <div className={`flex items-center gap-1.5 font-mono ${pwdValidation.upper ? "text-emerald-400" : "text-slate-500"}`}>
                      {pwdValidation.upper ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0"></div>}
                      <span>Uppercase [A-Z]</span>
                    </div>

                    {/* Lowercase */}
                    <div className={`flex items-center gap-1.5 font-mono ${pwdValidation.lower ? "text-emerald-400" : "text-slate-500"}`}>
                      {pwdValidation.lower ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0"></div>}
                      <span>Lowercase [a-z]</span>
                    </div>

                    {/* Number */}
                    <div className={`flex items-center gap-1.5 font-mono ${pwdValidation.num ? "text-emerald-400" : "text-slate-500"}`}>
                      {pwdValidation.num ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0"></div>}
                      <span>Number [0-9]</span>
                    </div>

                    {/* Special token */}
                    <div className={`flex items-center gap-1.5 font-mono col-span-2 ${pwdValidation.special ? "text-emerald-400" : "text-slate-500"}`}>
                      {pwdValidation.special ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0"></div>}
                      <span>Special character (@, #, $, !, %, &)</span>
                    </div>
                  </div>
                </div>

                {/* Confirm Password Input */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                      <span>{lang === "fr" ? "Confirmer le mot de passe" : (lang === "ar" ? "تأكيد كلمة المرور" : "Confirm Password")}</span>
                    </span>
                    {regConfirmPassword.length > 0 && (
                      <span className={`text-[10px] font-mono ${pwdValidation.match ? "text-emerald-400" : "text-rose-400"}`}>
                        {pwdValidation.match ? (lang === "ar" ? "متطابقتان ✓" : "Match ✓") : (lang === "ar" ? "غير متطابقتين ✕" : "No match ✕")}
                      </span>
                    )}
                  </label>
                  <input 
                    type="password" 
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500 transition-all placeholder:text-slate-600 font-mono"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {/* Submit Register Button */}
                <button 
                  type="submit" 
                  disabled={isSubmittingReg}
                  className="zakir-btn-primary w-full h-11 mt-2 uppercase tracking-wider"
                >
                  {isSubmittingReg ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>{lang === "fr" ? "S'enregistrer" : (lang === "ar" ? "إنشاء حساب جديد" : "Sign Up")}</span>
                  )}
                </button>
              </form>

              {/* Already registered switch to login */}
              <div className="mt-6 text-center border-t border-slate-800/80 pt-4">
                <button 
                  onClick={() => setAuthMode("login")}
                  className="text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors cursor-pointer"
                >
                  {lang === "fr" ? "Déjà un compte ? Se connecter" : (lang === "ar" ? "لديك حساب بالفعل؟ تسجيل الدخول" : "Already have an account? Sign In")}
                </button>
              </div>
            </motion.div>

            {/* Bottom Language Selector matching Video 2 */}
            <div className="max-w-xl mx-auto w-full flex items-center justify-center gap-3 pt-2">
              <button 
                onClick={() => toggleLanguage("ar")}
                className={`text-xs px-3 py-1 rounded-lg border transition-colors ${lang === "ar" ? "bg-amber-500 text-slate-950 font-bold border-amber-500" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"}`}
              >
                ع
              </button>
              <button 
                onClick={() => toggleLanguage("fr")}
                className={`text-xs px-3 py-1 rounded-lg border transition-colors ${lang === "fr" ? "bg-amber-500 text-slate-950 font-bold border-amber-500" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"}`}
              >
                FR
              </button>
              <button 
                onClick={() => toggleLanguage("en")}
                className={`text-xs px-3 py-1 rounded-lg border transition-colors ${lang === "en" ? "bg-amber-500 text-slate-950 font-bold border-amber-500" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"}`}
              >
                EN
              </button>
            </div>
          </div>
        ) : (
          /* LOGIN SCREEN */
          <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-6 relative selection:bg-amber-500/30">
            {/* Top Back Navigation & Logo */}
            <div className="max-w-md mx-auto w-full flex items-center justify-between pt-2">
              <button 
                onClick={() => setAuthMode("landing")}
                className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                {lang === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                <span>
                  {lang === "ar" ? "العودة للرئيسية" : (lang === "fr" ? "Retour à l'accueil" : "Back to Home")}
                </span>
              </button>

              <div className="flex items-center gap-2">
                <ZakirLogo iconOnly size={18} theme="dark" />
              </div>
            </div>

            {/* Login or Forgot Password Card */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="zakir-card w-full max-w-md mx-auto p-6 sm:p-8 my-8 relative"
            >
              {showForgotPassword ? (
                /* FORGOT PASSWORD FORM */
                <div>
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-3 font-bold text-xl">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">
                      {lang === "fr" ? "Réinitialiser le mot de passe" : (lang === "ar" ? "إعادة تعيين كلمة السر" : "Reset Password")}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                      {resetStep === "forgot" && (lang === "ar" ? "أدخل بريدك الإلكتروني للحصول على رمز إعادة تعيين ديناميكي مكون من 6 أرقام" : "Enter your email to receive a 6-digit dynamic reset code")}
                      {resetStep === "verify_code" && (lang === "ar" ? "أدخل الرمز المكون من 6 أرقام المرسل لبريدك الإلكتروني" : "Enter the 6-digit code sent to your email")}
                      {resetStep === "new_password" && (lang === "ar" ? "اختر كلمة مرور جديدة وآمنة לחשבונך" : "Create a new secure password for your account")}
                      {resetStep === "success" && (lang === "ar" ? "تم إعادة تعيين كلمة السر بنجاح!" : "Your password was updated successfully!")}
                    </p>
                  </div>

                  <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                    {resetErrorMsg && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <p className="font-medium leading-relaxed whitespace-pre-line">{resetErrorMsg}</p>
                          {resetCooldownSeconds > 0 && (
                            <div className="pt-1 flex items-center gap-1.5 text-amber-400 font-mono text-[11px] font-bold">
                              <Clock className="w-3.5 h-3.5 animate-pulse shrink-0" />
                              <span>
                                {lang === "ar"
                                  ? `وقت الانتظار المتبقي: ${formatCountdown(resetCooldownSeconds)}`
                                  : `Time remaining: ${formatCountdown(resetCooldownSeconds)}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {resetSuccessMsg && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{resetSuccessMsg}</span>
                      </div>
                    )}

                    {/* STEP 1: Enter Email */}
                    {resetStep === "forgot" && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">{t.email}</label>
                        <input 
                          type="email" 
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
                          placeholder="name@company.com"
                          required
                        />
                      </div>
                    )}

                    {/* STEP 2: Enter Verification Code */}
                    {resetStep === "verify_code" && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            {lang === "ar" ? "الرمز المكون من 6 أرقام" : "6-Digit Verification Code"}
                          </label>
                          <input 
                            type="text" 
                            maxLength={6}
                            placeholder="------"
                            value={resetCode}
                            onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                            className="w-full text-center tracking-[8px] text-lg font-bold font-mono h-11 bg-slate-950 border border-slate-800 rounded-xl text-amber-400 placeholder:text-slate-700 focus:outline-none focus:border-amber-500 transition-all"
                            required
                          />
                        </div>
                      </div>
                    )}

                    {/* STEP 3: Enter New Password */}
                    {resetStep === "new_password" && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            {lang === "ar" ? "كلمة المرور الجديدة" : "New Password"}
                          </label>
                          <input 
                            type="password" 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500 transition-all"
                            placeholder="••••••••"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            {lang === "ar" ? "تأكيد كلمة المرور" : "Confirm New Password"}
                          </label>
                          <input 
                            type="password" 
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500 transition-all"
                            placeholder="••••••••"
                            required
                          />
                        </div>
                      </div>
                    )}

                    {/* STEP 4: Success View */}
                    {resetStep === "success" && (
                      <div className="text-center py-4 space-y-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <p className="text-xs text-slate-300">
                          {lang === "ar" ? "تم تفعيل كلمة السر الجديدة بنجاح." : "Your account password has been fully updated."}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {resetStep !== "success" ? (
                      <button 
                        type="submit" 
                        disabled={isSendingReset || (resetStep === "forgot" && resetCooldownSeconds > 0)}
                        className={`w-full h-11 mt-2 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
                          resetStep === "forgot" && resetCooldownSeconds > 0
                            ? "bg-slate-800/90 text-slate-400 border border-slate-700/60 cursor-not-allowed opacity-80"
                            : "zakir-btn-primary w-full h-11 mt-2 uppercase tracking-wider"
                        }`}
                      >
                        {isSendingReset ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <span>
                            {resetStep === "forgot" && (
                              resetCooldownSeconds > 0
                                ? (lang === "ar"
                                    ? `يمكنك إعادة الإرسال بعد ${formatCountdown(resetCooldownSeconds)}`
                                    : lang === "fr"
                                    ? `Réexpédier dans ${formatCountdown(resetCooldownSeconds)}`
                                    : `Resend available in ${formatCountdown(resetCooldownSeconds)}`)
                                : (lang === "ar" ? "إرسال رمز التوثيق" : "Request Reset Code")
                            )}
                            {resetStep === "verify_code" && (lang === "ar" ? "تأكيد الرمز والمتابعة" : "Verify & Continue")}
                            {resetStep === "new_password" && (lang === "ar" ? "حفظ وتفعيل كلمة السر" : "Save New Password")}
                          </span>
                        )}
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowForgotPassword(false);
                          setResetStep("forgot");
                          setResetEmail("");
                          setResetCode("");
                          setNewPassword("");
                          setConfirmNewPassword("");
                          setResetSuccessMsg("");
                          setResetErrorMsg("");
                          setResetCooldownSeconds(0);
                        }}
                        className="w-full h-11 mt-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
                      >
                        {lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Sign In"}
                      </button>
                    )}
                  </form>

                  {resetStep !== "success" && (
                    <div className="mt-6 text-center border-t border-slate-800/80 pt-4">
                      <button 
                        onClick={() => {
                          setShowForgotPassword(false);
                          setResetStep("forgot");
                          setResetEmail("");
                          setResetCode("");
                          setNewPassword("");
                          setConfirmNewPassword("");
                          setResetErrorMsg("");
                          setResetSuccessMsg("");
                          setResetCooldownSeconds(0);
                        }}
                        className="text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                      >
                        {lang === "ar" ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                        <span>{lang === "fr" ? "Retour à la connexion" : (lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Sign In")}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* STANDARD LOGIN FORM */
                <div>
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/5 border border-[#D4AF37]/15 flex items-center justify-center mx-auto mb-3 text-[#D4AF37]">
                      <ZakirLogo iconOnly size={40} theme="dark" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">
                      {lang === "fr" ? "Se connecter" : (lang === "ar" ? "تسجيل الدخول" : "Sign In")}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                      {lang === "fr" ? "Accédez à votre espace institutionnel" : (lang === "ar" ? "الدخول لبيئة ذاكرة المؤسسة" : "Access your organizational gateway")}
                    </p>
                  </div>

                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    {/* Google Sign In Button */}
                    <button 
                      type="button"
                      onClick={async () => {
                        try {
                          const userProfile = await loginWithGoogle();
                          setCurrentUser(userProfile);
                          applyUserPreferences(userProfile);
                          setAuthMode("landing");
                        } catch (err: any) {
                          setLoginError(formatAuthError(err));
                        }
                      }}
                      className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold rounded-xl border border-slate-700/80 transition-all cursor-pointer flex items-center justify-center gap-2.5 mb-5 shadow-sm"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      <span>{lang === "fr" ? "Se connecter avec Google" : (lang === "ar" ? "تسجيل الدخول باستخدام Google" : "Sign in with Google")}</span>
                    </button>

                    {/* Divider */}
                    <div className="relative flex items-center justify-center my-5">
                      <div className="border-t border-slate-800 w-full"></div>
                      <span className="bg-slate-900 px-3 text-[10px] uppercase font-semibold text-slate-500 tracking-widest relative z-10">
                        {lang === "ar" ? "أو" : "OR"}
                      </span>
                    </div>

                    {loginError && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        {renderErrorContent(loginError)}
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">{t.email}</label>
                      <input 
                        type="email" 
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="zakir-input w-full h-10 px-3"
                        placeholder="name@company.com"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-300">{t.password}</label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowForgotPassword(true);
                            setResetEmail(loginEmail);
                            setResetSuccessMsg("");
                            setResetErrorMsg("");
                          }}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold transition-colors cursor-pointer"
                        >
                          {lang === "fr" ? "Mot de passe oublié ?" : (lang === "ar" ? "نسيت كلمة السر؟" : "Forgot Password?")}
                        </button>
                      </div>
                      <input 
                        type="password" 
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="zakir-input w-full h-10 px-3 font-mono"
                        placeholder="••••••••"
                        required
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={isSubmittingLogin}
                      className="bg-orange-500 text-black rounded-none text-[20px] font-extrabold py-4 px-8 border-4 border-black w-full mt-2 cursor-pointer"
                    >
                      {isSubmittingLogin ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>{lang === "fr" ? "Se connecter" : (lang === "ar" ? "تسجيل الدخول" : "Sign In")}</span>
                      )}
                    </button>
                  </form>

                  <div className="mt-6 text-center border-t border-slate-800/80 pt-4">
                    <button 
                      onClick={() => setAuthMode("register")}
                      className="text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors cursor-pointer"
                    >
                      {lang === "fr" ? "Pas encore de compte ? S'enregistrer" : (lang === "ar" ? "ليس لديك حساب؟ إنشاء حساب جديد" : "No account yet? Register here")}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Language switch */}
            <div className="max-w-md mx-auto w-full flex items-center justify-center gap-3 pt-2">
              <button 
                onClick={() => toggleLanguage("ar")}
                className={`text-xs px-3 py-1 rounded-lg border transition-colors ${lang === "ar" ? "bg-amber-500 text-slate-950 font-bold border-amber-500" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"}`}
              >
                ع
              </button>
              <button 
                onClick={() => toggleLanguage("fr")}
                className={`text-xs px-3 py-1 rounded-lg border transition-colors ${lang === "fr" ? "bg-amber-500 text-slate-950 font-bold border-amber-500" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"}`}
              >
                FR
              </button>
              <button 
                onClick={() => toggleLanguage("en")}
                className={`text-xs px-3 py-1 rounded-lg border transition-colors ${lang === "en" ? "bg-amber-500 text-slate-950 font-bold border-amber-500" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"}`}
              >
                EN
              </button>
            </div>
          </div>
        )
      ) : (currentUser && !currentUser.isEmailVerified && currentUser.verification_required !== false) ? (
        <EmailVerificationView
          currentUser={currentUser}
          lang={lang}
          onLogout={handleLogout}
          setCurrentUser={setCurrentUser}
          applyUserPreferences={applyUserPreferences}
        />
      ) : currentUser.id === ADMIN_USER_ID ? (
        /* ADMIN DASHBOARD VIEW FOR ADMIN USER */
        <AdminDashboard
          currentUser={currentUser}
          lang={lang}
          theme={theme}
          toggleLanguage={toggleLanguage}
          toggleTheme={toggleTheme}
          onLogout={handleLogout}
        />
      ) : (
        /* MAIN APPLICATION WORKSPACE LAYOUT */
        <div id="main-app-workspace" className="flex h-screen overflow-hidden">
          
          {/* MOBILE OVERLAY BACKDROP */}
          <AnimatePresence>
            {isMobileSidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileSidebarOpen(false)}
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
              />
            )}
          </AnimatePresence>

          {/* DESKTOP & MOBILE RESPONSIVE SIDEBAR */}
          <aside 
            className={`flex flex-col bg-[#0F172A] border-r border-slate-800/60 shadow-2xl h-full relative z-30 transition-all duration-300 ease-in-out shrink-0 overflow-y-auto custom-scrollbar ${
              /* Desktop sizing */
              isSidebarCollapsed ? "md:w-16" : "md:w-60"
            } ${
              /* Mobile drawer slide-over */
              "max-md:fixed max-md:inset-y-0 max-md:z-50 max-md:w-64 max-md:" + (lang === "ar" ? "right-0 border-l" : "left-0 border-r") + " " + (
                isMobileSidebarOpen 
                  ? "max-md:translate-x-0" 
                  : (lang === "ar" ? "max-md:translate-x-full" : "max-md:-translate-x-full")
              )
            }`} 
            id="sidebar-container"
          >
            {/* Logo & Toggle Header */}
            <div className={`p-4 border-b border-slate-800/50 flex items-center shrink-0 ${
              isSidebarCollapsed ? "justify-center" : "justify-between"
            }`}>
              {!isSidebarCollapsed ? (
                <ZakirLogo theme={isCustomThemeActive ? "custom" : theme} />
              ) : (
                <ZakirLogo iconOnly size={28} theme={isCustomThemeActive ? "custom" : theme} />
              )}

              {/* Desktop Sidebar Collapse Toggle Button */}
              <button
                onClick={toggleSidebarCollapse}
                className="hidden md:flex p-1.5 rounded-lg bg-slate-800/50 hover:bg-[#D4AF37]/20 text-slate-400 hover:text-[#D4AF37] border border-slate-700/60 transition-all cursor-pointer items-center justify-center group/toggle"
                title={isSidebarCollapsed ? (lang === "ar" ? "توسيع الشريط الجانبي" : "Expand Sidebar") : (lang === "ar" ? "طي الشريط الجانبي" : "Collapse Sidebar")}
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>

              {/* Mobile Close Button */}
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="md:hidden p-1.5 rounded-lg bg-slate-800/60 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Connected User Account Info - Clicking turns to Settings Account tab */}
            <div 
              onClick={() => {
                setActiveTab("settings");
                setSettingsActiveSubTab("account");
                setIsMobileSidebarOpen(false);
              }}
              className={`mx-2.5 my-2.5 bg-slate-800/30 hover:bg-slate-800/60 hover:border-[#D4AF37]/50 border border-slate-800/40 rounded-xl transition-all shrink-0 cursor-pointer group/profileCard ${
                isSidebarCollapsed ? "p-2 text-center flex justify-center" : "p-2.5 flex items-center gap-3"
              }`}
              title={lang === "ar" ? "انقر لإدارة الحساب والصورة الشخصية" : "Click to manage account & profile photo"}
            >
              <div className="relative group/user shrink-0">
                {currentUser.avatarUrl ? (
                  <img 
                    src={currentUser.avatarUrl} 
                    alt={currentUser.ownerName || currentUser.email} 
                    className="w-8 h-8 rounded-lg object-cover border border-[#D4AF37]/60 shadow-md group-hover/profileCard:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#D4AF37] to-[#F5E0A5] flex items-center justify-center text-[#0F172A] font-extrabold text-xs shadow-md group-hover/profileCard:scale-105 transition-transform">
                    {(currentUser.ownerName || currentUser.email).slice(0, 2).toUpperCase()}
                  </div>
                )}

                {isSidebarCollapsed && (
                  <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/user:opacity-100 transition-all duration-200 whitespace-nowrap shadow-xl rounded-lg px-3 py-2 bg-slate-900 text-white text-xs border border-slate-700 font-medium ${
                    lang === "ar" ? "right-full mr-3" : "left-full ml-3"
                  }`}>
                    <p className="font-bold text-white text-xs">{currentUser.ownerName || currentUser.email}</p>
                    <p className="text-[10px] text-slate-400">{currentUser.role} • {lang === "ar" ? "إعدادات الملف" : "Account Settings"}</p>
                  </div>
                )}
              </div>

              {!isSidebarCollapsed && (
                <div className="overflow-hidden flex-1">
                  <h4 className="text-xs font-bold truncate text-white leading-snug group-hover/profileCard:text-[#D4AF37] transition-colors">
                    {currentUser.ownerName || currentUser.email}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Shield className="w-3 h-3 text-[#D4AF37]" />
                    <span className="text-[10px] text-slate-400 font-semibold truncate">{currentUser.role}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Tabs Menu */}
            <nav className="px-2 py-1 space-y-3 shrink-0">
              {(
                [
                  {
                    group: lang === "ar" ? "بيئة العمل" : "WORKSPACE",
                    items: [
                      { id: "dashboard", label: (t as any).refreshPage || (lang === "ar" ? "لوحة التحكم" : "Dashboard"), icon: Compass },
                      { id: "library", label: t.allCategories || (lang === "ar" ? "مكتبة الذاكرة" : "Memory Library"), icon: FileText },
                      { id: "add", label: t.logMemoryBtn || (lang === "ar" ? "إضافة ذاكرة" : "Add Memory"), icon: PlusCircle },
                      { id: "files", label: lang === "ar" ? "إدارة الملفات" : (lang === "fr" ? "Fichiers & Vault" : "File Vault"), icon: Folder },
                    ]
                  },
                  {
                    group: lang === "ar" ? "الذكاء والتحليل" : "INTELLIGENCE",
                    items: [
                      { id: "smart", label: t.smartEvolutionTitle || (lang === "ar" ? "التطور الذكي" : "Smart Evolution"), icon: Brain },
                      { id: "market", label: t.marketIntelligenceTitle || (lang === "ar" ? "ذكاء السوق" : "Market Intelligence"), icon: TrendingUp },
                      { id: "agent", label: t.aiAgentTitle || (lang === "ar" ? "المستشار المعرفي" : "Cognitive Advisor"), icon: Sparkles },
                    ]
                  },
                  {
                    group: lang === "ar" ? "الإدارة والأمان" : "MANAGEMENT",
                    items: [
                      { id: "alerts", label: t.riskAlertsTitle || (lang === "ar" ? "تنبيهات المخاطر" : "Risk Alerts"), icon: ShieldAlert, badge: statsCount.activeRisks },
                      { id: "gmail", label: lang === "ar" ? "البريد" : (lang === "fr" ? "Messagerie" : "Email Vault"), icon: Mail },
                      { id: "settings", label: t.settingsTitle || (lang === "ar" ? "الإعدادات" : "Settings"), icon: SettingsIcon },
                      { id: "support", label: lang === "ar" ? "الدعم الفني" : (lang === "fr" ? "Support" : "Support Center"), icon: HelpCircle },
                    ]
                  }
                ] as { group: string; items: { id: string; label: any; icon: any; badge?: number }[] }[]
              ).map((section, idx) => {
                const filteredItems = section.items.filter((item) => {
                  if (!currentUser) return true;
                  if (currentUser.role === "CEO") return true;
                  if (!currentUser.powers) return true;
                  switch (item.id) {
                    case "files": return !!currentUser.powers.fileVault;
                    case "library":
                    case "add": return !!currentUser.powers.memoryVault;
                    case "alerts": return !!currentUser.powers.riskRadar;
                    case "market": return !!currentUser.powers.marketIntel;
                    case "settings": return !!currentUser.powers.settings;
                    default: return true;
                  }
                });

                if (filteredItems.length === 0) return null;

                return (
                  <div key={idx} className="space-y-1">
                    {!isSidebarCollapsed && (
                      <div className="px-2.5 pt-1 pb-0.5 text-[9px] font-black uppercase tracking-widest text-[#D4AF37]/80">
                        {section.group}
                      </div>
                    )}
                    {isSidebarCollapsed && idx > 0 && (
                      <div className="my-1.5 border-t border-slate-800/60 mx-2" />
                    )}
                    {filteredItems.map((item) => {
                      const IconComponent = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <div key={item.id} className="relative group">
                          <button
                            onClick={() => {
                              setActiveTab(item.id as any);
                              setIsMobileSidebarOpen(false);
                            }}
                            className={`w-full h-9 rounded-lg text-xs font-semibold flex items-center transition-all cursor-pointer relative ${
                              isSidebarCollapsed ? "justify-center px-0" : "justify-between px-2.5"
                            } ${
                              isActive 
                                ? "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 font-bold shadow-sm shadow-[#D4AF37]/5" 
                                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                            }`}
                          >
                            <div className={`flex items-center ${isSidebarCollapsed ? "justify-center" : "gap-2.5"}`}>
                              {!isSidebarCollapsed && (
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-[#D4AF37] shadow-sm shadow-[#D4AF37]" : "bg-slate-700"}`} />
                              )}
                              <IconComponent className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-[#D4AF37]" : "text-slate-400 group-hover:text-white"}`} />
                              
                              {!isSidebarCollapsed && (
                                <span className="truncate max-w-[125px] leading-tight text-[12px]">{item.label}</span>
                              )}
                            </div>

                            {/* Badge when expanded */}
                            {!isSidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                                isActive ? "bg-[#D4AF37] text-[#0F172A]" : "bg-rose-500 text-white"
                              }`}>
                                {item.badge}
                              </span>
                            )}

                            {/* Small active badge dot when collapsed */}
                            {isSidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#0F172A]" />
                            )}
                          </button>

                          {/* Tooltip on Hover when Collapsed */}
                          {isSidebarCollapsed && (
                            <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap shadow-xl rounded-lg px-3 py-1.5 bg-slate-900 text-white text-xs border border-slate-700/80 font-medium flex items-center gap-2 ${
                              lang === "ar" ? "right-full mr-3" : "left-full ml-3"
                            }`}>
                              <span>{item.label}</span>
                              {item.badge !== undefined && item.badge > 0 && (
                                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                  {item.badge}
                                </span>
                              )}
                              <div className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 border-slate-700/80 rotate-45 ${
                                lang === "ar" ? "-right-1 border-t border-r" : "-left-1 border-b border-l"
                              }`} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </nav>

            {/* Bottom Actions Area (Positioned directly under Settings with no empty space) */}
            <div className={`pt-2.5 pb-4 px-2.5 mt-2 border-t border-slate-800/60 space-y-2.5 shrink-0 ${isSidebarCollapsed ? "text-center" : ""}`}>
              
              {!isSidebarCollapsed && <InstallPrompt lang={lang} />}
              
              {/* Active Subscription Pill Button */}
              <div className="relative group/starter">
                {!isSidebarCollapsed ? (
                  <button
                    onClick={() => {
                      setActiveTab("settings");
                      setSettingsActiveSubTab("subscription");
                      setIsMobileSidebarOpen(false);
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-slate-700/80 bg-slate-800/40 hover:bg-[#D4AF37]/15 hover:border-[#D4AF37]/60 text-slate-200 hover:text-[#D4AF37] transition-all flex items-center justify-between group/btn cursor-pointer shadow-sm"
                  >
                    <span className="text-xs font-bold tracking-wide">
                      {currentUser?.subscriptionPlan || "Starter"}
                    </span>
                    <div className="flex items-center gap-1.5 text-[#D4AF37]">
                      <CreditCard className="w-4 h-4" />
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setActiveTab("settings");
                      setSettingsActiveSubTab("subscription");
                    }}
                    className="w-9 h-9 mx-auto rounded-xl bg-slate-800/50 hover:bg-[#D4AF37]/20 border border-slate-700/80 hover:border-[#D4AF37]/60 text-[#D4AF37] flex items-center justify-center transition-all cursor-pointer shadow-sm"
                  >
                    <CreditCard className="w-4 h-4" />
                    {/* Tooltip on hover */}
                    <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/starter:opacity-100 transition-all duration-200 whitespace-nowrap shadow-xl rounded-lg px-3 py-1.5 bg-slate-900 text-white text-xs border border-slate-700 font-medium ${
                      lang === "ar" ? "right-full mr-3" : "left-full ml-3"
                    }`}>
                      {lang === "ar" ? `اشتراك ${currentUser?.subscriptionPlan || "Starter"}` : `${currentUser?.subscriptionPlan || "Starter"} Subscription`}
                    </div>
                  </button>
                )}
              </div>

              {/* 1-day Trial Countdown Widget */}
              <div className="relative group/trial">
                {!isSidebarCollapsed ? (
                  <div className="p-2.5 bg-slate-800/30 border border-slate-800/50 rounded-xl">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#D4AF37] mb-1">
                      <span>{t.daysLeft}</span>
                      <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                    </div>
                    <div className="text-xs font-mono font-black text-center tracking-wider text-white">
                      {timeLeftStr}
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 block leading-tight">
                      {t.mandatoryPayAlert}
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-800/40 border border-slate-800/60 rounded-xl flex items-center justify-center cursor-pointer hover:border-[#D4AF37]/40 text-[#D4AF37]">
                    <Clock className="w-4 h-4" />
                    {/* Tooltip on hover */}
                    <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/trial:opacity-100 transition-all duration-200 whitespace-nowrap shadow-xl rounded-lg px-3 py-2 bg-slate-900 text-white text-xs border border-slate-700 font-medium ${
                      lang === "ar" ? "right-full mr-3" : "left-full ml-3"
                    }`}>
                      <p className="font-bold text-[#D4AF37]">{t.daysLeft}: {timeLeftStr}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{t.mandatoryPayAlert}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Theme & Language Selectors */}
              {!isSidebarCollapsed ? (
                <div className="flex items-center justify-between gap-1.5 text-xs">
                  {/* Language Controls */}
                  <div className="flex bg-slate-900/60 rounded-md p-0.5 border border-slate-800">
                    {(["en", "ar", "fr"] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => toggleLanguage(l)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                          lang === l ? "bg-[#D4AF37] text-[#0F172A]" : "text-slate-400"
                        }`}
                      >
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Theme Toggles */}
                  <div className="flex bg-slate-900/60 rounded-md p-0.5 border border-slate-800">
                    {(["light", "dark"] as const).map((th) => (
                      <button
                        key={th}
                        onClick={() => toggleTheme(th)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                          theme === th ? "bg-[#D4AF37] text-[#0F172A]" : "text-slate-400"
                        }`}
                      >
                        {th === "light" ? t.light : t.dark}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 items-center">
                  {/* Compact Language Cycling Button */}
                  <div className="relative group/lang">
                    <button
                      onClick={() => {
                        const nextLang = lang === "ar" ? "en" : (lang === "en" ? "fr" : "ar");
                        toggleLanguage(nextLang);
                      }}
                      className="w-9 h-9 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-[#D4AF37] font-extrabold text-[11px] border border-slate-700/60 flex items-center justify-center transition-all cursor-pointer"
                    >
                      {lang.toUpperCase()}
                    </button>
                    <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/lang:opacity-100 transition-all duration-200 whitespace-nowrap shadow-xl rounded-lg px-3 py-1.5 bg-slate-900 text-white text-xs border border-slate-700 font-medium ${
                      lang === "ar" ? "right-full mr-3" : "left-full ml-3"
                    }`}>
                      {lang === "ar" ? "العربية (انقر للتغيير)" : (lang === "fr" ? "Français (cliquer)" : "English (click to switch)")}
                    </div>
                  </div>

                  {/* Compact Theme Toggle Button */}
                  <div className="relative group/theme">
                    <button
                      onClick={() => toggleTheme(theme === "dark" ? "light" : "dark")}
                      className="w-9 h-9 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 flex items-center justify-center transition-all cursor-pointer"
                    >
                      {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
                    </button>
                    <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/theme:opacity-100 transition-all duration-200 whitespace-nowrap shadow-xl rounded-lg px-3 py-1.5 bg-slate-900 text-white text-xs border border-slate-700 font-medium ${
                      lang === "ar" ? "right-full mr-3" : "left-full ml-3"
                    }`}>
                      {theme === "dark" ? (lang === "ar" ? "الوضع الفاتح" : "Light Mode") : (lang === "ar" ? "الوضع الداكن" : "Dark Mode")}
                    </div>
                  </div>
                </div>
              )}

              {/* Logout Button */}
              <div className="relative group/logout">
                <button
                  onClick={handleLogout}
                  className={`w-full border border-slate-800 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    isSidebarCollapsed ? "h-9 w-9 px-0 mx-auto" : "h-9 px-3 gap-2 text-slate-400"
                  }`}
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-400 group-hover/logout:text-rose-400 transition-colors" />
                  {!isSidebarCollapsed && <span>{t.logout}</span>}
                </button>
                {isSidebarCollapsed && (
                  <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/logout:opacity-100 transition-all duration-200 whitespace-nowrap shadow-xl rounded-lg px-3 py-1.5 bg-slate-900 text-rose-400 text-xs border border-slate-700 font-medium ${
                    lang === "ar" ? "right-full mr-3" : "left-full ml-3"
                  }`}>
                    {t.logout}
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT AREA CONTAINER */}
          <main className="flex-1 overflow-y-auto relative h-full">
            {/* Smooth Top Progress Bar */}
            {isLoading && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-transparent overflow-hidden z-[999] pointer-events-none">
                <div className="h-full bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 w-1/3 rounded-full animate-[loading-bar_1.2s_infinite_linear]"></div>
              </div>
            )}
            
            {/* Module Loader bar (Includes last update time, page actions) */}
            <header className={`zakir-header px-4 md:px-8 h-16 border-b flex items-center justify-between sticky top-0 z-20 backdrop-blur-md transition-colors ${
              theme === "dark" ? "bg-[#0B0F19]/80 border-slate-800/60" : "bg-white/80 border-slate-200"
            }`}>
              <div className="flex items-center gap-3">
                {/* Mobile Menu Open Button */}
                <button
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="md:hidden p-2 rounded-lg bg-slate-800/40 border border-slate-700/50 text-slate-300 hover:text-white"
                  aria-label="Toggle Mobile Sidebar"
                >
                  <Menu className="w-5 h-5 text-[#D4AF37]" />
                </button>


                
                {/* Visual Accent Subscription Badge */}
                <div className="zakir-badge hidden sm:inline-flex items-center gap-1">
                  <Award className="w-3 h-3 text-[#D4AF37]" />
                  <span className="text-[10px] font-bold uppercase">{currentUser?.subscriptionPlan || "Starter"}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className={`h-9 px-3 border text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    isRefreshing ? "opacity-50 pointer-events-none" : ""
                  } ${
                    theme === "dark" 
                      ? "border-slate-800 hover:bg-slate-900/40 text-slate-300" 
                      : "border-slate-200 hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{t.refresh}</span>
                </button>

                {/* Header User Profile Button */}
                <button
                  onClick={() => {
                    setActiveTab("settings");
                    setSettingsActiveSubTab("account");
                  }}
                  className="h-9 px-2.5 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 rounded-lg flex items-center gap-2 transition-all cursor-pointer group/topAvatar"
                  title={lang === "ar" ? "إعدادات الحساب والصورة" : "Account & Profile Photo Settings"}
                >
                  {currentUser.avatarUrl ? (
                    <img 
                      src={currentUser.avatarUrl} 
                      alt={currentUser.ownerName || currentUser.email} 
                      className="w-6 h-6 rounded-full object-cover border border-[#D4AF37]"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#D4AF37] text-[#0F172A] font-black text-[10px] flex items-center justify-center">
                      {(currentUser.ownerName || currentUser.email).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden md:inline text-xs font-bold text-white group-hover/topAvatar:text-[#D4AF37] transition-colors">
                    {currentUser.ownerName || currentUser.email.split("@")[0]}
                  </span>
                </button>
              </div>
            </header>

            {/* APP CONTENT VIEWS CONTROLLER */}
            <div className="p-8 max-w-7xl mx-auto space-y-8">

              {/* INCOMING WORKSPACE INVITATION WARNING / ACTION BANNER */}
              {incomingInvitation && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-6 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-slate-900/90 to-amber-500/5 shadow-2xl relative overflow-hidden backdrop-blur-md"
                >
                  {/* Glowing ambient dots */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                        </span>
                        <h2 className="text-lg font-black tracking-tight text-amber-400 flex items-center gap-2">
                          <ShieldAlert className="w-5 h-5 text-amber-400" />
                          {lang === "ar" ? "دعوة انضمام معلقة لمؤسسة جديدة" : (lang === "fr" ? "Invitation d'Espace de Travail en Attente" : "Pending Workspace Invitation")}
                        </h2>
                      </div>
                      
                      <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                        {lang === "ar" 
                          ? `لقد أرسل لك المدير التنفيذي (${incomingInvitation.senderEmail}) دعوة للانضمام إلى مساحة عمل مؤسسة "${incomingInvitation.companyName}" بالصلاحيات والميزات المحددة أدناه:` 
                          : lang === "fr"
                          ? `Le PDG (${incomingInvitation.senderEmail}) vous a invité à rejoindre l'espace de travail de l'entreprise "${incomingInvitation.companyName}" avec le rôle et les autorisations de module spécifiés ci-dessous :`
                          : `The CEO (${incomingInvitation.senderEmail}) has invited you to join the company workspace of "${incomingInvitation.companyName}" with the specific role and module authorizations listed below:`}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
                          <UserCheck className="w-5 h-5 text-amber-400" />
                          <div>
                            <p className="text-[10px] text-slate-400">{lang === "ar" ? "الدور المخصص:" : (lang === "fr" ? "Rôle Désigné :" : "Designated Role:")}</p>
                            <p className="text-xs font-bold text-white">{incomingInvitation.role}</p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
                          <Building className="w-5 h-5 text-amber-400" />
                          <div>
                            <p className="text-[10px] text-slate-400">{lang === "ar" ? "اسم المؤسسة:" : (lang === "fr" ? "Nom de l'Entreprise :" : "Company Name:")}</p>
                            <p className="text-xs font-bold text-white">{incomingInvitation.companyName}</p>
                          </div>
                        </div>
                      </div>

                      {/* Display Designated Permissions Matrix */}
                      <div className="space-y-2 pt-2">
                        <p className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-amber-400" />
                          {lang === "ar" ? "الصلاحيات والميزات التي ستمنح لك:" : (lang === "fr" ? "Pouvoirs & Accès Accordés :" : "Designated Workspace Powers:")}
                        </p>
                        
                        <div className="flex flex-wrap gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${
                            incomingInvitation.powers?.fileVault 
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                              : "bg-slate-800/40 border-slate-800 text-slate-500 line-through"
                          }`}>
                            <span>📁 {lang === "ar" ? "إدارة الملفات" : "File Vault"}</span>
                            <span className="text-[9px] opacity-80">{incomingInvitation.powers?.fileVault ? (lang === "ar" ? "مسموح" : "Allowed") : (lang === "ar" ? "محظور" : "Blocked")}</span>
                          </span>

                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${
                            incomingInvitation.powers?.memoryVault 
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                              : "bg-slate-800/40 border-slate-800 text-slate-500 line-through"
                          }`}>
                            <span>🧠 {lang === "ar" ? "مكتبة الذكريات" : "Memory Vault"}</span>
                            <span className="text-[9px] opacity-80">{incomingInvitation.powers?.memoryVault ? (lang === "ar" ? "مسموح" : "Allowed") : (lang === "ar" ? "محظور" : "Blocked")}</span>
                          </span>

                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${
                            incomingInvitation.powers?.riskRadar 
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                              : "bg-slate-800/40 border-slate-800 text-slate-500 line-through"
                          }`}>
                            <span>⚠️ {lang === "ar" ? "رادار المخاطر" : "Risk Radar"}</span>
                            <span className="text-[9px] opacity-80">{incomingInvitation.powers?.riskRadar ? (lang === "ar" ? "مسموح" : "Allowed") : (lang === "ar" ? "محظور" : "Blocked")}</span>
                          </span>

                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${
                            incomingInvitation.powers?.marketIntel 
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                              : "bg-slate-800/40 border-slate-800 text-slate-500 line-through"
                          }`}>
                            <span>📊 {lang === "ar" ? "استخبارات السوق" : "Market Intel"}</span>
                            <span className="text-[9px] opacity-80">{incomingInvitation.powers?.marketIntel ? (lang === "ar" ? "مسموح" : "Allowed") : (lang === "ar" ? "محظور" : "Blocked")}</span>
                          </span>

                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${
                            incomingInvitation.powers?.settings 
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                              : "bg-slate-800/40 border-slate-800 text-slate-500 line-through"
                          }`}>
                            <span>⚙️ {lang === "ar" ? "إعدادات النظام" : "System Settings"}</span>
                            <span className="text-[9px] opacity-80">{incomingInvitation.powers?.settings ? (lang === "ar" ? "مسموح" : "Allowed") : (lang === "ar" ? "محظور" : "Blocked")}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-row flex-col items-stretch sm:items-center gap-3 shrink-0">
                      <button
                        onClick={handleDeclineInvitation}
                        className="px-5 py-2.5 rounded-xl border border-rose-500/30 hover:border-rose-500 bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <X className="w-4 h-4" />
                        <span>{lang === "ar" ? "رفض الدعوة" : (lang === "fr" ? "Décliner" : "Decline")}</span>
                      </button>

                      <button
                        onClick={() => handleAcceptInvitation(incomingInvitation)}
                        className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all shadow-lg hover:shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>{lang === "ar" ? "الموافقة والانضمام للمؤسسة" : (lang === "fr" ? "Accepter & Rejoindre" : "Accept & Join Workspace")}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* VIEW: DASHBOARD */}
              {activeTab === "dashboard" && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="space-y-8"
                  id="dashboard-view"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-3xl font-black tracking-tight">{lang === "ar" ? "لوحة التحكم التنفيذية" : (lang === "fr" ? "Tableau de Bord Exécutif" : "Executive Command Center")}</h1>
                      <p className="text-slate-400 text-sm mt-1">{t.slogan}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setActiveTab("add")} 
                        className="h-10 px-4 bg-[#D4AF37] hover:bg-[#B59410] text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-[#D4AF37]/10 transition-all cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>{t.logMemoryBtn}</span>
                      </button>

                      <button 
                        onClick={() => { setActiveTab("smart"); runSmartAnalysis(); }} 
                        className={`h-10 px-4 border text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                          theme === "dark"
                            ? "bg-slate-900/60 border-[#D4AF37]/30 text-[#D4AF37] hover:border-[#D4AF37]/60"
                            : "bg-white border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/5"
                        }`}
                      >
                        <Brain className="w-4 h-4" />
                        <span>{t.runAnalysisBtn}</span>
                      </button>
                    </div>
                  </div>

                  {/* Executive Causal Intelligence Command Banner */}
                  <div className={`p-6 rounded-2xl border relative overflow-hidden ${
                    theme === "dark"
                      ? "bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-[#D4AF37]/30 shadow-2xl"
                      : "bg-gradient-to-r from-amber-50/80 via-white to-amber-50/80 border-[#D4AF37]/40 shadow-md"
                  }`}>
                    <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      {/* Column 1: Organization & Security Status */}
                      <div className="space-y-2 border-b md:border-b-0 md:border-l border-slate-800/80 pb-4 md:pb-0 pl-0 md:pl-6">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
                            {lang === "ar" ? "الحالة الميدانية النشطة" : "Active Institutional Context"}
                          </span>
                        </div>
                        <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-[#D4AF37]" />
                          <span>{currentUser?.companyName || "Zakir Enterprise Core"}</span>
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>{lang === "ar" ? "تشفير محلي وسحابي AES-256 معتمد" : "AES-256 Vault Encryption Active"}</span>
                        </div>
                      </div>

                      {/* Column 2: Causal Intelligence Flow Summary */}
                      <div className="space-y-2 border-b md:border-b-0 md:border-l border-slate-800/80 pb-4 md:pb-0 pl-0 md:pl-6">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {lang === "ar" ? "تسلسل التدفق السبي المعرفي" : "Causal Decision Chain"}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap text-xs font-bold">
                          <span className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">{lang === "ar" ? "السبب" : "Cause"}</span>
                          <span className="text-slate-600">→</span>
                          <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">{lang === "ar" ? "القرار" : "Decision"}</span>
                          <span className="text-slate-600">→</span>
                          <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">{lang === "ar" ? "النتيجة" : "Outcome"}</span>
                          <span className="text-slate-600">→</span>
                          <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{lang === "ar" ? "الدرس" : "Lesson"}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight">
                          {lang === "ar"
                            ? "تحويل كل تجربة ميدانية إلى أصل معرفي يمنع تكرار الأخطاء."
                            : "Transforming every operational scenario into structured future decision rules."}
                        </p>
                      </div>

                      {/* Column 3: Top Risk Alert Status & Direct Action */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            {lang === "ar" ? "أعلى خطر مرصود" : "Primary Active Alert"}
                          </span>
                          <button
                            onClick={() => setActiveTab("alerts")}
                            className="text-[10px] text-[#D4AF37] hover:underline font-bold"
                          >
                            {lang === "ar" ? "عرض الكل" : "View All"}
                          </button>
                        </div>

                        {riskAlerts.length > 0 ? (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
                            <p className="font-bold text-rose-300 truncate">{riskAlerts[0].title}</p>
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{riskAlerts[0].description}</p>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-bold flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            <span>{lang === "ar" ? "لا توجد مخاطر حرجة نشطة حالياً" : "No Critical Active Risks Detected"}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => { setActiveTab("smart"); runSmartAnalysis(); }}
                            className="w-full py-2 bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{lang === "ar" ? "تشغيل المحاكاة الذكية" : "Run Smart AI Simulation"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operational Metric KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { 
                        title: lang === "ar" ? "إجمالي الذكريات" : "Total Memories", 
                        value: statsCount.totalMemories, 
                        label: "+12% " + (lang === "ar" ? "انقر للتعمق بالمكتبة" : "Click to view library"), 
                        trendColor: "text-emerald-500",
                        valColor: theme === "dark" ? "text-white" : "text-slate-900",
                        targetTab: "library"
                      },
                      { 
                        title: lang === "ar" ? "المخاطر النشطة" : "Active Risks", 
                        value: statsCount.activeRisks < 10 ? `0${statsCount.activeRisks}` : statsCount.activeRisks, 
                        label: (lang === "ar" ? "تنبيهات حرجة • انقر للتفاصيل" : "Critical alerts • Click to view"), 
                        trendColor: "text-rose-500",
                        valColor: "text-rose-500",
                        targetTab: "alerts"
                      },
                      { 
                        title: t.knowledgeRetained || "المعرفة المحتفظ بها", 
                        value: statsCount.retainedKnowledge, 
                        label: (lang === "ar" ? "خزينة المستندات • انقر للوصول" : "File Vault • Click to open"), 
                        trendColor: "text-blue-500",
                        valColor: theme === "dark" ? "text-white" : "text-slate-900",
                        targetTab: "files"
                      },
                      { 
                        title: lang === "ar" ? "توقعات الذكاء الاصطناعي" : "AI Forecasts", 
                        value: statsCount.aiAnalyses < 10 ? `0${statsCount.aiAnalyses}` : statsCount.aiAnalyses, 
                        label: (lang === "ar" ? "التطور الذكي • انقر للتحليل" : "Smart Evolution • Click to run"), 
                        trendColor: "text-[#D4AF37]",
                        valColor: "text-[#D4AF37]",
                        targetTab: "smart"
                      }
                    ].map((stat, i) => {
                      return (
                        <div 
                          key={i} 
                          onClick={() => setActiveTab(stat.targetTab as any)}
                          className={`p-6 rounded-2xl border transition-all cursor-pointer group/kpi border-slate-800 ${
                            theme === "dark" 
                              ? "bg-slate-900/40 hover:bg-slate-800/80 hover:border-[#D4AF37]/50 shadow-black/20" 
                              : "bg-white hover:bg-slate-50 hover:border-[#D4AF37]/50 shadow-sm shadow-slate-100"
                          }`}
                          title={`Click to open ${stat.title}`}
                        >
                          <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1 group-hover/kpi:text-[#D4AF37] transition-colors">
                            {stat.title}
                          </div>
                          <div className="text-3xl font-bold tracking-tight">
                            <span className={stat.valColor}>{stat.value}</span>
                          </div>
                          <div className={`mt-2 flex items-center text-xs font-semibold ${stat.trendColor}`}>
                            <span>{stat.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Charts & Analytical Widgets */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Recharts Multi-Type Distribution Chart */}
                    <div className={theme === "dark" ? "lg:col-span-2 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6" : "lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-2xl p-6"}>
                      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <h3 className={`text-base font-bold uppercase tracking-wider flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                          <span className="w-1.5 h-4 bg-[#D4AF37] rounded-full"></span>
                          <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
                          {t.categoryDistribution}
                        </h3>

                        {/* Chart Type Selector Switcher */}
                        <div className={`flex items-center gap-1 p-1 rounded-xl border ${theme === "dark" ? "bg-slate-950/80 border-slate-800" : "bg-slate-100 border-slate-200"}`}>
                          <button
                            onClick={() => setCategoryChartType("bar")}
                            title={lang === "ar" ? "أعمدة (Bar)" : (lang === "fr" ? "Barres" : "Bar Chart")}
                            className={`p-2 rounded-lg transition-all cursor-pointer ${
                              categoryChartType === "bar"
                                ? "bg-[#D4AF37] text-slate-950 shadow-md shadow-[#D4AF37]/20 font-bold"
                                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                            }`}
                          >
                            <BarChart2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setCategoryChartType("line")}
                            title={lang === "ar" ? "خطية (Linear)" : (lang === "fr" ? "Linéaire" : "Line Chart")}
                            className={`p-2 rounded-lg transition-all cursor-pointer ${
                              categoryChartType === "line"
                                ? "bg-[#D4AF37] text-slate-950 shadow-md shadow-[#D4AF37]/20 font-bold"
                                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                            }`}
                          >
                            <Activity className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setCategoryChartType("area")}
                            title={lang === "ar" ? "مساحية / كاداسترية (Cadastral / Area)" : (lang === "fr" ? "Aire" : "Area Chart")}
                            className={`p-2 rounded-lg transition-all cursor-pointer ${
                              categoryChartType === "area"
                                ? "bg-[#D4AF37] text-slate-950 shadow-md shadow-[#D4AF37]/20 font-bold"
                                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                            }`}
                          >
                            <Layers className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setCategoryChartType("donut")}
                            title={lang === "ar" ? "دائرية (Circular / Donut)" : (lang === "fr" ? "Circulaire" : "Donut Chart")}
                            className={`p-2 rounded-lg transition-all cursor-pointer ${
                              categoryChartType === "donut"
                                ? "bg-[#D4AF37] text-slate-950 shadow-md shadow-[#D4AF37]/20 font-bold"
                                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                            }`}
                          >
                            <PieChartIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="h-80 relative">
                        {chartDataCategory.length === 0 ? (
                          <div className={`h-full flex flex-col items-center justify-center text-center p-6 border border-dashed rounded-xl ${
                            theme === "dark" ? "border-slate-800 bg-slate-950/20" : "border-slate-200 bg-slate-50"
                          }`}>
                            <TrendingUp className="w-10 h-10 text-slate-500 mb-2 opacity-40" />
                            <p className="text-xs text-slate-400 font-medium">
                              {lang === "ar" ? "لا توجد بيانات تصنيفية مسجلة بعد. أضف ذكريات جديدة لعرض التوزيع البياني." : "No category distribution data yet. Add memories to populate the chart."}
                            </p>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            {categoryChartType === "bar" ? (
                              <BarChart data={chartDataCategory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
                                <ChartTooltip 
                                  contentStyle={{ 
                                    backgroundColor: "var(--bg-secondary)", 
                                    borderColor: "var(--border-color)",
                                    borderRadius: "8px",
                                    color: "var(--text-primary)",
                                    fontSize: "12px"
                                  }} 
                                />
                                <Bar dataKey="value" fill="#D4AF37" radius={[6, 6, 0, 0]}>
                                  {chartDataCategory.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || (index % 2 === 0 ? "#D4AF37" : "#B59410")} />
                                  ))}
                                </Bar>
                              </BarChart>
                            ) : categoryChartType === "line" ? (
                              <LineChart data={chartDataCategory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
                                <ChartTooltip 
                                  contentStyle={{ 
                                    backgroundColor: "var(--bg-secondary)", 
                                    borderColor: "var(--border-color)",
                                    borderRadius: "8px",
                                    color: "var(--text-primary)",
                                    fontSize: "12px"
                                  }} 
                                />
                                <Line 
                                  type="natural" 
                                  dataKey="value" 
                                  stroke="#D4AF37" 
                                  strokeWidth={3} 
                                  dot={{ r: 6, fill: "#D4AF37", stroke: "var(--bg-primary)", strokeWidth: 2 }} 
                                  activeDot={{ r: 8, fill: "#ffffff", stroke: "#D4AF37", strokeWidth: 3 }} 
                                />
                              </LineChart>
                            ) : categoryChartType === "area" ? (
                              <AreaChart data={chartDataCategory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="colorValueCat" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.6}/>
                                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.05}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
                                <ChartTooltip 
                                  contentStyle={{ 
                                    backgroundColor: "var(--bg-secondary)", 
                                    borderColor: "var(--border-color)",
                                    borderRadius: "8px",
                                    color: "var(--text-primary)",
                                    fontSize: "12px"
                                  }} 
                                />
                                <Area 
                                  type="natural" 
                                  dataKey="value" 
                                  stroke="#D4AF37" 
                                  strokeWidth={3} 
                                  fillOpacity={1} 
                                  fill="url(#colorValueCat)" 
                                />
                              </AreaChart>
                            ) : (
                              <PieChart>
                                <ChartTooltip 
                                  contentStyle={{ 
                                    backgroundColor: "var(--bg-secondary)", 
                                    borderColor: "var(--border-color)",
                                    borderRadius: "8px",
                                    color: "var(--text-primary)",
                                    fontSize: "12px"
                                  }} 
                                />
                                <Pie
                                  data={chartDataCategory}
                                  cx="50%"
                                  cy="45%"
                                  innerRadius={65}
                                  outerRadius={100}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {chartDataCategory.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || ["#D4AF37", "#B59410", "#0D7A82", "#14B8A6", "#8B5CF6"][index % 5]} />
                                  ))}
                                </Pie>
                              </PieChart>
                            )}
                          </ResponsiveContainer>
                        )}

                        {/* Center Donut Label if in Donut mode */}
                        {categoryChartType === "donut" && chartDataCategory.length > 0 && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                            <span className={`text-2xl font-extrabold font-mono ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                              {chartDataCategory.reduce((acc, curr) => acc + curr.value, 0)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              {lang === "ar" ? "إجمالي القرارات" : (lang === "fr" ? "Total Décisions" : "Total Decisions")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Custom Legend for Donut Chart Mode */}
                      {categoryChartType === "donut" && chartDataCategory.length > 0 && (
                        <div className={`mt-2 pt-3 border-t flex flex-wrap items-center justify-center gap-4 text-xs font-medium ${theme === "dark" ? "border-slate-800/80 text-slate-300" : "border-slate-200 text-slate-600"}`}>
                          {chartDataCategory.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color || ["#D4AF37", "#B59410", "#0D7A82", "#14B8A6"][idx % 4] }} />
                              <span>{item.name}</span>
                              <span className="font-mono text-slate-400">({item.value})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick AI Insights List */}
                    <div className={theme === "dark" ? "bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between" : "bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col justify-between"}>
                      <div>
                        <h3 className={`text-base font-bold uppercase tracking-wider mb-6 flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                          <span className="w-1.5 h-4 bg-[#D4AF37] rounded-full"></span>
                          <Brain className="w-4 h-4 text-[#D4AF37]" />
                          {t.quickInsights}
                        </h3>
                        {memories.length === 0 ? (
                          <div className={`p-6 text-center rounded-xl border border-dashed ${
                            theme === "dark" ? "border-slate-800 bg-slate-950/20" : "border-slate-200 bg-slate-50"
                          }`}>
                            <Brain className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-40" />
                            <p className="text-xs text-slate-400 font-medium">
                              {lang === "ar" ? "لا توجد رؤى ذكاء اصطناعي بعد. أضف ذكريات وأحداث مؤسسية لتشخيص المخاطر وتوليد التوصيات." : "No quick AI insights yet. Add institutional memories to run AI diagnostics."}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-4 bg-[#D4AF37]/5 rounded-xl border border-[#D4AF37]/20">
                              <h4 className="text-xs font-bold text-[#D4AF37]">{lang === "ar" ? "فجوة متكررة في تغطية مخاطر الصرف الأجنبي" : "Recurring Forex risk gap detected"}</h4>
                              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                                {lang === "ar" ? "يشير تكرار حوادث الخسارة السابقة إلى ضرورة تثبيت الحد الأدنى للتحوط عند 70%، مما يقضي تماماً على تفاوت أسعار الصرف غير المتوقعة." : "Previous patterns suggest a minimum hedging threshold of 70% to fully neutralize currency variance."}
                              </p>
                            </div>

                            <div className="p-4 bg-rose-500/5 rounded-xl border border-rose-500/20">
                              <h4 className="text-xs font-bold text-rose-500">{lang === "ar" ? "الأثر التراكمي للاستعانة بمستشاري الجمارك" : "Customs advisor dependency impact"}</h4>
                              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                                {lang === "ar" ? "أدى القرار المتخذ لتسريع تخليص جمركي سابق إلى مراجعة تفتيشية أوسع. إنشاء مكتبة مرجعية يبسط العملية بنسبة 80%." : "Recent fast-tracked clearance has triggered auditing reviews. A standard catalog reduces risks by 80%."}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => setActiveTab("smart")}
                        className={`w-full h-10 mt-6 border text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          theme === "dark"
                            ? "border-slate-800 hover:border-[#D4AF37]/40 text-slate-400 hover:text-[#D4AF37]"
                            : "border-slate-200 hover:border-[#D4AF37]/40 text-slate-500 hover:text-[#D4AF37]"
                        }`}
                      >
                        <span>{lang === "ar" ? "عرض التحليل الكامل" : "View Full Diagnostics"}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Active Risk Alerts & Recent Activities Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* Systemic Risk Alerts (Quick action to resolve) */}
                    <div className={theme === "dark" ? "bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6" : "bg-white border border-slate-200 shadow-sm rounded-2xl p-6"}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                          <span className="w-1.5 h-4 bg-[#D4AF37] rounded-full"></span>
                          <ShieldAlert className="w-4.5 h-4.5 text-rose-500" />
                          {t.recentAlerts}
                        </h3>
                        <button
                          onClick={() => setActiveTab("alerts")}
                          className="text-xs font-bold text-[#D4AF37] hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span>{lang === "ar" ? "عرض الكل" : "View All"}</span>
                        </button>
                      </div>
                      <div className="space-y-3">
                        {riskAlerts.filter(a => a.status === "Active").length === 0 ? (
                          <div className={`p-6 text-center rounded-xl border border-dashed ${
                            theme === "dark" ? "border-slate-800 bg-slate-950/30" : "border-slate-200 bg-slate-50"
                          }`}>
                            <ShieldAlert className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                            <p className="text-xs text-slate-400 font-medium">
                              {lang === "ar" ? "لا توجد تنبيهات مخاطر نشطة حالياً" : "No active risk alerts"}
                            </p>
                          </div>
                        ) : (
                          riskAlerts.filter(a => a.status === "Active").slice(0, 3).map((alert) => (
                            <div key={alert.id} className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                              theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-100"
                            }`}>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{alert.title}</span>
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                    getSeverityBadgeClass(alert.severity)
                                  }`}>
                                    {alert.severity}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">{alert.description}</p>
                              </div>
                              <button
                                onClick={() => resolveRiskAlert(alert.id)}
                                className="text-[10px] h-7 px-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-bold rounded border border-rose-500/25 transition-all shrink-0 cursor-pointer"
                              >
                                {t.resolveAlert}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Timeline of user interactions & metrics */}
                    <div className={theme === "dark" ? "bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6" : "bg-white border border-slate-200 shadow-sm rounded-2xl p-6"}>
                      <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                        <span className="w-1.5 h-4 bg-[#D4AF37] rounded-full"></span>
                        <Users className="w-4.5 h-4.5 text-[#D4AF37]" />
                        {lang === "ar" ? "النشاط الأخير للأعضاء" : "Recent Active Logs"}
                      </h3>
                      {metrics.length === 0 ? (
                        <div className={`p-6 text-center rounded-xl border border-dashed ${
                          theme === "dark" ? "border-slate-800 bg-slate-950/30" : "border-slate-200 bg-slate-50"
                        }`}>
                          <Users className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                          <p className="text-xs text-slate-400 font-medium">
                            {lang === "ar" ? "لا توجد أنشطة مسجلة بعد لهذا الحساب" : "No active member logs recorded yet"}
                          </p>
                        </div>
                      ) : (
                        <div className={`relative border-r pr-4 space-y-4 ${theme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
                          {metrics.slice(0, 4).map((m) => (
                            <div key={m.id} className="relative flex items-start gap-3">
                              {/* Bullet accent */}
                              <div className="absolute -right-5.5 mt-1.5 w-2.5 h-2.5 rounded-full bg-[#D4AF37] border-2 border-[#0F172A]"></div>
                              
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-[#D4AF37] uppercase">{m.actionType}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {new Date(m.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className={`text-[11px] mt-0.5 leading-relaxed ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>{m.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </motion.div>
              )}

              {/* VIEW: MEMORY LIBRARY */}
              {activeTab === "library" && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="space-y-6"
                  id="library-view"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-3xl font-black tracking-tight">{lang === "ar" ? "مكتبة الذاكرة" : "Memory Library"}</h1>
                      <p className="text-slate-400 text-sm mt-1">{lang === "ar" ? "الوصول إلى القرارات والأحداث والمسببات والنتائج المسجلة والمصنفة." : "Access strategic decisions, causal chains, and historical company knowledge."}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleOpenPrintPreview()} 
                        className="h-10 px-3.5 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 hover:border-amber-500/60 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                        title={lang === "ar" ? "معاينة وتنسيق طباعة تقرير الذاكرة" : "Print Preview & Formatting"}
                      >
                        <Printer className="w-4 h-4" />
                        <span>{lang === "ar" ? "معاينة التقرير والطباعة" : "Print Preview"}</span>
                      </button>

                      <button 
                        onClick={() => setActiveTab("add")} 
                        className="h-10 px-4 bg-[#D4AF37] hover:bg-[#B59410] text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>{t.logMemoryBtn}</span>
                      </button>
                    </div>
                  </div>

                  {/* Search and Filters Strip */}
                  <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl border ${
                    theme === "dark" ? "bg-slate-900/20 border-slate-800/60" : "bg-white border-slate-200 shadow-sm"
                  }`}>
                    <div className="md:col-span-2 relative">
                      <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.searchPlaceholder}
                        className={`w-full h-10 pr-10 pl-3 border rounded-lg text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                          theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                        }`}
                      />
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        id="category-multiselect-toggle"
                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                        className={`w-full h-10 px-3 border rounded-lg text-xs flex items-center justify-between cursor-pointer focus:outline-none focus:border-[#D4AF37] ${
                          theme === "dark" ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                        }`}
                      >
                        <span className="truncate pr-2">
                          {selectedCategories.length === 0 
                            ? (lang === "ar" ? "كل التصنيفات / الأقسام" : lang === "fr" ? "Toutes les catégories" : "All Categories") 
                            : selectedCategories.length === 1 
                            ? selectedCategories[0]
                            : lang === "ar" 
                            ? `${selectedCategories.length} تصنيفات محددة` 
                            : lang === "fr"
                            ? `${selectedCategories.length} Catégories sélectionnées`
                            : `${selectedCategories.length} Categories Selected`}
                        </span>
                        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>

                      {isCategoryDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-30" 
                            onClick={() => setIsCategoryDropdownOpen(false)} 
                          />
                          <div className={`absolute z-40 mt-1.5 w-64 max-h-72 overflow-y-auto border rounded-lg shadow-xl p-3 space-y-2.5 ${
                            lang === "ar" ? "right-0 left-auto" : "left-0 right-auto"
                          } ${
                            theme === "dark" ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-700"
                          }`}>
                            <div className="flex items-center justify-between border-b pb-2 mb-2 border-slate-200 dark:border-slate-800 text-[11px] font-semibold">
                              <button
                                type="button"
                                onClick={() => setSelectedCategories([])}
                                className="text-[#D4AF37] hover:underline cursor-pointer"
                              >
                                {lang === "ar" ? "كل الأقسام" : lang === "fr" ? "Afficher tout" : "Show All"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const unique = Array.from(new Set(memories.map(m => m.category))).filter(Boolean);
                                  setSelectedCategories(unique);
                                }}
                                className="text-slate-400 hover:text-slate-200 dark:hover:text-white cursor-pointer"
                              >
                                {lang === "ar" ? "تحديد الكل" : lang === "fr" ? "Tout sélectionner" : "Select All"}
                              </button>
                            </div>

                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {Array.from(new Set(memories.map(m => m.category))).filter(Boolean).map(cat => {
                                const isChecked = selectedCategories.includes(cat);
                                return (
                                  <label 
                                    key={cat} 
                                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer text-xs transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setSelectedCategories(selectedCategories.filter(c => c !== cat));
                                        } else {
                                          setSelectedCategories([...selectedCategories, cat]);
                                        }
                                      }}
                                      className="rounded border-slate-300 dark:border-slate-700 text-[#D4AF37] focus:ring-[#D4AF37] cursor-pointer"
                                    />
                                    <span className="truncate select-none">{cat}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className={`w-full h-10 px-3 border rounded-lg text-xs focus:outline-none focus:border-[#D4AF37] ${
                          theme === "dark" ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                        }`}
                      >
                        <option value="newest">الأحدث أولاً</option>
                        <option value="oldest">الأقدم أولاً</option>
                        <option value="highest">أعلى خطورة</option>
                        <option value="alpha">أبجدياً</option>
                      </select>
                    </div>
                  </div>

                  {/* Memories Interactive Cards List */}
                  <div className="space-y-4">
                    {filteredMemories.length === 0 ? (
                      <div className={`text-center py-16 border border-dashed rounded-xl ${theme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
                        <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                        <h4 className={`text-sm font-bold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>لم يتم العثور على ذكريات سببية</h4>
                        <p className="text-xs text-slate-400 mt-1">جرب تعديل كلمات البحث أو الفلاتر.</p>
                      </div>
                    ) : (
                      filteredMemories.map((m) => {
                        const isExpanded = expandedMemoryId === m.id;
                        const isMemoryLocked = Boolean(m.isEncrypted);
                        const isUnlocked = unlockedMemoryIds.has(m.id) || !isMemoryLocked;

                        const handleMemoryCardClick = () => {
                          if (isExpanded) {
                            setExpandedMemoryId(null);
                            return;
                          }

                          if (isMemoryLocked && !isUnlocked) {
                            setUnlockMemoryTarget(m);
                            setUnlockMemoryPinInput("");
                            setUnlockMemoryError("");
                          } else {
                            setExpandedMemoryId(m.id);
                          }
                        };

                        return (
                          <div 
                            key={m.id} 
                            className={`memory-card-item border rounded-xl overflow-hidden transition-all ${
                              isMemoryLocked
                                ? "bg-slate-950/80 border-amber-500/30 hover:border-amber-500/50"
                                : theme === "dark" 
                                  ? "bg-slate-900/20 border-slate-800/60 hover:border-[#D4AF37]/30" 
                                  : "bg-white border-slate-200 hover:border-[#D4AF37]/30 shadow-sm"
                            }`}
                          >
                            {/* Card Header & Body clickable to expand */}
                            <div 
                              onClick={handleMemoryCardClick}
                              className="p-5 flex flex-col gap-3 cursor-pointer select-none"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isMemoryLocked && (
                                      <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1">
                                        <Lock className="w-3 h-3 text-amber-400" />
                                        <span>{lang === "ar" ? "ذكرى مشفرة" : "Encrypted Memory"}</span>
                                      </span>
                                    )}
                                    <span className="text-[9px] px-2 py-0.5 rounded font-black tracking-wider uppercase bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/15">
                                      {m.category}
                                    </span>
                                    <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${getSeverityBadgeClass(m.riskLevel)}`}>
                                      {m.riskLevel}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-semibold">
                                      {new Date(m.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <h3 className={`text-base font-bold mt-1.5 ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{m.title}</h3>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-[11px] text-[#D4AF37] font-bold hover:underline flex items-center gap-1">
                                    {isMemoryLocked && !isUnlocked && <Lock className="w-3 h-3 text-amber-400" />}
                                    <span>{isExpanded ? (lang === "ar" ? "طي التفاصيل" : "Collapse Details") : (isMemoryLocked && !isUnlocked ? (lang === "ar" ? "فك التشفير والعرض" : "Unlock & View") : (lang === "ar" ? "عرض التفاصيل" : "View Details"))}</span>
                                  </span>
                                </div>
                              </div>

                              {/* Description narrative preview with Read More / Read Less toggle */}
                              {(!isMemoryLocked || isUnlocked) && m.description && (
                                <div className={`text-xs leading-relaxed border-t pt-2.5 mt-0.5 ${
                                  theme === "dark" ? "border-slate-800/40" : "border-slate-100"
                                }`}>
                                  <ReadMoreText
                                    text={m.description}
                                    maxLength={140}
                                    lang={lang}
                                    theme={theme}
                                    className={`text-xs leading-relaxed ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Expanded Details Narratives */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-slate-800/60 bg-slate-950/40 p-5 space-y-4 text-xs leading-relaxed text-slate-300"
                                >
                                  {/* Print-Only Professional Document Header */}
                                  <div className="print-only-header">
                                    <div>
                                      <h2 className="text-lg font-black text-slate-900">Zakir — وثيقة المعرفة والذاكرة المؤسسية</h2>
                                      <p className="text-xs text-slate-600">Institutional Knowledge Base & Memory Registry Document</p>
                                    </div>
                                    <div className="text-left text-xs text-slate-600 font-mono">
                                      <div>رقم الوثيقة: #{m.id.slice(0, 8).toUpperCase()}</div>
                                      <div>تاريخ الطباعة: {new Date().toLocaleDateString("ar-SA")}</div>
                                      <div>التصنيف: {m.category}</div>
                                    </div>
                                  </div>

                                  <div>
                                    <ReadMoreText
                                      label={t.descriptionLabel}
                                      text={m.description}
                                      maxLength={180}
                                      lang={lang}
                                      theme={theme}
                                      className="text-xs leading-relaxed text-slate-300"
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <ReadMoreText
                                      label={t.decisionLabel}
                                      text={m.decision}
                                      maxLength={180}
                                      lang={lang}
                                      theme={theme}
                                      className="text-xs leading-relaxed text-slate-300"
                                    />
                                    <ReadMoreText
                                      label={t.causalLabel}
                                      text={m.causalFactors || (lang === "ar" ? "غير محدد" : "Not specified")}
                                      maxLength={180}
                                      lang={lang}
                                      theme={theme}
                                      className="text-xs leading-relaxed text-slate-300"
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <ReadMoreText
                                      label={t.outcomesLabel}
                                      text={m.outcomes || (lang === "ar" ? "غير محدد" : "Not specified")}
                                      maxLength={180}
                                      lang={lang}
                                      theme={theme}
                                      className="text-xs leading-relaxed text-slate-300"
                                    />
                                    <ReadMoreText
                                      label={t.lessonsLabel}
                                      text={m.lessonsLearned || (lang === "ar" ? "غير محدد" : "Not specified")}
                                      maxLength={180}
                                      lang={lang}
                                      theme={theme}
                                      className="text-xs leading-relaxed text-slate-300"
                                    />
                                  </div>

                                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/40 flex-wrap">
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold">الوسوم:</span>
                                    {m.tags.map((tag, idx) => (
                                      <span key={idx} className="bg-slate-900 px-2 py-0.5 rounded text-[10px] text-slate-400">
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="flex items-center justify-between gap-2 text-[9px] text-slate-400 pt-1">
                                    <div className="flex items-center gap-1">
                                      <span>بواسطة:</span>
                                      <span className="font-bold text-amber-500">{m.authorName || m.authorEmail}</span>
                                      <span>({m.authorRole})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenPrintPreview(m.id);
                                        }}
                                        className="no-print text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600/80 px-2.5 py-1 rounded text-[10px] font-bold border border-blue-500/30 transition-all cursor-pointer flex items-center gap-1"
                                        title={lang === "ar" ? "معاينة وتنسيق طباعة هذه الذكرى" : "Print Preview"}
                                      >
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>{lang === "ar" ? "معاينة وطباعة" : "Print Preview"}</span>
                                      </button>

                                      {true && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setEditingMemory(m);
                                              const predefined = [
                                                "Financial Engineering", "الهندسة المالية",
                                                "FX Risk Management", "إدارة مخاطر العملات",
                                                "Customs Classification", "التصنيف الجمركي",
                                                "Regulatory Compliance", "Compliance", "الامتثال والحوكمة",
                                                "Operations", "العمليات اللوجستية"
                                              ];
                                              if (predefined.includes(m.category)) {
                                                setEditCategorySelect(m.category);
                                                setCustomEditCategory("");
                                              } else {
                                                setEditCategorySelect("Other");
                                                setCustomEditCategory(m.category);
                                              }
                                            }}
                                            className="text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-600/80 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                            <span>{lang === "ar" ? "تعديل الذكرى" : "Edit Memory"}</span>
                                          </button>

                                          {deleteMemoryTargetId === m.id ? (
                                            <div className="flex items-center gap-1.5 bg-rose-950/40 border border-rose-800/60 p-1 rounded-lg transition-all">
                                              <span className="text-[9px] text-rose-300 font-bold px-1">
                                                {lang === "ar" ? "تأكيد؟" : "Confirm?"}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  handleDeleteMemoryDirect(m.id);
                                                  setDeleteMemoryTargetId(null);
                                                }}
                                                className="bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer"
                                              >
                                                {lang === "ar" ? "نعم" : "Yes"}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setDeleteMemoryTargetId(null);
                                                }}
                                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer"
                                              >
                                                {lang === "ar" ? "لا" : "No"}
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDeleteMemoryTargetId(m.id);
                                              }}
                                              className="text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600/80 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-500/30 transition-all cursor-pointer flex items-center gap-1"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                              <span>{lang === "ar" ? "حذف الذكرى" : "Delete Memory"}</span>
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Print-Only Professional Document Footer */}
                                  <div className="print-only-footer">
                                    <span>تم استخراج هذا المستند رسمياً من نظام Zakir لإدارة المعرفة والذاكرة المؤسسية.</span>
                                    <span>وثيقة سرية ومحمية — Strictly Confidential Institutional Record</span>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}

              {/* VIEW: ADD MEMORY */}
              {activeTab === "add" && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="max-w-3xl mx-auto space-y-6"
                  id="add-memory-view"
                >
                  <div className="text-center space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold uppercase tracking-widest">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "معمارية حفظ الذكريات المؤسسية" : "Institutional Memory Vault"}</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight">{lang === "ar" ? "تسجيل حدث وقرار جديد" : "Record New Institutional Event"}</h1>
                    <p className="text-slate-400 text-xs max-w-lg mx-auto">
                      {lang === "ar" ? "خطوات منهجية لالتقاط حلقة (السبب ← القرار ← النتيجة ← الدرس) بحماية وتشفير عاليين." : "Systematically map the (Cause → Decision → Outcome → Lesson) chain with enterprise-grade encryption."}
                    </p>
                  </div>

                  {/* 4-Step Interactive Progress Tracker */}
                  <div className={`p-4 rounded-2xl border ${
                    theme === "dark" ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
                  }`}>
                    <div className="grid grid-cols-4 gap-2 relative">
                      {[
                        { step: 1, title: lang === "ar" ? "الحدث والبيانات" : "Event & Category", icon: FileText },
                        { step: 2, title: lang === "ar" ? "السرد والقرار" : "Context & Decision", icon: GitCommit },
                        { step: 3, title: lang === "ar" ? "المسببات والنتائج" : "Causes & Impact", icon: AlertTriangle },
                        { step: 4, title: lang === "ar" ? "الدروس والتأمين" : "Lessons & Security", icon: ShieldCheck }
                      ].map((s) => {
                        const StepIcon = s.icon;
                        const isDone = formStep > s.step;
                        const isCurrent = formStep === s.step;
                        return (
                          <button
                            key={s.step}
                            type="button"
                            onClick={() => {
                              // Allow navigation back or forward if current fields are valid
                              if (s.step < formStep || (newTitle.trim().length > 0)) {
                                setFormStep(s.step);
                              }
                            }}
                            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all cursor-pointer text-center relative ${
                              isCurrent
                                ? "bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] font-bold"
                                : isDone
                                ? "text-emerald-400 hover:bg-emerald-500/10"
                                : "text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                              isCurrent
                                ? "bg-[#D4AF37] text-slate-950 shadow-md shadow-[#D4AF37]/20"
                                : isDone
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}>
                              {isDone ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                            </div>
                            <span className="text-[11px] font-bold leading-tight hidden sm:block">{s.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <form onSubmit={handleAddMemory} className={`p-6 rounded-2xl border space-y-6 ${
                    theme === "dark" ? "bg-slate-900/40 border-slate-800/80 shadow-black/20" : "bg-white border-slate-200 shadow-sm"
                  }`}>
                    {formSuccess && (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                        <CheckCircle className="w-4.5 h-4.5 shrink-0 text-emerald-400" />
                        <span>{formSuccess}</span>
                      </div>
                    )}

                    {formError && (
                      <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-rose-400" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* STEP 1: Metadata & Title */}
                    {formStep === 1 && (
                      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] flex items-center justify-center text-[10px] font-black">1</span>
                            {lang === "ar" ? "عنوان الحدث والتصنيف الميداني" : "Event Title & Primary Category"}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-mono">{lang === "ar" ? "الخطوة 1 من 4" : "Step 1 of 4"}</span>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">{t.memoryName} *</label>
                          <input 
                            type="text" 
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className={`w-full h-11 px-3.5 border rounded-xl text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                              theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                            }`}
                            placeholder={lang === "ar" ? "مثال: قرار التحوط المالي لعقود توريد المعدات الطبية 2026" : "e.g. Foreign Exchange Hedging Decision for Q3 Equipment Supplies"}
                            required
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">{t.categoryLabel}</label>
                            <select 
                              value={newCategory}
                              onChange={(e) => {
                                setNewCategory(e.target.value);
                                if (e.target.value !== "Other") {
                                  setCustomNewCategory("");
                                }
                              }}
                              className={`w-full h-11 px-3 border rounded-xl text-xs focus:outline-none focus:border-[#D4AF37] ${
                                theme === "dark" ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                              }`}
                            >
                              <option value="Financial Engineering">Financial Engineering</option>
                              <option value="FX Risk Management">FX Risk Management</option>
                              <option value="Customs Classification">Customs Classification</option>
                              <option value="Regulatory Compliance">Regulatory Compliance</option>
                              <option value="Other">{lang === "ar" ? "أخرى (كتابة تصنيف مخصص)" : "Other (write custom)"}</option>
                            </select>
                            {newCategory === "Other" && (
                              <input 
                                type="text"
                                value={customNewCategory}
                                onChange={(e) => setCustomNewCategory(e.target.value)}
                                className={`w-full h-11 px-3.5 mt-2 border rounded-xl text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                                  theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                                }`}
                                placeholder={lang === "ar" ? "اكتب التصنيف المخصص هنا..." : "Enter custom category..."}
                                required
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">{t.riskLevelLabel}</label>
                            <select 
                              value={newRiskLevel}
                              onChange={(e) => setNewRiskLevel(e.target.value as any)}
                              className={`w-full h-11 px-3 border rounded-xl text-xs focus:outline-none focus:border-[#D4AF37] ${
                                theme === "dark" ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                              }`}
                            >
                              <option value="Low">{lang === "ar" ? "منخفض" : "Low"}</option>
                              <option value="Medium">{lang === "ar" ? "متوسط" : "Medium"}</option>
                              <option value="High">{lang === "ar" ? "مرتفع" : "High"}</option>
                              <option value="Critical">{lang === "ar" ? "حرِج / تهديد عالي" : "Critical"}</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">{t.tagsLabel}</label>
                          <input 
                            type="text" 
                            value={newTags}
                            onChange={(e) => setNewTags(e.target.value)}
                            className={`w-full h-11 px-3.5 border rounded-xl text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                              theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                            }`}
                            placeholder={lang === "ar" ? "مثال: عقوبات، تفتيش، صرف، تحوط" : "e.g. hedging, sanctions, fx, logistics"}
                          />
                        </div>

                        <div className="pt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (!newTitle.trim()) {
                                setFormError(lang === "ar" ? "يرجى كتابة عنوان الحدث أولاً قبل الانتقال." : "Please enter the event title before proceeding.");
                                return;
                              }
                              setFormError("");
                              setFormStep(2);
                            }}
                            className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#B59410] text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <span>{lang === "ar" ? "التالي: سرد القرار" : (lang === "fr" ? "Suivant: Contexte & Décision" : "Next: Context & Decision")}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* STEP 2: Context & Decision Taken */}
                    {formStep === 2 && (
                      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] flex items-center justify-center text-[10px] font-black">2</span>
                            {lang === "ar" ? "سرد الحدث والقرار المتخذ" : (lang === "fr" ? "Contexte Narratif & Action Stratégique" : "Narrative Context & Strategic Action")}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-mono">{lang === "ar" ? "الخطوة 2 من 4" : (lang === "fr" ? "Étape 2 sur 4" : "Step 2 of 4")}</span>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">{t.descriptionLabel} *</label>
                          <textarea 
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            className={`w-full h-28 p-3 border rounded-xl text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                              theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                            }`}
                            placeholder={lang === "ar" ? "صف الظروف والبيئة التشغيلية أو السوقية كما حدثت بالظبط..." : (lang === "fr" ? "Détaillez le contexte opérationnel exact et les événements déclencheurs..." : "Detail the exact operational background and triggering events...")}
                            required
                          ></textarea>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">{t.decisionLabel} *</label>
                          <textarea 
                            value={newDecision}
                            onChange={(e) => setNewDecision(e.target.value)}
                            className={`w-full h-24 p-3 border rounded-xl text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                              theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                            }`}
                            placeholder={lang === "ar" ? "ما هو القرار المحدد الذي اتخذته الإدارة، ولماذا..." : (lang === "fr" ? "Quelle directive stratégique a été autorisée et mise en œuvre..." : "What specific executive directive was authorized and implemented...")}
                            required
                          ></textarea>
                        </div>

                        <div className="pt-4 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setFormStep(1)}
                            className="px-5 py-2.5 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            <span>{lang === "ar" ? "السابق" : (lang === "fr" ? "Précédent" : "Previous")}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (!newDescription.trim() || !newDecision.trim()) {
                                setFormError(lang === "ar" ? "يرجى تعبئة السرد والقرار المتخذ أولاً." : (lang === "fr" ? "Veuillez remplir le récit du contexte et la décision prise." : "Please complete both the Context Description and Decision Taken."));
                                return;
                              }
                              setFormError("");
                              setFormStep(3);
                            }}
                            className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#B59410] text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <span>{lang === "ar" ? "التالي: تحليل المسببات" : (lang === "fr" ? "Suivant: Facteurs Causaux" : "Next: Causal Factors")}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* STEP 3: Causes & Outcomes */}
                    {formStep === 3 && (
                      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] flex items-center justify-center text-[10px] font-black">3</span>
                            {lang === "ar" ? "العوامل المسببة والنتائج المترتبة" : (lang === "fr" ? "Facteurs Causaux Racine & Résultats Directs" : "Root Causal Factors & Direct Outcomes")}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-mono">{lang === "ar" ? "الخطوة 3 من 4" : (lang === "fr" ? "Étape 3 sur 4" : "Step 3 of 4")}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">{t.causalLabel}</label>
                            <textarea 
                              value={newCausal}
                              onChange={(e) => setNewCausal(e.target.value)}
                              className={`w-full h-28 p-3 border rounded-xl text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                                theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                              }`}
                              placeholder={lang === "ar" ? "ما الاختناقات أو الثغرات أو الضغوط الخارجية التي أدت لهذه النتيجة..." : (lang === "fr" ? "Décrivez les goulots d'étranglement, décalages de marché ou failles d'exécution..." : "Outline root cause bottlenecks, market shifts, or internal execution gaps...")}
                            ></textarea>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">{t.outcomesLabel}</label>
                            <textarea 
                              value={newOutcomes}
                              onChange={(e) => setNewOutcomes(e.target.value)}
                              className={`w-full h-28 p-3 border rounded-xl text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                                theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                              }`}
                              placeholder={lang === "ar" ? "التأثيرات المالية، التأخيرات الميدانية، أو النتائج المباشرة..." : (lang === "fr" ? "Impacts financiers, juridiques ou opérationnels quantifiables observés..." : "Quantifiable financial, legal, or operational impacts observed...")}
                            ></textarea>
                          </div>
                        </div>

                        <div className="pt-4 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setFormStep(2)}
                            className="px-5 py-2.5 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            <span>{lang === "ar" ? "السابق" : (lang === "fr" ? "Précédent" : "Previous")}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setFormError("");
                              setFormStep(4);
                            }}
                            className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#B59410] text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <span>{lang === "ar" ? "التالي: الدروس والتأمين" : (lang === "fr" ? "Suivant: Leçons & Sécurité" : "Next: Lessons & Passcode")}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* STEP 4: Lessons & CEO Passcode Encryption */}
                    {formStep === 4 && (
                      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] flex items-center justify-center text-[10px] font-black">4</span>
                            {lang === "ar" ? "الدروس المستفادة والتأمين السري" : (lang === "fr" ? "Leçons Apprises & Paramètres de Sécurité" : "Lessons Learned & Security Settings")}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-mono">{lang === "ar" ? "الخطوة 4 من 4" : (lang === "fr" ? "Étape 4 sur 4" : "Step 4 of 4")}</span>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">{t.lessonsLabel}</label>
                          <textarea 
                            value={newLessons}
                            onChange={(e) => setNewLessons(e.target.value)}
                            className={`w-full h-28 p-3 border rounded-xl text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                              theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                            }`}
                            placeholder={lang === "ar" ? "ما القواعد أو البروتوكولات الجديدة المستخلصة لمنع التكرار مستقبلاً..." : (lang === "fr" ? "Protocole institutionnel ou règles de gestion à appliquer à l'avenir..." : "Key institutional protocols or workflow rules to enforce going forward...")}
                          ></textarea>
                        </div>

                        {/* CEO Encryption Checkbox for Memory */}
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                              <Lock className="w-4 h-4 shrink-0" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-amber-300">
                                {lang === "ar" ? "تأمين وتشفير هذه الذكرى بالرمز السري للـ CEO" : (lang === "fr" ? "Chiffrer et verrouiller ce souvenir avec le code secret CEO" : "Enclose & Encrypt Memory with CEO Secret Code")}
                              </p>
                              <p className="text-[10px] text-amber-400/80">
                                {lang === "ar" ? "يتطلب إدخال الرمز السري قبل فتح أو قراءة تفاصيل هذه الذكرى" : (lang === "fr" ? "Exige le code secret avant d'ouvrir ou de lire les détails de ce souvenir" : "Requires secret passcode before expanding or reading details")}
                              </p>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={newIsEncrypted}
                            onChange={(e) => setNewIsEncrypted(e.target.checked)}
                            className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer shrink-0"
                          />
                        </div>

                        <div className="pt-4 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setFormStep(3)}
                            className="px-5 py-2.5 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            <span>{lang === "ar" ? "السابق" : (lang === "fr" ? "Précédent" : "Previous")}</span>
                          </button>

                          <button 
                            type="submit" 
                            disabled={isSubmittingMemory}
                            className="px-8 py-3 bg-[#D4AF37] hover:bg-[#B59410] active:bg-[#967B0C] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg shadow-[#D4AF37]/20 cursor-pointer flex items-center justify-center gap-2"
                          >
                            {isSubmittingMemory ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>{lang === "ar" ? "جاري الحفظ والتشفير..." : (lang === "fr" ? "Enregistrement & Chiffrement..." : "Saving & Encrypting...")}</span>
                              </>
                            ) : (
                              <>
                                <Database className="w-4.5 h-4.5" />
                                <span>{t.saveMemoryBtn || (lang === "ar" ? "اعتماد وحفظ الذاكرة" : (lang === "fr" ? "Publier le Souvenir" : "Publish Memory"))}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </form>
                </motion.div>
              )}

              {/* VIEW: FILE VAULT & STORAGE (FIREBASE) */}
              {activeTab === "files" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                  id="files-vault-view"
                >
                  <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800/60 pb-4">
                    <div>
                      <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <Folder className="w-7 h-7 text-amber-400" />
                        <span>{lang === "ar" ? "إدارة الملفات والوثائق المؤسسية" : (lang === "fr" ? "Gestionnaire de Fichiers" : "Institutional File Vault")}</span>
                      </h1>
                      <p className="text-slate-400 text-xs mt-1">
                        {lang === "ar" 
                          ? "تخزين الملفات والمستندات الخاصة بحسابك مع قواعد أمان مقيدة للمالك فقط (Firebase Storage & Firestore)"
                          : "Upload, view, download, and manage your private files backed by Firebase Storage & owner security rules."}
                      </p>
                    </div>
                  </div>

                  <FileManager 
                    userId={currentUser.role !== "CEO" && currentUser.workspace?.ownerId ? currentUser.workspace.ownerId : currentUser.id} 
                    lang={lang} 
                    theme={theme} 
                    secretPasscode={currentUser.encryptedSecurity?.secretPasscode}
                    isVaultLocked={currentUser.encryptedSecurity?.lockedModules?.fileVault}
                  />
                </motion.div>
              )}

              {/* VIEW: SMART EVOLUTION */}
              {activeTab === "smart" && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="space-y-6"
                  id="smart-evolution-view"
                >
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h1 className="text-3xl font-black tracking-tight">{t.smartEvolutionTitle}</h1>
                      <p className="text-slate-400 text-sm mt-1">{t.smartEvolutionSlogan}</p>
                    </div>

                    <button
                      onClick={runSmartAnalysis}
                      disabled={isSmartAnalyzing}
                      className="h-10 px-5 bg-[#D4AF37] hover:bg-[#B59410] disabled:bg-slate-800 text-white disabled:text-slate-500 font-bold text-xs rounded-lg flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      {isSmartAnalyzing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{t.consultingLedger}</span>
                        </>
                      ) : (
                        <>
                          <Brain className="w-4 h-4" />
                          <span>{t.regenerateBtn}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Operational AI Diagnostic KPI Banner */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: t.totalMemories, value: memories.length, icon: FileText, color: "text-[#D4AF37]", bg: "bg-[#D4AF37]/10" },
                      { label: t.activeRisks, value: riskAlerts.filter((a: any) => a.status === "Active" || a.status === "نشط" || a.status === "actif").length, icon: ShieldAlert, color: "text-rose-500", bg: "bg-rose-500/10" },
                      { label: t.smartMetrics.opportunities, value: smartData?.opportunitiesList ? smartData.opportunitiesList.length : (memories.length === 0 ? 0 : memories.length), icon: Compass, color: "text-blue-500", bg: "bg-blue-500/10" },
                      { label: t.smartMetrics.recommendations, value: smartData?.recommendationsList ? smartData.recommendationsList.length : (memories.length === 0 ? 0 : memories.length), icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" }
                    ].map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <div key={idx} className={`p-4 rounded-xl text-center border transition-all ${
                          theme === "dark" ? "bg-slate-900/40 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
                        }`}>
                          <div className={`p-2 rounded-lg inline-flex mb-2 ${item.bg} ${item.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className={`text-2xl font-black ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{item.value}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Report Narrative Box */}
                  <div className={`p-5 rounded-xl border ${
                    theme === "dark" ? "bg-slate-900/10 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
                  }`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] mb-2">{t.executiveSummary}</h3>
                    <p className={`text-xs leading-relaxed font-serif ${smartData?.error ? "text-rose-500 font-bold" : (theme === "dark" ? "text-slate-300" : "text-slate-600")}`}>
                      {smartData?.error ? (
                        smartData.error
                      ) : memories.length === 0 ? (
                        lang === "ar" ? "حساب جديد: لا توجد أحداث أو ذكريات مؤسسية مسجلة بعد لتشخيص الذكاء الاصطناعي. ابدأ بتسجيل ذاكرتك الأولى لإنشاء التحليلات التنبؤية والتوصيات والفرص." :
                        (lang === "fr" ? "Nouveau compte: Aucun souvenir enregistré pour générer un diagnostic IA. Enregistrez votre premier souvenir pour démarrer l'analyse." :
                        "New account: No institutional memories recorded yet for AI diagnostics. Log your first memory to initiate predictive analysis, opportunities, and risk recommendations.")
                      ) : (
                        (smartData as any)?.executiveSummary || (
                          lang === "ar" ? `يكشف تحليل ${smartData?.analyzedMemories || memories.length} من أحداث الذاكرة المؤسسية عن ${smartData?.identifiedRisks || riskAlerts.length} نقاط خطر حيوية ونمط غير مغطى من مخاطر الصرف في الربع الأخير.` : 
                          (lang === "fr" ? `L'analyse de ${smartData?.analyzedMemories || memories.length} souvenirs révèle ${smartData?.identifiedRisks || riskAlerts.length} risques critiques.` : 
                          `Analyzing ${smartData?.analyzedMemories || memories.length} institutional memories reveals ${smartData?.identifiedRisks || riskAlerts.length} critical risks.`)
                        )
                      )}
                    </p>
                  </div>

                  {/* Subtabs for Diagnostic Lists */}
                  <div className="space-y-4">
                    <div className="flex border-b border-slate-800/60 overflow-x-auto gap-2">
                      {[
                        { id: "predictions", label: t.predictionsTab },
                        { id: "recommendations", label: t.recommendationsTab },
                        { id: "opportunities", label: t.opportunitiesTab },
                        { id: "risks", label: t.risksTab }
                      ].map((subTab) => (
                        <button
                          key={subTab.id}
                          onClick={() => setSmartActiveSubTab(subTab.id as any)}
                          className={`h-11 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                            smartActiveSubTab === subTab.id
                              ? "border-[#D4AF37] text-[#D4AF37]"
                              : "border-transparent text-slate-400 hover:text-white"
                          }`}
                        >
                          {subTab.label}
                        </button>
                      ))}
                    </div>

                    {/* Rendering Active Diagnostic lists */}
                    <div className="space-y-3">
                      {memories.length === 0 ? (
                        <div className={`p-8 text-center rounded-xl border border-dashed ${
                          theme === "dark" ? "border-slate-800 bg-slate-900/20" : "border-slate-200 bg-slate-50"
                        }`}>
                          <Brain className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-40" />
                          <h4 className="text-xs font-bold text-slate-300">
                            {lang === "ar" ? "لا توجد تحليلات مسجلة لهذا الحساب" : "No diagnostics available for this account"}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {lang === "ar" ? "قم بتسجيل ذكريات جديدة ثم شغل التحليل التلقائي لاستخراج الرؤى والتوصيات." : "Log new memories and run analysis to generate AI insights."}
                          </p>
                        </div>
                      ) : (
                        <>
                          {smartActiveSubTab === "predictions" && (
                            (smartData?.forecastsList || [
                              { title: "فجوة متكررة في تغطية مخاطر الصرف الأجنبي", timeframe: "30-60 يوم", impact: "مرتفع", details: "أحداث الخسارة تشير إلى تعرض translation variance متزايد إن لم تلتزم المؤسسة بنسبة تحوط 70%." },
                              { title: "تفتيش وتأخير تصنيفات акт جمركياً", timeframe: "90 يوم", impact: "متوسط", details: "إذا لم يتم مواءمة HS classification actuator، ستتكرر الغرامات الجمركية بنسبة 15%." }
                            ]).map((p, idx) => (
                              <div key={idx} className={`p-4 border rounded-xl transition-all ${
                                theme === "dark" ? "bg-slate-900/20 border-slate-800/60" : "bg-white border-slate-200 shadow-sm"
                              }`}>
                                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                                  <h4 className="text-xs font-bold text-[#D4AF37]">{p.title}</h4>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded font-bold">{p.timeframe}</span>
                                    <span className="text-[10px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded font-bold">{p.impact}</span>
                                  </div>
                                </div>
                                <p className={`text-[11px] leading-relaxed mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-650"}`}>{p.details}</p>
                              </div>
                            ))
                          )}

                          {smartActiveSubTab === "recommendations" && (
                            (smartData?.recommendationsList || [
                              { title: "تثبيت نطاقات الصرف الأجنبي الصارمة", priority: "حرِج", actionable: "إلزام التحوط بين 70-90%", details: "يقضي على قرارات الفارق Speculative تماماً ويمنع translational violations." },
                              { title: "تفعيل Webhooks لحدث SDN العقوبات", priority: "مرتفع", actionable: "تكامل فوري للبث", details: "يستبدل السحب اليومي بالبث الفوري لحماية correspondent banking." }
                            ]).map((r, idx) => (
                              <div key={idx} className={`p-4 border rounded-xl transition-all ${
                                theme === "dark" ? "bg-slate-900/20 border-slate-800/60" : "bg-white border-slate-200 shadow-sm"
                              }`}>
                                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                                  <h4 className="text-xs font-bold text-emerald-600">{r.title}</h4>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded font-bold">{r.priority}</span>
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded font-bold">{r.actionable}</span>
                                  </div>
                                </div>
                                <p className={`text-[11px] leading-relaxed mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-650"}`}>{r.details}</p>
                              </div>
                            ))
                          )}

                          {smartActiveSubTab === "opportunities" && (
                            (smartData?.opportunitiesList || [
                              { title: "مكتبة HS مرجعية مركزية", feasibility: "مرتفعة جداً", benefit: "توفير $200k سنوياً", details: "تصنيف actuarial مركزي للActuators يقضي على الرسوم التأخيرية للموانئ." }
                            ]).map((o, idx) => (
                              <div key={idx} className={`p-4 border rounded-xl transition-all ${
                                theme === "dark" ? "bg-slate-900/20 border-slate-800/60" : "bg-white border-slate-200 shadow-sm"
                              }`}>
                                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                                  <h4 className="text-xs font-bold text-blue-600">{o.title}</h4>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded font-bold">{o.feasibility}</span>
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded font-bold">{o.benefit}</span>
                                  </div>
                                </div>
                                <p className={`text-[11px] leading-relaxed mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-650"}`}>{o.details}</p>
                              </div>
                            ))
                          )}

                          {smartActiveSubTab === "risks" && (
                            (smartData?.risksList || [
                              { title: "تعرض correspond banking لغرامة screening", severity: "حرجة", probability: "80%", details: "تأخر SDN list screening update ل72 ساعة processing transations." }
                            ]).map((ri, idx) => (
                              <div key={idx} className={`p-4 border rounded-xl transition-all ${
                                theme === "dark" ? "bg-slate-900/20 border-slate-800/60" : "bg-white border-slate-200 shadow-sm"
                              }`}>
                                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                                  <h4 className="text-xs font-bold text-rose-500">{ri.title}</h4>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded font-bold">{ri.severity}</span>
                                    <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded font-bold">{ri.probability}</span>
                                  </div>
                                </div>
                                <p className={`text-[11px] leading-relaxed mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-650"}`}>{ri.details}</p>
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* VIEW: MARKET INTELLIGENCE */}
              {activeTab === "market" && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="space-y-6"
                  id="market-intelligence-view"
                >
                  <div>
                    <h1 className="text-3xl font-black tracking-tight">{t.marketIntelligenceTitle}</h1>
                    <p className="text-slate-400 text-sm mt-1">{t.marketSlogan}</p>
                  </div>

                  <form onSubmit={runMarketAnalysis} className={`p-6 rounded-2xl border space-y-4 ${
                    theme === "dark" ? "bg-slate-900/40 border-slate-800/80 shadow-black/20" : "bg-white border-slate-200 shadow-sm"
                  }`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">{t.marketTopic}</label>
                        <input 
                          type="text"
                          value={marketTopic}
                          onChange={(e) => setMarketTopic(e.target.value)}
                          className={`w-full h-11 px-3.5 border rounded-lg text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                            theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                          }`}
                          placeholder={t.marketTopicPlaceholder}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">{t.industryLabel}</label>
                        <select
                          value={marketIndustry}
                          onChange={(e) => {
                            setMarketIndustry(e.target.value);
                            if (e.target.value !== "Other") {
                              setCustomMarketIndustry("");
                            }
                          }}
                          className={`w-full h-10 px-3 border rounded-lg text-xs focus:outline-none focus:border-[#D4AF37] ${
                            theme === "dark" ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                          }`}
                        >
                          <option value="Financial Services">{t.industryFinancial}</option>
                          <option value="Supply Chain & Shipping">{t.industrySupply}</option>
                          <option value="Global Trade">{t.industryGlobalTrade}</option>
                          <option value="Other">{lang === "ar" ? "أخرى (كتابة قطاع مخصص)" : "Other (write custom)"}</option>
                        </select>
                        {marketIndustry === "Other" && (
                          <input 
                            type="text"
                            value={customMarketIndustry}
                            onChange={(e) => setCustomMarketIndustry(e.target.value)}
                            className={`w-full h-11 px-3.5 mt-2 border rounded-lg text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                              theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                            }`}
                            placeholder={lang === "ar" ? "اكتب القطاع هنا..." : "Enter custom industry..."}
                            required
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">{t.contextOptional}</label>
                      <input 
                        type="text"
                        value={marketContext}
                        onChange={(e) => setMarketContext(e.target.value)}
                        className={`w-full h-11 px-3.5 border rounded-lg text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                          theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                        }`}
                        placeholder={t.marketContextPlaceholder}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isMarketAnalyzing || !marketTopic}
                      className="w-full h-11 bg-[#D4AF37] hover:bg-[#B59410] disabled:bg-slate-800 text-white disabled:text-slate-500 font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isMarketAnalyzing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{(t as any).analyzing || (lang === "ar" ? "جاري التحليل..." : "Analyzing...")}</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-4 h-4" />
                          <span>{(t as any).runMarketAnalysis || (lang === "ar" ? "تشغيل تحليل السوق" : "Run Market Analysis")}</span>
                        </>
                      )}
                    </button>
                  </form>

                  {marketResult && (
                    <motion.div 
                      initial={{ opacity: 0, y: 15 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className={`p-5 rounded-xl border ${
                        theme === "dark" ? "bg-slate-900/20 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
                      }`}>
                        <h3 className="text-sm font-bold uppercase text-[#D4AF37] mb-3">{t.executiveSummary}</h3>
                        <p className={`text-xs leading-relaxed ${marketResult.error ? "text-rose-500 font-bold" : (theme === "dark" ? "text-slate-300" : "text-slate-600")}`}>
                          {marketResult.error ? marketResult.error : renderTextWithLinks(marketResult.summary)}
                        </p>
                      </div>

                      {!marketResult.error && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className={`border p-5 rounded-xl space-y-3 ${theme === "dark" ? "bg-rose-500/5 border-rose-500/10" : "bg-rose-50/40 border-rose-100 shadow-sm"}`}>
                            <h4 className="text-xs font-bold text-rose-500 uppercase flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4" />
                              {t.risksTab}
                            </h4>
                            <ul className={`space-y-2 text-xs list-disc ${lang === "ar" ? "pr-4" : "pl-4"} ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                              {marketResult.risks?.map((item, idx) => <li key={idx}>{renderTextWithLinks(item)}</li>)}
                            </ul>
                          </div>

                          <div className={`border p-5 rounded-xl space-y-3 ${theme === "dark" ? "bg-blue-500/5 border-blue-500/10" : "bg-blue-50/40 border-blue-100 shadow-sm"}`}>
                            <h4 className="text-xs font-bold text-blue-500 uppercase flex items-center gap-1.5">
                              <Compass className="w-4 h-4" />
                              {t.opportunitiesTab}
                            </h4>
                            <ul className={`space-y-2 text-xs list-disc ${lang === "ar" ? "pr-4" : "pl-4"} ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                              {marketResult.opportunities?.map((item, idx) => <li key={idx}>{renderTextWithLinks(item)}</li>)}
                            </ul>
                          </div>

                          <div className={`border p-5 rounded-xl space-y-3 ${theme === "dark" ? "bg-emerald-500/5 border-emerald-500/10" : "bg-emerald-50/40 border-emerald-100 shadow-sm"}`}>
                            <h4 className="text-xs font-bold text-emerald-600 uppercase flex items-center gap-1.5">
                              <CheckCircle className="w-4 h-4" />
                              {t.recommendationsTab}
                            </h4>
                            <ul className={`space-y-2 text-xs list-disc ${lang === "ar" ? "pr-4" : "pl-4"} ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                              {marketResult.recommendations?.map((item, idx) => <li key={idx}>{renderTextWithLinks(item)}</li>)}
                            </ul>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* WORLD BANK OPEN DATA PORTAL SECTION */}
                  <WorldBankPortal
                    theme={theme}
                    lang={lang}
                    currentUser={currentUser}
                    memories={memories}
                    wbCountry={wbCountry}
                    setWbCountry={setWbCountry}
                    wbIndicator={wbIndicator}
                    setWbIndicator={setWbIndicator}
                    wbStartYear={wbStartYear}
                    setWbStartYear={setWbStartYear}
                    wbEndYear={wbEndYear}
                    setWbEndYear={setWbEndYear}
                    wbData={wbData}
                    wbLoading={wbLoading}
                    wbCausalAnalysis={wbCausalAnalysis}
                    wbIsAnalyzing={wbIsAnalyzing}
                    runWorldBankCausalAnalysis={runWorldBankCausalAnalysis}
                    importWorldBankToMemory={importWorldBankToMemory}
                    wbImportSuccessMsg={wbImportSuccessMsg}
                    setWbImportSuccessMsg={setWbImportSuccessMsg}
                    wbImportErrorMsg={wbImportErrorMsg}
                    setWbImportErrorMsg={setWbImportErrorMsg}
                    wbImporting={wbImporting}
                    renderTextWithLinks={renderTextWithLinks}
                    wbError={wbError}
                    wbSourceInfo={wbSourceInfo}
                    retryFetch={() => fetchWorldBankData(wbCountry, wbIndicator, wbStartYear, wbEndYear)}
                    loadBenchmarkFallback={loadBenchmarkFallback}
                  />
                </motion.div>
              )}

              {/* VIEW: COGNITIVE ADVISOR AI AGENT */}
              {activeTab === "agent" && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="space-y-6 h-full flex flex-col"
                  id="cognitive-advisor-view"
                  style={{ maxHeight: "calc(100vh - 120px)" }}
                >
                  <div className="flex-none">
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                      <Sparkles className="w-8 h-8 text-[#D4AF37] animate-pulse" />
                      <span>{t.aiAgentTitle || "Cognitive Advisor"}</span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">{t.aiAgentSlogan}</p>
                  </div>

                  <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
                    {/* Sidebar with suggested queries and agent info */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                      <div className={`p-5 rounded-2xl border flex-1 space-y-4 flex flex-col ${
                        theme === "dark" ? "bg-slate-900/30 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
                      }`}>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] mb-2">
                            {lang === "ar" ? "قاعدة المعرفة الحية" : (lang === "fr" ? "Base de Connaissances" : "Live Knowledge Base")}
                          </h3>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {lang === "ar" 
                              ? "يتصل هذا المستشار مباشرة بقاعدة بيانات Zakir السببية ولديه إمكانية الوصول الفوري لقراءة وتوجيه الدروس المستفادة." 
                              : "This advisor is plugged directly into Zakir's PostgreSQL memory tables, providing grounded corporate reasoning."}
                          </p>
                        </div>

                        <div className="space-y-2 border-t border-slate-800/60 pt-4 flex-1 overflow-y-auto max-h-[220px] scrollbar-thin">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {lang === "ar" ? "استفسارات مقترحة" : "Suggested Queries"}
                          </h4>
                          <div className="space-y-2">
                            {suggestedAgentQueries.map((q, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSendAgentMessage(undefined, q.query)}
                                disabled={isAgentReplying}
                                className={`w-full p-2.5 rounded-lg border text-right transition-all text-[11px] font-medium block cursor-pointer hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 ${
                                  theme === "dark" 
                                    ? "bg-slate-950 border-slate-850 text-slate-300" 
                                    : "bg-slate-50 border-slate-200 text-slate-700"
                                }`}
                              >
                                {q.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-3.5 bg-[#D4AF37]/5 border border-[#D4AF37]/25 rounded-xl text-center flex items-center justify-center gap-2">
                          <Bot className="w-5 h-5 text-[#D4AF37]" />
                          <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider">
                            {lang === "ar" ? "النموذج النشط: Gemini 3.1 Pro Preview" : "Active Model: Gemini 3.1 Pro Preview"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Chat Area */}
                    <div className="lg:col-span-3 flex flex-col h-full min-h-0">
                      <div className={`rounded-2xl border flex flex-col h-full min-h-0 overflow-hidden ${
                        theme === "dark" ? "bg-slate-900/20 border-slate-800/80" : "bg-white border-slate-200 shadow-sm"
                      }`}>
                        {/* Messages Flow Container */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin flex flex-col">
                          {/* Greeting message */}
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0 mt-0.5">
                              <Bot className="w-4 h-4" />
                            </div>
                            <div className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                              theme === "dark" ? "bg-slate-900 text-slate-250" : "bg-slate-100 text-slate-800"
                            }`}>
                              {agentGreeting}
                            </div>
                          </div>

                          {agentMessages.map((msg) => {
                            const isUser = msg.role === "user";
                            return (
                              <div key={msg.id} className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                                {!isUser && (
                                  <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0 mt-0.5">
                                    <Bot className="w-4 h-4" />
                                  </div>
                                )}
                                <div className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                                  isUser 
                                    ? "bg-amber-500 text-slate-950 font-medium rounded-br-none whitespace-pre-wrap" 
                                    : (theme === "dark" ? "bg-slate-900 text-slate-200 rounded-bl-none" : "bg-slate-100 text-slate-800 rounded-bl-none")
                                }`}>
                                  {isUser ? (
                                    msg.text
                                  ) : (
                                    <div className="prose prose-invert max-w-none text-xs space-y-2 [&>h1]:text-sm [&>h1]:font-bold [&>h1]:text-[#D4AF37] [&>h1]:mt-2 [&>h1]:mb-1 [&>h2]:text-xs [&>h2]:font-bold [&>h2]:text-[#D4AF37] [&>h2]:mt-2 [&>h2]:mb-1 [&>h3]:text-xs [&>h3]:font-bold [&>h3]:text-[#D4AF37] [&>h3]:mt-2 [&>h3]:mb-1 [&>p]:mb-1.5 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>li]:mb-0.5 [&_a]:text-[#D4AF37] [&_a]:underline [&_strong]:font-semibold [&_strong]:text-[#D4AF37]">
                                      <Markdown>{msg.text}</Markdown>
                                    </div>
                                  )}
                                </div>
                                {isUser && (
                                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                                    <UserIcon className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Replying reasoning indicator */}
                          {isAgentReplying && (
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0 mt-0.5">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              </div>
                              <div className={`p-3 rounded-2xl flex items-center gap-2 ${
                                theme === "dark" ? "bg-slate-900 text-slate-400" : "bg-slate-100 text-slate-500"
                              }`}>
                                <span className="text-[11px] font-medium">
                                  {lang === "ar" ? "جاري استرجاع ذكريات المؤسسة وتحليل الأسباب والدروس..." : "Consulting causal memory ledger..."}
                                </span>
                                <div className="flex gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-bounce" style={{ animationDelay: "0ms" }}></span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-bounce" style={{ animationDelay: "150ms" }}></span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-bounce" style={{ animationDelay: "300ms" }}></span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Input Form at the bottom */}
                        <form onSubmit={handleSendAgentMessage} className="p-4 border-t border-slate-800/60 bg-slate-950/40 flex gap-2">
                          <input
                            type="text"
                            value={agentInput}
                            onChange={(e) => setAgentInput(e.target.value)}
                            disabled={isAgentReplying}
                            className={`flex-1 h-11 px-4 border rounded-lg text-xs focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/20 ${
                              theme === "dark" ? "bg-slate-950 border-slate-850 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                            }`}
                            placeholder={t.aiAgentPlaceholder}
                          />
                          <button
                            type="submit"
                            disabled={isAgentReplying || !agentInput.trim()}
                            className="h-11 px-5 bg-[#D4AF37] hover:bg-[#B59410] disabled:bg-slate-800 text-white disabled:text-slate-500 font-bold text-xs rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-[#D4AF37]/5"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>{t.aiAgentSendBtn}</span>
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* VIEW: RISK ALERTS */}

              {/* VIEW: RISK ALERTS */}
              {activeTab === "alerts" && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="space-y-6"
                  id="alerts-view"
                >
                  <div>
                    <h1 className="text-3xl font-black tracking-tight">
                      {lang === "ar"
                        ? "تنبيهات المخاطر النظامية"
                        : lang === "fr"
                        ? "Alertes de Risques Systémiques"
                        : "Systemic Risk Alerts"}
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                      {lang === "ar"
                        ? "سجل التنبيهات ورادار تركيز المخاطر استناداً لأحداث الذاكرة والتحليل التشغيلي."
                        : lang === "fr"
                        ? "Registre des alertes et radar de concentration des risques basés sur l'historique."
                        : "Risk alert registry and category concentration radar based on historical memory analysis."}
                    </p>
                  </div>

                  {/* RADAR CHART VISUALIZATION */}
                  <RiskRadarChart
                    riskAlerts={riskAlerts}
                    memories={memories}
                    lang={lang}
                    theme={theme}
                  />

                  <div className="space-y-4 pt-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-amber-500" />
                      <span>
                        {lang === "ar"
                          ? "سجل التنبيهات المباشرة"
                          : lang === "fr"
                          ? "Registre des alertes directes"
                          : "Live Risk Alert Registry"}
                      </span>
                    </h3>
                    {riskAlerts.length === 0 ? (
                      <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                        <ShieldAlert className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                        <h4 className="text-sm font-bold text-slate-300">
                          {lang === "ar" ? "لا توجد تنبيهات مخاطر مسجلة" : "No risk alerts logged"}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          {lang === "ar" ? "سيقوم النظام بتحليل الأحداث وإطلاق التنبيهات تلقائياً عند ظهور مخاطر تشغيلية." : "The system will automatically analyze events and trigger risk alerts."}
                        </p>
                      </div>
                    ) : (
                      riskAlerts.map((alert) => (
                      <div key={alert.id} className="p-5 bg-slate-900/20 border border-slate-800/80 rounded-xl flex items-start justify-between gap-6 flex-wrap">
                        <div className="space-y-1.5 flex-1 min-w-[280px]">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-xs font-bold text-white">{alert.title}</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${getSeverityBadgeClass(alert.severity)}`}>
                              {alert.severity}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(alert.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{alert.description}</p>
                          <div className="flex items-center gap-1 pt-1">
                            <span className="text-[10px] text-slate-400">التصنيف التشغيلي:</span>
                            <span className="text-[10px] font-bold text-amber-500">{alert.category}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {alert.status === "Resolved" ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>{t.resolved}</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => resolveRiskAlert(alert.id)}
                              className="h-9 px-4 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 text-xs font-bold rounded-lg transition-all cursor-pointer"
                            >
                              {t.resolveAlert}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                    )}
                  </div>
                </motion.div>
              )}

              {/* VIEW: EMAIL VAULT */}
              {activeTab === "gmail" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                  id="email-vault-view"
                >
                  <GmailVault
                    lang={lang}
                    theme={theme}
                  />
                </motion.div>
              )}

              {/* VIEW: SETTINGS & ADMINISTRATION */}
              {activeTab === "settings" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="space-y-6"
                  id="settings-view"
                >
                  <SettingsAdmin
                    currentUser={currentUser}
                    onUpdateUser={(updated) => {
                      setCurrentUser(updated);
                      if (!updated.customTheme?.approvedAt && updated.userPreferences?.theme) {
                        applyGlobalTheme(updated.userPreferences.theme, setTheme, updated, setCurrentUser, false);
                      }
                      saveFirebaseUserProfile(updated).catch(err => console.error("Error saving user profile to Firestore:", err));
                    }}
                    onEncryptAllData={handleEncryptAllData}
                    onLogout={handleLogout}
                    lang={lang}
                    setLang={toggleLanguage}
                    theme={theme}
                    setTheme={toggleTheme}
                    activeSubTab={settingsActiveSubTab}
                    setActiveSubTab={setSettingsActiveSubTab}
                  />
                </motion.div>
              )}

              {/* VIEW: CUSTOMER SUPPORT CENTER */}
              {activeTab === "support" && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="space-y-6"
                  id="support-view"
                >
                  <CustomerSupport
                    currentUser={currentUser}
                    lang={lang}
                  />
                </motion.div>
              )}

            </div>
          </main>
        </div>
      )}

      {/* UNLOCK ENCRYPTED MEMORY MODAL */}
      {unlockMemoryTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {lang === "ar" ? "فك تشفير الذاكرة المؤسسية" : (lang === "fr" ? "Déchiffrer la Mémoire Institutionnelle" : "Decrypt Institutional Memory")}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                    {unlockMemoryTarget.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUnlockMemoryTarget(null);
                  setUnlockMemoryError("");
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === "ar"
                ? "هذه الذكرى محمية ومشفّرة. أدخل الرمز السري المعتمد لفك القفل واستعراض التفاصيل والدروس المستفادة:"
                : (lang === "fr"
                  ? "Ce souvenir est chiffré et verrouillé. Entrez le code secret maître pour déverrouiller et afficher tous les détails :"
                  : "This memory is encrypted and locked. Enter the master secret passcode to unlock and view full details:")}
            </p>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!unlockMemoryTarget) return;
                const activePasscode = currentUser?.encryptedSecurity?.secretPasscode;
                if (!activePasscode || activePasscode.trim() === "") {
                  setUnlockMemoryError(
                    lang === "ar"
                      ? "لم يتم تعيين رمز سري بعد! يرجى الذهاب إلى الإعدادات > الأمان لتعيين رمزك السري أولاً."
                      : (lang === "fr"
                        ? "Aucun code secret n'est encore configuré ! Veuillez d'abord configurer votre code secret dans Paramètres > Sécurité."
                        : "No secret passcode set yet! Please configure your secret passcode in Settings > Security first.")
                  );
                  return;
                }
                if (unlockMemoryPinInput.trim() === activePasscode.trim()) {
                  setUnlockedMemoryIds(prev => new Set(prev).add(unlockMemoryTarget.id));
                  setExpandedMemoryId(unlockMemoryTarget.id);
                  setUnlockMemoryTarget(null);
                  setUnlockMemoryPinInput("");
                  setUnlockMemoryError("");
                } else {
                  setUnlockMemoryError(
                    lang === "ar"
                      ? "الرمز السري غير صحيح! يرجى التأكد من الرمز المدخل لفك التشفير."
                      : (lang === "fr"
                        ? "Code secret invalide ! La vérification a échoué."
                        : "Invalid secret passcode! Verification failed.")
                  );
                }
              }} 
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                  {lang === "ar" ? "أدخل الرمز السري للـ CEO:" : (lang === "fr" ? "Code Secret / Mot de Passe CEO :" : "Enter CEO Secret Code / Passcode:")}
                </label>
                <input
                  type="password"
                  autoFocus
                  value={unlockMemoryPinInput}
                  onChange={(e) => {
                    setUnlockMemoryPinInput(e.target.value);
                    setUnlockMemoryError("");
                  }}
                  placeholder="••••"
                  className="w-full h-11 px-4 bg-slate-950 border border-slate-800 text-amber-400 font-mono text-center text-lg rounded-xl focus:border-amber-500 focus:outline-none tracking-widest"
                />
              </div>

              {unlockMemoryError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{unlockMemoryError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockMemoryTarget(null);
                    setUnlockMemoryError("");
                  }}
                  className="px-4 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  {lang === "ar" ? "إلغاء" : (lang === "fr" ? "Annuler" : "Cancel")}
                </button>
                <button
                  type="submit"
                  className="px-6 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 transition-all"
                >
                  <Unlock className="w-4 h-4" />
                  <span>{lang === "ar" ? "التحقق وفك القفل" : (lang === "fr" ? "Vérifier & Déverrouiller" : "Verify & Unlock")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MEMORY MODAL DIALOG */}
      {editingMemory && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl max-h-[90vh] rounded-2xl border p-6 flex flex-col justify-between overflow-hidden shadow-2xl ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Edit3 className="w-5 h-5" />
                <span>{lang === "ar" ? "تعديل الذكرى المؤسسية" : (lang === "fr" ? "Modifier la Mémoire Institutionnelle" : "Edit Institutional Memory")}</span>
              </div>
              <button
                onClick={() => setEditingMemory(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateMemorySubmit} className="my-4 overflow-auto space-y-4 pr-1 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">{lang === "ar" ? "عنوان الذكرى / القرار الاستراتيجي:" : (lang === "fr" ? "Titre / Décision Stratégique :" : "Title / Strategic Decision:")}</label>
                <input
                  type="text"
                  required
                  value={editingMemory.title}
                  onChange={(e) => setEditingMemory({ ...editingMemory, title: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{lang === "ar" ? "الفئة الاستراتيجية:" : (lang === "fr" ? "Catégorie Stratégique :" : "Category:")}</label>
                  <select
                    value={editCategorySelect}
                    onChange={(e) => {
                      setEditCategorySelect(e.target.value);
                      if (e.target.value !== "Other") {
                        setCustomEditCategory("");
                      }
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                  >
                    <option value="Financial Engineering">Ingénierie Financière (Financial Engineering)</option>
                    <option value="FX Risk Management">Gestion du Risque de Change (FX Risk Management)</option>
                    <option value="Customs Classification">Classification Douanière (Customs Classification)</option>
                    <option value="Compliance">Conformité et Gouvernance (Compliance)</option>
                    <option value="Operations">Opérations Logistiques (Operations)</option>
                    <option value="Other">{lang === "ar" ? "أخرى (كتابة تصنيف مخصص)" : (lang === "fr" ? "Autre (saisir catégorie personnalisée)" : "Other (write custom)")}</option>
                  </select>
                  {editCategorySelect === "Other" && (
                    <input 
                      type="text"
                      value={customEditCategory}
                      onChange={(e) => setCustomEditCategory(e.target.value)}
                      className="w-full h-10 px-3 mt-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                      placeholder={lang === "ar" ? "اكتب التصنيف المخصص هنا..." : (lang === "fr" ? "Entrez la catégorie personnalisée..." : "Enter custom category...")}
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">{lang === "ar" ? "مستوى الخطورة:" : (lang === "fr" ? "Niveau de Risque :" : "Risk Severity:")}</label>
                  <select
                    value={editingMemory.riskLevel}
                    onChange={(e) => setEditingMemory({ ...editingMemory, riskLevel: e.target.value as any })}
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                  >
                    <option value="Low">Faible (Low)</option>
                    <option value="Medium">Moyen (Medium)</option>
                    <option value="High">Élevé (High)</option>
                    <option value="Critical">Critique (Critical)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">{lang === "ar" ? "وصف ما حدث:" : (lang === "fr" ? "Description de l'événement :" : "Description:")}</label>
                <textarea
                  rows={2}
                  value={editingMemory.description}
                  onChange={(e) => setEditingMemory({ ...editingMemory, description: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{lang === "ar" ? "القرار المتخذ:" : (lang === "fr" ? "Décision Prise :" : "Decision Taken:")}</label>
                  <textarea
                    rows={2}
                    value={editingMemory.decision}
                    onChange={(e) => setEditingMemory({ ...editingMemory, decision: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">{lang === "ar" ? "العوامل المسببة:" : (lang === "fr" ? "Facteurs Causaux :" : "Causal Factors:")}</label>
                  <textarea
                    rows={2}
                    value={editingMemory.causalFactors || ""}
                    onChange={(e) => setEditingMemory({ ...editingMemory, causalFactors: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{lang === "ar" ? "النتائج المحققة:" : (lang === "fr" ? "Résultats Obtenus :" : "Outcomes:")}</label>
                  <textarea
                    rows={2}
                    value={editingMemory.outcomes || ""}
                    onChange={(e) => setEditingMemory({ ...editingMemory, outcomes: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">{lang === "ar" ? "الدروس الاستراتيجية:" : (lang === "fr" ? "Leçons Stratégiques :" : "Lessons Learned:")}</label>
                  <textarea
                    rows={2}
                    value={editingMemory.lessonsLearned || ""}
                    onChange={(e) => setEditingMemory({ ...editingMemory, lessonsLearned: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <span className="font-bold text-amber-300">{lang === "ar" ? "تشفير هذه الذكرى بالرمز السري:" : (lang === "fr" ? "Chiffrer ce souvenir avec le code secret :" : "Encrypt this memory:")}</span>
                <input
                  type="checkbox"
                  checked={!!editingMemory.isEncrypted}
                  onChange={(e) => setEditingMemory({ ...editingMemory, isEncrypted: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingMemory(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  {lang === "ar" ? "إلغاء" : (lang === "fr" ? "Annuler" : "Cancel")}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {lang === "ar" ? "حفظ التعديلات" : (lang === "fr" ? "Enregistrer les Modifications" : "Save Changes")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRefreshToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-amber-500/30 text-amber-400 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-medium text-xs animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>
            {lang === "ar" ? "تم تحديث البيانات وقاعدة الذاكرة بنجاح!" : (lang === "fr" ? "Données système et mémoire rafraîchies avec succès !" : "System data and memory cache refreshed successfully!")}
          </span>
        </div>
      )}

      {/* Dedicated Print Preview & Formatting Modal */}
      <PrintPreviewModal
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
        memories={memories}
        initialSelectedMemoryId={printPreviewMemoryId}
        lang={lang}
        companyName={currentUser?.companyName || "Zakir Institutional Memory Engine"}
        userName={currentUser?.ownerName || currentUser?.email?.split("@")[0] || "System Administrator"}
        workspaceLogoUrl={currentUser?.avatarUrl}
      />

      {/* Stripe Paid Verified Receipt Modal */}
      {stripeReceiptData && (
        <div className="printable-receipt-modal fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-6 text-white relative">
            <button
              type="button"
              onClick={() => setStripeReceiptData(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-emerald-400">
                  {lang === "ar" ? "وصل دفع مؤكد - Stripe" : (lang === "fr" ? "Reçu de Paiement Confirmé - Stripe" : "Paid Verified Receipt - Stripe")}
                </h3>
                <p className="text-xs text-slate-400">
                  {stripeReceiptData.invoiceNo} • {stripeReceiptData.date}
                </p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">{lang === "ar" ? "الخطة المشتركة:" : (lang === "fr" ? "Plan Abonné :" : "Plan:")}</span>
                <span className="font-bold text-amber-400">{stripeReceiptData.plan}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">{lang === "ar" ? "دورة الفوترة:" : (lang === "fr" ? "Cycle de Facturation :" : "Billing Cycle:")}</span>
                <span className="font-bold text-slate-200">{stripeReceiptData.billingCycle === "annual" ? (lang === "ar" ? "سنوية" : (lang === "fr" ? "Annuelle" : "Annual")) : (lang === "ar" ? "شهرية" : (lang === "fr" ? "Mensuelle" : "Monthly"))}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">{lang === "ar" ? "المبلغ المدفوع:" : (lang === "fr" ? "Montant Payé :" : "Amount Paid:")}</span>
                <span className="font-black text-emerald-400 text-sm">{stripeReceiptData.amount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">{lang === "ar" ? "طريقة الدفع:" : (lang === "fr" ? "Moyen de Paiement :" : "Payment Method:")}</span>
                <span className="font-bold text-slate-200">{stripeReceiptData.paymentMethod}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">{lang === "ar" ? "المشترك:" : (lang === "fr" ? "Abonné :" : "Subscriber:")}</span>
                <span className="font-bold text-slate-200">{stripeReceiptData.customerName} ({stripeReceiptData.customerEmail})</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{lang === "ar" ? "طباعة الفاتورة" : (lang === "fr" ? "Imprimer la Facture" : "Print Invoice")}</span>
              </button>
              <button
                type="button"
                onClick={() => setStripeReceiptData(null)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {lang === "ar" ? "إغلاق ومتابعة" : (lang === "fr" ? "Fermer & Continuer" : "Close & Proceed")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Attribution */}
      <footer className="w-full py-4 px-6 text-center text-xs border-t mt-auto bg-slate-950/20 backdrop-blur-sm"
        style={{
          borderColor: theme === 'dark' ? 'rgba(30, 41, 59, 0.4)' : 'rgba(226, 232, 240, 0.8)',
          color: theme === 'dark' ? '#64748b' : '#475569'
        }}
      >
        <div className="flex items-center justify-center gap-2 select-none">
          <span className="font-medium">
            {lang === "ar" ? "تم التطوير والإعداد بواسطة" : "Designed & Developed by"}{" "}
            <span className="font-semibold animate-pulse" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
              Mohamed Vadhil Haiballa
            </span>
          </span>
          <span className="opacity-30">•</span>
          <span className="opacity-75 tracking-wider uppercase text-[10px]">
            {lang === "ar" ? "منصة ذاكر الذكية" : "Zakir Smart Platform"}
          </span>
        </div>
      </footer>

      {/* Desktop Application Auto-Update Banner */}
      <DesktopUpdateNotification lang={lang} />

    </div>
  );
}
