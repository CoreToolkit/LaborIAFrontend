import React from "react";
import Head from "next/head";
import { DashboardLayout } from "@/components/Layout";
import PrivateRoute from "@/components/PrivateRoute";

function MatchingContent() {
  return (
    <>
      <Head>
        <title>Matching de Roles - LaborIA</title>
        <meta
          name="description"
          content="Encuentra roles que se ajusten a tu perfil"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <DashboardLayout>
        <div className="flex-1">
          <section className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Matching de Roles</h1>
              <p className="text-slate-600">
                Encuentra los roles que mejor se ajustan a tu perfil profesional.
              </p>
            </div>
          </section>

          <main className="p-6">
            <div className="max-w-7xl mx-auto">
              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                  Matching de Roles
                </h2>
                <p className="text-slate-600">
                  Esta página mostrará los roles recomendados basados en tu perfil y experiencia.
                </p>
              </div>
            </div>
          </main>
        </div>
      </DashboardLayout>
    </>
  );
}

export default function MatchingPage() {
  return (
    <PrivateRoute>
      <MatchingContent />
    </PrivateRoute>
  );
}
