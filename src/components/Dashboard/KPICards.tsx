import React from "react";
import { TrendingUp, Mic, Trophy, AlertTriangle, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMetricsResponse } from "@/types/metrics";

interface KPIItem {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent: string;
  bg: string;
  iconBg: string;
}

function deriveKPIs(data: UserMetricsResponse): KPIItem[] {
  const skills = Object.entries(data.score_by_skill);
  const strongest = skills.length ? skills.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
  const weakest = skills.length ? skills.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;

  return [
    {
      label: "Score Promedio",
      value: `${Math.round(data.avg_score)}`,
      sub: "sobre 100 puntos",
      icon: <TrendingUp className="h-5 w-5" />,
      accent: "text-blue-600",
      bg: "bg-blue-50 border-blue-100",
      iconBg: "bg-blue-100 text-blue-600",
    },
    {
      label: "Total Entrevistas",
      value: `${data.total_interviews}`,
      sub: data.total_interviews === 1 ? "entrevista realizada" : "entrevistas realizadas",
      icon: <Mic className="h-5 w-5" />,
      accent: "text-violet-600",
      bg: "bg-violet-50 border-violet-100",
      iconBg: "bg-violet-100 text-violet-600",
    },
    {
      label: "Skill más fuerte",
      value: strongest ? `${Math.round(strongest[1])} pts` : "—",
      sub: strongest ? strongest[0] : "Sin datos aún",
      icon: <Trophy className="h-5 w-5" />,
      accent: "text-emerald-600",
      bg: "bg-emerald-50 border-emerald-100",
      iconBg: "bg-emerald-100 text-emerald-600",
    },
    {
      label: "Mayor brecha",
      value: weakest ? `${Math.round(weakest[1])} pts` : "—",
      sub: weakest ? weakest[0] : "Sin datos aún",
      icon: <AlertTriangle className="h-5 w-5" />,
      accent: "text-amber-600",
      bg: "bg-amber-50 border-amber-100",
      iconBg: "bg-amber-100 text-amber-600",
    },
  ];
}

function KPICardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-28 rounded bg-slate-200" />
        <div className="h-9 w-9 rounded-full bg-slate-200" />
      </div>
      <div className="h-9 w-20 rounded bg-slate-200 mb-2" />
      <div className="h-3 w-24 rounded bg-slate-100" />
    </div>
  );
}

function KPICard({ label, value, sub, icon, accent, bg, iconBg }: KPIItem) {
  return (
    <div className={`rounded-2xl border ${bg} bg-white p-5 shadow-sm`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </span>
      </div>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400 capitalize">{sub}</p>
    </div>
  );
}

interface KPICardsProps {
  data: UserMetricsResponse | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function KPICards({ data, isLoading, error, onRetry }: KPICardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
        <div className="flex items-start gap-2 text-sm text-red-600 mb-3">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
        <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-100" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Reintentar
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {deriveKPIs(data).map((kpi) => <KPICard key={kpi.label} {...kpi} />)}
    </div>
  );
}
