import React from "react";
import { BarChart2, CheckCircle2, RefreshCw } from "lucide-react";
import { useUserMetrics } from "@/hooks/useUserMetrics";

const SKILL_LABELS: Record<string, string> = {
  correctness: "Correctness",
  completeness: "Completeness",
  clarity: "Clarity",
  examples: "Examples",
};

function SkillBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm text-slate-700">{label}</span>
      <progress
        className="flex-1 h-2 rounded-full appearance-none [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-indigo-500 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-indigo-500"
        max={100}
        value={pct}
        aria-label={`${label}: ${pct.toFixed(1)}%`}
      />
      <span className="w-12 text-right text-sm text-slate-500 tabular-nums">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export function ProfileStatsTab() {
  const { data, isLoading, error, reload } = useUserMetrics();

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold text-slate-800">
        Estadísticas de entrenamiento
      </h3>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Main metric cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100">
                  <BarChart2 className="w-4 h-4 text-slate-500" />
                </div>
                <span className="text-sm text-slate-500">Entrevistas realizadas</span>
              </div>
              <p className="text-4xl font-bold text-slate-900 tabular-nums">
                {data?.total_interviews ?? 0}
              </p>
            </div>

            <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-sm text-green-700">Puntuación promedio</span>
              </div>
              <p className="text-4xl font-bold text-green-900 tabular-nums">
                {data?.avg_score.toFixed(1) ?? "0.0"}
                <span className="text-xl font-semibold ml-0.5">%</span>
              </p>
            </div>
          </div>

          {/* Skill breakdown */}
          {data && Object.keys(data.score_by_skill).length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Puntuación por habilidad
              </p>
              <div className="space-y-3">
                {Object.entries(data.score_by_skill)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, value]) => (
                    <SkillBar
                      key={key}
                      label={SKILL_LABELS[key] ?? key}
                      value={value}
                    />
                  ))}
              </div>
            </div>
          )}

          {data?.total_interviews === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">
              Aún no has realizado ninguna entrevista. ¡Practica para ver tu progreso aquí!
            </p>
          )}
        </>
      )}
    </div>
  );
}
