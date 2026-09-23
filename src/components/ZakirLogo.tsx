import React from "react";
import zakirLightLogo from "../assets/zakir-light-mode.svg";
import zakirDarkLogo from "../assets/zakir-dark-mode.svg";
import appIconSvg from "../assets/app-icon.svg";

interface ZakirLogoProps {
  className?: string;
  iconOnly?: boolean;
  showText?: boolean;
  theme?: "light" | "dark" | "custom" | "auto";
  size?: "sm" | "md" | "lg" | "xl" | number | string;
  lang?: "ar" | "en" | "fr";
  useSquareImage?: boolean;
}

export const ZakirLogo: React.FC<ZakirLogoProps> = ({
  className = "",
  iconOnly = false,
  showText = false,
  theme = "auto",
  size = "md",
}) => {
  let dimensions = { width: 140, height: 40 };

  if (size === "sm") {
    dimensions = iconOnly ? { width: 32, height: 32 } : { width: 100, height: 28 };
  } else if (size === "md") {
    dimensions = iconOnly ? { width: 40, height: 40 } : { width: 130, height: 36 };
  } else if (size === "lg") {
    dimensions = iconOnly ? { width: 48, height: 48 } : { width: 160, height: 44 };
  } else if (size === "xl") {
    dimensions = iconOnly ? { width: 64, height: 64 } : { width: 200, height: 56 };
  } else if (typeof size === "number") {
    dimensions = iconOnly 
      ? { width: size, height: size } 
      : { width: Math.round(size * 3.2), height: size };
  }

  if (iconOnly) {
    return (
      <div className={`inline-flex items-center justify-center select-none ${className}`}>
        <img
          src={appIconSvg}
          alt="Zakir App Icon"
          style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
          className="object-contain shrink-0 block"
        />
      </div>
    );
  }

  const textColorClass = theme === "light"
    ? "text-[#1c2c58]"
    : theme === "dark"
      ? "text-white"
      : "text-[#1c2c58] dark:text-white";

  const renderLogoImage = () => {
    if (theme === "light") {
      return (
        <img
          src={zakirLightLogo}
          alt="Zakir Logo"
          style={{ height: `${dimensions.height}px`, width: "auto" }}
          className="object-contain shrink-0 block dark:hidden"
        />
      );
    }
    if (theme === "dark") {
      return (
        <img
          src={zakirDarkLogo}
          alt="Zakir Logo"
          style={{ height: `${dimensions.height}px`, width: "auto" }}
          className="object-contain shrink-0 block light:hidden"
        />
      );
    }
    return (
      <>
        <img
          src={zakirLightLogo}
          alt="Zakir Logo"
          style={{ height: `${dimensions.height}px`, width: "auto" }}
          className="object-contain shrink-0 block dark:hidden"
        />
        <img
          src={zakirDarkLogo}
          alt="Zakir Logo"
          style={{ height: `${dimensions.height}px`, width: "auto" }}
          className="object-contain shrink-0 hidden dark:block"
        />
      </>
    );
  };

  // Full Logo Theme Resolution
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {renderLogoImage()}
      {showText && (
        <span className={`font-extrabold tracking-widest text-xl font-display uppercase ${textColorClass}`}>
          ZAKIR
        </span>
      )}
    </div>
  );
};

