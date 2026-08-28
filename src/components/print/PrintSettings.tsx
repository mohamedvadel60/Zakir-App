import React, { useState } from "react";
import { Memory, User } from "../../types";
import { 
  PrintSettingsState, 
  PaperSize, 
  Orientation, 
  MarginPreset, 
  Density, 
  PrintDiagnostics
} from "./printTypes";
import { 
  Layout, 
  Type, 
  CheckSquare, 
  Square, 
  Palette,
  Maximize2,
  Check,
  Frame,
  Layers
} from "lucide-react";

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
  currentUser?: User | null;
  onOpenProfileSettings?: () => void;
  theme?: "light" | "dark" | "custom";
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
  theme = "dark",
}) => {
  const isRtl = lang === "ar";
  const [activeTab, setActiveTab] = useState<"layout" | "typography" | "content">("layout");

  const paperSizeDetails: Record<PaperSize, { name: string; dim: string; badge?: string }> = {
    A4: { name: "A4", dim: "210 × 297 mm", badge: lang === "ar" ? "معياري" : "Standard" },
    Letter: { name: "Letter", dim: "8.5 × 11 in" },
    A3: { name: "A3", dim: "297 × 420 mm", badge: lang === "ar" ? "كبير" : "Large" },
    A5: { name: "A5", dim: "148 × 210 mm" },
    Legal: { name: "Legal", dim: "8.5 × 14 in" },
  };

  const colorPresets = [
    { name: "Slate Charcoal", hex: "#0f172a" },
    { name: "Pure Black", hex: "#000000" },
    { name: "Zakir Blue", hex: "#0075DE" },
    { name: "Navy Blue", hex: "#003A70" },
    { name: "Deep Forest", hex: "#064e3b" },
    { name: "Classic Bronze", hex: "#78350f" },
  ];

  const densityOptions: { id: Density; labelAr: string; labelEn: string; desc: string }[] = [
    { id: "compact", labelAr: "مكثف", labelEn: "Compact", desc: lang === "ar" ? "سجلات أكثر لكل صفحة" : "More items per page" },
    { id: "comfortable", labelAr: "مريح", labelEn: "Comfortable", desc: lang === "ar" ? "متوازن ومثالي" : "Balanced" },
    { id: "spacious", labelAr: "متسع", labelEn: "Spacious", desc: lang === "ar" ? "قراءة مريحة وهوامش أوسع" : "Readable" },
  ];

  const toggleItems: { key: keyof PrintSettingsState; labelAr: string; labelEn: string }[] = [
    { key: "showHeader", labelAr: "الترويسة الرسمية للتقرير", labelEn: "Official Header" },
    { key: "showFooter", labelAr: "التذييل وأرقام الصفحات", labelEn: "Footer & Page Numbers" },
    { key: "showSignature", labelAr: "قسم الاعتماد والتوقيع والختم", labelEn: "Approval & Signature Block" },
    { key: "showRiskBadges", labelAr: "شارات تقييم المخاطر", labelEn: "Risk Assessment Badges" },
    { key: "showCausalFactors", labelAr: "الأسباب الجذرية والعوامل", labelEn: "Causal Factors" },
    { key: "showOutcomes", labelAr: "النتائج والأثر التشغيلي", labelEn: "Operational Outcomes" },
    { key: "showLessonsLearned", labelAr: "الدروس المستفادة والتطوير", labelEn: "Lessons Learned & Actions" },
    { key: "showTags", labelAr: "الوسوم والتصنيفات", labelEn: "Category Tags" },
    { key: "showMetadata", labelAr: "بيانات التوثيق والمسجل", labelEn: "Author & Timestamp Meta" },
  ];

  return (
    <aside
      className={`zakir-print-modal-sidebar w-88 min-w-[340px] max-w-[380px] h-full flex flex-col overflow-hidden text-xs select-none shadow-2xl shrink-0 ${
        theme === "dark"
          ? "bg-[#0f172a] text-slate-100 border-s border-slate-800"
          : "bg-white text-slate-800 border-s border-slate-200"
      }`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Title Header */}
      <div className={`flex items-center justify-between p-3.5 border-b shrink-0 ${
        theme === "dark" ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50/80"
      }`}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0075DE]/15 border border-[#0075DE]/30 flex items-center justify-center text-[#0075DE]">
            <Layout className="w-4 h-4" />
          </div>
          <div>
            <h3 className={`font-black text-xs tracking-tight ${theme === "dark" ? "text-white" : "text-slate-800"}`}>
              {lang === "ar" ? "إعدادات الطباعة والمعاينة" : "Print & Page Settings"}
            </h3>
            <p className={`text-[10px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              {lang === "ar" ? "تخصيص الصفحة والإطار والخطوط" : "Custom Layout, Frame & Typography"}
            </p>
          </div>
        </div>

        {diagnostics && (
          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${
            theme === "dark"
              ? "bg-slate-900 border-slate-700 text-emerald-400"
              : "bg-slate-100 border-slate-200 text-emerald-600 shadow-xs"
          }`}>
            {diagnostics.selectedCount} {lang === "ar" ? "سجل" : "items"}
          </span>
        )}
      </div>

      {/* Navigation Tabs (Layout, Typography, Content) */}
      <div className={`grid grid-cols-3 p-1.5 border-b shrink-0 gap-1 text-[11px] font-bold ${
        theme === "dark" ? "bg-slate-950/80 border-slate-800" : "bg-slate-100/50 border-slate-200"
      }`}>
        {[
          { id: "layout", labelAr: "الصفحة والإطار", labelEn: "Page & Frame", icon: Layout },
          { id: "typography", labelAr: "الخطوط والتنسيق", labelEn: "Fonts", icon: Type },
          { id: "content", labelAr: "المحتوى والسجلات", labelEn: "Records", icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1.5 rounded-lg flex flex-col items-center gap-1 transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#0075DE] text-white shadow-md font-black"
                  : theme === "dark"
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{lang === "ar" ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Tab Content Container */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar ${
        theme === "dark" ? "text-slate-200" : "text-slate-700"
      }`}>
        {/* ==================================================================== */}
        {/* TAB 1: PAGE & FRAME SETTINGS (إعدادات الصفحة والإطار مدمجة) */}
        {/* ==================================================================== */}
        {activeTab === "layout" && (
          <div className="space-y-6">
            {/* 1. Page Orientation */}
            <div className="space-y-2">
              <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                theme === "dark" ? "text-slate-400" : "text-slate-500"
              }`}>
                <Maximize2 className="w-3.5 h-3.5 text-[#0075DE]" />
                <span>{lang === "ar" ? "اتجاه الورقة" : "Orientation"}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateSettings((p) => ({ ...p, orientation: "portrait" }))}
                  className={`p-2.5 rounded-lg border text-center font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    settings.orientation === "portrait"
                      ? "bg-[#0075DE]/20 border-[#0075DE] " + (theme === "dark" ? "text-white" : "text-[#0075DE]")
                      : theme === "dark"
                        ? "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800"
                  }`}
                >
                  <div className="w-3.5 h-5 border border-current rounded-xs shrink-0" />
                  <span>{lang === "ar" ? "عمودي (Portrait)" : "Portrait"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateSettings((p) => ({ ...p, orientation: "landscape" }))}
                  className={`p-2.5 rounded-lg border text-center font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    settings.orientation === "landscape"
                      ? "bg-[#0075DE]/20 border-[#0075DE] " + (theme === "dark" ? "text-white" : "text-[#0075DE]")
                      : theme === "dark"
                        ? "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800"
                  }`}
                >
                  <div className="w-5 h-3.5 border border-current rounded-xs shrink-0" />
                  <span>{lang === "ar" ? "أفقي (Landscape)" : "Landscape"}</span>
                </button>
              </div>
            </div>

            {/* 2. Paper Size Selector */}
            <div className="space-y-2">
              <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center justify-between ${
                theme === "dark" ? "text-slate-400" : "text-slate-500"
              }`}>
                <span>{lang === "ar" ? "قياس الورق" : "Paper Size"}</span>
                <span className={`font-mono font-normal ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                  {paperSizeDetails[settings.paperSize]?.dim}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["A4", "Letter", "A3", "A5", "Legal"] as PaperSize[]).map((size) => {
                  const isSel = settings.paperSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onUpdateSettings((p) => ({ ...p, paperSize: size }))}
                      className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                        isSel
                          ? "bg-[#0075DE] border-[#0075DE] text-white font-black shadow-xs"
                          : theme === "dark"
                            ? "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800"
                      }`}
                    >
                      <div className="font-bold text-xs">{size}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Outer Page Frame Border Controls */}
            <div className={`space-y-3 pt-2 border-t ${theme === "dark" ? "border-slate-800/80" : "border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}>
                  <Frame className="w-3.5 h-3.5 text-[#0075DE]" />
                  <span>{lang === "ar" ? "إطار الصفحة الخارجي" : "Outer Page Frame"}</span>
                </label>
                <input
                  type="checkbox"
                  checked={settings.showOuterBorder}
                  onChange={(e) =>
                    onUpdateSettings((p) => ({ ...p, showOuterBorder: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#0075DE] rounded cursor-pointer"
                />
              </div>

              {settings.showOuterBorder && (
                <div className={`p-3 rounded-xl border space-y-4 ${
                  theme === "dark" ? "bg-slate-900/70 border-slate-800/90" : "bg-slate-50 border-slate-200"
                }`}>
                  {/* Border Thickness */}
                  <div className="space-y-1.5">
                    <div className={`flex justify-between ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                      <span>{lang === "ar" ? "سمك الإطار" : "Border Thickness"}</span>
                      <span className="font-mono text-[#0075DE] font-bold">
                        {settings.outerBorderThickness} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="7"
                      step="1"
                      value={settings.outerBorderThickness}
                      onChange={(e) =>
                        onUpdateSettings((p) => ({
                          ...p,
                          outerBorderThickness: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[#0075DE] cursor-pointer"
                    />
                  </div>

                  {/* Corner Radius */}
                  <div className="space-y-1.5">
                    <div className={`flex justify-between ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                      <span>{lang === "ar" ? "استدارة الزوايا" : "Corner Radius"}</span>
                      <span className="font-mono text-[#0075DE] font-bold">
                        {settings.outerBorderRadius} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="16"
                      step="2"
                      value={settings.outerBorderRadius}
                      onChange={(e) =>
                        onUpdateSettings((p) => ({
                          ...p,
                          outerBorderRadius: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[#0075DE] cursor-pointer"
                    />
                  </div>

                  {/* Border Color Palette */}
                  <div className="space-y-2">
                    <div className={`flex justify-between ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                      <span className="flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-slate-400" />
                        <span>{lang === "ar" ? "لون الإطار" : "Border Color"}</span>
                      </span>
                      <span className={`font-mono text-[10px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                        {settings.outerBorderColor}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {colorPresets.map((c) => {
                        const isC = settings.outerBorderColor === c.hex;
                        return (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() =>
                              onUpdateSettings((p) => ({ ...p, outerBorderColor: c.hex }))
                            }
                            className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                              isC
                                ? "ring-2 ring-[#0075DE] ring-offset-2 " + (theme === "dark" ? "ring-offset-slate-900" : "ring-offset-white") + " scale-110"
                                : "border-slate-300 hover:scale-105"
                            }`}
                            style={{ backgroundColor: c.hex }}
                            title={c.name}
                          >
                            {isC && <Check className="w-3 h-3 text-white drop-shadow-sm" />}
                          </button>
                        );
                      })}
                      <input
                        type="color"
                        value={settings.outerBorderColor}
                        onChange={(e) =>
                          onUpdateSettings((p) => ({ ...p, outerBorderColor: e.target.value }))
                        }
                        className="w-7 h-7 p-0 bg-transparent border-0 rounded cursor-pointer"
                        title="Custom Color"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Page Margins (الهوامش الداخلية) */}
            <div className={`space-y-2 pt-2 border-t ${theme === "dark" ? "border-slate-800/80" : "border-slate-200"}`}>
              <div className="flex justify-between items-center">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}>
                  {lang === "ar" ? "الهامش الداخلي للصفحة" : "Page Margin Padding"}
                </span>
                <span className="font-mono text-[#0075DE] font-bold">
                  {settings.whiteMarginMm} mm
                </span>
              </div>
              <input
                type="range"
                min="4"
                max="20"
                step="1"
                value={settings.whiteMarginMm}
                onChange={(e) =>
                  onUpdateSettings((p) => ({ ...p, whiteMarginMm: Number(e.target.value) }))
                }
                className="w-full accent-[#0075DE] cursor-pointer"
              />
              <div className={`flex justify-between text-[10px] font-mono ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                <span>4 mm ({lang === "ar" ? "ضيق" : "Tight"})</span>
                <span>10 mm ({lang === "ar" ? "متوازن" : "Normal"})</span>
                <span>20 mm ({lang === "ar" ? "واسع" : "Wide"})</span>
              </div>
            </div>

            {/* 5. Preview Workspace Canvas Theme */}
            <div className={`space-y-2 pt-2 border-t ${theme === "dark" ? "border-slate-800/80" : "border-slate-200"}`}>
              <label className={`text-[11px] font-bold uppercase tracking-wider ${
                theme === "dark" ? "text-slate-400" : "text-slate-500"
              }`}>
                {lang === "ar" ? "خلفية مساحة العمل في المعاينة" : "Workspace Canvas Background"}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "light-gray", labelAr: "رمادي فاتح", labelEn: "Light Gray" },
                  { id: "canvas-dark", labelAr: "داكن", labelEn: "Dark Slate" },
                  { id: "pure-white", labelAr: "أبيض", labelEn: "Pure White" },
                ].map((thm) => (
                  <button
                    key={thm.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings((p) => ({
                        ...p,
                        previewTheme: thm.id as any,
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg border text-center font-bold transition-all cursor-pointer ${
                      settings.previewTheme === thm.id
                        ? "bg-[#0075DE] border-[#0075DE] text-white"
                        : theme === "dark"
                          ? "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300"
                    }`}
                  >
                    {lang === "ar" ? thm.labelAr : thm.labelEn}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: TYPOGRAPHY & DENSITY (الخطوط والتنسيق والكثافة) */}
        {/* ==================================================================== */}
        {activeTab === "typography" && (
          <div className="space-y-6">
            {/* Density Presets */}
            <div className="space-y-2">
              <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                theme === "dark" ? "text-slate-400" : "text-slate-500"
              }`}>
                <Type className="w-3.5 h-3.5 text-[#0075DE]" />
                <span>{lang === "ar" ? "كثافة المحتوى والصفحات" : "Density Preset"}</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {densityOptions.map((opt) => {
                  const isSel = settings.density === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateSettings((p) => ({ ...p, density: opt.id }))}
                      className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col justify-between items-center gap-1 ${
                        isSel
                          ? "bg-[#0075DE]/20 border-[#0075DE] " + (theme === "dark" ? "text-white" : "text-[#0075DE]") + " font-black shadow-xs ring-1 ring-[#0075DE]/40"
                          : theme === "dark"
                            ? "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800"
                      }`}
                    >
                      <span className="font-bold text-xs">
                        {lang === "ar" ? opt.labelAr : opt.labelEn}
                      </span>
                      <span className={`text-[9px] font-normal leading-tight ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Font Size */}
            <div className={`p-3 rounded-xl border space-y-2 ${
              theme === "dark" ? "bg-slate-900/70 border-slate-800/90" : "bg-slate-50 border-slate-200"
            }`}>
              <div className={`flex justify-between ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                <span className="font-bold">{lang === "ar" ? "حجم الخط الرئيسي" : "Base Font Size"}</span>
                <span className="font-mono text-[#0075DE] font-bold">{settings.fontSize} px</span>
              </div>
              <input
                type="range"
                min="9"
                max="20"
                step="1"
                value={settings.fontSize}
                onChange={(e) =>
                  onUpdateSettings((p) => ({ ...p, fontSize: Number(e.target.value) }))
                }
                className="w-full accent-[#0075DE] cursor-pointer"
              />
              <div className={`flex justify-between text-[10px] font-mono ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                <span>9 px ({lang === "ar" ? "صغير" : "Small"})</span>
                <span>13 px ({lang === "ar" ? "معياري" : "Standard"})</span>
                <span>20 px ({lang === "ar" ? "كبير" : "Large"})</span>
              </div>
            </div>

            {/* Line Height Multiplier */}
            <div className={`p-3 rounded-xl border space-y-2 ${
              theme === "dark" ? "bg-slate-900/70 border-slate-800/90" : "bg-slate-50 border-slate-200"
            }`}>
              <div className={`flex justify-between ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                <span className="font-bold">{lang === "ar" ? "تباعد الأسطر" : "Line Height"}</span>
                <span className="font-mono text-[#0075DE] font-bold">
                  {settings.lineHeight || 1.55}
                </span>
              </div>
              <input
                type="range"
                min="1.2"
                max="2.2"
                step="0.05"
                value={settings.lineHeight || 1.55}
                onChange={(e) =>
                  onUpdateSettings((p) => ({ ...p, lineHeight: Number(e.target.value) }))
                }
                className="w-full accent-[#0075DE] cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: CONTENT & RECORDS (المحتوى والسجلات المضمنة) */}
        {/* ==================================================================== */}
        {activeTab === "content" && (
          <div className="space-y-6">
            {/* Record Selection Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}>
                  <Layers className="w-3.5 h-3.5 text-[#0075DE]" />
                  <span>{lang === "ar" ? "السجلات المضمنة" : "Included Memories"}</span>
                </label>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={onSelectAllMemories}
                    className="text-[#0075DE] hover:underline cursor-pointer font-bold"
                  >
                    {lang === "ar" ? "تحديد الكل" : "All"}
                  </button>
                  <span className="text-slate-400">•</span>
                  <button
                    type="button"
                    onClick={onDeselectAllMemories}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-bold"
                  >
                    {lang === "ar" ? "إلغاء" : "None"}
                  </button>
                </div>
              </div>

              {/* Memories List */}
              <div className={`max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl border custom-scrollbar ${
                theme === "dark" ? "bg-slate-950/60 border-slate-800/90" : "bg-slate-50 border-slate-200"
              }`}>
                {allMemories.map((m) => {
                  const isChecked = selectedMemoryIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => onToggleMemory(m.id)}
                      className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                        isChecked
                          ? theme === "dark"
                            ? "bg-slate-900/90 border-[#0075DE]/50 text-white"
                            : "bg-[#0075DE]/10 border-[#0075DE] text-[#0075DE] font-bold"
                          : theme === "dark"
                            ? "bg-slate-950 border-slate-800/80 text-slate-400 hover:text-slate-200"
                            : "bg-white border-slate-200 text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-[#0075DE] shrink-0" />
                      ) : (
                        <Square className={`w-3.5 h-3.5 shrink-0 ${theme === "dark" ? "text-slate-600" : "text-slate-300"}`} />
                      )}
                      <span className="truncate font-semibold text-xs flex-1">{m.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Document Elements Toggles */}
            <div className={`space-y-2 pt-2 border-t ${theme === "dark" ? "border-slate-800/80" : "border-slate-200"}`}>
              <label className={`text-[11px] font-bold uppercase tracking-wider ${
                theme === "dark" ? "text-slate-400" : "text-slate-500"
              }`}>
                {lang === "ar" ? "أقسام وعناصر المستند" : "Document Sections"}
              </label>
              <div className="space-y-1.5">
                {toggleItems.map((item) => {
                  const isEnabled = settings[item.key] !== false;
                  return (
                    <div
                      key={item.key}
                      onClick={() =>
                        onUpdateSettings((p) => ({
                          ...p,
                          [item.key]: !isEnabled,
                        }))
                      }
                      className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                        isEnabled
                          ? theme === "dark"
                            ? "bg-slate-900/80 border-slate-700/80 text-slate-200"
                            : "bg-white border-slate-300 text-slate-800 shadow-xs font-bold"
                          : theme === "dark"
                            ? "bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-400"
                            : "bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-500"
                      }`}
                    >
                      <span className="font-semibold text-xs">
                        {lang === "ar" ? item.labelAr : item.labelEn}
                      </span>
                      {isEnabled ? (
                        <CheckSquare className="w-4 h-4 text-[#0075DE]" />
                      ) : (
                        <Square className={`w-4 h-4 ${theme === "dark" ? "text-slate-600" : "text-slate-300"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
