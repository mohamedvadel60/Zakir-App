import React from "react";
import { Memory } from "../../types";
import { PrintSettingsState, PaperSize, Orientation, MarginPreset, Density, PrintDiagnostics } from "./printTypes";
import { Sliders, Layout, Type, FileText, CheckSquare, Square, Upload, Trash2, Eye, ShieldAlert, Sparkles, Building2, UserCheck } from "lucide-react";

interface PrintSettingsProps {
  settings: PrintSettingsState;
  onUpdateSettings: (updater: (prev: PrintSettingsState) => PrintSettingsState) => void;
  allMemories: Memory[];
  selectedMemoryIds: string[];
  onToggleMemory: (memoryId: string) => void;
  onSelectAllMemories: () => void;
  onDeselectAllMemories: () => void;
  lang: "ar" | "en" | "fr";
  diagnostics?: PrintDiagnostics;
}

export const PrintSettings: React.FC<PrintSettingsProps> = ({
  settings,
  onUpdateSettings,
  allMemories,
  selectedMemoryIds,
  onToggleMemory,
  onSelectAllMemories,
  onDeselectAllMemories,
  lang,
  diagnostics,
}) => {
  const isRtl = lang === "ar";

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: "companyLogoImg" | "signatureImg") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) {
        onUpdateSettings((p) => ({ ...p, [field]: res }));
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside
      className="zakir-print-modal-sidebar w-80 min-w-[320px] max-w-[340px] h-full bg-slate-900 text-slate-100 border-e border-slate-800 flex flex-col overflow-y-auto p-5 text-xs select-none custom-scrollbar"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Title Header */}
      <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800 text-white font-bold text-sm">
        <Sliders className="w-4 h-4 text-[#0075DE]" />
        <span>{lang === "ar" ? "إعدادات وتنسيق التقرير" : "Report & Format Settings"}</span>
      </div>

      {/* Diagnostics Bar */}
      {diagnostics && (
        <div className="mb-4 p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>{lang === "ar" ? "المحدد:" : "Selected:"} <strong className="text-[#0075DE]">{diagnostics.selectedCount}</strong></span>
          <span>{lang === "ar" ? "الفريد:" : "Unique:"} <strong className="text-emerald-400">{diagnostics.uniqueCount}</strong></span>
          <span>{lang === "ar" ? "المعرض:" : "Rendered:"} <strong className="text-amber-400">{diagnostics.renderedCount}</strong></span>
        </div>
      )}

      {/* Section 1: Paper & Geometry */}
      <div className="space-y-3 mb-6">
        <h4 className="font-extrabold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
          <Layout className="w-3.5 h-3.5 text-[#0075DE]" />
          {lang === "ar" ? "مقاس الورق والاتجاه" : "Paper & Orientation"}
        </h4>

        {/* Paper Size */}
        <div>
          <label className="block text-slate-400 mb-1 font-medium text-[11px]">
            {lang === "ar" ? "حجم الورقة:" : "Paper Size:"}
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["A4", "A3", "A5", "Letter", "Legal"] as PaperSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onUpdateSettings((p) => ({ ...p, paperSize: size }))}
                className={`py-1.5 rounded text-[11px] font-bold border cursor-pointer transition-all ${
                  settings.paperSize === size
                    ? "bg-[#0075DE] text-white border-[#0075DE]"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Orientation */}
        <div>
          <label className="block text-slate-400 mb-1 font-medium text-[11px]">
            {lang === "ar" ? "اتجاه الصفحات:" : "Orientation:"}
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {(["portrait", "landscape"] as Orientation[]).map((orient) => (
              <button
                key={orient}
                type="button"
                onClick={() => onUpdateSettings((p) => ({ ...p, orientation: orient }))}
                className={`py-1.5 rounded text-[11px] font-bold border cursor-pointer transition-all ${
                  settings.orientation === orient
                    ? "bg-[#0075DE] text-white border-[#0075DE]"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                {orient === "portrait"
                  ? lang === "ar"
                    ? "عمودي (Portrait)"
                    : "Portrait"
                  : lang === "ar"
                  ? "أفقي (Landscape)"
                  : "Landscape"}
              </button>
            ))}
          </div>
        </div>

        {/* Margins */}
        <div>
          <label className="block text-slate-400 mb-1 font-medium text-[11px]">
            {lang === "ar" ? "هوامش الصفحات:" : "Page Margins:"}
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["compact", "normal", "wide"] as MarginPreset[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onUpdateSettings((p) => ({ ...p, margins: m }))}
                className={`py-1.5 rounded text-[10px] font-bold border cursor-pointer transition-all ${
                  settings.margins === m
                    ? "bg-[#0075DE] text-white border-[#0075DE]"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                {m === "compact"
                  ? lang === "ar"
                    ? "ضيقة"
                    : "Compact"
                  : m === "wide"
                  ? lang === "ar"
                    ? "واسطة"
                    : "Wide"
                  : lang === "ar"
                  ? "عادية"
                  : "Normal"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section 2: Typography & Density */}
      <div className="space-y-3 mb-6">
        <h4 className="font-extrabold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-[#0075DE]" />
          {lang === "ar" ? "الخط والكثافة البصرية" : "Typography & Density"}
        </h4>

        {/* Font Size */}
        <div>
          <label className="block text-slate-400 mb-1 font-medium text-[11px]">
            {lang === "ar" ? "حجم الخط:" : "Font Size:"}
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["small", "medium", "large"] as ("small" | "medium" | "large")[]).map((fs) => (
              <button
                key={fs}
                type="button"
                onClick={() => onUpdateSettings((p) => ({ ...p, fontSize: fs }))}
                className={`py-1.5 rounded text-[10px] font-bold border cursor-pointer transition-all ${
                  settings.fontSize === fs
                    ? "bg-[#0075DE] text-white border-[#0075DE]"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                {fs === "small"
                  ? lang === "ar"
                    ? "صغير"
                    : "Small"
                  : fs === "large"
                  ? lang === "ar"
                    ? "كبير"
                    : "Large"
                  : lang === "ar"
                  ? "متوسط"
                  : "Medium"}
              </button>
            ))}
          </div>
        </div>

        {/* Density */}
        <div>
          <label className="block text-slate-400 mb-1 font-medium text-[11px]">
            {lang === "ar" ? "كثافة المسافات:" : "Content Spacing:"}
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["compact", "comfortable", "spacious"] as Density[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onUpdateSettings((p) => ({ ...p, density: d }))}
                className={`py-1.5 rounded text-[10px] font-bold border cursor-pointer transition-all ${
                  settings.density === d
                    ? "bg-[#0075DE] text-white border-[#0075DE]"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                {d === "compact"
                  ? lang === "ar"
                    ? "مكثف"
                    : "Compact"
                  : d === "spacious"
                  ? lang === "ar"
                    ? "متسع"
                    : "Spacious"
                  : lang === "ar"
                  ? "مريح"
                  : "Comfortable"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Institutional Branding & Text Fields */}
      <div className="space-y-3 mb-6">
        <h4 className="font-extrabold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-[#0075DE]" />
          {lang === "ar" ? "بيانات المؤسسة والتقرير" : "Institutional Branding"}
        </h4>

        <div>
          <label className="block text-slate-400 mb-0.5 text-[10px]">
            {lang === "ar" ? "اسم المنظمة / الشركة:" : "Organization Name:"}
          </label>
          <input
            type="text"
            value={settings.companyName}
            onChange={(e) => onUpdateSettings((p) => ({ ...p, companyName: e.target.value }))}
            className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-[11px] focus:outline-none focus:border-[#0075DE]"
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-0.5 text-[10px]">
            {lang === "ar" ? "الإدارة / القسم:" : "Department / Division:"}
          </label>
          <input
            type="text"
            value={settings.departmentName}
            onChange={(e) => onUpdateSettings((p) => ({ ...p, departmentName: e.target.value }))}
            className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-[11px] focus:outline-none focus:border-[#0075DE]"
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-0.5 text-[10px]">
            {lang === "ar" ? "عنوان التقرير الرسمي:" : "Report Title:"}
          </label>
          <input
            type="text"
            value={settings.reportTitle}
            onChange={(e) => onUpdateSettings((p) => ({ ...p, reportTitle: e.target.value }))}
            className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-[11px] focus:outline-none focus:border-[#0075DE]"
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-0.5 text-[10px]">
            {lang === "ar" ? "الرقم المرجعي (Ref Code):" : "Document Reference:"}
          </label>
          <input
            type="text"
            value={settings.docRefNumber}
            onChange={(e) => onUpdateSettings((p) => ({ ...p, docRefNumber: e.target.value }))}
            className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded font-mono text-slate-100 text-[11px] focus:outline-none focus:border-[#0075DE]"
          />
        </div>

        {/* Custom Logo Upload */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-slate-400 text-[10px]">{lang === "ar" ? "الشعار المخصص:" : "Custom Logo:"}</label>
            {settings.companyLogoImg && (
              <button
                type="button"
                onClick={() => onUpdateSettings((p) => ({ ...p, companyLogoImg: null }))}
                className="text-rose-400 hover:text-rose-300 text-[9px] cursor-pointer"
              >
                {lang === "ar" ? "إزالة" : "Remove"}
              </button>
            )}
          </div>
          <label className="h-8 px-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded flex items-center justify-center gap-2 cursor-pointer text-slate-300 text-[10px]">
            <Upload className="w-3.5 h-3.5 text-[#0075DE]" />
            <span>{settings.companyLogoImg ? (lang === "ar" ? "تغيير الشعار" : "Change Logo") : (lang === "ar" ? "رفع شعار المؤسسة" : "Upload Logo Image")}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e, "companyLogoImg")}
            />
          </label>
        </div>
      </div>

      {/* Section 4: Signature & Validation */}
      <div className="space-y-3 mb-6">
        <h4 className="font-extrabold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-[#0075DE]" />
          {lang === "ar" ? "الاعتماد والتوقيع الرسمي" : "Approval & Validation"}
        </h4>

        {/* Toggle Signature Section */}
        <label className="flex items-center justify-between cursor-pointer p-2 bg-slate-950 border border-slate-800 rounded">
          <span className="font-bold text-slate-300 text-[11px]">
            {lang === "ar" ? "عرض قسم الاعتماد والتوقيع" : "Show Official Approval Block"}
          </span>
          <input
            type="checkbox"
            checked={settings.showSignature}
            onChange={(e) => onUpdateSettings((p) => ({ ...p, showSignature: e.target.checked }))}
            className="w-4 h-4 accent-[#0075DE] cursor-pointer"
          />
        </label>

        {settings.showSignature && (
          <div className="space-y-2 pt-1">
            <div>
              <label className="block text-slate-400 mb-0.5 text-[10px]">
                {lang === "ar" ? "اسم الشخص المعتمد:" : "Approver Name:"}
              </label>
              <input
                type="text"
                value={settings.approverName}
                onChange={(e) => onUpdateSettings((p) => ({ ...p, approverName: e.target.value }))}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-[11px] focus:outline-none focus:border-[#0075DE]"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-0.5 text-[10px]">
                {lang === "ar" ? "تاريخ الاعتماد:" : "Approval Date:"}
              </label>
              <input
                type="date"
                value={settings.approvalDate}
                onChange={(e) => onUpdateSettings((p) => ({ ...p, approvalDate: e.target.value }))}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-[11px] focus:outline-none focus:border-[#0075DE]"
              />
            </div>

            {/* Signature Image Upload */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-400 text-[10px]">{lang === "ar" ? "صورة التوقيع:" : "Signature Image:"}</label>
                {settings.signatureImg && (
                  <button
                    type="button"
                    onClick={() => onUpdateSettings((p) => ({ ...p, signatureImg: null }))}
                    className="text-rose-400 hover:text-rose-300 text-[9px] cursor-pointer"
                  >
                    {lang === "ar" ? "إزالة" : "Remove"}
                  </button>
                )}
              </div>
              <label className="h-8 px-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded flex items-center justify-center gap-2 cursor-pointer text-slate-300 text-[10px]">
                <Upload className="w-3.5 h-3.5 text-[#0075DE]" />
                <span>{settings.signatureImg ? (lang === "ar" ? "تغيير التوقيع" : "Change Signature") : (lang === "ar" ? "رفع صورة التوقيع" : "Upload Signature Image")}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, "signatureImg")}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Section 5: Section Toggles */}
      <div className="space-y-2 mb-6">
        <h4 className="font-extrabold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5 mb-2">
          <Eye className="w-3.5 h-3.5 text-[#0075DE]" />
          {lang === "ar" ? "مكونات وحقول المستند" : "Document Section Toggles"}
        </h4>

        {[
          { key: "showHeader", labelAr: "الترويسة الرسمية", labelEn: "Official Header" },
          { key: "showFooter", labelAr: "التذييل ورقم الصفحة", labelEn: "Official Footer & Page Numbers" },
          { key: "showRiskBadges", labelAr: "شارات مستوى المخاطر", labelEn: "Risk Level Badges" },
          { key: "showCausalFactors", labelAr: "المسببات والعوامل المباشرة", labelEn: "Causal Factors Section" },
          { key: "showOutcomes", labelAr: "النتائج والأثر المترتب", labelEn: "Outcomes Section" },
          { key: "showLessonsLearned", labelAr: "الدروس المستفادة والتطوير", labelEn: "Lessons Learned Section" },
          { key: "showTags", labelAr: "الوسوم والتصنيفات", labelEn: "Memory Tags" },
          { key: "showMetadata", labelAr: "بيانات المسجل والدور", labelEn: "Author & Logged Meta" },
        ].map((item) => (
          <label
            key={item.key}
            className="flex items-center justify-between cursor-pointer p-1.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 rounded transition-all"
          >
            <span className="text-slate-300 text-[11px] font-medium">
              {lang === "ar" ? item.labelAr : item.labelEn}
            </span>
            <input
              type="checkbox"
              checked={Boolean((settings as any)[item.key])}
              onChange={(e) =>
                onUpdateSettings((p) => ({ ...p, [item.key]: e.target.checked }))
              }
              className="w-3.5 h-3.5 accent-[#0075DE] cursor-pointer"
            />
          </label>
        ))}
      </div>

      {/* Section 6: Selected Memories Checklist */}
      <div className="space-y-2 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-extrabold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#0075DE]" />
            {lang === "ar" ? "اختيار الذكريات للتقرير" : "Select Report Memories"} ({selectedMemoryIds.length}/{allMemories.length})
          </h4>
          <div className="flex items-center gap-2 text-[9px]">
            <button
              type="button"
              onClick={onSelectAllMemories}
              className="text-[#0075DE] hover:underline cursor-pointer font-bold"
            >
              {lang === "ar" ? "الكل" : "All"}
            </button>
            <span className="text-slate-700">|</span>
            <button
              type="button"
              onClick={onDeselectAllMemories}
              className="text-rose-400 hover:underline cursor-pointer font-bold"
            >
              {lang === "ar" ? "إلغاء" : "None"}
            </button>
          </div>
        </div>

        <div className="max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded p-2 space-y-1 custom-scrollbar">
          {allMemories.map((m) => {
            const isSelected = selectedMemoryIds.includes(m.id);
            return (
              <label
                key={m.id}
                className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition-all text-[10px] ${
                  isSelected ? "bg-[#0075DE]/10 text-white" : "hover:bg-slate-900 text-slate-400"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleMemory(m.id)}
                  className="mt-0.5 w-3.5 h-3.5 accent-[#0075DE] cursor-pointer"
                />
                <span className="line-clamp-1 font-medium flex-1">{m.title}</span>
              </label>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
