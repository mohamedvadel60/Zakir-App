import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
  Printer, 
  X, 
  Sliders, 
  FileText, 
  Building2, 
  CheckSquare, 
  Square, 
  FileDown, 
  RefreshCw, 
  RotateCcw,
  Check,
  ShieldCheck,
  Calendar,
  User,
  Tag,
  Eye,
  Lock,
  Layers
} from "lucide-react";
import { motion } from "motion/react";
import { Memory } from "../types";
import { ZakirLogo } from "./ZakirLogo";

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
  initialSelectedMemoryId?: string | null;
  lang: "en" | "ar" | "fr";
  companyName?: string;
  userName?: string;
  workspaceLogoUrl?: string;
}

export function PrintPreviewModal({
  isOpen,
  onClose,
  memories,
  initialSelectedMemoryId,
  lang,
  companyName = "Zakir - The Organizational Causal Memory",
  userName = "System Administrator",
  workspaceLogoUrl
}: PrintPreviewModalProps) {
  // 1. Memory Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initialSelectedMemoryId) {
      return [initialSelectedMemoryId];
    }
    return memories.map(m => m.id);
  });

  // Sync initial selection when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedMemoryId) {
        setSelectedIds([initialSelectedMemoryId]);
      } else {
        setSelectedIds(memories.map(m => m.id));
      }
    }
  }, [initialSelectedMemoryId, isOpen, memories]);

  // 2. Formatting & Page Layout State
  const [density, setDensity] = useState<"compact" | "standard" | "spacious">("standard");
  const [columns, setColumns] = useState<"1" | "2">("1");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [pageSize, setPageSize] = useState<"A4" | "A3" | "A5" | "Letter" | "Legal">("A4");
  const [lineSpacing, setLineSpacing] = useState<number>(1.2);
  const [pageMargins, setPageMargins] = useState<number>(15);
  const [customFontScale, setCustomFontScale] = useState<number>(100);
  const [printBackgrounds, setPrintBackgrounds] = useState<boolean>(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [documentTheme, setDocumentTheme] = useState<"blue" | "slate" | "emerald" | "rose">("blue");

  // Section Toggles
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [includeCausal, setIncludeCausal] = useState(true);
  const [includeOutcomes, setIncludeOutcomes] = useState(true);
  const [includeLessons, setIncludeLessons] = useState(true);
  const [includeAuthor, setIncludeAuthor] = useState(true);
  const [includeTags, setIncludeTags] = useState(true);
  const [includeSignatureBlock, setIncludeSignatureBlock] = useState(false);
  const [watermark, setWatermark] = useState<"none" | "confidential" | "internal" | "official">("none");

  // Branding & Header Customization
  const [headerStyle, setHeaderStyle] = useState<"standard" | "centered" | "letterhead">("standard");
  const [logoSize, setLogoSize] = useState<"small" | "medium" | "large">("medium");
  const [departmentName, setDepartmentName] = useState<string>(() => {
    return localStorage.getItem("zakir_department_name") || (lang === "ar" ? "إدارة الحوكمة والمخاطر المؤسسية" : "Governance & Risk Intelligence");
  });
  const [documentRef, setDocumentRef] = useState<string>(() => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `DOC-${todayStr}-ZK`;
  });
  const [includeVerificationSeal, setIncludeVerificationSeal] = useState(true);

  // Watermark details
  const [includeCompanyInWatermark, setIncludeCompanyInWatermark] = useState(true);
  const [includeDateInWatermark, setIncludeDateInWatermark] = useState(true);
  const [watermarkDate, setWatermarkDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Custom Logo & Signature Images
  const [companyLogoImg, setCompanyLogoImg] = useState<string | null>(() => {
    return localStorage.getItem("zakir_company_logo") || workspaceLogoUrl || null;
  });
  const [signatureImg, setSignatureImg] = useState<string | null>(null);

  // Synchronize workspace logo
  useEffect(() => {
    if (workspaceLogoUrl) {
      setCompanyLogoImg(workspaceLogoUrl);
    }
  }, [workspaceLogoUrl]);

  // Editable memories copy for on-the-fly corrections before printing
  const [editableMemories, setEditableMemories] = useState<Memory[]>([]);
  useEffect(() => {
    if (isOpen) {
      setEditableMemories(JSON.parse(JSON.stringify(memories)));
    }
  }, [isOpen, memories]);

  const handleUpdateMemoryField = (id: string, field: keyof Memory, value: any) => {
    setEditableMemories(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  // Category filter for selector
  const [categoryFilter, setCategoryFilter] = useState("all");
  const categories = useMemo(() => {
    return Array.from(new Set(memories.map(m => m.category))).filter(Boolean);
  }, [memories]);

  const filteredMemories = useMemo(() => {
    let list = memories;
    if (categoryFilter !== "all") {
      list = list.filter(m => m.category === categoryFilter);
    }
    return list;
  }, [memories, categoryFilter]);

  // Selected memories to render
  const selectedMemories = useMemo(() => {
    const list = editableMemories.length > 0 ? editableMemories : memories;
    return list.filter(m => selectedIds.includes(m.id));
  }, [editableMemories, memories, selectedIds]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredMemories.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMemories.map(m => m.id));
    }
  };

  const toggleSelectMemory = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleResetDefaults = () => {
    setDensity("standard");
    setFontSize("medium");
    setOrientation("portrait");
    setPageSize("A4");
    setLineSpacing(1.2);
    setPageMargins(15);
    setCustomFontScale(100);
    setPreviewZoom(100);
    setDocumentTheme("blue");
    setIncludeHeader(true);
    setIncludeFooter(true);
    setIncludeCausal(true);
    setIncludeOutcomes(true);
    setIncludeLessons(true);
    setIncludeAuthor(true);
    setIncludeTags(true);
    setIncludeSignatureBlock(false);
    setWatermark("none");
    setLogoSize("medium");
    setHeaderStyle("standard");
    setIncludeVerificationSeal(true);
  };

  // Display date formatting
  const displayDate = useMemo(() => {
    if (!watermarkDate) return "";
    try {
      const parts = watermarkDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
          });
        }
      }
      return new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US");
    } catch {
      return watermarkDate;
    }
  }, [watermarkDate, lang]);

  // Dynamic Theme Colors
  const themeColors = useMemo(() => {
    return {
      blue: {
        primary: "text-blue-900",
        accent: "#0075DE",
        border: "border-blue-200",
        badge: "bg-blue-50 text-blue-900 border-blue-200",
        lessonsBg: "bg-blue-50/60 border-blue-200",
        lessonsHeader: "text-blue-900 border-blue-200",
        headerLine: "border-blue-600",
        marker: "bg-blue-600",
        highlightText: "text-blue-800",
      },
      slate: {
        primary: "text-slate-900",
        accent: "#334155",
        border: "border-slate-300",
        badge: "bg-slate-100 text-slate-900 border-slate-300",
        lessonsBg: "bg-slate-100/70 border-slate-300",
        lessonsHeader: "text-slate-900 border-slate-300",
        headerLine: "border-slate-800",
        marker: "bg-slate-800",
        highlightText: "text-slate-800",
      },
      emerald: {
        primary: "text-emerald-900",
        accent: "#059669",
        border: "border-emerald-200",
        badge: "bg-emerald-50 text-emerald-900 border-emerald-200",
        lessonsBg: "bg-emerald-50/60 border-emerald-200",
        lessonsHeader: "text-emerald-900 border-emerald-200",
        headerLine: "border-emerald-600",
        marker: "bg-emerald-600",
        highlightText: "text-emerald-800",
      },
      rose: {
        primary: "text-rose-900",
        accent: "#e11d48",
        border: "border-rose-200",
        badge: "bg-rose-50 text-rose-900 border-rose-200",
        lessonsBg: "bg-rose-50/60 border-rose-200",
        lessonsHeader: "text-rose-900 border-rose-200",
        headerLine: "border-rose-600",
        marker: "bg-rose-600",
        highlightText: "text-rose-800",
      }
    }[documentTheme];
  }, [documentTheme]);

  // Page physical dimensions for preview sizing
  const pagePhysicalDimensions = useMemo(() => {
    const dims: Record<string, { portrait: { width: string; minHeight: string }; landscape: { width: string; minHeight: string } }> = {
      A4: { portrait: { width: "210mm", minHeight: "297mm" }, landscape: { width: "297mm", minHeight: "210mm" } },
      A3: { portrait: { width: "297mm", minHeight: "420mm" }, landscape: { width: "420mm", minHeight: "297mm" } },
      A5: { portrait: { width: "148mm", minHeight: "210mm" }, landscape: { width: "210mm", minHeight: "148mm" } },
      Letter: { portrait: { width: "8.5in", minHeight: "11in" }, landscape: { width: "11in", minHeight: "8.5in" } },
      Legal: { portrait: { width: "8.5in", minHeight: "14in" }, landscape: { width: "14in", minHeight: "8.5in" } },
    };
    return dims[pageSize]?.[orientation] || dims.A4.portrait;
  }, [pageSize, orientation]);

  // Spacing & Typography Styles based on density
  const densityStyles = useMemo(() => {
    return {
      compact: {
        cardPadding: "p-3.5 sm:p-4",
        cardMargin: "mb-3",
        sectionGap: "space-y-2",
        headerPadding: "pb-2 mb-2",
        titleSize: "text-sm font-black text-slate-950",
        sectionTitleSize: "text-[8.5pt] font-black uppercase tracking-wider",
        textSize: "text-xs text-slate-900 leading-normal",
        badgeText: "text-[7.5pt] font-black px-2 py-0.5 rounded border"
      },
      standard: {
        cardPadding: "p-5 sm:p-6",
        cardMargin: "mb-4",
        sectionGap: "space-y-3",
        headerPadding: "pb-2.5 mb-3",
        titleSize: "text-base font-black text-slate-950",
        sectionTitleSize: "text-[9pt] font-black uppercase tracking-wider",
        textSize: "text-sm text-slate-900 leading-relaxed",
        badgeText: "text-[8pt] font-black px-2.5 py-0.5 rounded border"
      },
      spacious: {
        cardPadding: "p-6 sm:p-8",
        cardMargin: "mb-6",
        sectionGap: "space-y-4",
        headerPadding: "pb-3.5 mb-4",
        titleSize: "text-lg font-black text-slate-950",
        sectionTitleSize: "text-[10pt] font-black uppercase tracking-wider",
        textSize: "text-base text-slate-900 leading-relaxed",
        badgeText: "text-[8.5pt] font-black px-3 py-1 rounded border"
      }
    }[density];
  }, [density]);

  // Logo max height mapping
  const logoHeightPx = useMemo(() => {
    if (logoSize === "small") return 32;
    if (logoSize === "large") return 56;
    return 44;
  }, [logoSize]);

  // Direct native print execution
  const executeNativePrint = useCallback(() => {
    setIsPrinting(true);
    document.body.classList.add("printing-active");

    let printStyles = document.getElementById("dynamic-print-overrides") as HTMLStyleElement | null;
    if (!printStyles) {
      printStyles = document.createElement("style");
      printStyles.id = "dynamic-print-overrides";
      document.head.appendChild(printStyles);
    }

    const pageSizeAttr = pageSize === "A4" ? "A4" : pageSize === "Letter" ? "letter" : pageSize === "A3" ? "A3" : pageSize === "A5" ? "A5" : pageSize === "Legal" ? "legal" : "A4";

    printStyles.innerHTML = `
      @page {
        size: ${pageSizeAttr} ${orientation};
        margin: ${pageMargins}mm;
      }
      @media print {
        *, *::before, *::after {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-sizing: border-box !important;
        }

        html, body {
          visibility: visible !important;
          background: #FFFFFF !important;
          color: #0F172A !important;
          margin: 0 !important;
          padding: 0 !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
        }

        /* Hide all application chrome and non-printable elements */
        #root > :not(.print-modal-overlay),
        #zakir-app-root > :not(.print-modal-overlay),
        header, nav, aside, footer:not(.print-document-footer),
        .no-print, .no-print *,
        button, select, input, textarea,
        #sidebar, #navbar, #header, #footer {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          opacity: 0 !important;
        }

        /* Unroll the modal container to standard flow */
        .print-modal-overlay,
        .print-modal-overlay > div,
        .print-content-grid,
        .print-preview-canvas,
        .preview-zoom-container,
        .print-document-container {
          display: block !important;
          position: static !important;
          width: 100% !important;
          max-width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          transform: none !important;
          zoom: 1 !important;
        }

        /* Unified Document Styles in Print */
        .print-document {
          display: block !important;
          position: relative !important;
          width: 100% !important;
          max-width: 100% !important;
          min-height: 0 !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #FFFFFF !important;
          color: #0F172A !important;
          box-shadow: none !important;
          border: none !important;
          border-radius: 0 !important;
          font-size: ${customFontScale}% !important;
          line-height: ${lineSpacing} !important;
        }

        /* Proper pagination and avoid breaking rules */
        .print-heading-group,
        .print-header-container,
        .signature-block,
        .lessons-box,
        .page-break-avoid {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .memory-card-item {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          margin-bottom: ${density === "compact" ? "12px" : density === "spacious" ? "24px" : "16px"} !important;
          border: 1.5px solid #CBD5E1 !important;
          background: #FFFFFF !important;
          box-shadow: none !important;
        }

        p, .break-auto {
          break-inside: auto !important;
          page-break-inside: auto !important;
        }

        table {
          width: 100% !important;
          border-collapse: collapse !important;
        }

        thead {
          display: table-header-group !important;
        }

        tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        /* Clean logo rendering in print */
        .print-logo {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          max-height: ${logoHeightPx}px !important;
          width: auto !important;
          object-fit: contain !important;
          background: transparent !important;
        }
      }
    `;

    window.focus();

    const timer = setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error("Print trigger failed:", err);
      }
    }, 120);

    const fallbackTimer = setTimeout(() => {
      document.body.classList.remove("printing-active");
      setIsPrinting(false);
      const existingStyles = document.getElementById("dynamic-print-overrides");
      if (existingStyles?.parentNode) {
        existingStyles.parentNode.removeChild(existingStyles);
      }
    }, 2500);

    return () => {
      clearTimeout(timer);
      clearTimeout(fallbackTimer);
    };
  }, [pageSize, orientation, pageMargins, lineSpacing, customFontScale, density, logoHeightPx]);

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove("printing-active");
      setIsPrinting(false);
      const existingStyles = document.getElementById("dynamic-print-overrides");
      if (existingStyles?.parentNode) {
        existingStyles.parentNode.removeChild(existingStyles);
      }
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  // UI Localized Strings
  const t = {
    title: lang === "ar" ? "معاينة وتنسيق الطباعة" : (lang === "fr" ? "Aperçu avant impression" : "Print Preview & Formatting"),
    subtitle: lang === "ar" 
      ? "تخصيص التنسيق، الهوية، والكثافة قبل إصدار وثيقة التقرير المطبوعة." 
      : (lang === "fr" 
        ? "Personnalisez la mise en page, la marque et les sections avant l'impression." 
        : "Customize formatting, institutional branding, and density before issuing reports."),
    printBtn: lang === "ar" ? "بدء الطباعة الآن" : (lang === "fr" ? "Imprimer maintenant" : "Print Document Now"),
    exportPdf: lang === "ar" ? "تصدير كـ PDF" : (lang === "fr" ? "Exporter en PDF" : "Export as PDF"),
    closeBtn: lang === "ar" ? "إغلاق" : (lang === "fr" ? "Fermer" : "Close"),
    selectMemories: lang === "ar" ? "اختيار الذكريات المطبوعة" : (lang === "fr" ? "Sélectionner les souvenirs" : "Select Memories to Print"),
    selectAll: lang === "ar" ? "تحديد الكل" : (lang === "fr" ? "Tout sélectionner" : "Select All"),
    layoutSettings: lang === "ar" ? "تنسيق الصفحة والكثافة" : (lang === "fr" ? "Mise en page & Densité" : "Layout & Density"),
    densityLabel: lang === "ar" ? "الكثافة والتباعد:" : (lang === "fr" ? "Densité :" : "Spacing Density:"),
    compact: lang === "ar" ? "مدمج" : (lang === "fr" ? "Compact" : "Compact"),
    standard: lang === "ar" ? "قياسي" : (lang === "fr" ? "Standard" : "Standard"),
    spacious: lang === "ar" ? "واسع" : (lang === "fr" ? "Spacieux" : "Spacious"),
    fontSizeLabel: lang === "ar" ? "حجم الخط:" : (lang === "fr" ? "Taille de police :" : "Font Size:"),
    smallFont: lang === "ar" ? "صغير" : (lang === "fr" ? "Petit" : "Small"),
    mediumFont: lang === "ar" ? "متوسط" : (lang === "fr" ? "Moyen" : "Medium"),
    largeFont: lang === "ar" ? "كبير" : (lang === "fr" ? "Grand" : "Large"),
    orientationLabel: lang === "ar" ? "اتجاه الورقة:" : (lang === "fr" ? "Orientation :" : "Orientation:"),
    portrait: lang === "ar" ? "عمودي (Portrait)" : (lang === "fr" ? "Portrait" : "Portrait"),
    landscape: lang === "ar" ? "أفقي (Landscape)" : (lang === "fr" ? "Paysage" : "Landscape"),
    columnsLabel: lang === "ar" ? "الأعمدة:" : (lang === "fr" ? "Colonnes :" : "Columns:"),
    singleCol: lang === "ar" ? "عمود واحد" : (lang === "fr" ? "Une colonne" : "Single Column"),
    doubleCol: lang === "ar" ? "عمودان" : (lang === "fr" ? "Deux colonnes" : "Two Columns"),
    documentThemeLabel: lang === "ar" ? "سمة التقرير اللونية:" : "Report Color Theme:",
    sectionsToggle: lang === "ar" ? "الأقسام المضمنة في الوثيقة" : (lang === "fr" ? "Sections incluses" : "Included Sections"),
    incHeader: lang === "ar" ? "ترويسة المؤسسة الرسمية" : (lang === "fr" ? "En-tête officiel" : "Official Branding Header"),
    incFooter: lang === "ar" ? "تذييل التوثيق والسرية" : (lang === "fr" ? "Pied de page officiel" : "Document Footer"),
    incCausal: lang === "ar" ? "العوامل المسببة والتحليل" : (lang === "fr" ? "Facteurs causaux" : "Causal Factors & Root Cause"),
    incOutcomes: lang === "ar" ? "النتائج والأثر المترتب" : (lang === "fr" ? "Résultats & Impact" : "Outcomes & Impact"),
    incLessons: lang === "ar" ? "الدروس المستفادة والتوجيهات" : (lang === "fr" ? "Leçons & Recommandations" : "Lessons Learned & Guidelines"),
    incAuthor: lang === "ar" ? "بيانات المالك والتاريخ" : (lang === "fr" ? "Auteur & Date" : "Author & Timestamp"),
    incTags: lang === "ar" ? "الوسوم والتصنيفات" : (lang === "fr" ? "Tags" : "Tags"),
    incSignature: lang === "ar" ? "كتلة التوقيع والاعتماد الرسمي" : (lang === "fr" ? "Bloc de signature officielle" : "Executive Signature Block"),
    watermarkLabel: lang === "ar" ? "العلامة المائية للسرية:" : (lang === "fr" ? "Filigrane :" : "Watermark:"),
    watermarkNone: lang === "ar" ? "بدون علامة" : (lang === "fr" ? "Aucun" : "None"),
    watermarkConfidential: lang === "ar" ? "سري للغاية (CONFIDENTIAL)" : "CONFIDENTIAL",
    watermarkInternal: lang === "ar" ? "للاستخدام الداخلي (INTERNAL)" : "INTERNAL ONLY",
    watermarkOfficial: lang === "ar" ? "سجل رسمي معتمد (OFFICIAL)" : "OFFICIAL RECORD",
    watermarkText: {
      none: "",
      confidential: "STRICTLY CONFIDENTIAL",
      internal: "INTERNAL USE ONLY",
      official: "OFFICIAL RECORD"
    }[watermark],
  };

  // Editable Text Component for live edits in Preview
  function EditableText({
    value,
    onChange,
    className = "",
    disabled = false
  }: {
    value: string;
    onChange?: (val: string) => void;
    className?: string;
    disabled?: boolean;
  }) {
    if (isPrinting || disabled) {
      return (
        <div className={`w-full bg-transparent text-slate-950 whitespace-pre-wrap break-words ${className}`}>
          {value || ""}
        </div>
      );
    }

    return (
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          if (onChange) {
            onChange(e.currentTarget.innerText || "");
          }
        }}
        className={`w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/40 rounded p-0.5 hover:bg-slate-100/70 focus:bg-blue-50/30 text-slate-950 transition-all whitespace-pre-wrap break-words ${className}`}
      >
        {value}
      </div>
    );
  }

  // Render Document Header
  const renderDocumentHeader = () => {
    if (!includeHeader) return null;
    const isRtl = lang === "ar";
    const dateVal = displayDate || new Date().toLocaleDateString(isRtl ? "ar-SA" : "en-US");

    if (headerStyle === "centered") {
      return (
        <header className="print-header-container w-full border-b-2 border-slate-300 pb-4 mb-6 select-none text-center" dir={isRtl ? "rtl" : "ltr"}>
          <div className="flex flex-col items-center justify-center gap-2 mb-3">
            {companyLogoImg ? (
              <img 
                src={companyLogoImg} 
                alt="Company Logo" 
                className="print-logo max-h-12 object-contain" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <ZakirLogo theme="light" size="md" lang={lang} />
            )}
            <div className="text-center">
              <span className="font-extrabold text-sm text-slate-900 block">{companyName}</span>
              {departmentName && (
                <span className="text-[8pt] text-slate-600 block">{departmentName}</span>
              )}
            </div>
          </div>

          <h1 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-tight">
            {lang === "ar" ? "تقرير الذاكرة المؤسسية وسجل القرارات" : "Institutional Memory & Decision Intelligence Report"}
          </h1>

          <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-center gap-6 text-[8pt] text-slate-600 font-mono">
            <span><strong>{lang === "ar" ? "المرجع:" : "REF:"}</strong> {documentRef}</span>
            <span><strong>{lang === "ar" ? "التاريخ:" : "DATE:"}</strong> {dateVal}</span>
            {userName && <span><strong>{lang === "ar" ? "المسؤول:" : "BY:"}</strong> {userName}</span>}
          </div>
        </header>
      );
    }

    if (headerStyle === "letterhead") {
      return (
        <header className="print-header-container w-full border-b-4 border-slate-900 pb-3 mb-6 select-none" dir={isRtl ? "rtl" : "ltr"}>
          <div className="flex items-center justify-between gap-4 pb-2">
            <div>
              <h2 className="text-base font-black text-slate-950 uppercase tracking-wide">{companyName}</h2>
              {departmentName && <p className="text-[8pt] text-slate-600 font-semibold">{departmentName}</p>}
            </div>
            {companyLogoImg ? (
              <img 
                src={companyLogoImg} 
                alt="Company Logo" 
                className="print-logo max-h-12 object-contain" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <ZakirLogo theme="light" size="sm" lang={lang} />
            )}
          </div>
          <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-[8pt] text-slate-700 font-mono">
            <span>{documentRef}</span>
            <span className="font-bold text-slate-950 uppercase">{lang === "ar" ? "سجل توثيق رسمي" : "OFFICIAL RECORD"}</span>
            <span>{dateVal}</span>
          </div>
        </header>
      );
    }

    // Standard Header (Default)
    return (
      <header className="print-header-container w-full border-b-2 border-slate-300 pb-3 mb-5 select-none" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between gap-4 pb-2.5">
          <div className="flex items-center gap-3">
            {companyLogoImg ? (
              <img 
                src={companyLogoImg} 
                alt="Company Logo" 
                className="print-logo object-contain rounded" 
                style={{ maxHeight: `${logoHeightPx}px` }}
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="flex items-center gap-2">
                <ZakirLogo theme="light" size={logoSize === "small" ? "sm" : logoSize === "large" ? "lg" : "md"} lang={lang} />
              </div>
            )}
            <div className="leading-tight">
              <span className="font-extrabold text-xs sm:text-sm text-slate-950 block">{companyName}</span>
              {departmentName && (
                <span className="text-[8pt] text-slate-600 font-medium block">{departmentName}</span>
              )}
            </div>
          </div>

          <div className="text-end">
            <h1 className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-tight">
              {lang === "ar" ? "تقرير الذاكرة المؤسسية وسجل القرارات" : "Institutional Memory & Decision Intelligence Report"}
            </h1>
            <p className="text-[7.5pt] text-slate-500 font-medium mt-0.5">
              {lang === "ar" ? "وثيقة رسمية معتمدة" : "Official Audited Intelligence Document"}
            </p>
          </div>
        </div>

        {/* Bottom meta row */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[8pt] text-slate-600 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="font-bold uppercase text-slate-500">{lang === "ar" ? "رقم المرجع:" : "DOC ID:"}</span>
            <span className="font-bold text-slate-900">{documentRef}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="font-bold uppercase text-slate-500">{lang === "ar" ? "التاريخ:" : "DATE:"}</span>
              <span className="font-semibold text-slate-900">{dateVal}</span>
            </div>
            {userName && (
              <div className="flex items-center gap-1">
                <span className="font-bold uppercase text-slate-500">{lang === "ar" ? "المسؤول:" : "LOGGED BY:"}</span>
                <span className="font-semibold text-slate-900 font-sans">{userName}</span>
              </div>
            )}
          </div>
        </div>
      </header>
    );
  };

  // Render Signature Block
  const renderSignatureBlock = () => {
    if (!includeSignatureBlock) return null;
    const isRtl = lang === "ar";
    const dateVal = displayDate || new Date().toLocaleDateString(isRtl ? "ar-SA" : "en-US");

    return (
      <div className="signature-block mt-8 pt-5 border-t-2 border-slate-300 relative z-10 text-right rtl:text-right page-break-avoid" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${themeColors.marker}`}></div>
            <span className="text-[9pt] font-black uppercase text-slate-900 tracking-wider">
              {lang === "ar" ? "اعتماد وتوقيع التقرير الرسمي" : "OFFICIAL APPROVAL & SIGNATURE PANEL"}
            </span>
          </div>
          {includeVerificationSeal && (
            <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[8pt] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{lang === "ar" ? "معتمد وموثق رقمياً" : "Digitally Verified & Sealed"}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6 w-full text-[9pt]">
          {/* Column 1: Executive Information */}
          <div className="flex flex-col justify-between min-h-[100px] border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <span className="text-[8pt] font-black uppercase text-slate-500 tracking-wider">
              {lang === "ar" ? "الجهة المصدرة" : "ISSUING ENTITY"}
            </span>
            <div className="pt-2 border-t border-slate-200 w-full mt-auto">
              <div className="text-[9pt] font-black text-slate-950 leading-tight">
                {companyName}
              </div>
              {departmentName && (
                <div className="text-[8pt] text-slate-600 font-bold uppercase mt-0.5">
                  {departmentName}
                </div>
              )}
              <div className="text-[8pt] text-slate-600 font-semibold mt-1">
                <span>{lang === "ar" ? "الممثل: " : "Representative: "}</span>
                <span className="text-slate-900 font-bold">{userName}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Signature */}
          <div className="flex flex-col justify-between min-h-[100px] border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <span className="text-[8pt] font-black uppercase text-slate-500 tracking-wider">
              {lang === "ar" ? "التوقيع والختم المعتمد" : "AUTHORIZED SIGNATURE"}
            </span>
            <div className="pt-2 border-t border-slate-200 w-full mt-auto flex flex-col justify-end min-h-[45px]">
              <div className="flex justify-center items-end pb-1 h-10 w-full">
                {signatureImg ? (
                  <img 
                    src={signatureImg} 
                    alt="Signature" 
                    className="h-10 object-contain block" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-[8.5pt] text-slate-400 font-bold italic">
                    {lang === "ar" ? "توقيع معتمد" : "Authorized"}
                  </span>
                )}
              </div>
              <div className="border-b border-slate-300 w-full"></div>
            </div>
          </div>

          {/* Column 3: Approval Date */}
          <div className="flex flex-col justify-between min-h-[100px] border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <span className="text-[8pt] font-black uppercase text-slate-500 tracking-wider">
              {lang === "ar" ? "تاريخ الاعتماد" : "APPROVAL DATE"}
            </span>
            <div className="pt-2 border-t border-slate-200 w-full mt-auto flex flex-col justify-end min-h-[45px]">
              <div className="flex justify-center items-end pb-1 h-10 w-full">
                <span className="text-[9.5pt] font-black text-slate-950 font-mono leading-none">
                  {dateVal}
                </span>
              </div>
              <div className="border-b border-slate-300 w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Document Footer
  const renderDocumentFooter = () => {
    if (!includeFooter) return null;
    const isRtl = lang === "ar";

    return (
      <footer className="print-document-footer mt-8 pt-3 border-t border-slate-300 flex items-center justify-between text-[8pt] text-slate-600 font-mono relative z-10" dir={isRtl ? "rtl" : "ltr"}>
        <span>{companyName}</span>
        <span className="text-center font-bold text-slate-500">
          {lang === "ar" ? "سجل ذاكرة مؤسسية رسمي — سري ومحمي" : "Strictly Confidential Institutional Memory Record"}
        </span>
        <span>{documentRef}</span>
      </footer>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="print-modal-overlay dark-section fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 selection:bg-[#0075DE]/30">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl w-full max-w-7xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-[var(--text-primary)]"
      >
        {/* Modal Top Bar (No Print) */}
        <div className="no-print p-4 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between gap-4 bg-[var(--bg-tertiary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0075DE]/10 border border-[#0075DE]/20 text-[#0075DE] flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{t.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#0075DE]/15 text-blue-400 border border-[#0075DE]/30 font-mono font-bold">
                  {selectedMemories.length} {lang === "ar" ? "سجلات مختارة" : "Items Selected"}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={executeNativePrint}
              className="px-4 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 active:bg-slate-900 border border-slate-700 text-slate-100 font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
              title={t.exportPdf}
            >
              <FileDown className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">{t.exportPdf}</span>
            </button>

            <button
              type="button"
              onClick={executeNativePrint}
              className="px-5 py-2.5 rounded-xl bg-[#0075DE] hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>{t.printBtn}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body: Sidebar Settings + Live Preview Stage */}
        <div className="print-content-grid flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-800">
          
          {/* CONTROL PANEL SIDEBAR (No Print) */}
          <div className="no-print lg:col-span-4 p-4 sm:p-5 space-y-5 bg-slate-950/50 overflow-y-auto max-h-[calc(94vh-80px)]">
            
            {/* 1. Memory Records Selector */}
            <div className="space-y-3 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  <span>{t.selectMemories}</span>
                </span>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-[11px] text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  {t.selectAll} ({selectedIds.length}/{filteredMemories.length})
                </button>
              </div>

              {/* Category Filter */}
              {categories.length > 1 && (
                <div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">{lang === "ar" ? "كل الفئات والأقسام" : "All Categories"}</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Memory List with Checkboxes */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {filteredMemories.map((m) => {
                  const isSelected = selectedIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleSelectMemory(m.id)}
                      className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                        isSelected 
                          ? "bg-[#0075DE]/15 border-[#0075DE]/40 text-blue-100" 
                          : "bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-semibold truncate text-[11px]">{m.title}</div>
                        <div className="text-[9px] text-slate-500 font-mono truncate">
                          {m.category} • {m.riskLevel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Formatting & Page Layout */}
            <div className="space-y-4 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  <span>{t.layoutSettings}</span>
                </span>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  title="Reset to defaults"
                >
                  <RotateCcw className="w-3 h-3 text-rose-400" />
                  <span>{lang === "ar" ? "افتراضي" : "Reset"}</span>
                </button>
              </div>

              {/* Spacing Density */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{t.densityLabel}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["compact", "standard", "spacious"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDensity(d)}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        density === d 
                          ? "bg-[#0075DE] text-white border-[#0075DE]" 
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {t[d]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{t.fontSizeLabel}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "small", label: t.smallFont },
                    { id: "medium", label: t.mediumFont },
                    { id: "large", label: t.largeFont }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFontSize(f.id as any)}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        fontSize === f.id 
                          ? "bg-[#0075DE] text-white border-[#0075DE]" 
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{t.documentThemeLabel}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: "blue", name: lang === "ar" ? "أزرق" : "Blue", color: "bg-blue-500" },
                    { id: "slate", name: lang === "ar" ? "رمادي" : "Slate", color: "bg-slate-500" },
                    { id: "emerald", name: lang === "ar" ? "أخضر" : "Emerald", color: "bg-emerald-500" },
                    { id: "rose", name: lang === "ar" ? "أحمر" : "Rose", color: "bg-rose-500" }
                  ].map((thm) => (
                    <button
                      key={thm.id}
                      type="button"
                      onClick={() => setDocumentTheme(thm.id as any)}
                      className={`py-1.5 rounded-lg border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        documentTheme === thm.id 
                          ? "bg-slate-800 border-blue-500 text-white" 
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${thm.color}`}></span>
                      <span className="text-[9px] font-semibold">{thm.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientation & Columns */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{t.orientationLabel}</label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as any)}
                    className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="portrait">{t.portrait}</option>
                    <option value="landscape">{t.landscape}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{t.columnsLabel}</label>
                  <select
                    value={columns}
                    onChange={(e) => setColumns(e.target.value as any)}
                    className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="1">{t.singleCol}</option>
                    <option value="2">{t.doubleCol}</option>
                  </select>
                </div>
              </div>

              {/* Page Size & Line Spacing */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    {lang === "ar" ? "حجم الصفحة:" : "Page Size:"}
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as any)}
                    className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="A4">A4 (210 x 297 mm)</option>
                    <option value="A3">A3 (297 x 420 mm)</option>
                    <option value="A5">A5 (148 x 210 mm)</option>
                    <option value="Letter">Letter (8.5 x 11 in)</option>
                    <option value="Legal">Legal (8.5 x 14 in)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    {lang === "ar" ? "تباعد الأسطر:" : "Line Spacing:"}
                  </label>
                  <select
                    value={lineSpacing}
                    onChange={(e) => setLineSpacing(parseFloat(e.target.value))}
                    className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="1.0">1.0 ({lang === "ar" ? "مفرد" : "Single"})</option>
                    <option value="1.2">1.2 ({lang === "ar" ? "افتراضي" : "Default"})</option>
                    <option value="1.5">1.5 ({lang === "ar" ? "متوسط" : "1.5"})</option>
                    <option value="1.8">1.8 ({lang === "ar" ? "مزدوج" : "Double"})</option>
                  </select>
                </div>
              </div>

              {/* Margins Slider & Presets */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>{lang === "ar" ? "هوامش الورقة:" : "Page Margins:"}</span>
                  <span className="font-mono text-blue-400 font-bold">{pageMargins}mm</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "narrow", label: lang === "ar" ? "ضيق (10mm)" : "Narrow (10mm)", val: 10 },
                    { id: "normal", label: lang === "ar" ? "افتراضي (15mm)" : "Normal (15mm)", val: 15 },
                    { id: "wide", label: lang === "ar" ? "عريض (25mm)" : "Wide (25mm)", val: 25 }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPageMargins(m.val)}
                      className={`py-1 px-1.5 text-[9px] font-bold rounded-lg border transition-all cursor-pointer truncate ${
                        pageMargins === m.val
                          ? "bg-[#0075DE] text-white border-[#0075DE]"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="35" 
                  value={pageMargins} 
                  onChange={(e) => setPageMargins(parseInt(e.target.value))} 
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Font Scale Slider */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>{lang === "ar" ? "مقياس حجم الخط:" : "Font Scale:"}</span>
                  <span className="font-mono text-blue-400 font-bold">{customFontScale}%</span>
                </div>
                <input 
                  type="range" 
                  min="75" 
                  max="140" 
                  value={customFontScale} 
                  onChange={(e) => setCustomFontScale(parseInt(e.target.value))} 
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Print Backgrounds Checkbox */}
              <div className="pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 text-[10px] text-slate-300 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={printBackgrounds}
                    onChange={(e) => setPrintBackgrounds(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-800 text-blue-500 focus:ring-blue-500 accent-blue-500 cursor-pointer"
                  />
                  <span className="font-semibold">{lang === "ar" ? "طباعة رسومات وخلفيات الألوان (Backgrounds)" : "Print Background Colors & Graphics"}</span>
                </label>
              </div>
            </div>

            {/* 3. Branding & Header Layout Controls */}
            <div className="space-y-3 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Building2 className="w-4 h-4" />
                <span>{lang === "ar" ? "هوية المؤسسة وترويسة التقرير" : "Company Branding & Header"}</span>
              </span>

              {/* Company Name */}
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400">
                  {lang === "ar" ? "اسم الشركة / المؤسسة المعتمد:" : "Approved Organization Name:"}
                </label>
                <div className="w-full h-8 px-2.5 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-400 flex items-center cursor-not-allowed opacity-85 font-semibold">
                  {companyName}
                </div>
              </div>

              {/* Department Name */}
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400">
                  {lang === "ar" ? "الإدارة / القطاع:" : "Department / Sector:"}
                </label>
                <input 
                  type="text"
                  value={departmentName}
                  onChange={(e) => {
                    setDepartmentName(e.target.value);
                    try { localStorage.setItem("zakir_department_name", e.target.value); } catch {}
                  }}
                  className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  placeholder={lang === "ar" ? "اسم الإدارة..." : "Department Name..."}
                />
              </div>

              {/* Document Reference Number */}
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400">
                  {lang === "ar" ? "رقم المرجع والتوثيق:" : "Document Reference ID:"}
                </label>
                <input 
                  type="text"
                  value={documentRef}
                  onChange={(e) => setDocumentRef(e.target.value)}
                  className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-blue-400 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Header Style */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                  {lang === "ar" ? "تصميم الترويسة:" : "Header Layout:"}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "standard", label: lang === "ar" ? "قياسية" : "Standard" },
                    { id: "centered", label: lang === "ar" ? "مركزية" : "Centered" },
                    { id: "letterhead", label: lang === "ar" ? "خطاب رسمي" : "Letterhead" }
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setHeaderStyle(style.id as any)}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        headerStyle === style.id
                          ? "bg-[#0075DE] text-white border-[#0075DE] shadow"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logo Size Control */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-semibold text-slate-400">
                    {lang === "ar" ? "حجم شعار الشركة:" : "Logo Sizing:"}
                  </label>
                  <div className="flex gap-1">
                    {(["small", "medium", "large"] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setLogoSize(sz)}
                        className={`px-2 py-0.5 text-[9px] font-bold rounded border transition-all cursor-pointer ${
                          logoSize === sz
                            ? "bg-[#0075DE]/20 text-blue-400 border-[#0075DE]"
                            : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300"
                        }`}
                      >
                        {sz === "small" ? (lang === "ar" ? "صغير" : "S") : sz === "medium" ? (lang === "ar" ? "وسط" : "M") : (lang === "ar" ? "كبير" : "L")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo Upload Box */}
                <div className="space-y-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    id="modal-company-logo-upload"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string;
                          setCompanyLogoImg(base64);
                          try { localStorage.setItem("zakir_company_logo", base64); } catch {}
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <label 
                      htmlFor="modal-company-logo-upload"
                      className="flex-1 py-1.5 px-2.5 text-[10px] font-bold text-center rounded-lg border border-dashed border-slate-700 bg-slate-950 text-blue-400 hover:text-blue-300 hover:bg-slate-900 transition-all cursor-pointer"
                    >
                      {companyLogoImg ? (lang === "ar" ? "تغيير الشعار" : "Change Logo") : (lang === "ar" ? "رفع شعار الشركة" : "Upload Logo")}
                    </label>
                    {companyLogoImg && (
                      <button
                        type="button"
                        onClick={() => {
                          setCompanyLogoImg(null);
                          try { localStorage.removeItem("zakir_company_logo"); } catch {}
                        }}
                        className="px-2.5 bg-rose-950/40 border border-rose-800 text-rose-400 rounded-lg text-[10px] font-bold hover:bg-rose-900 transition-all cursor-pointer"
                      >
                        {lang === "ar" ? "حذف" : "Remove"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Watermark Selector */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="block text-[10px] font-semibold text-slate-400">{t.watermarkLabel}</label>
                <select
                  value={watermark}
                  onChange={(e) => setWatermark(e.target.value as any)}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="none">{t.watermarkNone}</option>
                  <option value="confidential">{t.watermarkConfidential}</option>
                  <option value="internal">{t.watermarkInternal}</option>
                  <option value="official">{t.watermarkOfficial}</option>
                </select>
              </div>

              {/* Signature Upload */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="block text-[10px] font-semibold text-slate-400">
                  {lang === "ar" ? "رفع التوقيع المعتمد:" : "Upload Authorized Signature:"}
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  id="modal-sig-upload"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setSignatureImg(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div className="flex gap-2">
                  <label 
                    htmlFor="modal-sig-upload"
                    className="flex-1 py-1.5 px-2.5 text-[10px] font-bold text-center rounded-lg border border-dashed border-slate-700 bg-slate-950 text-blue-400 hover:text-blue-300 hover:bg-slate-900 transition-all cursor-pointer"
                  >
                    {signatureImg ? (lang === "ar" ? "تغيير التوقيع" : "Change Signature") : (lang === "ar" ? "رفع التوقيع" : "Upload Signature")}
                  </label>
                  {signatureImg && (
                    <button
                      type="button"
                      onClick={() => setSignatureImg(null)}
                      className="px-2.5 bg-rose-950/40 border border-rose-800 text-rose-400 rounded-lg text-[10px] font-bold hover:bg-rose-900 transition-all cursor-pointer"
                    >
                      {lang === "ar" ? "حذف" : "Remove"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Included Sections Toggles */}
            <div className="space-y-2 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-3">
                <Check className="w-4 h-4" />
                <span>{t.sectionsToggle}</span>
              </span>

              {[
                { state: includeHeader, set: setIncludeHeader, label: t.incHeader },
                { state: includeFooter, set: setIncludeFooter, label: t.incFooter },
                { state: includeCausal, set: setIncludeCausal, label: t.incCausal },
                { state: includeOutcomes, set: setIncludeOutcomes, label: t.incOutcomes },
                { state: includeLessons, set: setIncludeLessons, label: t.incLessons },
                { state: includeAuthor, set: setIncludeAuthor, label: t.incAuthor },
                { state: includeTags, set: setIncludeTags, label: t.incTags },
                { state: includeSignatureBlock, set: setIncludeSignatureBlock, label: t.incSignature }
              ].map((item, idx) => (
                <label key={idx} className="flex items-center justify-between text-xs text-slate-300 cursor-pointer py-1 hover:text-white">
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={item.state}
                    onChange={(e) => item.set(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-blue-500 focus:ring-blue-500 accent-blue-500 cursor-pointer"
                  />
                </label>
              ))}
            </div>

          </div>

          {/* LIVE PREVIEW CANVAS (Single Source of Truth Document) */}
          <div className="print-preview-canvas lg:col-span-8 p-4 sm:p-8 bg-slate-950 overflow-y-auto max-h-[calc(94vh-80px)] flex flex-col items-center gap-4 selection:bg-[#0075DE]/30">
            
            {/* Zoom Toolbar for on-screen preview */}
            <div className="no-print w-full flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-900/95 border border-slate-800 rounded-xl mb-1 text-xs shadow-lg">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="font-semibold text-slate-400">{lang === "ar" ? "المستند:" : "Document:"}</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-950/80 border border-blue-800 text-blue-300 font-mono font-bold">
                  {selectedMemories.length} {lang === "ar" ? "سجلات" : "Records"}
                </span>
                <span className="text-slate-500 font-mono text-[11px]">
                  ({pageSize} • {orientation === "portrait" ? (lang === "ar" ? "عمودي" : "Portrait") : (lang === "ar" ? "أفقي" : "Landscape")})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px] font-semibold">{lang === "ar" ? "المعاينة:" : "Zoom:"}</span>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold transition-colors cursor-pointer"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(100)}
                  className="px-2.5 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 font-mono font-bold text-xs transition-colors cursor-pointer"
                >
                  {previewZoom}%
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(z => Math.min(150, z + 10))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {selectedMemories.length === 0 ? (
              <div className="py-20 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl my-8 w-full max-w-md">
                <FileText className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-bold text-slate-300">{lang === "ar" ? "لم يتم اختيار أي ذاكرة للطباعة" : "No memories selected for printing"}</p>
                <p className="text-xs text-slate-500 mt-1">{lang === "ar" ? "يرجى تحديد ذكريات من القائمة الجانبية" : "Please check items from the sidebar"}</p>
              </div>
            ) : (
              /* Preview Wrapper with Zoom Control */
              <div 
                className="preview-zoom-container w-full flex flex-col items-center origin-top transition-transform duration-150"
                style={{
                  transform: previewZoom === 100 ? "none" : `scale(${previewZoom / 100})`,
                  transformOrigin: "top center"
                }}
              >
                {/* Unified Print Document */}
                <article
                  className="print-document bg-white text-slate-900 shadow-2xl relative border border-slate-300 rounded-sm mb-6 flex flex-col justify-start"
                  style={{
                    width: pagePhysicalDimensions.width,
                    minHeight: pagePhysicalDimensions.minHeight,
                    padding: `${pageMargins}mm`,
                    boxSizing: "border-box",
                    lineHeight: lineSpacing,
                    fontSize: `${customFontScale}%`,
                  }}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                >
                  {/* Optional Confidentiality Watermark */}
                  {t.watermarkText && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none">
                      <div className="text-slate-300/35 font-black tracking-widest uppercase -rotate-45 text-center px-6 border-8 border-slate-300/25 rounded-3xl py-8 flex flex-col items-center gap-2 max-w-[85%]">
                        <span className="text-4xl sm:text-5xl md:text-6xl font-black leading-none">
                          {t.watermarkText}
                        </span>
                        {(includeCompanyInWatermark || includeDateInWatermark) && (
                          <div className="text-[11px] sm:text-xs font-bold flex flex-col items-center gap-0.5 pt-1.5 border-t border-slate-300/30 w-full mt-1.5 opacity-85 font-sans">
                            {includeCompanyInWatermark && (
                              <span>{companyName}</span>
                            )}
                            {includeDateInWatermark && displayDate && (
                              <span className="font-mono">{displayDate}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Document Header */}
                  {renderDocumentHeader()}

                  {/* Document Content List */}
                  <main className={`flex-1 relative z-10 ${columns === "2" ? "grid grid-cols-2 gap-4 items-start" : "space-y-4"}`}>
                    {selectedMemories.map((m, idx) => (
                      <div 
                        key={m.id}
                        className={`memory-card-item bg-white border-2 border-slate-300 rounded-xl text-slate-950 shadow-sm ${densityStyles.cardMargin} ${densityStyles.cardPadding} text-right rtl:text-right group relative hover:border-blue-400 hover:shadow-md transition-all duration-200`}
                        dir={lang === "ar" ? "rtl" : "ltr"}
                      >
                        {/* Exclude memory card button (Preview only) */}
                        <div className="no-print absolute top-3 ltr:right-3 rtl:left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            type="button"
                            onClick={() => toggleSelectMemory(m.id)}
                            className="p-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                            title={lang === "ar" ? "استبعاد من التقرير" : "Exclude from report"}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>{lang === "ar" ? "استبعاد" : "Exclude"}</span>
                          </button>
                        </div>

                        {/* Card Header: Badges & Record Number */}
                        <div className={densityStyles.headerPadding}>
                          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className={`${densityStyles.badgeText} uppercase ${themeColors.badge}`}>
                                {m.category}
                              </span>
                              <span className={`${densityStyles.badgeText} uppercase ${
                                m.riskLevel === "Critical" 
                                  ? "bg-rose-100 text-rose-950 border-rose-300 font-black" 
                                  : m.riskLevel === "High"
                                  ? "bg-amber-100 text-amber-950 border-amber-300 font-bold"
                                  : m.riskLevel === "Medium"
                                  ? "bg-blue-100 text-blue-950 border-blue-300"
                                  : "bg-slate-200 text-slate-900 border-slate-300"
                              }`}>
                                {m.riskLevel}
                              </span>
                            </div>
                            <span className="text-[8.5pt] text-slate-600 font-mono font-extrabold">
                              #{m.id.slice(0, 8).toUpperCase()} • {new Date(m.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
                            </span>
                          </div>

                          <EditableText
                            value={m.title}
                            onChange={(val) => handleUpdateMemoryField(m.id, "title", val)}
                            className={densityStyles.titleSize}
                          />
                        </div>

                        {/* Main Content Sections */}
                        <div className={densityStyles.sectionGap}>
                          {/* Narrative & Decision */}
                          <div>
                            <h4 className={`${densityStyles.sectionTitleSize} ${themeColors.highlightText} mb-1`}>
                              {lang === "ar" ? "سرد الحدث والموقف" : "Event Narrative"}
                            </h4>
                            <EditableText
                              value={m.description}
                              onChange={(val) => handleUpdateMemoryField(m.id, "description", val)}
                              className={densityStyles.textSize}
                            />
                          </div>

                          <div>
                            <h4 className={`${densityStyles.sectionTitleSize} ${themeColors.highlightText} mb-1`}>
                              {lang === "ar" ? "القرار المتخذ" : "Decision Taken"}
                            </h4>
                            <EditableText
                              value={m.decision}
                              onChange={(val) => handleUpdateMemoryField(m.id, "decision", val)}
                              className={densityStyles.textSize}
                            />
                          </div>

                          {/* Causal Factors */}
                          {includeCausal && m.causalFactors && (
                            <div>
                              <h4 className={`${densityStyles.sectionTitleSize} ${themeColors.highlightText} mb-1`}>
                                {lang === "ar" ? "العوامل المسببة والتحليل الجذري" : "Causal Factors & Root Cause"}
                              </h4>
                              <EditableText
                                value={m.causalFactors}
                                onChange={(val) => handleUpdateMemoryField(m.id, "causalFactors", val)}
                                className={densityStyles.textSize}
                              />
                            </div>
                          )}

                          {/* Outcomes */}
                          {includeOutcomes && m.outcomes && (
                            <div>
                              <h4 className={`${densityStyles.sectionTitleSize} ${themeColors.highlightText} mb-1`}>
                                {lang === "ar" ? "النتائج والأثر المترتب" : "Outcomes & Impact"}
                              </h4>
                              <EditableText
                                value={m.outcomes}
                                onChange={(val) => handleUpdateMemoryField(m.id, "outcomes", val)}
                                className={densityStyles.textSize}
                              />
                            </div>
                          )}

                          {/* Lessons Learned Highlight Box */}
                          {includeLessons && m.lessonsLearned && (
                            <div className={`lessons-box rounded-lg border-2 p-3 sm:p-4 ${themeColors.lessonsBg}`}>
                              <h4 className={`${densityStyles.sectionTitleSize} ${themeColors.lessonsHeader} mb-1`}>
                                {lang === "ar" ? "الدروس المستفادة والتوجيهات المستقبلية" : "Lessons Learned & Guidelines"}
                              </h4>
                              <EditableText
                                value={m.lessonsLearned}
                                onChange={(val) => handleUpdateMemoryField(m.id, "lessonsLearned", val)}
                                className={`${densityStyles.textSize} font-bold text-slate-950`}
                              />
                            </div>
                          )}

                          {/* Record Footer: Author & Tags */}
                          {(includeAuthor || (includeTags && m.tags && m.tags.length > 0)) && (
                            <div className="flex items-center justify-between gap-4 pt-2.5 border-t border-slate-250 text-slate-600 text-[8pt] font-semibold">
                              {includeAuthor && (
                                <div className="flex items-center gap-1">
                                  <span>{lang === "ar" ? "المسؤول عن التوثيق: " : "Logged by: "}</span>
                                  <span className="text-slate-900 font-extrabold">{userName}</span>
                                </div>
                              )}
                              {includeTags && m.tags && m.tags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap justify-end">
                                  <span>{lang === "ar" ? "الوسوم: " : "Tags: "}</span>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {m.tags.map((tag) => (
                                      <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 font-mono text-[7pt] font-bold">
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </main>

                  {/* Executive Signature Block */}
                  {renderSignatureBlock()}

                  {/* Document Footer */}
                  {renderDocumentFooter()}
                </article>
              </div>
            )}

          </div>

        </div>
      </motion.div>
    </div>
  );
}
