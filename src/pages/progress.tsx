import React from "react";
import Head from "next/head";
import { DashboardLayout } from "@/components/Layout";
import PrivateRoute from "@/components/PrivateRoute";
import {
  KPICards,
  SkillRadarChart,
  RecommendationsList,
  RecentActivityFeed,
  TimelineChart,
} from "@/components/Dashboard";
import { getEvaluationHistory } from "@/services/interviewReportService";
import { EvaluationHistoryItem, UserBadge } from "@/types/interviewReport";
import { getAccessToken } from "@/utils/session";
import { useProgressDashboard } from "@/hooks/useProgressDashboard";

function BadgesGrid({ badges, isLoading }: { badges: UserBadge[]; isLoading: boolean }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-base font-semibold text-slate-900">Mis Badges</h2>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : badges.length === 0 ? (
        <p className="text-sm text-slate-500">No hay badges disponibles todavía.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {badges.map((badge) =>
            badge.is_unlocked ? (
              <div
                key={badge.id}
                className="flex flex-col items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center"
              >
                <span className="text-4xl">{badge.icon}</span>
                <p className="text-xs font-semibold text-slate-900 leading-snug">{badge.name}</p>
                <p className="text-[11px] text-slate-500 leading-snug">{badge.description}</p>
              </div>
            ) : (
              <div
                key={badge.id}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center"
              >
                <span className="text-4xl grayscale opacity-40">{badge.icon}</span>
                <p className="text-xs font-semibold text-slate-400 leading-snug">{badge.name}</p>
                <div className="w-full mt-1">
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    {/* eslint-disable-next-line react/forbid-component-props */}
                    <div className="h-full rounded-full bg-blue-400 transition-all duration-500" style={{ width: `${Math.round(badge.progress * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {Math.round(badge.progress * 100)}%
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

function ProgressContent() {
  const { metrics, recommendations, badges, isLoading, error, refetch } = useProgressDashboard();

  const [activity, setActivity] = React.useState<EvaluationHistoryItem[]>([]);
  const [activityLoading, setActivityLoading] = React.useState(true);
  const [activityError, setActivityError] = React.useState<string | null>(null);

  const fetchActivity = React.useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    const token = getAccessToken();
    if (!token) {
      setActivityError("Sesión expirada. Inicia sesión nuevamente.");
      setActivityLoading(false);
      return;
    }
    try {
      const result = await getEvaluationHistory(token, 5);
      setActivity(result.items);
    } catch (err) {
      setActivityError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "No se pudo cargar la actividad reciente."
      );
    } finally {
      setActivityLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

  return (
    <>
      <Head>
        <title>Métricas de Progreso - LaborIA</title>
        <meta name="description" content="Visualiza tu progreso y estadísticas de aprendizaje" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <DashboardLayout>
        <div className="flex-1 min-h-0">

          <section className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-slate-900 mb-1">Métricas de Progreso</h1>
              <p className="text-slate-500 text-sm">
                Sigue tu evolución y mira cómo mejora tu empleabilidad.
              </p>
            </div>
          </section>

          <main className="px-4 py-6 sm:px-6">
            <div className="max-w-7xl mx-auto space-y-6">

              <KPICards
                data={metrics}
                isLoading={isLoading}
                error={error.metrics}
                onRetry={refetch}
              />

              <TimelineChart />

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <SkillRadarChart
                    data={metrics}
                    isLoading={isLoading}
                    error={error.metrics}
                    onRetry={refetch}
                  />
                </div>
                <div className="lg:col-span-7">
                  <RecentActivityFeed
                    data={activity}
                    isLoading={activityLoading}
                    error={activityError}
                    onRetry={() => void fetchActivity()}
                  />
                </div>
              </div>

              <BadgesGrid badges={badges} isLoading={isLoading} />

              <RecommendationsList
                data={recommendations}
                isLoading={isLoading}
                error={error.recommendations}
                onRetry={refetch}
              />

            </div>
          </main>
        </div>
      </DashboardLayout>
    </>
  );
}

export default function ProgressPage() {
  return (
    <PrivateRoute>
      <ProgressContent />
    </PrivateRoute>
  );
}
