import React from "react";
import { getPaperGeometry } from "./printGeometry";
import { PrintSettingsState } from "./printTypes";
import { PrintWavyBorder } from "./PrintWavyBorder";

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
  const outerThickness = settings.outerBorderThickness || 3;
  const outerColor = settings.outerBorderColor || "#0f172a";
  const outerRadius = settings.outerBorderRadius || 0;

  // White Margin configuration (gap between outer and inner border)
  const whiteMarginMm = typeof settings.whiteMarginMm === "number" ? settings.whiteMarginMm : 10;

  // Inner Border configuration
  const showInner = settings.showInnerBorder !== false;
  const innerThickness = settings.innerBorderThickness || 1.5;
  const innerColor = settings.innerBorderColor || "#0f172a";
  const innerStyle = settings.innerBorderStyle || "solid";

  // Wavy Side Flourish configuration
  const showWavy = settings.showWavySideBorder !== false;
  const wavySide = settings.wavyBorderSide || "right";
  const wavyStyle = settings.wavyBorderStyle || "calligraphic";
  const wavyColor = settings.wavyBorderColor || outerColor;
  const wavyThickness = settings.wavyBorderThickness || 1.5;

  // Get CSS border style for inner frame
  const getInnerBorderCss = (): React.CSSProperties => {
    if (!showInner) return { border: "none" };

    if (innerStyle === "double") {
      return {
        borderStyle: "double",
        borderWidth: `${Math.max(3, innerThickness * 2.5)}px`,
        borderColor: innerColor,
      };
    }

    if (innerStyle === "dashed") {
      return {
        borderStyle: "dashed",
        borderWidth: `${innerThickness}px`,
        borderColor: innerColor,
      };
    }

    if (innerStyle === "decorative") {
      return {
        borderStyle: "solid",
        borderWidth: `${innerThickness}px`,
        borderColor: innerColor,
        outline: `1px solid ${innerColor}40`,
        outlineOffset: "3px",
      };
    }

    // Default: solid clean line
    return {
      borderStyle: "solid",
      borderWidth: `${innerThickness}px`,
      borderColor: innerColor,
    };
  };

  return (
    <div
      data-page-number={pageNumber}
      className={`page zakir-print-page bg-white text-slate-900 relative shadow-2xl transition-all duration-200 box-border print:shadow-none ${className}`}
      style={{
        width: `${geom.widthMm}mm`,
        minHeight: `${geom.heightMm}mm`,
        padding: "8mm", // Inset from actual physical paper edge
        backgroundColor: "#ffffff",
        color: "#0f172a",
        colorScheme: "light",
        boxSizing: "border-box",
        position: "relative",
        overflow: "visible",
      }}
    >
      {/* 1. OUTER THICK BORDER (الـ Outer Border السميك كما في الرسم) */}
      <div
        className="zakir-print-outer-frame w-full min-h-full h-auto relative flex flex-col justify-between box-border"
        style={{
          boxSizing: "border-box",
          backgroundColor: "#ffffff",
          border: showOuter ? `${outerThickness}px solid ${outerColor}` : "none",
          borderRadius: `${outerRadius}px`,
          padding: `${whiteMarginMm}mm`, // THE PURE WHITE BLANK MARGIN (الهامش الأبيض الفارغ تماماً بين الإطارين)
          minHeight: "100%",
          position: "relative",
          overflow: "visible",
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

        {/* 2. INNER BORDER (الإطار الداخلي الذي يحدد مساحة المحتوى) */}
        <div
          className="zakir-print-inner-frame w-full flex-1 flex flex-col justify-between relative box-border p-4 sm:p-5"
          style={{
            ...getInnerBorderCss(),
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
            position: "relative",
            minHeight: "100%",
            overflow: "visible",
          }}
        >
          {/* Inner Content Layout Wrapper with Optional Side Wavy Borders */}
          <div className="relative z-10 flex-1 flex flex-row items-stretch gap-3 overflow-visible">
            {/* Left Wavy Border (if enabled on left or both) */}
            {showWavy && (wavySide === "left" || wavySide === "both") && (
              <div className="shrink-0 flex items-center justify-center py-2 ps-1">
                <PrintWavyBorder
                  style={wavyStyle}
                  color={wavyColor}
                  thickness={wavyThickness}
                  side="left"
                />
              </div>
            )}

            {/* Main Printable Document Content */}
            <div className="flex-1 flex flex-col justify-between overflow-visible min-w-0">
              {children}
            </div>

            {/* Right Wavy Border & Flourishes (نّي ~~~~~~ نّي) (كما في الرسم المرفق) */}
            {showWavy && (wavySide === "right" || wavySide === "both") && (
              <div className="shrink-0 flex items-center justify-center py-2 pe-1">
                <PrintWavyBorder
                  style={wavyStyle}
                  color={wavyColor}
                  thickness={wavyThickness}
                  side="right"
                />
              </div>
            )}
          </div>

          {/* 3. BOTTOM CORNER PAGE MARKER ("P₁", "P₂" كما في الرسم اليدوي) */}
          {settings.showCornerPageMarkers !== false && pageNumber !== undefined && (
            <div
              className="page-corner-marker absolute -bottom-3 end-3 z-20 text-[11px] font-mono font-black text-slate-950 bg-white border border-slate-900 px-2 py-0.5 rounded shadow-xs select-none"
              style={{
                lineHeight: 1,
                backgroundColor: "#ffffff",
                color: outerColor,
                borderColor: outerColor,
              }}
            >
              P{pageNumber}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
