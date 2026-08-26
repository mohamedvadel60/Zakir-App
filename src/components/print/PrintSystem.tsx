import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Memory } from "../../types";
import { PrintSettingsState, PrintSystemProps, PrintDiagnostics } from "./printTypes";
import { PrintSettings } from "./PrintSettings";
import { PrintPreview } from "./PrintPreview";
import { PrintPage } from "./PrintPage";
import { PrintDocument } from "./PrintDocument";
import { Printer, X, ZoomIn, ZoomOut, RotateCcw, FileCheck, RefreshCw } from "lucide-react";
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
}) => {
  const isRtl = lang === "ar";

  // Filter memories to ensure only valid non-deleted items exist
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

  // Initialize Memory Selection State when modal opens or initialSelectedMemoryId changes
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedMemoryId) {
        setSelectedMemoryIds([initialSelectedMemoryId]);
      } else {
        setSelectedMemoryIds(validMemories.map((m) => m.id));
      }
    }
  }, [isOpen, initialSelectedMemoryId, validMemories]);

  // Print Configuration State
  const [settings, setSettings] = useState<PrintSettingsState>({
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    density: "comfortable",
    headerStyle: "classic",
    fontSize: "medium",
    showHeader: true,
    showFooter: true,
    showSignature: true,
    showIssuingEntity: true,
    issuingEntityName: companyName || (lang === "ar" ? "ذاكر للهندسة والمعرفة المؤسسية" : "Zakir Knowledge Engine"),
    showMetadata: true,
    showCausalFactors: true,
    showOutcomes: true,
    showLessonsLearned: true,
    showTags: true,
    showRiskBadges: true,
    companyName: companyName || (lang === "ar" ? "ذاكر للهندسة والمعرفة المؤسسية" : "Zakir Knowledge Engine"),
    departmentName: lang === "ar" ? "إدارة الحوكمة والمخاطر والقرارات الاستراتيجية" : "Governance & Strategy Division",
    reportTitle: lang === "ar" ? "تقرير مخرجات ومعارف الذاكرة المؤسسية" : "Institutional Knowledge & Memory Report",
    docRefNumber: `ZKR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    authorName: userName || "",
    approverName: lang === "ar" ? "د. محمد الأحمد - رئيس لجنة الحوكمة" : "Dr. M. Al-Ahmad - Governance Chair",
    approvalDate: new Date().toISOString().split("T")[0],
    companyLogoImg: workspaceLogoUrl || null,
    signatureImg: null,
    watermarkText: "",
    zoom: 1.0,
  });

  // Print Preparation State
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [diagnostics, setDiagnostics] = useState<PrintDiagnostics>({
    selectedCount: 0,
    uniqueCount: 0,
    renderedCount: 0,
  });

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

  // Toggle single memory selection
  const handleToggleMemory = useCallback((memoryId: string) => {
    setSelectedMemoryIds((prev) =>
      prev.includes(memoryId) ? prev.filter((id) => id !== memoryId) : [...prev, memoryId]
    );
  }, []);

  const handleSelectAllMemories = useCallback(() => {
    setSelectedMemoryIds(validMemories.map((m) => m.id));
  }, [validMemories]);

  const handleDeselectAllMemories = useCallback(() => {
    setSelectedMemoryIds([]);
  }, []);

  const handleExcludeMemory = useCallback((memoryId: string) => {
    setSelectedMemoryIds((prev) => prev.filter((id) => id !== memoryId));
  }, []);

  // Zoom controls
  const handleZoomIn = () => setSettings((p) => ({ ...p, zoom: Math.min(p.zoom + 0.15, 1.8) }));
  const handleZoomOut = () => setSettings((p) => ({ ...p, zoom: Math.max(p.zoom - 0.15, 0.5) }));
  const handleZoomReset = () => setSettings((p) => ({ ...p, zoom: 1.0 }));

  // Dynamically sync @page CSS rules with selected paperSize and orientation
  useEffect(() => {
    let styleEl = document.getElementById("zakir-print-dynamic-page-style") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "zakir-print-dynamic-page-style";
      document.head.appendChild(styleEl);
    }
    const sizeName = settings.paperSize.toLowerCase();
    const orient = settings.orientation;
    styleEl.innerHTML = `
      @media print {
        @page {
          size: ${sizeName} ${orient};
          margin: 0;
        }
      }
    `;
    return () => {
      // Keep style tag clean if component unmounts
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, [settings.paperSize, settings.orientation]);

  // ESC key handler to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Native Print Trigger function
  const handleStartPrint = async () => {
    if (selectedMemories.length === 0) return;

    setIsPreparingPrint(true);

    try {
      // 1. Wait for document fonts to be fully loaded
      if (document.fonts) {
        await document.fonts.ready;
      }

      // 2. Wait for any images inside print host to complete loading
      const host = document.getElementById("zakir-print-document-host");
      if (host) {
        const images = Array.from(host.querySelectorAll("img"));
        await Promise.all(
          images.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((res) => {
              img.onload = () => res(true);
              img.onerror = () => res(true);
            });
          })
        );
      }

      // 3. Double RAF to ensure DOM painting and layout calculations have settled
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 4. Trigger browser native print dialog
      window.print();
    } catch (err) {
      console.error("Print execution failed:", err);
    } finally {
      setIsPreparingPrint(false);
    }
  };

  // Listen to afterprint event to clean up state
  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPreparingPrint(false);
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* LAYER A & LAYER B: Modal Overlay & Workspace UI */}
      <div
        className="zakir-print-modal-overlay fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col w-screen h-screen overflow-hidden select-none"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Top Action Header Bar */}
        <header className="zakir-print-modal-header h-14 min-h-[56px] bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-white z-20 shrink-0">
          {/* Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#0075DE]/20 text-[#0075DE] rounded-lg border border-[#0075DE]/30">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                <span>{lang === "ar" ? "معاينة وتنسيق طباعة التقرير" : "Institutional Print Preview"}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                  {settings.paperSize} ({settings.orientation})
                </span>
              </h2>
            </div>
          </div>

          {/* Zoom & Action Controls */}
          <div className="flex items-center gap-3">
            {/* Zoom Widget */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 text-slate-300">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 hover:bg-slate-800 rounded cursor-pointer transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold w-12 text-center">
                {Math.round(settings.zoom * 100)}%
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
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded cursor-pointer transition-colors ms-1"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            {/* START PRINTING BUTTON (Layer C trigger) */}
            <button
              type="button"
              onClick={handleStartPrint}
              disabled={selectedMemories.length === 0 || isPreparingPrint}
              className={`h-9 px-5 rounded-lg font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                selectedMemories.length === 0 || isPreparingPrint
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  : "bg-[#0075DE] hover:bg-[#005BAB] text-white shadow-[#0075DE]/20 active:scale-95"
              }`}
            >
              {isPreparingPrint ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{lang === "ar" ? "جاري التجهيز..." : "Preparing..."}</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>{lang === "ar" ? "بدء الطباعة الرسمية" : "Start Printing"}</span>
                </>
              )}
            </button>

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Modal Main Content Body (Layer A Sidebar + Layer B Preview Area) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Layer A: Settings Sidebar */}
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
          />

          {/* Layer B: Screen Print Preview Area */}
          <PrintPreview
            memories={selectedMemories}
            settings={settings}
            lang={lang}
            onExcludeMemory={handleExcludeMemory}
            onDiagnosticsUpdate={setDiagnostics}
          />
        </div>
      </div>

      {/* LAYER C: Native Print Host (Hidden on screen, exposed ONLY during @media print) */}
      {createPortal(
        <div id="zakir-print-document-host" dir={isRtl ? "rtl" : "ltr"} lang={lang}>
          <PrintPage settings={settings}>
            <PrintDocument
              memories={selectedMemories}
              settings={settings}
              lang={lang}
              isPrinting={true}
            />
          </PrintPage>
        </div>,
        document.body
      )}
    </>
  );
};
