import React, { useState, useEffect, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import { Memory } from "../../types";
import { PrintSystemProps, PrintSettingsState } from "./printTypes";
import { getPaperGeometry } from "./printGeometry";
import { PrintSettings } from "./PrintSettings";
import { PrintPreview } from "./PrintPreview";
import { PrintDocument } from "./PrintDocument";
import { Printer, X, ZoomIn, ZoomOut, Sliders, Maximize2, Minimize2, Check, RefreshCw } from "lucide-react";
import "./print.css";

export const PrintSystem: React.FC<PrintSystemProps> = ({
  isOpen,
  onClose,
  memories,
  initialSelectedMemoryId,
  lang = "en",
  companyName = "Zakir Institutional Memory Engine",
  userName = "System Administrator",
  workspaceLogoUrl,
}) => {
  const isRtl = lang === "ar";

  // Initial selected memory IDs
  const initialMemoryIds = useMemo(() => {
    if (initialSelectedMemoryId && memories.some((m) => m.id === initialSelectedMemoryId)) {
      return [initialSelectedMemoryId];
    }
    return memories.map((m) => m.id);
  }, [initialSelectedMemoryId, memories]);

  // Document reference string generator
  const generatedRef = useMemo(() => {
    const year = new Date().getFullYear();
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ZK-${year}-${randomHex}`;
  }, []);

  // Settings state
  const [settings, setSettings] = useState<PrintSettingsState>({
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
    departmentName: "",
    documentRef: generatedRef,
    userName: userName,
    displayDate: new Date().toLocaleDateString(isRtl ? "ar-SA" : "en-US"),
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

    selectedMemoryIds: initialMemoryIds,
  });

  // Local editable memory items
  const [localMemories, setLocalMemories] = useState<Memory[]>(memories);

  useEffect(() => {
    setLocalMemories(memories);
  }, [memories]);

  useEffect(() => {
    if (isOpen) {
      setSettings((prev) => ({
        ...prev,
        selectedMemoryIds: initialMemoryIds,
        companyName: companyName || prev.companyName,
        userName: userName || prev.userName,
        companyLogoImg: workspaceLogoUrl || prev.companyLogoImg,
      }));
    }
  }, [isOpen, initialMemoryIds, companyName, userName, workspaceLogoUrl]);

  // Zoom level state (50, 75, 100, 125, 150)
  const [zoom, setZoom] = useState<number>(100);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isPreparingPrint, setIsPreparingPrint] = useState<boolean>(false);

  // Filtered active memories to render
  const selectedMemories = useMemo(() => {
    return localMemories.filter((m) => settings.selectedMemoryIds.includes(m.id));
  }, [localMemories, settings.selectedMemoryIds]);

  // Geometry computation
  const geometry = useMemo(() => {
    return getPaperGeometry(
      settings.pageSize,
      settings.orientation,
      settings.marginPreset,
      settings.customMarginMm
    );
  }, [settings.pageSize, settings.orientation, settings.marginPreset, settings.customMarginMm]);

  // Handlers for memory updates / exclusion
  const handleUpdateMemoryField = useCallback((id: string, field: keyof Memory, value: any) => {
    setLocalMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  }, []);

  const handleExcludeMemory = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      selectedMemoryIds: prev.selectedMemoryIds.filter((mId) => mId !== id),
    }));
  }, []);

  // START PRINTING HANDLER - Only triggers when user explicitly clicks "Start Printing"
  const handleStartPrint = useCallback(async () => {
    setIsPreparingPrint(true);

    try {
      // 1. Inject or update dynamic @page style tag for browser print
      let styleTag = document.getElementById("zakir-dynamic-print-page-style");
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = "zakir-dynamic-print-page-style";
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = `@page { size: ${settings.pageSize} ${settings.orientation} !important; margin: ${geometry.marginMm}mm !important; }`;

      // 2. Wait for fonts and images settled
      if (document.fonts) {
        await document.fonts.ready;
      }

      // Small tick delay to allow layout to settle
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 3. Trigger native print dialog
      window.print();
    } catch (err) {
      console.error("Print execution failed:", err);
    } finally {
      setIsPreparingPrint(false);
    }
  }, [settings.pageSize, settings.orientation, geometry.marginMm]);

  if (!isOpen) return null;

  return (
    <>
      {/* Fullscreen Document Preview & Formatting System Overlay */}
      <div
        className="zakir-print-modal-overlay fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col w-screen h-screen overflow-hidden select-none"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Top Header Control Bar */}
        <header className="zakir-print-modal-header h-14 min-h-[56px] bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-white z-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-black text-sm text-blue-400">
              <Printer className="w-5 h-5" />
              <span>{lang === "ar" ? "نظام طباعة وثائق ذاكر" : "Zakir Enterprise Print System"}</span>
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 border-s border-slate-800 ps-3">
              <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-bold text-slate-200">
                {settings.pageSize} {settings.orientation}
              </span>
              <span>({geometry.widthMm} × {geometry.heightMm} mm)</span>
            </div>
          </div>

          {/* Controls: Zoom, Sidebar Toggle, Print Button, Close */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(50, z - 25))}
                disabled={zoom <= 50}
                className="p-1 hover:bg-slate-700 text-slate-300 disabled:opacity-40 rounded cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] font-bold px-1.5 text-slate-200 min-w-[42px] text-center">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(150, z + 25))}
                disabled={zoom >= 150}
                className="p-1 hover:bg-slate-700 text-slate-300 disabled:opacity-40 rounded cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sidebar Toggle */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isSidebarOpen
                  ? "bg-slate-800 border-slate-700 text-blue-400"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
              }`}
              title={lang === "ar" ? "إعدادات التنسيق" : "Format Settings"}
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">{lang === "ar" ? "الإعدادات" : "Settings"}</span>
            </button>

            {/* START PRINTING BUTTON */}
            <button
              type="button"
              onClick={handleStartPrint}
              disabled={isPreparingPrint || selectedMemories.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-extrabold text-xs rounded-lg flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {isPreparingPrint ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>{lang === "ar" ? "بدء الطباعة الآن" : "Start Printing"}</span>
            </button>

            {/* Close Modal */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title={lang === "ar" ? "إغلاق" : "Close"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Content Workspace */}
        <div className="flex-1 flex w-full overflow-hidden relative">
          {/* Settings Sidebar */}
          {isSidebarOpen && (
            <PrintSettings
              settings={settings}
              onUpdateSettings={setSettings}
              allMemories={localMemories}
              lang={lang}
            />
          )}

          {/* Physical Document Screen Preview */}
          <main className="flex-1 h-full overflow-hidden relative">
            <PrintPreview
              memories={selectedMemories}
              settings={settings}
              lang={lang}
              zoom={zoom}
              onUpdateMemoryField={handleUpdateMemoryField}
              onExcludeMemory={handleExcludeMemory}
            />
          </main>
        </div>
      </div>

      {/* Hidden Dedicated Print Document Host for Native Browser window.print() */}
      <div id="zakir-print-document-host">
        <PrintDocument
          memories={selectedMemories}
          settings={settings}
          lang={lang}
          isPrinting={true}
        />
      </div>
    </>
  );
};
