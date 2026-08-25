import React from "react";
import { PaperDimensions } from "./printTypes";

interface PrintPageProps {
  pageIndex: number;
  totalPages: number;
  geometry: PaperDimensions;
  children: React.ReactNode;
}

export const PrintPage: React.FC<PrintPageProps> = ({
  pageIndex,
  totalPages,
  geometry,
  children,
}) => {
  return (
    <div
      className="zakir-paper-sheet bg-white text-slate-900 rounded-sm mb-8 mx-auto flex flex-col justify-between transition-shadow relative overflow-hidden"
      style={{
        width: `${geometry.widthMm}mm`,
        height: `${geometry.heightMm}mm`,
        minWidth: `${geometry.widthMm}mm`,
        minHeight: `${geometry.heightMm}mm`,
        maxWidth: `${geometry.widthMm}mm`,
        maxHeight: `${geometry.heightMm}mm`,
        padding: `${geometry.marginMm}mm`,
        boxSizing: "border-box",
      }}
      data-page-index={pageIndex}
    >
      <div className="w-full h-full flex flex-col justify-between overflow-hidden relative">
        {children}
      </div>

      {/* Sheet Watermark & Corner Page Number Badge (Screen Preview Only) */}
      <div className="no-print absolute bottom-2 right-3 pointer-events-none select-none text-[7pt] font-mono text-slate-400 font-semibold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 opacity-60">
        {pageIndex} / {totalPages}
      </div>
    </div>
  );
};
