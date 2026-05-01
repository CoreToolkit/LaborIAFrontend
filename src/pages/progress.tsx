import Head from "next/head";
import { DashboardLayout } from "@/components/Layout";
import PrivateRoute from "@/components/PrivateRoute";
import {
  KPICards,
  SkillRadarChart,
  RecommendationsList,
  RecentActivityFeed,
} from "@/components/Dashboard";

function ProgressContent() {
  return (
    <>
      <Head>
        <title>Métricas de Progreso - LaborIA</title>
        <meta name="description" content="Visualiza tu progreso y estadísticas de aprendizaje" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <DashboardLayout>
        <div className="flex-1 min-h-0">

          {/* Header */}
          <section className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-slate-900 mb-1">
                Métricas de Progreso
              </h1>
              <p className="text-slate-500 text-sm">
                Sigue tu evolución y mira cómo mejora tu empleabilidad.
              </p>
            </div>
          </section>

          {/* Main content */}
          <main className="px-4 py-6 sm:px-6">
            <div className="max-w-7xl mx-auto space-y-6">

              {/* Row 1 — KPI Cards: full width, grid interno 1→2→4 cols */}
              <KPICards />

              {/* Row 2 — RadarChart + Activity Feed */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <SkillRadarChart />
                </div>
                <div className="lg:col-span-7">
                  <RecentActivityFeed />
                </div>
              </div>

              {/* Row 3 — Recommendations: full width */}
              <RecommendationsList />

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
