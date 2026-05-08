import React from "react";
import Head from "next/head";
import { DashboardLayout } from "@/components/Layout";
import PrivateRoute from "@/components/PrivateRoute";
import { ImprovementPlanSection } from "@/components/ImprovementPlan";
import { useImprovementPlan } from "@/hooks/useImprovementPlan";

function PlanContent() {
  const {
    plan,
    history,
    isPlanLoading,
    isHistoryLoading,
    error,
    refreshResult,
    refresh,
  } = useImprovementPlan();

  return (
    <>
      <Head>
        <title>Plan de Mejora - LaborIA</title>
        <meta
          name="description"
          content="Tu plan personalizado para mejorar tu perfil profesional"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <DashboardLayout>
        <div className="flex-1 min-h-0">
          <section className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-slate-900 mb-1">Plan de Mejora</h1>
              <p className="text-slate-500 text-sm">
                Un plan personalizado diseñado para ayudarte a alcanzar tus objetivos profesionales.
              </p>
            </div>
          </section>

          <main className="px-4 py-6 sm:px-6">
            <div className="max-w-7xl mx-auto">
              <ImprovementPlanSection
                plan={plan}
                history={history}
                isPlanLoading={isPlanLoading}
                isHistoryLoading={isHistoryLoading}
                error={error}
                refreshResult={refreshResult}
                onRefresh={refresh}
              />
            </div>
          </main>
        </div>
      </DashboardLayout>
    </>
  );
}

export default function PlanPage() {
  return (
    <PrivateRoute>
      <PlanContent />
    </PrivateRoute>
  );
}
