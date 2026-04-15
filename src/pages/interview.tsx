import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/Layout";
import PrivateRoute from "@/components/PrivateRoute";

function InterviewContent() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace("/interviewPageEnter");
  }, [router]);

  return (
    <>
      <Head>
        <title>Simulador de Entrevista - LaborIA</title>
        <meta
          name="description"
          content="Practica simulaciones de entrevista con IA"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <DashboardLayout>
        <div className="flex min-h-[60vh] flex-1 items-center justify-center px-6">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="text-slate-600">Redirigiendo al simulador de entrevista...</p>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}

export default function InterviewPage() {
  return (
    <PrivateRoute>
      <InterviewContent />
    </PrivateRoute>
  );
}
