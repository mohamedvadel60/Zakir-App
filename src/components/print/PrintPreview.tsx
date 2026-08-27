import React from "react";
import { Memory } from "../../types";
import { PrintSettingsState, PrintDiagnostics } from "./printTypes";
import { PrintPage } from "./PrintPage";
import { PrintDocument } from "./PrintDocument";
import { PaginatedPage, paginateMemories } from "./printPagination";

interface PrintPreviewProps {
  memories: Memory[];
  settings: PrintSettingsState;
  lang: "ar" | "en" | "fr";
  onExcludeMemory?: (memoryId: string) => void;
  onDiagnosticsUpdate?: (diag: PrintDiagnostics) => void;
  activePageIndex?: number;
  onPageSelect?: (pageIndex: number) => void;
  pages?: PaginatedPage[];
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  memories,
  settings,
  lang,
  onExcludeMemory,
  onDiagnosticsUpdate,
  activePageIndex = 0,
  onPageSelect,
  pages: providedPages,
}) => {
  const isRtl = lang === "ar";
  const pages = providedPages || paginateMemories(memories, settings, lang);
  const totalPages = Math.max(1, pages.length);

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
      {/* Zoomable Viewport Wrapper (Word / Docs Multi-Page Flow) */}
      <div
        className="transition-transform duration-200 origin-top flex flex-col items-center gap-10 py-6 w-full max-w-full"
        style={{
          transform: `scale(${settings.zoom || 1})`,
        }}
      >
        {pages.map((pageData) => {
          const pageNum = pageData.pageNumber;
          const pIdx = pageData.pageIndex;
          const isActive = pIdx === activePageIndex;

          return (
            <div
              key={pIdx}
              id={`zakir-print-page-target-${pIdx}`}
              className="relative flex flex-col items-center cursor-pointer group"
              onClick={() => onPageSelect && onPageSelect(pIdx)}
            >
              {/* Floating Page Number Indicator on Preview Sheet Edge */}
              <div className="absolute -top-3.5 start-2 z-20 bg-slate-900/90 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-md border border-slate-700 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                {lang === "ar" ? `صفحة ${pageNum} من ${totalPages}` : `Page ${pageNum} of ${totalPages}`}
              </div>

              {/* Physical Rendered A4 Page Sheet */}
              <div
                className={`relative shadow-2xl rounded-xs transition-all duration-200 ${
                  isActive
                    ? "ring-4 ring-[#0075DE]/40 shadow-[#0075DE]/20"
                    : "hover:ring-2 hover:ring-slate-400/50"
                }`}
              >
                <PrintPage
                  settings={settings}
                  pageNumber={pageNum}
                  totalPages={totalPages}
                >
                  <PrintDocument
                    pageData={pageData}
                    settings={settings}
                    lang={lang}
                    onExcludeMemory={onExcludeMemory}
                    isPrinting={false}
                    onDiagnosticsUpdate={pIdx === 0 ? onDiagnosticsUpdate : undefined}
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
