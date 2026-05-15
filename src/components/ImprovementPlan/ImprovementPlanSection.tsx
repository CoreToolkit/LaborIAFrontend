import React from "react";
import { ImprovementPlan, ImprovementPlanHistoryEntry } from "@/types/improvementPlan";
import { RefreshResult } from "@/hooks/useImprovementPlan";
import { ImprovementPlanCard } from "./ImprovementPlanCard";
import { SkillEvolutionChart } from "./SkillEvolutionChart";

interface ImprovementPlanSectionProps {
  plan: ImprovementPlan | null;
  history: ImprovementPlanHistoryEntry[];
  isPlanLoading: boolean;
  isHistoryLoading: boolean;
  error: string | null;
  refreshResult: RefreshResult | null;
  onRefresh: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3 shadow-sm">
      <div className="h-4 w-1/3 rounded animate-pulse bg-slate-100" />
      <div className="h-2 w-full rounded-full animate-pulse bg-slate-100" />
      <div className="h-2 w-3/4 rounded animate-pulse bg-slate-100" />
      <div className="h-2 w-1/2 rounded animate-pulse bg-slate-100" />
    </div>
  );
}

const REFRESH_BANNER_TTL = 4000;

function RefreshBanner({ result }: { result: RefreshResult }) {
  if (result.updated) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 flex items-center gap-2">
        <span className="text-green-600 text-sm">✓</span>
        <p className="text-sm text-green-700 font-medium">Plan actualizado correctamente.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 flex items-center gap-2">
      <span className="text-slate-400 text-sm">→</span>
      <p className="text-sm text-slate-600">Tu plan está al día, no hay cambios por ahora.</p>
    </div>
  );
}

export function ImprovementPlanSection({
  plan,
  history,
  isPlanLoading,
  isHistoryLoading,
  error,
  refreshResult,
  onRefresh,
}: ImprovementPlanSectionProps) {
  const [visibleResult, setVisibleResult] = React.useState<RefreshResult | null>(null);

  React.useEffect(() => {
    if (!refreshResult) return;
    setVisibleResult(refreshResult);
    const t = setTimeout(() => setVisibleResult(null), REFRESH_BANNER_TTL);
    return () => clearTimeout(t);
  }, [refreshResult]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Section header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Plan de Mejora</h2>
          {plan && !isPlanLoading && (
            <p className="text-xs text-slate-400 mt-0.5">
              Versión {plan.version} · Actualizado el {formatDate(plan.last_updated_at)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isPlanLoading}
          className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 ${isPlanLoading ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Actualizar plan
        </button>
      </div>

      {/* Refresh feedback banner */}
      {visibleResult && !isPlanLoading && (
        <RefreshBanner result={visibleResult} />
      )}

      {/* Error */}
      {error && !isPlanLoading && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Skill evolution chart */}
      {!error && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Evolución por skill
          </h3>
          <SkillEvolutionChart history={history} isLoading={isHistoryLoading} />
        </div>
      )}

      {/* Skills list */}
      {!error && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Skills a mejorar
          </h3>

          {isPlanLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : !plan || plan.items.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay skills en tu plan de mejora todavía. Completa más entrevistas para obtener recomendaciones.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {plan.items.map((item) => (
                <ImprovementPlanCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
