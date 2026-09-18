import React, { useState, useEffect, useRef } from "react";
import { safeFormatDate, safeFormatDateTime, safeFormatTime } from "../lib/dateUtils";
import { 
  HelpCircle, 
  MessageSquare, 
  PlusCircle, 
  Send, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  ChevronRight, 
  LifeBuoy, 
  Mail, 
  Phone, 
  Building, 
  FileText, 
  Tag, 
  ShieldCheck, 
  RefreshCw,
  User as UserIcon,
  Bot,
  ArrowRight,
  Paperclip,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  AlertCircle,
  X,
  ChevronDown,
  Lock,
  Key,
  ExternalLink,
  BookOpen,
  Compass,
  Printer,
  Download,
  BookMarked,
  Layers,
  Share2
} from "lucide-react";
import { User, SupportTicket, SupportCategory, SupportPriority, SupportStatus, SupportMessage } from "../types.js";
import { createSupportTicketApi, fetchSupportTicketsApi, addSupportTicketMessageApi, subscribeToSupportTickets } from "../lib/firebaseServices.js";

interface CustomerSupportProps {
  currentUser: User | null;
  lang: string;
  theme?: string;
}

const CATEGORY_OPTIONS: { id: SupportCategory; en: string; ar: string; fr: string; icon: any }[] = [
  { id: "Technical Problem", en: "Technical Issue", ar: "مشكلة فنية في المنصة", fr: "Problème technique", icon: LifeBuoy },
  { id: "Account Problem", en: "Account & Access", ar: "الحساب واستعادة الدخول", fr: "Compte et accès", icon: Lock },
  { id: "Verification Issue", en: "Email & OTP Verification", ar: "توثيق البريد الإلكتروني ورمز OTP", fr: "Vérification e-mail / OTP", icon: ShieldCheck },
  { id: "Billing Issue", en: "Billing & Subscriptions", ar: "الفواتير والاشتراكات", fr: "Facturation et abonnements", icon: FileText },
  { id: "Feature Request", en: "Feature Request", ar: "طلب ميزة جديدة", fr: "Demande de fonctionnalité", icon: Sparkles },
  { id: "Suggestion", en: "Bug Report & Feedback", ar: "الإبلاغ عن خلل أو ثغرة", fr: "Rapport de bug", icon: AlertTriangle },
  { id: "Other", en: "General Inquiry", ar: "استفسار آخر", fr: "Autre demande", icon: HelpCircle },
];

const FAQS = [
  {
    id: "faq_1",
    cat: "Verification",
    qEn: "How do I verify my account and activate full access?",
    qAr: "كيف أقوم بتوثيق حسابي في منصة ذاكر وتفعيله بالكامل؟",
    qFr: "Comment vérifier mon compte Zakir ?",
    aEn: "Upon registering, a 6-digit dynamic verification code is sent to your email or phone number. Enter the code in the verification screen to activate your account instantly. You can also upload enterprise commercial documents under Settings > Account Verification.",
    aAr: "عند إنشاء الحساب، يتم إرسال رمز توثيق ديناميكي مكون من 6 أرقام إلى بريدك الإلكتروني أو هاتفك. أدخل الرمز في شاشة التوثيق لتفعيل الحساب فوراً. كما يمكنك رفع السجل التجاري والوثائق المؤسسية في الإعدادات > توثيق الحساب.",
    aFr: "Lors de votre inscription, un code à 6 chiffres est envoyé par e-mail ou téléphone. Saisissez-le pour activer votre compte. Vous pouvez aussi charger vos documents d'entreprise dans Paramètres > Vérification."
  },
  {
    id: "faq_2",
    cat: "Access",
    qEn: "What should I do if I don't receive the verification OTP code?",
    qAr: "ماذا أفعل إذا لم يصلني رمز التوثيق (OTP) عبر البريد؟",
    qFr: "Que faire si je ne reçois pas le code OTP ?",
    aEn: "Check your spam/junk folder. If it hasn't arrived within 2 minutes, click 'Resend Code' on the verification screen. Alternatively, click 'Verification Help' above to send a direct manual verification request to our compliance team.",
    aAr: "يرجى التحقق من مجلد الرسائل غير المرغوب فيها (Spam). إذا لم يصل الرمز خلال دقيقتين، انقر على 'إعادة إرسال الرمز'. يمكنك أيضاً استخدام تبويب 'مساعدة التوثيق' أعلاه لإرسال طلب توثيق يدوي عاجل لفريق الامتثال.",
    aFr: "Vérifiez votre dossier spams. Si le code n'arrive pas en 2 minutes, cliquez sur 'Renvoyer le code' ou ouvrez une demande via l'onglet 'Aide à la vérification'."
  },
  {
    id: "faq_3",
    cat: "Account",
    qEn: "How do I reset my password if I forget it?",
    qAr: "كيف يمكنني إعادة تعيين كلمة المرور في حال نسيانها؟",
    qFr: "Comment réinitialiser mon mot de passe ?",
    aEn: "Click 'Forgot Password' on the login screen, enter your registered email, and validate the 6-digit verification code sent to your inbox to create a new password.",
    aAr: "انقر على 'نسيت كلمة المرور' في شاشة الدخول، وأدخل بريدك الإلكتروني المسجل. استخدم رمز التحقق المكون من 6 أرقام لإدخال كلمة مرور جديدة وآمنة.",
    aFr: "Cliquez sur 'Mot de passe oublié' sur la page de connexion, entrez votre e-mail et utilisez le code à 6 chiffres reçu pour définir un nouveau mot de passe."
  },
  {
    id: "faq_4",
    cat: "Support",
    qEn: "What is the expected support response time?",
    qAr: "ما هي السرعة المتوقعة لاستجابة فريق الدعم؟",
    qFr: "Quel est le délai de réponse du support ?",
    aEn: "Our enterprise compliance & technical team responds to High/Urgent tickets within 15–30 minutes, and general requests within 2–4 business hours.",
    aAr: "يجيب فريق الدعم والامتثال المؤسسي على التذاكر ذات الأولوية العالية والعاجلة خلال 15-30 دقيقة، والاستفسارات العامة خلال 2-4 ساعات عمل.",
    aFr: "Notre équipe répond aux tickets urgents en 15 à 30 minutes, et aux demandes générales en 2 à 4 heures."
  },
  {
    id: "faq_5",
    cat: "Security",
    qEn: "How is my enterprise data protected on Zakir?",
    qAr: "كيف يتم حماية بيانات المؤسسة والملفات على منصة ذاكر؟",
    qFr: "Comment mes données sont-elles protégées ?",
    aEn: "Zakir employs AES-256 end-to-end data encryption, strict RBAC workspace isolation, and isolated server-side security policies backed by Firebase Admin & Cloud SQL.",
    aAr: "تعتمد منصة ذاكر على تشفير AES-256 للبيانات، وعزل تام لمساحات العمل بين المؤسسات، وسياسات أمان صارمة محمية بواسطة خوادم Firebase Admin و Cloud SQL.",
    aFr: "Zakir utilise un chiffrement AES-256, une isolation stricte des espaces de travail et des règles de sécurité Firebase Admin & Cloud SQL."
  }
];

const DOCUMENTATION_GUIDES = [
  {
    id: "guide_workspace_setup",
    titleAr: "دليل إعداد مساحة العمل والشركة للرئيس التنفيذي",
    titleEn: "CEO Workspace & Enterprise Setup Guide",
    categoryAr: "إدارة النظام ومساحة العمل",
    categoryEn: "Workspace Management",
    icon: Building,
    badgeColor: "bg-[#0075DE]/10 text-[#0075DE] border-[#0075DE]/20",
    readTimeAr: "قراءة 4 دقائق",
    readTimeEn: "4 min read",
    summaryAr: "دليل شامل لكيفية ضبط إعدادات المؤسسة، إضافة اسم الشركة، اختيار العملة الرئيسية (SAR, MAD, MRU, USD)، وإدارة ملف التعريف الخاص بك.",
    summaryEn: "Comprehensive guide to configuring enterprise settings, company name, primary currency (SAR, MAD, MRU, USD), and executive profile.",
    sectionsAr: [
      {
        title: "1. ضبط معلومات المؤسسة والعملة الرئيسية",
        body: "قم بالانتقال إلى الإعدادات > الملف الشخصي والمؤسسة. يمكنك تعديل اسم الشركة، شعار المؤسسة، واختيار العملة الأساسية (الريال السعودي SAR، الدرهم المغربي MAD، الأوقية الموريتانية MRU، أو الدولار الأمريكي USD). تنعكس العملة تلقائياً في كافة التداولات والفواتير."
      },
      {
        title: "2. تعيين المسمى الوظيفي والدور القيادي (CEO)",
        body: "المنشئ الأول لمساحة العمل يحصل تلقائياً على رتبة المدير التنفيذي (CEO)، مما يتيح له الصلاحية المطلقة لإدارة الفريق، الاطلاع على تقارير البنك الدولي، وتعيين الرمز السري للشفافية والتشفير."
      },
      {
        title: "3. المزامنة والربط اللحظي السحابي",
        body: "تتيح المنصة المزامنة اللحظية بين جميع أجهزة القيادة والموظفين عبر خوادم Firebase المشفرة، مع وجود وضع تخزين محلي احتياطي يعمل تلقائياً عند انقطاع الاتصال."
      }
    ],
    sectionsEn: [
      {
        title: "1. Enterprise Info & Currency Configuration",
        body: "Navigate to Settings > Profile Details. You can edit the company name, logo URL, and primary currency (SAR, MAD, MRU, USD, EUR). The selected currency automatically reflects across all transactions, invoices, and analytics."
      },
      {
        title: "2. Executive Role (CEO) Ownership",
        body: "The workspace creator receives full CEO administrative authority, granting complete governance over team invitation controls, World Bank intelligence, and secret passcode vault encryption."
      },
      {
        title: "3. Real-time Cloud Synchronization",
        body: "Zakir synchronizes operational state instantly across executive devices with automated local storage backup during offline network state."
      }
    ]
  },
  {
    id: "guide_encryption_vault",
    titleAr: "دليل الخزنة المشفّرة والرمز السري (AES-256 Vault)",
    titleEn: "AES-256 Encrypted Vault & Passcode Manual",
    categoryAr: "الأمان والتشفير العالي",
    categoryEn: "Security & Encryption",
    icon: ShieldCheck,
    badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    readTimeAr: "قراءة 3 دقائق",
    readTimeEn: "3 min read",
    summaryAr: "كيفية حماية الملفات السرية، المستندات المكونة للذاكرة المؤسسية، وإقفال الأقسام الحساسة برمز PIN الفائق الخاص بالقيادة.",
    summaryEn: "How to protect sensitive enterprise files, executive memory records, and lock sensitive modules using CEO Passcode PIN.",
    sectionsAr: [
      {
        title: "1. آلية التشفير القياسي AES-256",
        body: "يتم تشفير كافة الملفات والذاكرة الحساسة قبل حفظها في قاعدة البيانات باستعمال مفاتيح تشفير محميّة. لا يمكن لأي طرف خارجي أو مستخدم غير مصرّح قراءة المحتوى التنافسي للشركة."
      },
      {
        title: "2. تعيين واختبار الرمز السري (Passcode)",
        body: "في تبويب 'كلمة المرور والأمان'، يمكنك تفعيل قفل الرمز السري للمدير التنفيذي. عند القفل، يتطلب فتح أقسام مثل الرادار التكتيكي، والذاكرة المؤسسية إدخال الرمز الصحيح."
      },
      {
        title: "3. إدارة التشفير الشامل والاستعادة الطارئة",
        body: "في حال نسيان الرمز السري، يتوفر زر استعادة الأمان عبر البريد الموثق، أو التواصل المباشر مع فريق الامتثال التقني من تبويب الدعم."
      }
    ],
    sectionsEn: [
      {
        title: "1. AES-256 Zero-Trust Encryption Mechanism",
        body: "All enterprise documents and strategic memory items are encrypted prior to database persistence using secure encryption keys. Unauthorized users cannot inspect competitive firm data."
      },
      {
        title: "2. Setting & Testing CEO Passcode PIN",
        body: "Under Settings > Password & Security, enable the Executive Passcode Lock. When active, opening protected areas such as Risk Radar and Corporate Memory requires PIN authentication."
      },
      {
        title: "3. Passcode Recovery & Emergency Unlock",
        body: "If the master PIN is misplaced, execute recovery verification via verified admin email or request direct emergency compliance assistance."
      }
    ]
  },
  {
    id: "guide_team_permissions",
    titleAr: "دليل إدارة الفريق والدعوات وصلاحيات الأقسام",
    titleEn: "Team Workspace & Permission Matrix Guide",
    categoryAr: "إدارة الفريق والأعضاء",
    categoryEn: "Team & Access Control",
    icon: UserIcon,
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    readTimeAr: "قراءة 5 دقائق",
    readTimeEn: "5 min read",
    summaryAr: "خطوات إرسال دعوات انضمام عمال وموظفي الشركة، وتعديل صلاحيات الوصول لكل قسم بشكل مستقل وبشكل آمن.",
    summaryEn: "Step-by-step instructions for issuing worker invitations, assigning user roles, and managing individual module powers.",
    sectionsAr: [
      {
        title: "1. إرسال دعوة انضمام موظف جديد",
        body: "انتقل إلى الإعدادات > الفريق وإدارة العمال. أدخل البريد الإلكتروني للموظف واختر الدور المبدئي (عضو Member أو مدير). سيتم توليد رابط دعوة ورقم مرجعي بحالة PENDING."
      },
      {
        title: "2. قبول الدعوة وتفعيل العضوية",
        body: "عندما يقبل الموظف المدعو الدعوة برقم الدعوة المرجعي والبريد المطابق، يتم نقله تلقائياً إلى مساحة عمل الشركة بحالة ACCEPTED وتظهر بياناته في القائمة الحية."
      },
      {
        title: "3. تعديل صلاحيات الموظفين (Drafting & Save)",
        body: "انقر على 'تعديل الصلاحيات' أمام أي عضو لمشاهدة شبكة الصلاحيات (خزنة الملفات، رادار المخاطر، مؤشرات البنك الدولي). التغييرات تبدأ كمسودة محلياً، وتصبح سارية فور النقر على 'حفظ الصلاحيات'."
      }
    ],
    sectionsEn: [
      {
        title: "1. Sending New Member Invitation",
        body: "Go to Settings > Workspace Team & Workers. Enter the worker email and select initial role. The invitation is created with status PENDING and assigned a unique reference code."
      },
      {
        title: "2. Invitation Acceptance & Atomic Transition",
        body: "When the invited worker validates acceptance with matching email, status transitions atomically from PENDING to ACCEPTED, binding them to the corporate workspace."
      },
      {
        title: "3. Customizing Member Power Matrix (Draft & Save)",
        body: "Click 'Edit Permissions' on any member card to toggle module access (File Vault, Risk Radar, World Bank Intel). Toggles stay in draft state until 'Save Permissions' is executed."
      }
    ]
  },
  {
    id: "guide_stripe_subscriptions",
    titleAr: "دليل الاشتراكات والدفع الإلكتروني المدمج (Stripe)",
    titleEn: "Billing, Plans & Stripe Checkout Manual",
    categoryAr: "الاشتراكات والفواتير",
    categoryEn: "Subscriptions & Billing",
    icon: FileText,
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    readTimeAr: "قراءة 3 دقائق",
    readTimeEn: "3 min read",
    summaryAr: "دليل ترقية خطة الشركة، اختيار الاشتراك السنوي أو الشهري، واستخدام نافذة Stripe المدمجة بأمان فائق.",
    summaryEn: "Guide to upgrading workspace plans, choosing annual or monthly billing, and utilizing embedded Stripe checkout.",
    sectionsAr: [
      {
        title: "1. اختيار الباقة وتحديد دورة الفواتير",
        body: "في تبويب 'باقات الدفع والاشتراك'، يمكنك التبديل بين الدفع السنوي (بخصم 20%) والدفع الشهري، واختيار الباقة المناسبة لحجم أعمال الشركة (Starter, Professional, Enterprise)."
      },
      {
        title: "2. إتمام السداد عبر النافذة المدمجة (Embedded Checkout)",
        body: "عند اختيار الباقة والنقر على 'اشترك الآن'، تفتح نافذة Stripe المدمجة داخل المنصة دون الحاجة لمغادرة الموقع. أدخل بيانات بطاقة الدفع لتفعيل الخطة فوراً."
      },
      {
        title: "3. تحميل الطباعة والسجلات الرسمية",
        body: "يمكنك طباعة الفواتير الرسمية وسندات الاشتراك بأعلى جودة مع دعم الشعار والطباعة الرسمية للشركة."
      }
    ],
    sectionsEn: [
      {
        title: "1. Plan Selection & Billing Cycle Toggle",
        body: "Under Settings > Plans & Payment, toggle between annual (with 20% savings) and monthly billing, selecting the appropriate tier for your enterprise (Starter, Professional, Enterprise)."
      },
      {
        title: "2. Secure Payment via Embedded Stripe Checkout",
        body: "Click 'Upgrade Now' to open the secure inline Stripe Checkout modal without leaving the app. Enter card details to immediately activate your upgraded subscription."
      },
      {
        title: "3. Official Invoice Printing & Records",
        body: "Print official PDF/paper receipts complete with corporate header, VAT details, and localized signature fields."
      }
    ]
  },
  {
    id: "guide_worldbank_intel",
    titleAr: "دليل بوابة البنك الدولي ومحلل المخاطر التكتيكي",
    titleEn: "World Bank Portal & Tactical Risk Radar Guide",
    categoryAr: "الذكاء الاقتصادي والتحليل",
    categoryEn: "Economic Intelligence",
    icon: Sparkles,
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    readTimeAr: "قراءة 4 دقائق",
    readTimeEn: "4 min read",
    summaryAr: "كيفية قراءة المؤشرات الاقتصادية المباشرة للدول، استعلام معدلات التضخم والنمو، وتحليل المخاطر اللوجستية.",
    summaryEn: "How to interpret real-time country economic metrics, query inflation/GDP trends, and generate strategic risk assessments.",
    sectionsAr: [
      {
        title: "1. الاستعلام المباشر عن اقتصاد الدول",
        body: "تتيح بوابة البنك الدولي البحث والتحليل لأكثر من 180 دولة. يمكنك اختيار الدولة (مثل المملكة العربية السعودية، المغرب، موريتانيا) لعرض الناتج المحلي، معدل التضخم، وسعر الصرف المحدث."
      },
      {
        title: "2. رادار المخاطر والإنذار المبكر (Risk Radar)",
        body: "يقوم رادار المخاطر بتحليل المؤشرات المالية والتشغيلية للشركة وربطها بالظروف الاقتصادية الكلية، وتنبيه القيادة حول المخاطر اللوجستية أو المباشرة."
      },
      {
        title: "3. تصدير التقارير وتحليلات الذكاء الاصطناعي",
        body: "يمكنك تحويل المؤشرات إلى ملخصات ذكية وتصديرها مباشرة لاجتماعات مجلس الإدارة والشركاء."
      }
    ],
    sectionsEn: [
      {
        title: "1. Live World Bank Indicator Queries",
        body: "The World Bank module enables data retrieval for over 180 economies. Select a nation (e.g. Saudi Arabia, Morocco, Mauritania) to analyze real-time GDP, inflation, and trade balances."
      },
      {
        title: "2. Tactical Risk Radar & Early Warning",
        body: "Risk Radar correlates operational enterprise metrics with macroeconomic conditions, flagging supply-chain, inflation, or liquidity risks automatically."
      },
      {
        title: "3. Exporting Strategic Executive Briefs",
        body: "Convert raw economic data into synthesized AI briefs ready for board meetings and stakeholder presentations."
      }
    ]
  }
];

export const CustomerSupport: React.FC<CustomerSupportProps> = ({ currentUser, lang, theme = "dark" }) => {
  const [activeTab, setActiveTab] = useState<"docs" | "tickets" | "new" | "verification_help" | "faqs">("docs");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Documentation tab state
  const [docSearch, setDocSearch] = useState("");
  const [docCategoryFilter, setDocCategoryFilter] = useState("All");
  const [selectedDoc, setSelectedDoc] = useState<typeof DOCUMENTATION_GUIDES[0] | null>(null);

  // New Ticket Form State
  const [category, setCategory] = useState<SupportCategory>("Technical Problem");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<SupportPriority>("Medium");
  const [contactEmail, setContactEmail] = useState(currentUser?.email || "");
  const [contactPhone, setContactPhone] = useState(currentUser?.phone || "");
  const [companyNameInput, setCompanyNameInput] = useState(currentUser?.companyName || "");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState("");
  const [submitErrorMsg, setSubmitErrorMsg] = useState("");

  // Reply Form State
  const [replyMessage, setReplyMessage] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [faqSearch, setFaqSearch] = useState("");
  const [openFaqId, setOpenFaqId] = useState<string | null>("faq_1");

  useEffect(() => {
    if (currentUser?.email) setContactEmail(currentUser.email);
    if (currentUser?.phone) setContactPhone(currentUser.phone);
    if (currentUser?.companyName) setCompanyNameInput(currentUser.companyName);
  }, [currentUser]);

  // Load tickets on mount & subscribe to live updates
  const loadTickets = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoadingTickets(true);
    setFetchError("");

    const uId = currentUser?.id || localStorage.getItem("zakir_user_id") || "";
    const uEmail = currentUser?.email || localStorage.getItem("zakir_user_email") || "";

    try {
      const data = await fetchSupportTicketsApi(uId, uEmail, false);
      setTickets(data);
      if (data && data.length > 0) {
        if (!selectedTicket) {
          setSelectedTicket(data[0]);
        } else {
          const fresh = data.find(t => t.id === selectedTicket.id);
          if (fresh) setSelectedTicket(fresh);
        }
      }
    } catch (err: any) {
      console.warn("Failed to fetch support tickets:", err);
      setFetchError(
        lang === "ar" 
          ? "تعذر الاتصال بمركز الدعم الفني مباشرة. جاري العمل بالوضع المحلي الاحتياطي."
          : "Could not connect to support service directly. Using local backup mode."
      );
    } finally {
      setIsLoadingTickets(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadTickets();

    const uId = currentUser?.id || localStorage.getItem("zakir_user_id") || "";
    const unsubscribe = subscribeToSupportTickets(uId, false, (updatedTickets) => {
      if (updatedTickets && updatedTickets.length > 0) {
        setTickets(updatedTickets);
        setSelectedTicket(prev => {
          if (!prev) return updatedTickets[0];
          const match = updatedTickets.find(t => t.id === prev.id);
          return match || prev;
        });
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedTicket?.messages]);

  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setSubmitErrorMsg(
        lang === "ar" 
          ? "يرجى كتابة عنوان الموضوع وتفاصيل الطلب." 
          : "Please provide both a subject and message details."
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitErrorMsg("");
    setSubmitSuccessMsg("");

    const resolvedUserId = currentUser?.id || localStorage.getItem("zakir_user_id") || `usr_guest_${Date.now()}`;
    const resolvedEmail = contactEmail.trim() || currentUser?.email || localStorage.getItem("zakir_user_email") || "user@zakir.ai";

    try {
      const createdTicket = await createSupportTicketApi({
        userId: resolvedUserId,
        userEmail: resolvedEmail,
        userName: currentUser?.ownerName || currentUser?.companyName || resolvedEmail.split("@")[0],
        userPhone: contactPhone.trim(),
        companyName: companyNameInput.trim() || currentUser?.companyName || "",
        category,
        subject: subject.trim(),
        message: message.trim(),
        priority
      });

      setSubmitSuccessMsg(
        lang === "ar"
          ? `تم تقديم طلبك بنجاح! رقم التذكرة: #${createdTicket.id}. سيرد عليك فريق الدعم والامتثال في أسرع وقت.`
          : lang === "fr"
          ? `Votre demande a été soumise avec succès! Ticket #${createdTicket.id}.`
          : `Your request was submitted successfully! Ticket #${createdTicket.id}.`
      );

      // Reset form
      setSubject("");
      setMessage("");
      setPriority("Medium");
      setAttachments([]);

      // Reload tickets & focus new ticket
      await loadTickets();
      setSelectedTicket(createdTicket);

      setTimeout(() => {
        setActiveTab("tickets");
        setSubmitSuccessMsg("");
      }, 1200);

    } catch (err: any) {
      setSubmitErrorMsg(err.message || (lang === "ar" ? "تعذر تقديم طلب الدعم حالياً." : "Failed to create support ticket."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    setIsSubmittingReply(true);
    try {
      const resolvedName = currentUser?.ownerName || currentUser?.companyName || "Zakir User";
      const resolvedEmail = currentUser?.email || contactEmail || "user@zakir.ai";

      await addSupportTicketMessageApi(selectedTicket.id, {
        senderType: "user",
        senderName: resolvedName,
        senderEmail: resolvedEmail,
        message: replyMessage.trim()
      });

      setReplyMessage("");
      await loadTickets();
    } catch (err: any) {
      console.error("Failed to send support reply:", err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Quick preset trigger for verification & account recovery
  const triggerPresetRequest = (presetCategory: SupportCategory, presetSubject: string, presetMessage: string) => {
    setCategory(presetCategory);
    setSubject(presetSubject);
    setMessage(presetMessage);
    setPriority("High");
    setActiveTab("new");
  };

  const filteredTickets = tickets.filter(t => {
    const matchesStatus = statusFilter === "All" || t.status === statusFilter;
    const matchesSearch = !searchQuery.trim() || 
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredFaqs = FAQS.filter(faq => {
    if (!faqSearch.trim()) return true;
    const term = faqSearch.toLowerCase();
    return (
      faq.qEn.toLowerCase().includes(term) ||
      faq.qAr.toLowerCase().includes(term) ||
      faq.aEn.toLowerCase().includes(term) ||
      faq.aAr.toLowerCase().includes(term)
    );
  });

  const filteredDocs = DOCUMENTATION_GUIDES.filter(doc => {
    const matchesCat = docCategoryFilter === "All" || doc.categoryAr === docCategoryFilter || doc.categoryEn === docCategoryFilter;
    if (!docSearch.trim()) return matchesCat;
    const term = docSearch.toLowerCase();
    return matchesCat && (
      doc.titleAr.toLowerCase().includes(term) ||
      doc.titleEn.toLowerCase().includes(term) ||
      doc.summaryAr.toLowerCase().includes(term) ||
      doc.summaryEn.toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status: SupportStatus) => {
    switch (status) {
      case "Open":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/20">
            <Clock className="w-3 h-3" />
            {lang === "ar" ? "مفتوحة" : "Open"}
          </span>
        );
      case "In Progress":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <RefreshCw className="w-3 h-3 animate-spin-slow" />
            {lang === "ar" ? "قيد المتابعة" : "In Progress"}
          </span>
        );
      case "Waiting for User":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <AlertCircle className="w-3 h-3" />
            {lang === "ar" ? "بانتظار إجابتك" : "Waiting for You"}
          </span>
        );
      case "Resolved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            {lang === "ar" ? "تم الحل" : "Resolved"}
          </span>
        );
      case "Closed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <CheckCircle className="w-3 h-3" />
            {lang === "ar" ? "مغلقة" : "Closed"}
          </span>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: SupportPriority) => {
    switch (priority) {
      case "Urgent":
        return <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 animate-pulse">{lang === "ar" ? "عاجل جداً" : "Urgent"}</span>;
      case "High":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30">{lang === "ar" ? "أولوية عالية" : "High"}</span>;
      case "Medium":
      case "Normal":
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/20">{lang === "ar" ? "متوسطة" : "Medium"}</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-normal bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400">{lang === "ar" ? "عادية" : "Low"}</span>;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 text-slate-900 dark:text-slate-100">
      
      {/* INSTITUTIONAL HEADER & LIVE STATUS BANNER */}
      <div className={`relative overflow-hidden rounded-2xl border ${theme === "dark" ? "bg-slate-900/90 border-slate-800" : "bg-white border-slate-200 shadow-sm"} p-4 md:p-5 transition-all`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/20 shadow-inner">
                <LifeBuoy className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base md:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    {lang === "ar" ? "مركز التوثيق والدعم الفني" : "Documentation & Technical Support"}
                  </h1>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                    v2.5
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === "ar" 
                    ? "أدلة تشغيل المنصة الشاملة، مع خدمة المساعدة المباشرة والتذاكر الفنية على مدار الساعة." 
                    : "Platform guides, user manuals, and 24/7 technical assistance."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 dark:bg-slate-950/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-2 text-xs px-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                {lang === "ar" ? "الأنظمة تعمل بكفاءة" : "Systems Operational"}
              </span>
            </div>

            <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

            <button 
              onClick={() => loadTickets(true)} 
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] text-[#0075DE] font-semibold transition-colors cursor-pointer"
              title={lang === "ar" ? "تحديث التذاكر" : "Refresh Tickets"}
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{lang === "ar" ? "تحديث" : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS BAR */}
        <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("docs")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "docs"
                ? "bg-[#0075DE] text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{lang === "ar" ? "التوثيق ودليل الاستخدام" : "Documentation"}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              activeTab === "docs" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            }`}>
              {DOCUMENTATION_GUIDES.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("tickets")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "tickets"
                ? "bg-[#0075DE] text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{lang === "ar" ? "تذاكري والمحادثات" : "Support Tickets"}</span>
            {tickets.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeTab === "tickets" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              }`}>
                {tickets.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("new")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "new"
                ? "bg-[#0075DE] text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{lang === "ar" ? "إنشاء طلب جديد" : "New Ticket"}</span>
          </button>

          <button
            onClick={() => setActiveTab("verification_help")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "verification_help"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{lang === "ar" ? "مساعدة التوثيق" : "Verification Help"}</span>
          </button>

          <button
            onClick={() => setActiveTab("faqs")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "faqs"
                ? "bg-[#0075DE] text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{lang === "ar" ? "الأسئلة الشائعة" : "FAQs"}</span>
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button 
            onClick={() => loadTickets(true)}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold transition-colors shrink-0"
          >
            {lang === "ar" ? "إعادة المحاولة" : "Retry"}
          </button>
        </div>
      )}

      {/* TAB 0: DOCUMENTATION & SYSTEM MANUALS (التوثيق ودليل المنصة) */}
      {activeTab === "docs" && (
        <div className="space-y-4">
          
          {/* SEARCH & CATEGORY FILTER HEADER */}
          <div className={`p-4 rounded-xl border ${theme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"} space-y-3`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#0075DE]" />
                  <span>{lang === "ar" ? "أدلة تشغيل المنصة" : "Platform Manuals & Guides"}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === "ar"
                    ? "اختر أحد الأدلة أدناه لمطالعة الشرح التفصيلي للتحكم بخصائص ذاكر."
                    : "Select a manual below to view step-by-step documentation."}
                </p>
              </div>

              {/* SEARCH INPUT */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder={lang === "ar" ? "البحث في الأدلة..." : "Search manuals..."}
                  className={`w-full pr-8 pl-3 py-1.5 text-xs border rounded-lg ${
                    theme === "dark" 
                      ? "bg-slate-950 border-slate-800 text-white placeholder-slate-500" 
                      : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                  } focus:outline-none focus:border-[#0075DE]`}
                />
              </div>
            </div>

            {/* CATEGORY CHIPS */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-200 dark:border-slate-800/60">
              {["All", "إدارة النظام ومساحة العمل", "الأمان والتشفير العالي", "إدارة الفريق والأعضاء", "الاشتراكات والفواتير", "الذكاء الاقتصادي والتحليل"].map((cat) => {
                const isSel = docCategoryFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setDocCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      isSel
                        ? "bg-[#0075DE] text-white shadow-sm"
                        : theme === "dark"
                        ? "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                        : "bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200"
                    }`}
                  >
                    {cat === "All" ? (lang === "ar" ? "جميع الأدلة" : "All Manuals") : cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* GUIDES GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => {
              const IconComp = doc.icon;
              return (
                <div
                  key={doc.id}
                  className={`group relative p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                    theme === "dark"
                      ? "bg-slate-900/80 border-slate-800 hover:border-[#0075DE]/50 hover:bg-slate-900/90 shadow-sm"
                      : "bg-white border-slate-200 hover:border-[#0075DE]/50 hover:shadow-md shadow-sm"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${doc.badgeColor}`}>
                        {lang === "ar" ? doc.categoryAr : doc.categoryEn}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {lang === "ar" ? doc.readTimeAr : doc.readTimeEn}
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5 pt-1">
                      <div className="p-2 rounded-lg bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/20 group-hover:scale-105 transition-transform shrink-0">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#0075DE] transition-colors leading-snug">
                          {lang === "ar" ? doc.titleAr : doc.titleEn}
                        </h3>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {lang === "ar" ? doc.summaryAr : doc.summaryEn}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="w-full py-1.5 px-3 rounded-lg bg-[#0075DE]/10 hover:bg-[#0075DE] text-[#0075DE] hover:text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>{lang === "ar" ? "اقرأ الدليل الكامل" : "Read Full Manual"}</span>
                      <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* FULL INTERACTIVE DOCUMENTATION READER MODAL */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className={`w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border p-5 sm:p-6 space-y-5 shadow-2xl ${
            theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
          }`}>
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/20">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${selectedDoc.badgeColor}`}>
                    {lang === "ar" ? selectedDoc.categoryAr : selectedDoc.categoryEn}
                  </span>
                  <h2 className="text-sm sm:text-base font-bold mt-1 text-slate-900 dark:text-white">
                    {lang === "ar" ? selectedDoc.titleAr : selectedDoc.titleEn}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SECTIONS LIST */}
            <div className="space-y-4">
              {(lang === "ar" ? selectedDoc.sectionsAr : selectedDoc.sectionsEn).map((sec, idx) => (
                <div key={idx} className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1.5">
                  <h3 className="text-xs font-bold text-[#0075DE] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0075DE]"></span>
                    {sec.title}
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pl-3 rtl:pr-3">
                    {sec.body}
                  </p>
                </div>
              ))}
            </div>

            {/* MODAL FOOTER */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                {lang === "ar" ? "هل تحتاج مساعدة إضافية حول هذا الدليل؟" : "Need further clarification on this guide?"}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedDoc(null);
                    setActiveTab("new");
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#0075DE] hover:bg-[#005BAB] text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{lang === "ar" ? "تواصل مع الدعم" : "Contact Support"}</span>
                </button>

                <button
                  onClick={() => setSelectedDoc(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  {lang === "ar" ? "إغلاق" : "Close"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: MY TICKETS & LIVE CHAT VIEW */}
      {activeTab === "tickets" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
          
          {/* LEFT COLUMN: TICKET LIST */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col h-[650px]">
            <div className="space-y-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0075DE]" />
                  <span>{lang === "ar" ? "سجل طلبات الدعم" : "Ticket Log"}</span>
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">({filteredTickets.length})</span>
              </div>

              {/* SEARCH & STATUS FILTER */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === "ar" ? "البحث برقم التذكرة أو الموضوع..." : "Search tickets..."}
                    className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#0075DE]"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {["All", "Open", "In Progress", "Waiting for User", "Resolved"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        statusFilter === st
                          ? "bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/30"
                          : "bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      {st === "All" ? (lang === "ar" ? "الكل" : "All") : st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* TICKETS SCROLLABLE LIST */}
            <div className="flex-1 overflow-y-auto space-y-2.5 mt-3 pr-1">
              {isLoadingTickets ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#0075DE]" />
                  <span>{lang === "ar" ? "جاري جلب التذاكر..." : "Loading tickets..."}</span>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 text-center p-6 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <MessageSquare className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-2" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {lang === "ar" ? "لا توجد تذاكر دعم مسجلة" : "No support tickets found"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {lang === "ar" ? "يمكنك إنشاء طلب دعم جديد وسيقوم الفريق بالرد فوراً." : "Create a new ticket to get help from our team."}
                  </p>
                  <button
                    onClick={() => setActiveTab("new")}
                    className="mt-4 px-3.5 py-1.5 rounded-lg bg-[#0075DE] hover:bg-[#005BAB] text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    {lang === "ar" ? "إنشاء تذكرة الآن" : "Create Ticket"}
                  </button>
                </div>
              ) : (
                filteredTickets.map((ticket) => {
                  const isSelected = selectedTicket?.id === ticket.id;
                  return (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-blue-50 dark:bg-slate-800/90 border-[#0075DE]/50 shadow-md"
                          : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-mono text-[11px] font-bold text-[#0075DE]">
                          #{ticket.id}
                        </span>
                        {getStatusBadge(ticket.status)}
                      </div>

                      <h3 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 mb-1">
                        {ticket.subject}
                      </h3>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                        <span className="truncate max-w-[130px]">
                          {ticket.category}
                        </span>
                        <span className="font-mono text-[10px]">
                          {safeFormatDate(ticket.updatedAt || ticket.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: ACTIVE TICKET CHAT & THREAD DETAILS */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-[650px] overflow-hidden">
            {selectedTicket ? (
              <>
                {/* CHAT HEADER */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#0075DE]">
                        #{selectedTicket.id}
                      </span>
                      {getStatusBadge(selectedTicket.status)}
                      {getPriorityBadge(selectedTicket.priority)}
                    </div>
                    <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-white">
                      {selectedTicket.subject}
                    </h2>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>{selectedTicket.category}</span>
                      <span>•</span>
                      <span>{safeFormatDateTime(selectedTicket.createdAt)}</span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right text-xs space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 dark:border-slate-800">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{selectedTicket.userName || selectedTicket.userEmail}</p>
                    <p className="text-[11px] text-slate-500">{selectedTicket.companyName || selectedTicket.userEmail}</p>
                  </div>
                </div>

                {/* CHAT MESSAGES STREAM */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-100/30 dark:bg-slate-950/40">
                  {/* ORIGINAL TICKET DESCRIPTION */}
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-[#0075DE]" />
                        {selectedTicket.userName || "صاحب التذكرة"}
                      </span>
                      <span className="font-mono text-[10px]">{safeFormatDateTime(selectedTicket.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {selectedTicket.message}
                    </p>
                  </div>

                  {/* SUBSEQUENT MESSAGES */}
                  {selectedTicket.messages && selectedTicket.messages.map((msg, idx) => {
                    const isUser = msg.senderType === "user";
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span>{msg.senderName}</span>
                          <span>•</span>
                          <span className="font-mono">{safeFormatTime(msg.createdAt)}</span>
                        </div>
                        <div
                          className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                            isUser
                              ? "bg-[#0075DE] text-white rounded-br-none shadow-md"
                              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* REPLY INPUT FORM */}
                <form onSubmit={handleSendReply} className="p-3 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder={lang === "ar" ? "اكتب ردك هنا لتبادل المراسلات مع فريق الدعم..." : "Type your message response..."}
                    disabled={selectedTicket.status === "Closed"}
                    className="flex-1 px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#0075DE]"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingReply || !replyMessage.trim() || selectedTicket.status === "Closed"}
                    className="px-4 py-2.5 bg-[#0075DE] hover:bg-[#005BAB] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {isSubmittingReply ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                        <span>{lang === "ar" ? "إرسال الرد" : "Send Reply"}</span>
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-400">
                <LifeBuoy className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {lang === "ar" ? "حدد تذكرة لمشاهدة تفاصيل المراسلات" : "Select a ticket to view thread"}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {lang === "ar" ? "يمكنك الاستفسار ومتابعة جميع المحادثات المباشرة مع فريق الامتثال التقني." : "You can track and manage direct support communications here."}
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: CREATE NEW TICKET FORM */}
      {activeTab === "new" && (
        <div className={`p-4 md:p-5 rounded-xl border ${theme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"} max-w-3xl mx-auto space-y-4`}>
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-[#0075DE]" />
              <span>{lang === "ar" ? "إنشاء تذكرة دعم جديدة" : "Open New Support Ticket"}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === "ar" 
                ? "قم بتعبئة النموذج وسيقوم فريق الدعم الفني بمعالجة طلبك ببالغ الاهتمام."
                : "Fill in the ticket form below for quick assistance."}
            </p>
          </div>

          {submitSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="font-semibold">{submitSuccessMsg}</span>
            </div>
          )}

          {submitErrorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{submitErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateTicketSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "ar" ? "تصنيف المشكلة / الطلب:" : "Category:"}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportCategory)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-[#0075DE]"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {lang === "ar" ? c.ar : c.en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "ar" ? "مستوى الأولوية:" : "Priority Level:"}
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as SupportPriority)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-[#0075DE]"
                >
                  <option value="Low">{lang === "ar" ? "منخفضة (استفسار عام)" : "Low"}</option>
                  <option value="Medium">{lang === "ar" ? "متوسطة (طلب معتاد)" : "Medium"}</option>
                  <option value="High">{lang === "ar" ? "عالية (خلل يعيق العمل)" : "High"}</option>
                  <option value="Urgent">{lang === "ar" ? "عاجل جداً (توقف بالنظام)" : "Urgent"}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "ar" ? "البريد الإلكتروني للتواصل:" : "Contact Email:"}
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-[#0075DE]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "ar" ? "رقم الهاتف / الواتساب:" : "Contact Phone:"}
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+222 45 00 00 00"
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-[#0075DE]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === "ar" ? "عنوان الموضوع الرئيسي:" : "Subject Title:"}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={lang === "ar" ? "مثال: استفسار حول المزامنة أو توثيق البريد..." : "e.g., Query regarding synchronization or OTP..."}
                className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-[#0075DE]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === "ar" ? "تفاصيل الطلب أو الملاحظات:" : "Message Details:"}
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={lang === "ar" ? "اكتب هنا كافة المعلومات والتفاصيل المساعدة..." : "Provide detailed information here..."}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-[#0075DE]"
              ></textarea>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-[#0075DE] hover:bg-[#005BAB] text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                    <span>{lang === "ar" ? "تقديم الطلب الآن" : "Submit Request"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: VERIFICATION & ACCESS HELP */}
      {activeTab === "verification_help" && (
        <div className={`p-4 md:p-5 rounded-xl border ${theme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"} max-w-3xl mx-auto space-y-4`}>
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === "ar" ? "خدمة مساعدة التوثيق واستعادة Access" : "Verification & Account Access Help"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === "ar" 
                  ? "خيارات التفعيل السريع للشركات التي تواجه صعوبات في وصول رمز OTP البريدي" 
                  : "Quick activation channels for email OTP delays."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2.5">
              <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>{lang === "ar" ? "التوثيق اليدوي المباشر" : "Direct Manual Verification"}</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {lang === "ar"
                  ? "يمكنك إرسال طلب توثيق فوري بدون انتظار رمز OTP البريدي، وسيقوم مسؤول الامتثال بالتفعيل فوراً."
                  : "Request instant manual activation if you face email OTP delays."}
              </p>
              <button
                onClick={() => triggerPresetRequest("Verification Issue", "طلب توثيق تفعيل يدوي عاجل للحساب", "أواجه صعوبة في استقبال رمز OTP عبر البريد الإلكتروني، يرجى تفعيل حسابي يدوياً لمواصلة العمل.")}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                {lang === "ar" ? "طلب توثيق يدوي عاجل" : "Request Manual Verification"}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#0075DE]/5 border border-[#0075DE]/20 space-y-2.5">
              <h3 className="text-xs font-bold text-[#0075DE] flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#0075DE]" />
                <span>{lang === "ar" ? "استعادة كلمة المرور" : "Password Reset Assistance"}</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {lang === "ar"
                  ? "في حال فقدان كلمة المرور، يرجى تقديم طلب استعادة مخصص لمراجعة الهوية."
                  : "Submit an identity review ticket if credentials are lost."}
              </p>
              <button
                onClick={() => triggerPresetRequest("Account Problem", "طلب استعادة كلمة المرور للحساب المؤسسي", "نسيت كلمة المرور الخاصة بحسابي المؤسسي، يرجى تقديم المساعدة لإعادة التعيين.")}
                className="w-full py-2 rounded-lg bg-[#0075DE] hover:bg-[#005BAB] text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                {lang === "ar" ? "تقديم طلب استعادة الحساب" : "Submit Recovery Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FAQS & KNOWLEDGE BASE */}
      {activeTab === "faqs" && (
        <div className={`p-4 md:p-5 rounded-xl border ${theme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"} space-y-4`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-500" />
                <span>{lang === "ar" ? "الأسئلة الشائعة" : "Frequently Asked Questions"}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === "ar" ? "إجابات سريعة وموثوقة على أكثر الاستفسارات تكراراً في المنصة" : "Quick and verified answers to common system questions."}
              </p>
            </div>

            <div className="relative w-full md:w-56">
              <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder={lang === "ar" ? "ابحث في الأسئلة..." : "Search FAQs..."}
                className="w-full pr-8 pl-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            {filteredFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full p-3 text-right flex items-center justify-between gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {lang === "ar" ? faq.qAr : faq.qEn}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180 text-amber-500 dark:text-amber-400" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="p-3 pt-0 text-xs text-slate-700 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-800/50 bg-slate-100/50 dark:bg-slate-900/50">
                      {lang === "ar" ? faq.aAr : faq.aEn}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center space-y-1.5 mt-4">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
              {lang === "ar" ? "لم تجد إجابة لسؤالك؟" : "Didn't find an answer to your question?"}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              {lang === "ar" ? "فريق الدعم الفني جاهز للإجابة على جميع استفساراتك فوراً" : "Our support team is ready to assist you right now."}
            </p>
            <button
              onClick={() => setActiveTab("new")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors mt-1 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{lang === "ar" ? "إنشاء تذكرة دعم جديدة" : "Open a Support Ticket"}</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default CustomerSupport;
