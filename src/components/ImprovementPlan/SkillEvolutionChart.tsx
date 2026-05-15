import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ImprovementPlanHistoryEntry } from "@/types/improvementPlan";

const SKILL_COLORS = [
  "#2563eb", "#16a34a", "#ea580c", "#9333ea",
  "#0891b2", "#be185d", "#ca8a04", "#0d9488",
];

interface SkillEvolutionChartProps {
  history: ImprovementPlanHistoryEntry[];
  isLoading: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function SkillEvolutionChart({ history, isLoading }: SkillEvolutionChartProps) {
  if (isLoading) {
    return (
      <div className="h-52 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length < 2) {
    return (
      <div className="h-52 flex flex-col items-center justify-center text-center">
        <p className="text-sm font-medium text-slate-600">Sin historial aún</p>
        <p className="text-xs text-slate-400 mt-1">
          La gráfica se mostrará después de la primera actualización del plan
        </p>
      </div>
    );
  }

  const allSkills = [
    ...new Set(
      [...history].reverse().flatMap((e) => e.snapshot.items.map((i) => i.skill))
    ),
  ];

  const chartData = [...history].reverse().map((entry) => {
    const point: Record<string, unknown> = {
      label: `v${entry.version}`,
      date: formatDate(entry.created_at),
    };
    entry.snapshot.items.forEach((item) => {
      point[item.skill] = Math.round(item.current_score);
    });
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
          labelStyle={{ fontWeight: 600, color: "#1e293b" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        {allSkills.map((skill, i) => (
          <Line
            key={skill}
            type="monotone"
            dataKey={skill}
            stroke={SKILL_COLORS[i % SKILL_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
