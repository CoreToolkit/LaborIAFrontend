import React from "react";
import Head from "next/head";
import { DashboardLayout } from "@/components/Layout";
import PrivateRoute from "@/components/PrivateRoute";

function SettingsContent() {
  return (
    <>
      <Head>
        <title>Configuración - LaborIA</title>
        <meta
          name="description"
          content="Gestiona tus preferencias y configuración de cuenta"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <DashboardLayout>
        <div className="flex-1">
          <section className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Configuración
              </h1>
              <p className="text-slate-600">
                Administra tus preferencias y configuración de cuenta.
              </p>
            </div>
          </section>

          <main className="p-6">
            <div className="max-w-7xl mx-auto">
              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                  Configuración
                </h2>
                <p className="text-slate-600">
                  En esta página puedes ajustar tus preferencias, privacidad y otras configuraciones de tu cuenta.
                </p>
              </div>
            </div>
          </main>
        </div>
      </DashboardLayout>
    </>
  );
}

export default function SettingsPage() {
  return (
    <PrivateRoute>
      <SettingsContent />
    </PrivateRoute>
  );
}
