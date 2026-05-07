import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/Layout";
import PrivateRoute from "@/components/PrivateRoute";

function InterviewChoiceContent() {
  const router = useRouter();
  const { role_id, role_name } = router.query;

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (typeof role_id === "string" && role_id) params.set("role_id", role_id);
    if (typeof role_name === "string" && role_name) params.set("role_name", role_name);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  return (
    <>
      <Head>
        <title>Simulador de Entrevista - LaborIA</title>
        <meta name="description" content="Practica simulaciones de entrevista con IA" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <DashboardLayout>
        <div className="flex-1 min-h-0">
          <section className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-8">
            <div className="max-w-2xl mx-auto">
              <h1 className="text-2xl font-bold text-slate-900">Simulador de Entrevista</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Elige el tipo de práctica que quieres hacer
              </p>
            </div>
          </section>

          <main className="px-4 py-8 sm:px-6">
            <div className="max-w-2xl mx-auto grid grid-cols-1 gap-4 sm:grid-cols-2">

              <button
                type="button"
                onClick={() => void router.push(`/individual-interview${buildQuery()}`)}
                className="group bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-left hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-slate-800 mb-1">Entrevista Individual</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Practica solo, a tu ritmo. El sistema genera preguntas personalizadas
                  según tu perfil y te evalúa al instante.
                </p>
              </button>

              <button
                type="button"
                onClick={() => void router.push(`/interviewPageEnter${buildQuery()}`)}
                className="group bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-left hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-slate-800 mb-1">Entrevista Grupal</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Compite y colabora con otros candidatos en tiempo real. Ideal para
                  simular entornos de selección más exigentes.
                </p>
              </button>

            </div>
          </main>
        </div>
      </DashboardLayout>
    </>
  );
}

export default function InterviewPage() {
  return (
    <PrivateRoute>
      <InterviewChoiceContent />
    </PrivateRoute>
  );
}
