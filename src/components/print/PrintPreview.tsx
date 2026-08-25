import React, { useState } from "react";
import { Memory } from "../../types";
import { PrintSettingsState } from "./printTypes";
import { getPaperGeometry } from "./printGeometry";
import { PrintPage } from "./PrintPage";
import { PrintDocument } from "./PrintDocument";
import { ZoomIn, ZoomOut, Maximize2, FileX } from "lucide-react";

interface PrintPreviewProps {
  memories: Memory[];
  settings: PrintSettingsState;
  lang: "en" | "ar" | "fr";
  onUpdateMemoryField?: (id: string, field: keyof Memory, value: any) => void;
  onExcludeMemory?: (id: string) => void;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  memories,
  settings,
  lang,
  onUpdateMemoryField,
  onExcludeMemory,
}) => {
  const [zoom, setZoom] = useState<number>(100);

  const geometry = getPaperGeometry(
    settings.pageSize,
    settings.orientation,
    settings.marginPreset,
    settings.customMarginMm
  );

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 15, 175));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 15, 50));
  const handleResetZoom = () => setZoom(100);

  // Estimate pages count based on content length for visual indicators
  const estimatedPages = Math.max(
    1,
    Math.ceil(
      memories.reduce((acc, m) => {
        const titleLen = m.title?.length || 0;
        const descLen = m.description?.length || 0;
        const causalLen = m.causalFactors?.length || 0;
        const outcomeLen = m.outcomes?.length || 0;
        const lessonsLen = m.lessonsLearned?.length || 0;
        return acc + titleLen + descLen + causalLen + outcomeLen + lessonsLen + 300;
      }, 0) / (settings.orientation === "landscape" ? 1800 : 2400)
    )
  );

  if (memories.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800">
        <FileX className="w-12 h-12 text-slate-600 mb-3" />
        <p className="text-sm font-bold text-slate-300">
          {lang === "ar"
            ? "لم يتم اختيار أي ذاكرة للطباعة"
            : lang === "fr"
            ? "Aucun souvenir sélectionné pour l'impression"
            : "No memories selected for printing"}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {lang === "ar"
            ? "يرجى تحديد سجل واحد على الأقل من القائمة الجانبية."
            : "Please select at least one record from the sidebar list."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden relative select-none">
      {/* Zoom & Page Viewport Toolbar */}
      <div className="no-print w-full bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-300 shrink-0 z-20">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="font-bold text-blue-400 uppercase">
            {settings.pageSize} {settings.orientation}
          </span>
          <span className="text-slate-600">•</span>
          <span>
            {geometry.widthMm} × {geometry.heightMm} mm
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400 font-sans">
            {memories.length} {lang === "ar" ? "سجل" : "records"}
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="font-mono font-bold text-[11px] text-blue-400 min-w-[36px] text-center">
            {zoom}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            title="Reset Zoom 100%"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Screen Preview Workspace Canvas */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center gap-6 bg-slate-950 selection:bg-blue-500/30">
        <div
          className="transition-transform duration-150 origin-top flex flex-col items-center"
          style={{
            transform: `scale(${zoom / 100})`,
          }}
        >
          {Array.from({ length: estimatedPages }).map((_, i) => (
            <PrintPage
              key={i}
              pageIndex={i + 1}
              totalPages={estimatedPages}
              geometry={geometry}
            >
              <PrintDocument
                memories={memories}
                settings={settings}
                lang={lang}
                isPrinting={false}
                pageIndex={i + 1}
                totalPages={estimatedPages}
                onUpdateMemoryField={onUpdateMemoryField}
                onExcludeMemory={onExcludeMemory}
              />
            </PrintPage>
          ))}
        </div>
      </div>
    </div>
  );
};
