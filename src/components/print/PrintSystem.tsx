import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Memory } from "../../types";
import { PrintSettingsState, PrintSystemProps, PrintDiagnostics } from "./printTypes";
import { PrintSettings } from "./PrintSettings";
import { PrintPreview } from "./PrintPreview";
import { PrintThumbnailsSidebar } from "./PrintThumbnailsSidebar";
import { PrintPage } from "./PrintPage";
import { getPaperGeometry } from "./printGeometry";
import { PrintDocument, paginateMemories } from "./PrintDocument";
import { 
  Printer, 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  CheckSquare, 
  Square, 
  Sidebar, 
  RefreshCw, 
  Sliders
} from "lucide-react";
import "./print.css";

export const PrintSystem: React.FC<PrintSystemProps> = ({
  isOpen,
  onClose,
  memories,
  initialSelectedMemoryId,
  lang,
  companyName,
  userName,
  workspaceLogoUrl,
  currentUser,
  onOpenProfileSettings,
}) => {
  const isRtl = lang === "ar";

  // Filter memories to ensure only valid items exist
  const validMemories = useMemo(() => {
    if (!memories) return [];
    const map = new Map<string, Memory>();
    for (const m of memories) {
      if (m && m.id && !map.has(m.id)) {
        map.set(m.id, m);
      }
    }
    return Array.from(map.values());
  }, [memories]);

  // Selected Memory IDs state
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [showRightSettings, setShowRightSettings] = useState<boolean>(true);

  // Initialize Memory Selection State when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedMemoryId) {
        setSelectedMemoryIds([initialSelectedMemoryId]);
      } else {
        setSelectedMemoryIds(validMemories.map((m) => m.id));
      }
    }
  }, [isOpen, initialSelectedMemoryId, validMemories]);

  const effectiveCompanyName = currentUser?.organizationName || currentUser?.companyName || companyName || (lang === "ar" ? "ذاكر للهندسة والمعرفة المؤسسية" : "Zakir Knowledge Engine");
  const effectiveDepartment = currentUser?.department || currentUser?.issuingEntity || (lang === "ar" ? "إدارة الحوكمة والمخاطر والقرارات الاستراتيجية" : "Governance & Strategy Division");
  const effectiveIssuingEntity = currentUser?.issuingEntity || currentUser?.department || effectiveCompanyName;
  const effectiveAuthorName = currentUser?.fullName || currentUser?.ownerName || userName || "";
  const effectiveApproverName = currentUser?.fullName || currentUser?.ownerName || (lang === "ar" ? "د. محمد الأحمد" : "Dr. M. Al-Ahmad");
  const effectiveApproverTitle = currentUser?.jobTitle || (currentUser?.role ? currentUser.role : (lang === "ar" ? "رئيس لجنة الحوكمة والقرارات" : "Governance Chair"));
  const effectiveLogo = currentUser?.companyLogoUrl || workspaceLogoUrl || null;
  const effectiveSignature = currentUser?.signatureUrl || null;

  // Print Configuration State with Clean Outer Frame Defaults
  const [settings, setSettings] = useState<PrintSettingsState>({
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    density: "comfortable",
    lineHeight: 1.55,
    headerStyle: "classic",

    // Outer Frame Border Controls (Integrated into Page Settings)
    showOuterBorder: true,
    outerBorderThickness: 2,
    outerBorderColor: "#0f172a",
    outerBorderRadius: 0,
    whiteMarginMm: 10,

    fontSize: 13,
    showHeader: true,
    showFooter: true,
    showSignature: true,
    showIssuingEntity: true,
    issuingEntityName: effectiveIssuingEntity,
    showMetadata: true,
    showCausalFactors: true,
    showOutcomes: true,
    showLessonsLearned: true,
    showTags: true,
    showRiskBadges: true,
    companyName: effectiveCompanyName,
    departmentName: effectiveDepartment,
    reportTitle: lang === "ar" ? "تقرير مخرجات ومعارف الذاكرة المؤسسية" : "Institutional Knowledge & Memory Report",
    docRefNumber: `ZKR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    authorName: effectiveAuthorName,
    approverName: effectiveApproverName,
    approverTitle: effectiveApproverTitle,
    approvalDate: new Date().toISOString().split("T")[0],
    companyLogoImg: effectiveLogo,
    signatureImg: effectiveSignature,
    watermarkText: "",
    zoom: 1.0,
    previewTheme: "light-gray",
  });

  // Sync profile details when currentUser changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setSettings((prev) => ({
        ...prev,
        companyName: effectiveCompanyName,
        departmentName: effectiveDepartment,
        issuingEntityName: effectiveIssuingEntity,
        authorName: effectiveAuthorName,
        approverName: effectiveApproverName,
        approverTitle: effectiveApproverTitle,
        companyLogoImg: effectiveLogo,
        signatureImg: effectiveSignature,
      }));
    }
  }, [isOpen, currentUser, effectiveCompanyName, effectiveDepartment, effectiveIssuingEntity, effectiveAuthorName, effectiveApproverName, effectiveApproverTitle, effectiveLogo, effectiveSignature]);

  // Print Preparation State
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [diagnostics, setDiagnostics] = useState<PrintDiagnostics>({
    selectedCount: 0,
    uniqueCount: 0,
    renderedCount: 0,
  });

  const handleDiagnosticsUpdate = useCallback((diag: PrintDiagnostics) => {
    setDiagnostics((prev) => {
      if (
        prev.selectedCount === diag.selectedCount &&
        prev.uniqueCount === diag.uniqueCount &&
        prev.renderedCount === diag.renderedCount
      ) {
        return prev;
      }
      return diag;
    });
  }, []);

  // Compute final normalized selected memories
  const selectedMemories = useMemo(() => {
    const map = new Map<string, Memory>();
    for (const id of selectedMemoryIds) {
      const found = validMemories.find((m) => m.id === id);
      if (found && !map.has(found.id)) {
        map.set(found.id, found);
      }
    }
    return Array.from(map.values());
  }, [selectedMemoryIds, validMemories]);

  const pages = useMemo(() => {
    return paginateMemories(selectedMemories, settings, lang);
  }, [selectedMemories, settings, lang]);

  const totalPages = Math.max(1, pages.length);

  // Toggle single memory selection
  const handleToggleMemory = useCallback((memoryId: string) => {
    setSelectedMemoryIds((prev) =>
      prev.includes(memoryId) ? prev.filter((id) => id !== memoryId) : [...prev, memoryId]
    );
  }, []);

  // Select all memories
  const handleSelectAllMemories = useCallback(() => {
    setSelectedMemoryIds(validMemories.map((m) => m.id));
  }, [validMemories]);

  // Deselect all memories
  const handleDeselectAllMemories = useCallback(() => {
    setSelectedMemoryIds([]);
  }, []);

  // Exclude memory from preview
  const handleExcludeMemory = useCallback((memoryId: string) => {
    setSelectedMemoryIds((prev) => prev.filter((id) => id !== memoryId));
  }, []);

  // Page navigation helpers
  const handlePrevPage = useCallback(() => {
    setActivePageIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setActivePageIndex((prev) => Math.min(totalPages - 1, prev + 1));
  }, [totalPages]);

  const scrollToPage = useCallback((pIdx: number) => {
    setActivePageIndex(pIdx);
    const target = document.getElementById(`zakir-print-page-target-${pIdx}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setSettings((prev) => ({ ...prev, zoom: Math.min(1.75, Math.round((prev.zoom + 0.1) * 10) / 10) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setSettings((prev) => ({ ...prev, zoom: Math.max(0.5, Math.round((prev.zoom - 0.1) * 10) / 10) }));
  }, []);

  const handleZoomReset = useCallback(() => {
    setSettings((prev) => ({ ...prev, zoom: 1.0 }));
  }, []);

  // Toggle outer borders
  const handleToggleBorders = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      showOuterBorder: !prev.showOuterBorder,
    }));
  }, []);

  // Handle native browser print trigger
  const handleStartPrint = useCallback(() => {
    setIsPreparingPrint(true);

    const orient = settings.orientation || "portrait";
    const sizeName = settings.paperSize || "A4";
    const geom = getPaperGeometry(settings.paperSize, settings.orientation, settings.margins);

    const styleId = "zakir-dynamic-page-size-style";
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      @media print {
        @page { size: ${sizeName} ${orient}; margin: 0; }
        .zakir-print-page, .page {
          width: ${geom.widthMm}mm !important;
          height: ${geom.heightMm}mm !important;
          max-height: ${geom.heightMm}mm !important;
          min-height: ${geom.heightMm}mm !important;
        }
      }
    `;

    setTimeout(() => {
      window.print();
      setIsPreparingPrint(false);
    }, 150);
  }, [settings.orientation, settings.paperSize, settings.margins]);

  // Keyboard shortcut handlers (Ctrl+P, Esc, Arrows)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handleStartPrint();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        if (!isRtl) handlePrevPage();
        else handleNextPage();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        if (!isRtl) handleNextPage();
        else handlePrevPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handleStartPrint, handlePrevPage, handleNextPage, isRtl]);

  // Clean up dynamic print styles on unmount
  useEffect(() => {
    return () => {
      const el = document.getElementById("zakir-dynamic-page-size-style");
      if (el) el.remove();
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  const areBordersEnabled = settings.showOuterBorder !== false;

  return (
    <>
      {/* Modal Overlay & Desktop Workspace UI */}
      <div
        className="zakir-print-modal-overlay fixed inset-0 z-50 bg-slate-950 flex flex-col w-screen h-screen overflow-hidden select-none"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* TOP TOOLBAR (Print, Next Page, Previous Page, Zoom, Show Borders, Sidebars, Close) */}
        <header className="zakir-print-modal-header h-13 min-h-[52px] bg-[#0f172a] border-b border-slate-800 px-4 flex items-center justify-between text-white z-20 shrink-0 shadow-md">
          {/* Left / Primary Toolbar Actions */}
          <div className="flex items-center gap-2.5">
            {/* Primary START PRINT Button */}
            <button
              type="button"
              onClick={handleStartPrint}
              disabled={selectedMemories.length === 0 || isPreparingPrint}
              className={`h-9 px-4 rounded-lg font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                selectedMemories.length === 0 || isPreparingPrint
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  : "bg-[#0075DE] hover:bg-[#005BAB] text-white shadow-[#0075DE]/25 active:scale-95 ring-1 ring-blue-400/30"
              }`}
              title={lang === "ar" ? "طباعة فورية" : "Print"}
            >
              {isPreparingPrint ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{lang === "ar" ? "جاري التجهيز..." : "Preparing..."}</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  <span>{lang === "ar" ? "طباعة" : "Print"}</span>
                </>
              )}
            </button>

            <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />

            {/* Previous Page Button */}
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={activePageIndex === 0}
              className={`h-8 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activePageIndex === 0
                  ? "bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed"
                  : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white active:scale-95"
              }`}
              title="Previous Page"
            >
              {isRtl ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{lang === "ar" ? "الصفحة السابقة" : "Previous Page"}</span>
            </button>

            {/* Next Page Button */}
            <button
              type="button"
              onClick={handleNextPage}
              disabled={activePageIndex >= totalPages - 1}
              className={`h-8 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activePageIndex >= totalPages - 1
                  ? "bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed"
                  : "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white active:scale-95"
              }`}
              title="Next Page"
            >
              <span className="hidden md:inline">{lang === "ar" ? "الصفحة التالية" : "Next Page"}</span>
              {isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {/* Page Count Indicator */}
            <div className="text-xs font-mono font-bold text-slate-300 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
              <span>{activePageIndex + 1}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-slate-400">{totalPages}</span>
            </div>

            <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />

            {/* Zoom Controls Widget */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-slate-300">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 hover:bg-slate-800 rounded cursor-pointer transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold w-16 text-center text-slate-200">
                {lang === "ar" ? `تكبير (${Math.round(settings.zoom * 100)}%)` : `Zoom (${Math.round(settings.zoom * 100)}%)`}
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 hover:bg-slate-800 rounded cursor-pointer transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomReset}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded cursor-pointer transition-colors ms-0.5"
                title="Reset (100%)"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            <div className="h-5 w-px bg-slate-800 mx-1 hidden md:block" />

            {/* Show Borders Checkbox Button */}
            <button
              type="button"
              onClick={handleToggleBorders}
              className={`h-8 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                areBordersEnabled
                  ? "bg-[#0075DE]/20 border-[#0075DE]/60 text-white shadow-xs"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
              title={lang === "ar" ? "تفعيل أو تعطيل الإطارات" : "Toggle Borders"}
            >
              {areBordersEnabled ? (
                <CheckSquare className="w-4 h-4 text-[#0075DE]" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>{lang === "ar" ? "إظهار الإطارات" : "Show Borders"}</span>
            </button>
          </div>

          {/* Right Toolbar Actions (Sidebar toggles & Close) */}
          <div className="flex items-center gap-2">
            {/* Toggle Left Thumbnails Sidebar */}
            <button
              type="button"
              onClick={() => setShowThumbnails((p) => !p)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                showThumbnails
                  ? "bg-slate-800 border-slate-700 text-[#0075DE]"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
              }`}
              title={lang === "ar" ? "لوحة المصغرات" : "Pages Thumbnails"}
            >
              <Sidebar className="w-4 h-4" />
            </button>

            {/* Toggle Right Settings Sidebar */}
            <button
              type="button"
              onClick={() => setShowRightSettings((p) => !p)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                showRightSettings
                  ? "bg-slate-800 border-slate-700 text-[#0075DE]"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
              }`}
              title={lang === "ar" ? "لوحة الإعدادات" : "Settings"}
            >
              <Sliders className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-slate-800 mx-1" />

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Modal Main Content Workspace Layout (Left Thumbnails + Center Canvas + Right Settings Panel) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Pages Thumbnail Sidebar */}
          {showThumbnails && (
            <PrintThumbnailsSidebar
              memories={selectedMemories}
              settings={settings}
              lang={lang}
              activePageIndex={activePageIndex}
              onSelectPage={scrollToPage}
              pages={pages}
            />
          )}

          {/* Center Screen Print Preview Workspace Area */}
          <PrintPreview
            memories={selectedMemories}
            settings={settings}
            lang={lang}
            onExcludeMemory={handleExcludeMemory}
            onDiagnosticsUpdate={handleDiagnosticsUpdate}
            activePageIndex={activePageIndex}
            onPageSelect={setActivePageIndex}
            pages={pages}
          />

          {/* Right Page & Format Configuration Sidebar */}
          {showRightSettings && (
            <PrintSettings
              settings={settings}
              onUpdateSettings={setSettings}
              allMemories={validMemories}
              selectedMemoryIds={selectedMemoryIds}
              onToggleMemory={handleToggleMemory}
              onSelectAllMemories={handleSelectAllMemories}
              onDeselectAllMemories={handleDeselectAllMemories}
              lang={lang}
              diagnostics={diagnostics}
              currentUser={currentUser}
              onOpenProfileSettings={onOpenProfileSettings}
            />
          )}
        </div>
      </div>

      {/* Dedicated Native Print Host (Rendered strictly during @media print) */}
      {createPortal(
        <div id="zakir-print-document-host" dir={isRtl ? "rtl" : "ltr"} lang={lang}>
          {pages.map((pageData) => (
            <PrintPage
              key={pageData.pageIndex}
              settings={settings}
              pageNumber={pageData.pageNumber}
              totalPages={totalPages}
            >
              <PrintDocument
                pageData={pageData}
                settings={settings}
                lang={lang}
                isPrinting={true}
              />
            </PrintPage>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};
