import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Memory } from "../../types";
import { PrintSettingsState } from "./printTypes";
import { generateDynamicPageStyle } from "./printGeometry";
import { PrintSettings } from "./PrintSettings";
import { PrintPreview } from "./PrintPreview";
import { PrintDocument } from "./PrintDocument";
import { Printer, X, Download, FileText } from "lucide-react";
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

  // Authoritative memory dataset (Strictly derived from memories prop, deduplicated by ID)
  const authoritativeMemories = useMemo(() => {
    if (!Array.isArray(memories) || memories.length === 0) return [];
    const map = new Map<string, Memory>();
    for (const m of memories) {
      if (m && m.id && !map.has(m.id)) {
        map.set(m.id, m);
      }
    }
    return Array.from(map.values());
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
    selectedMemoryIds: initialSelectedMemoryId && authoritativeMemories.some((m) => m.id === initialSelectedMemoryId)
      ? [initialSelectedMemoryId]
      : authoritativeMemories.map((m) => m.id),
  }));

  const [isPrinting, setIsPrinting] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "settings">("preview");

  // Synchronize memory selection when modal opens or dataset changes
  useEffect(() => {
    if (!isOpen) return;

    setSettings((prev) => {
      // Clean up any selected memory IDs that no longer exist in authoritativeMemories
      const validIds = prev.selectedMemoryIds.filter((id) =>
        authoritativeMemories.some((m) => m.id === id)
      );

      // Priority 1: If initialSelectedMemoryId was passed and exists, select ONLY that memory
      if (initialSelectedMemoryId && authoritativeMemories.some((m) => m.id === initialSelectedMemoryId)) {
        return {
          ...prev,
          selectedMemoryIds: [initialSelectedMemoryId],
        };
      }

      // Priority 2: If no valid IDs remain or selection was empty, select all authoritative memories
      if (validIds.length === 0 && authoritativeMemories.length > 0) {
        return {
          ...prev,
          selectedMemoryIds: authoritativeMemories.map((m) => m.id),
        };
      }

      return {
        ...prev,
        selectedMemoryIds: validIds,
      };
    });
  }, [isOpen, initialSelectedMemoryId, authoritativeMemories]);

  // Sync customMemories state for editable preview mode
  const [customMemories, setCustomMemories] = useState<Memory[]>(authoritativeMemories);
  useEffect(() => {
    setCustomMemories(authoritativeMemories);
  }, [authoritativeMemories]);

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

  // Compute exact valid selected memories derived ONLY from authoritative & custom memories
  const validSelectedMemories = useMemo(() => {
    const selected = authoritativeMemories
      .filter((m) => settings.selectedMemoryIds.includes(m.id))
      .map((m) => {
        const edited = customMemories.find((c) => c.id === m.id);
        return edited || m;
      });

    // Mandatory forensic check for single memory preview flow
    if (initialSelectedMemoryId) {
      const targetExists = authoritativeMemories.some((m) => m.id === initialSelectedMemoryId);
      if (targetExists && selected.length !== 1) {
        console.warn(
          `[Zakir Print Forensic] Expected exactly 1 memory for previewMemoryId="${initialSelectedMemoryId}", but found ${selected.length}`
        );
      }
    }

    return selected;
  }, [authoritativeMemories, customMemories, settings.selectedMemoryIds, initialSelectedMemoryId]);

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

  if (!isOpen) return null;

  return (
    <>
      {/* On-Screen Preview Modal Shell */}
      <div
        className="print-modal-overlay fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col w-screen h-screen overflow-hidden select-none font-sans"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Modal Header Bar */}
        <header className="no-print w-full h-14 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
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
                  {validSelectedMemories.length} {lang === "ar" ? "سجل مختار" : "selected"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                {settings.companyName} • {settings.documentRef}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Export PDF Button */}
            <button
              type="button"
              onClick={handleStartPrint}
              disabled={validSelectedMemories.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:opacity-50 border border-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>{lang === "ar" ? "تصدير PDF" : "Export PDF"}</span>
            </button>

            {/* Primary Print Button */}
            <button
              type="button"
              onClick={handleStartPrint}
              disabled={isPrinting || validSelectedMemories.length === 0}
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

        {/* Work Area: Settings Sidebar + Screen Preview Stage */}
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
              memories={authoritativeMemories}
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
              memories={validSelectedMemories}
              settings={settings}
              lang={lang}
              onUpdateMemoryField={handleUpdateMemoryField}
              onExcludeMemory={handleExcludeMemory}
            />
          </main>
        </div>
      </div>

      {/* Dedicated Print Host Mounted at document.body Root Level for Native @media print */}
      {createPortal(
        <div id="zakir-print-document-host">
          <PrintDocument
            memories={validSelectedMemories}
            settings={settings}
            lang={lang}
            isPrinting={true}
          />
        </div>,
        document.body
      )}
    </>
  );
};
