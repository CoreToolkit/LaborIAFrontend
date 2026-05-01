import React from "react";
import { AlertCircle, RefreshCw, Briefcase, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatchProgressBar } from "@/components/MatchProgressBar";
import { SkillGapBadge } from "@/components/SkillGapBadge";
import { getRecommendations } from "@/services/matchingService";
import { RoleRecommendation } from "@/types/matching";
import { getAccessToken } from "@/utils/session";
import { cn } from "@/utils/cn";

const CATEGORY_LABELS: Record<string, string> = {
  tech: "Tecnología",
  data: "Datos",
  design: "Diseño",
};

const CATEGORY_STYLES: Record<string, string> = {
  tech: "bg-blue-50 text-blue-700 border-blue-200",
  data: "bg-violet-50 text-violet-700 border-violet-200",
  design: "bg-pink-50 text-pink-700 border-pink-200",
};

const SENIORITY_STYLES: Record<string, string> = {
  junior: "bg-emerald-50 text-emerald-700 border-emerald-200",
  mid: "bg-sky-50 text-sky-700 border-sky-200",
  senior: "bg-amber-50 text-amber-700 border-amber-200",
};

function RoleCard({ role }: { role: RoleRecommendation }) {
  const topGaps = (role.skill_gaps ?? []).slice(0, 3);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-800 truncate">{role.role_name}</h4>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span
              className={cn(
                "inline-block rounded-full border px-2 py-0.5 text-xs font-medium",
                CATEGORY_STYLES[role.category] ?? "bg-slate-50 text-slate-600 border-slate-200"
              )}
            >
              {CATEGORY_LABELS[role.category] ?? role.category}
            </span>
            <span
              className={cn(
                "inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                SENIORITY_STYLES[role.seniority_level] ?? "bg-slate-50 text-slate-600 border-slate-200"
              )}
            >
              {role.seniority_level}
            </span>
            <span className="inline-block rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
              Inglés {role.min_english_level}
            </span>
          </div>
        </div>
      </div>

      <MatchProgressBar score={role.total_score} />

      {role.description && (
        <p className="text-xs text-slate-500 leading-relaxed border-l-2 border-blue-200 pl-3">
          {role.description}
        </p>
      )}

      {topGaps.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Skills a reforzar</p>
          <div className="flex flex-wrap gap-1.5">
            {topGaps.map((gap) => (
              <SkillGapBadge key={gap.skill_name} gap={gap} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecommendationsListSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm animate-pulse">
      <div className="h-5 w-48 rounded bg-slate-200 mb-1" />
      <div className="h-3 w-64 rounded bg-slate-100 mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-100 p-5 space-y-3">
            <div className="h-4 w-40 rounded bg-slate-200" />
            <div className="flex gap-2">
              <div className="h-5 w-20 rounded-full bg-slate-100" />
              <div className="h-5 w-14 rounded-full bg-slate-100" />
            </div>
            <div className="h-3 w-full rounded bg-slate-100" />
            <div className="flex gap-2">
              <div className="h-5 w-24 rounded-full bg-slate-100" />
              <div className="h-5 w-20 rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 mb-4">
        <Star className="h-7 w-7 text-blue-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700">¡Tu perfil tiene potencial!</p>
      <p className="text-xs text-slate-400 mt-1.5 max-w-xs">
        Completa tu perfil y calcula tu match para ver los roles que mejor se adaptan a ti.
      </p>
    </div>
  );
}

export function RecommendationsList() {
  const [data, setData] = React.useState<RoleRecommendation[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const token = getAccessToken();
    if (!token) {
      setError("Sesión expirada. Inicia sesión nuevamente.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await getRecommendations(token);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "No se pudieron cargar las recomendaciones."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) return <RecommendationsListSkeleton />;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
        <div className="flex items-start gap-2 text-sm text-red-600 mb-3">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-red-200 text-red-600 hover:bg-red-100"
          onClick={() => void load()}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Briefcase className="h-4 w-4 text-slate-400" />
        <h3 className="text-base font-semibold text-slate-800">Roles Recomendados</h3>
      </div>
      <p className="text-xs text-slate-400 mb-5">
        Basado en tu perfil, skills y experiencia
      </p>

      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {data.map((role) => (
            <RoleCard key={role.role_id} role={role} />
          ))}
        </div>
      )}
    </div>
  );
}
