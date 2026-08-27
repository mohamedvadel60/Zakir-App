import React from "react";
import { Memory } from "../../types";
import { PrintSettingsState, PrintDiagnostics } from "./printTypes";
import { PrintPage } from "./PrintPage";
import { PrintDocument, chunkMemories } from "./PrintDocument";

interface PrintPreviewProps {
  memories: Memory[];
  settings: PrintSettingsState;
  lang: "ar" | "en" | "fr";
  onExcludeMemory?: (memoryId: string) => void;
  onDiagnosticsUpdate?: (diag: PrintDiagnostics) => void;
  activePageIndex?: number;
  onPageSelect?: (pageIndex: number) => void;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  memories,
  settings,
  lang,
  onExcludeMemory,
  onDiagnosticsUpdate,
  activePageIndex = 0,
  onPageSelect,
}) => {
  const isRtl = lang === "ar";
  const pageChunks = chunkMemories(memories, settings.density);
  const totalPages = Math.max(1, pageChunks.length);

  // Canvas background style based on settings or default neutral workspace
  const getCanvasBgClass = () => {
    switch (settings.previewTheme) {
      case "pure-white":
        return "bg-slate-100";
      case "canvas-dark":
        return "bg-slate-950";
      case "light-gray":
      default:
        return "bg-[#e2e8f0]";
    }
  };

  return (
    <div
      className={`zakir-print-preview-workspace flex-1 h-full ${getCanvasBgClass()} overflow-auto p-4 sm:p-8 md:p-12 flex flex-col items-center custom-scrollbar relative`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Zoomable Viewport Wrapper */}
      <div
        className="transition-transform duration-200 origin-top flex flex-col items-center gap-12 py-6 w-full max-w-full"
        style={{
          transform: `scale(${settings.zoom || 1})`,
        }}
      >
        {pageChunks.map((chunk, pIdx) => {
          const pageNum = pIdx + 1;
          const isActive = pIdx === activePageIndex;

          return (
            <div
              key={pIdx}
              id={`zakir-print-page-target-${pIdx}`}
              className="relative flex items-center justify-center group"
              onClick={() => onPageSelect && onPageSelect(pIdx)}
            >
              {/* Floating Page Label (Page 1, Page 2 ←) as depicted in the diagram */}
              <div
                className={`absolute top-8 ${
                  isRtl ? "-end-28 sm:-end-32" : "-start-28 sm:-start-32"
                } z-10 hidden md:flex items-center gap-2 pointer-events-none select-none transition-all ${
                  isActive ? "opacity-100 translate-x-0" : "opacity-75 hover:opacity-100"
                }`}
              >
                <div
                  className={`px-3 py-1 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 border ${
                    isActive
                      ? "bg-[#0075DE] text-white border-[#0075DE]/40 ring-2 ring-[#0075DE]/20"
                      : "bg-white text-slate-800 border-slate-300"
                  }`}
                >
                  <span>
                    {lang === "ar" ? `الصفحة ${pageNum}` : `Page ${pageNum}`}
                  </span>
                  {pIdx > 0 && <span className="font-mono text-sm">{isRtl ? "←" : "→"}</span>}
                </div>
              </div>

              {/* Physical Rendered Page Sheet */}
              <div className="relative shadow-2xl rounded-sm transition-all hover:ring-2 hover:ring-[#0075DE]/30">
                <PrintPage
                  settings={settings}
                  pageNumber={pageNum}
                  totalPages={totalPages}
                >
                  <PrintDocument
                    memories={chunk}
                    settings={settings}
                    lang={lang}
                    onExcludeMemory={onExcludeMemory}
                    isPrinting={false}
                    onDiagnosticsUpdate={pIdx === 0 ? onDiagnosticsUpdate : undefined}
                    pageIndex={pIdx}
                    totalPages={totalPages}
                  />
                </PrintPage>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
