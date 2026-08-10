import React from "react";
import zakirSquareLogo from "../assets/zakir-square-logo.png";

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
  lang = "en",
  useSquareImage = false,
}) => {
  const textThemeColor = 
    theme === "light" 
      ? "text-[#0F172A]" 
      : theme === "dark"
        ? "text-white"
        : "text-[var(--text-primary,#F8FAFC)]";

  const taglineThemeColor = 
    theme === "light" 
      ? "text-[#475569]" 
      : theme === "dark"
        ? "text-slate-400"
        : "text-[var(--text-secondary,#94A3B8)]";

  const borderThemeColor = 
    theme === "light" 
      ? "border-slate-300" 
      : theme === "dark"
        ? "border-slate-700"
        : "border-[var(--border-color,#334155)]";

  // Sizing definitions for a clean mathematical layout
  let iconWrapperClass = "w-10 h-10 rounded-xl";
  let svgSize: string | number = 28;
  let textClass = "text-xl";
  let taglineClass = "text-[10px] max-w-[150px]";
  let gapClass = "gap-3";
  let borderClass = "pl-3";
  let customStyle: React.CSSProperties = {};

  if (size === "sm") {
    iconWrapperClass = "w-8 h-8 rounded-lg";
    svgSize = 22;
    textClass = "text-base";
    taglineClass = "text-[8px] max-w-[110px]";
    gapClass = "gap-2";
    borderClass = "pl-2";
  } else if (size === "md") {
    iconWrapperClass = "w-10 h-10 rounded-xl";
    svgSize = 28;
    textClass = "text-xl";
    taglineClass = "text-[10px] max-w-[150px]";
    gapClass = "gap-3";
    borderClass = "pl-3";
  } else if (size === "lg") {
    iconWrapperClass = "w-12 h-12 rounded-2xl";
    svgSize = 34;
    textClass = "text-2xl";
    taglineClass = "text-[11px] max-w-[180px]";
    gapClass = "gap-4";
    borderClass = "pl-4";
  } else if (size === "xl") {
    iconWrapperClass = "w-16 h-16 rounded-3xl";
    svgSize = 46;
    textClass = "text-4xl";
    taglineClass = "text-[13px] max-w-[240px]";
    gapClass = "gap-5";
    borderClass = "pl-5";
  } else if (typeof size === "number") {
    svgSize = Math.round(size * 0.75);
    customStyle = { width: `${size}px`, height: `${size}px` };
    iconWrapperClass = "rounded-xl";
    textClass = size > 48 ? "text-2xl" : size > 36 ? "text-xl" : "text-base";
    taglineClass = size > 48 ? "text-[11px] max-w-[180px]" : "text-[9px] max-w-[130px]";
  } else {
    svgSize = size;
  }

  const renderOfficialSvgIcon = (iconSize: string | number) => {
    return (
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 1021.12 909.1"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-all duration-300 animate-fade-in"
      >
        <defs>
          <linearGradient id="zakir-official-grad" x1="17.47" y1="447.63" x2="984.67" y2="463.31" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0db4d7"/>
            <stop offset="1" stopColor="#f3ba1a"/>
          </linearGradient>
        </defs>
        <path fill="none" stroke="url(#zakir-official-grad)" strokeMiterlimit="10" strokeWidth="24px" d="M29.34,52.28c31.34-15.36,81.1-34.89,144.33-39.36,52.91-3.74,92.65,4.66,131.21,13.12,103.52,22.71,126.62,52.27,223.06,78.73,21.03,5.77,84.52,22.08,157.27,23.87,54.83,1.35,156.21-4.54,278.55-64.64,2.95-1.45,5.96,1.81,4.22,4.59-30.56,48.88-72.27,112.6-124.84,184.84-57.49,79.01-119.41,164.11-210.24,258.08-96.56,99.9-182.39,188.7-321.46,255.86-156.74,75.69-235.92,95.04-255.86,78.73-1.84-1.51-7.17-5.87-7.04-11.54.44-18.52,58.67-30.96,79.81-35.47,101.41-21.66,336.99,62.08,445.49,86.37h0c87.97,17.84,220.98,23.62,400.19-45.92"/>
        <g>
          <circle fill="#0db4d7" cx="41" cy="50.41" r="41"/>
          <circle fill="#f3ba1a" cx="555.16" cy="586.73" r="52.48"/>
          <circle fill="#0db4d7" cx="975.2" cy="836.03" r="45.92"/>
        </g>
      </svg>
    );
  };

  const renderLogoIcon = (iconSize: string | number) => {
    if (useSquareImage) {
      return (
        <img
          src={zakirSquareLogo}
          alt="Zakir Logo"
          className="object-contain transition-all duration-300 animate-fade-in"
          style={{ width: iconSize, height: iconSize }}
        />
      );
    }
    return renderOfficialSvgIcon(iconSize);
  };

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      {iconOnly ? (
        <div 
          style={typeof size === "number" ? customStyle : { width: svgSize, height: svgSize }} 
          className={`flex items-center justify-center transition-all duration-300`}
        >
          {renderLogoIcon(svgSize)}
        </div>
      ) : (
        <div className={`flex items-center ${gapClass}`}>
          <div 
            style={typeof size === "number" ? customStyle : {}}
            className={`${iconWrapperClass} ${
              theme === "light"
                ? "bg-slate-100 border border-slate-300"
                : "bg-slate-900/60 border border-[var(--border-color,#334155)]"
            } p-1.5 flex items-center justify-center shrink-0 shadow-sm`}
          >
            {renderLogoIcon(svgSize)}
          </div>
          <div className={`flex items-center border-l ${borderClass} ${borderThemeColor} ml-1`}>
            <span className={`${textClass} font-extrabold tracking-tight ${textThemeColor} uppercase`}>
              ZAKIR
            </span>
            <span className={`hidden sm:inline-block ml-3 ${taglineClass} uppercase tracking-widest ${taglineThemeColor} font-bold leading-tight`}>
              {lang === "ar" ? "الذاكرة المؤسسية السببية" : (lang === "fr" ? "La Mémoire Causale Organisationnelle" : "The Organizational Causal Memory")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
