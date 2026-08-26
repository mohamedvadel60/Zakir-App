import React from "react";
import { Memory, User } from "../../types";
import { PrintSettingsState, PaperSize, Orientation, MarginPreset, Density, PrintDiagnostics } from "./printTypes";
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
  Building2, 
  UserCheck, 
  Layers,
  ArrowRight,
  ExternalLink,
  Check,
  Maximize2,
  FileSpreadsheet
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

  const paperSizeDetails: Record<PaperSize, { name: string; dim: string; badge?: string }> = {
    A4: { name: "A4", dim: "210 × 297 mm", badge: lang === "ar" ? "معياري" : "Standard" },
    Letter: { name: "Letter", dim: "8.5 × 11 in" },
    A3: { name: "A3", dim: "297 × 420 mm", badge: lang === "ar" ? "كبير" : "Large" },
    A5: { name: "A5", dim: "148 × 210 mm" },
    Legal: { name: "Legal", dim: "8.5 × 14 in" },
  };

  const marginOptions: { id: MarginPreset; labelAr: string; labelEn: string; desc: string }[] = [
    { id: "compact", labelAr: "ضيقة", labelEn: "Compact", desc: "6 mm" },
    { id: "normal", labelAr: "قياسية", labelEn: "Standard", desc: "12 mm" },
    { id: "wide", labelAr: "واسعة", labelEn: "Wide", desc: "18 mm" },
  ];

  const fontSizeOptions: { id: "small" | "medium" | "large"; labelAr: string; labelEn: string; px: string }[] = [
    { id: "small", labelAr: "صغير", labelEn: "Small", px: "11px" },
    { id: "medium", labelAr: "متوسط", labelEn: "Medium", px: "13px" },
    { id: "large", labelAr: "كبير", labelEn: "Large", px: "15px" },
  ];

  const densityOptions: { id: Density; labelAr: string; labelEn: string; desc: string }[] = [
    { id: "compact", labelAr: "مكثف", labelEn: "Compact", desc: lang === "ar" ? "توفير صفحات" : "Saves pages" },
    { id: "comfortable", labelAr: "مريح", labelEn: "Comfortable", desc: lang === "ar" ? "متوازن ومثالي" : "Balanced" },
    { id: "spacious", labelAr: "متسع", labelEn: "Spacious", desc: lang === "ar" ? "قراءة مريحة" : "Readable" },
  ];

  const toggleItems: { key: keyof PrintSettingsState; labelAr: string; labelEn: string; icon?: React.ReactNode }[] = [
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
      className="zakir-print-modal-sidebar w-84 min-w-[330px] max-w-[360px] h-full bg-[#0f172a] text-slate-100 border-e border-slate-800 flex flex-col overflow-y-auto p-4.5 text-xs select-none custom-scrollbar shadow-2xl"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Title Header */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0075DE]/15 border border-[#0075DE]/30 flex items-center justify-center text-[#0075DE]">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-black text-white text-xs tracking-tight">
              {lang === "ar" ? "إعدادات وتنسيق التقرير" : "Report & Page Setup"}
            </h3>
            <p className="text-[10px] text-slate-400">
              {lang === "ar" ? "تخصيص الهيكل والطباعة الفورية" : "Print & document geometry"}
            </p>
          </div>
        </div>

        {diagnostics && (
          <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-mono text-emerald-400 font-bold">
            {diagnostics.selectedCount} {lang === "ar" ? "سجل" : "records"}
          </span>
        )}
      </div>

      {/* SECTION 1: تنسيق الصفحة (Page Setup) */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-2 text-slate-300 font-black text-[11px] uppercase tracking-wider">
          <Layout className="w-3.5 h-3.5 text-[#0075DE]" />
          <span>{lang === "ar" ? "١. تنسيق واتجاه الصفحة" : "1. Page Setup & Geometry"}</span>
        </div>

        {/* Visual Cards: Orientation */}
        <div>
          <label className="block text-slate-400 mb-1.5 text-[10px] font-bold">
            {lang === "ar" ? "اتجاه الورقة:" : "Page Orientation:"}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {/* Portrait Card */}
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

            {/* Landscape Card */}
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
            {lang === "ar" ? "حجم الورق:" : "Paper Standard Size:"}
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

        {/* Segmented Margins */}
        <div>
          <label className="block text-slate-400 mb-1.5 text-[10px] font-bold">
            {lang === "ar" ? "هوامش الصفحة:" : "Page Margins:"}
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
            {marginOptions.map((m) => {
              const isSelected = settings.margins === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onUpdateSettings((p) => ({ ...p, margins: m.id }))}
                  className={`py-1.5 px-2 rounded-lg font-bold text-[10px] transition-all cursor-pointer flex flex-col items-center ${
                    isSelected
                      ? "bg-[#0075DE] text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>{lang === "ar" ? m.labelAr : m.labelEn}</span>
                  <span className="text-[8px] opacity-75 font-mono">{m.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2: الكثافة البصرية والخطوط (Typography & Density) */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-2 text-slate-300 font-black text-[11px] uppercase tracking-wider">
          <Type className="w-3.5 h-3.5 text-[#0075DE]" />
          <span>{lang === "ar" ? "٢. الكثافة والخطوط" : "2. Typography & Density"}</span>
        </div>

        {/* Flexible Custom Font Size Selector */}
        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-slate-300 text-[11px] font-bold">
              {lang === "ar" ? "حجم الخط الحر المخصص:" : "Custom Font Size:"}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={8}
                max={36}
                value={typeof settings.fontSize === "number" ? settings.fontSize : 13}
                onChange={(e) => {
                  const val = Math.max(8, Math.min(36, parseInt(e.target.value) || 13));
                  onUpdateSettings((p) => ({ ...p, fontSize: val }));
                }}
                className="w-14 h-7 px-1.5 text-center bg-slate-900 border border-slate-700 text-[#0075DE] font-mono font-black text-xs rounded-lg focus:outline-none focus:border-[#0075DE]"
              />
              <span className="text-[10px] text-slate-400 font-bold">px</span>
            </div>
          </div>

          {/* Range Slider for Font Size */}
          <div className="space-y-1">
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
            <div className="flex justify-between text-[8px] font-mono text-slate-500">
              <span>8px ({lang === "ar" ? "صغير" : "Small"})</span>
              <span>13px ({lang === "ar" ? "معياري" : "Default"})</span>
              <span>32px ({lang === "ar" ? "ضخم" : "Huge"})</span>
            </div>
          </div>

          {/* Quick Font Size Preset Buttons */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[9px] text-slate-400 font-bold shrink-0">
              {lang === "ar" ? "سريع:" : "Presets:"}
            </span>
            {[9, 11, 13, 15, 18, 22].map((sz) => {
              const isSelected = settings.fontSize === sz;
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => onUpdateSettings((p) => ({ ...p, fontSize: sz }))}
                  className={`flex-1 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#0075DE] text-white shadow-sm"
                      : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {sz}
                </button>
              );
            })}
          </div>
        </div>

        {/* Spacing Density Modes */}
        <div>
          <label className="block text-slate-400 mb-1.5 text-[10px] font-bold">
            {lang === "ar" ? "نمط كثافة الهوامش والبطاقات:" : "Density Preset:"}
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

        {/* Line Spacing / Line Height Slider & Control */}
        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-slate-300 text-[11px] font-bold">
              {lang === "ar" ? "ارتفاع ومسافة الأسطر (Line Height):" : "Line Height / Spacing:"}
            </label>
            <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
              ×{(settings.lineHeight || 1.55).toFixed(2)}
            </span>
          </div>

          <div className="space-y-1">
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
            <div className="flex justify-between text-[8px] font-mono text-slate-500">
              <span>×1.10 ({lang === "ar" ? "مضغوط" : "Tight"})</span>
              <span>×1.55 ({lang === "ar" ? "معياري" : "Normal"})</span>
              <span>×2.30 ({lang === "ar" ? "متباعد" : "Spacious"})</span>
            </div>
          </div>

          {/* Quick Line Height Presets */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-[9px] text-slate-400 font-bold shrink-0">
              {lang === "ar" ? "خيارات:" : "Options:"}
            </span>
            {[1.2, 1.4, 1.6, 1.8, 2.0].map((lh) => {
              const isSelected = Math.abs((settings.lineHeight || 1.55) - lh) < 0.04;
              return (
                <button
                  key={lh}
                  type="button"
                  onClick={() => onUpdateSettings((p) => ({ ...p, lineHeight: lh }))}
                  className={`flex-1 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  ×{lh}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 3: عناصر العرض (Toggle Switches) */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2 text-slate-300 font-black text-[11px] uppercase tracking-wider">
          <Eye className="w-3.5 h-3.5 text-[#0075DE]" />
          <span>{lang === "ar" ? "٣. عناصر العرض والتوثيق" : "3. Document Elements"}</span>
        </div>

        <div className="space-y-1.5">
          {toggleItems.map((item) => {
            const isChecked = Boolean((settings as any)[item.key]);
            return (
              <div
                key={item.key}
                onClick={() =>
                  onUpdateSettings((p) => ({ ...p, [item.key]: !isChecked }))
                }
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  isChecked
                    ? "bg-slate-950/80 border-slate-800 text-slate-100 hover:border-slate-700"
                    : "bg-slate-950/40 border-slate-850 text-slate-500 opacity-60"
                }`}
              >
                <span className="text-[11px] font-bold">
                  {lang === "ar" ? item.labelAr : item.labelEn}
                </span>

                {/* Sleek Toggle Switch */}
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                    isChecked ? "bg-[#0075DE] justify-end" : "bg-slate-800 justify-start"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: الربط التلقائي والاعتماد المؤسسي (Profile Connected Source) */}
      <div className="mb-6 p-3.5 bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-extrabold text-white text-[11px]">
              {lang === "ar" ? "بيانات الاعتماد والملف الشخصي" : "Profile Identity Binding"}
            </span>
          </div>
          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold rounded-full">
            {lang === "ar" ? "ربط تلقائي" : "Auto-synced"}
          </span>
        </div>

        <div className="space-y-1.5 text-[10px] text-slate-300 divide-y divide-slate-800/80">
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-400">{lang === "ar" ? "المسؤول المعتمد:" : "Approver:"}</span>
            <span className="font-bold text-white truncate max-w-[170px]">
              {settings.approverName || "System Admin"}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1.5">
            <span className="text-slate-400">{lang === "ar" ? "المنظمة / المؤسسة:" : "Organization:"}</span>
            <span className="font-bold text-slate-200 truncate max-w-[170px]">
              {settings.companyName}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1.5">
            <span className="text-slate-400">{lang === "ar" ? "التوقيع الرقمي:" : "Signature:"}</span>
            <span className={`font-bold ${settings.signatureImg ? "text-emerald-400" : "text-amber-400"}`}>
              {settings.signatureImg ? (lang === "ar" ? "معتمد ومرفوع ✓" : "Uploaded ✓") : (lang === "ar" ? "ختم افتراضي" : "Default Stamp")}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1.5">
            <span className="text-slate-400">{lang === "ar" ? "شعار المؤسسة:" : "Logo:"}</span>
            <span className={`font-bold ${settings.companyLogoImg ? "text-emerald-400" : "text-blue-400"}`}>
              {settings.companyLogoImg ? (lang === "ar" ? "شعار مخصص ✓" : "Custom Logo ✓") : (lang === "ar" ? "شعار ذاكر" : "Zakir Logo")}
            </span>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800">
          {lang === "ar"
            ? "يتم جلب اسم المعتمد، المسمى الوظيفي، الشعار، والتوقيع آلياً من حسابك الشخصي في النظام لضمان مصداقية التوثيق."
            : "Approver name, title, signature, and logo are fetched automatically from your verified profile settings."}
        </p>
      </div>

      {/* SECTION 5: تحديد الذكريات (Memory Selection) */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-black text-[11px] uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-[#0075DE]" />
            <span>{lang === "ar" ? "٤. السجلات المضمنة" : "4. Included Memories"}</span>
          </div>
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
    </aside>
  );
};
