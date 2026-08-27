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
  pageNumber = 1,
  totalPages = 1,
  className = "",
}) => {
  const geom = getPaperGeometry(settings.paperSize, settings.orientation, settings.margins);

  // Outer Border configuration
  const showOuter = settings.showOuterBorder !== false;
  const outerThickness = settings.outerBorderThickness || 2;
  const outerColor = settings.outerBorderColor || "#0f172a";
  const outerRadius = settings.outerBorderRadius || 0;
  const pageMarginMm = typeof settings.whiteMarginMm === "number" ? settings.whiteMarginMm : 10;

  return (
    <div
      data-page-number={pageNumber}
      className={`page zakir-print-page bg-white text-slate-900 relative shadow-2xl box-border print:shadow-none ${className}`}
      style={{
        width: `${geom.widthMm}mm`,
        height: `${geom.heightMm}mm`,
        maxHeight: `${geom.heightMm}mm`,
        padding: "6mm", // Inset from actual physical paper edge
        backgroundColor: "#ffffff",
        color: "#0f172a",
        colorScheme: "light",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* OUTER FRAME BORDER (الإطار الخارجي للصفحة) */}
      <div
        className="zakir-print-outer-frame w-full h-full relative flex flex-col justify-between box-border"
        style={{
          boxSizing: "border-box",
          backgroundColor: "#ffffff",
          border: showOuter ? `${outerThickness}px solid ${outerColor}` : "none",
          borderRadius: `${outerRadius}px`,
          padding: `${pageMarginMm}mm`, // الهامش الداخلي للمحتوى
          height: "100%",
          maxHeight: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background Watermark (if provided) */}
        {settings.watermarkText && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 opacity-[0.035]">
            <span className="text-6xl font-black uppercase tracking-widest text-slate-900 -rotate-45">
              {settings.watermarkText}
            </span>
          </div>
        )}

        {/* Main Printable Document Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-between overflow-hidden min-w-0 h-full">
          {children}
        </div>
      </div>
    </div>
  );
};
