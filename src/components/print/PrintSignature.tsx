import React from "react";

interface PrintSignatureProps {
  isVisible: boolean;
  lang: "en" | "ar" | "fr";
  displayDate: string;
  userName?: string;
  documentRef: string;
  signatureImg?: string | null;
  includeVerificationSeal?: boolean;
}

export const PrintSignature: React.FC<PrintSignatureProps> = ({
  isVisible,
  lang,
  displayDate,
  userName,
  documentRef,
  signatureImg,
  includeVerificationSeal = true,
}) => {
  if (!isVisible) return null;

  const isRtl = lang === "ar";
  const dateVal = displayDate || new Date().toLocaleDateString(isRtl ? "ar-SA" : "en-US");

  const titleText = lang === "ar"
    ? "اعتماد وتوثيق التقرير الرسمي"
    : lang === "fr"
    ? "VALIDATION OFFICIELLE DU RAPPORT"
    : "OFFICIAL REPORT VALIDATION";

  const signatureLabel = lang === "ar"
    ? "التوقيع والختم المعتمد"
    : lang === "fr"
    ? "SIGNATURE AUTORISÉE"
    : "AUTHORIZED SIGNATURE";

  const dateLabel = lang === "ar"
    ? "تاريخ الاعتماد والمصادقة"
    : lang === "fr"
    ? "DATE D'APPROBATION"
    : "APPROVAL DATE & AUTH";

  const placeholderText = lang === "ar"
    ? "التوقيع اليدوي أو الرقمي هنا"
    : lang === "fr"
    ? "Signature Manuelle / Numérique"
    : "Manual / Digital Signature";

  return (
    <div 
      className="zakir-signature-block zakir-break-avoid w-full mt-6 pt-4 border-t-2 border-slate-300 select-none bg-white" 
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-900"></span>
          <span className="text-[9.5pt] font-black text-slate-950 uppercase tracking-wide">
            {titleText}
          </span>
        </div>
        {includeVerificationSeal && (
          <div className="flex items-center gap-1 text-[8pt] text-slate-600 font-mono">
            <span>[ SECURE HASH: {documentRef.slice(-6)} ]</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5 w-full text-[8.5pt]">
        {/* Column 1: Signature */}
        <div className="flex flex-col justify-between min-h-[95px] border border-slate-300 rounded-lg p-3 bg-slate-50/70">
          <span className="text-[7.5pt] font-black uppercase text-slate-600 tracking-wider">
            {signatureLabel}
          </span>
          <div className="pt-2 border-t border-slate-200 w-full mt-auto flex flex-col justify-end min-h-[40px]">
            <div className="flex justify-center items-center h-9 w-full">
              {signatureImg ? (
                <img 
                  src={signatureImg} 
                  alt="Signature" 
                  className="h-9 object-contain block" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <span className="text-[8pt] text-slate-400 font-bold italic">
                  {placeholderText}
                </span>
              )}
            </div>
            <div className="border-b border-slate-400 w-full"></div>
          </div>
        </div>

        {/* Column 2: Approval Date & Approver */}
        <div className="flex flex-col justify-between min-h-[95px] border border-slate-300 rounded-lg p-3 bg-slate-50/70">
          <div className="flex items-center justify-between">
            <span className="text-[7.5pt] font-black uppercase text-slate-600 tracking-wider">
              {dateLabel}
            </span>
            {userName && (
              <span className="text-[7.5pt] text-slate-700 font-bold">
                {userName}
              </span>
            )}
          </div>
          <div className="pt-2 border-t border-slate-200 w-full mt-auto flex flex-col justify-end min-h-[40px]">
            <div className="flex justify-center items-end pb-1 h-9 w-full">
              <span className="text-[9pt] font-black text-slate-950 font-mono leading-none">
                {dateVal}
              </span>
            </div>
            <div className="border-b border-slate-400 w-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
