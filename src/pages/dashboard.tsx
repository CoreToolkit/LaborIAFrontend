import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  AlertCircle,
  RefreshCw,
  Users,
  Heart,
  Zap,
  TrendingUp,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/Layout";
import { DashboardCard, EmployabilityScore } from "@/components/Dashboard";
import { useProfile } from "@/hooks/useProfile";
import {
  getRecommendations,
  recalculateRecommendations,
} from "@/services/matchingService";
import { getInterviewReportsHistory } from "@/services/interviewReportService";
import { RoleRecommendation } from "@/types/matching";
import {
  hasSkippedOnboarding,
  profileNeedsOnboarding,
} from "@/utils/profileOnboarding";
import { getAccessToken } from "@/utils/session";
import PrivateRoute from "@/components/PrivateRoute";

const clampPercentage = (value: number): number => {
  return Math.max(0, Math.min(100, Math.round(value)));
};


const calculateMatchAverage = (recommendations: RoleRecommendation[]): number => {
  if (recommendations.length === 0) return 0;

  return clampPercentage(
    recommendations.reduce((acc, item) => acc + item.total_score, 0) / recommendations.length
  );
};

export function DashboardContent() {
  const router = useRouter();
  const { profile, isLoading: isProfileLoading } = useProfile();

  const [recommendations, setRecommendations] = React.useState<RoleRecommendation[]>([]);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = React.useState(true);
  const [recommendationsError, setRecommendationsError] = React.useState<string | null>(null);
  const [lastReportId, setLastReportId] = React.useState<number | null>(null);

  React.useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    let cancelled = false;

    const fetchLastReport = async () => {
      try {
        const history = await getInterviewReportsHistory(token);
        if (!cancelled && history.length > 0) {
          setLastReportId(history[0].session_id);
        }
      } catch {
        // silently ignore — button simply won't show
      }
    };

    void fetchLastReport();
    return () => { cancelled = true; };
  }, []);

  const shouldOpenOnboarding = React.useMemo(() => {
    if (!profile) return false;

    return profileNeedsOnboarding(profile) && !hasSkippedOnboarding(profile.id);
  }, [profile]);

  const initializeRecommendations = React.useCallback(async () => {
    setIsRecommendationsLoading(true);
    setRecommendationsError(null);

    const token = getAccessToken();
    if (!token) {
      setRecommendations([]);
      setRecommendationsError("Tu sesion expiro. Inicia sesion nuevamente.");
      setIsRecommendationsLoading(false);
      return;
    }

    try {
      let data = await getRecommendations(token);

      if (data.length === 0) {
        await recalculateRecommendations(token);
        data = await getRecommendations(token);
      }

      setRecommendations(data);
    } catch (error) {
      let message = "No se pudieron cargar los roles recomendados.";
      if (error instanceof Error) {
        message = error.message && typeof error.message === "string" && error.message.trim()
          ? error.message.trim()
          : message;
      }
      setRecommendations([]);
      setRecommendationsError(message);
    } finally {
      setIsRecommendationsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isProfileLoading && shouldOpenOnboarding) {
      router.replace("/Onboarding");
    }
  }, [isProfileLoading, router, shouldOpenOnboarding]);

  React.useEffect(() => {
    if (isProfileLoading || shouldOpenOnboarding) {
      return;
    }

    void initializeRecommendations();
  }, [isProfileLoading, shouldOpenOnboarding, initializeRecommendations]);

  const handleOpenInterviewRoom = () => {
    router.push("/interviewPageEnter");
  };

  const rolesCount = recommendations.length;
  const topMatch = recommendations
    .slice()
    .sort((a, b) => b.total_score - a.total_score)[0];
  const averageMatch = calculateMatchAverage(recommendations);

  if (isProfileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-slate-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (shouldOpenOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-slate-600">Redirigiendo al onboarding...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard de Roles - LaborIA</title>
        <meta
          name="description"
          content="Recomendaciones de roles segun tu perfil y match score en LaborIA"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <DashboardLayout>
        <div className="flex-1">
          {/* Welcome Section */}
          <section className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Bienvenido, {profile?.nombre || "Usuario"}</h1>
              <p className="text-slate-600">Aqui encontraras todas las herramientas para mejorar tu perfil profesional y encontrar tu proximo rol.</p>
            </div>
          </section>

          {/* Main Content */}
          <main className="p-6">
            <div className="max-w-7xl mx-auto">
              {/* Quick Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {/* Mi Perfil Profesional */}
                <DashboardCard
                  icon={Users}
                  iconBgColor="bg-blue-50"
                  title="Mi Perfil Profesional"
                  description="Completa y optimiza tu perfil"
                  metric={{
                    label: "Perfil completado",
                    value: "85%",
                  }}
                  action={{
                    label: "Editar",
                    onClick: () => router.push("/profile"),
                  }}
                />

                {/* Matching de Roles */}
                <DashboardCard
                  icon={Heart}
                  iconBgColor="bg-emerald-50"
                  title="Matching de Roles"
                  description="Encuentra roles perfectos para ti"
                  metric={{
                    label: "Roles afines",
                    value: rolesCount,
                  }}
                  action={{
                    label: "Ver más",
                    onClick: () => router.push("/matching"),
                  }}
                />

                {/* Simulación de Entrevista */}
                <DashboardCard
                  icon={Zap}
                  iconBgColor="bg-indigo-50"
                  title="Simulación de Entrevista"
                  description="Practica en sala de entrevista con audio en tiempo real"
                  metric={{
                    label: "Practicas realizadas",
                    value: "2",
                  }}
                  action={{
                    label: "Entrar",
                    onClick: handleOpenInterviewRoom,
                  }}
                >
                  {lastReportId && (
                    <button
                      type="button"
                      onClick={() => router.push(`/interview-report/${lastReportId}`)}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Ver último reporte
                    </button>
                  )}
                </DashboardCard>

                {/* Métricas de Progreso */}
                <DashboardCard
                  icon={TrendingUp}
                  iconBgColor="bg-purple-50"
                  title="Historial de Reportes"
                  description="Revisa todos tus reportes de entrevista"
                  metric={{
                    label: "Reportes guardados",
                    value: "Ver historial",
                  }}
                  action={{
                    label: "Abrir historial",
                    onClick: () => router.push("/interview-history"),
                  }}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 mb-8">
                <section className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">Resumen de Matching</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Los roles recomendados ahora se visualizan exclusivamente en el módulo Matching Roles.
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push("/matching")}>
                      Ir a Matching Roles
                    </Button>
                  </div>

                  {isRecommendationsLoading && (
                    <div className="mt-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Cargando resumen de matching...
                    </div>
                  )}

                  {!isRecommendationsLoading && recommendationsError && (
                    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">No pudimos cargar tu resumen de matching.</p>
                          <p className="mt-1 text-sm">{recommendationsError}</p>
                          <Button
                            className="mt-3"
                            variant="outline"
                            onClick={() => void initializeRecommendations()}
                          >
                            Reintentar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isRecommendationsLoading && !recommendationsError && (
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roles afines</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{rolesCount}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Match promedio</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{averageMatch}%</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mejor rol actual</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">{topMatch?.role_name || "Sin datos"}</p>
                        <p className="text-sm text-slate-600">{topMatch ? `${topMatch.total_score}% match` : "Completa tu perfil para obtener recomendaciones"}</p>
                      </div>
                    </div>
                  )}
                </section>

                <div>
                  <EmployabilityScore />
                </div>
              </div>
            </div>
          </main>
        </div>
      </DashboardLayout>
    </>
  );
}

export default function DashboardPage() {
  return (
    <PrivateRoute>
      <DashboardContent />
    </PrivateRoute>
  );
}
