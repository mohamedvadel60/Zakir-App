import React, { useMemo } from "react";
import { Memory } from "../../types";
import { PrintSettingsState } from "./printTypes";
import { getPaperGeometry } from "./printGeometry";
import { PrintPage } from "./PrintPage";
import { PrintDocument } from "./PrintDocument";

interface PrintPreviewProps {
  memories: Memory[];
  settings: PrintSettingsState;
  lang: "en" | "ar" | "fr";
  zoom: number;
  onUpdateMemoryField?: (id: string, field: keyof Memory, value: any) => void;
  onExcludeMemory?: (id: string) => void;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  memories,
  settings,
  lang,
  zoom,
  onUpdateMemoryField,
  onExcludeMemory,
}) => {
  const geometry = useMemo(() => {
    return getPaperGeometry(
      settings.pageSize,
      settings.orientation,
      settings.marginPreset,
      settings.customMarginMm
    );
  }, [settings.pageSize, settings.orientation, settings.marginPreset, settings.customMarginMm]);

  return (
    <div className="zakir-preview-workspace w-full h-full overflow-auto bg-slate-900/90 dark:bg-slate-950 p-6 sm:p-10 flex flex-col items-center justify-start min-h-[500px] select-none">
      <div
        className="zakir-preview-zoom-container transition-transform duration-200 origin-top flex flex-col items-center"
        style={{
          transform: `scale(${zoom / 100})`,
        }}
      >
        <PrintPage
          pageIndex={1}
          totalPages={1}
          geometry={geometry}
        >
          <PrintDocument
            memories={memories}
            settings={settings}
            lang={lang}
            isPrinting={false}
            pageIndex={1}
            totalPages={1}
            onUpdateMemoryField={onUpdateMemoryField}
            onExcludeMemory={onExcludeMemory}
          />
        </PrintPage>
      </div>
    </div>
  );
};
