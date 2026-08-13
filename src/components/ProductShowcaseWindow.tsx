import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  PlusCircle, 
  FileText, 
  Check, 
  CheckCircle, 
  AlertTriangle, 
  Lock, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  Search, 
  TrendingUp, 
  TrendingDown,
  Users,
  Brain, 
  Globe, 
  Activity, 
  MessageSquare, 
  Send, 
  Shield, 
  Play, 
  Pause, 
  RotateCcw, 
  Database,
  Printer,
  ChevronRight,
  GitCommit,
  HelpCircle,
  Eye,
  Settings,
  X,
  ShieldAlert,
  Compass,
  RefreshCw
} from "lucide-react";
import { ZakirLogo } from "./ZakirLogo";

// --- Types ---
type TabType = "add" | "library" | "agent" | "smart" | "market";

interface TimelineStep {
  type: "move" | "click" | "type" | "wait" | "action";
  target: string;
  text?: string;
  duration?: number;
  action?: () => void;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export const ProductShowcaseWindow: React.FC<{ lang?: "ar" | "en" | "fr" }> = ({ lang = "ar" }) => {
  // --- States ---
  const [activeTab, setActiveTab] = useState<TabType>("add");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [timelineIndex, setTimelineIndex] = useState<number>(0);
  
  // Cursor & Clicks
  const [cursorPos, setCursorPos] = useState({ x: 300, y: 250 });
  const [isClicking, setIsClicking] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  
  // Zoom & Perspective State
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [zoomOrigin, setZoomOrigin] = useState<string>("50% 50%");

  // Simulated Form State (Add Causal Memory View)
  const [formStep, setFormStep] = useState<number>(1);
  const [simulatedTitle, setSimulatedTitle] = useState<string>("");
  const [simulatedDesc, setSimulatedDesc] = useState<string>("");
  const [simulatedDecision, setSimulatedDecision] = useState<string>("");
  const [simulatedCausal, setSimulatedCausal] = useState<string>("");
  const [simulatedOutcomes, setSimulatedOutcomes] = useState<string>("");
  const [simulatedLessons, setSimulatedLessons] = useState<string>("");
  const [simulatedEncrypt, setSimulatedEncrypt] = useState<boolean>(false);
  const [showAddSuccess, setShowAddSuccess] = useState<boolean>(false);

  // Simulated Library View State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedMemoryId, setExpandedMemoryId] = useState<number | null>(null);
  const [passcodeModalOpen, setPasscodeModalOpen] = useState<boolean>(false);
  const [enteredPasscode, setEnteredPasscode] = useState<string>("");
  const [passcodeError, setPasscodeError] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  // Simulated Advisor State
  const [advisorInput, setAdvisorInput] = useState<string>("");
  const [advisorMessages, setAdvisorMessages] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    {
      sender: "ai",
      text: lang === "ar" 
        ? "مرحباً بك في المستشار الإدراكي لـ Zakir. أنا متصل بقاعدة بيانات PostgreSQL المؤسسية ومستعد للإجابة استناداً إلى سجل القرارات السابقة."
        : "Welcome to Zakir's Cognitive Advisor. I am connected directly to your PostgreSQL memory tables to resolve institutional queries."
    }
  ]);
  const [isAiTyping, setIsAiTyping] = useState<boolean>(false);

  // Simulated Market Intelligence State
  const [marketTopic, setMarketTopic] = useState<string>("");
  const [marketIndustry, setMarketIndustry] = useState<string>("Financial Services / Banking");
  const [isMarketAnalyzing, setIsMarketAnalyzing] = useState<boolean>(false);
  const [marketAnalysisResult, setMarketAnalysisResult] = useState<boolean>(false);

  // Simulated Smart Evolution State
  const [smartActiveTab, setSmartActiveTab] = useState<"predictions" | "recommendations" | "opportunities" | "risks">("predictions");
  const [smartAnalysisState, setSmartAnalysisState] = useState<"idle" | "analyzing" | "completed">("idle");

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Mock Databases / Memory Store ---
  const initialMemories = useMemo(() => [
    {
      id: 1,
      title: lang === "ar" ? "تأخير التصنيف الجمركي لصمامات الإغلاق في ميناء طنجة" : "Customs classification delay of valves in Tangier port",
      category: "Customs & Logistics",
      risk: "Critical",
      date: "2026-07-15",
      desc: lang === "ar" ? "تأخر تخليص الشحنة رقم #CN-9022 بسبب تصنيف جمركي خاطئ لقطع الغيار مما كلف 45 ألف دولار غرامات يومية." : "Shipment #CN-9022 delayed due to incorrect customs code, incurring $45,000 in daily storage penalties.",
      decision: lang === "ar" ? "دفع الرسوم تحت التحفظ وتحديث سجل رموز التعرفة الجمركية المعتمدة." : "Paid the penalties under protest and immediately updated the verified HTS code library.",
      causal: lang === "ar" ? "غياب دليل تصنيفي موحد معتمد لدى الإدارة اللوجستية وتغيير القوانين المحلية." : "Lack of standardized classification manual in local trade desk combined with sudden regulatory updates.",
      outcomes: lang === "ar" ? "خسارة مالية مباشرة قدرها 135,000 دولار وتحديث الدليل بنسبة 100%." : "Direct financial damage of $135,000, but resolved manual compliance to 100%.",
      lessons: lang === "ar" ? "يجب ربط أوامر الشراء المستقبلية برمز التعرفة الجمركية المسبق الموافقة وتجنب التخمينات الفردية." : "Enforce matching HTS codes in purchase orders prior to shipment dispatch. Avoid verbal estimations.",
      encrypted: false
    },
    {
      id: 2,
      title: lang === "ar" ? "تسريب بيانات اعتماد الخادم التجريبي نتيجة التصيد الإلكتروني" : "Phishing leak on cloud staging server database",
      category: "Cybersecurity & IT",
      risk: "High",
      date: "2026-06-10",
      desc: lang === "ar" ? "وصول غير مصرح به لقاعدة بيانات العملاء الافتراضية نتيجة سرقة بيانات اعتماد أحد مهندسي النظم عبر بريد تصيد احتيالي." : "Unauthorized access to non-production customer profiles staging database due to leaked API keys via a targeted phishing email.",
      decision: lang === "ar" ? "عزل الخادم المتأثر بالكامل وإلغاء صلاحيات جميع الرموز الأمنية المسرّبة مع تفعيل المصادقة الثنائية الإلزامية." : "Isolated the affected database instance, revoked all compromised developer tokens, and enforced mandatory hardware security keys.",
      causal: lang === "ar" ? "استخدام كلمات مرور مكررة ومشاركة مفاتيح الدخول الأمنية في قنوات الاتصال العامة دون تشفير." : "Use of shared credentials on test environments combined with lack of multi-factor authentication on staging subnets.",
      outcomes: lang === "ar" ? "تجميد الخدمات التطويرية لـ 48 ساعة وإعادة بناء وهيكلة خوادم التطوير أمنياً دون تسريب لبيانات الإنتاج الفعلية." : "Development services frozen for 48 hours to securely rebuild cloud infrastructure; no production client records were exposed.",
      lessons: lang === "ar" ? "حظر حفظ كلمات المرور أو الرموز البرمجية في القنوات البرمجية، واعتماد نظام حوكمة الدخول المؤقت والمدقق." : "Prohibit hardcoded API secrets in repositories and mandate ephemeral, fully audited session tokens for all team members.",
      encrypted: false
    },
    {
      id: 4,
      title: lang === "ar" ? "نزاع قانوني حول براءة اختراع صمامات التدفق مع منافس ألماني" : "Patent licensing infringement claim from German competitor",
      category: "Legal & IP",
      risk: "Medium",
      date: "2026-05-04",
      desc: lang === "ar" ? "استلام إخطار قانوني رسمي يزعم تعدي صمامات التدفق المغناطيسي المطورة حديثاً على براءة اختراع مسجلة لمنافس أوروبي." : "Official cease-and-desist letter received claiming our recently engineered flow-regulating nozzle infringes a competitor's patent.",
      decision: lang === "ar" ? "تعيين مكتب محاماة دولي متخصص لبدء مفاوضات ترخيص متبادل وتعديل طفيف للتصميم الهندسي الفرعي لتجنب التقاضي الطويل." : "Retained specialized patent counsel to initiate cross-licensing negotiations and modified the inner nozzle geometry to bypass design overlaps.",
      causal: lang === "ar" ? "البدء بالإنتاج التجاري دون استكمال تقرير براءات الاختراع والبحث الاستقصائي الاستباقي الشامل في الأسواق الدولية." : "Commencing full commercial tooling before finishing a comprehensive, proactive Freedom-to-Operate (FTO) patent landscape analysis.",
      outcomes: lang === "ar" ? "تأجيل تدشين خط الإنتاج لـ 4 أسابيع، والتوصل لاتفاق ترخيص مشترك يحمي تصاميمنا المستقبلية." : "Delayed assembly launch by 4 weeks, but secured a strong cross-licensing agreement covering key international markets.",
      lessons: lang === "ar" ? "ربط بوابات البحوث والتطوير الهندسية باعتماد فوري وتوقيع قانوني إلزامي لتقارير براءات الاختراع قبل بدء أي تصنيع." : "Enforce strict sign-offs from patent attorneys at the end of every engineering sprint before releasing blueprints to tooling.",
      encrypted: false
    },
    {
      id: 5,
      title: lang === "ar" ? "إفلاس المورد الوحيد لسبائك النيكل الخاصة بصمامات الضغط العالي" : "Single-source nickel alloy supplier bankruptcy",
      category: "Supply Chain & Sourcing",
      risk: "High",
      date: "2026-04-12",
      desc: lang === "ar" ? "الإعلان المفاجئ لإفلاس وتصفية مصهر المعادن المتكامل بالنمسا المسؤول عن توريد سبائك النيكل المقاومة للتآكل." : "Sudden financial insolvency and liquidation of our sole Austrian supplier for specialized corrosion-resistant nickel alloys.",
      decision: lang === "ar" ? "تفعيل بروتوكول الطوارئ للشراء والتعاقد السريع مع مصهرين بديلين باليابان والولايات المتحدة للحصول على عينات عاجلة لفحص الجودة." : "Triggered emergency supply protocols, securing expedited nickel alloy sample batches from verified Japanese and US foundries.",
      causal: lang === "ar" ? "الاعتماد الاستراتيجي الكلي على شريك توريد مفرد سعياً لخفض التكلفة دون تقييم مالي دوري لمستوى المخاطر الائتمانية للمورد." : "Total procurement dependency on a single-source foreign vendor without auditing their balance sheet or maintaining buffer stockpiles.",
      outcomes: lang === "ar" ? "ارتفاع كلفة الشراء العاجل بـ 15% وتأخر جدول التوريد لـ 3 أسابيع، ولكن تم ضمان استمرار دورة التصنيع دون انقطاع ممتد." : "Temporary 15% increase in procurement costs and a 3-week logistics lag, but avoided a catastrophic total production halt.",
      lessons: lang === "ar" ? "تفعيل مبدأ التوريد المزدوج الإلزامي بنسبة لا تقل عن 70/30 لكافة المواد الخام الهامة والمكونات الأساسية للتصنيع." : "Mandate dual-sourcing strategies (70/30 split) for all highly specialized metallurgy components and hold 3 months of buffer stock.",
      encrypted: false
    }
  ], [lang]);

  const [memories, setMemories] = useState(initialMemories);

  // Dynamic coordinates calculation to achieve exact cursor placements
  const moveCursorToTarget = (targetName: string, onComplete?: () => void) => {
    if (!containerRef.current) return;
    const element = containerRef.current.querySelector(`[data-demo-target="${targetName}"]`);
    if (element) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      // Calculate target point relative to container and offset to center of the target element
      const x = elementRect.left - containerRect.left + elementRect.width / 2;
      const y = elementRect.top - containerRect.top + elementRect.height / 2;
      
      setCursorPos({ x, y });
      
      // Slight artificial pause for natural cursor motion simulation
      if (onComplete) {
        setTimeout(onComplete, 700);
      }
    } else {
      // Fallback if element not rendered yet
      if (onComplete) onComplete();
    }
  };

  // --- Timeline Action Steps (The Storyboard) ---
  const timeline: TimelineStep[] = useMemo(() => [
    // --- Scene 1: إضافة ذاكرة (Add Memory View) ---
    { type: "action", target: "", action: () => { setActiveTab("add"); setFormStep(1); setSimulatedTitle(""); setSimulatedDesc(""); setSimulatedDecision(""); setSimulatedCausal(""); setSimulatedOutcomes(""); setSimulatedLessons(""); setSimulatedEncrypt(false); setShowAddSuccess(false); setZoomScale(1); setMemories(initialMemories); setSmartAnalysisState("idle"); } },
    { type: "wait", target: "", duration: 400 },
    
    // Fill Step 1 Title
    { type: "move", target: "add-title" },
    { type: "click", target: "add-title" },
    { 
      type: "type", 
      target: "add-title", 
      text: lang === "ar" 
        ? "التحوط في الهندسة المالية لإدارة مخاطر الصرف" 
        : "Hedging in Financial Engineering for FX Risk" 
    },
    { type: "wait", target: "", duration: 300 },
    
    // Choose Category & Next
    { type: "move", target: "add-category" },
    { type: "click", target: "add-category" },
    { type: "move", target: "add-next-btn" },
    { type: "click", target: "add-next-btn", action: () => { setFormStep(2); } },
    { type: "wait", target: "", duration: 500 },

    // Fill Step 2 Narrative Description & Decision
    { type: "move", target: "add-desc-input" },
    { type: "click", target: "add-desc-input" },
    { 
      type: "type", 
      target: "add-desc-input", 
      text: lang === "ar"
        ? "تقلبات غير مسبوقة في أسعار الفائدة والصرف الأجنبي أدت إلى عدم مطابقة التدفقات النقدية الواردة بالدولار والالتزامات الصادرة باليورو دون حماية كافية."
        : "Mismatched dollar receivables and euro liabilities without currency hedging protection."
    },
    { type: "wait", target: "", duration: 300 },
    { type: "move", target: "add-decision-input" },
    { type: "click", target: "add-decision-input" },
    { 
      type: "type", 
      target: "add-decision-input", 
      text: lang === "ar"
        ? "هيكلة عقود خيارات ثنائية متقاطعة واستخدام عقود المبادلة لتثبيت سعر الفائدة المتغير مع البنوك المراسلة."
        : "Structured currency options collar contracts and interest rate swaps with correspondent banks."
    },
    { type: "wait", target: "", duration: 300 },
    { type: "move", target: "add-next-btn-2" },
    { type: "click", target: "add-next-btn-2", action: () => { setFormStep(3); } },
    { type: "wait", target: "", duration: 500 },

    // Step 3: Causal Factors & Outcomes
    { type: "move", target: "add-causal-input" },
    { type: "click", target: "add-causal-input" },
    { 
      type: "type", 
      target: "add-causal-input", 
      text: lang === "ar"
        ? "تأخير تفعيل بروتوكول التحوط المالي بسبب قيود السيولة وضعف ربط البيانات اللحظي بين الخزينة والبنك الوسيط."
        : "Operational delays in activating swaps and options due to temporary cash constraints and poor real-time API integrations."
    },
    { type: "wait", target: "", duration: 200 },
    { type: "move", target: "add-outcomes-input" },
    { type: "click", target: "add-outcomes-input" },
    { 
      type: "type", 
      target: "add-outcomes-input", 
      text: lang === "ar"
        ? "تكبد خسائر تحويل عملة بنسبة 8% في الربع الأول وتكلفة تمويل إضافية، تم إيقافها بالكامل بعد تغطية 85% من المحفظة."
        : "Incurred an 8% foreign exchange translation loss in Q1, fully stabilized after 85% hedge coverage was established."
    },
    { type: "wait", target: "", duration: 300 },
    { type: "move", target: "add-next-btn-3" },
    { type: "click", target: "add-next-btn-3", action: () => { setFormStep(4); } },
    { type: "wait", target: "", duration: 500 },

    // Step 4: Lessons & Encryption
    { type: "move", target: "add-lessons-input" },
    { type: "click", target: "add-lessons-input" },
    { 
      type: "type", 
      target: "add-lessons-input", 
      text: lang === "ar"
        ? "تأسيس صندوق سيولة معزول ومحصن مخصص لضمانات عقود الخيارات مع تفعيل التداول الآلي لعقود المبادلة فور تذبذب الصرف بـ 3%."
        : "Establish an isolated collateral cash reserve solely for currency hedging, enabling automated execution when FX shifts > 3%."
    },
    { type: "wait", target: "", duration: 400 },
    
    // CEO Secret Passcode Checkbox
    { type: "move", target: "add-encrypt-checkbox" },
    { type: "click", target: "add-encrypt-checkbox", action: () => { setSimulatedEncrypt(true); } },
    { type: "wait", target: "", duration: 500 },

    // Zoom In to highlight saving action
    { 
      type: "action", 
      target: "", 
      action: () => { 
        setZoomScale(1.1); 
        setZoomOrigin("50% 100%"); 
      } 
    },
    { type: "wait", target: "", duration: 400 },
    { type: "move", target: "add-save-btn" },
    { 
      type: "click", 
      target: "add-save-btn", 
      action: () => { 
        setShowAddSuccess(true);
        // Prepend our newly created memory to the memories list!
        setMemories(prev => {
          const filtered = prev.filter(m => m.id !== 3);
          return [
            {
              id: 3,
              title: lang === "ar" ? "التحوط في الهندسة المالية لإدارة مخاطر الصرف" : "Hedging in Financial Engineering for FX Risk",
              category: "Financial Engineering",
              risk: "High",
              date: lang === "ar" ? "الآن" : "Just now",
              desc: lang === "ar" ? "تقلبات غير مسبوقة في أسعار الفائدة والصرف الأجنبي أدت إلى عدم مطابقة التدفقات النقدية الواردة بالدولار والالتزامات الصادرة باليورو دون حماية كافية." : "Mismatched dollar receivables and euro liabilities without currency hedging protection.",
              decision: lang === "ar" ? "هيكلة عقود خيارات ثنائية متقاطعة واستخدام عقود المبادلة لتثبيت سعر الفائدة المتغير مع البنوك المراسلة." : "Structured currency options collar contracts and interest rate swaps with correspondent banks.",
              causal: lang === "ar" ? "تأخير تفعيل بروتوكول التحوط المالي بسبب قيود السيولة وضعف ربط البيانات اللحظي بين الخزينة والبنك الوسيط." : "Operational delays in activating swaps and options due to temporary cash constraints and poor real-time API integrations.",
              outcomes: lang === "ar" ? "تكبد خسائر تحويل عملة بنسبة 8% في الربع الأول وتكلفة تمويل إضافية، تم إيقافها بالكامل بعد تغطية 85% من المحفظة." : "Incurred an 8% foreign exchange translation loss in Q1, fully stabilized after 85% hedge coverage was established.",
              lessons: lang === "ar" ? "تأسيس صندوق سيولة معزول ومحصن مخصص لضمانات عقود الخيارات مع تفعيل التداول الآلي لعقود المبادلة فور تذبذب الصرف بـ 3%." : "Establish an isolated collateral cash reserve solely for currency hedging, enabling automated execution when FX shifts > 3%.",
              encrypted: true
            },
            ...filtered
          ];
        });
      } 
    },
    { type: "wait", target: "", duration: 1500 },
    { type: "action", target: "", action: () => { setZoomScale(1); setShowAddSuccess(false); } },
    { type: "wait", target: "", duration: 300 },

    // --- Scene 2: مكتبة الذاكرة المسجلة (Library View) ---
    { type: "move", target: "sidebar-tab-library" },
    { type: "click", target: "sidebar-tab-library", action: () => { setActiveTab("library"); setExpandedMemoryId(null); setIsUnlocked(false); setPasscodeModalOpen(false); setEnteredPasscode(""); } },
    { type: "wait", target: "", duration: 800 },
    
    // Hover over the freshly saved, passcode-locked memory card
    { type: "move", target: "memory-card-3" },
    { type: "click", target: "memory-card-3", action: () => { setPasscodeModalOpen(true); } },
    { type: "wait", target: "", duration: 600 },
    
    // Click on passcode input inside lock popup
    { type: "move", target: "passcode-input" },
    { type: "click", target: "passcode-input" },
    { type: "type", target: "passcode-input", text: "2026" },
    { type: "wait", target: "", duration: 400 },
    
    // Press Submit Passcode
    { type: "move", target: "passcode-submit-btn" },
    { 
      type: "click", 
      target: "passcode-submit-btn", 
      action: () => { 
        setPasscodeModalOpen(false); 
        setIsUnlocked(true); 
        setExpandedMemoryId(3); 
        setZoomScale(1.05);
        setZoomOrigin("50% 50%");
      } 
    },
    { type: "wait", target: "", duration: 2500 }, // View details
    { type: "action", target: "", action: () => { setZoomScale(1); setExpandedMemoryId(null); } },
    { type: "wait", target: "", duration: 400 },

    // --- Scene 3: المستشار الإدراكي (Cognitive Advisor View) ---
    { type: "move", target: "sidebar-tab-agent" },
    { 
      type: "click", 
      target: "sidebar-tab-agent", 
      action: () => { 
        setActiveTab("agent"); 
        setAdvisorInput(""); 
        setAdvisorMessages([]); 
      } 
    },
    { type: "wait", target: "", duration: 600 },

    // Move to input field
    { type: "move", target: "advisor-prompt" },
    { type: "click", target: "advisor-prompt" },
    { type: "wait", target: "", duration: 300 },
    
    // Type the new unique question
    { 
      type: "type", 
      target: "advisor-prompt", 
      text: lang === "ar" 
        ? "كيف نحمي قواعد البيانات التجريبية من تسريبات التصيد الإلكتروني مستقبلاً؟" 
        : "How do we prevent cybersecurity phishing leaks on our staging databases?" 
    },
    { type: "wait", target: "", duration: 500 },
    
    // Move to send button and click
    { type: "move", target: "send-query-btn" },
    { 
      type: "click", 
      target: "send-query-btn", 
      action: () => {
        const uText = lang === "ar" 
          ? "كيف نحمي قواعد البيانات التجريبية من تسريبات التصيد الإلكتروني مستقبلاً؟" 
          : "How do we prevent cybersecurity phishing leaks on our staging databases?";
        setAdvisorMessages([{ sender: "user", text: uText }]);
        setAdvisorInput("");
        setIsAiTyping(true);
      } 
    },
    { type: "wait", target: "", duration: 1500 },
    
    // Cognitive Advisor responds with streaming effect
    { 
      type: "action", 
      target: "", 
      action: () => {
        setIsAiTyping(false);
        // Add empty AI message
        setAdvisorMessages(prev => [...prev, { sender: "ai", text: "" }]);
        
        const responseText = lang === "ar"
          ? "لتأمين قواعد البيانات التجريبية وحمايتها من هجمات التصيد الإلكتروني، يوصى بالآتي:\n\n١. فرض الهوية متعددة العوامل: اعتماد مفاتيح الأمان الفعلية واستبدال كلمات المرور الثابتة برموز دخول مؤقتة وتنتهي تلقائياً.\n٢. عزل البيئة التجريبية: فصل شبكات التطوير والاختبار بالكامل عن الإنترنت المفتوح وقصر الاتصال بقاعدة البيانات على عناوين بروتوكول الإنترنت الموثوقة.\n٣. الفحص التلقائي للمستودعات: تشغيل أدوات مسح دورية للكشف الفوري عن أي مفاتيح برمجية مخفية في الكود وإلغائها تلقائياً."
          : "To secure staging databases against credential leaks and phishing attacks, implement these key protocols:\n\n1. Enforce Ephemeral Access: Require multi-factor hardware security keys and replace static API secrets with short-lived tokens.\n2. Subnet Isolation: Fully isolate staging and development environments from public routing and restrict database access to verified office IP ranges.\n3. Continuous Auditing: Establish automatic scanning of code repositories to immediately detect and revoke hardcoded staging credentials.";
        
        let currentText = "";
        let charIndex = 0;
        
        const streamInterval = setInterval(() => {
          const chunk = responseText.substring(charIndex, charIndex + 4);
          currentText += chunk;
          charIndex += 4;
          
          setAdvisorMessages(prev => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[updated.length - 1] = { sender: "ai", text: currentText };
            }
            return updated;
          });
          
          if (charIndex >= responseText.length) {
            clearInterval(streamInterval);
          }
        }, 25);
      } 
    },
    { type: "wait", target: "", duration: 6500 }, // Let user read fully completed streamed AI response

    // --- Scene 4: التطور الذكي (Smart Evolution View) ---
    { type: "move", target: "sidebar-tab-smart" },
    { 
      type: "click", 
      target: "sidebar-tab-smart", 
      action: () => { 
        setActiveTab("smart"); 
        setSmartActiveTab("predictions"); 
        setSmartAnalysisState("idle"); 
      } 
    },
    { type: "wait", target: "", duration: 1500 },

    // Move to "تشغيل التحليل بالذكاء الاصطناعي" button
    { type: "move", target: "run-smart-analysis-btn" },
    { type: "wait", target: "", duration: 600 }, // Hover brief pause
    
    // Click the analysis button
    { 
      type: "click", 
      target: "run-smart-analysis-btn", 
      action: () => { 
        setSmartAnalysisState("analyzing"); 
      } 
    },
    { type: "wait", target: "", duration: 2500 }, // AI processing delay
    
    // Complete analysis and show results
    { 
      type: "action", 
      target: "", 
      action: () => { 
        setSmartAnalysisState("completed"); 
      } 
    },
    { type: "wait", target: "", duration: 2000 }, // Let user view the staggered results
    
    // Cycle to opportunities subtab
    { type: "move", target: "smart-tab-opportunities" },
    { type: "click", target: "smart-tab-opportunities", action: () => { setSmartActiveTab("opportunities"); } },
    { type: "wait", target: "", duration: 2000 },

    // Cycle to risks subtab
    { type: "move", target: "smart-tab-risks" },
    { type: "click", target: "smart-tab-risks", action: () => { setSmartActiveTab("risks"); } },
    { type: "wait", target: "", duration: 2500 },

    // Cycle to recommendations subtab
    { type: "move", target: "smart-tab-recommendations" },
    { type: "click", target: "smart-tab-recommendations", action: () => { setSmartActiveTab("recommendations"); } },
    { type: "wait", target: "", duration: 2500 },

    // --- Scene 5: ذكاء السوق (Market Intelligence View) ---
    { type: "move", target: "sidebar-tab-market" },
    { type: "click", target: "sidebar-tab-market", action: () => { setActiveTab("market"); setMarketTopic(""); setMarketAnalysisResult(false); } },
    { type: "wait", target: "", duration: 800 },
    
    // Enter Market Intelligence search parameter
    { type: "move", target: "market-topic-input" },
    { type: "click", target: "market-topic-input" },
    { 
      type: "type", 
      target: "market-topic-input", 
      text: lang === "ar"
        ? "ارتفاع أسعار خام برنت وتوتر سلاسل التوريد"
        : "Brent crude surge & shipping bottlenecks"
    },
    { type: "wait", target: "", duration: 400 },
    
    // Run Assessment
    { type: "move", target: "market-run-btn" },
    { 
      type: "click", 
      target: "market-run-btn", 
      action: () => { 
        setIsMarketAnalyzing(true); 
      } 
    },
    { type: "wait", target: "", duration: 1500 },
    { 
      type: "action", 
      target: "", 
      action: () => { 
        setIsMarketAnalyzing(false); 
        setMarketAnalysisResult(true); 
      } 
    },
    { type: "wait", target: "", duration: 3500 }, // View result before looping back
  ], [lang]);

  // --- Core Timeline Driver System ---
  const runTimelineStep = () => {
    if (!isPlaying) return;
    
    const step = timeline[timelineIndex];
    if (!step) {
      // Loop sequence indefinitely
      setTimelineIndex(0);
      return;
    }

    const nextStep = () => {
      setTimelineIndex(prev => (prev + 1) % timeline.length);
    };

    if (step.type === "action") {
      if (step.action) step.action();
      nextStep();
    } else if (step.type === "wait") {
      timelineTimeoutRef.current = setTimeout(nextStep, step.duration || 1000);
    } else if (step.type === "move") {
      moveCursorToTarget(step.target, nextStep);
    } else if (step.type === "click") {
      moveCursorToTarget(step.target, () => {
        setIsClicking(true);
        // Append Click Ripple directly at current calculated cursor position
        setRipples(prev => [...prev, { id: Date.now(), x: cursorPos.x, y: cursorPos.y }]);
        
        setTimeout(() => setIsClicking(false), 200);
        
        if (step.action) step.action();
        
        // Advance timeline after click animation completes
        setTimeout(nextStep, 350);
      });
    } else if (step.type === "type") {
      // Custom typing simulator that feeds character-by-character
      let fullText = step.text || "";
      let currentLength = 0;
      
      const typeInterval = setInterval(() => {
        currentLength++;
        const slicedText = fullText.substring(0, currentLength);
        
        if (step.target === "add-title") setSimulatedTitle(slicedText);
        else if (step.target === "add-desc-input") setSimulatedDesc(slicedText);
        else if (step.target === "add-decision-input") setSimulatedDecision(slicedText);
        else if (step.target === "add-causal-input") setSimulatedCausal(slicedText);
        else if (step.target === "add-outcomes-input") setSimulatedOutcomes(slicedText);
        else if (step.target === "add-lessons-input") setSimulatedLessons(slicedText);
        else if (step.target === "passcode-input") setEnteredPasscode(slicedText);
        else if (step.target === "market-topic-input") setMarketTopic(slicedText);
        else if (step.target === "advisor-prompt") setAdvisorInput(slicedText);

        if (currentLength >= fullText.length) {
          clearInterval(typeInterval);
          setTimeout(nextStep, 600);
        }
      }, 35); // Typing speed in milliseconds
    }
  };

  // Run or Pause timeline loop
  useEffect(() => {
    if (isPlaying) {
      runTimelineStep();
    }
    return () => {
      if (timelineTimeoutRef.current) clearTimeout(timelineTimeoutRef.current);
    };
  }, [isPlaying, timelineIndex]);

  // Clean ripples array
  useEffect(() => {
    if (ripples.length > 0) {
      const timer = setTimeout(() => {
        setRipples(prev => prev.slice(1));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [ripples]);

  // --- Manual Navigation Overrides (Seamless & Beautiful) ---
  const handleManualTabJump = (tab: TabType) => {
    setIsPlaying(false);
    if (timelineTimeoutRef.current) clearTimeout(timelineTimeoutRef.current);
    
    // Jump directly to the first step of the requested tab scene
    let foundIndex = 0;
    if (tab === "add") {
      foundIndex = 0;
    } else {
      if (tab === "library") {
        // Pre-add the financial engineering hedging memory so library works nicely in manual navigation
        setMemories(prev => {
          if (!prev.some(m => m.id === 3)) {
            return [
              {
                id: 3,
                title: lang === "ar" ? "التحوط في الهندسة المالية لإدارة مخاطر الصرف" : "Hedging in Financial Engineering for FX Risk",
                category: "Financial Engineering",
                risk: "High",
                date: "2026-08-07",
                desc: lang === "ar" ? "تقلبات غير مسبوقة في أسعار الفائدة والصرف الأجنبي أدت إلى عدم مطابقة التدفقات النقدية الواردة بالدولار والالتزامات الصادرة باليورو دون حماية كافية." : "Mismatched dollar receivables and euro-denominated outbound liabilities without adequate currency hedging coverage.",
                decision: lang === "ar" ? "هيكلة عقود خيارات ثنائية متقاطعة واستخدام عقود المبادلة لتثبيت سعر الفائدة المتغير مع البنوك المراسلة." : "Structured currency options collar contracts and interest rate swaps to lock down variable exposures.",
                causal: lang === "ar" ? "تأخير تفعيل بروتوكول التحوط المالي بسبب قيود السيولة وضعف ربط البيانات اللحظي بين الخزينة والبنك الوسيط." : "Operational latency in activating hedging protocols due to collateral liquidity constraints and poor system integration.",
                outcomes: lang === "ar" ? "تكبد خسائر تحويل عملة بنسبة 8% في الربع الأول وتكلفة تمويل إضافية، تم إيقافها بالكامل بعد تغطية 85% من المحفظة." : "Incurred an 8% foreign exchange translation loss in Q1, fully stabilized after 85% hedge coverage was established.",
                lessons: lang === "ar" ? "تأسيس صندوق سيولة معزول ومحصن مخصص لضمانات عقود الخيارات مع تفعيل التداول الآلي لعقود المبادلة فور تذبذب الصرف بـ 3%." : "Establish an isolated collateral cash buffer solely for hedge options, authorizing auto-execution when FX shifts > 3%.",
                encrypted: true
              },
              ...prev
            ];
          }
          return prev;
        });
      }
      
      const targetStep = `sidebar-tab-${tab}`;
      const idx = timeline.findIndex(step => step.target === targetStep);
      foundIndex = idx !== -1 ? idx : 0;
    }

    // Direct transition reset
    setActiveTab(tab);
    setZoomScale(1);
    setTimelineIndex(foundIndex);
    
    // Smooth transition of cursor to the clicked tab target
    setTimeout(() => {
      moveCursorToTarget(`sidebar-tab-${tab}`, () => {
        setIsPlaying(true);
      });
    }, 100);
  };

  const handleSuggestedQueryClick = (index: number) => {
    setIsPlaying(false);
    if (timelineTimeoutRef.current) clearTimeout(timelineTimeoutRef.current);
    
    const queries = [
      lang === "ar" ? "ما هي الدروس المستفادة من تأخير تحوط مخاطر الصرف؟" : "What are the lessons learned from delaying exchange rate hedging?",
      lang === "ar" ? "تحليل أسباب تأخير جمارك ميناء طنجة" : "Analyze the causes of customs classification delays at Tangier port",
      lang === "ar" ? "مراجعة ثغرات التحويل المصرفي للشريك الإسباني" : "Review bank transfer compliance gaps for Spanish partner",
      lang === "ar" ? "كيف نتجنب أزمات السيولة لدورة رأس المال؟" : "How to prevent short-term liquidity deficits in working capital?"
    ];
    
    const responses = [
      lang === "ar"
        ? "بناءً على ذاكرة التحوط المالي والمخاطر السيادية لعام 2026:\n\n١. **الفصل الهيكلي**: حظر سحب السيولة التشغيلية لتمويل عقود خيارات التحوط المالي.\n٢. **الأتمتة**: تفعيل بروتوكول تحوط رقمي فوري بنسبة 85% عبر واجهة API مرتبطة بالخزينة لابتياع الخيارات بمجرد بلوغ ذبذبات الصرف 3% لتفادي خسائر التحويل البالغة 8%."
        : "Based on the 2026 Financial Hedging and Sovereign Risk Memory:\n\n1. **Structural Separation**: Strictly forbid using operational cash reserves to finance hedging option premiums.\n2. **Automation**: Implement a real-time programmatic hedging protocol of 85% coverage via a Treasury API when foreign exchange rates drift by more than 3%.",
      
      lang === "ar"
        ? "بناءً على ذاكرة الجمارك والخدمات اللوجستية لعام 2026 (حدث شحنة #CN-9022):\n\n١. **السبب الجذري**: إدخال يدوي خاطئ لرموز التعريفة الجمركية المتغيرة مع غياب دليل لوجستي رقمي محدث.\n٢. **الإجراء المصحح**: ربط أوامر الشراء المستقبلية بالمنصة الجمركية مسبقًا وتوطين الدليل اللوجستي الموحد رقميًا لمنع أي غرامات تخزين تكرارية."
        : "Based on 2026 Customs & Logistics memory (Shipment #CN-9022):\n\n1. **Root Cause**: Manual classification error of parts tariff codes combined with an outdated logistics compliance playbook.\n2. **Resolution**: Direct integration of purchase orders with pre-approved HS tariff codes and localizing the unified logistics guide to eradicate recurring demurrage penalties.",
      
      lang === "ar"
        ? "بناءً على ذاكرة المراجعة والامتثال التنظيمي لعام 2026:\n\n١. **السبب الجذري**: قوائم المراقبة الدولية (AML) تم تحديثها عالميًا دون مزامنة قاعدة البيانات المحلية للشريك الإسباني.\n٢. **التوصية**: تفعيل الفحص التلقائي الاستباقي لقواعد بيانات غسيل الأموال والامتثال كل 90 يومًا قبل جدولة أي تحويلات دولية معتمدة."
        : "Based on 2026 Regulatory Compliance memory:\n\n1. **Root Cause**: Sudden global AML sanctions updates occurred without corresponding localized database synchronization of the Spanish vendor register.\n2. **Recommendation**: Establish automated pre-clearing AML watchlists updates every 90 days prior to triggering cross-border payments.",
      
      lang === "ar"
        ? "بناءً على ذاكرة الخزانة وإدارة النقد لعام 2026:\n\n١. **التحليل**: فجوة قدرها 45 يومًا بين شروط تحصيل المستحقات من العملاء (90 يومًا) وفترات سداد الموردين (45 يومًا).\n٢. **التوجيه الإدراكي**: فرض سقف ائتماني للعملاء لا يتجاوز 45 يومًا وتفعيل مراقبة عجز النقد اللحظية عبر ERP لتفادي استخدام السحب على المكشوف المكلف."
        : "Based on 2026 Treasury & Cash Flow memory:\n\n1. **Analysis**: Mismatch between customer receivables terms (90 days) and supplier payment schedules (45 days) causing a 45-day funding gap.\n2. **Guideline**: Implement strict customer credit terms of max 45 days and integrate dynamic cash gap forecasting to avoid high interest overdraft charges."
    ];

    // Simulate Typing
    setAdvisorInput("");
    let currentLength = 0;
    const fullText = queries[index];
    const typeInterval = setInterval(() => {
      currentLength++;
      setAdvisorInput(fullText.substring(0, currentLength));
      if (currentLength >= fullText.length) {
        clearInterval(typeInterval);
        
        // Trigger Send logic after short delay
        setTimeout(() => {
          setAdvisorMessages(prev => [...prev, { sender: "user", text: fullText }]);
          setAdvisorInput("");
          setIsAiTyping(true);
          
          setTimeout(() => {
            setIsAiTyping(false);
            setAdvisorMessages(prev => [...prev, { sender: "ai", text: responses[index] }]);
          }, 1200);
        }, 400);
      }
    }, 12);
  };

  return (
    <div 
      className="w-full relative" 
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* 1. Header Navigation Controller - Global Standard (No "المرحلة الحالية" labels) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">
              {lang === "ar" ? "العرض التقديمي التفاعلي لـ Zakir" : "Zakir Interactive Product Walkthrough"}
            </h3>
            <p className="text-[11px] text-slate-400">
              {lang === "ar" ? "شاهد محاكاة حية لطريقة العمل في الوقت الحقيقي" : "Observe a live simulation of strategic memory logging in real-time"}
            </p>
          </div>
        </div>

        {/* Cinematic Control Buttons */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>{lang === "ar" ? "محاكاة مستمرة" : "Live Walkthrough Loop"}</span>
          </div>
        </div>
      </div>

      {/* Interactive Tabs Menu Bar for User Manual Control */}
      <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-950/60 border border-slate-800/60 rounded-xl mb-4">
        {[
          { id: "add", label: lang === "ar" ? "إضافة ذاكرة" : "Add Memory", icon: PlusCircle },
          { id: "library", label: lang === "ar" ? "الذاكرة المسجلة" : "Memory Ledger", icon: FileText },
          { id: "agent", label: lang === "ar" ? "المستشار الإدراكي" : "Cognitive Advisor", icon: Brain },
          { id: "smart", label: lang === "ar" ? "التطور الذكي" : "Smart Evolution", icon: TrendingUp },
          { id: "market", label: lang === "ar" ? "ذكاء السوق" : "Market Intel", icon: Globe }
        ].map((item) => {
          const ItemIcon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleManualTabJump(item.id as TabType)}
              className={`py-2 rounded-lg text-center flex flex-col md:flex-row items-center justify-center gap-1.5 transition-all text-xs font-black cursor-pointer ${
                isActive 
                  ? "bg-[#0075DE] text-white font-bold shadow-md shadow-[#0075DE]/20 scale-[1.01]" 
                  : "text-slate-400 hover:text-white hover:bg-slate-900/50"
              }`}
            >
              <ItemIcon className="w-4 h-4" />
              <span className="hidden sm:inline-block truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. MAIN BROWSER / SIMULATION CANVAS PANEL */}
      <div 
        ref={containerRef}
        className="relative w-full aspect-[16/9] min-h-[460px] md:min-h-[560px] bg-slate-950 rounded-3xl border border-slate-800/80 shadow-2xl shadow-black/80 overflow-hidden select-none"
        style={{ perspective: "1200px" }}
      >
        {/* Cinematic Zoom / Perspective Frame wrapper */}
        <motion.div
          animate={{ 
            scale: zoomScale,
            transformOrigin: zoomOrigin
          }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
          className="w-full h-full flex"
        >
          {/* THE SIMULATED APPLICATION FRAMEWORK */}
          <div className="w-full h-full flex text-slate-100 font-sans text-xs">
            
            {/* SIMULATED SIDEBAR - RTL Right, LTR Left */}
            <div className={`w-[200px] shrink-0 bg-slate-900 border-slate-800/80 flex flex-col justify-between p-4 ${
              lang === "ar" ? "border-l" : "border-r"
            }`}>
              {/* Sidebar Header */}
              <div className="space-y-6">
                {/* Simulated Zakir Premium Brand Logo */}
                <div className="py-1">
                  <ZakirLogo theme="dark" size="sm" lang={lang} />
                </div>

                {/* Sidebar Navigation Items */}
                <div className="space-y-1">
                  {[
                    { id: "add", label: lang === "ar" ? "إضافة ذاكرة" : "Add Memory", icon: PlusCircle, target: "sidebar-tab-add" },
                    { id: "library", label: lang === "ar" ? "الذاكرة المسجلة" : "Memory Ledger", icon: FileText, target: "sidebar-tab-library" },
                    { id: "agent", label: lang === "ar" ? "المستشار الإدراكي" : "Cognitive Advisor", icon: Brain, target: "sidebar-tab-agent" },
                    { id: "smart", label: lang === "ar" ? "التطور الذكي" : "Smart Evolution", icon: TrendingUp, target: "sidebar-tab-smart" },
                    { id: "market", label: lang === "ar" ? "ذكاء السوق" : "Market Intel", icon: Globe, target: "sidebar-tab-market" }
                  ].map((navItem) => {
                    const NavIcon = navItem.icon;
                    const isSelected = activeTab === navItem.id;
                    return (
                      <div
                        key={navItem.id}
                        data-demo-target={navItem.target}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-bold transition-all ${
                          isSelected 
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                        }`}
                      >
                        <NavIcon className="w-4 h-4 shrink-0" />
                        <span className="text-[11px] truncate">{navItem.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sidebar Bottom Metadata Indicators */}
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/50 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>{lang === "ar" ? "المخدم" : "Server Status"}</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {lang === "ar" ? "نشط" : "Online"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>PostgreSQL</span>
                  <span className="text-amber-400 font-mono text-[9px] font-bold">17.2</span>
                </div>
              </div>
            </div>

            {/* SIMULATED CONTENT VIEWPORT */}
            <div className="flex-1 h-full bg-slate-950/40 p-6 overflow-y-auto relative flex flex-col">
              
              {/* Dynamic View Containers */}
              <AnimatePresence mode="wait">
                
                {/* VIEW A: ADD MEMORY */}
                {activeTab === "add" && (
                  <motion.div
                    key="add-view"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="space-y-4 max-w-2xl mx-auto w-full"
                  >
                    <div className="text-center space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold tracking-wider uppercase">
                        <Sparkles className="w-3 h-3" />
                        <span>{lang === "ar" ? "معمارية حفظ الذكريات المؤسسية" : "Causal Memory Logging Engine"}</span>
                      </div>
                      <h2 className="text-lg font-black text-white">{lang === "ar" ? "تسجيل حدث وقرار جديد" : "Record New Corporate Decision Cycle"}</h2>
                    </div>

                    {/* Horizontal 4-Step Progress Track */}
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/60">
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { step: 1, title: lang === "ar" ? "الحدث والبيانات" : "Event", icon: FileText },
                          { step: 2, title: lang === "ar" ? "السرد والقرار" : "Decision", icon: GitCommit },
                          { step: 3, title: lang === "ar" ? "المسببات والنتائج" : "Causes", icon: AlertTriangle },
                          { step: 4, title: lang === "ar" ? "الدروس والتأمين" : "Lessons", icon: ShieldCheck }
                        ].map((s) => {
                          const StepIcon = s.icon;
                          const isDone = formStep > s.step;
                          const isCurrent = formStep === s.step;
                          return (
                            <div
                              key={s.step}
                              className={`flex flex-col items-center gap-1 p-1 rounded-lg text-center ${
                                isCurrent 
                                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" 
                                  : "text-slate-500"
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                isCurrent 
                                  ? "bg-amber-500 text-slate-950 shadow-md" 
                                  : isDone 
                                  ? "bg-emerald-500/20 text-emerald-400" 
                                  : "bg-slate-800 text-slate-500"
                              }`}>
                                {isDone ? <Check className="w-3 h-3" /> : <StepIcon className="w-3.5 h-3.5" />}
                              </div>
                              <span className="text-[9px] font-bold truncate max-w-full">{s.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step Content Wrapper */}
                    <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/50 space-y-4">
                      {showAddSuccess ? (
                        <motion.div 
                          initial={{ scale: 0.95, opacity: 0 }} 
                          animate={{ scale: 1, opacity: 1 }}
                          className="py-8 text-center space-y-3"
                        >
                          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto text-xl">
                            <CheckCircle className="w-6 h-6 shrink-0 animate-bounce" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-emerald-400">{lang === "ar" ? "تم الحفظ بنجاح وتأمين الذاكرة" : "Causal Cycle Saved & Encrypted"}</h4>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {lang === "ar" 
                                ? "تم إدراج حدث 'تحوط النفط الربع الثالث' بنجاح وتوثيقه مشفراً برقم المعرف الذري #ZK-1903."
                                : "The Aviation Hedging memory block has been securely appended inside PostgreSQL index #ZK-1903."}
                            </p>
                          </div>
                        </motion.div>
                      ) : (
                        <>
                          {/* STEP 1 */}
                          {formStep === 1 && (
                            <motion.div initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{lang === "ar" ? "عنوان الذاكرة / اسم الحدث" : "Event Title / Name"}</label>
                                <input
                                  type="text"
                                  readOnly
                                  value={simulatedTitle}
                                  data-demo-target="add-title"
                                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-white focus:outline-none placeholder-slate-700"
                                  placeholder={lang === "ar" ? "اكتب عنوان الحدث هنا..." : "Enter event name..."}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{lang === "ar" ? "الفئة / الوظيفة التشغيلية" : "Category"}</label>
                                  <select 
                                    disabled
                                    data-demo-target="add-category"
                                    className="w-full h-9 px-2 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-slate-300"
                                  >
                                    <option>FX Risk Management</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{lang === "ar" ? "مستوى خطورة الحدث" : "Risk Level"}</label>
                                  <select 
                                    disabled
                                    className="w-full h-9 px-2 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-amber-400 font-bold"
                                  >
                                    <option>{lang === "ar" ? "مرتفع" : "High"}</option>
                                  </select>
                                </div>
                              </div>
                              <div className="pt-3 flex justify-end">
                                <div 
                                  data-demo-target="add-next-btn"
                                  className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1"
                                >
                                  <span>{lang === "ar" ? "التالي" : "Next"}</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {/* STEP 2 */}
                          {formStep === 2 && (
                            <motion.div initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{lang === "ar" ? "ماذا حدث بالتفصيل؟ (سرد الحدث)" : "Event Narrative (Context)"}</label>
                                <textarea
                                  readOnly
                                  value={simulatedDesc}
                                  data-demo-target="add-desc-input"
                                  className="w-full h-16 p-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-white focus:outline-none placeholder-slate-700 resize-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{lang === "ar" ? "القرار المتخذ والمسؤول" : "Decision Taken"}</label>
                                <textarea
                                  readOnly
                                  value={simulatedDecision}
                                  data-demo-target="add-decision-input"
                                  className="w-full h-16 p-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-white focus:outline-none placeholder-slate-700 resize-none"
                                />
                              </div>
                              <div className="pt-2 flex justify-between">
                                <button disabled className="px-3.5 py-2 bg-slate-800 text-slate-400 rounded-lg text-[11px]">{lang === "ar" ? "السابق" : "Previous"}</button>
                                <div 
                                  data-demo-target="add-next-btn-2"
                                  className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1"
                                >
                                  <span>{lang === "ar" ? "التالي" : "Next"}</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {/* STEP 3 */}
                          {formStep === 3 && (
                            <motion.div initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{lang === "ar" ? "العوامل المسببة والخلفية" : "Causal Factors"}</label>
                                  <textarea
                                    readOnly
                                    value={simulatedCausal}
                                    data-demo-target="add-causal-input"
                                    className="w-full h-24 p-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-white focus:outline-none resize-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{lang === "ar" ? "النتائج المترتبة" : "Resulting Outcomes"}</label>
                                  <textarea
                                    readOnly
                                    value={simulatedOutcomes}
                                    data-demo-target="add-outcomes-input"
                                    className="w-full h-24 p-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-white focus:outline-none resize-none"
                                  />
                                </div>
                              </div>
                              <div className="pt-2 flex justify-between">
                                <button disabled className="px-3.5 py-2 bg-slate-800 text-slate-400 rounded-lg text-[11px]">{lang === "ar" ? "السابق" : "Previous"}</button>
                                <div 
                                  data-demo-target="add-next-btn-3"
                                  className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1"
                                >
                                  <span>{lang === "ar" ? "التالي" : "Next"}</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {/* STEP 4 */}
                          {formStep === 4 && (
                            <motion.div initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{lang === "ar" ? "الدروس المستفادة والتوصيات الاستراتيجية" : "Strategic Lessons & Recommendations"}</label>
                                <textarea
                                  readOnly
                                  value={simulatedLessons}
                                  data-demo-target="add-lessons-input"
                                  className="w-full h-16 p-2.5 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-white focus:outline-none resize-none"
                                />
                              </div>

                              {/* Secure CEO Passcode Box */}
                              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded bg-amber-500/10 text-amber-500">
                                    <Lock className="w-3.5 h-3.5 shrink-0" />
                                  </div>
                                  <div>
                                    <p className="text-[10.5px] font-bold text-amber-300">{lang === "ar" ? "تشفير الذاكرة وتأمينها بالرمز السري" : "Encrypt Memory via CEO Passcode"}</p>
                                    <p className="text-[9px] text-slate-500">{lang === "ar" ? "يتطلب رمزاً خاصاً لمشاهدتها لاحقاً في المكتبة" : "Requires secret code before anyone can reveal details"}</p>
                                  </div>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={simulatedEncrypt}
                                  readOnly
                                  data-demo-target="add-encrypt-checkbox"
                                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500 accent-amber-500 shrink-0"
                                />
                              </div>

                              <div className="pt-2 flex justify-between">
                                <button disabled className="px-3.5 py-2 bg-slate-800 text-slate-400 rounded-lg text-[11px]">{lang === "ar" ? "السابق" : "Previous"}</button>
                                <div 
                                  data-demo-target="add-save-btn"
                                  className="px-5 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                  <span>{lang === "ar" ? "حفظ في ذاكرة المؤسسة" : "Save to Zakir Causal memory"}</span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* VIEW B: MEMORY LEDGER / SAVED MEMORIES */}
                {activeTab === "library" && (
                  <motion.div
                    key="library-view"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="space-y-4 w-full"
                  >
                    <div>
                      <h2 className="text-lg font-black text-white">{lang === "ar" ? "مكتبة الذاكرة المعرفية" : "Institutional Memory Ledger"}</h2>
                      <p className="text-[10px] text-slate-400">{lang === "ar" ? "الوصول اللامركزي للدروس المستفادة والقرارات المؤسسية." : "Unified storage for causal loops, strategic failures and compliance guidelines."}</p>
                    </div>

                    {/* Filter / Search Simulation Bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-9 bg-slate-900 border border-slate-800/80 rounded-lg px-2.5 flex items-center gap-2 text-slate-500">
                        <Search className="w-3.5 h-3.5 shrink-0" />
                        <input
                          type="text"
                          readOnly
                          placeholder={lang === "ar" ? "البحث بالعناوين والمسببات..." : "Search causal memories..."}
                          className="bg-transparent border-none text-[11px] focus:outline-none flex-1 text-slate-300"
                        />
                      </div>
                      <div className="h-9 px-3 bg-slate-900 border border-slate-800/80 rounded-lg text-[10px] text-slate-400 flex items-center font-bold">
                        {lang === "ar" ? "الفرز: الأحدث" : "Sort: Newest"}
                      </div>
                    </div>

                    {/* List of Memories */}
                    <div className="space-y-2.5">
                      {memories.map((m) => {
                        const isExpanded = expandedMemoryId === m.id;
                        return (
                          <div
                            key={m.id}
                            data-demo-target={`memory-card-${m.id}`}
                            className={`p-4 rounded-xl border transition-all ${
                              isExpanded 
                                ? "bg-slate-900/90 border-amber-500/50 shadow-lg shadow-amber-500/5" 
                                : "bg-slate-900/50 border-slate-800/60 hover:border-slate-800"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold ${
                                    m.risk === "Critical" 
                                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                                      : m.risk === "High" 
                                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                      : "bg-slate-800 text-slate-400"
                                  }`}>
                                    {m.risk}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">{m.category}</span>
                                </div>
                                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                                  {m.title}
                                  {m.encrypted && !isExpanded && (
                                    <Lock className="w-3 h-3 text-amber-400" />
                                  )}
                                </h4>
                              </div>
                              <span className="text-[9px] text-slate-600 font-mono shrink-0">{m.date}</span>
                            </div>

                            {/* Expanded Area Showing Complete Causal Details */}
                            {isExpanded && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="mt-4 pt-4 border-t border-slate-800/80 space-y-3 text-[11px]"
                              >
                                <div className="grid grid-cols-2 gap-3.5">
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">{lang === "ar" ? "سرد الحدث" : "Event Context"}</span>
                                    <p className="text-slate-300 leading-normal">{m.desc}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">{lang === "ar" ? "القرار المتخذ" : "Decision Taken"}</span>
                                    <p className="text-slate-300 leading-normal">{m.decision}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-slate-800/40">
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">{lang === "ar" ? "المسببات الأساسية" : "Causal Factors"}</span>
                                    <p className="text-slate-300 leading-normal">{m.causal}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">{lang === "ar" ? "الدروس والتأمين" : "Lessons Learned"}</span>
                                    <p className="text-amber-300 font-medium leading-normal flex items-start gap-1">
                                      <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                                      {m.lessons}
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* CEO Passcode Verification Mock Dialog */}
                    <AnimatePresence>
                      {passcodeModalOpen && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 rounded-xl"
                        >
                          <div className="max-w-xs w-full bg-slate-900 border border-slate-800 p-5 rounded-xl text-center space-y-4">
                            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto text-lg">
                              <Lock className="w-5 h-5 shrink-0 animate-bounce" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs font-black text-white">{lang === "ar" ? "تأكيد الرمز السري للـ CEO" : "Authentication Required"}</h4>
                              <p className="text-[9px] text-slate-400">{lang === "ar" ? "هذه الذاكرة مشفرة بحماية عالية وتتطلب الرمز السري لقراءتها." : "This amnesia card is sealed. Enter CEO decrypt key to expand."}</p>
                            </div>
                            <input
                              type="password"
                              readOnly
                              value={enteredPasscode}
                              data-demo-target="passcode-input"
                              placeholder="••••"
                              className="w-24 h-9 bg-slate-950 border border-slate-800 rounded-lg text-center tracking-[0.5em] text-white text-xs focus:outline-none"
                            />
                            <div 
                              data-demo-target="passcode-submit-btn"
                              className="w-full py-2 bg-amber-500 text-slate-950 font-bold rounded-lg text-[11px] cursor-pointer"
                            >
                              {lang === "ar" ? "فك التشفير" : "Decrypt & Unlock"}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* VIEW C: COGNITIVE ADVISOR */}
                {activeTab === "agent" && (
                  <motion.div
                    key="agent-view"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="space-y-4 flex flex-col h-full flex-1"
                  >
                    <div>
                      <h2 className="text-lg font-black text-white">{lang === "ar" ? "المستشار الإدراكي" : "Cognitive AI Advisor"}</h2>
                      <p className="text-[10px] text-slate-400">{lang === "ar" ? "استشر العقل الاصطناعي الحي لـ Zakir بشأن القرارات والدروس السابقة." : "Consult Zakir's live knowledge base regarding past decisions, causal links, and guidelines."}</p>
                    </div>

                    {/* Chat Messages Log */}
                    <div className="flex-1 min-h-[180px] bg-slate-900/40 rounded-xl border border-slate-800/50 p-4 overflow-y-auto space-y-3 flex flex-col justify-end">
                      {advisorMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-2 max-w-[85%] ${
                            msg.sender === "user" ? "self-end flex-row-reverse" : "self-start"
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            msg.sender === "user" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-amber-400"
                          }`}>
                            {msg.sender === "user" ? <UserIcon /> : <Brain className="w-3.5 h-3.5" />}
                          </div>
                          <div className={`p-3 rounded-xl text-[10.5px] leading-normal ${
                            msg.sender === "user" 
                              ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" 
                              : "bg-slate-900 border border-slate-800/80 text-slate-200"
                          }`}>
                            <p className="whitespace-pre-line">{msg.text}</p>
                          </div>
                        </div>
                      ))}

                      {/* AI Typing Loader Indicator */}
                      {isAiTyping && (
                        <div className="flex gap-2 self-start max-w-[80%]">
                          <div className="w-6 h-6 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center shrink-0">
                            <Brain className="w-3.5 h-3.5 animate-pulse" />
                          </div>
                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 text-slate-400 text-[10px] italic flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                            <span>{lang === "ar" ? "جاري البحث في قاعدة بيانات PostgreSQL واستخلاص الدروس..." : "Consulting causal memory tables..."}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Suggested Prompts Block */}
                    {advisorMessages.length === 0 && !isAiTyping && (
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">{lang === "ar" ? "استفسارات مؤسسية مقترحة" : "Suggested Queries"}</span>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            lang === "ar" ? "ما هي الدروس المستفادة من تأخير تحوط مخاطر الصرف؟" : "What are the lessons learned from delaying exchange rate hedging?",
                            lang === "ar" ? "تحليل أسباب تأخير جمارك ميناء طنجة" : "Analyze the causes of customs classification delays at Tangier port",
                            lang === "ar" ? "مراجعة ثغرات التحويل المصرفي للشريك الإسباني" : "Review bank transfer compliance gaps for Spanish partner",
                            lang === "ar" ? "كيف نتجنب أزمات السيولة لدورة رأس المال؟" : "How to prevent short-term liquidity deficits in working capital?"
                          ].map((queryText, i) => (
                            <div
                              key={i}
                              data-demo-target={`suggested-query-${i}`}
                              onClick={() => handleSuggestedQueryClick(i)}
                              className="p-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60 text-[9.5px] hover:border-slate-700 hover:text-amber-400 text-slate-300 transition-all font-bold truncate cursor-pointer"
                            >
                              {queryText}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Send Input Simulation */}
                    <div className="flex gap-2">
                      <div 
                        data-demo-target="advisor-prompt"
                        className="flex-1 h-9 bg-slate-900 border border-slate-800/80 rounded-lg px-2.5 flex items-center gap-2"
                      >
                        <input
                          type="text"
                          readOnly
                          value={advisorInput}
                          className="bg-transparent border-none text-[11px] text-slate-200 focus:outline-none flex-1 placeholder-slate-700"
                          placeholder={lang === "ar" ? "اسأل عن أي قرار أو توصيات استراتيجية..." : "Query institutional amnesia patterns..."}
                        />
                      </div>
                      <div
                        data-demo-target="send-query-btn"
                        className="w-9 h-9 bg-amber-500 text-slate-950 font-bold rounded-lg flex items-center justify-center cursor-pointer shadow-md shadow-amber-500/10"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* VIEW D: SMART EVOLUTION */}
                {activeTab === "smart" && (
                  <motion.div
                    key="smart-view"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="space-y-4 w-full"
                  >
                    {/* Header with Title and AI Analysis Trigger Button */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-black text-white">{lang === "ar" ? "التطور الذكي" : "Smart Evolution Engine"}</h2>
                        <p className="text-[10px] text-slate-400">{lang === "ar" ? "تشخيصات مدعومة بالذكاء الاصطناعي وتوقعات المخاطر والتوصيات بناءً على الذاكرة الحالية." : "Predictive alerts, risk forecasts, and preventative action items compiled by AI."}</p>
                      </div>
                      
                      <button
                        data-demo-target="run-smart-analysis-btn"
                        onClick={() => {
                          if (smartAnalysisState === "idle") {
                            setSmartAnalysisState("analyzing");
                            setTimeout(() => {
                              setSmartAnalysisState("completed");
                            }, 2500);
                          }
                        }}
                        disabled={smartAnalysisState === "analyzing"}
                        className="h-9 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold text-[10px] rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                      >
                        {smartAnalysisState === "analyzing" ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-slate-950" />
                            <span>{lang === "ar" ? "جاري التحليل..." : "Analyzing..."}</span>
                          </>
                        ) : (
                          <>
                            <Brain className="w-3 h-3 text-slate-950" />
                            <span>{lang === "ar" ? "تشغيل التحليل بالذكاء الاصطناعي" : "Run AI Analysis"}</span>
                          </>
                        )}
                      </button>
                    </div>

                    <AnimatePresence mode="wait">
                      {smartAnalysisState === "idle" && (
                        <motion.div
                          key="smart-idle"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="p-8 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center justify-center text-center space-y-3 py-12"
                        >
                          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                            <Brain className="w-6 h-6 animate-pulse" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-sm font-bold text-white">
                              {lang === "ar" ? "التحليل الإدراكي معلق" : "Cognitive Analysis Pending"}
                            </h3>
                            <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                              {lang === "ar" 
                                ? "الرجاء النقر فوق زر 'تشغيل التحليل بالذكاء الاصطناعي' لبدء سحب البيانات واستخراج التوقعات التشخيصية."
                                : "Please click 'Run AI Analysis' to pull current memories and generate diagnostics forecasts."}
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {smartAnalysisState === "analyzing" && (
                        <motion.div
                          key="smart-analyzing"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="p-8 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center justify-center text-center space-y-4 py-12"
                        >
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full border border-amber-500/10 flex items-center justify-center">
                              <Brain className="w-6 h-6 text-amber-400 animate-pulse" />
                            </div>
                            <div className="absolute inset-0 rounded-full border-2 border-t-amber-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                          </div>
                          
                          <div className="space-y-1">
                            <h3 className="text-sm font-bold text-white">
                              {lang === "ar" ? "جاري تشغيل التحليل الإدراكي..." : "Running Cognitive Diagnostics..."}
                            </h3>
                            <div className="flex items-center justify-center gap-1.5 mt-2">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-2 leading-relaxed">
                              {lang === "ar" ? "تحليل causal factors ومطابقتها بالتصنيفات الجمركية وقواعد البيانات" : "Synthesizing causal factors, compliance risks, and database security"}
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {smartAnalysisState === "completed" && (
                        <motion.div
                          key="smart-results"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="space-y-4"
                        >
                          {/* Operational AI Diagnostic KPI Banner - Staggered fade in */}
                          <div className="grid grid-cols-4 gap-2">
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 }}
                              className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between"
                            >
                              <span className="text-[8px] font-black text-amber-400 uppercase">{lang === "ar" ? "إجمالي السجلات" : "TOTAL MEMORIES"}</span>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-sm font-black text-white">{memories.length}</span>
                                <FileText className="w-3.5 h-3.5 text-amber-400" />
                              </div>
                            </motion.div>
                            
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 }}
                              className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col justify-between"
                            >
                              <span className="text-[8px] font-black text-rose-400 uppercase">{lang === "ar" ? "المخاطر النشطة" : "ACTIVE RISKS"}</span>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-sm font-black text-white">1</span>
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                              </div>
                            </motion.div>

                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 }}
                              className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col justify-between"
                            >
                              <span className="text-[8px] font-black text-blue-400 uppercase">{lang === "ar" ? "الفرص المرصودة" : "OPPORTUNITIES"}</span>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-sm font-black text-white">2</span>
                                <Compass className="w-3.5 h-3.5 text-blue-400" />
                              </div>
                            </motion.div>

                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.4 }}
                              className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between"
                            >
                              <span className="text-[8px] font-black text-emerald-400 uppercase">{lang === "ar" ? "التوصيات الجاهزة" : "RECOMMENDATIONS"}</span>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-sm font-black text-white">2</span>
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              </div>
                            </motion.div>
                          </div>

                          {/* Executive Diagnostic Narrative Box */}
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1"
                          >
                            <span className="text-[8px] font-black text-amber-400 uppercase tracking-wider">{lang === "ar" ? "ملخص التشخيص الذكي للعمليات" : "AI Operational Diagnosis Summary"}</span>
                            <p className="text-[10px] text-slate-200 leading-relaxed">
                              {lang === "ar"
                                ? "يكشف تحليل ذكريات الذاكرة المؤسسية عن نقاط خطر حيوية ونمط غير مغطى من مخاطر الصرف في الربع الأخير. نوصي باتباع مسار التحوط الوقائي المقترح وتفعيل المزامنة الجمركية تلقائياً."
                                : "Analyzing institutional memories reveals critical risk points and unhedged FX exposures in the last quarter. Immediate adoption of protective call options combined with quarterly automated HTS sweeps is recommended."}
                            </p>
                          </motion.div>

                          {/* Sub tabs inside view */}
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="flex border-b border-slate-800/80 gap-4"
                          >
                            {[
                              { id: "predictions", label: lang === "ar" ? "توقعات المخاطر" : "Risk Forecasts" },
                              { id: "opportunities", label: lang === "ar" ? "الفرص المتاحة" : "Opportunities" },
                              { id: "risks", label: lang === "ar" ? "المخاطر المحددة" : "Identified Risks" },
                              { id: "recommendations", label: lang === "ar" ? "التوصيات الإجرائية" : "Actionable Recommendations" }
                            ].map((subTab) => (
                              <div
                                key={subTab.id}
                                data-demo-target={`smart-tab-${subTab.id}`}
                                className={`pb-1.5 text-[10px] font-black transition-all border-b-2 cursor-pointer ${
                                  smartActiveTab === subTab.id 
                                    ? "border-amber-400 text-amber-400" 
                                    : "border-transparent text-slate-500 hover:text-slate-300"
                                }`}
                                onClick={() => setSmartActiveTab(subTab.id as any)}
                              >
                                {subTab.label}
                              </div>
                            ))}
                          </motion.div>

                          <AnimatePresence mode="wait">
                            {smartActiveTab === "predictions" && (
                              <motion.div
                                key="smart-pred"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-2 gap-3"
                              >
                                {/* Radial Progress Charts simulation */}
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: 0.7 }}
                                  className="p-3 bg-slate-900/60 border border-slate-800/50 rounded-xl flex flex-col items-center justify-center text-center space-y-2"
                                >
                                  <span className="text-[9px] font-bold text-slate-400">{lang === "ar" ? "كفاءة حماية الأصول" : "Asset Protection Level"}</span>
                                  <div className="relative w-16 h-16 flex items-center justify-center">
                                    <svg className="w-full h-full -rotate-90">
                                      <circle cx="32" cy="32" r="26" className="stroke-slate-800 fill-none" strokeWidth="5" />
                                      <circle cx="32" cy="32" r="26" className="stroke-amber-400 fill-none" strokeWidth="5" strokeDasharray="163" strokeDashoffset="30" strokeLinecap="round" />
                                    </svg>
                                    <span className="absolute text-xs font-black text-white">82%</span>
                                  </div>
                                  <p className="text-[8.5px] text-slate-500">{lang === "ar" ? "انخفاض مخاطر الصرف بنسبة 35% بعد الذاكرة الأخيرة" : "FX exposure reduced by 35% due to the financial hedging rule"}</p>
                                </motion.div>

                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: 0.8 }}
                                  className="p-3 bg-slate-900/60 border border-slate-800/50 rounded-xl flex flex-col items-center justify-center text-center space-y-2"
                                >
                                  <span className="text-[9px] font-bold text-slate-400">{lang === "ar" ? "حماية الامتثال التنظيمي" : "Compliance Safety Margin"}</span>
                                  <div className="relative w-16 h-16 flex items-center justify-center">
                                    <svg className="w-full h-full -rotate-90">
                                      <circle cx="32" cy="32" r="26" className="stroke-slate-800 fill-none" strokeWidth="5" />
                                      <circle cx="32" cy="32" r="26" className="stroke-emerald-400 fill-none" strokeWidth="5" strokeDasharray="163" strokeDashoffset="8" strokeLinecap="round" />
                                    </svg>
                                    <span className="absolute text-xs font-black text-white">95%</span>
                                  </div>
                                  <p className="text-[8.5px] text-slate-500">{lang === "ar" ? "مستوى حماية ممتاز جداً ضد حظر التحويلات" : "Excellent compliance buffer; no recent AML/HTS anomalies"}</p>
                                </motion.div>
                              </motion.div>
                            )}

                            {smartActiveTab === "opportunities" && (
                              <motion.div
                                key="smart-opp"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-2"
                              >
                                <motion.div 
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.1 }}
                                  className="p-2.5 bg-slate-900/80 border-r-2 border-blue-500 rounded-lg flex items-start gap-2"
                                >
                                  <Compass className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                  <div>
                                    <h5 className="text-[10px] font-black text-white">{lang === "ar" ? "أتمتة عمليات الخزينة العامة" : "Automate Treasury Operations"}</h5>
                                    <p className="text-[9px] text-slate-400 leading-normal mt-0.5">
                                      {lang === "ar" 
                                        ? "تأسيس ربط لحظي بالكامل مع منصة البنك الوسيط للاستفادة من تخفيض فوائد بنسبة ٢٪ وتحسين التدفق النقدي."
                                        : "Establish real-time API integrations with banking registers to capture 2% interest reductions and liquidity."}
                                    </p>
                                  </div>
                                </motion.div>

                                <motion.div 
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.2 }}
                                  className="p-2.5 bg-slate-900/80 border-r-2 border-cyan-500 rounded-lg flex items-start gap-2"
                                >
                                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                  <div>
                                    <h5 className="text-[10px] font-black text-white">{lang === "ar" ? "خطوط التخليص المسبق للجمارك" : "Pre-Clearing Custom Channels"}</h5>
                                    <p className="text-[9px] text-slate-400 leading-normal mt-0.5">
                                      {lang === "ar" 
                                        ? "تطبيق التصنيف الجمركي المسبق المعتمد لإنهاء غرامات التأخير الإضافية بميناء طنجة بنسبة ١٠٠٪."
                                        : "Introduce pre-vetted classifications to eliminate future Tangier storage surcharges completely."}
                                    </p>
                                  </div>
                                </motion.div>
                              </motion.div>
                            )}

                            {smartActiveTab === "risks" && (
                              <motion.div
                                key="smart-risks"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1"
                              >
                                {[
                                  {
                                    icon: TrendingDown,
                                    color: "text-red-500",
                                    borderColor: "border-red-500",
                                    titleAr: "مخاطر السوق: تراجع السلع الأساسية",
                                    titleEn: "Market Risk: Commodity Volatility",
                                    descAr: "تذبذب أسعار سلة الطاقة يؤثر سلباً على موازنة الصرف وتكلفة الوقود لعام 2026.",
                                    descEn: "Energy basket price volatility negatively impacts currency reserves and 2026 fuel models."
                                  },
                                  {
                                    icon: Users,
                                    color: "text-orange-500",
                                    borderColor: "border-orange-500",
                                    titleAr: "مخاطر الائتمان: المورد الإسباني",
                                    titleEn: "Credit Risk: Counterparty Compliance",
                                    descAr: "احتمالية تعثر أو تأخر تسويات الشريك الإسباني بسبب تجميد التحويلات المصرفية المتكرر.",
                                    descEn: "Spanish partner settlement delays due to sudden frozen compliance verification cycles."
                                  },
                                  {
                                    icon: AlertTriangle,
                                    color: "text-yellow-500",
                                    borderColor: "border-yellow-500",
                                    titleAr: "مخاطر السيولة: عجز دورة رأس المال",
                                    titleEn: "Liquidity Risk: Capital Cycle Deficits",
                                    descAr: "انخفاض التدفقات النقدية السريعة بمعدل 12% نتيجة اختلاف شروط تحصيل الدفعات (90 يوماً).",
                                    descEn: "12% quick ratio drops due to mismatched 90-day customer receivable terms vs. payouts."
                                  },
                                  {
                                    icon: Activity,
                                    color: "text-violet-500",
                                    borderColor: "border-violet-500",
                                    titleAr: "مخاطر أسعار الفائدة: القروض المتغيرة",
                                    titleEn: "Interest Rate Risk: Floating Loans",
                                    descAr: "ارتفاع الفائدة الفيدرالية بنسبة 3% يؤدي لتضخم كلفة تمويل القرض الاستثماري دون تحوط كامل.",
                                    descEn: "Unexpected central bank rate hikes inflate variable debt servicing by 3% without swaps."
                                  },
                                  {
                                    icon: Globe,
                                    color: "text-blue-500",
                                    borderColor: "border-blue-500",
                                    titleAr: "مخاطر أسعار الصرف: تقلبات EUR/USD",
                                    titleEn: "Currency Risk: EUR/USD Fluctuations",
                                    descAr: "عدم تطابقة التدفقات بالدولار واليورو قد يسبب خسارة ترجمة عملات بنسبة 8% مالم تُفعل الخيارات.",
                                    descEn: "Mismatched USD/EUR cash flows threaten an 8% translation loss unless options are triggered."
                                  },
                                  {
                                    icon: ShieldAlert,
                                    color: "text-pink-500",
                                    borderColor: "border-pink-500",
                                    titleAr: "المخاطر التشغيلية: غرامات جمارك طنجة",
                                    titleEn: "Operational Risk: Tangier Storage Fees",
                                    descAr: "تكبد 45 ألف دولار غرامات يومية بسبب الإدخال اليدوي الخاطئ لرموز التعريفة الجمركية.",
                                    descEn: "Incurring $45,000 daily demurrage due to manual classification errors and lack of HTS library."
                                  }
                                ].map((risk, index) => {
                                  const RiskIcon = risk.icon;
                                  return (
                                    <motion.div 
                                      key={index}
                                      initial={{ opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ delay: index * 0.08 }}
                                      className={`p-2 bg-slate-900/90 border-r-2 ${risk.borderColor} rounded-lg flex items-start gap-1.5`}
                                    >
                                      <RiskIcon className={`w-3.5 h-3.5 ${risk.color} shrink-0 mt-0.5`} />
                                      <div>
                                        <h5 className="text-[9px] font-black text-white">{lang === "ar" ? risk.titleAr : risk.titleEn}</h5>
                                        <p className="text-[8px] text-slate-400 leading-normal mt-0.5">
                                          {lang === "ar" ? risk.descAr : risk.descEn}
                                        </p>
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </motion.div>
                            )}

                            {smartActiveTab === "recommendations" && (
                              <motion.div
                                key="smart-recs"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-2"
                              >
                                <motion.div 
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.1 }}
                                  className="p-2.5 bg-slate-900/80 border-r-2 border-amber-500 rounded-lg flex items-start gap-2"
                                >
                                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                  <div>
                                    <h5 className="text-[10px] font-black text-white">{lang === "ar" ? "عزل ميزانيات التحوط بقسم الطيران فوراً" : "Enforce Isolated Aviation Hedging Budgets"}</h5>
                                    <p className="text-[9px] text-slate-400 leading-normal mt-0.5">
                                      {lang === "ar" 
                                        ? "تجنباً لتكرار تجميد دفعة الربع الثالث، يوصى بنقل صلاحيات الخيار بالكامل إلى نظام الشراء المؤتمت."
                                        : "De-link cash reserves. Allow purchase engines to buy options automatically when Brent shifts > 5%."}
                                    </p>
                                  </div>
                                </motion.div>

                                <motion.div 
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.2 }}
                                  className="p-2.5 bg-slate-900/80 border-r-2 border-emerald-500 rounded-lg flex items-start gap-2"
                                >
                                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                  <div>
                                    <h5 className="text-[10px] font-black text-white">{lang === "ar" ? "مزامنة رموز التعرفة الجمركية بميناء طنجة" : "Synchronize Tangier Port HTS Code Vault"}</h5>
                                    <p className="text-[9px] text-slate-400 leading-normal mt-0.5">
                                      {lang === "ar" 
                                        ? "تم تدوين وحل أصل المشكلة اللوجستية بنجاح بنسبة 100% لتفادي تكرار غرامات التصنيف الخاطئ."
                                        : "Compliance rule verified. Keep local warehouse records updated automatically every quarter."}
                                    </p>
                                  </div>
                                </motion.div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* VIEW E: MARKET INTELLIGENCE */}
                {activeTab === "market" && (
                  <motion.div
                    key="market-view"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="space-y-4 max-w-2xl mx-auto w-full"
                  >
                    <div>
                      <h2 className="text-lg font-black text-white">{lang === "ar" ? "ذكاء السوق الاستراتيجي" : "Market Intelligence Radar"}</h2>
                      <p className="text-[10px] text-slate-400">{lang === "ar" ? "دراسة اتجاهات السوق العالمية لتفادي تكرار أخطاء القرارات." : "Match external global economic fluctuations against internal amnesia logs."}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/50 space-y-3.5">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{lang === "ar" ? "موضوع السوق / الاتجاه المراد تحليله" : "Global Topic / Trend to Analyze"}</label>
                        <input
                          type="text"
                          readOnly
                          value={marketTopic}
                          data-demo-target="market-topic-input"
                          placeholder={lang === "ar" ? "مثال: تذبذب أسعار خام برنت أو أسعار الفائدة الفيدرالية..." : "e.g. Federal reserve rate hikes or oil price volatility..."}
                          className="w-full h-9 px-3 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-white focus:outline-none placeholder-slate-700 font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{lang === "ar" ? "القطاع المستهدف" : "Target Industry"}</label>
                          <select disabled className="w-full h-9 px-2 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-slate-300">
                            <option>Supply Chain & Shipping</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">{lang === "ar" ? "سياق التركيز الاختياري" : "Optional Geographic Scope"}</label>
                          <input readOnly value="Global" className="w-full h-9 px-3 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-slate-400 focus:outline-none" />
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <div 
                          data-demo-target="market-run-btn"
                          className="px-5 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10"
                        >
                          <Globe className="w-4 h-4" />
                          <span>{lang === "ar" ? "بدء تقييم السوق بالذكاء الاصطناعي" : "Run Market Assessment"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Simulation Result */}
                    <AnimatePresence>
                      {isMarketAnalyzing && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center flex flex-col items-center justify-center space-y-2"
                        >
                          <Activity className="w-5 h-5 text-amber-400 animate-spin" />
                          <span className="text-[10.5px] text-slate-400 italic font-medium">{lang === "ar" ? "جاري مطابقة تذبذب الصرف والـ EUR/USD مع سجلات التحوط بالهندسة المالية لـ Zakir..." : "Matching global EUR/USD volatility against past Financial Engineering memories..."}</span>
                        </motion.div>
                      )}

                      {marketAnalysisResult && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">{lang === "ar" ? "التقرير النهائي لذكاء السوق" : "Market Intelligence Report"}</span>
                            <span className="px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[8px] font-black rounded">{lang === "ar" ? "تهديد مرتفع" : "High Risk Threat"}</span>
                          </div>
                          <p className="text-[11px] text-slate-200 leading-relaxed font-bold">
                            {lang === "ar" 
                              ? "تم العثور على ترابط بنسبة 91% بين التذبذب الجاري لـ EUR/USD والتحوط المالي المفقود لإدارة مخاطر الصرف الأجنبي (الذاكرة #3)."
                              : "Identified a 91% correlation pattern between ongoing EUR/USD fluctuations and the recent unhedged FX translation risk (Memory block #3)."}
                          </p>
                          <p className="text-[10px] text-amber-300 flex items-start gap-1 font-medium bg-amber-500/5 p-2 rounded border border-amber-500/10">
                            <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                            {lang === "ar"
                              ? "التحوط الدفاعي الفوري مطلوب. نوصي بتطبيق توصيات الذاكرة #3 بتوطين عقود خيارات ثنائية وتفعيل التداول الآلي فوراً لتجنب خسائر ترجمة عملات إضافية."
                              : "Action Required: Adopt Memory #3 workflow immediately. Execute option collar contracts to neutralize ongoing EUR/USD translation liabilities."}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* 3. DYNAMIC CURSOR AND RIPPLING SYSTEM */}
        
        {/* Click Ripples Rendering */}
        {ripples.map(r => (
          <span
            key={r.id}
            style={{ left: r.x, top: r.y }}
            className="absolute w-12 h-12 -ml-6 -mt-6 border border-amber-500 rounded-full animate-ping pointer-events-none opacity-85 shadow-[0_0_15px_rgba(212,175,55,0.4)]"
          />
        ))}

        {/* Premium Smooth Animated Cursor */}
        <motion.div
          animate={{ x: cursorPos.x, y: cursorPos.y }}
          transition={{ type: "spring", stiffness: 60, damping: 14 }}
          style={{ position: "absolute", left: 0, top: 0 }}
          className="pointer-events-none z-50 select-none"
        >
          {/* Mouse Cursor Styling - Elegant Vector Pointer */}
          <motion.div
            animate={{ scale: isClicking ? 0.82 : 1 }}
            transition={{ duration: 0.15 }}
            className="relative"
          >
            {/* Custom glowing cursor circle */}
            <span className="absolute -left-3.5 -top-3.5 w-7 h-7 bg-amber-500/15 rounded-full blur-[3px]" />
            
            {/* The Pointer arrow */}
            <svg
              className="w-5.5 h-5.5 drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)] fill-slate-950 stroke-amber-400"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

// Simple User Mock Icon
const UserIcon: React.FC = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v-2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export default ProductShowcaseWindow;
