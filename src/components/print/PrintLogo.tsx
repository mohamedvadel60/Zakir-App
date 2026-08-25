import React from "react";
import { ZakirLogo } from "../ZakirLogo";

interface PrintLogoProps {
  companyLogoImg?: string | null;
  size?: "sm" | "md" | "lg";
  lang?: "ar" | "en" | "fr";
  className?: string;
}

export const PrintLogo: React.FC<PrintLogoProps> = ({
  companyLogoImg,
  size = "md",
  lang = "ar",
  className = "",
}) => {
  if (companyLogoImg) {
    const heightClass = size === "sm" ? "h-8" : size === "lg" ? "h-14" : "h-11";
    return (
      <img
        src={companyLogoImg}
        alt="Organization Logo"
        className={`object-contain max-w-[200px] ${heightClass} ${className}`}
      />
    );
  }

  const numericSize = size === "sm" ? 32 : size === "lg" ? 52 : 42;

  return (
    <div className={`flex items-center ${className}`}>
      <ZakirLogo theme="light" size={numericSize} lang={lang} />
    </div>
  );
};
