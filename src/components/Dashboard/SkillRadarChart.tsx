import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { AlertCircle, RefreshCw, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMetricsResponse } from "@/types/metrics";

const SKILL_LABELS: Record<string, string> = {
  correctness: "Corrección",
  completeness: "Completitud",
  clarity: "Claridad",
  examples: "Ejemplos",
};

function formatSkillLabel(key: string): string {
  return SKILL_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

interface RadarPoint {
  skill: string;
  score: number;
  fullMark: number;
}

function toRadarData(scoreBySkill: Record<string, number>): RadarPoint[] {
  return Object.entries(scoreBySkill).map(([key, value]) => ({
    skill: formatSkillLabel(key),
    score: Math.round(value),
    fullMark: 100,
  }));
}

interface TooltipPayload {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-slate-700">{label}</p>
      <p className="text-blue-600 font-bold">{payload[0].value} pts</p>
    </div>
  );
}

function SkillRadarChartSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm animate-pulse">
      <div className="h-5 w-40 rounded bg-slate-200 mb-1" />
      <div className="h-3 w-56 rounded bg-slate-100 mb-6" />
      <div className="flex items-center justify-center">
        <div className="h-64 w-64 rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
        <BarChart3 className="h-7 w-7 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600">Sin datos de skills aún</p>
      <p className="text-xs text-slate-400 mt-1">
        Completa entrevistas para ver tu radar de habilidades
      </p>
    </div>
  );
}

interface SkillRadarChartProps {
  data: UserMetricsResponse | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function SkillRadarChart({ data, isLoading, error, onRetry }: SkillRadarChartProps) {
  if (isLoading) return <SkillRadarChartSkeleton />;

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

  const radarData = data ? toRadarData(data.score_by_skill) : [];
  const hasData = radarData.length >= 3;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-slate-800">Radar de Skills</h3>
      <p className="text-xs text-slate-400 mt-0.5 mb-4">Score promedio por habilidad evaluada</p>

      {!hasData ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="skill" tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tickCount={5} tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }} />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
