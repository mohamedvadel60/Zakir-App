import React from "react";
import { Memory } from "../../types";
import { PrintSettingsState } from "./printTypes";
import { PaginatedPage, paginateMemories } from "./printPagination";
import { Layers } from "lucide-react";

interface PrintThumbnailsSidebarProps {
  memories: Memory[];
  settings: PrintSettingsState;
  lang: "ar" | "en" | "fr";
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  pages?: PaginatedPage[];
}

export const PrintThumbnailsSidebar: React.FC<PrintThumbnailsSidebarProps> = ({
  memories,
  settings,
  lang,
  activePageIndex,
  onSelectPage,
  pages: providedPages,
}) => {
  const isRtl = lang === "ar";
  const pages = providedPages || paginateMemories(memories, settings, lang);
  const totalPages = Math.max(1, pages.length);

  return (
    <aside
      className="zakir-print-thumbnails-sidebar w-36 min-w-[130px] max-w-[150px] h-full bg-[#0b1329] border-e border-slate-800/80 flex flex-col select-none custom-scrollbar shrink-0 shadow-lg z-10"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="h-10 px-3 border-b border-slate-800/80 flex items-center justify-between text-slate-300">
        <div className="flex items-center gap-1.5 font-black text-xs">
          <Layers className="w-3.5 h-3.5 text-[#0075DE]" />
          <span>{lang === "ar" ? "الصفحات" : "Pages"}</span>
        </div>
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700">
          {totalPages}
        </span>
      </div>

      {/* Thumbnails List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {pages.map((pData, idx) => {
          const pageNum = pData.pageNumber;
          const isActive = idx === activePageIndex;

          return (
            <div
              key={idx}
              onClick={() => onSelectPage(idx)}
              className="flex flex-col items-center gap-1.5 cursor-pointer group"
            >
              {/* Mini Page Card with Outer Frame Representation */}
              <div
                className={`w-24 h-32 bg-white rounded-xs p-1.5 shadow-md relative transition-all flex flex-col justify-between overflow-hidden border ${
                  isActive
                    ? "ring-2 ring-[#0075DE] border-[#0075DE] shadow-[#0075DE]/20 scale-105"
                    : "border-slate-300 opacity-80 group-hover:opacity-100 group-hover:border-slate-400"
                }`}
              >
                {/* Outer mini frame */}
                <div
                  className="w-full h-full p-1.5 flex flex-col justify-between relative bg-white"
                  style={{
                    border: settings.showOuterBorder
                      ? `${Math.max(1, Math.min(3, settings.outerBorderThickness || 2))}px solid ${settings.outerBorderColor || "#0f172a"}`
                      : "none",
                    borderRadius: `${Math.min(4, settings.outerBorderRadius || 0)}px`,
                  }}
                >
                  {/* Mini Content Lines */}
                  <div className="space-y-1.5">
                    <div className="w-full h-1 bg-[#0075DE] rounded-full opacity-80" />
                    <div className="w-3/4 h-0.5 bg-slate-800 rounded-full opacity-60" />
                    <div className="w-1/2 h-0.5 bg-slate-400 rounded-full opacity-40" />
                    <div className="w-4/5 h-0.5 bg-slate-400 rounded-full opacity-40" />
                  </div>
                </div>
              </div>

              {/* Page Number Label */}
              <span
                className={`text-[11px] font-bold font-mono transition-colors ${
                  isActive ? "text-[#0075DE] font-black" : "text-slate-400 group-hover:text-slate-200"
                }`}
              >
                {pageNum}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
