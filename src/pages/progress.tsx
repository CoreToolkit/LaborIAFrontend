import React from "react";
import Head from "next/head";
import { DashboardLayout } from "@/components/Layout";
import PrivateRoute from "@/components/PrivateRoute";

function ProgressContent() {
  return (
    <>
      <Head>
        <title>Métricas de Progreso - LaborIA</title>
        <meta
          name="description"
          content="Visualiza tu progreso y estadísticas de aprendizaje"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <DashboardLayout>
        <div className="flex-1">
          <section className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Métricas de Progreso
              </h1>
              <p className="text-slate-600">
                Sigue tu evolución y mira cómo mejora tu empleabilidad.
              </p>
            </div>
          </section>

          <main className="p-6">
            <div className="max-w-7xl mx-auto">
              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                  Métricas de Progreso
                </h2>
                <p className="text-slate-600">
                  Esta página te muestra estadísticas detalladas sobre tu progreso en la plataforma.
                </p>
              </div>
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
