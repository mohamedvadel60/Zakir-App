import React from "react";

interface PrintFooterProps {
  documentRef: string;
  lang: "en" | "ar" | "fr";
  pageIndex?: number; // 1-indexed for screen preview e.g. 1
  totalPages?: number; // Total pages count for screen preview e.g. 5
}

export const PrintFooter: React.FC<PrintFooterProps> = ({
  documentRef,
  lang,
  pageIndex,
  totalPages,
}) => {
  const isRtl = lang === "ar";

  const renderPageText = () => {
    if (pageIndex !== undefined && totalPages !== undefined && totalPages > 0) {
      if (lang === "ar") {
        return `الصفحة ${pageIndex} من ${totalPages}`;
      } else if (lang === "fr") {
        return `Page ${pageIndex} sur ${totalPages}`;
      } else {
        return `Page ${pageIndex} of ${totalPages}`;
      }
    } else if (pageIndex !== undefined) {
      if (lang === "ar") {
        return `الصفحة ${pageIndex}`;
      } else if (lang === "fr") {
        return `Page ${pageIndex}`;
      } else {
        return `Page ${pageIndex}`;
      }
    }

    // Dynamic CSS counter for browser native print
    return (
      <span className="zakir-page-counter-label zakir-page-number-target"></span>
    );
  };

  return (
    <footer 
      className="zakir-break-avoid w-full border-t border-slate-300 pt-3 mt-6 text-slate-500 text-[8pt] flex items-center justify-between select-none bg-white" 
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex items-center gap-3">
        <span className="font-mono font-bold text-slate-800 tracking-wider">ZAKIR INTELLIGENCE</span>
        <span>•</span>
        <span className="font-mono">{documentRef}</span>
      </div>

      <div className="flex items-center gap-2 font-mono text-slate-700 font-semibold">
        {renderPageText()}
      </div>
    </footer>
  );
};
