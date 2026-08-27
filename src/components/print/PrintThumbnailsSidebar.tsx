import React from "react";
import { Memory } from "../../types";
import { PrintSettingsState } from "./printTypes";
import { chunkMemories } from "./PrintDocument";
import { Layers, FileText } from "lucide-react";

interface PrintThumbnailsSidebarProps {
  memories: Memory[];
  settings: PrintSettingsState;
  lang: "ar" | "en" | "fr";
  activePageIndex: number;
  onSelectPage: (index: number) => void;
}

export const PrintThumbnailsSidebar: React.FC<PrintThumbnailsSidebarProps> = ({
  memories,
  settings,
  lang,
  activePageIndex,
  onSelectPage,
}) => {
  const isRtl = lang === "ar";
  const pageChunks = chunkMemories(memories, settings.density);
  const totalPages = Math.max(1, pageChunks.length);

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
        {pageChunks.map((chunk, idx) => {
          const pageNum = idx + 1;
          const isActive = idx === activePageIndex;

          return (
            <div
              key={idx}
              onClick={() => onSelectPage(idx)}
              className="flex flex-col items-center gap-1.5 cursor-pointer group"
            >
              {/* Mini Page Card with Dual Border Representation */}
              <div
                className={`w-24 h-32 bg-white rounded-xs p-1.5 shadow-md relative transition-all flex flex-col justify-between overflow-hidden border ${
                  isActive
                    ? "ring-2 ring-[#0075DE] border-[#0075DE] shadow-[#0075DE]/20 scale-105"
                    : "border-slate-300 opacity-80 group-hover:opacity-100 group-hover:border-slate-400"
                }`}
              >
                {/* Outer mini border */}
                <div
                  className="w-full h-full border border-slate-900 p-1 flex flex-col justify-between relative"
                  style={{
                    borderWidth: settings.showOuterBorder ? "1.5px" : "0px",
                    borderColor: settings.outerBorderColor || "#0f172a",
                  }}
                >
                  {/* Inner mini border */}
                  <div
                    className="w-full h-full border border-slate-700/80 p-0.5 flex flex-col justify-between"
                    style={{
                      borderWidth: settings.showInnerBorder ? "1px" : "0px",
                      borderColor: settings.innerBorderColor || "#0f172a",
                    }}
                  >
                    {/* Mini Content Lines & Wavy flourish representation */}
                    <div className="space-y-1">
                      <div className="w-full h-1 bg-[#0075DE] rounded-full opacity-80" />
                      <div className="w-3/4 h-0.5 bg-slate-800 rounded-full opacity-60" />
                      <div className="w-1/2 h-0.5 bg-slate-400 rounded-full opacity-40" />
                      <div className="w-4/5 h-0.5 bg-slate-400 rounded-full opacity-40" />
                    </div>

                    {/* Right side wavy flourish indicator in thumbnail */}
                    {settings.showWavySideBorder && (
                      <div className="absolute top-1 end-1 bottom-1 w-1 border-s border-dotted border-slate-600 flex flex-col justify-between items-center py-0.5 opacity-60">
                        <span className="text-[5px] font-black leading-none">~</span>
                        <span className="text-[5px] font-black leading-none">~</span>
                      </div>
                    )}

                    {/* Mini Corner Page Marker */}
                    {settings.showCornerPageMarkers && (
                      <div className="text-[6px] font-mono font-black text-slate-900 self-end pe-0.5">
                        P{pageNum}
                      </div>
                    )}
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
