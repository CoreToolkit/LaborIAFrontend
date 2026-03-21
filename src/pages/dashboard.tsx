import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { BriefcaseBusiness, Clock, LogOut, RefreshCw, Settings, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleCard } from "@/components/RoleCard";
import { RoleDashboardFilters } from "@/components/RoleDashboardFilters";
import { RoleDetailModal } from "@/components/RoleDetailModal";
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

      <div className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-semibold">LaborIA</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/profile")}
                className="gap-2"
              >
                <User className="h-4 w-4" />
                Mi Perfil
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/profile")}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Configuracion
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                Cerrar Sesion
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <section className="mb-6 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold">Dashboard de Roles Recomendados</h1>
                <p className="mt-2 text-sm text-blue-50">
                  Estos roles se calculan segun tu perfil, experiencia y preferencias.
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="gap-2 bg-white text-blue-700 hover:bg-blue-50"
                onClick={() => void handleRecalculate()}
                disabled={isRecalculating}
              >
                <RefreshCw className={`h-4 w-4 ${isRecalculating ? "animate-spin" : ""}`} />
                {isRecalculating ? "Recalculando..." : "Recalcular Matching"}
              </Button>
            </div>
          </section>

          <section className="mb-6">
            <RoleDashboardFilters
              categories={categories}
              selectedCategory={selectedCategory}
              selectedSort={selectedSort}
              salarySortAvailable={salarySortAvailable}
              onCategoryChange={setSelectedCategory}
              onSortChange={setSelectedSort}
            />
          </section>

          {isRecommendationsLoading && (
            <section className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-gray-700">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Cargando recomendaciones...
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`role-skeleton-${index}`}
                    className="h-56 animate-pulse rounded-xl border border-gray-200 bg-gray-100"
                  />
                ))}
              </div>
            </section>
          )}

          {!isRecommendationsLoading && recommendationsError && (
            <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
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
            </section>
          )}

          {!isRecommendationsLoading && !recommendationsError && recommendations.length === 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
              <BriefcaseBusiness className="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">Aun no hay recomendaciones</h2>
              <p className="mt-2 text-sm text-gray-600">
                Ejecutamos el matching automaticamente, pero aun no hay resultados para mostrar.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <Button onClick={() => router.push("/Onboarding")}>Complete Profile</Button>
                <Button variant="outline" onClick={() => void handleRecalculate()}>
                  Calcular Matching
                </Button>
                <Button variant="outline" onClick={() => void initializeRecommendations()}>
                  Reintentar
                </Button>
              </div>
            </section>
          )}

          {showRecommendations && (
            <section className="space-y-5">
              {allMatchesUnderThirty && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
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
                <h2 className="text-lg font-semibold text-gray-900">Top roles para ti</h2>
                <span className="text-sm text-gray-500">
                  Mostrando {visibleRecommendations.length} de {filteredAndSortedRecommendations.length}
                </span>
              </div>

              {visibleRecommendations.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
                  No hay roles para los filtros seleccionados. Prueba otra categoria.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {visibleRecommendations.map((role) => (
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
        </main>

        <RoleDetailModal
          isOpen={isRoleDetailOpen}
          roleId={selectedRoleId}
          fallbackRole={selectedRole}
          onClose={handleCloseRoleDetail}
          onStartInterview={handleStartInterview}
        />
      </div>
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
