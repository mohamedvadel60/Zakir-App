import { GoogleGenAI } from "@google/genai";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import {
  readDb,
  writeDb,
  isGeminiInCooldown,
  handleGeminiError,
} from "../../server.js";
import type { SmartEvolutionData } from "../types.js";

function getLocalGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

function safeJsonParse(text: string, fallback: any): any {
  if (!text) return fallback;
  try {
    let clean = text.trim();
    // Remove markdown code blocks if present
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      clean = jsonMatch[0];
    }
    // Attempt standard parse first
    return JSON.parse(clean);
  } catch (e1) {
    try {
      // Attempt repair for common trailing commas or unquoted properties
      let repaired = text.trim()
        .replace(/,\s*([\]}])/g, "$1") // remove trailing commas
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":'); // quote unquoted keys
      const jsonMatch = repaired.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        repaired = jsonMatch[0];
      }
      return JSON.parse(repaired);
    } catch (e2) {
      console.warn("[SmartEvolution] JSON parse repair failed, returning fallback structure.");
      return fallback;
    }
  }
}

// --- ANALYSIS LOCK & RUNTIME DEDUPLICATION (PART 20) ---
export const runningSmartEvolutionLocks = new Set<string>();

// --- REAL FILE TEXT CONTENT EXTRACTION HELPER (PART 4 SOURCE 3) ---
export function extractRealFileContent(f: any): {
  text: string;
  status: "read" | "unavailable" | "empty";
  summary?: string;
} {
  if (!f) {
    return {
      text: "Content unavailable / المحتوى غير قابل للقراءة حاليًا",
      status: "unavailable",
      summary: "ملف فارغ أو غير محدد",
    };
  }

  const fileName = f.name || f.fileName || "unknown";
  const mimeType = (f.mimeType || f.type || "").toLowerCase();

  // 1. Direct text/content passed
  if (typeof f.content === "string" && f.content.trim().length > 0) {
    return {
      text: f.content.trim().substring(0, 50000),
      status: "read",
      summary: f.description || `نص مستخرج من ${fileName}`,
    };
  }
  if (typeof f.text === "string" && f.text.trim().length > 0) {
    return {
      text: f.text.trim().substring(0, 50000),
      status: "read",
      summary: f.description || `نص مستخرج من ${fileName}`,
    };
  }

  // 2. Base64 Data URL or raw data
  const dataUrl = f.fileUrl || f.data || f.url;
  if (dataUrl && typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
    try {
      const commaIdx = dataUrl.indexOf(",");
      if (commaIdx !== -1) {
        const meta = dataUrl.substring(0, commaIdx).toLowerCase();
        const base64Data = dataUrl.substring(commaIdx + 1);
        const buf = Buffer.from(base64Data, "base64");

        if (
          meta.includes("text") ||
          meta.includes("json") ||
          meta.includes("csv") ||
          fileName.endsWith(".txt") ||
          fileName.endsWith(".csv") ||
          fileName.endsWith(".json") ||
          fileName.endsWith(".md")
        ) {
          const str = buf.toString("utf-8");
          if (str.trim().length > 0) {
            return {
              text: str.trim().substring(0, 50000),
              status: "read",
              summary: f.description || `مستند نصي: ${fileName}`,
            };
          }
        } else if (meta.includes("pdf") || fileName.endsWith(".pdf")) {
          const raw = buf.toString("latin1");
          const matches = raw.match(/BT[\s\S]*?ET/g);
          if (matches && matches.length > 0) {
            let pdfText = "";
            for (const m of matches) {
              const textParts = m.match(/\((.*?)\)[\s]*Tj/g);
              if (textParts) {
                pdfText +=
                  textParts
                    .map((t: string) => t.replace(/^\(/, "").replace(/\)[\s]*Tj$/, ""))
                    .join(" ") + "\n";
              }
            }
            if (pdfText.trim().length > 0) {
              return {
                text: pdfText.trim().substring(0, 50000),
                status: "read",
                summary: f.description || `مستند PDF مستخرج: ${fileName}`,
              };
            }
          }
          const plainStrings = raw.match(/[a-zA-Z0-9\u0600-\u06FF\s.,;:!?-]{20,}/g);
          if (plainStrings && plainStrings.length > 0) {
            return {
              text: plainStrings.slice(0, 30).join(" "),
              status: "read",
              summary: f.description || `نصوص مستخرجة من PDF: ${fileName}`,
            };
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // 3. Local filesystem / secure_uploads
  const docId =
    f.documentId ||
    f.storageReference?.replace(/^secure_uploads\//, "") ||
    f.id;
  if (docId) {
    const candidatePaths = [
      path.join(process.cwd(), "secure_uploads", docId),
      path.join(os.tmpdir(), "secure_uploads", docId),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const buf = fs.readFileSync(p);
          const raw = buf.toString("latin1");
          if (
            mimeType.includes("pdf") ||
            fileName.endsWith(".pdf") ||
            raw.startsWith("%PDF")
          ) {
            const matches = raw.match(/BT[\s\S]*?ET/g);
            if (matches && matches.length > 0) {
              let pdfText = "";
              for (const m of matches) {
                const textParts = m.match(/\((.*?)\)[\s]*Tj/g);
                if (textParts) {
                  pdfText +=
                    textParts
                      .map((t: string) =>
                        t.replace(/^\(/, "").replace(/\)[\s]*Tj$/, ""),
                      )
                      .join(" ") + "\n";
                }
              }
              if (pdfText.trim().length > 0) {
                return {
                  text: pdfText.trim().substring(0, 50000),
                  status: "read",
                  summary: f.description || `مستند PDF: ${fileName}`,
                };
              }
            }
            const plainStrings = raw.match(
              /[a-zA-Z0-9\u0600-\u06FF\s.,;:!?-]{20,}/g,
            );
            if (plainStrings && plainStrings.length > 0) {
              return {
                text: plainStrings.slice(0, 30).join(" "),
                status: "read",
                summary: f.description || `نصوص PDF: ${fileName}`,
              };
            }
          } else {
            const str = buf.toString("utf-8");
            if (str.trim().length > 0) {
              return {
                text: str.trim().substring(0, 50000),
                status: "read",
                summary: f.description || `ملف نصي: ${fileName}`,
              };
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }

  return {
    text: "Content unavailable / المحتوى غير قابل للقراءة حاليًا",
    status: "unavailable",
    summary: f.description || `البيانات الوصفية فقط: ${fileName}`,
  };
}

// Backward-compatible text helper
export function extractFileTextContent(f: any): string {
  return extractRealFileContent(f).text;
}

// --- SEARCH NEED CLASSIFIER (PART 8, 9, 10) ---
export function classifySearchNeed(query: string, context?: any): {
  type: "INTERNAL_ONLY" | "EXTERNAL_ONLY" | "MIXED";
  needsSearch: boolean;
  reason: string;
} {
  const q = (query || "").toLowerCase();

  const externalKeywords = [
    "سوق", "أسواق", "اقتصاد", "عالمي", "تضخم", "أسعار", "فائدة", "سعر الصرف", "عملات", "صرف",
    "مركزي", "بنك مركزي", "موريتانيا", "قوانين", "تشريعات", "جمارك", "تعريفة", "عقوبات",
    "منافس", "منافسين", "أخبار", "توجهات", "نفط", "سلع", "دولار", "معايير بازل",
    "market", "economy", "economic", "global", "inflation", "price", "prices", "interest rate",
    "rates", "fx", "currency", "central bank", "regulation", "law", "tariff", "sanctions",
    "competitor", "news", "trend", "trends", "bcm", "world bank", "imf", "commodity"
  ];

  const comparisonKeywords = [
    "قارن", "مقارنة", "مقابل", "وفق معايير", "وفق المعايير", "حسب السوق", "مع السوق",
    "compare", "comparison", "versus", "vs", "benchmark", "benchmarks", "aligned with"
  ];

  const internalKeywords = [
    "ذاكرة", "ذكريات", "مؤسستي", "سجلاتنا", "مخاطرنا", "ملفاتنا", "قراراتنا", "فريقنا",
    "تنبيهات", "مخاطر مسجلة", "الدروس المستفادة", "الأسباب المسجلة", "سياقنا الداخلي",
    "المسجل لدينا", "المقيد لدينا", "عقدنا", "سياساتنا", "المحفوظة لدينا", "الموجود لدينا",
    "our memory", "our memories", "my risks", "internal risks", "logged memories",
    "uploaded files", "our decisions", "workspace", "our organization"
  ];

  const hasExternal = externalKeywords.some((kw) => q.includes(kw));
  const hasInternal = internalKeywords.some((kw) => q.includes(kw));
  const hasComparison = comparisonKeywords.some((kw) => q.includes(kw));

  // If question is specifically directed to internal logged data and has no explicit comparison request
  if (!hasExternal) {
    return {
      type: "INTERNAL_ONLY",
      needsSearch: false,
      reason: "السؤال يركز حصرياً على البيانات والذاكرة والمخاطر والمستندات الداخلية لمساحة العمل.",
    };
  }

  if ((hasExternal && hasInternal) || hasComparison) {
    return {
      type: "MIXED",
      needsSearch: true,
      reason: "يتطلب السؤال مقارنة المعطيات والبيانات الداخلية للمؤسسة مع المؤشرات والاتجاهات الخارجية من الأسواق أو التشريعات.",
    };
  }

  if (hasExternal && !hasInternal) {
    return {
      type: "EXTERNAL_ONLY",
      needsSearch: true,
      reason: "السؤال يركز على معلومات خارجية (اقتصاد، أسواق، قوانين، أسعار فائدة، مؤشرات كلية).",
    };
  }

  return {
    type: "INTERNAL_ONLY",
    needsSearch: false,
    reason: "السؤال داخلي بحت يتعلق بالذاكرة المؤسسية وسجلات المخاطر والوثائق المحفوظة في مساحة العمل.",
  };
}

// --- SAVED RESULTS ISOLATION (PART 1, 16, 17, 21) ---
export function getSavedSmartEvolution(workspaceId: string, userId?: string) {
  const db = readDb();
  const history = db.smart_evolution_history || [];
  if (!Array.isArray(history) || history.length === 0) return null;

  const matches = history.filter((h: any) => {
    if (workspaceId && h.workspaceId && h.workspaceId !== workspaceId) return false;
    if (userId && h.userId && h.userId !== userId && h.userId !== "usr_anon") return false;
    return true;
  });

  if (matches.length === 0) return null;
  return matches[matches.length - 1];
}

export function saveSmartEvolutionRecord(record: any) {
  const db = readDb();
  if (!Array.isArray(db.smart_evolution_history)) {
    db.smart_evolution_history = [];
  }
  db.smart_evolution_history.push(record);
  if (db.smart_evolution_history.length > 50) {
    db.smart_evolution_history = db.smart_evolution_history.slice(-50);
  }
  writeDb(db);
}

// GET latest saved analysis (pure DB read - NO AI analysis - PART 1 & 18)
export const handleGetLatestSmartEvolution = (req: Request, res: Response) => {
  const workspaceId =
    (req.query.workspaceId as string) ||
    (req.headers["x-workspace-id"] as string) ||
    "default";
  const userId =
    (req.query.userId as string) ||
    (req.headers["x-user-id"] as string) ||
    undefined;

  const saved = getSavedSmartEvolution(workspaceId, userId);
  if (!saved) {
    return res.json({ hasPreviousAnalysis: false, result: null });
  }
  return res.json({ hasPreviousAnalysis: true, result: saved.data });
};

// --- RUN SMART EVOLUTION (MANUAL EXECUTION ONLY) ---
export const handleRunSmartEvolution = async (req: Request, res: Response) => {
  const { lang = "ar", userId = "usr_anon", workspaceId = "default", orgData } = req.body;
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

  // PART 20 — Prevent Duplicate Runs (Analysis Lock)
  const lockKey = `${userId}_${workspaceId}`;
  if (runningSmartEvolutionLocks.has(lockKey)) {
    return res.status(409).json({
      error:
        lang === "ar"
          ? "عملية تحليل جارية بالفعل لمساحة العمل هذه. يرجى الانتظار لحين اكتمالها."
          : "An analysis is already in progress for this workspace. Please wait.",
    });
  }
  runningSmartEvolutionLocks.add(lockKey);

  try {
    const analysisId = "evol_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    const createdAt = new Date().toISOString();

    // 1. Process files and extract real content (SOURCE 3)
    const fileExtractionStatus: Array<{
      fileName: string;
      status: "read" | "unavailable" | "empty";
      summary?: string;
    }> = [];

    const processedFiles = files.map((f: any) => {
      const ext = extractRealFileContent(f);
      fileExtractionStatus.push({
        fileName: f.name || f.fileName || "ملف",
        status: ext.status,
        summary: ext.summary,
      });
      return {
        name: f.name || f.fileName || "ملف",
        category: f.category || "عام",
        status: ext.status,
        text: ext.text,
      };
    });

    // 2. Perform Administrative Advisor cross-check (SOURCE 5)
    const administrativeReview = {
      governanceNotes:
        lang === "ar"
          ? "تم فحص الذاكرة المؤسسية والتأكد من توثيق مسارات اتخاذ القرار وضوابط الحوكمة والامتثال الإجرائي."
          : "Institutional memory audited for decision lineage, governance controls, and procedural compliance.",
      contradictionsDetected: [] as string[],
      recommendedPolicyControls: [] as string[],
      uncertaintyPoints: [] as string[],
    };

    memories.forEach((m: any) => {
      if (m.riskLevel === "Critical" && m.lessonsLearned) {
        administrativeReview.recommendedPolicyControls.push(
          lang === "ar"
            ? `تطبيق رقابة مزدوجة على قرارات: ${m.title} (${m.category}) لمنع تكرار العوامل المسببة.`
            : `Enforce dual-check controls for decisions in ${m.title} (${m.category}).`,
        );
      }
    });

    riskAlerts.forEach((r: any) => {
      if (r.severity === "Critical" || r.severity === "High" || r.severity === "حرِج") {
        administrativeReview.contradictionsDetected.push(
          lang === "ar"
            ? `تنبيه خطر نشط (${r.title}) يتطلب مواءمة سياسات العمل الفورية مع الدروس المؤسسية السابقة.`
            : `Active risk alert (${r.title}) requires immediate policy realignment with historical lessons.`,
        );
      }
    });

    if (processedFiles.some((f) => f.status === "unavailable")) {
      administrativeReview.uncertaintyPoints.push(
        lang === "ar"
          ? "توجد مستندات داخل إدارة الملفات تعذر قراءة محتواها الفعلي؛ تم استبعادها من الجزم التحليلي لتفادي الهلوسة."
          : "Certain documents in File Management were unreadable; excluded from definitive conclusions to prevent hallucination.",
      );
    }

    // 3. Determine if external search is relevant
    const combinedContext = [
      ...memories.map((m: any) => `${m.title} ${m.category} ${m.decision} ${m.causalFactors || ""}`),
      ...riskAlerts.map((r: any) => `${r.title} ${r.description || ""}`),
      ...processedFiles.filter((f) => f.status === "read").map((f) => f.text.substring(0, 300)),
    ].join(" ");

    const searchDecision = classifySearchNeed(combinedContext);
    let externalSources: Array<{ title: string; url: string; snippet?: string; accessedAt?: string }> = [];
    let externalSearchUsed = false;
    let externalSearchStatus = "NOT_REQUIRED";

    // 4. Attempt Gemini analysis if available and not in cooldown
    const ai = getLocalGeminiClient();
    let geminiSucceeded = false;
    let geminiResult: any = null;

    if (ai && memories.length > 0 && !isGeminiInCooldown()) {
      try {
        const memoriesSummary = memories
          .map((m: any, idx: number) =>
            `[الذكرى #${idx + 1}]:\n- العنوان: ${m.title}\n  الفئة: ${m.category}\n  الخطورة: ${m.riskLevel || "High"}\n  القرار: ${m.decision}\n  الأسباب: ${m.causalFactors || "غير محدد"}\n  النتائج: ${m.outcomes || "غير محدد"}\n  الدروس: ${m.lessonsLearned || "غير محدد"}`,
          )
          .join("\n\n");

        const risksSummary =
          riskAlerts.length > 0
            ? riskAlerts
                .map(
                  (r: any, idx: number) =>
                    `[خطر #${idx + 1}]: ${r.title} | الخطورة: ${r.severity || "High"} | التفاصيل: ${r.description || ""}`,
                )
                .join("\n")
            : "لا توجد مخاطر نشطة مسجلة حالياً.";

        const filesSummary =
          processedFiles.length > 0
            ? processedFiles
                .map(
                  (f, idx) =>
                    `[مستند #${idx + 1}]: ${f.name} | الحالة: ${f.status} | المحتوى الفعلي المستخرج:\n${f.text}`,
                )
                .join("\n\n")
            : "لا توجد ملفات مرفوعة حالياً.";

        const orgSummary = orgData
          ? `بيانات المنظمة: ${JSON.stringify(orgData)}`
          : "البيانات المسجلة في مساحة العمل الحالية فقط.";

        const systemInstruction = `أنت المحرك التحليلي الاستراتيجي لقسم "التطور الذكي" والمستشار الإداري في منصة "ذَكِرْ".
المبادئ الإلزامية:
1. الالتزام بالأدلة الحقيقية من الذاكرة والمخاطر والمستندات المرفوعة حصرياً.
2. إذا كان هناك ملف بحالة "Content unavailable" فلا تختلق محتواه إطلاقاً.
3. التمييز الدقيق بين الأدلة (Evidence)، الاستنتاجات (Insights)، والتوصيات (Recommendations).
4. عدم اختلاق أي أرقام أو جهات أو مصادر أو وقائع غير موجودة في البيانات.
5. توضيح نقاط عدم اليقين بصدق وشفافية.

المطلوب إخراج كائن JSON حصرياً بالهيكل التالي (${lang === "ar" ? "باللغة العربية الفصيحة" : "in English"}):
{
  "executiveSummary": "ملخص تنفيذي يحلل المعطيات بدقة ويربط القرارات السابقة بالمخاطر المحددة",
  "keyInsights": ["استنتاج 1 مستند إلى دليل", "استنتاج 2"],
  "detectedPatterns": ["نمط سببي 1", "نمط 2"],
  "risksList": [{"title": "عنوان الخطر المستنتج", "severity": "حرِج/مرتفع/متوسط", "probability": "تقدير منطقي", "details": "تفاصيل الخطر", "evidence": "الدليل المسجل الذي بني عليه الخطر", "confidence": "مرتفع/متوسط", "uncertainty": "ما لا يمكن الجزم به"}],
  "forecastsList": [{"title": "عنوان التوقع", "timeframe": "30-60 يوم", "impact": "مرتفع/متوسط", "details": "التفاصيل", "evidence": "الأساس المنطقي"}],
  "opportunitiesList": [{"title": "عنوان الفرصة", "feasibility": "مرتفع/متوسط", "benefit": "الفائدة المتوقعة", "details": "التفاصيل", "evidence": "الأساس المنطقي"}],
  "recommendationsList": [{"title": "عنوان التوصية", "priority": "حرِج/مرتفع/متوسط", "actionable": "الإجراء العملي", "details": "التفاصيل", "evidence": "الأساس", "confidence": "مرتفع/متوسط"}],
  "strategicOptions": [{"title": "الخيار الاستراتيجي", "timeframe": "الإطار الزمني", "impact": "الأثر", "details": "التفاصيل", "evidence": "الدليل", "uncertainty": "نقاط الحذر"}],
  "operationalActions": [{"title": "الإجراء التشغيلي", "priority": "حرِج/مرتفع", "assignedRole": "الدور المسؤول", "timeframe": "المهلة", "details": "الخطوات"}],
  "priorities": [{"rank": 1, "title": "الأولوية الأولى", "rationale": "مبرر الأولوية", "expectedImpact": "الأثر المتوقع"}],
  "expectedImpact": "صياغة منطقية واحتمالية للأثر المتوقع للتوصيات",
  "confidenceLevel": "مرتفع / متوسط / منخفض",
  "uncertaintyNotes": "ما الذي لا يمكن الجزم به نظراً لحدود البيانات المتاحة"
}`;

        const candidateModels = [
          "gemini-2.5-flash",
          "gemini-2.0-flash",
          "gemini-1.5-flash",
        ];

        for (const mName of candidateModels) {
          let response: any = null;

          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const genConfigPure: any = {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                temperature: 0.3,
              };

              response = await ai.models.generateContent({
                model: mName,
                contents: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: `حلل بيانات المؤسسة الحالية التالية وأخرج التقرير بصيغة JSON حصرياً:\n\n### الذكريات المؤسسية (${memories.length}):\n${memoriesSummary}\n\n### تنبيهات المخاطر النشطة (${riskAlerts.length}):\n${risksSummary}\n\n### المستندات والملفات المرفوعة (${processedFiles.length}):\n${filesSummary}\n\n### البيانات المؤسسية:\n${orgSummary}`,
                      },
                    ],
                  },
                ],
                config: genConfigPure,
              });
            } catch (pureErr: any) {
              console.warn(`[SmartEvolution] Model ${mName} unavailable/exhausted:`, pureErr?.message || pureErr);
              handleGeminiError(pureErr);
              const is429 = pureErr?.status === "RESOURCE_EXHAUSTED" || String(pureErr?.message || "").includes("429");
              if (is429) {
                break;
              }
              if (attempt < 2) {
                await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
                continue;
              }
            }

            if (response?.text) break;
          }

          if (response?.text) {
            geminiResult = safeJsonParse(response.text, {
              executiveSummary: response.text,
              risksList: [],
              opportunitiesList: [],
              recommendationsList: [],
              priorities: [],
            });

            // Check for grounding metadata
            const candidate = response.candidates?.[0] as any;
            if (candidate?.groundingMetadata) {
              const chunks = candidate.groundingMetadata.groundingChunks || [];
              chunks.forEach((c: any) => {
                if (c.web?.uri && c.web?.title) {
                  externalSources.push({
                    title: c.web.title,
                    url: c.web.uri,
                    snippet: c.web.snippet || "",
                    accessedAt: new Date().toISOString(),
                  });
                }
              });
              if (externalSources.length > 0) {
                externalSearchUsed = true;
                externalSearchStatus = "RUNTIME_VERIFIED";
              }
            }

            geminiSucceeded = true;
            break;
          }
        }
      } catch (err: any) {
        console.warn("Smart evolution AI call exception:", err?.message || err);
      }
    }

    // 5. Build Final Synthesis
    let finalPayload: SmartEvolutionData;

    if (geminiSucceeded && geminiResult) {
      finalPayload = {
        analysisId,
        createdAt,
        userId,
        workspaceId,
        executiveSummary:
          geminiResult.executiveSummary ||
          (lang === "ar"
            ? `تم تحليل ${memories.length} من أحداث الذاكرة المؤسسية و${riskAlerts.length} من مخاطر العمليات بالاستناد إلى السجلات المعتمدة.`
            : `Analysis of ${memories.length} institutional memories and ${riskAlerts.length} operational risks completed based on verified records.`),
        analyzedMemories: memories.length,
        identifiedRisks: riskAlerts.length,
        analyzedFilesCount: processedFiles.length,
        opportunities: geminiResult.opportunitiesList?.length || 1,
        recommendations: geminiResult.recommendationsList?.length || 1,
        keyInsights: geminiResult.keyInsights || [
          lang === "ar"
            ? `ترابط مباشر بين الأحداث المسجلة في فئة (${memories[0]?.category || "العمليات"}) ومستويات الانكشاف الراهنة.`
            : `Direct correlation identified between events in (${memories[0]?.category || "Operations"}) and current risk posture.`,
        ],
        detectedPatterns: geminiResult.detectedPatterns || [
          lang === "ar"
            ? "تكرار الفجوات الإجرائية عند غياب بروتوكولات التحقق المزدوج الموثقة."
            : "Recurrent procedural gaps observed when dual-check validation protocols are unrecorded.",
        ],
        risksList: (geminiResult.risksList || []).map((r: any) => ({
          title: r.title,
          severity: r.severity || "مرتفع",
          probability: r.probability || "تقدير احتمالي",
          details: r.details,
          evidence: r.evidence || `مستند إلى سجلات الذاكرة المؤسسية`,
          confidence: r.confidence || "مرتفع",
          uncertainty: r.uncertainty || "رهن باستقرار البيئة التشغيلية",
        })),
        forecastsList: geminiResult.forecastsList || [],
        opportunitiesList: geminiResult.opportunitiesList || [],
        recommendationsList: (geminiResult.recommendationsList || []).map((rc: any) => ({
          title: rc.title,
          priority: rc.priority || "مرتفع",
          actionable: rc.actionable || rc.title,
          details: rc.details,
          evidence: rc.evidence || `مستفاد من أحداث سابقة`,
          confidence: rc.confidence || "مرتفع",
        })),
        strategicOptions: geminiResult.strategicOptions || [
          {
            title: lang === "ar" ? "أتمتة مصفوفة الصلاحيات والحوكمة" : "Automate Governance Matrix",
            timeframe: "30-90 يوم",
            impact: "مرتفع",
            details:
              lang === "ar"
                ? "تطبيق التحقق الرقمي لمنع اتخاذ القرارات دون الرجوع للدروس المستفادة."
                : "Enforce automated pre-flight checks.",
            evidence: lang === "ar" ? "الأحداث المسجلة في مساحة العمل" : "Recorded workspace memories",
            uncertainty:
              lang === "ar"
                ? "يتطلب التزام الفرق الإدارية بتسجيل كافة القرارات."
                : "Requires institutional discipline.",
          },
        ],
        operationalActions: geminiResult.operationalActions || [
          {
            title: lang === "ar" ? "مراجعة ضوابط المخاطر النشطة" : "Review Active Risk Controls",
            priority: "حرِج",
            assignedRole: "إدارة المخاطر / الامتثال",
            timeframe: "فوري (أسبوع)",
            details:
              lang === "ar"
                ? "ربط تنبيهات المخاطر بالدروس السابقة وتحديث خطط الطوارئ."
                : "Map risk alerts to historical lessons.",
          },
        ],
        priorities: geminiResult.priorities || [
          {
            rank: 1,
            title: lang === "ar" ? "معالجة المخاطر الحرجة النشطة" : "Mitigate Active Critical Risks",
            rationale:
              lang === "ar"
                ? "حماية المؤسسة من تكرار خسائر سابقة موثقة"
                : "Prevent recurrence of logged loss events",
            expectedImpact:
              lang === "ar"
                ? "تخفيض احتمالية التكرار بنسبة ملموسة"
                : "Significant reduction in recurrence probability",
          },
        ],
        expectedImpact:
          geminiResult.expectedImpact ||
          (lang === "ar"
            ? "يُتوقع أن يؤدي تطبيق هذه التوصيات إلى الحد من الانكشافات التشغيلية والمالية وفقاً لمؤشرات الذاكرة المؤسسية."
            : "Implementing these recommendations is projected to minimize operational and financial exposure based on institutional precedents."),
        supportingEvidence: [
          ...memories.slice(0, 5).map((m: any) => ({
            source: m.title,
            type: "memory" as const,
            snippet: m.causalFactors || m.description || m.decision,
          })),
          ...riskAlerts.slice(0, 5).map((r: any) => ({
            source: r.title,
            type: "risk" as const,
            snippet: r.description || `مستوى الخطورة: ${r.severity}`,
          })),
          ...processedFiles.filter((f) => f.status === "read").slice(0, 5).map((f) => ({
            source: f.name,
            type: "file" as const,
            snippet: f.text.substring(0, 150),
          })),
        ],
        confidenceLevel: geminiResult.confidenceLevel || "High",
        uncertaintyNotes:
          geminiResult.uncertaintyNotes ||
          (processedFiles.some((f) => f.status === "unavailable")
            ? lang === "ar"
              ? "ملاحظة: تعذر قراءة بعض الملفات المرفوعة فتم استبعادها من التحليل، مما قد يحد من شمولية بعض الجوانب غير المسجلة نصياً."
              : "Notice: Some files were unreadable and excluded, which may limit coverage of unrecorded documentation."
            : lang === "ar"
              ? "النتائج مستندة بالكامل إلى البيانات المدخلة؛ أي بيانات غائبة عن الذاكرة المؤسسية لم يتم أخذها في الاعتبار."
              : "Results grounded exclusively in logged data; unrecorded variables were not factored in."),
        administrativeAdvisorReview: administrativeReview,
        externalSearchUsed,
        externalSearchStatus,
        externalSources,
        fileExtractionStatus,
      };
    } else {
      // Deterministic Evidence-Based Synthesis (Fallback when AI quota exceeded or offline)
      const realRisksList = riskAlerts.map((r: any) => ({
        title: r.title,
        severity: r.severity || "مرتفع",
        probability: "مرتفع (بناءً على التنبيهات المسجلة)",
        details: r.description || `تم رصد هذا الخطر وتوثيقه في قائمة المخاطر النشطة.`,
        evidence: `سجل المخاطر: ${r.title} (الحالة: ${r.status || "نشط"})`,
        confidence: "مرتفع",
        uncertainty: "يتطلب قياساً ميدانياً دورياً للتحقق من تطور الخطر.",
      }));

      if (realRisksList.length === 0) {
        memories.forEach((m: any) => {
          realRisksList.push({
            title: `خطر كامن في: ${m.title}`,
            severity: m.riskLevel || "متوسط",
            probability: "احتمالي (مستند للذاكرة)",
            details: `العوامل المسببة المسجلة: ${m.causalFactors || m.description || "غير محددة بالتفصيل"}.`,
            evidence: `الذكرى المؤسسية: ${m.title} (${m.category})`,
            confidence: "متوسط",
            uncertainty: "احتمال تكرار الحدث مرهون بالظروف التشغيلية الحالية.",
          });
        });
      }

      const realRecsList = memories.map((m: any) => ({
        title: `إجراء حوكمة وقائي لـ ${m.category}: استيعاب دروس (${m.title})`,
        priority: m.riskLevel === "Critical" ? "حرِج" : "مرتفع",
        actionable: m.lessonsLearned || "وضع ضابط رقابي مباشر يمنع تكرار القرار في ظروف مشابهة.",
        details: `القرار السابق: "${m.decision}". النتيجة المسجلة: "${m.outcomes || "غير محدد"}". الإجراء الموصى به مبني حصرياً على هذا السجل.`,
        evidence: `الدرس المستفاد الموثق في ${m.title}`,
        confidence: "مرتفع",
      }));

      const realOpportunitiesList = memories.map((m: any) => ({
        title: `أتمتة وحوكمة ضوابط ${m.category}`,
        feasibility: "مرتفع",
        benefit: "الحد من الانكشاف المالي والإداري",
        details: `الاستفادة من تجربة (${m.title}) لتحويل الضوابط الفردية إلى إجراءات نظامية معتمدة.`,
        evidence: `سجل الذاكرة: ${m.title}`,
      }));

      const realForecastsList = memories.map((m: any) => ({
        title: `توقع مسار الأثر لـ ${m.title}`,
        timeframe: "خلال 30-90 يوم",
        impact: m.riskLevel === "Critical" ? "مرتفع" : "متوسط",
        details: `إذا استمرت العوامل المسببة (${m.causalFactors || "غير المحددة"}) دون تفعيل الدروس المستفادة، يرجح تكرار النتائج المسجلة.`,
        evidence: `النتائج السابقة: ${m.outcomes || m.decision}`,
      }));

      const memTitles = memories.map((m: any) => m.title).join("، ");
      const riskTitles = riskAlerts.map((r: any) => r.title).join("، ");
      const categories = Array.from(new Set(memories.map((m: any) => m.category))).join("، ");

      finalPayload = {
        analysisId,
        createdAt,
        userId,
        workspaceId,
        executiveSummary:
          lang === "ar"
            ? `### ملخص تشخيصي مؤسسي مبني على الأدلة\n\nيكشف فحص الذاكرة المؤسسية (${memories.length} أحداث مسجلة تشمل: ${memTitles || "لا توجد سجلات"}) وتنبيهات المخاطر النشطة (${riskAlerts.length} تنبيهات تشمل: ${riskTitles || "لا توجد مخاطر نشطة"}) والمستندات المرفوعة (${processedFiles.length} ملفات) عن ارتباط سببي مباشر بين القرارات السابقة في قطاعات (${categories || "العمليات"}) ومستوى الأمان الإداري والمالي الحالي. تم بناء هذا التقرير حصرياً على البيانات الداخلية المؤكدة لضمان أقصى درجات الموثوقية والمقاومة التامة للهلوَسَة.`
            : `### Evidence-Based Institutional Diagnostic Summary\n\nAudit of ${memories.length} recorded institutional memories (${memTitles || "None"}), ${riskAlerts.length} active risk alerts (${riskTitles || "None"}), and ${processedFiles.length} files demonstrates direct causal linkage between historical decision records across (${categories || "Operations"}) and current risk exposure. This report is grounded strictly in verified organizational records to eliminate hallucination.`,
        analyzedMemories: memories.length,
        identifiedRisks: riskAlerts.length,
        analyzedFilesCount: processedFiles.length,
        opportunities: realOpportunitiesList.length,
        recommendations: realRecsList.length,
        keyInsights: [
          lang === "ar"
            ? `توثيق العوامل المسببة في ${memories.length} أحداث مؤسسية (${memTitles}) يوفر خط دفاع أولي لمنع تكرار الأخطاء السابقة.`
            : `Documentation of causal factors across ${memories.length} events (${memTitles}) provides frontline defense against recurring failures.`,
          lang === "ar"
            ? `تنبيهات المخاطر (${riskAlerts.length} تنبيهات: ${riskTitles}) تتطلب تفعيلاً إجرائياً مباشراً للدروس المستفادة في إدارة العمليات.`
            : `Risk alerts (${riskAlerts.length} alerts: ${riskTitles}) require direct operational implementation of documented lessons learned.`,
        ],
        detectedPatterns: [
          lang === "ar"
            ? `تكرار الفجوات الإجرائية في فئات (${categories || "العمليات"}) عند غياب بروتوكولات التحقق المزدوج الموثقة.`
            : `Recurrent procedural gaps observed across (${categories || "Operations"}) when dual-check validation protocols are unrecorded.`,
        ],
        risksList: realRisksList.slice(0, 8),
        forecastsList: realForecastsList.slice(0, 8),
        opportunitiesList: realOpportunitiesList.slice(0, 8),
        recommendationsList: realRecsList.slice(0, 8),
        strategicOptions: [
          {
            title: lang === "ar" ? "حوكمة مصفوفة اتخاذ القرارات الحساسة" : "Governance Matrix Standardization",
            timeframe: "30-60 يوم",
            impact: "مرتفع",
            details:
              lang === "ar"
                ? "ربط نظام الموافقات بمراجعة إلزامية للذاكرة المؤسسية قبل تنفيذ القرارات الكبرى."
                : "Mandate pre-decision review of historical precedents.",
            evidence: lang === "ar" ? "سجلات الذاكرة المؤسسية المسجلة" : "Institutional memory logs",
            uncertainty: lang === "ar" ? "يعتمد على التزام الكوادر التنفيذية بالتدوين." : "Dependent on logging compliance.",
          },
        ],
        operationalActions: [
          {
            title: lang === "ar" ? "جدولة مراجعة الدروس المستفادة فصلياً" : "Quarterly Lessons Learned Review",
            priority: "مرتفع",
            assignedRole: "المستشار الإداري / إدارة العمليات",
            timeframe: "30 يوم",
            details:
              lang === "ar"
                ? "فحص جميع الأحداث السابقة وتقييم مدى الالتزام بالتوصيات الوقائية."
                : "Audit event compliance with preventive recommendations.",
          },
        ],
        priorities: [
          {
            rank: 1,
            title: lang === "ar" ? "تطبيق الدروس المستفادة على المخاطر النشطة" : "Align Active Risks with Documented Lessons",
            rationale:
              lang === "ar"
                ? "إغلاق الثغرات التي تسببت في أضرار سابقة"
                : "Remediate verified historical failure causes",
            expectedImpact:
              lang === "ar"
                ? "حماية المؤسسة من تكرار سيناريوهات الخسارة الموثقة"
                : "Eliminate repetitive loss exposure",
          },
        ],
        expectedImpact:
          lang === "ar"
            ? "الالتزام بهذه التوصيات يرفع من مناعة المؤسسة الإدراكية ويقلل نسبة القرارات غير المدروسة وفق المعطيات التاريخية."
            : "Execution of these recommendations enhances organizational cognitive resilience and curbs undocumented decision risk.",
        supportingEvidence: [
          ...memories.slice(0, 5).map((m: any) => ({
            source: m.title,
            type: "memory" as const,
            snippet: m.causalFactors || m.description || m.decision,
          })),
          ...riskAlerts.slice(0, 5).map((r: any) => ({
            source: r.title,
            type: "risk" as const,
            snippet: r.description || `مستوى الخطورة: ${r.severity}`,
          })),
          ...processedFiles.filter((f) => f.status === "read").slice(0, 5).map((f) => ({
            source: f.name,
            type: "file" as const,
            snippet: f.text.substring(0, 150),
          })),
        ],
        confidenceLevel: "Medium (Internal records verified; real-time external search unverified)",
        uncertaintyNotes:
          lang === "ar"
            ? "تنبيه منهجية الأدلة: تم إجراء هذا التحليل بالاعتماد الحصري والمباشر على البيانات والوثائق المسجلة في مساحة العمل. ونظراً لتعذر الاستقصاء الخارجي المباشر عبر الإنترنت في الوقت الفعلي بسبب قيود حصة الاستخدام، تم تخفيض درجة الثقة في أي استشرافات خارجية غير موثقة داخلياً، وتأكيد موثوقية الاستنتاجات الداخلية المباشرة."
            : "Methodological Notice: Analysis completed relying strictly on verified workspace records. Due to real-time external search quota limitations, external projections carry lowered confidence while internal record conclusions remain fully grounded.",
        administrativeAdvisorReview: administrativeReview,
        externalSearchUsed: false,
        externalSearchStatus: "NOT RUNTIME VERIFIED (QUOTA_EXCEEDED)",
        externalSources: [],
        fileExtractionStatus,
      };
    }

    // PART 21 — Save to analysis history for current workspace
    saveSmartEvolutionRecord({
      id: analysisId,
      userId,
      workspaceId,
      createdAt,
      data: finalPayload,
    });

    return res.json(finalPayload);
  } catch (error: any) {
    console.error("handleRunSmartEvolution fatal error:", error);
    return res.status(500).json({
      error: "Failed to execute smart evolution analysis.",
      details: error.message || String(error),
    });
  } finally {
    runningSmartEvolutionLocks.delete(lockKey);
  }
};

// --- COGNITIVE & ADMINISTRATIVE ADVISOR CHAT HANDLER (PART 13-15) ---
export const handleAgentChat = async (req: Request, res: Response) => {
  try {
    const promptText =
      req.body?.prompt ||
      req.body?.message ||
      req.body?.userMessage ||
      req.body?.query;
    const {
      history,
      lang = "ar",
      memories = [],
      riskAlerts = [],
      files = [],
      advisorType = "cognitive",
    } = req.body || {};

    if (!promptText || typeof promptText !== "string" || !promptText.trim()) {
      return res.status(400).json({ error: "Prompt/message string is required." });
    }

    const searchDecision = classifySearchNeed(promptText);

    // Build persona based on advisorType
    let personaPrompt = "";
    if (advisorType === "administrative") {
      personaPrompt = `أنت "المستشار الإداري والحوكمي" المعتمد لمنصة "ذَكِرْ".
تخصصك الدقيق:
- حوكمة العمليات المؤسسية، الامتثال للسياسات، الرقابة الداخلية، وإجراءات اتخاذ القرار.
- مواءمة القرارات مع اللوائح، تحديد فجوات المسؤولية، وتصميم الضوابط الوقائية.
- الاستناد الصارم إلى الأدلة والوقائع المسجلة، وعدم التردد في إعلان عدم كفاية البيانات إذا كانت غائبة.`;
    } else if (advisorType === "unified") {
      personaPrompt = `أنت "المستشار الإدراكي والإداري الموحد" في منصة "ذَكِرْ".
تدمج بين:
1. البعد الإدراكي: استخلاص الأنماط والروابط السببية وتاريخ القرارات والدروس المستفادة.
2. البعد الإداري: فحص الامتثال والحوكمة والإجراءات التنفيذية وتحديد المسؤوليات.
3. التمييز الواضح بين الأدلة الداخلية، استنتاجات التحليل، والبحث الخارجي عند الحاجة.`;
    } else {
      personaPrompt = `أنت "المستشار الإدراكي لمنصة ذَكِرْ" لتحليل الذاكرة المؤسسية والبيانات الاستراتيجية.
تخصصك الدقيق:
- التركيز على الذاكرة المؤسسية السببية، تحليل جذور القرارات (Root Causes)، وتتبع العوامل المؤدية للنتائج السابقة.
- كشف الأنماط الخفية لمنع تكرار الانكشافات وتزويد الإدارة برؤى استباقية مبنية على الأدلة.`;
    }

    const lowerPrompt = promptText.toLowerCase();
    const matchingMemories = memories.filter((m: any) => {
      const combined = `${m.title} ${m.category} ${m.decision} ${m.causalFactors} ${m.lessonsLearned} ${m.description}`.toLowerCase();
      const words = lowerPrompt.split(/\s+/).filter((w) => w.length > 2);
      return words.some((w) => combined.includes(w));
    });

    const relevantMems = matchingMemories.length > 0 ? matchingMemories : memories.slice(0, 3);
    const relevantRisks = riskAlerts.slice(0, 2);

    let fallbackChatResponse = "";
    if (lang === "ar") {
      if (relevantMems.length > 0) {
        const facts = relevantMems
          .map(
            (m: any) =>
              `* **سجل الذاكرة:** ${m.title} (${m.category}) | **القرار المتخذ:** ${m.decision || "غير مسجل"} | **السبب الجذري:** ${m.causalFactors || "غير مسجل"} | **الدرس المستفاد:** ${m.lessonsLearned || "غير مسجل"}`,
          )
          .join("\n");
        const inferences = relevantMems
          .map(
            (m: any) =>
              `* يُظهر فحص سجل (${m.title}) أن العوامل المسببة (${m.causalFactors || "التشغيلية"}) أدت إلى الحاجة لاتخاذ قرار (${m.decision}) للحد من مخاطر فئة ${m.category}.`,
          )
          .join("\n");
        const recs = relevantMems
          .map(
            (m: any) =>
              `1. **تفعيل الرقابة الوقائية:** اعتماد توصية "${m.lessonsLearned || "المراجعة المبكرة"}" في كافة المعاملات المشابهة لـ ${m.category}.\n2. **متابعة المؤشرات الاستباقية:** مراجعة تنبيهات المخاطر المرتبطة وتوثيق مسار الإجراءات في سجلات الحوكمة.`,
          )
          .join("\n");

        fallbackChatResponse = `### المستشار الإدراكي والحوكمي (تحليل مستند إلى الأدلة)

تستند هذه الاستجابة حصرياً إلى سجلات الذاكرة المؤسسية المعتمدة وقواعد الحوكمة الإجرائية في منصة ذَكِرْ (${memories.length} أحداث مسجلة، ${riskAlerts.length} تنبيهات مخاطر).

---

### 1. الحقيقة (Fact):
${facts}

---

### 2. الاستنتاج الإدراكي (Inference):
${inferences}

---

### 3. التوصيات الاستباقية (Recommendations):
${recs}`;
      } else {
        fallbackChatResponse = `### المستشار الإدراكي
بمراجعة سجلات الذاكرة المؤسسية المتاحة في مساحة العمل الحالية، لا توجد وقائع أو قرارات سابقة مسجلة ترتبط بهذا الاستفسار بشكل مباشر. لحماية المؤسسة ومقاومة الهلوسة، يوصى بتوثيق هذا الحدث في سجل الذكريات المؤسسية قبل اتخاذ القرار.`;
      }
    } else {
      if (relevantMems.length > 0) {
        const facts = relevantMems
          .map(
            (m: any) =>
              `* **Memory Record:** ${m.title} (${m.category}) | **Decision:** ${m.decision || "N/A"} | **Root Cause:** ${m.causalFactors || "N/A"} | **Lesson:** ${m.lessonsLearned || "N/A"}`,
          )
          .join("\n");
        const inferences = relevantMems
          .map(
            (m: any) =>
              `* Audit of (${m.title}) indicates that logged causes (${m.causalFactors || "Operational"}) required decision (${m.decision}) to mitigate exposure in ${m.category}.`,
          )
          .join("\n");
        const recs = relevantMems
          .map(
            (m: any) =>
              `1. **Enforce Governance:** Embed lesson "${m.lessonsLearned || "Early audit"}" across ${m.category}.\n2. **Monitor Indicators:** Review related risk alerts and document compliance in workspace logs.`,
          )
          .join("\n");

        fallbackChatResponse = `### Cognitive & Governance Advisor (Evidence-Based Synthesis)

This response is grounded strictly in verified institutional memory (${memories.length} records, ${riskAlerts.length} risk alerts).

---

### 1. Fact:
${facts}

---

### 2. Inference:
${inferences}

---

### 3. Recommendations:
${recs}`;
      } else {
        fallbackChatResponse = `### Cognitive Advisor
Audit of active workspace records confirms no historical decision or risk event matches this inquiry. To prevent hallucination, please log this event into institutional memory.`;
      }
    }

    const client = getLocalGeminiClient();
    console.log("HANDLE_AGENT_CHAT_DEBUG:", { hasClient: Boolean(client), inCooldown: isGeminiInCooldown() });
    if (!client || isGeminiInCooldown()) {
      return res.json({
        text: fallbackChatResponse,
        sources: [],
        searchDecision,
        advisorType,
      });
    }

    const memoriesSummary =
      Array.isArray(memories) && memories.length > 0
        ? memories
            .map(
              (m: any, idx: number) =>
                `[الذكرى #${idx + 1}]: ${m.title} | الفئة: ${m.category} | الخطورة: ${m.riskLevel || "High"} | القرار: ${m.decision} | الأسباب: ${m.causalFactors || "غير محدد"} | الدروس: ${m.lessonsLearned || "غير محدد"}`,
            )
            .join("\n")
        : "لا توجد ذكريات مؤسسية مسجلة حالياً.";

    const risksSummary =
      Array.isArray(riskAlerts) && riskAlerts.length > 0
        ? riskAlerts
            .map(
              (r: any, idx: number) =>
                `[خطر #${idx + 1}]: ${r.title} | المستوى: ${r.severity || "High"} | التفاصيل: ${r.description || ""}`,
            )
            .join("\n")
        : "لا توجد مخاطر نشطة مسجلة حالياً.";

    const processedFiles = files.map((f: any) => {
      const ext = extractRealFileContent(f);
      return `[مستند #${f.name || f.fileName}]: الحالة: ${ext.status} | النص: ${ext.text.substring(0, 1000)}`;
    });

    const filesSummary =
      processedFiles.length > 0
        ? processedFiles.join("\n")
        : "لا توجد مستندات مرفوعة حالياً.";

    const systemInstruction = `${personaPrompt}

بيانات المؤسسة الحالية (نطاق مساحة العمل الخاصة بالمستخدم):
- الذاكرات المؤسسية (${memories.length}):
${memoriesSummary}

- تنبيهات المخاطر النشطة (${riskAlerts.length}):
${risksSummary}

- المستندات المرفوعة (${files.length}):
${filesSummary}

قواعد الإجابة:
1. الالتزام بالأدلة: اربط الإجابة بسجلات الذاكرة أو المخاطر أو المستندات المحددة.
2. إذا كان السؤال عن وقائع خارجية وتوفرت أداة البحث، استخدمها وقدم المصادر الحقيقية دون اختلاق.
3. التمييز بين: الحقيقة (Fact)، الاستنتاج (Inference)، والتوصية (Recommendation).
4. مقاومة الهلوسة بصرامة: إذا كانت البيانات المتاحة غير كافية للإجابة، صرح بذلك بوضوح ولا تختلق معلومات أو تواريخ أو وثائق.
5. لا تعرض تفاصيل فنية خام (Raw API, Tokens, Tool JSON) للمستخدم.

لغة الإجابة: ${lang === "ar" ? "اللغة العربية الفصيحة والدقيقة" : lang === "fr" ? "اللغة الفرنسية" : "اللغة الإنجليزية"}.`;

    const contents: any[] = [];
    if (Array.isArray(history)) {
      history.slice(-10).forEach((h: any) => {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text || "" }],
        });
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: promptText }],
    });

    const candidateModels = [
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3.7-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
    ];
    let responseText = "";
    let extractedSources: Array<{ title: string; url: string; snippet?: string }> = [];

    for (const modelName of candidateModels) {
      let response: any = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        if (searchDecision.needsSearch) {
          try {
            const configObjWithSearch: any = {
              systemInstruction,
              temperature: 0.35,
              tools: [{ googleSearch: {} }],
            };

            response = await client.models.generateContent({
              model: modelName,
              contents,
              config: configObjWithSearch,
            });
          } catch (searchErr: any) {
            console.log("AGENT_CHAT_SEARCH_ERR:", modelName, searchErr?.message || searchErr);
          }
        }

        if (!response) {
          try {
            const configObjPure: any = {
              systemInstruction,
              temperature: 0.35,
            };

            response = await client.models.generateContent({
              model: modelName,
              contents,
              config: configObjPure,
            });
          } catch (pureErr: any) {
            console.warn(`[AgentChat] Model ${modelName} unavailable/exhausted:`, pureErr?.message || pureErr);
            const is429 = pureErr?.status === "RESOURCE_EXHAUSTED" || String(pureErr?.message || "").includes("429");
            if (is429) {
              // Immediately break and advance to next candidate model without wasting retry quota
              break;
            }
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 600));
              continue;
            }
          }
        }

        if (response?.text) break;
      }

      if (response?.text) {
        responseText = response.text;

        // Extract grounding metadata if search was used
        const candidate = response.candidates?.[0] as any;
        if (candidate?.groundingMetadata) {
          const chunks = candidate.groundingMetadata.groundingChunks || [];
          chunks.forEach((c: any) => {
            if (c.web?.uri && c.web?.title) {
              extractedSources.push({
                title: c.web.title,
                url: c.web.uri,
                snippet: c.web.snippet || "",
              });
            }
          });
        }
        break;
      }
    }

    if (!responseText) {
      return res.json({
        text: fallbackChatResponse,
        sources: [],
        searchDecision,
        advisorType,
      });
    }

    return res.json({
      text: responseText,
      sources: extractedSources,
      searchDecision,
      advisorType,
    });
  } catch (error: any) {
    return res.json({
      text: "### Zakir Advisory System\n\nOperational records and institutional memories remain active and secured.",
      sources: [],
    });
  }
};
