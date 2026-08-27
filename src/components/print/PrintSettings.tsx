import React, { useState } from "react";
import { Memory, User } from "../../types";
import { 
  PrintSettingsState, 
  PaperSize, 
  Orientation, 
  MarginPreset, 
  Density, 
  PrintDiagnostics, 
  InnerBorderStyle, 
  WavySideStyle, 
  WavySidePosition 
} from "./printTypes";
import { 
  Sliders, 
  Layout, 
  Type, 
  FileText, 
  CheckSquare, 
  Square, 
  Eye, 
  ShieldCheck, 
  Sparkles, 
  Layers,
  Palette,
  Maximize2,
  Check,
  Frame,
  Scissors
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
  currentUser,
  onOpenProfileSettings,
}) => {
  const isRtl = lang === "ar";
  const [activeTab, setActiveTab] = useState<"borders" | "layout" | "typography" | "content">("borders");

  const paperSizeDetails: Record<PaperSize, { name: string; dim: string; badge?: string }> = {
    A4: { name: "A4", dim: "210 × 297 mm", badge: lang === "ar" ? "معياري" : "Standard" },
    Letter: { name: "Letter", dim: "8.5 × 11 in" },
    A3: { name: "A3", dim: "297 × 420 mm", badge: lang === "ar" ? "كبير" : "Large" },
    A5: { name: "A5", dim: "148 × 210 mm" },
    Legal: { name: "Legal", dim: "8.5 × 14 in" },
  };

  const innerStyleOptions: { id: InnerBorderStyle; labelAr: string; labelEn: string; iconStr: string }[] = [
    { id: "solid", labelAr: "خط مصمت", labelEn: "Solid Line", iconStr: "──────" },
    { id: "double", labelAr: "خط مزدوج", labelEn: "Double Line", iconStr: "══════" },
    { id: "dashed", labelAr: "متقطع / منقط", labelEn: "Dashed Line", iconStr: "- - - - - -" },
    { id: "decorative", labelAr: "إطار فاخر محاط", labelEn: "Framed Outline", iconStr: "⟦ ──── ⟧" },
  ];

  const wavyStyleOptions: { id: WavySideStyle; labelAr: string; labelEn: string; preview: string }[] = [
    { id: "calligraphic", labelAr: "خط ونقاط كلاسيكية", labelEn: "Calligraphic (نّي ~~~ نّي)", preview: "نّي ~~~ نّي" },
    { id: "wavy", labelAr: "تموج متناسق", labelEn: "Smooth Harmonic Wave", preview: "~~~~~~~~" },
    { id: "double-wave", labelAr: "تموج مزدوج", labelEn: "Double Wave Ribbon", preview: "≈≈≈≈≈≈≈≈" },
    { id: "arabesque", labelAr: "زخرفة أرابيسك", labelEn: "Arabesque Star Motif", preview: "✦ ──── ✦" },
    { id: "geometric", labelAr: "هندسي متعرج", labelEn: "Geometric Zigzag", preview: "WWWWWW" },
  ];

  const colorPresets = [
    { name: "Slate Charcoal", hex: "#0f172a" },
    { name: "Pure Black", hex: "#000000" },
    { name: "Zakir Blue", hex: "#0075DE" },
    { name: "Navy Blue", hex: "#003A70" },
    { name: "Deep Forest", hex: "#064e3b" },
    { name: "Classic Bronze", hex: "#78350f" },
  ];

  const densityOptions: { id: Density; labelAr: string; labelEn: string; desc: string }[] = [
    { id: "compact", labelAr: "مكثف", labelEn: "Compact", desc: lang === "ar" ? "توفير صفحات" : "Saves pages" },
    { id: "comfortable", labelAr: "مريح", labelEn: "Comfortable", desc: lang === "ar" ? "متوازن ومثالي" : "Balanced" },
    { id: "spacious", labelAr: "متسع", labelEn: "Spacious", desc: lang === "ar" ? "قراءة مريحة" : "Readable" },
  ];

  const toggleItems: { key: keyof PrintSettingsState; labelAr: string; labelEn: string }[] = [
    { key: "showCornerPageMarkers", labelAr: "علامات P1, P2 في زوايا الصفحات", labelEn: "Page Corner Markers (P1, P2)" },
    { key: "showHeader", labelAr: "الترويسة الرسمية المعتمدة", labelEn: "Official Institution Header" },
    { key: "showFooter", labelAr: "التذييل وأرقام الصفحات", labelEn: "Footer & Page Numbers" },
    { key: "showSignature", labelAr: "قسم الاعتماد والتوقيع والختم", labelEn: "Approval & Signature Block" },
    { key: "showRiskBadges", labelAr: "شارات تقييم المخاطر", labelEn: "Risk Assessment Badges" },
    { key: "showCausalFactors", labelAr: "الأسباب الجذرية والعوامل", labelEn: "Causal Factors" },
    { key: "showOutcomes", labelAr: "النتائج والأثر التشغيلي", labelEn: "Operational Outcomes" },
    { key: "showLessonsLearned", labelAr: "الدروس المستفادة والتطوير", labelEn: "Lessons Learned & Actions" },
    { key: "showTags", labelAr: "الوسوم والتصنيفات", labelEn: "Memory Category Tags" },
    { key: "showMetadata", labelAr: "بيانات التوثيق والمسجل", labelEn: "Author & Timestamp Meta" },
  ];

  return (
    <aside
      className="zakir-print-modal-sidebar w-88 min-w-[340px] max-w-[380px] h-full bg-[#0f172a] text-slate-100 border-s border-slate-800 flex flex-col overflow-hidden text-xs select-none shadow-2xl shrink-0"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Title Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800 shrink-0 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0075DE]/15 border border-[#0075DE]/30 flex items-center justify-center text-[#0075DE]">
            <Frame className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-black text-white text-xs tracking-tight">
              {lang === "ar" ? "تخصيص الإطارات والطباعة" : "Borders & Layout Setup"}
            </h3>
            <p className="text-[10px] text-slate-400">
              {lang === "ar" ? "تحكم بالحدود والهوامش والزخارف" : "Precision Frame & Margin Geometry"}
            </p>
          </div>
        </div>

        {diagnostics && (
          <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-mono text-emerald-400 font-bold">
            {diagnostics.selectedCount} {lang === "ar" ? "سجل" : "items"}
          </span>
        )}
      </div>

      {/* Navigation Tabs (Borders, Layout, Typography, Content) */}
      <div className="grid grid-cols-4 p-1.5 bg-slate-950/80 border-b border-slate-800 shrink-0 gap-1 text-[11px] font-bold">
        {[
          { id: "borders", labelAr: "الإطارات", labelEn: "Borders", icon: Frame },
          { id: "layout", labelAr: "الصفحة", labelEn: "Layout", icon: Layout },
          { id: "typography", labelAr: "الخطوط", labelEn: "Fonts", icon: Type },
          { id: "content", labelAr: "المحتوى", labelEn: "Records", icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-1.5 px-1 rounded-lg flex flex-col items-center gap-1 transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#0075DE] text-white shadow-md font-black"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[10px]">{lang === "ar" ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Body (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        {/* ============================================================ */}
        {/* TAB 1: BORDERS & MARGINS (التحكم بالإطارات والهوامش والزخرفة) */}
        {/* ============================================================ */}
        {activeTab === "borders" && (
          <div className="space-y-5">
            {/* SECTION: الإطار الخارجي (Outer Border) */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Frame className="w-4 h-4 text-[#0075DE]" />
                  <span className="font-extrabold text-white text-[11px]">
                    {lang === "ar" ? "الإطار الخارجي (Outer Border)" : "Outer Frame Border"}
                  </span>
                </div>

                {/* Toggle Outer Border */}
                <div
                  onClick={() =>
                    onUpdateSettings((p) => ({
                      ...p,
                      showOuterBorder: p.showOuterBorder === false ? true : false,
                    }))
                  }
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
                    settings.showOuterBorder !== false
                      ? "bg-[#0075DE] justify-end"
                      : "bg-slate-800 justify-start"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                </div>
              </div>

              {settings.showOuterBorder !== false && (
                <div className="space-y-3 pt-1 border-t border-slate-800/80">
                  {/* Outer Thickness Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-bold">
                        {lang === "ar" ? "سمك الإطار الخارجي (Outer Thickness):" : "Outer Thickness:"}
                      </span>
                      <span className="font-mono font-black text-[#0075DE] bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/50">
                        {settings.outerBorderThickness || 3} px
                      </span>
                    </div>

                    <input
                      type="range"
                      min={1}
                      max={7}
                      step={0.5}
                      value={settings.outerBorderThickness || 3}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateSettings((p) => ({ ...p, outerBorderThickness: val }));
                      }}
                      className="w-full accent-[#0075DE] bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[8px] font-mono text-slate-500">
                      <span>1px (نحيف)</span>
                      <span>3px (معياري)</span>
                      <span>7px (سميك جداً)</span>
                    </div>
                  </div>

                  {/* Outer Border Color Swatches */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold block">
                      {lang === "ar" ? "لون الإطار:" : "Border Color:"}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {colorPresets.map((col) => {
                        const isSelected = (settings.outerBorderColor || "#0f172a") === col.hex;
                        return (
                          <button
                            key={col.hex}
                            type="button"
                            onClick={() => onUpdateSettings((p) => ({ ...p, outerBorderColor: col.hex }))}
                            className={`w-6 h-6 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center ${
                              isSelected ? "border-white scale-110 shadow-md" : "border-slate-700 hover:border-slate-500"
                            }`}
                            style={{ backgroundColor: col.hex }}
                            title={col.name}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION: الهامش الأبيض بين الإطارين (White Margin Gap) */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-emerald-400" />
                  <span className="font-extrabold text-white text-[11px]">
                    {lang === "ar" ? "الهوامش البيضاء بين الإطارين (Inner Margin):" : "White Margin Gap (Inner Margin)"}
                  </span>
                </div>
                <span className="font-mono font-black text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50 text-[10px]">
                  {typeof settings.whiteMarginMm === "number" ? settings.whiteMarginMm : 10} mm
                </span>
              </div>

              <p className="text-[10px] text-slate-400">
                {lang === "ar" 
                  ? "المسافة الفارغة النقية الفاصلة بين الإطار الخارجي والإطار الداخلي للمحتوى." 
                  : "The clean empty white gap between the outer boundary and inner content frame."}
              </p>

              <input
                type="range"
                min={4}
                max={22}
                step={1}
                value={typeof settings.whiteMarginMm === "number" ? settings.whiteMarginMm : 10}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  onUpdateSettings((p) => ({ ...p, whiteMarginMm: val }));
                }}
                className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[8px] font-mono text-slate-500">
                <span>4mm (ضيق)</span>
                <span>10mm (معياري الرسم)</span>
                <span>22mm (واسع)</span>
              </div>

              {/* Margin Quick Presets */}
              <div className="flex items-center gap-1.5 pt-1">
                {[6, 10, 14, 18].map((mm) => {
                  const isSelected = (settings.whiteMarginMm || 10) === mm;
                  return (
                    <button
                      key={mm}
                      type="button"
                      onClick={() => onUpdateSettings((p) => ({ ...p, whiteMarginMm: mm }))}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      {mm} mm
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION: الإطار الداخلي (Inner Border) */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layout className="w-4 h-4 text-purple-400" />
                  <span className="font-extrabold text-white text-[11px]">
                    {lang === "ar" ? "الإطار الداخلي للمحتوى (Inner Border)" : "Inner Content Border"}
                  </span>
                </div>

                {/* Toggle Inner Border */}
                <div
                  onClick={() =>
                    onUpdateSettings((p) => ({
                      ...p,
                      showInnerBorder: p.showInnerBorder === false ? true : false,
                    }))
                  }
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
                    settings.showInnerBorder !== false
                      ? "bg-purple-600 justify-end"
                      : "bg-slate-800 justify-start"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                </div>
              </div>

              {settings.showInnerBorder !== false && (
                <div className="space-y-3 pt-1 border-t border-slate-800/80">
                  {/* Inner Style Selector */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold block">
                      {lang === "ar" ? "نمط الخط الداخلي (Inner Style):" : "Inner Border Style:"}
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {innerStyleOptions.map((opt) => {
                        const isSelected = (settings.innerBorderStyle || "solid") === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onUpdateSettings((p) => ({ ...p, innerBorderStyle: opt.id }))}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                              isSelected
                                ? "bg-purple-950/40 border-purple-500 text-white shadow-sm ring-1 ring-purple-500/40"
                                : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                            }`}
                          >
                            <span className="font-mono text-xs text-purple-300 font-black">{opt.iconStr}</span>
                            <span className="text-[10px] font-bold">{lang === "ar" ? opt.labelAr : opt.labelEn}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inner Border Thickness */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-bold">
                        {lang === "ar" ? "سمك الخط الداخلي:" : "Thickness:"}
                      </span>
                      <span className="font-mono font-black text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded">
                        {settings.innerBorderThickness || 1.5} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={4}
                      step={0.5}
                      value={settings.innerBorderThickness || 1.5}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateSettings((p) => ({ ...p, innerBorderThickness: val }));
                      }}
                      className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECTION: الزخارف والحواف المتموجة (Wavy Decorative Side Borders) */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="font-extrabold text-white text-[11px]">
                    {lang === "ar" ? "الزخارف والحدود الجانبية المتموجة" : "Wavy Decorative Side Border"}
                  </span>
                </div>

                {/* Toggle Wavy Side Border */}
                <div
                  onClick={() =>
                    onUpdateSettings((p) => ({
                      ...p,
                      showWavySideBorder: p.showWavySideBorder === false ? true : false,
                    }))
                  }
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
                    settings.showWavySideBorder !== false
                      ? "bg-amber-500 justify-end"
                      : "bg-slate-800 justify-start"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                </div>
              </div>

              {settings.showWavySideBorder !== false && (
                <div className="space-y-3 pt-1 border-t border-slate-800/80">
                  <p className="text-[10px] text-slate-400">
                    {lang === "ar"
                      ? "الحدود والزخارف المتموجة (نّي ~~~~~~ نّي) الموضحة في الرسم بجانب المحتوى النصي."
                      : "Vertical wavy ribbon & calligraphic flourishes drawn alongside the text content."}
                  </p>

                  {/* Wavy Style Options */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold block">
                      {lang === "ar" ? "نمط الزخرفة:" : "Flourish Style:"}
                    </span>
                    <div className="space-y-1.5">
                      {wavyStyleOptions.map((opt) => {
                        const isSelected = (settings.wavyBorderStyle || "calligraphic") === opt.id;
                        return (
                          <div
                            key={opt.id}
                            onClick={() => onUpdateSettings((p) => ({ ...p, wavyBorderStyle: opt.id }))}
                            className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              isSelected
                                ? "bg-amber-950/30 border-amber-500 text-white shadow-sm ring-1 ring-amber-500/30"
                                : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                            }`}
                          >
                            <span className="font-bold text-[11px]">{lang === "ar" ? opt.labelAr : opt.labelEn}</span>
                            <span className="font-mono text-xs text-amber-400 font-black">{opt.preview}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Side Position (Right, Left, Both) */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold block">
                      {lang === "ar" ? "موضع الزخرفة:" : "Placement Side:"}
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: "right", labelAr: "يمين (الرسم)", labelEn: "Right (Sketch)" },
                        { id: "left", labelAr: "يسار", labelEn: "Left" },
                        { id: "both", labelAr: "الجانبين", labelEn: "Both Sides" },
                      ].map((pos) => {
                        const isSelected = (settings.wavyBorderSide || "right") === pos.id;
                        return (
                          <button
                            key={pos.id}
                            type="button"
                            onClick={() => onUpdateSettings((p) => ({ ...p, wavyBorderSide: pos.id as any }))}
                            className={`py-1.5 px-2 rounded-xl border text-[10px] font-bold transition-all cursor-pointer ${
                              isSelected
                                ? "bg-amber-500 text-white shadow-sm border-amber-400 font-black"
                                : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                            }`}
                          >
                            {lang === "ar" ? pos.labelAr : pos.labelEn}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: PAGE SETUP & GEOMETRY (الورق والتخطيط) */}
        {/* ============================================================ */}
        {activeTab === "layout" && (
          <div className="space-y-4">
            {/* Visual Cards: Orientation */}
            <div>
              <label className="block text-slate-400 mb-1.5 text-[10px] font-bold">
                {lang === "ar" ? "اتجاه الورقة:" : "Page Orientation:"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateSettings((p) => ({ ...p, orientation: "portrait" }))}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    settings.orientation === "portrait"
                      ? "bg-[#0075DE]/15 border-[#0075DE] text-white shadow-md shadow-[#0075DE]/10 ring-1 ring-[#0075DE]/40"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <div className="w-6 h-8 rounded border-2 border-current flex flex-col justify-between p-1 opacity-90">
                    <div className="w-full h-1 bg-current rounded-full" />
                    <div className="w-3/4 h-0.5 bg-current rounded-full opacity-60" />
                    <div className="w-1/2 h-0.5 bg-current rounded-full opacity-40" />
                  </div>
                  <span className="font-bold text-[11px]">
                    {lang === "ar" ? "عمودي (Portrait)" : "Portrait"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateSettings((p) => ({ ...p, orientation: "landscape" }))}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    settings.orientation === "landscape"
                      ? "bg-[#0075DE]/15 border-[#0075DE] text-white shadow-md shadow-[#0075DE]/10 ring-1 ring-[#0075DE]/40"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <div className="w-8 h-6 rounded border-2 border-current flex flex-col justify-between p-1 opacity-90">
                    <div className="w-full h-1 bg-current rounded-full" />
                    <div className="w-3/4 h-0.5 bg-current rounded-full opacity-60" />
                    <div className="w-1/2 h-0.5 bg-current rounded-full opacity-40" />
                  </div>
                  <span className="font-bold text-[11px]">
                    {lang === "ar" ? "أفقي (Landscape)" : "Landscape"}
                  </span>
                </button>
              </div>
            </div>

            {/* Visual Cards: Paper Size */}
            <div>
              <label className="block text-slate-400 mb-1.5 text-[10px] font-bold">
                {lang === "ar" ? "حجم الورق القياسي:" : "Paper Standard Size:"}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["A4", "Letter", "A3", "A5", "Legal"] as PaperSize[]).map((size) => {
                  const details = paperSizeDetails[size];
                  const isSelected = settings.paperSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onUpdateSettings((p) => ({ ...p, paperSize: size }))}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                        isSelected
                          ? "bg-[#0075DE]/15 border-[#0075DE] text-white shadow-sm ring-1 ring-[#0075DE]/30"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      {details.badge && (
                        <span className="absolute -top-1.5 end-1 px-1.5 py-0.2 bg-[#0075DE] text-white text-[8px] font-extrabold rounded-full">
                          {details.badge}
                        </span>
                      )}
                      <span className="font-black text-xs">{details.name}</span>
                      <span className="text-[9px] text-slate-500 font-mono mt-0.5">{details.dim}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Canvas Theme in Preview */}
            <div>
              <label className="block text-slate-400 mb-1.5 text-[10px] font-bold">
                {lang === "ar" ? "خلفية مساحة العمل في المعاينة:" : "Preview Canvas Background:"}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "light-gray", labelAr: "رمادي فاتح (الرسم)", labelEn: "Light Gray" },
                  { id: "canvas-dark", labelAr: "داكن فاخر", labelEn: "Dark Slate" },
                  { id: "pure-white", labelAr: "أبيض ناصع", labelEn: "Pure White" },
                ].map((th) => {
                  const isSelected = (settings.previewTheme || "light-gray") === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => onUpdateSettings((p) => ({ ...p, previewTheme: th.id as any }))}
                      className={`py-1.5 px-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#0075DE] text-white border-[#0075DE]"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {lang === "ar" ? th.labelAr : th.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: TYPOGRAPHY & DENSITY (الخطوط والكثافة) */}
        {/* ============================================================ */}
        {activeTab === "typography" && (
          <div className="space-y-4">
            {/* Custom Font Size Slider */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 text-[11px] font-bold">
                  {lang === "ar" ? "حجم الخط المخصص:" : "Font Size:"}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={8}
                    max={32}
                    value={typeof settings.fontSize === "number" ? settings.fontSize : 13}
                    onChange={(e) => {
                      const val = Math.max(8, Math.min(32, parseInt(e.target.value) || 13));
                      onUpdateSettings((p) => ({ ...p, fontSize: val }));
                    }}
                    className="w-12 h-6 text-center bg-slate-900 border border-slate-700 text-[#0075DE] font-mono font-black text-xs rounded"
                  />
                  <span className="text-[10px] text-slate-400">px</span>
                </div>
              </div>

              <input
                type="range"
                min={8}
                max={32}
                step={1}
                value={typeof settings.fontSize === "number" ? settings.fontSize : 13}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  onUpdateSettings((p) => ({ ...p, fontSize: val }));
                }}
                className="w-full accent-[#0075DE] bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />

              {/* Quick Font Presets */}
              <div className="flex items-center gap-1 pt-1">
                {[10, 12, 13, 15, 18, 22].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onUpdateSettings((p) => ({ ...p, fontSize: sz }))}
                    className={`flex-1 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                      settings.fontSize === sz
                        ? "bg-[#0075DE] text-white"
                        : "bg-slate-900 text-slate-400 hover:text-white"
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Density Modes */}
            <div>
              <label className="block text-slate-400 mb-1.5 text-[10px] font-bold">
                {lang === "ar" ? "نمط الكثافة:" : "Density Preset:"}
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
                {densityOptions.map((d) => {
                  const isSelected = settings.density === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        const defaultLh = d.id === "compact" ? 1.3 : d.id === "spacious" ? 1.85 : 1.55;
                        onUpdateSettings((p) => ({ ...p, density: d.id, lineHeight: defaultLh }));
                      }}
                      className={`py-1.5 px-1.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer flex flex-col items-center ${
                        isSelected
                          ? "bg-[#0075DE] text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span>{lang === "ar" ? d.labelAr : d.labelEn}</span>
                      <span className="text-[8px] opacity-75 font-mono">{d.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Line Spacing Slider */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 text-[11px] font-bold">
                  {lang === "ar" ? "ارتفاع الأسطر (Line Height):" : "Line Height:"}
                </label>
                <span className="text-xs font-mono font-black text-emerald-400">
                  ×{(settings.lineHeight || 1.55).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={1.1}
                max={2.3}
                step={0.05}
                value={settings.lineHeight || 1.55}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onUpdateSettings((p) => ({ ...p, lineHeight: val }));
                }}
                className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: CONTENT & RECORD FILTERING (المحتوى والسجلات) */}
        {/* ============================================================ */}
        {activeTab === "content" && (
          <div className="space-y-4">
            {/* Memory Selection List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-slate-300">
                  {lang === "ar" ? "السجلات المضمنة بالتقرير:" : "Included Records:"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onSelectAllMemories}
                    className="text-[#0075DE] hover:text-blue-300 text-[10px] font-bold cursor-pointer"
                  >
                    {lang === "ar" ? "الكل" : "All"}
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={onDeselectAllMemories}
                    className="text-slate-400 hover:text-slate-200 text-[10px] font-bold cursor-pointer"
                  >
                    {lang === "ar" ? "إلغاء" : "None"}
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 p-1 bg-slate-950/80 border border-slate-800 rounded-xl custom-scrollbar">
                {allMemories.map((m) => {
                  const isSelected = selectedMemoryIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => onToggleMemory(m.id)}
                      className={`p-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        isSelected
                          ? "bg-[#0075DE]/10 text-slate-100 border border-[#0075DE]/30"
                          : "text-slate-500 hover:bg-slate-900 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-[#0075DE] shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        )}
                        <span className="text-[11px] truncate font-medium">{m.title}</span>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                        {m.riskLevel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Elements Toggles */}
            <div className="space-y-1.5">
              <span className="font-bold text-[11px] text-slate-300 block mb-1">
                {lang === "ar" ? "أقسام وعناصر المستند:" : "Document Sections:"}
              </span>
              {toggleItems.map((item) => {
                const isChecked = Boolean((settings as any)[item.key]);
                return (
                  <div
                    key={item.key}
                    onClick={() =>
                      onUpdateSettings((p) => ({ ...p, [item.key]: !isChecked }))
                    }
                    className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isChecked
                        ? "bg-slate-950/80 border-slate-800 text-slate-100"
                        : "bg-slate-950/40 border-slate-850 text-slate-500 opacity-60"
                    }`}
                  >
                    <span className="text-[10px] font-bold">
                      {lang === "ar" ? item.labelAr : item.labelEn}
                    </span>
                    <div
                      className={`w-8 h-4.5 rounded-full p-0.5 transition-colors flex items-center ${
                        isChecked ? "bg-[#0075DE] justify-end" : "bg-slate-800 justify-start"
                      }`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md transform transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
