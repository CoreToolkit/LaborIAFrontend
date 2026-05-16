import React from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { User, LogOut, RefreshCw, AlertCircle, Briefcase, Award, TrendingUp, Target, Edit2 } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Experience, Preferencias, Skill } from "@/types/profile";
import { EditPersonalInfoModal } from "@/components/EditPersonalInfoModal";
import { ExperienceModal } from "@/components/ExperienceModal";
import { SkillModal } from "@/components/SkillModal";
import { PreferencesModal } from "@/components/PreferencesModal";
import {
  clearOnboardingSkipped,
  hasSkippedOnboarding as hasSkippedOnboardingFlag,
  profileNeedsOnboarding,
} from "@/utils/profileOnboarding";
import PrivateRoute from "@/components/PrivateRoute";
import { clearProvider, clearTokens, getAccessToken } from "@/utils/session";
import {
  ProfileInfoTab,
  ProfileExperienceTab,
  ProfileSkillsTab,
  ProfileStatsTab,
  ProfilePreferencesTab,
} from "@/components/Profile";

type ProfileTab = "info" | "experience" | "skills" | "stats" | "preferences";

const TAB_CONFIG: { id: ProfileTab; label: string; icon: React.ElementType }[] = [
  { id: "info", label: "Información Personal", icon: User },
  { id: "experience", label: "Experiencia", icon: Briefcase },
  { id: "skills", label: "Habilidades", icon: Award },
  { id: "stats", label: "Estadísticas", icon: TrendingUp },
  { id: "preferences", label: "Preferencias", icon: Target },
];

const getInitials = (name: string): string =>
  name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

function ProfileContent() {
  const router = useRouter();
  const {
    profile,
    isLoading,
    error,
    refetch,
    updateProfile,
    addExperience,
    updateExperience,
    deleteExperience,
    addSkill,
    updateSkill,
    deleteSkill,
    updatePreferencias,
  } = useProfile();

  const [imageError, setImageError] = React.useState(false);
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<ProfileTab>("info");
  const [hasSkippedOnboarding, setHasSkippedOnboarding] = React.useState(false);

  // Modal states
  const [isPersonalInfoModalOpen, setIsPersonalInfoModalOpen] = React.useState(false);
  const [isExperienceModalOpen, setIsExperienceModalOpen] = React.useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = React.useState(false);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = React.useState(false);
  const [selectedExperience, setSelectedExperience] = React.useState<Experience | undefined>();
  const [selectedSkill, setSelectedSkill] = React.useState<Skill | undefined>();
  const [experienceMode, setExperienceMode] = React.useState<"add" | "edit">("add");
  const [skillMode, setSkillMode] = React.useState<"add" | "edit">("add");

  const needsOnboarding = React.useMemo(() => profileNeedsOnboarding(profile), [profile]);

  React.useEffect(() => {
    if (profile) {
      setImageError(false);
      setImageSrc(profile.fotoPerfil || null);
    }
  }, [profile]);

  React.useEffect(() => {
    if (!profile) return;
    if (!needsOnboarding) {
      clearOnboardingSkipped(profile.id);
      setHasSkippedOnboarding(false);
      return;
    }
    setHasSkippedOnboarding(hasSkippedOnboardingFlag(profile.id));
  }, [profile, needsOnboarding]);

  const handleLogout = async () => {
    const accessToken = getAccessToken();
    try {
      if (!accessToken) {
        clearTokens();
        clearProvider();
        router.push("/login");
        return;
      }
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) console.error("Logout respondió con error HTTP:", res.status);
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    } finally {
      clearTokens();
      clearProvider();
      router.push("/login");
    }
  };

  // ─── Experience handlers ─────────────────────────────────────────────────────

  const handleAddExperience = () => {
    setSelectedExperience(undefined);
    setExperienceMode("add");
    setIsExperienceModalOpen(true);
  };

  const handleEditExperience = (experience: Experience) => {
    setSelectedExperience(experience);
    setExperienceMode("edit");
    setIsExperienceModalOpen(true);
  };

  const handleSaveExperience = async (data: Experience) => {
    if (experienceMode === "add") {
      await addExperience(data);
    } else if (selectedExperience?.id) {
      await updateExperience(selectedExperience.id, data);
    }
  };

  const handleDeleteExperience = async (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta experiencia?")) {
      await deleteExperience(id);
    }
  };

  // ─── Skill handlers ──────────────────────────────────────────────────────────

  const handleAddSkill = () => {
    setSelectedSkill(undefined);
    setSkillMode("add");
    setIsSkillModalOpen(true);
  };

  const handleEditSkill = (skill: Skill) => {
    setSelectedSkill(skill);
    setSkillMode("edit");
    setIsSkillModalOpen(true);
  };

  const handleSaveSkill = async (data: Skill) => {
    if (skillMode === "add") {
      await addSkill(data);
    } else if (selectedSkill?.id) {
      await updateSkill(selectedSkill.id, data);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta habilidad?")) {
      await deleteSkill(id);
    }
  };

  const handleResumeOnboarding = () => {
    if (profile) clearOnboardingSkipped(profile.id);
    setHasSkippedOnboarding(false);
    router.push("/Onboarding");
  };

  return (
    <>
      <Head>
        <title>Mi Perfil - LaborIA</title>
        <meta name="description" content="Perfil de usuario de LaborIA" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-semibold">LaborIA</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
                  Volver al Dashboard
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Cerrar Sesión
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900">Mi Perfil</h1>
            <p className="text-slate-600 mt-2">Información de tu cuenta y configuración personal</p>
          </div>

          {isLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
                <p className="text-slate-600">Cargando datos del perfil...</p>
              </div>
            </div>
          )}

          {error && !isLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-red-300 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Error al cargar el perfil</h3>
                  <p className="text-red-700 mb-4">{error}</p>
                  <Button variant="outline" size="sm" onClick={refetch} className="border-red-300 text-red-700 hover:bg-red-50">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reintentar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {profile && !isLoading && !error && (
            <div className="space-y-6">
              {/* Profile Header Card */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {imageSrc && !imageError ? (
                        <Image
                          loader={({ src }) => src}
                          src={imageSrc}
                          alt={profile.nombre}
                          width={80}
                          height={80}
                          className="w-20 h-20 rounded-full border-4 border-white shadow-lg object-cover bg-white"
                          onError={() => setImageError(true)}
                          referrerPolicy="no-referrer"
                          unoptimized
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center border-4 border-white shadow-lg">
                          <span className="text-2xl font-bold text-blue-600">
                            {getInitials(profile.nombre)}
                          </span>
                        </div>
                      )}
                      <div className="text-white">
                        <h2 className="text-2xl font-bold">{profile.nombre}</h2>
                        <p className="text-blue-100 text-sm mt-1">{profile.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white text-blue-600 hover:bg-blue-50"
                      onClick={() => setIsPersonalInfoModalOpen(true)}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar Perfil
                    </Button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-200">
                  <nav className="flex gap-8 px-6" aria-label="Profile sections">
                    {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                          activeTab === id
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <Icon className="w-4 h-4 inline mr-2" />
                        {label}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="px-6 py-6">
                  {activeTab === "info" && (
                    <ProfileInfoTab
                      profile={profile}
                      onEdit={() => setIsPersonalInfoModalOpen(true)}
                    />
                  )}
                  {activeTab === "experience" && (
                    <ProfileExperienceTab
                      profile={profile}
                      onAdd={handleAddExperience}
                      onEdit={handleEditExperience}
                      onDelete={handleDeleteExperience}
                    />
                  )}
                  {activeTab === "skills" && (
                    <ProfileSkillsTab
                      profile={profile}
                      onAdd={handleAddSkill}
                      onEdit={handleEditSkill}
                      onDelete={handleDeleteSkill}
                    />
                  )}
                  {activeTab === "stats" && <ProfileStatsTab profile={profile} />}
                  {activeTab === "preferences" && (
                    <ProfilePreferencesTab
                      profile={profile}
                      onEdit={() => setIsPreferencesModalOpen(true)}
                    />
                  )}
                </div>
              </div>

              {/* Actions Card */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Acciones</h3>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" size="sm" onClick={refetch}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar Perfil
                  </Button>
                  {(needsOnboarding || hasSkippedOnboarding) && (
                    <Button variant="outline" size="sm" onClick={handleResumeOnboarding}>
                      <User className="w-4 h-4 mr-2" />
                      Completar Onboarding
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Modals */}
        {profile && (
          <>
            <EditPersonalInfoModal
              isOpen={isPersonalInfoModalOpen}
              onClose={() => setIsPersonalInfoModalOpen(false)}
              initialData={{
                nombre: profile.nombre,
                email: profile.email,
                telefono: profile.telefono,
                ubicacion: profile.ubicacion,
                carrera: profile.carrera,
                universidad: profile.universidad,
                fechaGraduacion: profile.fechaGraduacion,
                bio: profile.bio,
                nivelIngles: profile.nivelIngles,
              }}
              onSave={updateProfile}
            />
            <ExperienceModal
              isOpen={isExperienceModalOpen}
              onClose={() => setIsExperienceModalOpen(false)}
              initialData={selectedExperience}
              onSave={handleSaveExperience}
              mode={experienceMode}
            />
            <SkillModal
              isOpen={isSkillModalOpen}
              onClose={() => {
                setIsSkillModalOpen(false);
                setSelectedSkill(undefined);
                setSkillMode("add");
              }}
              initialData={selectedSkill}
              onSave={handleSaveSkill}
              mode={skillMode}
            />
            <PreferencesModal
              isOpen={isPreferencesModalOpen}
              onClose={() => setIsPreferencesModalOpen(false)}
              initialData={
                profile.preferencias || {
                  cargo: "",
                  industria: "",
                  ubicacion: "",
                  salarioEsperado: 0,
                  tipoContrato: "",
                  disponibilidadInmediata: false,
                }
              }
              onSave={updatePreferencias}
            />
          </>
        )}
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <PrivateRoute>
      <ProfileContent />
    </PrivateRoute>
  );
}
