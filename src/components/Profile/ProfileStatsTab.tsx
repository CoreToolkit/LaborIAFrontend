import React from "react";
import { BarChart2, CheckCircle2 } from "lucide-react";
import { PerfilCompleto } from "@/types/profile";
import { getUserMetrics } from "@/services/metricsService";
import { getAccessToken } from "@/utils/session";
import type { UserMetricsResponse } from "@/types/metrics";
import styles from "./ProfileStatsTab.module.css";

interface Props {
  profile: PerfilCompleto;
}

// Interpolates between #D4DCFB (very light, low) and #3B5BDB (full, high)
function skillBarColor(score: number): string {
  const t = Math.min(Math.max(score, 0), 100) / 100;
  const r = Math.round(212 + (59 - 212) * t);
  const g = Math.round(220 + (91 - 220) * t);
  const b = Math.round(251 + (219 - 251) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function formatSkillLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

function SkillBar({ score }: { score: number }) {
  const trackRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!trackRef.current) return;
    trackRef.current.style.setProperty("--bar-width", `${score}%`);
    trackRef.current.style.setProperty("--bar-color", skillBarColor(score));
  }, [score]);

  return (
    <div ref={trackRef} className="h-[6px] w-full rounded-full bg-slate-100 overflow-hidden">
      <div className={styles.skillFill} />
    </div>
  );
}

function AchievementBar({ current, required }: { current: number; required: number }) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const pct = Math.min(100, (current / Math.max(required, 1)) * 100);

  React.useEffect(() => {
    if (!trackRef.current) return;
    trackRef.current.style.setProperty("--bar-width", `${pct}%`);
  }, [pct]);

  return (
    <div ref={trackRef} className="h-[4px] w-full rounded-full bg-slate-200 overflow-hidden">
      <div className={styles.achievementFill} />
    </div>
  );
}

export function ProfileStatsTab({ profile }: Props) {
  const [metrics, setMetrics] = React.useState<UserMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const token = getAccessToken();
    if (!token) { setIsLoading(false); return; }

    getUserMetrics(token)
      .then((data) => { if (!cancelled) setMetrics(data); })
      .catch(() => { if (!cancelled) setMetrics(null); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [profile.id]);

  const skillEntries = metrics
    ? Object.entries(metrics.score_by_skill).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <div className="space-y-7">
      <h3 className="text-base font-semibold text-slate-800">Estadísticas de entrenamiento</h3>

      {isLoading ? (
        <div className="flex items-center gap-3 py-10 text-slate-500 text-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#3B5BDB]" />
          Cargando estadísticas…
        </div>
      ) : metrics && metrics.total_interviews > 0 ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className="w-4 h-4 text-[#3B5BDB]" />
                <p className="text-xs text-slate-500 font-medium">Entrevistas realizadas</p>
              </div>
              <p className="text-3xl font-semibold text-slate-900 tabular-nums">
                {metrics.total_interviews}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-xs text-slate-500 font-medium">Puntuación promedio</p>
              </div>
              <p className="text-3xl font-semibold text-slate-900 tabular-nums">
                {metrics.avg_score.toFixed(1)}
                <span className="text-lg font-normal text-slate-500 ml-0.5">%</span>
              </p>
            </div>
          </div>

          {/* Skills breakdown */}
          {skillEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-400 mb-4">
                Puntuación por habilidad
              </p>
              <div className="space-y-4">
                {skillEntries.map(([skill, score]) => (
                  <div key={skill}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-sm text-slate-700">{formatSkillLabel(skill)}</span>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {score.toFixed(1)}%
                      </span>
                    </div>
                    <SkillBar score={score} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievements */}
          {profile.logros && profile.logros.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
                Logros
              </p>
              <div className="grid grid-cols-3 gap-3">
                {profile.logros.map((logro, index) => (
                    <div
                      key={index}
                      className={`rounded-xl border px-3 py-3 text-center ${
                        logro.desbloqueado
                          ? "border-[#3B5BDB]/20 bg-[#3B5BDB]/5"
                          : "border-slate-200 bg-slate-50 opacity-50"
                      }`}
                    >
                      <div className="text-2xl mb-1.5">{logro.icono}</div>
                      <p className="text-xs font-medium text-slate-800 leading-tight">{logro.nombre}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{logro.descripcion}</p>
                      {logro.desbloqueado && logro.fechaDesbloqueo && (
                        <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">
                          {new Date(logro.fechaDesbloqueo).toLocaleDateString()}
                        </p>
                      )}
                      {!logro.desbloqueado && (
                        <div className="mt-2">
                          <AchievementBar current={logro.progresoActual} required={logro.progresoRequerido} />
                          <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                            {logro.progresoActual}/{logro.progresoRequerido}
                          </p>
                        </div>
                      )}
                    </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-14 rounded-xl bg-slate-50 border border-slate-100">
          <div className="w-10 h-10 rounded-full bg-[#3B5BDB]/10 flex items-center justify-center mb-3">
            <BarChart2 className="w-5 h-5 text-[#3B5BDB]" />
          </div>
          <p className="text-sm text-slate-600 font-medium">Sin estadísticas todavía</p>
          <p className="text-xs text-slate-400 mt-1 text-center max-w-48">
            Completa tu primera entrevista para ver tu progreso aquí
          </p>
        </div>
      )}
    </div>
  );
}
