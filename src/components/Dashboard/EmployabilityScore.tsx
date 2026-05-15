import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEmployabilityScore } from "@/services/metricsService";
import { EmployabilityScoreResponse } from "@/types/metrics";
import { getAccessToken } from "@/utils/session";

interface BreakdownBarProps {
  label: string;
  value: number;
  colorClass: string;
  accentClass: string;
}

function BreakdownBar({ label, value, colorClass, accentClass }: BreakdownBarProps) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-slate-300">{label}</span>
        <span className={`font-semibold ${accentClass}`}>{value}%</span>
      </div>
      <progress
        className={`h-2 w-full overflow-hidden rounded-full appearance-none [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:rounded-full ${colorClass} [&::-moz-progress-bar]:rounded-full`}
        max={100}
        value={safe}
        aria-label={`${label}: ${value}%`}
      />
    </div>
  );
}

const formatLastUpdated = (raw: string | null): string | null => {
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

export function EmployabilityScore() {
  const [data, setData] = React.useState<EmployabilityScoreResponse | null>(null);
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
      const result = await getEmployabilityScore(token);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "No se pudo cargar el score de empleabilidad."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
      <h3 className="text-lg font-semibold">Score de Empleabilidad</h3>

      {isLoading && (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Calculando tu score...
        </div>
      )}

      {!isLoading && error && (
        <div className="mt-6">
          <div className="flex items-start gap-2 text-sm text-red-400 mb-3">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="outline"
            className="text-slate-300 border-slate-600 hover:bg-slate-800"
            onClick={() => void load()}
          >
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !error && data && (
        <>
          {/* Main Score */}
          <div className="mt-6 space-y-1">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold">{Math.round(data.score)}</span>
              <span className="text-lg text-slate-400 mb-2">/ 100</span>
            </div>
            {data.last_updated && (
              <p className="text-xs text-slate-500">
                Actualizado {formatLastUpdated(data.last_updated)}
              </p>
            )}
          </div>

          {/* Motivational message */}
          {data.motivational_message && (
            <div className="mt-4 rounded-xl bg-blue-900/40 border border-blue-700/40 px-4 py-3 text-sm text-blue-300">
              {data.motivational_message}
            </div>
          )}

          {/* Breakdown */}
          <div className="mt-6 space-y-4">
            <BreakdownBar
              label="Entrevistas (60%)"
              value={data.breakdown.interview_score}
              colorClass="[&::-webkit-progress-value]:bg-emerald-400 [&::-moz-progress-bar]:bg-emerald-400"
              accentClass="text-emerald-400"
            />
            <BreakdownBar
              label="Perfil (20%)"
              value={data.breakdown.profile_completeness}
              colorClass="[&::-webkit-progress-value]:bg-blue-400 [&::-moz-progress-bar]:bg-blue-400"
              accentClass="text-blue-400"
            />
            <BreakdownBar
              label="Match promedio (20%)"
              value={data.breakdown.avg_match_score}
              colorClass="[&::-webkit-progress-value]:bg-violet-400 [&::-moz-progress-bar]:bg-violet-400"
              accentClass="text-violet-400"
            />
          </div>
        </>
      )}
    </div>
  );
}
