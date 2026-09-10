import React from "react";
import {
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area 
} from "recharts";
import { TrendingUp } from "lucide-react";

interface DashboardAnalyticsChartProps {
  categoryChartType: "bar" | "line" | "area" | "donut" | "pie";
  chartDataCategory: Array<{ name: string; value: number; color?: string }>;
  theme: string;
  isRtl: boolean;
}

export const DashboardAnalyticsChart: React.FC<DashboardAnalyticsChartProps> = React.memo(({
  categoryChartType,
  chartDataCategory,
  theme,
  isRtl
}) => {
  if (!chartDataCategory || chartDataCategory.length === 0) {
    return (
      <div className={`h-full flex flex-col items-center justify-center text-center p-6 border border-dashed rounded-xl ${
        theme === "dark" ? "border-slate-800 bg-slate-950/20" : "border-slate-200 bg-slate-50"
      }`}>
        <TrendingUp className="w-10 h-10 text-slate-500 mb-2 opacity-40" />
        <p className="text-xs text-slate-400 font-medium">
          {isRtl 
            ? "لا توجد بيانات تصنيفية مسجلة بعد. أضف ذكريات جديدة لعرض التوزيع البياني." 
            : "No category distribution data yet. Add memories to populate the chart."}
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      {categoryChartType === "bar" ? (
        <BarChart data={chartDataCategory} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
          <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
          <ChartTooltip 
            contentStyle={{ 
              backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff", 
              borderColor: theme === "dark" ? "#1e293b" : "#e2e8f0",
              borderRadius: "8px",
              color: theme === "dark" ? "#f8fafc" : "#0f172a",
              fontSize: "12px"
            }} 
          />
          <Bar dataKey="value" fill="#0075DE" radius={[4, 4, 0, 0]}>
            {chartDataCategory.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || (index % 2 === 0 ? "#0075DE" : "#005BAB")} />
            ))}
          </Bar>
        </BarChart>
      ) : categoryChartType === "line" ? (
        <LineChart data={chartDataCategory} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
          <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
          <ChartTooltip 
            contentStyle={{ 
              backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff", 
              borderColor: theme === "dark" ? "#1e293b" : "#e2e8f0",
              borderRadius: "8px",
              color: theme === "dark" ? "#f8fafc" : "#0f172a",
              fontSize: "12px"
            }} 
          />
          <Line 
            type="natural" 
            dataKey="value" 
            stroke="#0075DE" 
            strokeWidth={3} 
            dot={{ r: 5, fill: "#0075DE", stroke: theme === "dark" ? "#0b0f19" : "#ffffff", strokeWidth: 2 }} 
            activeDot={{ r: 7, fill: "#ffffff", stroke: "#0075DE", strokeWidth: 2 }} 
          />
        </LineChart>
      ) : categoryChartType === "area" ? (
        <AreaChart data={chartDataCategory} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValueCat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0075DE" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#0075DE" stopOpacity={0.01}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
          <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
          <ChartTooltip 
            contentStyle={{ 
              backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff", 
              borderColor: theme === "dark" ? "#1e293b" : "#e2e8f0",
              borderRadius: "8px",
              color: theme === "dark" ? "#f8fafc" : "#0f172a",
              fontSize: "12px"
            }} 
          />
          <Area 
            type="natural" 
            dataKey="value" 
            stroke="#0075DE" 
            strokeWidth={3} 
            fillOpacity={1} 
            fill="url(#colorValueCat)" 
          />
        </AreaChart>
      ) : (
        <PieChart>
          <ChartTooltip 
            contentStyle={{ 
              backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff", 
              borderColor: theme === "dark" ? "#1e293b" : "#e2e8f0",
              borderRadius: "8px",
              color: theme === "dark" ? "#f8fafc" : "#0f172a",
              fontSize: "12px"
            }} 
          />
          <Pie
            data={chartDataCategory}
            cx="50%"
            cy="45%"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={4}
            dataKey="value"
          >
            {chartDataCategory.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || ["#0075DE", "#005BAB", "#0D7A82", "#14B8A6", "#8B5CF6"][index % 5]} />
            ))}
          </Pie>
        </PieChart>
      )}
    </ResponsiveContainer>
  );
});

export default DashboardAnalyticsChart;
