import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TimelineSummary } from "@/types/metrics";
import { useTimelineSummary } from "@/hooks/useTimelineSummary";

type Granularity = "week" | "month";

function formatPeriod(period: string, granularity: Granularity): string {
  if (granularity === "month") {
    const [year, month] = period.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("es-ES", {
      month: "short",
      year: "numeric",
    });
  }
  const [year, month, day] = period.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

function TrendBadge({
  direction,
  percentage,
}: {
  direction: TimelineSummary["trend_direction"];
  percentage: number | null;
}) {
  if (direction === "insufficient_data") return null;

  const pct = percentage !== null ? Math.abs(percentage).toFixed(1) : "0";

  const config: Record<string, { label: string; className: string }> = {
    improving: {
      label: `↑ +${pct}%`,
      className: "bg-green-100 text-green-700 border border-green-200",
    },
    declining: {
      label: `↓ -${pct}%`,
      className: "bg-red-100 text-red-700 border border-red-200",
    },
    stable: {
      label: "→ Estable",
      className: "bg-slate-100 text-slate-600 border border-slate-200",
    },
  };

  const item = config[direction];
  if (!item) return null;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.className}`}
    >
      {item.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-700">Sin historial aún</p>
      <p className="text-xs text-slate-400 mt-1">
        Completa tu primera entrevista para ver tu evolución
      </p>
    </div>
  );
}

export function TimelineChart() {
  const [granularity, setGranularity] = useState<Granularity>("week");
  const { data, isLoading, error } = useTimelineSummary(granularity);

  const isEmpty = !data || data.points.length === 0;
  const chartData =
    data?.points.map((p) => ({
      ...p,
      label: formatPeriod(p.period, granularity),
    })) ?? [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Evolución temporal</h3>
          <p className="text-xs text-slate-400 mt-0.5">Promedio de score por período</p>
        </div>
        <div className="flex items-center gap-2">
          {data && !isEmpty && (
            <TrendBadge direction={data.trend_direction} percentage={data.trend_percentage} />
          )}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {(["week", "month"] as Granularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  granularity === g
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {g === "week" ? "Semanas" : "Meses"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="h-48 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && error && (
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {!isLoading && !error && isEmpty && <EmptyState />}

      {!isLoading && !error && !isEmpty && (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
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
              formatter={(value) => [value ?? 0, "Score"]}
              labelStyle={{ fontWeight: 600, color: "#1e293b" }}
            />
            <Line
              type="monotone"
              dataKey="avg_score"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
