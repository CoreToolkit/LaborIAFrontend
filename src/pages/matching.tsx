import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { AlertCircle, BriefcaseBusiness, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/Layout";
import { RoleCard } from "@/components/RoleCard";
import { RoleDashboardFilters } from "@/components/RoleDashboardFilters";
import { RoleDetailModal } from "@/components/RoleDetailModal";
import { useProfile } from "@/hooks/useProfile";
import {
  getRecommendations,
  recalculateRecommendations,
} from "@/services/matchingService";
import { RoleRecommendation, RoleSortOption } from "@/types/matching";
import { hasSkippedOnboarding, profileNeedsOnboarding } from "@/utils/profileOnboarding";
import { getAccessToken } from "@/utils/session";
import { Button } from "@/components/ui/button";
import PrivateRoute from "@/components/PrivateRoute";

const sortRecommendations = (
  list: RoleRecommendation[],
  sortBy: RoleSortOption
): RoleRecommendation[] => {
  const next = [...list];

  const getDemandScore = (role: RoleRecommendation): number => {
    return role.skill_gaps
      ? role.skill_gaps.reduce(
          (total, gap) => total + Math.max(0, gap.importance_weight || 0),
          0
        )
      : 0;
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

function MatchingContent() {
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
        message =
          error.message && typeof error.message === "string" && error.message.trim()
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
        message =
          error.message && typeof error.message === "string" && error.message.trim()
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
        message =
          error.message && typeof error.message === "string" && error.message.trim()
            ? error.message.trim()
            : message;
      }
      setRecommendationsError(message);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleStartInterview = (roleId: string) => {
    const roleName = recommendations.find((item) => item.role_id === roleId)?.role_name;
    const query = new URLSearchParams({ role_id: roleId });

    if (roleName) {
      query.set("role_name", roleName);
    }

    router.push(`/interviewPageRole?${query.toString()}`);
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
      (item) =>
        typeof item.estimated_salary_max_cop === "number" ||
        typeof item.estimated_salary_min_cop === "number"
    );
  }, [recommendations]);

  const filteredAndSortedRecommendations = React.useMemo(() => {
    const filtered =
      selectedCategory === "all"
        ? recommendations
        : recommendations.filter((item) => item.category === selectedCategory);

    return sortRecommendations(filtered, selectedSort);
  }, [recommendations, selectedCategory, selectedSort]);

  const selectedRole = React.useMemo(() => {
    if (!selectedRoleId) return null;

    return recommendations.find((item) => item.role_id === selectedRoleId) || null;
  }, [recommendations, selectedRoleId]);

  if (isProfileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-slate-600">Cargando matching...</p>
        </div>
      </div>
    );
  }

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
          <section className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Matching de Roles</h1>
              <p className="text-slate-600">
                Encuentra los roles que mejor se ajustan a tu perfil profesional.
              </p>
              <div className="mt-4">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => void handleRecalculate()}
                  disabled={isRecalculating}
                >
                  <RefreshCw className={`h-4 w-4 ${isRecalculating ? "animate-spin" : ""}`} />
                  {isRecalculating ? "Recalculando..." : "Recalcular Matching"}
                </Button>
              </div>
            </div>
          </section>

          <main className="p-6">
            <div className="max-w-7xl mx-auto">
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
                <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                  <div className="mb-4 flex items-center gap-2 text-slate-700">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Cargando recomendaciones...
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={`role-skeleton-${index}`}
                        className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                      />
                    ))}
                  </div>
                </section>
              )}

              {!isRecommendationsLoading && recommendationsError && (
                <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">No pudimos cargar tus recomendaciones.</p>
                      <p className="mt-1 text-sm">{recommendationsError}</p>
                      <Button className="mt-4" variant="outline" onClick={() => void initializeRecommendations()}>
                        Reintentar
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              {!isRecommendationsLoading && !recommendationsError && filteredAndSortedRecommendations.length === 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <BriefcaseBusiness className="mx-auto mb-3 h-12 w-12 text-slate-400" />
                  <h2 className="text-lg font-semibold text-slate-900">Aun no hay recomendaciones</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Ejecutamos el matching automaticamente, pero aun no hay resultados para mostrar.
                  </p>
                </section>
              )}

              {!isRecommendationsLoading && !recommendationsError && filteredAndSortedRecommendations.length > 0 && (
                <section className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">Roles recomendados para ti</h2>
                    <span className="text-sm text-slate-500">
                      {filteredAndSortedRecommendations.length} resultados
                    </span>
                  </div>

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

export default function MatchingPage() {
  return (
    <PrivateRoute>
      <MatchingContent />
    </PrivateRoute>
  );
}
