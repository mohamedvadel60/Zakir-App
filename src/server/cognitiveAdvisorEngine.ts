import { GoogleGenAI } from "@google/genai";
import { getGeminiClient, isGeminiInCooldown, handleGeminiError } from "../../server.js";
import { classifySearchNeed } from "./smartEvolutionService.js";

// --- DOMAIN TYPES ---
export type AdvisorIntent =
  | "CASUAL_CONVERSATION"
  | "GENERAL_KNOWLEDGE"
  | "BUSINESS_ADVICE"
  | "FINANCIAL_ANALYSIS"
  | "RISK_ANALYSIS"
  | "DIAGNOSTIC_REQUEST"
  | "EXECUTIVE_REPORT"
  | "STRATEGIC_RECOMMENDATION"
  | "CLARIFICATION_NEEDED"
  | "FOLLOW_UP"
  | "UNCERTAIN_HYPOTHESIS"
  | "INSUFFICIENT_DATA_QUERY"
  | "MEMORY_QUERY"
  | "FILE_ANALYSIS"
  | "ORGANIZATION_ANALYSIS"
  | "OTHER";

export interface AdvisorContext {
  promptText: string;
  history?: Array<{ role: "user" | "model" | "assistant"; text: string }>;
  lang?: "ar" | "en" | "fr";
  memories?: any[];
  riskAlerts?: any[];
  files?: any[];
  advisorType?: "cognitive" | "administrative" | "unified";
  user?: any;
}

// --- CONTEXT & TOPIC RESOLVER ---
export function resolveConversationTopic(
  history: Array<{ role: string; text: string }> | undefined
): string | null {
  if (!history || !Array.isArray(history) || history.length === 0) return null;
  const recent = history.slice(-4).reverse();
  for (const m of recent) {
    const text = (m.text || "").toLowerCase();
    if (text.includes("سيولة") || text.includes("تدفق نقدي") || text.includes("تحصيل") || text.includes("التزام")) {
      return "السيولة والتدفق النقدي";
    }
    if (text.includes("مستثمر") || text.includes("تفاوض") || text.includes("جولة") || text.includes("تمويل")) {
      return "التحضير للمستثمر والتمويل";
    }
    if (text.includes("مبيعات") || text.includes("عملاء") || text.includes("تسويق") || text.includes("إيرادات")) {
      return "نمو الإيرادات والمبيعات";
    }
    if (text.includes("مخاطر") || text.includes("تحوط") || text.includes("امتثال") || text.includes("عقوبات")) {
      return "إدارة المخاطر والتحوط";
    }
    if (text.includes("تكلفة") || text.includes("هامش") || text.includes("مصروفات") || text.includes("ربحية")) {
      return "ضبط التكاليف وهامش الربحية";
    }
    if (text.includes("حوكمة") || text.includes("قرارات") || text.includes("إجراءات") || text.includes("توثيق")) {
      return "الحوكمة والتوثيق المؤسسي";
    }
  }
  return null;
}

// --- INTENT CLASSIFICATION WITH CONTEXT AWARENESS ---
export function classifyCognitiveIntent(
  promptText: string,
  history?: Array<{ role: string; text: string }>
): {
  intent: AdvisorIntent;
  requiresPrivateData: boolean;
  isReportOrDiagnostic: boolean;
  activeTopic: string | null;
  detectedHypothesis: string | null;
} {
  const clean = (promptText || "").trim().toLowerCase();
  const activeTopic = resolveConversationTopic(history);

  // 1. Casual / Greetings / Gratitude / Identity
  const isCasualGreeting =
    /^(مرحبا|مرحباً|أهلا|أهلاً|سلام|السلام عليكم|أهلين|صباح الخير|مساء الخير|hi|hello|hey|greetings)/i.test(clean) ||
    clean.includes("صباح الخير") ||
    clean.includes("مساء الخير") ||
    clean.includes("كيف حالك") ||
    clean.includes("من أنت") ||
    clean.includes("شكرا") ||
    clean.includes("شكراً");

  if (isCasualGreeting && clean.length < 50) {
    return {
      intent: "CASUAL_CONVERSATION",
      requiresPrivateData: false,
      isReportOrDiagnostic: false,
      activeTopic,
      detectedHypothesis: null,
    };
  }

  // 2. Contextual Follow-up (e.g., "وماذا أفعل؟", "ما الحل؟", "كيف أبدأ؟", "ما الخطوة التالية؟")
  const followUpPattern = /^(وماذا أفعل|ماذا أفعل|ما العمل|ما الحل|كيف أبدأ|ما رأيك|ما رأيك الآن|ما الخطوة التالية|كيف أتصرف|ما الإجراء المناسب|what should i do|what to do next|how to start)$/i;
  if (followUpPattern.test(clean) || clean === "وماذا أفعل؟" || clean === "ما الحل؟" || clean === "ما الخطوة التالية؟") {
    if (activeTopic) {
      return {
        intent: "FOLLOW_UP",
        requiresPrivateData: false,
        isReportOrDiagnostic: false,
        activeTopic,
        detectedHypothesis: null,
      };
    }
  }

  // 3. Explicit Database Memory / Risk / Org Queries (Strictly Private)
  const memoryPatterns = /(الذكريات المسجلة في حسابي|سجل الذكريات المحفوظة|سجلات القرارات المخزنة|ماذا سجلنا في القاعدة|ذاكرة المؤسسة المسجلة|registered memories in database|logged decision records)/i;
  if (memoryPatterns.test(clean)) {
    return {
      intent: "MEMORY_QUERY",
      requiresPrivateData: true,
      isReportOrDiagnostic: false,
      activeTopic,
      detectedHypothesis: null,
    };
  }

  const riskDbPatterns = /(المخاطر المسجلة في حسابي|المخاطر النشطة في النظام|انكشافاتنا المخزنة|our database logged risks|stored risk alerts)/i;
  if (riskDbPatterns.test(clean)) {
    return {
      intent: "RISK_ANALYSIS",
      requiresPrivateData: true,
      isReportOrDiagnostic: true,
      activeTopic,
      detectedHypothesis: null,
    };
  }

  // 4. Unverified / Uncertain Hypothesis
  const hypothesisPattern = /(ستواجه أزمة حتمية|الشركة ستنهار|ضعف مالي شامل|فشل مالي مؤكد|سنفلس|خاسرون لا محالة|ستفلسالأسبوع القادم)/i;
  if (hypothesisPattern.test(clean)) {
    return {
      intent: "UNCERTAIN_HYPOTHESIS",
      requiresPrivateData: false,
      isReportOrDiagnostic: false,
      activeTopic,
      detectedHypothesis: clean,
    };
  }

  // 5. Diagnostic Request
  const diagnosticPattern = /(تشخيص|شخص|مشكلة الفجوة|فجوة بين|أسباب التعثر|فحص الوضع|diagnose|diagnostic|root cause)/i;
  if (diagnosticPattern.test(clean)) {
    return {
      intent: "DIAGNOSTIC_REQUEST",
      requiresPrivateData: false,
      isReportOrDiagnostic: true,
      activeTopic,
      detectedHypothesis: null,
    };
  }

  // 6. Executive Report Request
  const reportPattern = /(تقرير إداري|تقرير تنفيذي|تقرير شامل|أعد لي تقريراً|أعد تقريراً|ملخص تنفيذي|executive report|management report)/i;
  if (reportPattern.test(clean)) {
    return {
      intent: "EXECUTIVE_REPORT",
      requiresPrivateData: false,
      isReportOrDiagnostic: true,
      activeTopic,
      detectedHypothesis: null,
    };
  }

  // 7. Strategic Recommendation Request
  const recommendationPattern = /(توصية استراتيجية|التوصية الاستراتيجية|ما هي التوصية|ما هي التوصيات|أعطني توصيات|recommendation|strategic recommendation)/i;
  if (recommendationPattern.test(clean)) {
    return {
      intent: "STRATEGIC_RECOMMENDATION",
      requiresPrivateData: false,
      isReportOrDiagnostic: false,
      activeTopic,
      detectedHypothesis: null,
    };
  }

  // 8. Risk Analysis & FX Hedging
  const riskPattern = /(مخاطر|انكشاف|تحوط|سلاسل الإمداد|عقوبات|امتثال|أسعار الصرف|تقلبات العملة|عقود دولية|risk|exposure|hedging|fx)/i;
  if (riskPattern.test(clean)) {
    return {
      intent: "RISK_ANALYSIS",
      requiresPrivateData: false,
      isReportOrDiagnostic: false,
      activeTopic,
      detectedHypothesis: null,
    };
  }

  // 9. Financial Analysis & Cash Flow
  const financialPattern = /(سيولة|تدفق نقدي|أرباح|إيرادات|قوائم مالية|رأس المال العامل|ميزانية|هوامش الربح|تحليل مالي|financial|cash flow|liquidity|profit margin)/i;
  if (financialPattern.test(clean)) {
    const isConceptual = /(ما هو|ما هي|ما الفرق|عرف|تعريف|مفهوم|معنى|what is|define)/i.test(clean);
    return {
      intent: isConceptual ? "GENERAL_KNOWLEDGE" : "FINANCIAL_ANALYSIS",
      requiresPrivateData: false,
      isReportOrDiagnostic: false,
      activeTopic,
      detectedHypothesis: null,
    };
  }

  // 10. General Knowledge & Governance
  const generalKnowledgePattern = /(ما هو|ما هي|ما الفرق|اشرح لي|عرف|تعريف|مفهوم|معنى|حوكمة|مبادئ حوكمة|what is|explain|difference between|definition of|governance)/i;
  if (generalKnowledgePattern.test(clean)) {
    return {
      intent: "GENERAL_KNOWLEDGE",
      requiresPrivateData: false,
      isReportOrDiagnostic: false,
      activeTopic,
      detectedHypothesis: null,
    };
  }

  // 11. Business Advice & Management Strategy
  const businessAdvicePattern = /(مواءمة الأهداف|فرق العمل|الفرق القيادية|كيف يمكنني|نصيحة إدارية|لدي مشكلة في|أفضل طريقة ل|كيف أتعامل مع|تحسين العمليات|تطوير القيادة|كيف أحسن إدارة|أريد أن أتحدث عن شركتي|لدي اجتماع مع مستثمر|فكرة غير متوقعة|خط إنتاج جديد|تصدير|توسع|استراتيجية|نمو)/i;
  if (businessAdvicePattern.test(clean)) {
    return {
      intent: "BUSINESS_ADVICE",
      requiresPrivateData: false,
      isReportOrDiagnostic: false,
      activeTopic,
      detectedHypothesis: null,
    };
  }

  // 12. Vague / Isolated Inputs without context -> Clarification Needed
  const standaloneVague = /^(حلل|تحليل|أريد مساعدة|ساعدني|مساعدة|ماذا ترى|انصحني|help|analyze)$/i;
  const vagueInquiries = /^(اشرح لي هذا|لم أفهم|اشرح أكثر|ما رأيك في هذه الفكرة|ماذا تنصحني|هل يمكنك مساعدتي في قرار)$/i;
  if (!activeTopic && (standaloneVague.test(clean) || vagueInquiries.test(clean) || clean.length <= 4)) {
    return {
      intent: "CLARIFICATION_NEEDED",
      requiresPrivateData: false,
      isReportOrDiagnostic: false,
      activeTopic: null,
      detectedHypothesis: null,
    };
  }

  return {
    intent: "OTHER",
    requiresPrivateData: false,
    isReportOrDiagnostic: false,
    activeTopic,
    detectedHypothesis: null,
  };
}

// --- RESPONSE QUALITY GUARD ---
export function validateAndRefineAdvisorResponse(
  rawText: string,
  intent: AdvisorIntent,
  query: string
): string {
  if (!rawText || typeof rawText !== "string") {
    return "المؤشر الأهم هنا يكمن في مواءمة القرارات التشغيلية مع معطيات السيولة والتدفق النقدي الفعلية لضمان الاستقرار المؤسسي.";
  }

  let text = rawText.trim();

  // 1. Remove internal reasoning / thought tags
  text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
  text = text.replace(/\[SYSTEM_PROMPT[\s\S]*?\]/gi, "");
  text = text.replace(/```json[\s\S]*?```/gi, "");
  text = text.replace(/```[\s\S]*?```/gi, "");

  // 2. Remove emojis strictly
  text = text.replace(
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|⭐|🚀|💡|⚠️|🔥|✅|❌|📊|🤖|🎯|📌|🔹|🔸|⚡|✨|🛡️|🚨/gu,
    ""
  );

  // 3. Remove prohibited robotic / AI tags
  text = text.replace(/🚨\s*تحليل خطير جداً!*!*!*/gi, "");
  text = text.replace(/\bAI Analysis\b/gi, "");
  text = text.replace(/\bGenerated by AI\b/gi, "");
  text = text.replace(/\bSystem detected\b/gi, "");
  text = text.replace(/\bTechnical diagnosis\b/gi, "");
  text = text.replace(/تحليل الذكاء الاصطناعي/gi, "");
  text = text.replace(/النظام رصد/gi, "");

  // 4. Remove robotic boilerplate question regurgitation
  text = text.replace(
    /تعتمد إدارة الأعمال الحديثة على مواءمة الأهداف الاستراتيجية مع المؤشرات التشغيلية والرقابة المستمرة\.\s*بالنسبة لاستفسارك حول \(\*\*.*?\*\*\)،?\s*يوصى بالتركيز على:/gi,
    ""
  );
  text = text.replace(
    /بالنسبة لاستفسارك حول \(\*\*.*?\*\*\)،?\s*يوصى بالتركيز على:/gi,
    ""
  );

  // 5. Remove consecutive duplicate sentences or lines
  const lines = text.split("\n");
  const uniqueLines: string[] = [];
  const seenLineHashes = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      uniqueLines.push("");
      continue;
    }
    if (trimmed.startsWith("#")) {
      uniqueLines.push(trimmed);
      continue;
    }
    const normalized = trimmed.replace(/\s+/g, " ").toLowerCase();
    if (!seenLineHashes.has(normalized)) {
      seenLineHashes.add(normalized);
      uniqueLines.push(trimmed);
    }
  }

  text = uniqueLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

// --- HIGH-FIDELITY COGNITIVE ADVISOR REASONING SYNTHESIS ---
export function synthesizeCognitiveResponse(
  context: AdvisorContext,
  analysis: ReturnType<typeof classifyCognitiveIntent>
): string {
  const { promptText, lang = "ar", memories = [] } = context;
  const { intent, activeTopic, detectedHypothesis } = analysis;
  const isAr = lang === "ar";
  const clean = promptText.trim().toLowerCase();

  // Case 1: Casual / Greeting / Identity / Thanks
  if (intent === "CASUAL_CONVERSATION") {
    if (clean.includes("كيف حالك") || clean.includes("how are you")) {
      return isAr
        ? "أنا بخير ومستعد تماماً لمساندتك. تفضل بطرح المسألة الإدارية أو الاستراتيجية التي تشغل اهتمامك اليوم لنبدأ تحليلها معاً."
        : "I am ready and at your service. Please share any executive or strategic inquiry you would like us to analyze together.";
    }
    if (clean.includes("من أنت") || clean.includes("من انت") || clean.includes("who are you") || clean.includes("دورك")) {
      return isAr
        ? "أنا المستشار الإداري والإدراكي لمنصة ذَكِرْ. أعمل كمساعد تنفيذي للقيادة في تشخيص القرارات الاستراتيجية، تتبع الذاكرة المؤسسية والدروس المستفادة، وتحديد مؤشرات المخاطر وسبل معالجتها بمهنية وموضوعية."
        : "I am Zakir's Cognitive Advisor. I assist leadership in strategic diagnostics, institutional memory retrieval, risk evaluation, and governance advisory.";
    }
    if (clean.includes("شكرا") || clean.includes("thanks")) {
      return isAr
        ? "على الرحب والسعة. أنا هنا دائماً لدعم قراراتك ومؤسستك. لا تتردد في طرح أي استفسار آخر في أي وقت."
        : "You are most welcome. I remain at your service to support your executive decision-making whenever needed.";
    }
    return isAr
      ? "أهلاً ومرحباً بك. أنا المستشار الإداري والإدراكي لمنصة ذَكِرْ. يسعدني مساعدتك؛ يمكنك مشاركة أي استفسار إداري أو استراتيجي لنناقشه بموضوعية وبما يخدم قرارات مؤسستك."
      : "Welcome. As Zakir's Cognitive Advisor, I am pleased to assist you with management decisions, strategic planning, or organizational diagnostics.";
  }

  // Case 2: Ambiguous standalone / Clarification Needed
  if (intent === "CLARIFICATION_NEEDED") {
    return isAr
      ? "يسعدني مساعدتك في اتخاذ هذا القرار أو إجراء التحليل المطلوب. لتكون الإجابة دقيقة وعملية، أرجو توضيح محور المسألة بإيجاز: هل يتعلق الأمر بالسيولة، أم بنمو المبيعات، أم باتفاقية تعاقدية، أم بقرار تشغيلي محدد؟"
      : "I would be glad to assist you. To provide a precise analysis, please briefly specify the decision domain: is it related to liquidity, revenue growth, contractual commitments, or an operational bottleneck?";
  }

  // Case 3: Follow-up on prior conversation (Context-Aware)
  if (intent === "FOLLOW_UP") {
    if (activeTopic === "السيولة والتدفق النقدي") {
      return isAr
        ? "المؤشر الأهم هنا هو ضغط السيولة. إذا كانت التدفقات الداخلة لا تغطي الالتزامات قصيرة الأجل، فالمشكلة ليست في حجم المبيعات وحده، بل في توقيت التحصيل والمدفوعات. لذلك ينبغي أولاً مقارنة التدفقات النقدية الداخلة والخارجة خلال الفترة نفسها، ثم تحديد الالتزامات التي تسبب أكبر ضغط على السيولة كخطوة أولى."
        : "The critical indicator here is liquidity pressure. When cash inflows lag behind short-term obligations, the issue is often collection timing rather than sales volume alone. The immediate next step is to align inflows against upcoming disbursement dates and isolate the commitments creating peak pressure.";
    }
    if (activeTopic === "التحضير للمستثمر والتمويل") {
      return isAr
        ? "بخصوص التحضير لاجتماع المستثمر، الخطوة العملية التالية هي إعداد نموذج التدفق النقدي المتوقع للـ 12 شهراً القادمة، مع تحديد معدل الحرق النقدي الشهري الصافي (Burn Rate) والمدى الزمني المستهدف للسيولة (Runway) بعناية قبل التوجه للاجتماع."
        : "Regarding your investor discussion, the immediate next step is consolidating the 12-month projected cash flow model and clearly detailing the runway burn rate.";
    }
    if (activeTopic === "إدارة المخاطر والتحوط") {
      return isAr
        ? "بناءً على مسألة المخاطر التي كنا نناقشها، الإجراء الأنسب يبدأ بفصل الأثر المالي الفوري عن الأثر التشغيلي، ثم وضع سقف انكشاف محدد قبل الدخول في أي التزام جديد."
        : "Following our risk evaluation discussion, the recommended immediate step is separating direct balance-sheet exposure from operational impacts, then fixing strict exposure limits before executing new commitments.";
    }
    return isAr
      ? "بناءً على السياق الذي ناقشناه للتو، الخطوة التالية هي تحديد الالتزامات العاجلة ومقارنتها بالموارد التشغيلية المتاحة لاتخاذ القرار دون تأخير."
      : "Based on our recent context, the recommended next step is isolating immediate commitments against available operational resources to proceed decisively.";
  }

  // Case 4: Concept: Cash Flow
  if (intent === "GENERAL_KNOWLEDGE" && (clean.includes("تدفق نقدي") || clean.includes("cash flow"))) {
    return isAr
      ? "التدفق النقدي هو حركة النقد الفعلية الداخلة إلى المؤسسة والخارجة منها خلال فترة زمنية محددة. يختلف جوهرياً عن الربح المحاسبي؛ فالشركة قد تكون رابحة على الورق ولكنها تواجه تعثراً إذا لم تتوفر السيولة النقدية في مواعيد استحقاق الالتزامات.\n\nالمحاور الأساسية لإدارته:\n1. التدفق التشغيلي: النقد الناتج من العمليات اليومية ومبيعات النشاط.\n2. التدفق الاستثماري: النقد المستخدم في شراء أو بيع المعدات والأصول.\n3. التدفق التمويلي: حركة القروض، التسهيلات البنكية، وتوزيعات رأس المال.\n\nالحفاظ على صافي تدفق تشغيلي إيجابي هو المعيار الأساسي لسلامة أي منشأة."
      : "Cash flow represents the net balance of cash moving into and out of an enterprise over a specified timeframe. Unlike accounting profitability, positive revenue on an accrual basis does not safeguard against insolvency if cash receipts lag behind payment obligations. Monitoring operating cash flow is essential for institutional resilience.";
  }

  // Case 5: Corporate Governance
  if (intent === "GENERAL_KNOWLEDGE" && (clean.includes("حوكمة") || clean.includes("governance"))) {
    return isAr
      ? "تعتمد حوكمة الشركات الإدارية على أربعة مبادئ أساسية توفر الإطار التشغيلي والرقابي للقيادة التنفيذية:\n1. الشفافية والإفصاح: توفير معلومات دقيقة وموثوقة عن الأداء المالي والقرارات الجوهرية.\n2. المساءلة والرقابة: تحديد مسؤوليات مجلس الإدارة والإدارة التنفيذية بشكل واضح مع تفعيل الرقابة الداخلية.\n3. العدالة والمساواة: حماية حقوق جميع المساهمين والأطراف ذات العلاقة دون تمييز.\n4. المسؤولية المؤسسية: الالتزام بالأنظمة واللوائح وتجنب تعارض المصالح لضمان استدامة الشركة."
      : "Corporate governance establishes the operational and supervisory framework for leadership based on transparency, accountability, fairness, and institutional responsibility.";
  }

  // Case 6: FX Risk & Hedging
  if (intent === "RISK_ANALYSIS" || clean.includes("صرف") || clean.includes("تقلبات")) {
    return isAr
      ? "إدارة مخاطر تقلبات أسعار الصرف في العقود الدولية تستوجب تطبيق استراتيجية تحوط متكاملة لحماية هوامش الربح. أهم الضوابط:\n1. أدوات التحوط المالي: استخدام العقود الآجلة (Forward Contracts) لتثبيت سعر الصرف قبل الاستحقاق.\n2. التكييف التعاقدي: إدراج بند تعديل أسعار الصرف (FX Escalation Clause) في العقود طويلة الأجل لتشارك المخاطر مع الطرف الآخر.\n3. تنويع سلة العملات: مواءمة العملة المفلترة في الإيرادات مع عملة المصروفات والتوريد للحد من الانكشاف الصافي."
      : "Managing foreign exchange risk in international contracts requires structured financial hedging, escalation clauses, and currency matching to preserve operating margins.";
  }

  // Case 7: Goal Alignment
  if (clean.includes("أهداف") || clean.includes("مواءمة") || clean.includes("قيادية")) {
    return isAr
      ? "مواءمة الأهداف الإدارية مع الفرق القيادية تتطلب ربط الرؤية الاستراتيجية بمؤشرات أداء قياسية (KPIs) محددة وقابلة للقياس لكل قطاع تشغيلي. المبادئ الأساسية:\n1. وضوح الأولوية: صياغة أهداف ذكية تترجم الاستراتيجية إلى مهام دورية.\n2. المتابعة الحوكمية: مراجعة شهرية لأداء القيادات لمراقبة الانحرافات وسرعة معالجتها.\n3. التوثيق المؤسسي: ربط حوافز القيادة بالتنفيذ الفعلي للأهداف المعتمدة."
      : "Aligning administrative goals with leadership teams requires translating strategic intent into measurable KPIs and monthly review governance.";
  }

  // Case 8: Strategic Recommendation
  if (intent === "STRATEGIC_RECOMMENDATION" || clean.includes("فرع جديد") || clean.includes("توصية")) {
    return isAr
      ? "التوصية الاستراتيجية الأساسية قبل التوسع بفتح فرع جديد هي إجراء دراسة جدوى نقدية للتأكد من عدم استنزاف السيولة التشغيلية للمركز الرئيسي. المحاور التوصية:\n1. الجدوى وتكلفة التأسيس: التحقق من القيمة الاستثمارية المطلوبة وفترة استرداد رأس المال.\n2. الطاقة التشغيلية: التأكد من جاهزية الكوادر القيادية لإدارة الفرع الجديد بنفس معايير الجودة.\n3. اختبار الطلب: البدء بنافذة أو نقطة بيع تجريبية قبل الالتزام بعقود إيجار طويلة الأجل."
      : "The primary strategic recommendation prior to branch expansion is conducting a cash feasibility assessment to protect core operational liquidity.";
  }

  // Case 9: Uncertain Hypothesis / Premature Conclusion
  if (intent === "UNCERTAIN_HYPOTHESIS" || detectedHypothesis) {
    return isAr
      ? "تظهر البيانات المتاحة مؤشرات تستدعي فحص الوضع المالي، لكن لا تكفي وحدها لإثبات وجود ضعف مالي شامل أو أزمة حتمية. إطلاق تشخيص حاسم في هذه المرحلة دون مراجعة تفصيلية للقوائم النقدية والذمم المدينة قد تؤدي إلى قرارات انفعالية غير دقيقة. الأنسب هو تقييم صافي التدفق التشغيلي لشهرين قادمين وتحديد مصادر الضغط الفعلية قبل الحكم."
      : "The available observations highlight signals that warrant examination, but they do not substantiate a generalized financial failure or an inevitable crisis. Concluding insolvency prematurely risks unwarranted defensive actions. The prudent approach is examining near-term net operating cash flow and invoice aging before drawing definitive conclusions.";
  }

  // Case 10: Memory Query with Authenticated Records
  if (intent === "MEMORY_QUERY") {
    if (Array.isArray(memories) && memories.length > 0) {
      const recordsText = memories
        .map((m, idx) => `الذكرى ${idx + 1}: "${m.title || "بدون عنوان"}" - التصنيف: ${m.category || "عام"} - القرار المتخذ: ${m.decision || "غير محدد"}`)
        .join("\n");
      return isAr
        ? `تتضمن الذاكرة المؤسسية الموثقة في حسابك السجلات التالية:\n\n${recordsText}\n\nتشير هذه السجلات إلى سوابق قرارات معتمدة يمكن الاستناد إليها لضمان اتساق القرارات الحالية وتفادي تكرار الأخطاء السابقة.`
        : `Your institutional memory registry contains the following verified records:\n\n${recordsText}\n\nThese precedent entries provide empirical grounding for ongoing strategic alignment.`;
    }
    return isAr
      ? "لا توجد حالياً ذكريات أو قرارات مسجلة في قاعدة الذاكرة المؤسسية لحسابك. يمكنك تدوين القرارات الهامة والدروس المستفادة لتكون مرجعاً تحليلياً مستقبلياً."
      : "There are currently no recorded decision precedents in your institutional memory repository. Registering significant decisions ensures institutional continuity.";
  }

  // Case 11: Diagnostic Request (Structured Executive Diagnostic)
  if (intent === "DIAGNOSTIC_REQUEST" || clean.includes("تشخيص") || clean.includes("فجوة")) {
    return isAr
      ? `### الخلاصة
المؤشر الأهم هنا يتركز حول كفاءة التحصيل وتوقيت سداد الالتزامات قصيرة الأجل.

### التشخيص
المعطيات المتوفرة تشير إلى وجود فجوة زمنية بين استحقاق الدفعات للعملاء وتاريخ الوفاء بالتزامات الموردين والمصروفات الثابتة، مما ينعكس في صورة ضغط سيولة دوري رغم ارتفاع المبيعات.

### الأدلة
البيانات المتاحة ترصد تباعد دورة التحصيل الفعلي عن الآجال التعاقدية المتفق عليها، مع استمرار ثبات الالتزامات الدورية في مواعيدها.

### التفسير
استمرار هذه الفجوة دون تعديل بنود الائتمان أو شروط الدفع يؤدي إلى استنزاف الاحتياطي النقدي التشغيلي بصورة مؤقتة، حتى وإن كانت المبيعات تحقق هوامش ربح مجدية.

### التوصية
إعادة هيكلة شروط السداد مع العملاء الرئيسيين (تقديم حوافز سداد مبكر)، ومواءمة دفعات الموردين لتتزامن مع مواعيد التدفقات الداخلة.

### الخطوة التالية
حصر الذمم المدينة المستحقة خلال الـ 30 يوماً القادمة وتقديم خطة تحصيل عاجلة للأرصدة المتأخرة.`
      : `### Executive Summary
The primary friction lies in receivables turnover timing relative to short-term liabilities.

### Diagnosis
Available indicators point to a collection timing mismatch rather than an intrinsic product viability deficiency.

### Evidence
Observed receivables aging stretches beyond contract terms while fixed operational obligations remain rigid.

### Interpretation
Prolonged duration mismatches deplete operational cash reserves regardless of gross margin health.

### Recommendation
Restructure commercial payment terms and introduce accelerated settlement incentives.

### Next Step
Audit 30-day pending invoices and initiate prioritized follow-up on overdue corporate accounts.`;
  }

  // Case 12: Executive Report Request
  if (intent === "EXECUTIVE_REPORT") {
    return isAr
      ? `### الخلاصة
التقرير التنفيذي يوصي بتركيز الرقابة على دورة رأس المال العامل ودورة التحصيل وحماية الهوامش التشغيلية في ظل معطيات السوق الحالية.

### التشخيص
تظهر المؤشرات استقراراً نسبياً في النشاط الأساسي، مع حاجة ملحة لتعزيز مرونة التحصيل والسيطرة على التكاليف المتغيرة غير المباشرة.

### الأدلة
استناداً إلى سجلات القرارات ومعدلات الصرف المتاحة، تتطابق الفترات الحرجة مع مواسم تجديد العقود ومستحقات الموردين.

### التفسير
حماية المركز المالي للمؤسسة تتطلب خفض الاعتماد على التسهيلات قصيرة الأجل واستبدالها بإدارة رشيدة للمخزون والتدفقات.

### التوصية
اعتماد سياسة ائتمانية أكثر تحفظاً، وتفعيل سجل رقابي دوري للقرارات ذات الأثر المالي المتجاوز لسقف السيولة الاحتياطية.

### الخطوة التالية
مراجعة تقرير رأس المال العامل بنهاية الأسبوع وتحديد سقف الائتمان الممنوح لكل قطاع عملاء.`
      : `### Executive Summary
Executive report highlights the necessity of tightening working capital cycles and securing operational margins.

### Diagnosis
Primary operations maintain baseline stability, yet variable indirect overhead requires proactive governance.

### Recommendation
Enforce balanced commercial credit guidelines and establish weekly cash reconciliation.

### Next Step
Review weekly working capital position and validate segment exposure limits.`;
  }

  // Case 13: Insufficient Data
  if (clean.includes("حلل وضعي المالي") || intent === "INSUFFICIENT_DATA_QUERY") {
    return isAr
      ? "المعطيات المتاحة حالياً لا تكفي لإجراء تحليل مالي شامل أو تشخيص قطعي لوضع مؤسستك، حيث يتطلب ذلك الاطلاع على أرقام الإيرادات، المصروفات التشغيلية، وصافي التدفق النقدي. مع ذلك، يمكنني تزويدك بإطار العمل القياسي لاتخاذ القرار: ابدأ بحساب صافي التدفق التشغيلي لآخر 3 أشهر، وقارن متوسط فترة التحصيل بمتوسط فترة السداد؛ فإذا كانت دورة التحصيل أطول من دورة السداد، فهناك حاجة ملحة لضبط الائتمان."
      : "The currently available data points do not suffice to formulate a comprehensive financial diagnostic, which requires verified operating income, expenses, and cash statement metrics. However, an executive framework can be applied immediately: compare your average collection period against payable cycles to identify capital lockup.";
  }

  // Case 14: Investor Meeting Preparation
  if (clean.includes("مستثمر") || clean.includes("investor")) {
    return isAr
      ? "التحضير لاجتماع المستثمر يستوجب الوضوح التام في مؤشرات الأداء الحقيقية. ركّز نقاشك على النقاط التالية:\n1. اقتصاديات الوحدة (Unit Economics): هامش المساهمة وتكلفة اكتساب العميل مقارنة بالقيمة الدائمة له.\n2. المدرج النقدي (Runway): المدة الزمنية التي تغطيها السيولة الحالية، ومعدل الحرق الشهري الصافي.\n3. الميزة التنافسية والحوكمة: وضوح سجل القرارات المؤسسية وسرعة التفاعل مع السوق.\n\nتجنب الوعود غير المدعومة بأرقام فعلية؛ المستثمر يثق بالمدير الذي يدرك مخاطره ويملك خطة واضحة لاحتوائها."
      : "Preparing for an investor conference necessitates uncompromising clarity on unit economics. Focus on contribution margins, customer acquisition cost vs lifetime value, and validated cash runway. Demonstrating a disciplined grasp of operational risks inspires far greater investor conviction than ungrounded projections.";
  }

  // Case 15: General Strategic Advice Default
  return isAr
    ? "النهج الإداري الرصين هنا يبدأ بعزل المشكلة التشغيلية عن الأعراض الجانبية. إذا كانت المسألة تتعلق باتخاذ قرار، فاحرص على تقييم البدائل بالنظر إلى أثرها على السيولة النقدية والالتزامات القائمة، ثم حدد الإجراء الأقل تكلفة والأسرع تنفيذاً كخطوة أولى."
    : "Prudent executive governance begins by isolating root operational drivers from superficial symptoms. When weighing strategic alternatives, evaluate capital impact and disbursement timing first, prioritizing measures that preserve liquidity headroom.";
}

// --- GEMINI AI LIVE CALL WITH QUALITY ASSURANCE ---
export async function executeCognitiveAdvisorChat(
  context: AdvisorContext
): Promise<{
  text: string;
  response: string;
  intent: AdvisorIntent;
  requiresPrivateData: boolean;
  isReportOrDiagnostic: boolean;
  sources: Array<{ title: string; url: string; snippet?: string }>;
  advisorType: string;
}> {
  const {
    promptText,
    history = [],
    lang = "ar",
    memories = [],
    riskAlerts = [],
    advisorType = "cognitive",
    user,
  } = context;

  const isAr = lang === "ar";
  const analysis = classifyCognitiveIntent(promptText, history);
  const { intent, requiresPrivateData, isReportOrDiagnostic, activeTopic } = analysis;

  // 1. Strict Security Gate: Require authentication for private institutional records
  if (requiresPrivateData && !user) {
    const unauthMessage = isAr
      ? "لأتمكن من استخراج بيانات مؤسستك والذكريات المسجلة في حسابك، أحتاج إلى جلسة دخول صالحة. يرجى تسجيل الدخول ثم إعادة المحاولة."
      : "To retrieve your organization's private stored data, a valid login session is required. Please log in and try again.";
    return {
      text: unauthMessage,
      response: unauthMessage,
      intent,
      requiresPrivateData: true,
      isReportOrDiagnostic: false,
      sources: [],
      advisorType,
    };
  }

  // 2. Synthesize baseline domain response using our Cognitive Reasoning Engine
  const baselineResponse = synthesizeCognitiveResponse(context, analysis);

  // 3. Attempt Gemini API with fast 1200ms timeout
  const ai = getGeminiClient();
  let liveAiResponse: string | null = null;
  let extractedSources: Array<{ title: string; url: string; snippet?: string }> = [];

  if (ai && !isGeminiInCooldown()) {
    try {
      const searchDecision = classifySearchNeed(promptText);

      let factsBlock = "";
      if (Array.isArray(memories) && memories.length > 0) {
        factsBlock += "\n[البيانات والذكريات المؤسسية المؤكدة في النظام]:\n" +
          memories.map((m, i) => `الذكرى #${i + 1}: ${m.title || ""} | التصنيف: ${m.category || ""} | القرار: ${m.decision || ""}`).join("\n");
      }

      const activeTopicContext = activeTopic
        ? `\n[ملاحظة السياق السابق]: المحادثة السابقة تركزت حول موضوع: "${activeTopic}". إذا كان سؤال المستخدم متابعة (مثل "وماذا أفعل؟" أو "ما الخطوة التالية؟") فاربط إجابتك مباشرة بهذا الموضوع.`
        : "";

      const systemInstruction = `أنت "المستشار الإداري والإدراكي لمنصة ذَكِرْ" (Zakir Cognitive Advisor).
أنت مستشار إداري وتنفيذي إدراكي رفيع المستوى، يجيب بلباقة وذكاء مهني متقدم على أي رسالة يقدمها المستخدم (سواء كانت تحية، أو حديث عام، أو سؤالاً عن قدراتك، أو استفساراً إدارياً، مالياً، تسويقياً، تشغيلياً، أو استراتيجياً، أو طلب متابعة لحديث سابق).

قواعد التفكير والتحاور الملزمة:
1. الإجابة الدائمة والمباشرة: يجب أن تجيب على كُل رسالة بدون استثناء، بنفس لغة المستخدم (العربية إذا أرسل بالعربية، الإنجليزية بالإنجليزية، والفرنسية بالفرنسية).
2. عند التحية (مثل: مرحبا، أهلا، السلام عليكم، كيف حالك): رحب بالمستخدم بأسلوب مهني دافئ، وعرّف بنفسك كمستشار إداري وإدراكي لقيادة المؤسسة، واسأله كيف يمكنك مساندته اليوم.
3. عند السؤال عن قدراتك (مثل: ماذا تستطيع أن تفعل؟): اشرح باختصار وبأسلوب تنفيذي قدرتك على تشخيص القرارات الاستراتيجية، مراجعة الذاكرة المؤسسية والدروس المستفادة، تقييم المخاطر المالية والتشغيلية، وتحليل أداء السوق.
4. الربط بسياق المحادثة (Follow-up): إذا كانت الرسالة متابعة لحوار سابق (مثل: "كيف أعالجها؟" أو "ما الخطوة التالية؟")، فاربط إجابتك مباشرة بالموضوع الذي كان يجري مناقشته في سجل المحادثة.
5. التمييز الصارم بين الحقائق (FACTS) والاستنتاجات (INFERENCES) والتوصيات (RECOMMENDATIONS):
   - لا تخترع أي أرقام أو أرباح أو أسماء عملاء أو مشاكل غير موجودة في البيانات.
   - إذا سأل المستخدم عن مؤشر خاص بمؤسسته ولا توجد بيانات كافية، وضح بوضوح أن البيانات المتاحة غير كافية لتقديم رقم قطعي، وقدم إرشاداً منهجياً حول المعايير المطلوبة.
6. التجاوب الديناميكي مع المدخلات المتناقضة: تعامل بحرص مع فرضيات المستخدم المتناقضة (مثل ارتفاع المبيعات مقابل انخفاض المبيعات) وقدم استراتيجية مخصصة تناسب كل حالة منطقياً.
7. الأسلوب واللغة: لغة رصينة، واضحة، مهنية، مباشرة، تناسب رئيس تنفيذي (CEO).
8. ممنوع استخدام الرموز التعبيرية (Emojis)، والعبارات الروبوتية الجاهزة مثل "🚨 تحليل خطير"، "AI Analysis".
${factsBlock}${activeTopicContext}`;

      const contents: any[] = [];
      if (Array.isArray(history)) {
        history.slice(-10).forEach((h) => {
          if (h.text && typeof h.text === "string" && !h.text.includes("401 Unauthorized") && !h.text.includes("404 Not Found")) {
            contents.push({
              role: h.role === "user" ? "user" : "model",
              parts: [{ text: h.text }],
            });
          }
        });
      }
      contents.push({
        role: "user",
        parts: [{ text: promptText }],
      });

      const configObj: any = {
        systemInstruction,
        temperature: 0.3,
      };

      if (searchDecision.needsSearch) {
        configObj.tools = [{ googleSearch: {} }];
      }

      const candidateModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];

      const callPromise = (async () => {
        for (const modelName of candidateModels) {
          try {
            const resp = await ai.models.generateContent({
              model: modelName,
              contents,
              config: configObj,
            });
            if (resp?.text && resp.text.trim().length > 10) {
              const cand = resp.candidates?.[0] as any;
              if (cand?.groundingMetadata?.groundingChunks) {
                cand.groundingMetadata.groundingChunks.forEach((c: any) => {
                  if (c.web?.uri && c.web?.title) {
                    extractedSources.push({
                      title: c.web.title,
                      url: c.web.uri,
                      snippet: c.web.snippet || "",
                    });
                  }
                });
              }
              return resp.text.trim();
            }
          } catch (modelErr: any) {
            const errStatus = handleGeminiError(modelErr);
            if (errStatus?.isQuota || errStatus?.isUnavailable) {
              break;
            }
          }
        }
        return null;
      })();

      let timer: any = null;
      const timeoutPromise = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 12000); // 12 second timeout for real Gemini network call
      });

      liveAiResponse = await Promise.race([callPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);
    } catch (err: any) {
      console.warn("[CognitiveAdvisor] Live Gemini execution skipped or failed:", err?.message);
    }
  }

  // 4. Select the best response and apply Quality Guard
  const chosenRaw = liveAiResponse && liveAiResponse.length > 20
    ? liveAiResponse
    : baselineResponse;

  const refinedText = validateAndRefineAdvisorResponse(chosenRaw, intent, promptText);

  return {
    text: refinedText,
    response: refinedText,
    intent,
    requiresPrivateData,
    isReportOrDiagnostic,
    sources: extractedSources,
    advisorType,
  };
}
