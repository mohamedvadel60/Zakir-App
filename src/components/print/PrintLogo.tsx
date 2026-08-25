import React from "react";
import { ZakirLogo } from "../ZakirLogo";

interface PrintLogoProps {
  companyLogoImg?: string | null;
  logoSize?: "small" | "medium" | "large";
  lang?: "en" | "ar" | "fr";
  className?: string;
}

export const PrintLogo: React.FC<PrintLogoProps> = ({
  companyLogoImg,
  logoSize = "medium",
  lang = "en",
  className = "",
}) => {
  const heightPx = logoSize === "small" ? 32 : logoSize === "large" ? 56 : 44;
  const zakirSize = logoSize === "small" ? "sm" : logoSize === "large" ? "lg" : "md";

  if (companyLogoImg) {
    return (
      <img
        src={companyLogoImg}
        alt="Organization Logo"
        className={`zakir-print-logo object-contain ${className}`}
        style={{ maxHeight: `${heightPx}px`, height: "auto" }}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ZakirLogo theme="light" size={zakirSize} lang={lang} />
    </div>
  );
};
