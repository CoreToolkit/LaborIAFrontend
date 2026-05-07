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
import { EvaluationHistoryItem } from "@/types/interviewReport";
import { getAccessToken } from "@/utils/session";
import { useProgressDashboard } from "@/hooks/useProgressDashboard";

function ProgressContent() {
  const { metrics, recommendations, isLoading, error, refetch } = useProgressDashboard();

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
