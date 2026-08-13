import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";
import { motion } from "motion/react";
import { AlertTriangle, Activity } from "lucide-react";
import { RiskAlert, Memory } from "../types";

interface RiskRadarChartProps {
  riskAlerts: RiskAlert[];
  memories?: Memory[];
  lang?: "ar" | "en" | "fr";
  theme?: "dark" | "light";
}

export const RiskRadarChart: React.FC<RiskRadarChartProps> = ({
  riskAlerts,
  memories = [],
  lang = "ar",
  theme = "dark",
}) => {
  // Localization dictionaries for categories and labels
  const labels = useMemo(() => {
    if (lang === "ar") {
      return {
        title: "رادار تركيز المخاطر حسب المجال",
        subtitle: "تحليل شبكي تفاعلي لنسب توزيع واستفحال المخاطر في القطاعات المختلفة",
        financial: "الهندسة المالية",
        operational: "العمليات التشغيلية",
        fx: "مخاطر العملات (FX)",
        compliance: "الامتثال والجمرك",
        cyber: "الأمن السيبراني والـ IT",
        supply: "سلاسل الإمداد والتوريد",
        riskIndex: "مؤشر تركيز المخاطر (%)",
        activeAlerts: "التنبيهات النشطة",
        totalEvents: "إجمالي الأحداث المسجلة",
        highRiskCategories: "أبرز قطاعات المخاطر المرتفعة",
        resolvedCount: "المحلولة",
        criticalSeverity: "حرجة جداً",
        noData: "لا توجد بيانات كافية لحساب الرادار حالياً",
      };
    } else if (lang === "fr") {
      return {
        title: "Radar de Concentration des Risques",
        subtitle: "Analyse matricielle de la répartition des risques par domaine opérationnel",
        financial: "Ingénierie Financière",
        operational: "Opérations",
        fx: "Gestion Risque Change (FX)",
        compliance: "Conformité & Douanes",
        cyber: "Cybersécurité & IT",
        supply: "Chaîne d'Approvisionnement",
        riskIndex: "Indice de Risque (%)",
        activeAlerts: "Alertes Actives",
        totalEvents: "Événements Enregistrés",
        highRiskCategories: "Secteurs à Haut Risque",
        resolvedCount: "Résolues",
        criticalSeverity: "Critique",
        noData: "Aucune donnée disponible",
      };
    } else {
      return {
        title: "Risk Category Concentration Radar",
        subtitle: "Interactive grid analysis mapping risk intensity across operational domains",
        financial: "Financial Engineering",
        operational: "Operational Assets",
        fx: "FX Risk Management",
        compliance: "Customs & Compliance",
        cyber: "IT & Cybersecurity",
        supply: "Supply Chain & Logistics",
        riskIndex: "Risk Concentration Index (%)",
        activeAlerts: "Active Alerts",
        totalEvents: "Logged Events",
        highRiskCategories: "High-Risk Concentration Sectors",
        resolvedCount: "Resolved",
        criticalSeverity: "Critical Severity",
        noData: "No data available",
      };
    }
  }, [lang]);

  // Define 6 standard operational categories for the radar polygon
  const radarCategories = useMemo(() => {
    return [
      { key: "financial", name: labels.financial, keywords: ["financial", "finance", "مالية", "financier", "treasury"] },
      { key: "operational", name: labels.operational, keywords: ["operational", "operations", "تشغيل", "opération"] },
      { key: "fx", name: labels.fx, keywords: ["fx", "currency", "hedging", "سعر الصرف", "عملات", "change"] },
      { key: "compliance", name: labels.compliance, keywords: ["customs", "compliance", "sanctions", "جمرك", "امتثال", "douane"] },
      { key: "cyber", name: labels.cyber, keywords: ["cyber", "it", "security", "شبكة", "أمن", "سيبراني", "sécurité"] },
      { key: "supply", name: labels.supply, keywords: ["supply", "logistics", "shipping", "توريد", "سلاسل", "logistique"] },
    ];
  }, [labels]);

  // Calculate scores and counts per radar category
  const radarData = useMemo(() => {
    const levelWeight: Record<string, number> = {
      Critical: 100,
      High: 75,
      Medium: 50,
      Low: 25,
    };

    return radarCategories.map((cat) => {
      // Find matching risk alerts
      const matchingAlerts = riskAlerts.filter((a) => {
        const catLower = (a.category || "").toLowerCase();
        const titleLower = (a.title || "").toLowerCase();
        return cat.keywords.some((kw) => catLower.includes(kw) || titleLower.includes(kw));
      });

      // Find matching memories
      const matchingMemories = memories.filter((m) => {
        const catLower = (m.category || "").toLowerCase();
        const titleLower = (m.title || "").toLowerCase();
        const tagsStr = (m.tags || []).join(" ").toLowerCase();
        const descLower = (m.description || "").toLowerCase();

        const matchesKeyword = cat.keywords.some((kw) =>
          catLower.includes(kw) || titleLower.includes(kw) || tagsStr.includes(kw) || descLower.includes(kw)
        );

        if (matchesKeyword) return true;

        // Fallback: If memory category doesn't match any of the specialized buckets, route to operational
        if (cat.key === "operational") {
          const isSpecialized = ["financial", "finance", "مالية", "fx", "currency", "hedging", "سعر الصرف", "customs", "compliance", "sanctions", "جمرك", "امتثال", "cyber", "security", "أمن", "supply", "logistics", "توريد"].some((kw) =>
            catLower.includes(kw) || titleLower.includes(kw) || tagsStr.includes(kw)
          );
          return !isSpecialized;
        }

        return false;
      });

      const activeAlertsCount = matchingAlerts.filter((a) => a.status !== "Resolved").length;
      const totalCatEvents = matchingAlerts.length + matchingMemories.length;

      // If no memories or alerts in this sector, concentration score is strictly 0%
      if (totalCatEvents === 0) {
        return {
          category: cat.name,
          categoryKey: cat.key,
          riskScore: 0,
          activeAlerts: 0,
          totalEvents: 0,
        };
      }

      // Calculate score based strictly on actual memories and active alerts
      let sumWeight = 0;
      matchingMemories.forEach((m) => {
        sumWeight += levelWeight[m.riskLevel] || 50;
      });

      matchingAlerts.forEach((a) => {
        const w = levelWeight[a.severity] || 50;
        sumWeight += a.status === "Active" ? w : w * 0.2;
      });

      // Average risk severity weighted by volume factor
      const avgWeight = sumWeight / totalCatEvents;
      const frequencyMultiplier = Math.min(1.25, 1 + (totalCatEvents - 1) * 0.08);
      const calculatedScore = Math.min(100, Math.round(avgWeight * frequencyMultiplier));

      return {
        category: cat.name,
        categoryKey: cat.key,
        riskScore: calculatedScore,
        activeAlerts: activeAlertsCount,
        totalEvents: totalCatEvents,
      };
    });
  }, [riskAlerts, memories, radarCategories]);

  // Find top risk category
  const topRiskCat = useMemo(() => {
    return [...radarData].sort((a, b) => b.riskScore - a.riskScore)[0];
  }, [radarData]);

  const isDark = theme === "dark";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1], // Smooth entrance easing curve
      }}
      className={`rounded-2xl p-6 border shadow-xl relative overflow-hidden transition-all ${
        isDark
          ? "bg-slate-900/60 border-slate-800/80 text-white backdrop-blur-sm"
          : "bg-white border-slate-200 text-slate-900 shadow-slate-100"
      }`}
    >
      {/* Background ambient gradient glow */}
      <div
        className={`absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
          isDark ? "bg-[#0075DE]/10" : "bg-blue-400/10"
        }`}
      />
      <div
        className={`absolute -bottom-24 -left-24 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
          isDark ? "bg-rose-500/10" : "bg-rose-400/10"
        }`}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl flex items-center justify-center border ${
                isDark
                  ? "bg-[#0075DE]/10 text-[#0075DE] border-[#0075DE]/20"
                  : "bg-blue-50 text-[#0075DE] border-blue-200"
              }`}
            >
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black tracking-tight">{labels.title}</h3>
          </div>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {labels.subtitle}
          </p>
        </div>

        {/* Top risk sector badge */}
        {topRiskCat && topRiskCat.riskScore > 0 && (
          <div
            className={`px-3.5 py-2 rounded-xl border flex items-center gap-2.5 text-xs font-bold ${
              topRiskCat.riskScore >= 70
                ? isDark
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : "bg-rose-50 border-rose-200 text-rose-700"
                : isDark
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] opacity-75 font-normal">{labels.highRiskCategories}</span>
              <span className="font-extrabold">{topRiskCat.category}: {topRiskCat.riskScore}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Radar Chart Visual */}
      <div className="w-full h-[320px] relative z-10 my-2">
        {riskAlerts.length === 0 && memories.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 border border-dashed rounded-xl border-slate-700/60 bg-slate-950/20">
            <Activity className="w-10 h-10 text-slate-500 mb-2 opacity-60" />
            <p className="text-sm font-bold text-slate-300">{labels.noData}</p>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              {lang === "ar"
                ? "سيتشكل رادار تركيز المخاطر تلقائياً فور تسجيل أولى أحداث الذاكرة والدروس المستفادة."
                : lang === "fr"
                ? "Le radar de risques se remplira automatiquement une fois les premiers événements enregistrés."
                : "The Risk Concentration Radar will auto-populate as institutional memories and events are logged."}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="66%" margin={{ top: 15, right: 25, bottom: 15, left: 25 }} data={radarData}>
              <defs>
                <linearGradient id="radarRiskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.65} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.25} />
                </linearGradient>
              </defs>

              <PolarGrid
                stroke="var(--border-color, #cbd5e1)"
                strokeDasharray="3 3"
              />
              <PolarAngleAxis
                dataKey="category"
                tick={{
                  fill: isDark ? "#e2e8f0" : "#1e293b",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{
                  fill: isDark ? "#94a3b8" : "#64748b",
                  fontSize: 9,
                }}
                stroke="var(--border-color, #cbd5e1)"
              />

              <Radar
                name={labels.riskIndex}
                dataKey="riskScore"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#radarRiskGradient)"
                fillOpacity={0.55}
                isAnimationActive={true}
                animationDuration={500}
                animationEasing="ease-out"
              />

              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div
                        className="p-3.5 rounded-xl border shadow-2xl backdrop-blur-md text-xs space-y-1.5 bg-slate-900 border-slate-700 text-white"
                      >
                        <div className="font-black border-b border-slate-700 pb-1 flex items-center justify-between gap-4">
                          <span>{data.category}</span>
                          <span className="text-amber-400 font-extrabold">{data.riskScore}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-[11px] text-slate-300">
                          <span>{labels.activeAlerts}:</span>
                          <span className="font-bold text-rose-400">{data.activeAlerts}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-[11px] text-slate-300">
                          <span>{labels.totalEvents}:</span>
                          <span className="font-medium">{data.totalEvents}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Grid Summary Cards underneath chart */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-4 border-t border-[var(--border-color)] relative z-10">
        {radarData.map((item) => (
          <div
            key={item.categoryKey}
            className="p-2.5 rounded-xl border transition-all bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--accent-color)]"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold truncate text-[var(--text-primary)]">
                {item.category}
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                  item.riskScore >= 70
                    ? "bg-rose-500/20 text-rose-500"
                    : item.riskScore >= 45
                    ? "bg-amber-500/20 text-amber-500"
                    : "bg-emerald-500/20 text-emerald-500"
                }`}
              >
                {item.riskScore}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-[var(--bg-tertiary)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.riskScore}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                className={`h-full rounded-full ${
                  item.riskScore >= 70
                    ? "bg-rose-500"
                    : item.riskScore >= 45
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
