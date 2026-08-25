import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Memory } from "../../types";
import { PrintSettingsState, PaperSize, Orientation } from "./printTypes";
import { getPaperGeometry, generateDynamicPageStyle } from "./printGeometry";
import { PrintSettings } from "./PrintSettings";
import { PrintPreview } from "./PrintPreview";
import { PrintDocument } from "./PrintDocument";
import { PRINT_TEST_MEMORIES } from "./printTestData";
import { Printer, X, Download, FileText, RefreshCw, CheckCircle, ShieldCheck } from "lucide-react";
import "./print.css";

interface PrintSystemProps {
  isOpen: boolean;
  onClose: () => void;
  memories?: Memory[];
  initialSelectedMemoryId?: string | null;
  lang?: "en" | "ar" | "fr";
  companyName?: string;
  userName?: string;
  workspaceLogoUrl?: string;
}

export const PrintSystem: React.FC<PrintSystemProps> = ({
  isOpen,
  onClose,
  memories = [],
  initialSelectedMemoryId,
  lang = "en",
  companyName = "Zakir Institutional Decision Engine",
  userName = "System Administrator",
  workspaceLogoUrl,
}) => {
  const isRtl = lang === "ar";
  const effectiveMemories = useMemo(() => {
    return memories.length > 0 ? memories : PRINT_TEST_MEMORIES;
  }, [memories]);

  // Initial settings setup
  const [settings, setSettings] = useState<PrintSettingsState>(() => ({
    pageSize: "A4",
    orientation: "portrait",
    marginPreset: "standard",
    customMarginMm: 18,
    density: "standard",
    fontSize: "medium",
    fontScale: 100,
    lineSpacing: 1.2,
    columns: "1",
    headerStyle: "standard",
    logoSize: "medium",
    companyName: companyName,
    departmentName: "Decision Intelligence & Strategy Division",
    documentRef: `REF-ZK-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    userName: userName,
    displayDate: new Date().toLocaleDateString(isRtl ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    watermark: "none",
    includeHeader: true,
    includeFooter: true,
    includeCausal: true,
    includeOutcomes: true,
    includeLessons: true,
    includeAuthor: true,
    includeTags: true,
    includeSignatureBlock: true,
    includeVerificationSeal: true,
    companyLogoImg: workspaceLogoUrl || null,
    signatureImg: null,
    selectedMemoryIds: initialSelectedMemoryId
      ? [initialSelectedMemoryId]
      : effectiveMemories.map((m) => m.id),
  }));

  const [isPrinting, setIsPrinting] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "settings">("preview");

  // Sync memory selection when initialSelectedMemoryId or effectiveMemories change
  useEffect(() => {
    if (!isOpen) return;
    if (initialSelectedMemoryId) {
      setSettings((prev) => ({
        ...prev,
        selectedMemoryIds: [initialSelectedMemoryId],
      }));
    } else {
      setSettings((prev) => ({
        ...prev,
        selectedMemoryIds: effectiveMemories.map((m) => m.id),
      }));
    }
  }, [isOpen, initialSelectedMemoryId, effectiveMemories]);

  // Update memory title/description in editable preview mode
  const [customMemories, setCustomMemories] = useState<Memory[]>(effectiveMemories);
  useEffect(() => {
    setCustomMemories(effectiveMemories);
  }, [effectiveMemories]);

  const handleUpdateMemoryField = useCallback((id: string, field: keyof Memory, value: any) => {
    setCustomMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  }, []);

  const handleExcludeMemory = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      selectedMemoryIds: prev.selectedMemoryIds.filter((i) => i !== id),
    }));
  }, []);

  const selectedMemories = useMemo(() => {
    return customMemories.filter((m) => settings.selectedMemoryIds.includes(m.id));
  }, [customMemories, settings.selectedMemoryIds]);

  // Native Print Execution
  const handleStartPrint = async () => {
    setIsPrinting(true);

    try {
      // 1. Wait for document fonts
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // 2. Inject dynamic @page style tag
      const pageStyleId = "zakir-dynamic-page-style";
      let existingStyle = document.getElementById(pageStyleId);
      if (!existingStyle) {
        existingStyle = document.createElement("style");
        existingStyle.id = pageStyleId;
        document.head.appendChild(existingStyle);
      }
      existingStyle.innerHTML = generateDynamicPageStyle(settings.pageSize, settings.orientation);

      // 3. Double RAF to ensure layout settled
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
          setIsPrinting(false);
        });
      });
    } catch (err) {
      console.error("Print execution failed:", err);
      setIsPrinting(false);
    }
  };

  const handleLoadTestDataset = () => {
    setCustomMemories(PRINT_TEST_MEMORIES);
    setSettings((prev) => ({
      ...prev,
      selectedMemoryIds: PRINT_TEST_MEMORIES.map((m) => m.id),
    }));
  };

  if (!isOpen) return null;

  return (
    <div
      className="print-modal-overlay fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col w-screen h-screen overflow-hidden select-none font-sans"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* 1. Modal Header Bar */}
      <header className="no-print w-full h-14 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
        {/* Title & Stats */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Printer className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                {lang === "ar"
                  ? "منظومة الطباعة والتوثيق المؤسسي"
                  : lang === "fr"
                  ? "Système d'Impression et de Documentation"
                  : "Enterprise Print & Document System"}
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {selectedMemories.length} {lang === "ar" ? "سجل مختار" : "selected"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {settings.companyName} • {settings.documentRef}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Test Dataset Trigger */}
          <button
            type="button"
            onClick={handleLoadTestDataset}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
            title="Load 6 rich multi-page test records"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>{lang === "ar" ? "تحميل بيانات الاختبار (5+ صفحات)" : "Load Test Suite"}</span>
          </button>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={handleStartPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>{lang === "ar" ? "تصدير PDF" : "Export PDF"}</span>
          </button>

          {/* Primary Print Button */}
          <button
            type="button"
            onClick={handleStartPrint}
            disabled={isPrinting || selectedMemories.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-black shadow-lg shadow-blue-600/25 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            <span>
              {isPrinting
                ? (lang === "ar" ? "جاري التجهيز..." : "Preparing...")
                : (lang === "ar" ? "إبدأ الطباعة" : "Start Printing")}
            </span>
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. Main Work Area: Settings Sidebar + Screen Preview Stage */}
      <div className="no-print flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Mobile View Toggle */}
        <div className="md:hidden flex border-b border-slate-800 bg-slate-900 text-xs font-bold text-slate-400">
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex-1 py-2 text-center border-b-2 transition-colors ${
              activeTab === "preview"
                ? "border-blue-500 text-blue-400 bg-slate-950"
                : "border-transparent"
            }`}
          >
            {lang === "ar" ? "معاينة الوثيقة" : "Document Preview"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`flex-1 py-2 text-center border-b-2 transition-colors ${
              activeTab === "settings"
                ? "border-blue-500 text-blue-400 bg-slate-950"
                : "border-transparent"
            }`}
          >
            {lang === "ar" ? "إعدادات التنسيق" : "Print Settings"}
          </button>
        </div>

        {/* Sidebar: Print Settings */}
        <aside
          className={`w-full md:w-80 lg:w-96 border-e border-slate-800 bg-slate-950 flex flex-col shrink-0 ${
            activeTab === "settings" ? "block" : "hidden md:flex"
          }`}
        >
          <PrintSettings
            memories={customMemories}
            settings={settings}
            onUpdateSettings={setSettings}
            lang={lang}
          />
        </aside>

        {/* Screen Preview Stage */}
        <main
          className={`flex-1 flex flex-col overflow-hidden bg-slate-950 ${
            activeTab === "preview" ? "flex" : "hidden md:flex"
          }`}
        >
          <PrintPreview
            memories={selectedMemories}
            settings={settings}
            lang={lang}
            onUpdateMemoryField={handleUpdateMemoryField}
            onExcludeMemory={handleExcludeMemory}
          />
        </main>
      </div>

      {/* 3. Dedicated Print Host for Native @media print */}
      <div id="zakir-print-document-host">
        <PrintDocument
          memories={selectedMemories}
          settings={settings}
          lang={lang}
          isPrinting={true}
        />
      </div>
    </div>
  );
};
