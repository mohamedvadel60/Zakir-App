import React, { useState, useMemo } from "react";
import { 
  Printer, 
  X, 
  Sliders, 
  Check, 
  FileText, 
  Building2, 
  ShieldAlert, 
  Calendar, 
  User, 
  Grid, 
  AlignLeft, 
  Maximize2, 
  LayoutList,
  Sparkles,
  Award,
  CheckSquare,
  Square,
  Filter,
  FileDown,
  RefreshCw,
  RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Memory } from "../types";

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

  // Sync initial selection if changed on open, and auto-expand and auto-print on 'Print All'
  React.useEffect(() => {
    if (isOpen) {
      if (initialSelectedMemoryId) {
        setSelectedIds([initialSelectedMemoryId]);
      } else {
        // 'Print All' chosen:
        // Automatically select/expand all memories
        setSelectedIds(memories.map(m => m.id));
        
        // Ensure all content sections are expanded/included
        setIncludeCausal(true);
        setIncludeOutcomes(true);
        setIncludeLessons(true);
        setIncludeAuthor(true);
        setIncludeTags(true);
        setIncludeSummaryTable(true);
        
        // Trigger print after a brief render delay (e.g. 1000ms) to allow layout reflow
        const timer = setTimeout(() => {
          executeNativePrint();
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [initialSelectedMemoryId, isOpen, memories]);

  // 2. Formatting Options State
  const [density, setDensity] = useState<"compact" | "standard" | "spacious">("standard");
  const [columns, setColumns] = useState<"1" | "2">("1");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [pageSize, setPageSize] = useState<"A4" | "A3" | "A5" | "Letter" | "Legal">("A4");
  const [lineSpacing, setLineSpacing] = useState<number>(1.15);
  const [pageMargins, setPageMargins] = useState<number>(40);
  const [customFontScale, setCustomFontScale] = useState<number>(100);
  const [isPrinting, setIsPrinting] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshPreview = () => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const handleResetDefaults = () => {
    setDensity("standard");
    setFontSize("medium");
    setOrientation("portrait");
    setPageSize("A4");
    setLineSpacing(1.15);
    setPageMargins(40);
    setCustomFontScale(100);
    setDocumentTheme("blue");
    setIncludeHeader(true);
    setIncludeFooter(true);
    setIncludeCausal(true);
    setIncludeOutcomes(true);
    setIncludeLessons(true);
    setIncludeAuthor(true);
    setIncludeTags(true);
    setIncludeSignatureBlock(false);
    setIncludeSummaryTable(true);
    setWatermark("none");
    setPageBreakBetween(false);
    setLogoSize("medium");
    setHeaderStyle("standard");
    setIncludeVerificationSeal(true);
    setRefreshTrigger(prev => prev + 1);
  };

  // Card spacing dynamic calculation for responsive typography and margins
  const cardSpacing = useMemo(() => {
    return {
      compact: {
        cardPadding: "p-3",
        cardMargin: "mb-3",
        sectionGap: "space-y-1.5",
        headerPadding: "pb-1.5 mb-1.5 border-b border-slate-250",
        sectionPadding: "pb-1.5",
        innerGap: "space-y-1",
        titleSize: "text-sm font-black text-slate-950 mt-1",
        sectionTitleSize: "text-[8pt] font-black border-b border-slate-200 pb-0.5 mb-0.5 uppercase tracking-wider",
        textSize: "text-slate-900 font-normal leading-relaxed text-xs",
        badgeText: "text-[7.5pt] font-black px-1.5 py-0.5 rounded border"
      },
      standard: {
        cardPadding: "p-4 sm:p-5",
        cardMargin: "mb-4",
        sectionGap: "space-y-2.5",
        headerPadding: "pb-2 mb-2 border-b border-slate-300",
        sectionPadding: "pb-2",
        innerGap: "space-y-1.5",
        titleSize: "text-base font-black text-slate-950 mt-1.5",
        sectionTitleSize: "text-[9pt] font-black border-b border-slate-300 pb-0.5 mb-1 uppercase tracking-wider",
        textSize: "text-slate-900 font-normal leading-relaxed text-sm",
        badgeText: "text-[8.5pt] font-black px-2 py-0.5 rounded border"
      },
      spacious: {
        cardPadding: "p-6 sm:p-7",
        cardMargin: "mb-5",
        sectionGap: "space-y-4",
        headerPadding: "pb-3 mb-3 border-b-2 border-slate-300",
        sectionPadding: "pb-3",
        innerGap: "space-y-2.5",
        titleSize: "text-lg font-black text-slate-950 mt-2",
        sectionTitleSize: "text-[10pt] font-black border-b border-slate-300 pb-0.5 mb-1 uppercase tracking-wider",
        textSize: "text-slate-900 font-normal leading-relaxed text-sm",
        badgeText: "text-[9pt] font-black px-2.5 py-0.5 rounded border"
      }
    }[density];
  }, [density]);

  // Local editable memories to enable Word-like document editing
  const [editableMemories, setEditableMemories] = useState<Memory[]>([]);

  // Initialize and synchronize editableMemories when memories are loaded
  React.useEffect(() => {
    if (isOpen) {
      setEditableMemories(JSON.parse(JSON.stringify(memories)));
    }
  }, [isOpen, memories]);

  const handleUpdateMemoryField = (id: string, field: keyof Memory, value: any) => {
    setEditableMemories(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };
  
  // Section Visibility Toggles
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [includeCausal, setIncludeCausal] = useState(true);
  const [includeOutcomes, setIncludeOutcomes] = useState(true);
  const [includeLessons, setIncludeLessons] = useState(true);
  const [includeAuthor, setIncludeAuthor] = useState(true);
  const [includeTags, setIncludeTags] = useState(true);
  const [includeSignatureBlock, setIncludeSignatureBlock] = useState(false);
  const [watermark, setWatermark] = useState<"none" | "confidential" | "internal" | "official">("none");
  const [pageBreakBetween, setPageBreakBetween] = useState(false);
  const [documentTheme, setDocumentTheme] = useState<"slate" | "blue" | "emerald" | "rose">("blue");
  const [includeSummaryTable, setIncludeSummaryTable] = useState(true);

  // Watermark details customization state
  const [watermarkCompany, setWatermarkCompany] = useState(companyName);
  const [watermarkDate, setWatermarkDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Synchronize company name automatically when updated in account settings (database)
  React.useEffect(() => {
    setWatermarkCompany(companyName);
  }, [companyName]);

  // Automatically synchronize printing/watermark date to current system date when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setWatermarkDate(`${yyyy}-${mm}-${dd}`);
    }
  }, [isOpen]);

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
      const dateObj = new Date(watermarkDate);
      if (isNaN(dateObj.getTime())) return watermarkDate;
      return dateObj.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch (e) {
      return watermarkDate;
    }
  }, [watermarkDate, lang]);

  const [includeCompanyInWatermark, setIncludeCompanyInWatermark] = useState(true);
  const [includeDateInWatermark, setIncludeDateInWatermark] = useState(true);

  // Custom signature upload state
  const [signatureImg, setSignatureImg] = useState<string | null>(null);

  // Custom company logo upload state with local storage persistence
  const [companyLogoImg, setCompanyLogoImg] = useState<string | null>(() => {
    return localStorage.getItem("zakir_company_logo") || workspaceLogoUrl || null;
  });

  // Logo size state: 'small' | 'medium' | 'large'
  const [logoSize, setLogoSize] = useState<"small" | "medium" | "large">("medium");

  // Header layout style: 'standard' | 'centered' | 'letterhead'
  const [headerStyle, setHeaderStyle] = useState<"standard" | "centered" | "letterhead">("standard");

  // Custom Department / Sector name
  const [departmentName, setDepartmentName] = useState<string>(() => {
    return localStorage.getItem("zakir_department_name") || (lang === "ar" ? "إدارة الحوكمة والمخاطر المؤسسية" : "Governance & Risk Intelligence");
  });

  // Document Reference Number
  const [documentRef, setDocumentRef] = useState<string>(() => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `DOC-${todayStr}-ZK`;
  });

  // Include Verification Seal toggle
  const [includeVerificationSeal, setIncludeVerificationSeal] = useState(true);

  // Synchronize workspace logo URL automatically when available
  React.useEffect(() => {
    if (workspaceLogoUrl) {
      setCompanyLogoImg(workspaceLogoUrl);
    }
  }, [workspaceLogoUrl]);

  // Filter state inside modal
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

  // Direct native print dialog executor ensuring synchronous user-initiated activation
  const executeNativePrint = React.useCallback(() => {
    setIsPrinting(true);

    // 1. Add class to document body to hide non-printable UI elements
    document.body.classList.add("printing-active");

    // 2. Add dynamic print override CSS for robust cross-browser printable visibility
    let printStyles = document.getElementById("dynamic-print-overrides") as HTMLStyleElement | null;
    if (!printStyles) {
      printStyles = document.createElement("style");
      printStyles.id = "dynamic-print-overrides";
      document.head.appendChild(printStyles);
    }

    const { width: pWidth, height: pHeight } = getPageDimensions();

    // Convert pixel dimensions to mm for precise standard layout
    // 1px is approx 0.264583mm
    const marginMm = pageMargins * 0.264583;
    const pWidthMm = pWidth * 0.264583;
    const pHeightMm = pHeight * 0.264583;
    const usableHeightMm = pHeightMm - (2 * marginMm);

    const themeCss = {
      blue: `
        .memory-card-item h4 { color: #1e40af !important; }
        .lessons-box { background: #eff6ff !important; border-color: #dbeafe !important; }
        .lessons-box h4 { color: #1e3a8a !important; }
        .theme-marker { background-color: #2563eb !important; }
      `,
      slate: `
        .memory-card-item h4 { color: #1e293b !important; }
        .lessons-box { background: #f8fafc !important; border-color: #e2e8f0 !important; }
        .lessons-box h4 { color: #0f172a !important; }
        .theme-marker { background-color: #1e293b !important; }
      `,
      emerald: `
        .memory-card-item h4 { color: #065f46 !important; }
        .lessons-box { background: #ecfdf5 !important; border-color: #d1fae5 !important; }
        .lessons-box h4 { color: #064e3b !important; }
        .theme-marker { background-color: #059669 !important; }
      `,
      rose: `
        .memory-card-item h4 { color: #9f1239 !important; }
        .lessons-box { background: #fff1f2 !important; border-color: #ffe4e6 !important; }
        .lessons-box h4 { color: #881337 !important; }
        .theme-marker { background-color: #e11d48 !important; }
      `
    }[documentTheme];

    printStyles.innerHTML = `
      @page {
        size: ${pageSize.toLowerCase()} ${orientation};
        margin: 0 !important;
      }
      @media print {
        html, body {
          visibility: hidden !important;
          background: white !important;
          color: black !important;
          margin: 0 !important;
          padding: 0 !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
        }

        #root, #zakir-app-root, 
        .print-modal-overlay, 
        .print-modal-overlay > div, 
        .print-content-grid, 
        .print-preview-canvas {
          display: block !important;
          position: static !important;
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          backdrop-filter: none !important;
          transform: none !important;
        }

        .print-page-wrapper {
          display: block !important;
          position: static !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
        }

        #zakir-app-root > :not(.print-modal-overlay) {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          width: 0 !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
          opacity: 0 !important;
        }
        
        header:not(.print-only-header), nav, aside, footer:not(.print-only-footer), 
        .sidebar, .navbar, .nav-bar, .app-header, .top-bar, .sidebar-wrapper, .navigation,
        [class*="sidebar"], [class*="navbar"], [class*="nav-bar"], [class*="navigation"],
        [class*="menu"], [class*="control-panel"],
        .no-print, .no-print *,
        button, select, input, textarea, a,
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

        #print-scratchpad-measurer,
        .printing-active #print-scratchpad-measurer {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          width: 0 !important;
          opacity: 0 !important;
          overflow: hidden !important;
        }

        .printing-active .print-page,
        .printing-active .print-page * {
          visibility: visible !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .printing-active .print-page {
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          position: relative !important;
          width: ${getPagePhysicalSize().width} !important;
          min-height: ${getPagePhysicalSize().height} !important;
          height: auto !important;
          padding: ${getPageMarginCss()} !important;
          margin: 0 auto !important;
          page-break-after: always !important;
          break-after: page !important;
          background: white !important;
          color: #0f172a !important;
          box-sizing: border-box !important;
          overflow: visible !important;
        }

        /* Enforce robust light-theme style overrides in print regardless of dark-mode state */
        .printing-active .print-page :not(.theme-marker):not(.lessons-box):not(.lessons-box *):not(.badge-print):not(.badge-print *) {
          color: #0f172a !important;
          background-color: transparent !important;
        }

        .printing-active .print-page[dir="rtl"],
        .printing-active .print-page[dir="rtl"] * {
          text-align: right !important;
        }

        .printing-active .print-page[dir="ltr"],
        .printing-active .print-page[dir="ltr"] * {
          text-align: left !important;
        }

        .printing-active .print-page .text-center,
        .printing-active .print-page .text-center * {
          text-align: center !important;
        }

        .printing-active .print-page:last-child {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }

        .printing-active .print-page img {
          display: inline-block !important;
          visibility: visible !important;
          opacity: 1 !important;
          object-fit: contain !important;
          background-color: transparent !important;
        }

        table {
          width: 100% !important;
          border-collapse: collapse !important;
        }

        thead {
          display: table-header-group !important;
        }

        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        tbody {
          page-break-inside: auto !important;
          break-inside: auto !important;
        }

        .memory-card-item {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .page-break-inside-avoid,
        .lessons-box,
        .signature-block {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        ${themeCss}
      }
    `;

    // 3. Force focus onto current window (vital inside iframes/embeds)
    window.focus();

    // 4. Call window.print() in next tick to allow style recalcs and layout reflow
    const timer = setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error("Native print trigger failed:", err);
      }
    }, 150);

    // 5. Setup fallback timeout for cleanup in case 'afterprint' event isn't supported
    const fallbackTimer = setTimeout(() => {
      document.body.classList.remove("printing-active");
      setIsPrinting(false);
      const existingStyles = document.getElementById("dynamic-print-overrides");
      if (existingStyles && existingStyles.parentNode) {
        existingStyles.parentNode.removeChild(existingStyles);
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearTimeout(fallbackTimer);
    };
  }, [orientation, documentTheme, pageSize, pageMargins, lineSpacing, customFontScale]);

  // Listen to standard browser afterprint event to clean up classes and styles immediately
  React.useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove("printing-active");
      setIsPrinting(false);
      const existingStyles = document.getElementById("dynamic-print-overrides");
      if (existingStyles && existingStyles.parentNode) {
        existingStyles.parentNode.removeChild(existingStyles);
      }
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  // Handle external applet custom print request events
  React.useEffect(() => {
    const handlePrintEvent = () => {
      executeNativePrint();
    };
    window.addEventListener("applet-print-request", handlePrintEvent);
    return () => {
      window.removeEventListener("applet-print-request", handlePrintEvent);
    };
  }, [executeNativePrint]);

  const handlePrint = () => {
    executeNativePrint();
  };

  // Labels based on language
  const t = {
    title: lang === "ar" ? "معاينة وتنسيق الطباعة" : (lang === "fr" ? "Aperçu avant impression" : "Print Preview & Formatting"),
    documentThemeLabel: lang === "ar" ? "سمة وتنسيق التقرير" : "Print Report Theme Selection",
    incSummaryTable: lang === "ar" ? "تضمين جدول ملخص وجدول المحتويات" : "Include Executive Summary Index",
    subtitle: lang === "ar" 
      ? "تخصيص الهيكل، الملاحظات، والكثافة قبل إصدار وثيقة التقرير المطبوعة." 
      : (lang === "fr" 
        ? "Personnalisez la mise en page, la densité et les sections avant l'impression." 
        : "Customize layout, sections, and density before issuing printed reports."),
    printBtn: lang === "ar" ? "بدء الطباعة الآن" : (lang === "fr" ? "Imprimer maintenant" : "Print Document Now"),
    closeBtn: lang === "ar" ? "إغلاق" : (lang === "fr" ? "Fermer" : "Close"),
    selectMemories: lang === "ar" ? "اختيار الذكريات المطبوعة" : (lang === "fr" ? "Sélectionner les souvenirs" : "Select Memories to Print"),
    selectAll: lang === "ar" ? "تحديد الكل" : (lang === "fr" ? "Tout sélectionner" : "Select All"),
    layoutSettings: lang === "ar" ? "تنسيق الصفحة والكثافة" : (lang === "fr" ? "Mise en page & Densité" : "Layout & Density"),
    densityLabel: lang === "ar" ? "الكثافة والتباعد" : (lang === "fr" ? "Densité" : "Spacing Density"),
    compact: lang === "ar" ? "مدمج (مكثف)" : (lang === "fr" ? "Compact" : "Compact"),
    standard: lang === "ar" ? "قياسي" : (lang === "fr" ? "Standard" : "Standard"),
    spacious: lang === "ar" ? "واسع" : (lang === "fr" ? "Spacieux" : "Spacious"),
    fontSizeLabel: lang === "ar" ? "حجم الخط" : (lang === "fr" ? "Taille de police" : "Font Size"),
    smallFont: lang === "ar" ? "صغير (10pt)" : (lang === "fr" ? "Petit (10pt)" : "Small (10pt)"),
    mediumFont: lang === "ar" ? "متوسط (12pt)" : (lang === "fr" ? "Moyen (12pt)" : "Medium (12pt)"),
    largeFont: lang === "ar" ? "كبير (14pt)" : (lang === "fr" ? "Grand (14pt)" : "Large (14pt)"),
    orientationLabel: lang === "ar" ? "اتجاه الورقة" : (lang === "fr" ? "Orientation" : "Orientation"),
    portrait: lang === "ar" ? "عمودي (Portrait)" : (lang === "fr" ? "Portrait" : "Portrait"),
    landscape: lang === "ar" ? "أفقي (Landscape)" : (lang === "fr" ? "Paysage" : "Landscape"),
    columnsLabel: lang === "ar" ? "عدد الأعمدة" : (lang === "fr" ? "Colonnes" : "Columns"),
    singleCol: lang === "ar" ? "عمود واحد" : (lang === "fr" ? "Une colonne" : "Single Column"),
    doubleCol: lang === "ar" ? "عمودان" : (lang === "fr" ? "Deux colonnes" : "Two Columns"),
    sectionsToggle: lang === "ar" ? "الأقسام المضمنة" : (lang === "fr" ? "Sections incluses" : "Included Sections"),
    incHeader: lang === "ar" ? "ترويسة المؤسسة الرسمية" : (lang === "fr" ? "En-tête officiel" : "Official Branding Header"),
    incFooter: lang === "ar" ? "تذييل إشعار السرية" : (lang === "fr" ? "Pied de page de confidentialité" : "Confidentiality Footer"),
    incCausal: lang === "ar" ? "العوامل المسببة والخلفية" : (lang === "fr" ? "Facteurs causaux" : "Causal Factors"),
    incOutcomes: lang === "ar" ? "النتائج والتداعيات" : (lang === "fr" ? "Résultats" : "Outcomes"),
    incLessons: lang === "ar" ? "الدروس المستفادة والتوصيات" : (lang === "fr" ? "Leçons & Recommandations" : "Lessons & Recommendations"),
    incAuthor: lang === "ar" ? "بيانات المالك والتاريخ" : (lang === "fr" ? "Auteur & Date" : "Author & Timestamp"),
    incTags: lang === "ar" ? "الوسوم والتصنيفات" : (lang === "fr" ? "Tags" : "Tags"),
    incSignature: lang === "ar" ? "كتلة التوقيع والاعتماد التنفيذي" : (lang === "fr" ? "Bloc de signature officielle" : "Executive Approval Signature Block"),
    watermarkLabel: lang === "ar" ? "علامة المائية للسرية" : (lang === "fr" ? "Filigrane" : "Watermark"),
    watermarkNone: lang === "ar" ? "بدون علامة" : (lang === "fr" ? "Aucun" : "None"),
    watermarkConfidential: lang === "ar" ? "سري للغاية (STRICTLY CONFIDENTIAL)" : (lang === "fr" ? "CONFIDENTIEL" : "STRICTLY CONFIDENTIAL"),
    watermarkInternal: lang === "ar" ? "للاستخدام الداخلي فقط" : (lang === "fr" ? "USAGE INTERNE" : "INTERNAL USE ONLY"),
    watermarkOfficial: lang === "ar" ? "سجل رسمي معتمد" : (lang === "fr" ? "REGISTRE OFFICIEL" : "OFFICIAL RECORD"),
    selectedCount: lang === "ar" ? `تم اختيار ${selectedMemories.length} من أصل ${memories.length} ذكريات` : (lang === "fr" ? `${selectedMemories.length} sur ${memories.length} sélectionnés` : `${selectedMemories.length} of ${memories.length} selected`),
    watermarkText: {
      none: "",
      confidential: "STRICTLY CONFIDENTIAL",
      internal: "INTERNAL USE ONLY",
      official: "OFFICIAL RECORD"
    }[watermark],
    signatureNotice: lang === "ar" ? "اعتماد الإدارة العليا ومسؤول الامتثال" : "Executive & Compliance Approval Signature",
    sigPreparedBy: lang === "ar" ? "إعداد / المحلل المسؤول:" : "Prepared By / Analyst:",
    sigReviewedBy: lang === "ar" ? "مراجعة الامتثال:" : "Compliance Officer:",
    sigApprovedBy: lang === "ar" ? "اعتماد الرئيس التنفيذي:" : "CEO Approval:",
    dateLabel: lang === "ar" ? "التاريخ:" : "Date:",
  };

  // Font class dynamic calculation
  const fontScaleClass = {
    small: "text-[10pt] leading-tight",
    medium: "text-[11pt] leading-normal",
    large: "text-[12pt] leading-relaxed"
  }[fontSize];

  // Density padding dynamic calculation
  const densityPaddingClass = {
    compact: "p-4 space-y-2 mb-4",
    standard: "p-6 space-y-4 mb-6",
    spacious: "p-8 space-y-6 mb-8"
  }[density];

  // Dynamic theme styling classes mapping
  const themeColors = {
    blue: {
      primary: "text-blue-800 border-blue-200",
      accentText: "text-blue-800",
      badge: "bg-blue-50 text-blue-900 border-blue-200",
      lessonsBg: "bg-blue-50/50 border border-blue-100",
      lessonsHeader: "text-blue-900 border-blue-200",
      headerLine: "border-blue-600",
      marker: "bg-blue-600"
    },
    slate: {
      primary: "text-slate-800 border-slate-200",
      accentText: "text-slate-800",
      badge: "bg-slate-100 text-slate-900 border-slate-200",
      lessonsBg: "bg-slate-50 border border-slate-100",
      lessonsHeader: "text-slate-900 border-slate-200",
      headerLine: "border-slate-800",
      marker: "bg-slate-800"
    },
    emerald: {
      primary: "text-emerald-800 border-emerald-200",
      accentText: "text-emerald-800",
      badge: "bg-emerald-50 text-emerald-900 border-emerald-200",
      lessonsBg: "bg-emerald-50/50 border border-emerald-100",
      lessonsHeader: "text-emerald-900 border-emerald-200",
      headerLine: "border-emerald-600",
      marker: "bg-emerald-600"
    },
    rose: {
      primary: "text-rose-800 border-rose-200",
      accentText: "text-rose-800",
      badge: "bg-rose-50 text-rose-900 border-rose-200",
      lessonsBg: "bg-rose-50/50 border border-rose-100",
      lessonsHeader: "text-rose-900 border-rose-200",
      headerLine: "border-rose-600",
      marker: "bg-rose-600"
    }
  }[documentTheme];

  const defaultLogoEmblem = (
    <div className="flex items-center justify-center p-1 bg-slate-50 border border-slate-200 rounded-lg shrink-0">
      <svg className={`w-9 h-9 ${themeColors.accentText}`} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="15" width="70" height="70" rx="16" stroke="currentColor" strokeWidth="6" />
        <circle cx="50" cy="50" r="18" stroke="currentColor" strokeWidth="4" />
        <path d="M50 32 L50 68" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <path d="M32 50 L68 50" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </div>
  );

  const getPageDimensions = () => {
    const dims = {
      A4: { portrait: { width: 794, height: 1123 }, landscape: { width: 1123, height: 794 } },
      A3: { portrait: { width: 1123, height: 1587 }, landscape: { width: 1587, height: 1123 } },
      A5: { portrait: { width: 559, height: 794 }, landscape: { width: 794, height: 559 } },
      Letter: { portrait: { width: 816, height: 1056 }, landscape: { width: 1056, height: 816 } },
      Legal: { portrait: { width: 816, height: 1344 }, landscape: { width: 1344, height: 816 } }
    };
    return dims[pageSize]?.[orientation] || dims.A4.portrait;
  };

  const getPagePhysicalSize = () => {
    const sizes = {
      A4: { portrait: { width: "210mm", height: "297mm" }, landscape: { width: "297mm", height: "210mm" } },
      A3: { portrait: { width: "297mm", height: "420mm" }, landscape: { width: "420mm", height: "297mm" } },
      A5: { portrait: { width: "148mm", height: "210mm" }, landscape: { width: "210mm", height: "148mm" } },
      Letter: { portrait: { width: "8.5in", height: "11in" }, landscape: { width: "11in", height: "8.5in" } },
      Legal: { portrait: { width: "8.5in", height: "14in" }, landscape: { width: "14in", height: "8.5in" } }
    };
    return sizes[pageSize]?.[orientation] || sizes.A4.portrait;
  };

  const getPageMarginCss = () => {
    const marginMm = pageMargins / 3.7795;
    return `${marginMm}mm`;
  };

  const { width: pageWidth, height: pageHeight } = getPageDimensions();

  // Construct the ordered list of document sections (blocks)
  const documentBlocks = useMemo(() => {
    const blocks: Array<{ 
      id: string; 
      type: "summary" | "signature" | "memory_card_sub"; 
      mId?: string; 
      subType?: "main" | "causal" | "outcomes" | "lessons" | "footer";
    }> = [];

    // Summary/TOC block
    if (includeSummaryTable && selectedMemories.length > 0) {
      blocks.push({ id: "summary-block", type: "summary" });
    }

    // Individual memory card blocks split into fine-grained sub-blocks
    selectedMemories.forEach((m) => {
      // Main sub-block (title, Event Narrative, Decision Taken)
      blocks.push({ id: `memory-${m.id}-main`, type: "memory_card_sub", mId: m.id, subType: "main" });
      
      // Causal section sub-block
      if (includeCausal && m.causalFactors) {
        blocks.push({ id: `memory-${m.id}-causal`, type: "memory_card_sub", mId: m.id, subType: "causal" });
      }
      
      // Outcomes section sub-block
      if (includeOutcomes && m.outcomes) {
        blocks.push({ id: `memory-${m.id}-outcomes`, type: "memory_card_sub", mId: m.id, subType: "outcomes" });
      }
      
      // Lessons learned section sub-block
      if (includeLessons && m.lessonsLearned) {
        blocks.push({ id: `memory-${m.id}-lessons`, type: "memory_card_sub", mId: m.id, subType: "lessons" });
      }
      
      // Author and Tags section sub-block
      if (includeAuthor || (includeTags && m.tags && m.tags.length > 0)) {
        blocks.push({ id: `memory-${m.id}-footer`, type: "memory_card_sub", mId: m.id, subType: "footer" });
      }
    });

    // Signature block
    if (includeSignatureBlock) {
      blocks.push({ id: "signature-block", type: "signature" });
    }

    return blocks;
  }, [
    selectedMemories, 
    includeSummaryTable, 
    includeSignatureBlock, 
    includeCausal, 
    includeOutcomes, 
    includeLessons, 
    includeAuthor, 
    includeTags
  ]);

  const [blockHeights, setBlockHeights] = useState<Record<string, number>>({});

  const getInitialHeaderHeight = () => {
    if (!includeHeader) return 0;
    return 65; // Minimal concise header initial estimate
  };

  const [headerHeight, setHeaderHeight] = useState<number>(getInitialHeaderHeight());
  const continuationHeaderHeight = includeHeader ? 28 : 0;

  // Keep headerHeight state in sync when basic visibility toggles to avoid layout jumps
  React.useEffect(() => {
    setHeaderHeight(getInitialHeaderHeight());
  }, [includeHeader]);

  // Measure heights of all blocks in an offscreen scratchpad
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const scratchpad = document.getElementById("print-scratchpad-measurer");
      if (!scratchpad) return;

      // 1. Measure the dynamic header height from scratchpad if enabled
      if (includeHeader) {
        const headerEl = scratchpad.querySelector(`[data-measurer-id="page-header"]`);
        if (headerEl) {
          const firstChild = headerEl.firstElementChild;
          let marginHeight = 0;
          if (firstChild) {
            const style = window.getComputedStyle(firstChild);
            const marginTop = parseFloat(style.marginTop) || 0;
            const marginBottom = parseFloat(style.marginBottom) || 0;
            marginHeight = marginTop + marginBottom;
          }
          const measuredHeaderHeight = Math.ceil(headerEl.getBoundingClientRect().height + marginHeight);
          if (measuredHeaderHeight > 0) {
            setHeaderHeight(prev => {
              if (Math.abs(prev - measuredHeaderHeight) >= 2) {
                return measuredHeaderHeight;
              }
              return prev;
            });
          }
        }
      } else {
        setHeaderHeight(0);
      }

      // 2. Measure the heights of all document content blocks including margins
      const newHeights: Record<string, number> = {};
      documentBlocks.forEach((block) => {
        const el = scratchpad.querySelector(`[data-measurer-id="${block.id}"]`);
        if (el) {
          const firstChild = el.firstElementChild;
          let marginHeight = 0;
          if (firstChild) {
            const style = window.getComputedStyle(firstChild);
            const marginTop = parseFloat(style.marginTop) || 0;
            const marginBottom = parseFloat(style.marginBottom) || 0;
            marginHeight = marginTop + marginBottom;
          }
          newHeights[block.id] = Math.ceil(el.getBoundingClientRect().height + marginHeight);
        }
      });

      setBlockHeights(prev => {
        let changed = false;
        const prevKeys = Object.keys(prev);
        const newKeys = Object.keys(newHeights);
        if (prevKeys.length !== newKeys.length) {
          changed = true;
        } else {
          for (const key of newKeys) {
            if (Math.abs((prev[key] || 0) - newHeights[key]) >= 2) {
              changed = true;
              break;
            }
          }
        }
        return changed ? newHeights : prev;
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [
    documentBlocks,
    pageSize,
    orientation,
    fontSize,
    density,
    lineSpacing,
    pageMargins,
    customFontScale,
    editableMemories,
    includeCausal,
    includeOutcomes,
    includeLessons,
    includeAuthor,
    includeTags,
    includeSignatureBlock,
    includeSummaryTable,
    includeHeader,
    includeFooter,
    departmentName,
    documentRef,
    companyLogoImg,
    refreshTrigger
  ]);

  const documentPages = useMemo(() => {
    const totalHeight = pageHeight;
    const footerHeight = includeFooter ? 36 : 0;
    
    // Page 1 usable height vs Page 2+ usable height (continuation header is very small)
    const usableHeightPage1 = Math.max(300, totalHeight - (pageMargins * 2) - headerHeight - footerHeight - 12);
    const usableHeightPage2 = Math.max(300, totalHeight - (pageMargins * 2) - continuationHeaderHeight - footerHeight - 12);

    const getFallbackHeight = (block: typeof documentBlocks[0]) => {
      if (block.type === "summary") {
        const rowHeight = density === "compact" ? 28 : density === "spacious" ? 44 : 36;
        return 120 + (selectedMemories.length * rowHeight) + 40;
      }
      if (block.type === "signature") {
        return density === "compact" ? 95 : density === "spacious" ? 140 : 115;
      }
      
      const m = editableMemories.find(mem => mem.id === block.mId) || memories.find(mem => mem.id === block.mId);
      if (!m) return 100;

      if (block.type === "memory_card_sub") {
        if (block.subType === "main") {
          const textLen = (m.title?.length || 0) + (m.description?.length || 0) + (m.decision?.length || 0);
          return 100 + Math.ceil(textLen * 0.4);
        }
        if (block.subType === "causal" && m.causalFactors) {
          return 45 + Math.ceil(m.causalFactors.length * 0.4);
        }
        if (block.subType === "outcomes" && m.outcomes) {
          return 45 + Math.ceil(m.outcomes.length * 0.4);
        }
        if (block.subType === "lessons" && m.lessonsLearned) {
          return 60 + Math.ceil(m.lessonsLearned.length * 0.4);
        }
        if (block.subType === "footer") {
          return 35;
        }
      }
      return 120;
    };

    const pages: Array<typeof documentBlocks> = [];
    let currentPage: typeof documentBlocks = [];
    let currentHeight = 0;

    // Helper to get measured or fallback height of a single block
    const getBlockHeight = (block: typeof documentBlocks[0]) => {
      const baseHeight = blockHeights[block.id] || getFallbackHeight(block);
      return columns === "2" ? baseHeight / 1.8 : baseHeight;
    };

    const getUsableHeightForCurrentPage = () => {
      return pages.length === 0 ? usableHeightPage1 : usableHeightPage2;
    };

    let i = 0;
    while (i < documentBlocks.length) {
      const block = documentBlocks[i];

      if (block.type === "memory_card_sub") {
        const currentMId = block.mId;
        // Collect all consecutive sub-blocks of this memory card
        const cardSubBlocks: typeof documentBlocks = [];
        let j = i;
        while (j < documentBlocks.length && documentBlocks[j].type === "memory_card_sub" && documentBlocks[j].mId === currentMId) {
          cardSubBlocks.push(documentBlocks[j]);
          j++;
        }

        // Calculate total height of this memory card (sum of its sub-blocks + card container padding/margin buffer)
        const cardBuffer = density === "compact" ? 16 : density === "spacious" ? 32 : 24;
        const totalCardHeight = cardSubBlocks.reduce((sum, b) => sum + getBlockHeight(b), 0) + cardBuffer;

        const currentUsableHeight = getUsableHeightForCurrentPage();
        const forceBreak = pageBreakBetween && currentPage.length > 0;

        if (totalCardHeight <= usableHeightPage2) {
          // Case 1: The entire memory card fits on a page!
          // Keep the whole card intact as a single block where possible.
          if ((currentHeight + totalCardHeight > currentUsableHeight || forceBreak) && currentPage.length > 0) {
            // Push current page and start a new one with all card sub-blocks
            pages.push(currentPage);
            currentPage = [...cardSubBlocks];
            currentHeight = totalCardHeight;
          } else {
            // Add all card sub-blocks to the current page
            currentPage.push(...cardSubBlocks);
            currentHeight += totalCardHeight;
          }
          i = j; // Advance past all sub-blocks of this card
        } else {
          // Case 2: The memory card is exceptionally long and exceeds standard page height.
          // Allow sub-blocks of this card to flow gracefully across pages.
          cardSubBlocks.forEach((subBlock, subIdx) => {
            const h = getBlockHeight(subBlock);
            const pageLimit = getUsableHeightForCurrentPage();
            const shouldBreak = pageBreakBetween && subBlock.subType === "main" && subIdx === 0 && currentPage.length > 0;

            if ((currentHeight + h > pageLimit || shouldBreak) && currentPage.length > 0) {
              pages.push(currentPage);
              currentPage = [subBlock];
              currentHeight = h;
            } else {
              currentPage.push(subBlock);
              currentHeight += h;
            }
          });
          i = j; // Advance past all sub-blocks of this card
        }
      } else {
        // Case 3: Summary block or Signature block
        const h = getBlockHeight(block);
        const currentUsableHeight = getUsableHeightForCurrentPage();

        if ((currentHeight + h > currentUsableHeight) && currentPage.length > 0) {
          pages.push(currentPage);
          currentPage = [block];
          currentHeight = h;
        } else {
          currentPage.push(block);
          currentHeight += h;
        }
        i++;
      }
    }

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages.length > 0 ? pages : [documentBlocks];
  }, [
    documentBlocks, 
    blockHeights, 
    pageHeight, 
    pageMargins, 
    headerHeight,
    continuationHeaderHeight,
    includeFooter, 
    pageBreakBetween,
    density,
    customFontScale,
    selectedMemories,
    editableMemories,
    memories,
    includeCausal,
    includeOutcomes,
    includeLessons,
    includeTags,
    includeAuthor
  ]);  function EditableText({
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
        <div className={`w-full bg-transparent text-slate-900 leading-relaxed font-normal whitespace-pre-wrap break-words p-0.5 ${className}`}>
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
        className={`w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/40 rounded p-0.5 hover:bg-slate-100/60 focus:bg-blue-50/20 text-slate-900 transition-all whitespace-pre-wrap break-words ${className}`}
      >
        {value}
      </div>
    );
  }

  const renderPageHeader = (pageIdx: number, totalPages: number) => {
    if (!includeHeader) return null;

    const isRtl = lang === "ar";
    const dateVal = includeDateInWatermark && displayDate ? displayDate : new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US");

    // Page 2+: Minimal, sleek continuation header (~24px)
    if (pageIdx > 0) {
      return (
        <div 
          className="print-only-header w-full border-b border-slate-300 pb-1.5 mb-3 flex items-center justify-between text-[8pt] text-slate-600 font-sans select-none" 
          dir={isRtl ? "rtl" : "ltr"}
        >
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <span className="font-black text-blue-600 tracking-wider">ZAKIR</span>
            <span className="text-slate-400">•</span>
            <span className="truncate max-w-[320px]">
              {lang === "ar" ? "تقرير الذاكرة المؤسسية وسجل القرارات" : "Institutional Memory & Decision Report"}
            </span>
          </div>
          <div className="font-mono font-bold text-slate-700">
            {lang === "ar" ? `صفحة ${pageIdx + 1} من ${totalPages}` : `Page ${pageIdx + 1} of ${totalPages}`}
          </div>
        </div>
      );
    }

    // Page 1: Concise, professional institutional document header
    return (
      <div 
        className="print-only-header w-full border-b border-slate-300 pb-2 mb-4 select-none" 
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Top Bar: Brand / Organization on one side, Document Title on other side */}
        <div className="flex items-center justify-between gap-4 pb-2">
          <div className="flex items-center gap-3">
            {companyLogoImg ? (
              <img 
                src={companyLogoImg} 
                alt="Company Logo" 
                className="h-9 max-h-9 object-contain rounded" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                  Z
                </div>
                <div className="leading-tight">
                  <span className="font-black text-sm tracking-wider text-slate-900 block font-serif">ZAKIR</span>
                  <span className="text-[7.5pt] text-slate-500 font-medium block">
                    {lang === "ar" ? "الذاكرة المؤسسية السببية" : "Organizational Causal Memory"}
                  </span>
                </div>
              </div>
            )}
            {companyLogoImg && (
              <div className="leading-tight">
                <span className="font-bold text-xs text-slate-900 block">{companyName}</span>
                {departmentName && (
                  <span className="text-[7.5pt] text-slate-500 block">{departmentName}</span>
                )}
              </div>
            )}
          </div>

          <div className="text-end">
            <h1 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
              {lang === "ar" ? "تقرير الذاكرة المؤسسية وسجل القرارات" : "Institutional Memory & Decision Intelligence Report"}
            </h1>
            <p className="text-[7.5pt] text-slate-500 font-medium mt-0.5">
              {companyName} {departmentName ? `• ${departmentName}` : ""}
            </p>
          </div>
        </div>

        {/* Metadata Bottom Row: Reference ID, Date, Issuer */}
        <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[7.5pt] text-slate-600 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="font-bold uppercase tracking-wider text-slate-500">
              {lang === "ar" ? "رقم المرجع:" : "DOC ID:"}
            </span>
            <span className="font-bold text-slate-800">{documentRef}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="font-bold uppercase tracking-wider text-slate-500">
                {lang === "ar" ? "التاريخ:" : "DATE:"}
              </span>
              <span className="font-semibold text-slate-800">{dateVal}</span>
            </div>
            {userName && (
              <div className="flex items-center gap-1">
                <span className="font-bold uppercase tracking-wider text-slate-500">
                  {lang === "ar" ? "المسؤول:" : "LOGGED BY:"}
                </span>
                <span className="font-semibold text-slate-800 font-sans">{userName}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderBlock = (block: typeof documentBlocks[0], isMeasuring = false) => {
    // If it's the summary table block
    if (block.type === "summary") {
      return (
        <div className={`mb-8 border-2 border-slate-300 rounded-xl p-5 bg-slate-50 relative z-10 page-break-inside-avoid shadow-sm text-right rtl:text-right ${!isMeasuring ? "group hover:border-blue-400 hover:shadow-md transition-all duration-200" : ""}`} dir={lang === "ar" ? "rtl" : "ltr"}>
          {!isMeasuring && (
            <div className="no-print absolute top-3 ltr:right-3 rtl:left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                type="button"
                onClick={() => setIncludeSummaryTable(false)}
                className="p-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                title={lang === "ar" ? "إخفاء جدول الملخص" : "Exclude summary table"}
              >
                <X className="w-3.5 h-3.5" />
                <span>{lang === "ar" ? "إخفاء" : "Exclude"}</span>
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 mb-3 border-b-2 border-slate-300 pb-2">
            <span className={`w-3 h-3 rounded-sm ${themeColors.marker}`}></span>
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-950">
              {lang === "ar" ? "الملخص التنفيذي وجدول المحتويات" : "Executive Summary & Document Index"}
            </h3>
          </div>
          
          {/* Summary Metrics Row */}
          <div className="grid grid-cols-3 gap-4 mb-4 text-center">
            <div className="bg-white border-2 border-slate-300 rounded-lg p-3 shadow-sm">
              <span className="block text-[8.5pt] text-slate-700 font-extrabold uppercase tracking-wider">{lang === "ar" ? "إجمالي السجلات" : "Total Log Entries"}</span>
              <span className="text-2xl font-black text-slate-950">{selectedMemories.length}</span>
            </div>
            <div className="bg-white border-2 border-slate-300 rounded-lg p-3 shadow-sm">
              <span className="block text-[8.5pt] text-slate-700 font-extrabold uppercase tracking-wider">{lang === "ar" ? "مخاطر حرجة/عالية" : "Critical/High Risks"}</span>
              <span className="text-2xl font-black text-rose-700 font-mono">
                {selectedMemories.filter(m => m.riskLevel === "Critical" || m.riskLevel === "High").length}
              </span>
            </div>
            <div className="bg-white border-2 border-slate-300 rounded-lg p-3 shadow-sm">
              <span className="block text-[8.5pt] text-slate-700 font-extrabold uppercase tracking-wider">{lang === "ar" ? "فئات التقرير" : "Unique Categories"}</span>
              <span className="text-2xl font-black text-slate-950">{new Set(selectedMemories.map(m => m.category)).size}</span>
            </div>
          </div>

          {/* Document Index Table */}
          <div className="overflow-x-auto border-2 border-slate-300 rounded-lg">
            <table className="w-full text-left text-[9pt] border-collapse" dir={lang === "ar" ? "rtl" : "ltr"}>
              <thead>
                <tr className="border-b-2 border-slate-400 text-slate-950 font-black bg-slate-200">
                  <th className="py-2 px-2.5 text-center w-10 text-slate-950">#</th>
                  <th className="py-2 px-2.5 text-right rtl:text-right text-slate-950">{lang === "ar" ? "العنوان والوصف المختصر" : "Record Title"}</th>
                  <th className="py-2 px-2.5 text-slate-950">{lang === "ar" ? "القطاع / الفئة" : "Category"}</th>
                  <th className="py-2 px-2.5 text-center w-28 text-slate-950">{lang === "ar" ? "مستوى الخطر" : "Risk Level"}</th>
                  <th className="py-2 px-2.5 text-center w-28 text-slate-950">{lang === "ar" ? "التاريخ" : "Date"}</th>
                </tr>
              </thead>
              <tbody>
                {selectedMemories.map((m, idx) => (
                  <tr key={m.id} className="border-b border-slate-300 hover:bg-slate-100/80 even:bg-slate-50/80">
                    <td className="py-2 px-2.5 font-black text-center text-slate-700">{idx + 1}</td>
                    <td className="py-2 px-2.5 font-black text-slate-950 text-right rtl:text-right">
                      {m.title}
                    </td>
                    <td className="py-2 px-2.5 text-slate-800 font-bold">{m.category}</td>
                    <td className="py-2 px-2.5 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[8pt] font-black uppercase ${
                        m.riskLevel === "Critical" 
                          ? "bg-rose-100 text-rose-950 border border-rose-300" 
                          : m.riskLevel === "High"
                          ? "bg-blue-100 text-blue-950 border border-blue-300"
                          : "bg-slate-200 text-slate-900 border border-slate-300"
                      }`}>
                        {m.riskLevel}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-center text-slate-700 font-mono font-bold text-[8.5pt]">
                      {new Date(m.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "2-digit", day: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (block.type === "signature") {
      return (
        <div className={`mt-6 pt-5 border-t border-slate-300 relative z-10 page-break-inside-avoid signature-block text-right rtl:text-right ${!isMeasuring ? "group hover:border-blue-300 hover:shadow-sm p-4 rounded-xl transition-all duration-200" : ""}`} dir={lang === "ar" ? "rtl" : "ltr"}>
          {!isMeasuring && (
            <div className="no-print absolute top-3 ltr:right-3 rtl:left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                type="button"
                onClick={() => setIncludeSignatureBlock(false)}
                className="p-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                title={lang === "ar" ? "إخفاء التوقيع" : "Exclude signature"}
              >
                <X className="w-3.5 h-3.5" />
                <span>{lang === "ar" ? "إخفاء" : "Exclude"}</span>
              </button>
            </div>
          )}
          
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-1.5 h-1.5 rounded-full ${themeColors.marker}`}></div>
            <span className="text-[8.5pt] font-black uppercase text-slate-800 tracking-wider">
              {lang === "ar" ? "اعتماد وتوقيع التقرير الرسمي" : "OFFICIAL APPROVAL & SIGNATURE PANEL"}
            </span>
          </div>

          <div className="flex flex-row flex-nowrap items-stretch justify-between gap-8 w-full text-[9pt]">
            {/* Column 1: Executive Approval Info */}
            <div className="flex-1 flex flex-col justify-between min-h-[110px] text-start">
              <span className="text-[7.5pt] font-black uppercase text-slate-500 tracking-wider">
                {lang === "ar" ? "الاعتماد التنفيذي" : "EXECUTIVE APPROVAL"}
              </span>
              <div className="pt-2 border-t border-slate-200 w-full mt-auto">
                <div className="text-[9.5pt] font-black text-slate-950 leading-tight">
                  {companyName}
                </div>
                {departmentName && (
                  <div className="text-[8pt] text-slate-600 font-bold uppercase mt-0.5 leading-none">
                    {departmentName}
                  </div>
                )}
                <div className="text-[8pt] text-slate-600 font-semibold mt-1">
                  <span>{lang === "ar" ? "الممثل المعتمد: " : "Representative: "}</span>
                  <span className="text-slate-900 font-extrabold">{userName}</span>
                </div>
              </div>
            </div>

            {/* Column 2: Authorized Signature / Stamp */}
            <div className="flex-1 flex flex-col justify-between min-h-[110px] text-start">
              <span className="text-[7.5pt] font-black uppercase text-slate-500 tracking-wider">
                {lang === "ar" ? "التوقيع والختم الرسمي" : "AUTHORIZED SIGNATURE & STAMP"}
              </span>
              <div className="pt-2 border-t border-slate-200 w-full mt-auto flex flex-col justify-end min-h-[50px]">
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
                {/* Underline for signature */}
                <div className="border-b border-slate-300 w-full"></div>
              </div>
            </div>

            {/* Column 3: Official Approval Date */}
            <div className="flex-1 flex flex-col justify-between min-h-[110px] text-start">
              <span className="text-[7.5pt] font-black uppercase text-slate-500 tracking-wider">
                {lang === "ar" ? "تاريخ الاعتماد" : "OFFICIAL APPROVAL DATE"}
              </span>
              <div className="pt-2 border-t border-slate-200 w-full mt-auto flex flex-col justify-end min-h-[50px]">
                <div className="flex justify-center items-end pb-1 h-10 w-full">
                  <span className="text-[9.5pt] font-black text-slate-950 font-mono leading-none">
                    {includeDateInWatermark && displayDate ? displayDate : new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
                  </span>
                </div>
                {/* Underline to match signature */}
                <div className="border-b border-slate-300 w-full"></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (block.type === "memory_card_sub") {
      const m = editableMemories.find(mem => mem.id === block.mId) || memories.find(mem => mem.id === block.mId);
      if (!m) return null;

      return (
        <div 
          className={`memory-card-item bg-white border-2 border-slate-300 rounded-xl text-slate-950 shadow-sm ${cardSpacing.cardMargin} ${cardSpacing.cardPadding} text-right rtl:text-right`}
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          {renderSubBlockContent(m, block.subType || "main", isMeasuring)}
        </div>
      );
    }

    return null;
  };

  const renderSubBlockContent = (m: Memory, subType: string, isMeasuring: boolean) => {
    switch (subType) {
      case "main":
        return (
          <>
            {/* Card Title & Badges */}
            <div className={cardSpacing.headerPadding}>
              <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className={`${cardSpacing.badgeText} uppercase badge-print ${themeColors.badge}`}>
                    {m.category}
                  </span>
                  <span className={`${cardSpacing.badgeText} uppercase badge-print ${
                    m.riskLevel === "Critical" 
                      ? "bg-rose-100 text-rose-950 border-rose-300" 
                      : m.riskLevel === "High"
                      ? "bg-blue-100 text-blue-950 border-blue-300"
                      : m.riskLevel === "Medium"
                      ? "bg-blue-100 text-blue-950 border-blue-300"
                      : "bg-slate-200 text-slate-900 border-slate-300"
                  }`}>
                    {m.riskLevel}
                  </span>
                </div>
                <span className="text-[8.5pt] text-slate-600 font-mono font-extrabold">
                  #{m.id.slice(0, 8).toUpperCase()} • {new Date(m.createdAt).toLocaleDateString()}
                </span>
              </div>

              <EditableText
                value={m.title}
                disabled={isMeasuring}
                onChange={(val) => handleUpdateMemoryField(m.id, "title", val)}
                className={cardSpacing.titleSize}
              />
            </div>

            <div className="space-y-3">
              <div>
                <h4 className={`${cardSpacing.sectionTitleSize} ${themeColors.accentText}`}>
                  {lang === "ar" ? "سرد الحدث والموقف" : "Event Narrative"}
                </h4>
                <EditableText
                  value={m.description}
                  disabled={isMeasuring}
                  onChange={(val) => handleUpdateMemoryField(m.id, "description", val)}
                  className={cardSpacing.textSize}
                />
              </div>

              <div>
                <h4 className={`${cardSpacing.sectionTitleSize} ${themeColors.accentText}`}>
                  {lang === "ar" ? "القرار المتخذ" : "Decision Taken"}
                </h4>
                <EditableText
                  value={m.decision}
                  disabled={isMeasuring}
                  onChange={(val) => handleUpdateMemoryField(m.id, "decision", val)}
                  className={cardSpacing.textSize}
                />
              </div>
            </div>
          </>
        );
      case "causal":
        return (
          <div className="group/sec relative">
            <h4 className={`${cardSpacing.sectionTitleSize} flex items-center justify-between ${themeColors.accentText}`}>
              <span>{lang === "ar" ? "العوامل المسببة والتحليل" : "Causal Factors & Root Analysis"}</span>
            </h4>
            <EditableText
              value={m.causalFactors || ""}
              disabled={isMeasuring}
              onChange={(val) => handleUpdateMemoryField(m.id, "causalFactors", val)}
              className={cardSpacing.textSize}
            />
          </div>
        );
      case "outcomes":
        return (
          <div className="group/sec relative">
            <h4 className={`${cardSpacing.sectionTitleSize} flex items-center justify-between ${themeColors.accentText}`}>
              <span>{lang === "ar" ? "النتائج والأثر المترتب" : "Outcomes & Organizational Impact"}</span>
            </h4>
            <EditableText
              value={m.outcomes || ""}
              disabled={isMeasuring}
              onChange={(val) => handleUpdateMemoryField(m.id, "outcomes", val)}
              className={cardSpacing.textSize}
            />
          </div>
        );
      case "lessons":
        return (
          <div className={`lessons-box rounded-lg border-2 relative group/sec ${cardSpacing.cardPadding === "p-3" ? "p-2.5" : cardSpacing.cardPadding === "p-6 sm:p-7" ? "p-5" : "p-3.5"} ${themeColors.lessonsBg}`}>
            <h4 className={`${cardSpacing.sectionTitleSize} flex items-center justify-between ${themeColors.lessonsHeader}`}>
              <span>{lang === "ar" ? "الدروس المستفادة والتوجيهات المستقبلية" : "Lessons Learned & Core Guidelines"}</span>
            </h4>
            <EditableText
              value={m.lessonsLearned || ""}
              disabled={isMeasuring}
              onChange={(val) => handleUpdateMemoryField(m.id, "lessonsLearned", val)}
              className={`${cardSpacing.textSize} font-bold text-slate-950`}
            />
          </div>
        );
      case "footer":
        return (
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-250 text-slate-500 text-[8pt] font-semibold mt-1">
            {includeAuthor && (
              <div className="flex items-center gap-1">
                <span>{lang === "ar" ? "المسؤول عن التوثيق: " : "Logged by: "}</span>
                <span className="text-slate-800 font-extrabold">{userName}</span>
              </div>
            )}
            {includeTags && m.tags && m.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap justify-end">
                <span>{lang === "ar" ? "الوسوم: " : "Tags: "}</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {m.tags.map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[7pt] font-bold">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const renderPageBlocks = (blocks: typeof documentBlocks, isMeasuring = false) => {
    const renderedElements: React.ReactNode[] = [];
    let i = 0;
    while (i < blocks.length) {
      const block = blocks[i];
      if (block.type === "memory_card_sub") {
        const currentMId = block.mId;
        const group: typeof documentBlocks = [];
        while (i < blocks.length && blocks[i].type === "memory_card_sub" && blocks[i].mId === currentMId) {
          group.push(blocks[i]);
          i++;
        }
        
        const m = editableMemories.find(mem => mem.id === currentMId) || memories.find(mem => mem.id === currentMId);
        if (m) {
          const isContinuation = group[0].subType !== "main";
          renderedElements.push(
            <div 
              key={`group-${m.id}-${group[0].subType}`}
              className={`memory-card-item bg-white border-2 border-slate-300 rounded-xl text-slate-950 shadow-sm ${cardSpacing.cardMargin} ${cardSpacing.cardPadding} text-right rtl:text-right group relative hover:border-blue-400 hover:shadow-md transition-all duration-200`}
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              {/* Exclude entire memory card hover button */}
              {!isMeasuring && (
                <div className="no-print absolute top-3 ltr:right-3 rtl:left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    type="button"
                    onClick={() => toggleSelectMemory(m.id)}
                    className="p-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                    title={lang === "ar" ? "إخفاء من التقرير" : "Exclude from report"}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{lang === "ar" ? "إخفاء" : "Exclude"}</span>
                  </button>
                </div>
              )}

              {isContinuation && (
                <div className="pb-1.5 mb-2 border-b border-dashed border-slate-200 flex justify-between items-center">
                  <span className="text-[8.5pt] font-black text-blue-600 uppercase tracking-wider">
                    {lang === "ar" ? `${m.title} (متابعة)` : `${m.title} (Continued)`}
                  </span>
                  <span className="text-[7.5pt] text-slate-400 font-mono">
                    #{m.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
              )}

              {/* Render grouped sub-block contents with sectionGap spacing */}
              <div className={cardSpacing.sectionGap}>
                {group.map((subBlock) => (
                  <div key={subBlock.id}>
                    {renderSubBlockContent(m, subBlock.subType || "main", isMeasuring)}
                  </div>
                ))}
              </div>
            </div>
          );
        }
      } else {
        // It's summary or signature block
        renderedElements.push(
          <div key={block.id}>
            {renderBlock(block, isMeasuring)}
          </div>
        );
        i++;
      }
    }
    return renderedElements;
  };

  if (!isOpen) return null;

  return (
    <div className="print-modal-overlay dark-section fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 selection:bg-[#0075DE]/30">
      <style>{`
        /* Dynamic font scaling overrides to support Tailwind's rem classes */
        #print-scratchpad-measurer, .print-page {
          font-size: ${customFontScale}% !important;
        }
        #print-scratchpad-measurer .text-xs, .print-page .text-xs { font-size: calc(0.75rem * ${customFontScale / 100}) !important; }
        #print-scratchpad-measurer .text-sm, .print-page .text-sm { font-size: calc(0.875rem * ${customFontScale / 100}) !important; }
        #print-scratchpad-measurer .text-base, .print-page .text-base { font-size: calc(1rem * ${customFontScale / 100}) !important; }
        #print-scratchpad-measurer .text-lg, .print-page .text-lg { font-size: calc(1.125rem * ${customFontScale / 100}) !important; }
        #print-scratchpad-measurer .text-xl, .print-page .text-xl { font-size: calc(1.25rem * ${customFontScale / 100}) !important; }
        #print-scratchpad-measurer .text-2xl, .print-page .text-2xl { font-size: calc(1.5rem * ${customFontScale / 100}) !important; }
        
        #print-scratchpad-measurer [class*="text-[7pt]"], .print-page [class*="text-[7pt]"] { font-size: calc(7pt * ${customFontScale / 100}) !important; }
        #print-scratchpad-measurer [class*="text-[7.5pt]"], .print-page [class*="text-[7.5pt]"] { font-size: calc(7.5pt * ${customFontScale / 100}) !important; }
        #print-scratchpad-measurer [class*="text-[8pt]"], .print-page [class*="text-[8pt]"] { font-size: calc(8pt * ${customFontScale / 100}) !important; }
        #print-scratchpad-measurer [class*="text-[8.5pt]"], .print-page [class*="text-[8.5pt]"] { font-size: calc(8.5pt * ${customFontScale / 100}) !important; }
        #print-scratchpad-measurer [class*="text-[9pt]"], .print-page [class*="text-[9pt]"] { font-size: calc(9pt * ${customFontScale / 100}) !important; }
        #print-scratchpad-measurer [class*="text-[9.5pt]"], .print-page [class*="text-[9.5pt]"] { font-size: calc(9.5pt * ${customFontScale / 100}) !important; }
        #print-scratchpad-measurer [class*="text-[10pt]"], .print-page [class*="text-[10pt]"] { font-size: calc(10pt * ${customFontScale / 100}) !important; }
      `}</style>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[var(--text-primary)]"
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
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#0075DE]/10 text-blue-400 border border-[#0075DE]/20 font-mono">
                  {selectedMemories.length} {lang === "ar" ? "مستندات" : "Items"}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 active:bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-100 font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center gap-2"
              title={lang === "ar" ? "تصدير كـ PDF" : (lang === "fr" ? "Exporter en PDF" : "Export as PDF")}
            >
              <FileDown className="w-4 h-4 text-blue-500" />
              <span>{lang === "ar" ? "تصدير كـ PDF" : (lang === "fr" ? "Exporter en PDF" : "Export as PDF")}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-[#0075DE] hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/10 transition-all cursor-pointer flex items-center gap-2"
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

        {/* Main Body: Grid with Controls Sidebar (Left/Right) & Live Preview Canvas */}
        <div className="print-content-grid flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-800">
          
          {/* CONTROL PANEL SIDEBAR (No Print) */}
          <div className="no-print lg:col-span-4 p-5 space-y-6 bg-slate-950/40 overflow-y-auto max-h-[calc(92vh-80px)]">
            
            {/* 1. Memory Items Selector */}
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
                <div className="pt-1">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">{lang === "ar" ? "كل الفئات" : "All Categories"}</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Memory List Checkboxes */}
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {filteredMemories.map((m) => {
                  const isSelected = selectedIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleSelectMemory(m.id)}
                      className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                        isSelected 
                          ? "bg-[#0075DE]/10 border-[#0075DE]/40 text-blue-200" 
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

            {/* 2. Formatting & Layout Settings */}
            <div className="space-y-4 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  <span>{t.layoutSettings}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRefreshPreview}
                    disabled={isRefreshing}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-all cursor-pointer flex items-center gap-1"
                    title={lang === "ar" ? "تحديث المعاينة" : "Refresh Preview"}
                  >
                    <RefreshCw className={`w-3 h-3 text-blue-500 ${isRefreshing ? "animate-spin" : ""}`} />
                    <span className="text-[10px] font-bold px-0.5">{lang === "ar" ? "تحديث" : "Refresh"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer flex items-center gap-1"
                    title={lang === "ar" ? "إعادة التعيين للافتراضي" : "Reset to Defaults"}
                  >
                    <RotateCcw className="w-3 h-3 text-rose-500" />
                    <span className="text-[10px] font-bold px-0.5">{lang === "ar" ? "افتراضي" : "Reset"}</span>
                  </button>
                </div>
              </span>

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

              {/* Font Size Scale */}
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

              {/* Document Visual Theme */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{t.documentThemeLabel}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: "blue", name: lang === "ar" ? "أزرق" : "Blue", color: "bg-blue-500 border-blue-600" },
                    { id: "slate", name: lang === "ar" ? "رمادي" : "Slate", color: "bg-slate-500 border-slate-600" },
                    { id: "emerald", name: lang === "ar" ? "أخضر" : "Emerald", color: "bg-emerald-500 border-emerald-600" },
                    { id: "rose", name: lang === "ar" ? "أحمر" : "Rose", color: "bg-rose-500 border-rose-600" }
                  ].map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setDocumentTheme(theme.id as any)}
                      title={theme.name}
                      className={`py-1 rounded-lg border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                        documentTheme === theme.id 
                          ? "bg-slate-800 border-blue-500 text-white" 
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${theme.color}`}></span>
                      <span className="text-[9px] font-semibold">{theme.name}</span>
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

              {/* Page Sizing & Margins (Word-like custom parameters) */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    {lang === "ar" ? "حجم الصفحة الرسمية:" : "Official Page Size:"}
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
                    <option value="1.15">1.15 ({lang === "ar" ? "افتراضي" : "Default"})</option>
                    <option value="1.5">1.5 ({lang === "ar" ? "متوسط" : "1.5 Lines"})</option>
                    <option value="2.0">2.0 ({lang === "ar" ? "مزدوج" : "Double"})</option>
                  </select>
                </div>
              </div>

              {/* Margins and Free-size Adjusters */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>{lang === "ar" ? "هوامش الورقة المخصصة:" : "Custom Page Margins:"}</span>
                  <span className="font-mono text-blue-400 font-bold">{pageMargins}px</span>
                </div>
                <input 
                  type="range" 
                  min="16" 
                  max="80" 
                  value={pageMargins} 
                  onChange={(e) => setPageMargins(parseInt(e.target.value))} 
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />

                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>{lang === "ar" ? "مقياس الخط المخصص (حر):" : "Custom Font Scale:"}</span>
                  <span className="font-mono text-blue-400 font-bold">{customFontScale}%</span>
                </div>
                <input 
                  type="range" 
                  min="75" 
                  max="150" 
                  value={customFontScale} 
                  onChange={(e) => setCustomFontScale(parseInt(e.target.value))} 
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

            </div>

            {/* Branding & Header Layout Controls */}
            <div className="space-y-3 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Building2 className="w-4 h-4" />
                <span>{lang === "ar" ? "هوية المؤسسة وترويسة التقرير" : "Company Branding & Header"}</span>
              </span>

              {/* Company Name (Locked/Read-Only) */}
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-slate-400">
                  {lang === "ar" ? "اسم الشركة / المؤسسة المعتمد:" : "Approved Organization Name:"}
                </label>
                <div className="w-full h-8 px-2.5 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-400 flex items-center cursor-not-allowed opacity-85 font-semibold">
                  {companyName}
                </div>
                <span className="text-[9px] text-blue-500/80 block font-semibold mt-0.5">
                  {lang === "ar" 
                    ? "🔒 يسحب الاسم تلقائياً من الإعدادات ولا يمكن تغييره هنا" 
                    : "🔒 Pulls automatically from account settings & immutable here"}
                </span>
              </div>

                {/* Department / Sector Input */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-slate-400">
                    {lang === "ar" ? "الإدارة / القطاع:" : "Department / Sector:"}
                  </label>
                  <input 
                    type="text"
                    value={departmentName}
                    onChange={(e) => {
                      setDepartmentName(e.target.value);
                      try {
                        localStorage.setItem("zakir_department_name", e.target.value);
                      } catch (err) {}
                    }}
                    className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder={lang === "ar" ? "اسم الإدارة..." : "Department Name..."}
                  />
                </div>

                {/* Document Reference Code Input */}
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

                {/* Header Layout Style */}
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

                {/* Company Logo Sizing */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-semibold text-slate-400">
                      {lang === "ar" ? "حجم شعار الشركة:" : "Company Logo Sizing:"}
                    </label>
                    <div className="flex gap-1">
                      {(["small", "medium", "large"] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setLogoSize(sz)}
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded border transition-all cursor-pointer ${
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

                  <div className="p-2 bg-slate-950/60 border border-slate-900 rounded-lg space-y-1.5 text-center">
                    {companyLogoImg ? (
                      <div className="flex justify-center items-center py-1">
                        <img src={companyLogoImg} alt="Company Logo" className="h-8 object-contain rounded" referrerPolicy="no-referrer" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 block">
                        {lang === "ar" ? "لا يوجد شعار للمؤسسة" : "No institutional logo set"}
                      </span>
                    )}
                    <span className="text-[9px] text-blue-500/80 block font-semibold">
                      {lang === "ar" 
                        ? "🔒 يُعدل شعار الشركة من إعدادات الحساب فقط" 
                        : "🔒 Logo editable only via account settings"}
                    </span>
                  </div>
                </div>

                {/* Verification Seal Toggle */}
                <div className="pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 text-[10px] text-slate-300 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={includeVerificationSeal}
                      onChange={(e) => setIncludeVerificationSeal(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-800 text-blue-500 focus:ring-blue-500 accent-blue-500 cursor-pointer"
                    />
                    <span className="font-semibold text-blue-400">{lang === "ar" ? "تضمين ختم التوثيق والاعتماد" : "Include Verification Stamp"}</span>
                  </label>
                </div>
              </div>

              {/* Watermark Selector */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{t.watermarkLabel}</label>
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

                {/* Watermark & Printing Details Customization */}
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-3 mt-2">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-500/80">
                    {lang === "ar" ? "بيانات الاعتماد والطباعة" : "Approval & Printing Details"}
                  </span>
                  
                   {/* Include Company Toggle & Input */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-[10px] text-slate-400 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={includeCompanyInWatermark}
                        onChange={(e) => setIncludeCompanyInWatermark(e.target.checked)}
                        className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-800 text-blue-500 focus:ring-blue-500 accent-blue-500 cursor-pointer"
                      />
                      <span>{lang === "ar" ? "تضمين اسم المؤسسة" : "Include Company Name"}</span>
                    </label>
                    {includeCompanyInWatermark && (
                      <div className="space-y-1">
                        <input 
                          type="text"
                          value={watermarkCompany}
                          disabled
                          readOnly
                          className="w-full h-8 px-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-400 focus:outline-none cursor-not-allowed opacity-80"
                          placeholder={lang === "ar" ? "اسم المؤسسة..." : "Company name..."}
                        />
                        <span className="text-[9px] text-slate-500 block leading-tight">
                          {lang === "ar" 
                            ? "🔒 مرتبط تلقائياً بقاعدة بيانات إعدادات الحساب" 
                            : "🔒 Synced with account settings database"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Include Date Toggle & Input */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-[10px] text-slate-400 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={includeDateInWatermark}
                        onChange={(e) => setIncludeDateInWatermark(e.target.checked)}
                        className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-800 text-blue-500 focus:ring-blue-500 accent-blue-500 cursor-pointer"
                      />
                      <span>{lang === "ar" ? "تضمين التاريخ والوقت" : "Include Timestamp"}</span>
                    </label>
                    {includeDateInWatermark && (
                      <input 
                        type="date"
                        value={watermarkDate}
                        onChange={(e) => setWatermarkDate(e.target.value)}
                        className="w-full h-8 px-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer [color-scheme:dark]"
                      />
                    )}
                  </div>

                  {/* Executive Summary / Index Toggle */}
                  <div className="space-y-1 pt-1.5 border-t border-slate-900/40">
                    <label className="flex items-center gap-2 text-[10px] text-slate-400 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={includeSummaryTable}
                        onChange={(e) => setIncludeSummaryTable(e.target.checked)}
                        className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-800 text-blue-500 focus:ring-blue-500 accent-blue-500 cursor-pointer"
                      />
                      <span className="font-semibold text-blue-500/90">{t.incSummaryTable}</span>
                    </label>
                    <span className="text-[9px] text-slate-500 block leading-normal">
                      {lang === "ar" 
                        ? "يولد جدولاً للفهرس وملخصاً تنفيذياً لتقييم المخاطر في بداية التقرير." 
                        : "Generates a structured index table with active risks summary at the start of your report."}
                    </span>
                  </div>

                  {/* Pagination Page-Break Toggle */}
                  <div className="space-y-1 pt-1.5 border-t border-slate-900/40">
                    <label className="flex items-center gap-2 text-[10px] text-slate-400 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={pageBreakBetween}
                        onChange={(e) => setPageBreakBetween(e.target.checked)}
                        className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-800 text-blue-500 focus:ring-blue-500 accent-blue-500 cursor-pointer"
                      />
                      <span className="font-semibold text-blue-500/90">{lang === "ar" ? "تفعيل تقسيم الصفحات التلقائي" : "Enable Multi-page Pagination"}</span>
                    </label>
                    <span className="text-[9px] text-slate-500 block leading-normal">
                      {lang === "ar" 
                        ? "يفصل كل سجل ذاكرة في صفحة طباعة جديدة عند التفعيل." 
                        : "Forces each memory entry to start on a new printed page."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Company Logo Image Uploader */}
              <div className="pt-3 border-t border-slate-800/60">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  {lang === "ar" ? "شعار الشركة المعتمد للطباعة" : "Upload Official Company Logo"}
                </label>
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
                          setCompanyLogoImg(event.target?.result as string);
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
                      {companyLogoImg ? (lang === "ar" ? "تغيير الشعار" : "Change Logo") : (lang === "ar" ? "اختر ملف الشعار" : "Choose Logo File")}
                    </label>
                    {companyLogoImg && (
                      <button
                        type="button"
                        onClick={() => setCompanyLogoImg(null)}
                        className="px-2.5 bg-rose-950/40 border border-rose-800 text-rose-400 rounded-lg text-[10px] font-bold hover:bg-rose-900 transition-all cursor-pointer"
                      >
                        {lang === "ar" ? "حذف" : "Remove"}
                      </button>
                    )}
                  </div>
                  {companyLogoImg && (
                    <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 flex justify-center items-center">
                      <img src={companyLogoImg} alt="Company Logo Preview" className="h-10 object-contain rounded" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              </div>

              {/* Signature Image Uploader */}
              <div className="pt-2 border-t border-slate-800/60">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  {lang === "ar" ? "رفع التوقيع المعتمد للطباعة" : "Upload Authorized Signature"}
                </label>
                <div className="space-y-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    id="modal-signature-upload"
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
                      htmlFor="modal-signature-upload"
                      className="flex-1 py-1.5 px-2.5 text-[10px] font-bold text-center rounded-lg border border-dashed border-slate-700 bg-slate-950 text-blue-400 hover:text-blue-300 hover:bg-slate-900 transition-all cursor-pointer"
                    >
                      {signatureImg ? (lang === "ar" ? "تغيير التوقيع" : "Change Signature") : (lang === "ar" ? "اختر ملف التوقيع" : "Choose Signature File")}
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
                  {signatureImg && (
                    <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 flex justify-center items-center">
                      <img src={signatureImg} alt="Signature Preview" className="h-10 object-contain" />
                    </div>
                  )}
                </div>
              </div>

            {/* 3. Included Sections Toggles */}
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

          {/* LIVE PREVIEW CANVAS (Printable Container) */}
          <div className="print-preview-canvas lg:col-span-8 p-4 sm:p-8 bg-slate-950 overflow-y-auto max-h-[calc(92vh-80px)] flex flex-col items-center gap-6 selection:bg-[#0075DE]/30">
            
            {/* Hidden Scratchpad for exact pixel height calculations */}
            <div
              id="print-scratchpad-measurer"
              className="printable-area absolute pointer-events-none opacity-0"
              style={{
                left: "-9999px",
                top: "-9999px",
                width: `${pageWidth}px`,
                padding: `${pageMargins}px`,
                boxSizing: "border-box",
                lineHeight: lineSpacing,
              }}
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              {includeHeader && (
                <div data-measurer-id="page-header" style={{ fontSize: `${customFontScale}%` }}>
                  {renderPageHeader(0, 1)}
                </div>
              )}
              {documentBlocks.map((block) => (
                <div key={block.id} data-measurer-id={block.id} style={{ fontSize: `${customFontScale}%` }}>
                  {renderBlock(block, true)}
                </div>
              ))}
            </div>

            {selectedMemories.length === 0 ? (
              <div className="py-20 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl my-8 w-full max-w-md">
                <FileText className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-bold text-slate-300">{lang === "ar" ? "لم يتم اختيار أي ذاكرة للطباعة" : "No memories selected for printing"}</p>
                <p className="text-xs text-slate-500 mt-1">{lang === "ar" ? "يرجى تحديد ذكريات من القائمة الجانبية" : "Please check items from the side controls"}</p>
              </div>
            ) : (
              <div className="print-page-wrapper flex flex-col items-center w-full">
                {documentPages.map((pageBlocks, pageIdx) => (
                  <div
                    key={pageIdx}
                    className="print-page printable-area bg-white text-slate-900 shadow-2xl relative border border-slate-300 rounded-sm mb-6 flex flex-col justify-between shrink-0"
                    style={{
                      width: `${pageWidth}px`,
                      minHeight: `${pageHeight}px`,
                      padding: `${pageMargins}px`,
                      boxSizing: "border-box",
                      position: "relative",
                      lineHeight: lineSpacing,
                      fontSize: `${customFontScale}%`,
                    }}
                    dir={lang === "ar" ? "rtl" : "ltr"}
                  >
                    {/* Optional Confidentiality Watermark */}
                    {t.watermarkText && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none">
                        <div className="text-slate-200/40 font-black tracking-widest uppercase -rotate-45 text-center px-6 border-8 border-slate-200/30 rounded-3xl py-8 flex flex-col items-center gap-2 max-w-[85%]">
                          <span className="text-4xl sm:text-5xl md:text-6xl font-black leading-none">
                            {t.watermarkText}
                          </span>
                          {(includeCompanyInWatermark || includeDateInWatermark) && (
                            <div className="text-[11px] sm:text-xs font-bold flex flex-col items-center gap-0.5 pt-1.5 border-t border-slate-200/30 w-full mt-1.5 opacity-80 font-sans">
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

                    {/* Content Area of this page */}
                    <div className="flex-1 flex flex-col justify-start relative z-10 overflow-visible">
                      {renderPageHeader(pageIdx, documentPages.length)}
                      <div className={columns === "2" ? "grid grid-cols-2 gap-4 items-start" : "space-y-4"}>
                        {renderPageBlocks(pageBlocks, false)}
                      </div>
                    </div>

                    {/* Dynamic Page Footer */}
                    {includeFooter && (
                      <div className="print-only-footer h-8 border-t border-slate-200 flex items-center justify-between text-[8pt] text-slate-500 font-mono relative z-10 mt-auto pt-1 font-semibold">
                        <span>{companyName}</span>
                        <span className="rtl:ml-auto ltr:mr-auto"></span>
                        <span>{lang === "ar" ? `صفحة ${pageIdx + 1} من ${documentPages.length}` : `Page ${pageIdx + 1} of ${documentPages.length}`}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>

        </div>
      </motion.div>
    </div>
  );
}
