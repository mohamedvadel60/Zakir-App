import React from "react";
import { Memory } from "../../types";
import { PrintSettingsState, PrintDiagnostics } from "./printTypes";
import { PrintPage } from "./PrintPage";
import { PrintDocument } from "./PrintDocument";

interface PrintPreviewProps {
  memories: Memory[];
  settings: PrintSettingsState;
  lang: "ar" | "en" | "fr";
  onExcludeMemory?: (memoryId: string) => void;
  onDiagnosticsUpdate?: (diag: PrintDiagnostics) => void;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  memories,
  settings,
  lang,
  onExcludeMemory,
  onDiagnosticsUpdate,
}) => {
  return (
    <div className="zakir-print-preview-workspace flex-1 h-full bg-slate-950 overflow-auto p-6 md:p-10 flex flex-col items-center custom-scrollbar">
      {/* Zoomable Viewport Wrapper (Visual zoom only, does NOT affect physical dimensions) */}
      <div
        className="transition-transform duration-200 origin-top flex flex-col items-center gap-8 py-4"
        style={{
          transform: `scale(${settings.zoom || 1})`,
        }}
      >
        <PrintPage settings={settings} pageNumber={1}>
          <PrintDocument
            memories={memories}
            settings={settings}
            lang={lang}
            onExcludeMemory={onExcludeMemory}
            isPrinting={false}
            onDiagnosticsUpdate={onDiagnosticsUpdate}
          />
        </PrintPage>
      </div>
    </div>
  );
};
