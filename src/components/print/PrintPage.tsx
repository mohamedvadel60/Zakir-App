import React from "react";
import { getPaperGeometry } from "./printGeometry";
import { PrintSettingsState } from "./printTypes";

interface PrintPageProps {
  settings: PrintSettingsState;
  children: React.ReactNode;
  pageNumber?: number;
  totalPages?: number;
  className?: string;
}

export const PrintPage: React.FC<PrintPageProps> = ({
  settings,
  children,
  pageNumber,
  totalPages,
  className = "",
}) => {
  const geom = getPaperGeometry(settings.paperSize, settings.orientation, settings.margins);

  return (
    <div
      className={`zakir-print-page bg-white text-slate-900 relative shadow-2xl rounded-sm transition-all duration-200 overflow-hidden print:shadow-none print:rounded-none border border-slate-200 print:border-none ${className}`}
      style={{
        width: `${geom.widthMm}mm`,
        minHeight: `${geom.heightMm}mm`,
        padding: `${geom.paddingMm}mm`,
        colorScheme: "light",
      }}
    >
      {/* Background Watermark (if provided) */}
      {settings.watermarkText && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 opacity-[0.04]">
          <span className="text-6xl font-black uppercase tracking-widest text-slate-900 -rotate-45">
            {settings.watermarkText}
          </span>
        </div>
      )}

      {/* Main Page Content Area */}
      <div className="relative z-10 h-full flex flex-col justify-between">
        {children}
      </div>

      {/* Screen Preview Page Number Footnote (Hidden during native print) */}
      {pageNumber !== undefined && (
        <div className="absolute bottom-2 right-4 text-[9px] font-mono text-slate-400 no-print select-none">
          Page {pageNumber} {totalPages ? `of ${totalPages}` : ""}
        </div>
      )}
    </div>
  );
};
