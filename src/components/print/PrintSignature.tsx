import React from "react";
import { PrintSettingsState } from "./printTypes";

interface PrintSignatureProps {
  settings: PrintSettingsState;
  lang: "ar" | "en" | "fr";
}

export const PrintSignature: React.FC<PrintSignatureProps> = ({ settings, lang }) => {
  if (!settings.showSignature) return null;

  const isRtl = lang === "ar";

  const getTitle = () => {
    if (lang === "ar") return "اعتماد وتصديق التقرير المؤسسي";
    if (lang === "fr") return "Validation et Approbation Officielle";
    return "Official Report Approval & Authorization";
  };

  const getApproverLabel = () => {
    if (lang === "ar") return "اسم المسؤول المعتمد:";
    if (lang === "fr") return "Nom de l'approbateur :";
    return "Authorized Approver:";
  };

  const getDateLabel = () => {
    if (lang === "ar") return "تاريخ الاعتماد والتوقيع:";
    if (lang === "fr") return "Date d'approbation :";
    return "Approval Date:";
  };

  const getStampLabel = () => {
    if (lang === "ar") return "التوقيع والختم الرسمي:";
    if (lang === "fr") return "Signature et Cachet :";
    return "Signature & Official Stamp:";
  };

  return (
    <section className="mt-10 pt-6 border-t-2 border-slate-300 bg-slate-50/50 p-5 rounded-xl text-slate-900 break-inside-avoid" dir={isRtl ? "rtl" : "ltr"}>
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-4 pb-1 border-b border-slate-200">
        {getTitle()}
      </h3>

      <div className="grid grid-cols-2 gap-8 items-end">
        {/* Approver Info & Date */}
        <div className="space-y-3">
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase">{getApproverLabel()}</span>
            <p className="text-xs font-bold text-slate-900 mt-0.5">
              {settings.approverName || (lang === "ar" ? "د. محمد الأحمد - رئيس لجنة الحوكمة" : "Dr. M. Al-Ahmad - Governance Chair")}
            </p>
          </div>

          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase">{getDateLabel()}</span>
            <p className="text-xs font-mono font-bold text-slate-800 mt-0.5">
              {settings.approvalDate || new Date().toISOString().split("T")[0]}
            </p>
          </div>
        </div>

        {/* Signature Box / Stamp */}
        <div className="text-end border-s border-slate-200 ps-6">
          <span className="block text-[10px] font-bold text-slate-500 uppercase mb-2">{getStampLabel()}</span>
          {settings.signatureImg ? (
            <img
              src={settings.signatureImg}
              alt="Official Signature"
              className="h-14 object-contain ms-auto"
            />
          ) : (
            <div className="h-14 border-b-2 border-dashed border-slate-400 flex items-end justify-end pb-1">
              <span className="text-[10px] font-mono text-slate-400 italic">
                {lang === "ar" ? "[توقيع المعتمد]" : "[Authorized Signature]"}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
