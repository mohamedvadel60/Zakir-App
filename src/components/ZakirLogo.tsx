import React from "react";
import zakirOfficialLogo from "../assets/zakir-official-logo.png";

interface ZakirLogoProps {
  className?: string;
  iconOnly?: boolean;
  theme?: "light" | "dark" | "custom" | "auto";
  size?: "sm" | "md" | "lg" | "xl" | number | string;
  lang?: "ar" | "en" | "fr";
  useSquareImage?: boolean;
}

export const ZakirLogo: React.FC<ZakirLogoProps> = ({
  className = "",
  iconOnly = false,
  theme = "auto",
  size = "md",
  useSquareImage = false,
}) => {
  const textThemeColor = 
    theme === "light" 
      ? "text-slate-900" 
      : theme === "dark"
        ? "text-white"
        : "text-slate-900 dark:text-white";

  // Sizing definitions for a clean mathematical layout
  let iconWrapperClass = "w-10 h-10 rounded-xl";
  let svgSize: string | number = 28;
  let textClass = "text-xl";
  let gapClass = "gap-3";
  let customStyle: React.CSSProperties = {};

  if (size === "sm") {
    iconWrapperClass = "w-8 h-8 rounded-lg";
    svgSize = 22;
    textClass = "text-base";
    gapClass = "gap-2";
  } else if (size === "md") {
    iconWrapperClass = "w-10 h-10 rounded-xl";
    svgSize = 28;
    textClass = "text-xl";
    gapClass = "gap-3";
  } else if (size === "lg") {
    iconWrapperClass = "w-12 h-12 rounded-2xl";
    svgSize = 34;
    textClass = "text-2xl";
    gapClass = "gap-4";
  } else if (size === "xl") {
    iconWrapperClass = "w-16 h-16 rounded-3xl";
    svgSize = 46;
    textClass = "text-4xl";
    gapClass = "gap-5";
  } else if (typeof size === "number") {
    svgSize = Math.round(size * 0.75);
    customStyle = { width: `${size}px`, height: `${size}px` };
    iconWrapperClass = "rounded-xl";
    textClass = size > 48 ? "text-2xl" : size > 36 ? "text-xl" : "text-base";
  } else {
    svgSize = size;
  }

  const renderLogoIcon = (iconSize: string | number) => {
    return (
      <img
        src={zakirOfficialLogo}
        alt="Zakir"
        className={`object-contain shrink-0 block ${useSquareImage ? "" : "scale-[.92]"}`}
        style={{ width: iconSize, height: iconSize }}
      />
    );
  };

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      {iconOnly ? (
        <div 
          style={typeof size === "number" ? customStyle : { width: svgSize, height: svgSize }} 
          className={`flex items-center justify-center`}
        >
          {renderLogoIcon(svgSize)}
        </div>
      ) : (
        <div className={`flex items-center ${gapClass}`}>
          <div 
            style={typeof size === "number" ? customStyle : {}}
            className={`${iconWrapperClass} ${
              theme === "light"
                ? "bg-white border border-slate-200"
                : "bg-slate-900/60 border border-[var(--border-color,#334155)]"
            } p-1.5 flex items-center justify-center shrink-0 shadow-sm`}
          >
            {renderLogoIcon(svgSize)}
          </div>
          <div className="flex items-center">
            <span className={`${textClass} font-extrabold tracking-tight ${textThemeColor} uppercase`}>
              ZAKIR
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
