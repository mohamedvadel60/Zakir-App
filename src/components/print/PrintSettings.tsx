import React, { useMemo } from "react";
import { Memory } from "../../types";
import { PrintSettingsState, PaperSize, Orientation, MarginPreset, Density, FontSize, HeaderStyle, WatermarkType } from "./printTypes";
import { Sliders, FileText, Building2, CheckSquare, Square, RotateCcw, Check, Upload, Trash2 } from "lucide-react";

interface PrintSettingsProps {
  memories: Memory[];
  settings: PrintSettingsState;
  onUpdateSettings: (updater: (prev: PrintSettingsState) => PrintSettingsState) => void;
  lang: "en" | "ar" | "fr";
}

export const PrintSettings: React.FC<PrintSettingsProps> = ({
  memories,
  settings,
  onUpdateSettings,
  lang,
}) => {
  const isRtl = lang === "ar";

  const categories = useMemo(() => {
    return Array.from(new Set(memories.map((m) => m.category))).filter(Boolean);
  }, [memories]);

  const [categoryFilter, setCategoryFilter] = React.useState("all");

  const filteredMemories = useMemo(() => {
    if (categoryFilter === "all") return memories;
    return memories.filter((m) => m.category === categoryFilter);
  }, [memories, categoryFilter]);

  const toggleSelectAll = () => {
    if (settings.selectedMemoryIds.length === filteredMemories.length) {
      onUpdateSettings((prev) => ({ ...prev, selectedMemoryIds: [] }));
    } else {
      onUpdateSettings((prev) => ({
        ...prev,
        selectedMemoryIds: filteredMemories.map((m) => m.id),
      }));
    }
  };

  const toggleSelectMemory = (id: string) => {
    onUpdateSettings((prev) => ({
      ...prev,
      selectedMemoryIds: prev.selectedMemoryIds.includes(id)
        ? prev.selectedMemoryIds.filter((i) => i !== id)
        : [...prev.selectedMemoryIds, id],
    }));
  };

  const handleResetDefaults = () => {
    onUpdateSettings((prev) => ({
      ...prev,
      pageSize: "A4",
      orientation: "portrait",
      marginPreset: "standard",
      customMarginMm: 18,
      density: "standard",
      fontSize: "medium",
      fontScale: 100,
      lineSpacing: 1.2,
      columns: "1",
      headerStyle: "standard",
      logoSize: "medium",
      watermark: "none",
      includeHeader: true,
      includeFooter: true,
      includeCausal: true,
      includeOutcomes: true,
      includeLessons: true,
      includeAuthor: true,
      includeTags: true,
      includeSignatureBlock: true,
      includeVerificationSeal: true,
    }));
  };

  return (
    <div className="no-print space-y-5 p-4 sm:p-5 bg-slate-950/80 overflow-y-auto max-h-full text-slate-100" dir={isRtl ? "rtl" : "ltr"}>
      {/* 1. Memory Records Selector */}
      <div className="space-y-3 bg-slate-900/90 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            <span>
              {lang === "ar"
                ? "اختيار الذكريات المطبوعة"
                : lang === "fr"
                ? "Sélectionner les enregistrements"
                : "Select Memory Records"}
            </span>
          </span>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-[11px] text-blue-400 hover:underline font-semibold cursor-pointer"
          >
            {lang === "ar" ? "تحديد الكل" : "Select All"} ({settings.selectedMemoryIds.length}/{filteredMemories.length})
          </button>
        </div>

        {categories.length > 1 && (
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">
                {lang === "ar" ? "كل الفئات والأقسام" : "All Categories"}
              </option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Memory Checkbox List */}
        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
          {filteredMemories.map((m) => {
            const isSelected = settings.selectedMemoryIds.includes(m.id);
            return (
              <div
                key={m.id}
                onClick={() => toggleSelectMemory(m.id)}
                className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                  isSelected
                    ? "bg-blue-500/15 border-blue-500/40 text-blue-100"
                    : "bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div className="overflow-hidden">
                  <div className="font-semibold truncate text-[11px]">{m.title}</div>
                  <div className="text-[9px] text-slate-500 font-mono truncate">
                    {m.category} • {m.riskLevel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Paper Geometry & Layout Settings */}
      <div className="space-y-4 bg-slate-900/90 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
            <Sliders className="w-4 h-4" />
            <span>
              {lang === "ar" ? "تنسيق الورق والصفحة" : "Paper & Layout Geometry"}
            </span>
          </span>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3 h-3 text-rose-400" />
            <span>{lang === "ar" ? "افتراضي" : "Reset"}</span>
          </button>
        </div>

        {/* Paper Size & Orientation */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
              {lang === "ar" ? "حجم الورقة:" : "Paper Size:"}
            </label>
            <select
              value={settings.pageSize}
              onChange={(e) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  pageSize: e.target.value as PaperSize,
                }))
              }
              className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="A4">A4 (210 × 297 mm)</option>
              <option value="A3">A3 (297 × 420 mm)</option>
              <option value="A5">A5 (148 × 210 mm)</option>
              <option value="Letter">Letter (8.5 × 11 in)</option>
              <option value="Legal">Legal (8.5 × 14 in)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
              {lang === "ar" ? "اتجاه الورقة:" : "Orientation:"}
            </label>
            <select
              value={settings.orientation}
              onChange={(e) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  orientation: e.target.value as Orientation,
                }))
              }
              className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="portrait">{lang === "ar" ? "عمودي (Portrait)" : "Portrait"}</option>
              <option value="landscape">{lang === "ar" ? "أفقي (Landscape)" : "Landscape"}</option>
            </select>
          </div>
        </div>

        {/* Paper Margins */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
            {lang === "ar" ? "هوامش الورقة:" : "Margins Preset:"}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "compact", label: lang === "ar" ? "ضيق (10mm)" : "Compact (10mm)", val: 10 },
              { id: "standard", label: lang === "ar" ? "قياسي (18mm)" : "Standard (18mm)", val: 18 },
              { id: "wide", label: lang === "ar" ? "عريض (25mm)" : "Wide (25mm)", val: 25 },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    marginPreset: m.id as MarginPreset,
                    customMarginMm: m.val,
                  }))
                }
                className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                  settings.marginPreset === m.id
                    ? "bg-blue-600 text-white border-blue-500"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Spacing Density */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
            {lang === "ar" ? "الكثافة والتباعد:" : "Spacing Density:"}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["compact", "standard", "spacious"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    density: d as Density,
                  }))
                }
                className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer capitalize ${
                  settings.density === d
                    ? "bg-blue-600 text-white border-blue-500"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Font Size & Line Spacing */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
              {lang === "ar" ? "تباعد الأسطر:" : "Line Spacing:"}
            </label>
            <select
              value={settings.lineSpacing}
              onChange={(e) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  lineSpacing: parseFloat(e.target.value),
                }))
              }
              className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="1.0">1.0 ({lang === "ar" ? "مفرد" : "Single"})</option>
              <option value="1.2">1.2 ({lang === "ar" ? "افتراضي" : "Default"})</option>
              <option value="1.5">1.5 ({lang === "ar" ? "متوسط" : "1.5"})</option>
              <option value="1.8">1.8 ({lang === "ar" ? "مزدوج" : "Double"})</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
              {lang === "ar" ? "الأعمدة:" : "Columns:"}
            </label>
            <select
              value={settings.columns}
              onChange={(e) =>
                onUpdateSettings((prev) => ({
                  ...prev,
                  columns: e.target.value as "1" | "2",
                }))
              }
              className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="1">{lang === "ar" ? "عمود واحد" : "1 Column"}</option>
              <option value="2">{lang === "ar" ? "عمودان" : "2 Columns"}</option>
            </select>
          </div>
        </div>

        {/* Font Scale Slider */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center text-[10px] text-slate-400">
            <span>{lang === "ar" ? "مقياس الخط:" : "Font Scale:"}</span>
            <span className="font-mono text-blue-400 font-bold">{settings.fontScale}%</span>
          </div>
          <input
            type="range"
            min="75"
            max="140"
            value={settings.fontScale}
            onChange={(e) =>
              onUpdateSettings((prev) => ({
                ...prev,
                fontScale: parseInt(e.target.value, 10),
              }))
            }
            className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>

      {/* 3. Branding & Header Controls */}
      <div className="space-y-3 bg-slate-900/90 border border-slate-800 rounded-xl p-4">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
          <Building2 className="w-4 h-4" />
          <span>{lang === "ar" ? "هوية التقرير وترويسة المؤسسة" : "Branding & Header Style"}</span>
        </span>

        {/* Department Name */}
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-slate-400">
            {lang === "ar" ? "اسم الإدارة / القطاع:" : "Department Name:"}
          </label>
          <input
            type="text"
            value={settings.departmentName}
            onChange={(e) =>
              onUpdateSettings((prev) => ({
                ...prev,
                departmentName: e.target.value,
              }))
            }
            className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            placeholder={lang === "ar" ? "اسم الإدارة..." : "Department Name..."}
          />
        </div>

        {/* Document Reference ID */}
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-slate-400">
            {lang === "ar" ? "رقم مرجع التوثيق:" : "Document Reference ID:"}
          </label>
          <input
            type="text"
            value={settings.documentRef}
            onChange={(e) =>
              onUpdateSettings((prev) => ({
                ...prev,
                documentRef: e.target.value,
              }))
            }
            className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-blue-400 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Header Style */}
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 mb-1">
            {lang === "ar" ? "تصميم الترويسة:" : "Header Layout:"}
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "standard", label: lang === "ar" ? "قياسية" : "Standard" },
              { id: "centered", label: lang === "ar" ? "مركزية" : "Centered" },
              { id: "letterhead", label: lang === "ar" ? "خطاب" : "Letterhead" },
            ].map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    headerStyle: style.id as HeaderStyle,
                  }))
                }
                className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                  settings.headerStyle === style.id
                    ? "bg-blue-600 text-white border-blue-500"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Logo Upload & Size */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-semibold text-slate-400">
              {lang === "ar" ? "حجم الشعار:" : "Logo Size:"}
            </label>
            <div className="flex gap-1">
              {(["small", "medium", "large"] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() =>
                    onUpdateSettings((prev) => ({ ...prev, logoSize: sz }))
                  }
                  className={`px-2 py-0.5 text-[9px] font-bold rounded border transition-all cursor-pointer uppercase ${
                    settings.logoSize === sz
                      ? "bg-blue-500/20 text-blue-400 border-blue-500"
                      : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300"
                  }`}
                >
                  {sz[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*"
              id="print-settings-logo-upload"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const base64 = ev.target?.result as string;
                    onUpdateSettings((prev) => ({ ...prev, companyLogoImg: base64 }));
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            <label
              htmlFor="print-settings-logo-upload"
              className="flex-1 py-1.5 px-2.5 text-[10px] font-bold text-center rounded-lg border border-dashed border-slate-700 bg-slate-950 text-blue-400 hover:text-blue-300 hover:bg-slate-900 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3 h-3" />
              <span>{settings.companyLogoImg ? (lang === "ar" ? "تغيير الشعار" : "Change Logo") : (lang === "ar" ? "رفع الشعار" : "Upload Logo")}</span>
            </label>
            {settings.companyLogoImg && (
              <button
                type="button"
                onClick={() => onUpdateSettings((prev) => ({ ...prev, companyLogoImg: null }))}
                className="px-2.5 bg-rose-950/40 border border-rose-800 text-rose-400 rounded-lg text-[10px] font-bold hover:bg-rose-900 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Watermark Selector */}
        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          <label className="block text-[10px] font-semibold text-slate-400">
            {lang === "ar" ? "العلامة المائية للسرية:" : "Watermark:"}
          </label>
          <select
            value={settings.watermark}
            onChange={(e) =>
              onUpdateSettings((prev) => ({
                ...prev,
                watermark: e.target.value as WatermarkType,
              }))
            }
            className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="none">{lang === "ar" ? "بدون علامة" : "None"}</option>
            <option value="confidential">CONFIDENTIAL</option>
            <option value="internal">INTERNAL ONLY</option>
            <option value="official">OFFICIAL RECORD</option>
          </select>
        </div>

        {/* Signature Upload */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <label className="block text-[10px] font-semibold text-slate-400">
            {lang === "ar" ? "توقيع الاعتماد المعتمد:" : "Authorized Signature:"}
          </label>
          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*"
              id="print-settings-sig-upload"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const base64 = ev.target?.result as string;
                    onUpdateSettings((prev) => ({ ...prev, signatureImg: base64 }));
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            <label
              htmlFor="print-settings-sig-upload"
              className="flex-1 py-1.5 px-2.5 text-[10px] font-bold text-center rounded-lg border border-dashed border-slate-700 bg-slate-950 text-blue-400 hover:text-blue-300 hover:bg-slate-900 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3 h-3" />
              <span>{settings.signatureImg ? (lang === "ar" ? "تغيير التوقيع" : "Change Signature") : (lang === "ar" ? "رفع التوقيع" : "Upload Signature")}</span>
            </label>
            {settings.signatureImg && (
              <button
                type="button"
                onClick={() => onUpdateSettings((prev) => ({ ...prev, signatureImg: null }))}
                className="px-2.5 bg-rose-950/40 border border-rose-800 text-rose-400 rounded-lg text-[10px] font-bold hover:bg-rose-900 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Section Visibility Toggles */}
      <div className="space-y-2 bg-slate-900/90 border border-slate-800 rounded-xl p-4">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-3">
          <Check className="w-4 h-4" />
          <span>{lang === "ar" ? "الأقسام المضمنة في الوثيقة" : "Included Sections"}</span>
        </span>

        {[
          { key: "includeHeader", label: lang === "ar" ? "ترويسة التقرير الرسمية" : "Official Branding Header" },
          { key: "includeFooter", label: lang === "ar" ? "تذييل التوثيق والصفحات" : "Document Footer" },
          { key: "includeCausal", label: lang === "ar" ? "العوامل المسببة والتحليل" : "Causal Factors & Root Cause" },
          { key: "includeOutcomes", label: lang === "ar" ? "النتائج والأثر المترتب" : "Outcomes & Impact" },
          { key: "includeLessons", label: lang === "ar" ? "الدروس المستفادة والتوجيهات" : "Lessons Learned & Guidance" },
          { key: "includeAuthor", label: lang === "ar" ? "بيانات الموثق والتاريخ" : "Author & Timestamp" },
          { key: "includeTags", label: lang === "ar" ? "الوسوم والتصنيفات" : "Tags" },
          { key: "includeSignatureBlock", label: lang === "ar" ? "كتلة التوقيع والاعتماد الرسمي" : "Official Signature Block" },
        ].map(({ key, label }) => {
          const isChecked = (settings as any)[key];
          return (
            <label
              key={key}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 hover:bg-slate-950 border border-slate-850 cursor-pointer text-xs"
            >
              <span className="text-slate-300 font-medium">{label}</span>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) =>
                  onUpdateSettings((prev) => ({
                    ...prev,
                    [key]: e.target.checked,
                  }))
                }
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 accent-blue-500 cursor-pointer"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
};
