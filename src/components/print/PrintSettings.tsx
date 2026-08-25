import React from "react";
import { Memory } from "../../types";
import { PrintSettingsState, PaperSize, Orientation, MarginPreset, Density, HeaderStyle, WatermarkType } from "./printTypes";
import { Sliders, FileText, Layout, Type, Image as ImageIcon, CheckSquare, Layers, ShieldCheck } from "lucide-react";

interface PrintSettingsProps {
  settings: PrintSettingsState;
  onUpdateSettings: (updater: (prev: PrintSettingsState) => PrintSettingsState) => void;
  allMemories: Memory[];
  lang: "en" | "ar" | "fr";
}

export const PrintSettings: React.FC<PrintSettingsProps> = ({
  settings,
  onUpdateSettings,
  allMemories,
  lang,
}) => {
  const isRtl = lang === "ar";

  const handleToggleMemory = (id: string) => {
    onUpdateSettings((prev) => {
      const isSelected = prev.selectedMemoryIds.includes(id);
      return {
        ...prev,
        selectedMemoryIds: isSelected
          ? prev.selectedMemoryIds.filter((mId) => mId !== id)
          : [...prev.selectedMemoryIds, id],
      };
    });
  };

  const handleSelectAllMemories = () => {
    onUpdateSettings((prev) => ({
      ...prev,
      selectedMemoryIds: allMemories.map((m) => m.id),
    }));
  };

  const handleDeselectAllMemories = () => {
    onUpdateSettings((prev) => ({
      ...prev,
      selectedMemoryIds: [],
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: "companyLogoImg" | "signatureImg") => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        onUpdateSettings((prev) => ({
          ...prev,
          [field]: result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <aside
      className="zakir-print-modal-sidebar w-80 min-w-[320px] max-w-[340px] h-full bg-slate-900 text-slate-100 border-e border-slate-800 flex flex-col overflow-y-auto p-5 text-xs select-none"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-800 text-blue-400 font-bold">
        <Sliders className="w-4 h-4" />
        <span className="uppercase tracking-wider font-extrabold text-sm">
          {lang === "ar" ? "تنسيق وإعدادات التقرير" : "Report & Format Settings"}
        </span>
      </div>

      {/* 1. Page & Layout Geometry */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-[10px]">
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          <span>{lang === "ar" ? "مقاس الورق والاتجاه" : "Paper & Orientation"}</span>
        </div>

        {/* Paper Size */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5">
            {lang === "ar" ? "حجم الورقة:" : "Paper Size:"}
          </label>
          <div className="grid grid-cols-5 gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            {(["A4", "A3", "A5", "Letter", "Legal"] as PaperSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onUpdateSettings((p) => ({ ...p, pageSize: size }))}
                className={`py-1 rounded text-[10px] font-bold transition-all ${
                  settings.pageSize === size
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Orientation */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5">
            {lang === "ar" ? "اتجاه الصفحة:" : "Orientation:"}
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
            {(["portrait", "landscape"] as Orientation[]).map((orient) => (
              <button
                key={orient}
                type="button"
                onClick={() => onUpdateSettings((p) => ({ ...p, orientation: orient }))}
                className={`py-1.5 rounded text-[11px] font-bold capitalize transition-all ${
                  settings.orientation === orient
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
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
          <label className="block text-slate-400 font-medium mb-1.5">
            {lang === "ar" ? "الهوامش:" : "Margin Preset:"}
          </label>
          <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            {(["compact", "standard", "wide"] as MarginPreset[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onUpdateSettings((p) => ({ ...p, marginPreset: m }))}
                className={`py-1 rounded text-[10px] font-bold capitalize transition-all ${
                  settings.marginPreset === m
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Typography & Density */}
      <div className="space-y-4 mb-6 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-[10px]">
          <Type className="w-3.5 h-3.5 text-blue-400" />
          <span>{lang === "ar" ? "الكثافة والخط" : "Density & Typography"}</span>
        </div>

        {/* Density */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5">
            {lang === "ar" ? "كثافة التنسيق:" : "Content Density:"}
          </label>
          <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            {(["compact", "standard", "spacious"] as Density[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onUpdateSettings((p) => ({ ...p, density: d }))}
                className={`py-1 rounded text-[10px] font-bold capitalize transition-all ${
                  settings.density === d
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Columns */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5">
            {lang === "ar" ? "عدد الأعمدة:" : "Columns:"}
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => onUpdateSettings((p) => ({ ...p, columns: "1" }))}
              className={`py-1 rounded text-[10px] font-bold transition-all ${
                settings.columns === "1"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
              }`}
            >
              1 {lang === "ar" ? "عمود" : "Column"}
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings((p) => ({ ...p, columns: "2" }))}
              className={`py-1 rounded text-[10px] font-bold transition-all ${
                settings.columns === "2"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
              }`}
            >
              2 {lang === "ar" ? "عمودين" : "Columns"}
            </button>
          </div>
        </div>

        {/* Font Scale slider */}
        <div>
          <div className="flex justify-between text-slate-400 font-medium mb-1">
            <span>{lang === "ar" ? "حجم الخط النسبي:" : "Font Scale:"}</span>
            <span className="font-mono text-blue-400">{settings.fontScale}%</span>
          </div>
          <input
            type="range"
            min="80"
            max="130"
            step="5"
            value={settings.fontScale}
            onChange={(e) => onUpdateSettings((p) => ({ ...p, fontScale: Number(e.target.value) }))}
            className="w-full accent-blue-500 bg-slate-800 rounded cursor-pointer h-1.5"
          />
        </div>
      </div>

      {/* 3. Header & Branding */}
      <div className="space-y-4 mb-6 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-[10px]">
          <Layout className="w-3.5 h-3.5 text-blue-400" />
          <span>{lang === "ar" ? "الرأسية والرمز المؤسسي" : "Header & Branding"}</span>
        </div>

        {/* Header Style */}
        <div>
          <label className="block text-slate-400 font-medium mb-1.5">
            {lang === "ar" ? "نمط الرأسية:" : "Header Style:"}
          </label>
          <div className="grid grid-cols-3 gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            {(["standard", "centered", "letterhead"] as HeaderStyle[]).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => onUpdateSettings((p) => ({ ...p, headerStyle: h }))}
                className={`py-1 rounded text-[10px] font-bold capitalize transition-all ${
                  settings.headerStyle === h
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Company Name */}
        <div>
          <label className="block text-slate-400 font-medium mb-1">
            {lang === "ar" ? "اسم المؤسسة:" : "Organization Name:"}
          </label>
          <input
            type="text"
            value={settings.companyName}
            onChange={(e) => onUpdateSettings((p) => ({ ...p, companyName: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-medium text-xs"
          />
        </div>

        {/* Department Name */}
        <div>
          <label className="block text-slate-400 font-medium mb-1">
            {lang === "ar" ? "الإدارة / القسم:" : "Department / Division:"}
          </label>
          <input
            type="text"
            value={settings.departmentName}
            onChange={(e) => onUpdateSettings((p) => ({ ...p, departmentName: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-medium text-xs"
            placeholder={lang === "ar" ? "مثال: إدارة الاستراتيجية" : "e.g. Strategy & Intelligence"}
          />
        </div>

        {/* Custom Logo Upload */}
        <div>
          <label className="block text-slate-400 font-medium mb-1 flex items-center justify-between">
            <span>{lang === "ar" ? "الشعار المخصص:" : "Custom Logo:"}</span>
            {settings.companyLogoImg && (
              <button
                type="button"
                onClick={() => onUpdateSettings((p) => ({ ...p, companyLogoImg: null }))}
                className="text-rose-400 hover:text-rose-300 text-[10px] underline"
              >
                {lang === "ar" ? "إزالة" : "Remove"}
              </button>
            )}
          </label>
          <label className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-750 border border-dashed border-slate-700 hover:border-blue-500 rounded p-2 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors text-xs font-medium">
            <ImageIcon className="w-3.5 h-3.5" />
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

      {/* 4. Section Toggles */}
      <div className="space-y-2.5 mb-6 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-[10px] mb-1">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>{lang === "ar" ? "أقسام التقرير المضمنة" : "Included Content Sections"}</span>
        </div>

        <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.includeCausal}
            onChange={(e) => onUpdateSettings((p) => ({ ...p, includeCausal: e.target.checked }))}
            className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-800 w-4 h-4 cursor-pointer"
          />
          <span>{lang === "ar" ? "العوامل السببية" : "Causal Factors"}</span>
        </label>

        <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.includeOutcomes}
            onChange={(e) => onUpdateSettings((p) => ({ ...p, includeOutcomes: e.target.checked }))}
            className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-800 w-4 h-4 cursor-pointer"
          />
          <span>{lang === "ar" ? "النتائج والأثر" : "Outcomes & Impact"}</span>
        </label>

        <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.includeLessons}
            onChange={(e) => onUpdateSettings((p) => ({ ...p, includeLessons: e.target.checked }))}
            className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-800 w-4 h-4 cursor-pointer"
          />
          <span>{lang === "ar" ? "الدروس المستفادة والتوجيهات" : "Lessons Learned & Guidance"}</span>
        </label>

        <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.includeSignatureBlock}
            onChange={(e) => onUpdateSettings((p) => ({ ...p, includeSignatureBlock: e.target.checked }))}
            className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-800 w-4 h-4 cursor-pointer"
          />
          <span>{lang === "ar" ? "قسم الاعتماد والتوقيع الرسمي" : "Official Approval & Signature Block"}</span>
        </label>

        <label className="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.includeFooter}
            onChange={(e) => onUpdateSettings((p) => ({ ...p, includeFooter: e.target.checked }))}
            className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-800 w-4 h-4 cursor-pointer"
          />
          <span>{lang === "ar" ? "تذييل التقرير وأرقام الصفحات" : "Report Footer & Page Numbers"}</span>
        </label>
      </div>

      {/* 5. Memory Selector */}
      <div className="space-y-3 pt-4 border-t border-slate-800 mt-auto">
        <div className="flex items-center justify-between text-slate-300 font-bold">
          <div className="flex items-center gap-2 uppercase tracking-wider text-[10px]">
            <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
            <span>{lang === "ar" ? "سجلات الذكاء المحددة" : "Selected Memory Records"}</span>
          </div>
          <span className="text-blue-400 font-mono text-xs font-bold">
            {settings.selectedMemoryIds.length} / {allMemories.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAllMemories}
            className="flex-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold transition-colors"
          >
            {lang === "ar" ? "تحديد الكل" : "Select All"}
          </button>
          <button
            type="button"
            onClick={handleDeselectAllMemories}
            className="flex-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold transition-colors"
          >
            {lang === "ar" ? "إلغاء الكل" : "Deselect All"}
          </button>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-slate-800 rounded p-1.5 bg-slate-950/50">
          {allMemories.map((m) => {
            const isChecked = settings.selectedMemoryIds.includes(m.id);
            return (
              <label
                key={m.id}
                className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition-colors text-[11px] ${
                  isChecked ? "bg-blue-950/40 text-blue-200" : "text-slate-400 hover:bg-slate-800/60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleMemory(m.id)}
                  className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-800 w-3.5 h-3.5"
                />
                <span className="line-clamp-1 font-medium leading-tight">{m.title}</span>
              </label>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
