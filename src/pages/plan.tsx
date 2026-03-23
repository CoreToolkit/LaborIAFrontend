import React from "react";
import Head from "next/head";
import { DashboardLayout } from "@/components/Layout";
import PrivateRoute from "@/components/PrivateRoute";

function PlanContent() {
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
        <div className="flex-1">
          <section className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Plan de Mejora
              </h1>
              <p className="text-slate-600">
                Un plan personalizado diseñado para ayudarte a alcanzar tus objetivos profesionales.
              </p>
            </div>
          </section>

          <main className="p-6">
            <div className="max-w-7xl mx-auto">
              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                  Plan de Mejora
                </h2>
                <p className="text-slate-600">
                  En esta página encontrarás tu plan personalizado con recomendaciones y pasos a seguir.
                </p>
              </div>
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
