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
    <div className="flex flex-col items-center my-4 group select-none">
      {/* Page Header Indicator */}
      <div className="text-[10px] font-mono font-bold text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
        <span>Sheet {pageIndex} of {totalPages}</span>
        <span className="text-slate-600">•</span>
        <span className="text-slate-500">{geometry.widthMm}mm × {geometry.heightMm}mm</span>
      </div>

      {/* Physical Paper Sheet Frame */}
      <div
        className="zakir-paper-sheet bg-white text-slate-900 rounded-sm relative overflow-hidden transition-all duration-200"
        style={{
          width: `${geometry.widthMm}mm`,
          minHeight: `${geometry.heightMm}mm`,
          padding: `${geometry.marginMm}mm`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
