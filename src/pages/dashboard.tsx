import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  BriefcaseBusiness,
  AlertCircle,
  RefreshCw,
  Users,
  Heart,
  Zap,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleCard } from "@/components/RoleCard";
import { RoleDashboardFilters } from "@/components/RoleDashboardFilters";
import { RoleDetailModal } from "@/components/RoleDetailModal";
import { DashboardLayout } from "@/components/Layout";
import { DashboardCard, EmployabilityScore } from "@/components/Dashboard";
import { useProfile } from "@/hooks/useProfile";
import {
  getRecommendations,
  recalculateRecommendations,
} from "@/services/matchingService";
import { RoleRecommendation, RoleSortOption } from "@/types/matching";
import {
  hasSkippedOnboarding,
  profileNeedsOnboarding,
} from "@/utils/profileOnboarding";
import { clearProvider, clearTokens, getAccessToken } from "@/utils/session";
import PrivateRoute from "@/components/PrivateRoute";

const sortRecommendations = (
  list: RoleRecommendation[],
  sortBy: RoleSortOption
): RoleRecommendation[] => {
  const next = [...list];

  const getDemandScore = (role: RoleRecommendation): number => {
    return role.skill_gaps ? role.skill_gaps.reduce(
      (total, gap) => total + Math.max(0, gap.importance_weight || 0),
      0
    ) : 0;
  };

  if (sortBy === "name-asc") {
    return next.sort((a, b) => a.role_name.localeCompare(b.role_name, "es"));
  }

  if (sortBy === "salary-desc") {
    return next.sort((a, b) => {
      const salaryA = a.estimated_salary_max_cop ?? a.estimated_salary_min_cop ?? -1;
      const salaryB = b.estimated_salary_max_cop ?? b.estimated_salary_min_cop ?? -1;

      return salaryB - salaryA;
    });
  }

  if (sortBy === "demand-desc") {
    return next.sort((a, b) => {
      const demandA = getDemandScore(a);
      const demandB = getDemandScore(b);

      if (demandA === demandB) {
        return a.role_name.localeCompare(b.role_name, "es");
      }

      return demandB - demandA;
    });
  }

  return next.sort((a, b) => b.total_score - a.total_score);
};

const getMostDemandedSkills = (roles: RoleRecommendation[]): string[] => {
  const scoreBySkill = new Map<string, number>();

  roles.forEach((role) => {
    if (role.skill_gaps) {
      role.skill_gaps.forEach((gap) => {
        const current = scoreBySkill.get(gap.skill_name) || 0;
        scoreBySkill.set(gap.skill_name, current + Math.max(1, gap.importance_weight));
      });
    }
  });

  return [...scoreBySkill.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([skillName]) => skillName);
};

export function DashboardContent() {
  const router = useRouter();
  const { profile, isLoading: isProfileLoading } = useProfile();

  const [recommendations, setRecommendations] = React.useState<RoleRecommendation[]>([]);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = React.useState(true);
  const [recommendationsError, setRecommendationsError] = React.useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [selectedSort, setSelectedSort] = React.useState<RoleSortOption>("match-desc");
  const [isRecalculating, setIsRecalculating] = React.useState(false);

  const [isRoleDetailOpen, setIsRoleDetailOpen] = React.useState(false);
  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(null);

  const shouldOpenOnboarding = React.useMemo(() => {
    if (!profile) return false;

    return profileNeedsOnboarding(profile) && !hasSkippedOnboarding(profile.id);
  }, [profile]);

  const loadRecommendations = React.useCallback(async () => {
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
      const data = await getRecommendations(token);
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

  const handleLogout = async () => {
    const accessToken = getAccessToken();

    try {
      if (!accessToken) {
        clearTokens();
        clearProvider();
        router.push("/login");
        return;
      }

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error("Logout respondio con error HTTP:", response.status);
      }
    } catch (error) {
      console.error("Error al cerrar sesion:", error);
    } finally {
      clearTokens();
      clearProvider();
      router.push("/login");
    }
  };

  const handleRecalculate = async () => {
    const token = getAccessToken();
    if (!token) {
      setRecommendationsError("Tu sesion expiro. Inicia sesion nuevamente.");
      return;
    }

    setIsRecalculating(true);
    setRecommendationsError(null);

    try {
      await recalculateRecommendations(token);
      await loadRecommendations();
    } catch (error) {
      let message = "No se pudo recalcular el matching.";
      if (error instanceof Error) {
        message = error.message && typeof error.message === "string" && error.message.trim() 
          ? error.message.trim() 
          : message;
      }
      setRecommendationsError(message);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleStartInterview = (roleId: string) => {
    router.push(`/interview/start?role_id=${encodeURIComponent(roleId)}`);
  };

  const handleViewRoleDetail = (roleId: string) => {
    setSelectedRoleId(roleId);
    setIsRoleDetailOpen(true);
  };

  const handleCloseRoleDetail = () => {
    setIsRoleDetailOpen(false);
    setSelectedRoleId(null);
  };

  const categories = React.useMemo(() => {
    return [...new Set(recommendations.map((item) => item.category).filter(Boolean))].sort();
  }, [recommendations]);

  const salarySortAvailable = React.useMemo(() => {
    return recommendations.some(
      (item) => typeof item.estimated_salary_max_cop === "number" || typeof item.estimated_salary_min_cop === "number"
    );
  }, [recommendations]);

  const filteredAndSortedRecommendations = React.useMemo(() => {
    const filtered =
      selectedCategory === "all"
        ? recommendations
        : recommendations.filter((item) => item.category === selectedCategory);

    return sortRecommendations(filtered, selectedSort);
  }, [recommendations, selectedCategory, selectedSort]);

  const visibleRecommendations = React.useMemo(() => {
    return filteredAndSortedRecommendations.slice(0, 5);
  }, [filteredAndSortedRecommendations]);

  const showRecommendations = !isRecommendationsLoading && !recommendationsError && recommendations.length > 0;

  const allMatchesUnderThirty = React.useMemo(() => {
    return (
      recommendations.length > 0 &&
      recommendations.every((item) => item.total_score < 30)
    );
  }, [recommendations]);

  const suggestedSkills = React.useMemo(() => {
    return getMostDemandedSkills(recommendations);
  }, [recommendations]);

  const selectedRole = React.useMemo(() => {
    if (!selectedRoleId) return null;

    return recommendations.find((item) => item.role_id === selectedRoleId) || null;
  }, [recommendations, selectedRoleId]);

  if (isProfileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (shouldOpenOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-gray-600">Redirigiendo al onboarding...</p>
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
          <section className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-8">
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
                    value: "3",
                  }}
                  action={{
                    label: "Ver más",
                    onClick: () => document.getElementById('roles-section')?.scrollIntoView({ behavior: 'smooth' }),
                  }}
                />

                {/* Simulación de Entrevista */}
                <DashboardCard
                  icon={Zap}
                  iconBgColor="bg-indigo-50"
                  title="Simulación de Entrevista"
                  description="Practica con nuestro AI"
                  metric={{
                    label: "Practicas realizadas",
                    value: "2",
                  }}
                  action={{
                    label: "Practicar",
                    onClick: () => router.push("/interview"),
                  }}
                />

                {/* Métricas de Progreso */}
                <DashboardCard
                  icon={TrendingUp}
                  iconBgColor="bg-purple-50"
                  title="Métricas de Progreso"
                  description="Sigue tu evolucion"
                  metric={{
                    label: "Progreso general",
                    value: "72%",
                  }}
                  action={{
                    label: "Ver detalles",
                    onClick: () => router.push("/progress"),
                  }}
                />
              </div>

              {/* Grid with Recommendations and EmployabilityScore */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                {/* Recommendations Section (3 columns) */}
                <div className="lg:col-span-3">
                  {isRecommendationsLoading && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                      <div className="mb-4 flex items-center gap-2 text-slate-700">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Cargando recomendaciones...
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {Array.from({ length: 2 }).map((_, index) => (
                          <div
                            key={`role-skeleton-${index}`}
                            className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {!isRecommendationsLoading && recommendationsError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium">No pudimos cargar tus recomendaciones.</p>
                          <p className="mt-1 text-sm">{recommendationsError}</p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <Button
                              className="mt-0"
                              variant="outline"
                              onClick={() => void initializeRecommendations()}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Reintentar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isRecommendationsLoading && !recommendationsError && visibleRecommendations.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                      <BriefcaseBusiness className="mx-auto mb-3 h-12 w-12 text-slate-400" />
                      <h2 className="text-lg font-semibold text-slate-900">Aun no hay recomendaciones</h2>
                      <p className="mt-2 text-sm text-slate-600">
                        Ejecutamos el matching automaticamente, pero aun no hay resultados para mostrar.
                      </p>
                      <div className="mt-5 flex items-center justify-center gap-3">
                        <Button onClick={() => router.push("/Onboarding")}>Complete Profile</Button>
                        <Button variant="outline" onClick={() => void handleRecalculate()}>
                          Calcular Matching
                        </Button>
                      </div>
                    </div>
                  ) : (
                    showRecommendations && (
                      <div className="space-y-4">
                        {visibleRecommendations.map((role) => (
                          <RoleCard
                            key={role.role_id}
                            role={role}
                            onStartInterview={handleStartInterview}
                            onViewDetail={handleViewRoleDetail}
                          />
                        ))}
                      </div>
                    )
                  )}
                </div>

                {/* EmployabilityScore Panel (1 column) */}
                <div>
                  <EmployabilityScore score={72} technicalSkills={85} softSkills={60} />
                </div>
              </div>

              {/* All Recommendations Section */}
              {showRecommendations && (
                <section id="roles-section" className="space-y-5 pt-6 border-t border-slate-200">
                  {allMatchesUnderThirty && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                      <p className="font-semibold text-amber-800">
                        Keep learning! Complete more skills to unlock better matches.
                      </p>
                      <p className="mt-1 text-sm text-amber-700">
                        Te sugerimos fortalecer estas skills de alta demanda:
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {suggestedSkills.length > 0 ? (
                          suggestedSkills.map((skill) => (
                            <span
                              key={`suggested-skill-${skill}`}
                              className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800"
                            >
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-amber-700">Aun no hay sugerencias disponibles.</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">Todos los roles recomendados</h2>
                    <span className="text-sm text-slate-500">
                      Mostrando {visibleRecommendations.length} de {filteredAndSortedRecommendations.length}
                    </span>
                  </div>

                  <div className="mb-6">
                    <RoleDashboardFilters
                      categories={categories}
                      selectedCategory={selectedCategory}
                      selectedSort={selectedSort}
                      salarySortAvailable={salarySortAvailable}
                      onCategoryChange={setSelectedCategory}
                      onSortChange={setSelectedSort}
                    />
                  </div>

                  {filteredAndSortedRecommendations.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
                      No hay roles para los filtros seleccionados. Prueba otra categoria.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredAndSortedRecommendations.map((role) => (
                        <RoleCard
                          key={role.role_id}
                          role={role}
                          onStartInterview={handleStartInterview}
                          onViewDetail={handleViewRoleDetail}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </main>
        </div>

        <RoleDetailModal
          isOpen={isRoleDetailOpen}
          roleId={selectedRoleId}
          fallbackRole={selectedRole}
          onClose={handleCloseRoleDetail}
          onStartInterview={handleStartInterview}
        />
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
