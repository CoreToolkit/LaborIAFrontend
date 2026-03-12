import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { AlertCircle, Award, Briefcase, RefreshCw, Target, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useProfile";
import { useSession } from "@/hooks/useSession";
import { Experience, Skill } from "@/types/profile";
import {
  clearOnboardingSkipped,
  markOnboardingSkipped,
  profileNeedsOnboarding,
} from "@/utils/profileOnboarding";

type OnboardingStep = "personal" | "experience" | "skills" | "preferences";

const ONBOARDING_STEPS: OnboardingStep[] = [
  "personal",
  "experience",
  "skills",
  "preferences",
];

const STEP_LABELS: Record<OnboardingStep, string> = {
  personal: "Datos Básicos",
  experience: "Experiencia",
  skills: "Habilidades",
  preferences: "Preferencias",
};

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: sessionLoading } = useSession();
  const {
    profile,
    isLoading,
    error,
    refetch,
    updateProfile,
    addExperience,
    addSkill,
    updatePreferencias,
  } = useProfile();

  const [currentStep, setCurrentStep] = React.useState(0);
  const [isSaving, setIsSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [personalData, setPersonalData] = React.useState({
    carrera: "",
    universidad: "",
    fechaGraduacion: "",
    telefono: "",
    ubicacion: "",
    bio: "",
    nivelIngles: "",
  });
  const [experienceData, setExperienceData] = React.useState<Experience>({
    cargo: "",
    empresa: "",
    fechaInicio: "",
    fechaFin: null,
    esActual: false,
    ubicacion: "",
    descripcion: "",
  });
  const [skillData, setSkillData] = React.useState<Skill>({
    nombre: "",
    tipo: "tecnica",
    nivel: "Intermedio",
    descripcion: "",
  });
  const [preferencesData, setPreferencesData] = React.useState({
    cargo: "",
    industria: "",
    ubicacion: "",
    salarioEsperado: undefined as number | undefined,
    tipoContrato: "",
    disponibilidadInmediata: false,
  });

  const needsOnboarding = React.useMemo(() => profileNeedsOnboarding(profile), [profile]);
  const currentStepKey = ONBOARDING_STEPS[currentStep];

  React.useEffect(() => {
    if (!sessionLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, sessionLoading, router]);

  React.useEffect(() => {
    if (!profile) return;

    setPersonalData({
      carrera: profile.carrera || "",
      universidad: profile.universidad || "",
      fechaGraduacion: profile.fechaGraduacion || "",
      telefono: profile.telefono || "",
      ubicacion: profile.ubicacion || "",
      bio: profile.bio || "",
      nivelIngles: profile.nivelIngles || "",
    });
    setPreferencesData({
      cargo: profile.preferencias?.cargo || "",
      industria: profile.preferencias?.industria || "",
      ubicacion: profile.preferencias?.ubicacion || "",
      salarioEsperado: profile.preferencias?.salarioEsperado,
      tipoContrato: profile.preferencias?.tipoContrato || "",
      disponibilidadInmediata: profile.preferencias?.disponibilidadInmediata || false,
    });
    setFormError(null);
  }, [profile]);

  React.useEffect(() => {
    if (!profile || isLoading || error) return;

    if (!needsOnboarding) {
      router.replace("/dashboard");
    }
  }, [profile, isLoading, error, needsOnboarding, router]);

  const handleSkip = () => {
    if (profile) {
      markOnboardingSkipped(profile.id);
    }

    router.replace("/dashboard");
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      setFormError(null);
    }
  };

  const handleContinue = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
    const hasAnyExperienceData = Boolean(
      experienceData.cargo.trim() ||
        experienceData.empresa.trim() ||
        experienceData.fechaInicio ||
        experienceData.ubicacion?.trim() ||
        experienceData.descripcion?.trim() ||
        experienceData.esActual
    );
    const hasAnySkillData = Boolean(skillData.nombre.trim() || skillData.descripcion?.trim());
    const hasAnyPreferencesData = Boolean(
      preferencesData.cargo.trim() ||
        preferencesData.industria.trim() ||
        preferencesData.ubicacion.trim() ||
        preferencesData.salarioEsperado ||
        preferencesData.tipoContrato ||
        preferencesData.disponibilidadInmediata
    );

    if (currentStepKey === "personal") {
      if (!personalData.carrera.trim() || !personalData.universidad.trim() || !personalData.nivelIngles) {
        setFormError("Completa carrera, universidad y nivel de inglés para continuar.");
        return;
      }
    }

    if (currentStepKey === "experience" && hasAnyExperienceData) {
      if (!experienceData.cargo.trim() || !experienceData.empresa.trim() || !experienceData.fechaInicio) {
        setFormError("Si agregas experiencia, completa cargo, empresa y fecha de inicio.");
        return;
      }
    }

    if (currentStepKey === "skills" && hasAnySkillData && !skillData.nombre.trim()) {
      setFormError("Si agregas una habilidad, el nombre es obligatorio.");
      return;
    }

    setFormError(null);

    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    setIsSaving(true);

    try {
      await updateProfile({
        carrera: personalData.carrera,
        universidad: personalData.universidad,
        fechaGraduacion: personalData.fechaGraduacion || undefined,
        telefono: personalData.telefono || undefined,
        ubicacion: personalData.ubicacion || undefined,
        bio: personalData.bio || undefined,
        nivelIngles: personalData.nivelIngles || undefined,
      });

      if (hasAnyExperienceData) {
        await addExperience({
          ...experienceData,
          fechaFin: experienceData.esActual ? null : experienceData.fechaFin || null,
        });
      }

      if (hasAnySkillData) {
        await addSkill({
          ...skillData,
          descripcion: skillData.descripcion || undefined,
        });
      }

      if (hasAnyPreferencesData) {
        await updatePreferencias({
          cargo: preferencesData.cargo || undefined,
          industria: preferencesData.industria || undefined,
          ubicacion: preferencesData.ubicacion || undefined,
          salarioEsperado: preferencesData.salarioEsperado || undefined,
          tipoContrato: preferencesData.tipoContrato || undefined,
          disponibilidadInmediata: preferencesData.disponibilidadInmediata,
        });
      }

      if (profile) {
        clearOnboardingSkipped(profile.id);
      }

      router.replace("/dashboard");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo completar el onboarding.");
    } finally {
      setIsSaving(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Onboarding - LaborIA</title>
        <meta name="description" content="Configuración inicial del perfil en LaborIA" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Crea tu perfil profesional</h1>
            <p className="text-gray-600 mt-3 max-w-2xl">
              Completa estos pasos para personalizar tu experiencia. Si prefieres, puedes omitirlo y terminarlo después.
            </p>
          </div>

          {isLoading && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
                <p className="text-gray-600">Cargando datos del perfil...</p>
              </div>
            </div>
          )}

          {error && !isLoading && (
            <div className="bg-white rounded-2xl shadow-sm border border-red-300 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-red-900 mb-2">Error al cargar el perfil</h2>
                  <p className="text-red-700 mb-4">{error}</p>
                  <Button variant="outline" size="sm" onClick={refetch}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reintentar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {profile && !isLoading && !error && needsOnboarding && (
            <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6 md:p-8">
              <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Paso {currentStep + 1} de {ONBOARDING_STEPS.length}</h2>
                  <p className="text-gray-600 mt-2">{STEP_LABELS[currentStepKey]}</p>
                </div>
                <Button type="button" variant="outline" onClick={handleSkip}>
                  Omitir por ahora
                </Button>
              </div>

              <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-2">
                {ONBOARDING_STEPS.map((step, index) => {
                  const icon =
                    step === "personal" ? <User className="w-4 h-4" /> :
                    step === "experience" ? <Briefcase className="w-4 h-4" /> :
                    step === "skills" ? <Award className="w-4 h-4" /> :
                    <Target className="w-4 h-4" />;

                  return (
                    <div
                      key={step}
                      className={`rounded-md px-3 py-2 text-sm border flex items-center justify-center gap-2 ${
                        index === currentStep
                          ? "bg-blue-600 text-white border-blue-600"
                          : index < currentStep
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-gray-50 text-gray-500 border-gray-200"
                      }`}
                    >
                      {icon}
                      <span>{STEP_LABELS[step]}</span>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleContinue} className="space-y-5">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {formError}
                  </div>
                )}

                {currentStepKey === "personal" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="carrera">Carrera *</Label>
                      <Input
                        id="carrera"
                        value={personalData.carrera}
                        onChange={(e) => setPersonalData((prev) => ({ ...prev, carrera: e.target.value }))}
                        placeholder="Ej: Ingeniería de Sistemas"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="universidad">Universidad *</Label>
                      <Input
                        id="universidad"
                        value={personalData.universidad}
                        onChange={(e) => setPersonalData((prev) => ({ ...prev, universidad: e.target.value }))}
                        placeholder="Ej: Universidad Nacional de Colombia"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fechaGraduacion">Fecha de graduación</Label>
                      <Input
                        id="fechaGraduacion"
                        type="date"
                        value={personalData.fechaGraduacion}
                        onChange={(e) => setPersonalData((prev) => ({ ...prev, fechaGraduacion: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="nivelIngles">Nivel de inglés *</Label>
                      <select
                        id="nivelIngles"
                        value={personalData.nivelIngles}
                        onChange={(e) => setPersonalData((prev) => ({ ...prev, nivelIngles: e.target.value }))}
                        aria-label="Seleccionar nivel de inglés"
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar nivel</option>
                        <option value="Basico">Básico</option>
                        <option value="Intermedio">Intermedio</option>
                        <option value="Avanzado">Avanzado</option>
                        <option value="Fluido">Fluido</option>
                        <option value="Nativo">Nativo</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="telefono">Teléfono</Label>
                      <Input
                        id="telefono"
                        value={personalData.telefono}
                        onChange={(e) => setPersonalData((prev) => ({ ...prev, telefono: e.target.value }))}
                        placeholder="Ej: +57 300 000 0000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ubicacion">Ubicación</Label>
                      <Input
                        id="ubicacion"
                        value={personalData.ubicacion}
                        onChange={(e) => setPersonalData((prev) => ({ ...prev, ubicacion: e.target.value }))}
                        placeholder="Ej: Bogotá, Colombia"
                        className="mt-1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="bio">Descripción</Label>
                      <textarea
                        id="bio"
                        value={personalData.bio}
                        onChange={(e) => setPersonalData((prev) => ({ ...prev, bio: e.target.value }))}
                        placeholder="Cuéntanos brevemente sobre ti"
                        aria-label="Descripción personal"
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                      />
                    </div>
                  </div>
                )}

                {currentStepKey === "experience" && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">Puedes dejar este paso vacío y completarlo después.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expCargo">Cargo</Label>
                        <Input
                          id="expCargo"
                          value={experienceData.cargo}
                          onChange={(e) => setExperienceData((prev) => ({ ...prev, cargo: e.target.value }))}
                          placeholder="Ej: Desarrollador Frontend"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="expEmpresa">Empresa</Label>
                        <Input
                          id="expEmpresa"
                          value={experienceData.empresa}
                          onChange={(e) => setExperienceData((prev) => ({ ...prev, empresa: e.target.value }))}
                          placeholder="Ej: LaborIA"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="expInicio">Fecha inicio</Label>
                        <Input
                          id="expInicio"
                          type="date"
                          value={experienceData.fechaInicio}
                          onChange={(e) => setExperienceData((prev) => ({ ...prev, fechaInicio: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="expFin">Fecha fin</Label>
                        <Input
                          id="expFin"
                          type="date"
                          value={experienceData.fechaFin || ""}
                          onChange={(e) => setExperienceData((prev) => ({ ...prev, fechaFin: e.target.value || null }))}
                          disabled={experienceData.esActual}
                          className="mt-1"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="flex items-center gap-2 mt-1">
                          <input
                            type="checkbox"
                            checked={experienceData.esActual}
                            onChange={(e) =>
                              setExperienceData((prev) => ({
                                ...prev,
                                esActual: e.target.checked,
                                fechaFin: e.target.checked ? null : prev.fechaFin,
                              }))
                            }
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Trabajo actual</span>
                        </label>
                      </div>
                      <div>
                        <Label htmlFor="expUbicacion">Ubicación</Label>
                        <Input
                          id="expUbicacion"
                          value={experienceData.ubicacion || ""}
                          onChange={(e) => setExperienceData((prev) => ({ ...prev, ubicacion: e.target.value }))}
                          placeholder="Ej: Bogotá, Colombia"
                          className="mt-1"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="expDescripcion">Descripción</Label>
                        <textarea
                          id="expDescripcion"
                          value={experienceData.descripcion || ""}
                          onChange={(e) => setExperienceData((prev) => ({ ...prev, descripcion: e.target.value }))}
                          placeholder="Describe brevemente tus responsabilidades o logros"
                          aria-label="Descripción de experiencia"
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentStepKey === "skills" && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">Agrega una habilidad inicial o continúa sin completarla aún.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="skillNombre">Habilidad</Label>
                        <Input
                          id="skillNombre"
                          value={skillData.nombre}
                          onChange={(e) => setSkillData((prev) => ({ ...prev, nombre: e.target.value }))}
                          placeholder="Ej: React"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="skillTipo">Tipo</Label>
                        <select
                          id="skillTipo"
                          value={skillData.tipo}
                          onChange={(e) => setSkillData((prev) => ({ ...prev, tipo: e.target.value as Skill["tipo"] }))}
                          aria-label="Seleccionar tipo de habilidad"
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="tecnica">Técnica</option>
                          <option value="blanda">Blanda</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="skillNivel">Nivel</Label>
                        <select
                          id="skillNivel"
                          value={skillData.nivel}
                          onChange={(e) => setSkillData((prev) => ({ ...prev, nivel: e.target.value as Skill["nivel"] }))}
                          aria-label="Seleccionar nivel de habilidad"
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Basico">Básico</option>
                          <option value="Intermedio">Intermedio</option>
                          <option value="Avanzado">Avanzado</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="skillDescripcion">Descripción</Label>
                        <textarea
                          id="skillDescripcion"
                          value={skillData.descripcion || ""}
                          onChange={(e) => setSkillData((prev) => ({ ...prev, descripcion: e.target.value }))}
                          placeholder="Agrega una descripción opcional de la habilidad"
                          aria-label="Descripción de habilidad"
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentStepKey === "preferences" && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">Último paso. Puedes completarlo ahora o volver más adelante.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="prefCargo">Cargo deseado</Label>
                        <Input
                          id="prefCargo"
                          value={preferencesData.cargo}
                          onChange={(e) => setPreferencesData((prev) => ({ ...prev, cargo: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="prefIndustria">Industria</Label>
                        <Input
                          id="prefIndustria"
                          value={preferencesData.industria}
                          onChange={(e) => setPreferencesData((prev) => ({ ...prev, industria: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="prefUbicacion">Ubicación preferida</Label>
                        <Input
                          id="prefUbicacion"
                          value={preferencesData.ubicacion}
                          onChange={(e) => setPreferencesData((prev) => ({ ...prev, ubicacion: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="prefSalario">Salario esperado (COP)</Label>
                        <Input
                          id="prefSalario"
                          type="number"
                          value={preferencesData.salarioEsperado || ""}
                          onChange={(e) =>
                            setPreferencesData((prev) => ({
                              ...prev,
                              salarioEsperado: e.target.value ? Number(e.target.value) : undefined,
                            }))
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="prefTipoContrato">Tipo de contrato</Label>
                        <select
                          id="prefTipoContrato"
                          value={preferencesData.tipoContrato}
                          onChange={(e) => setPreferencesData((prev) => ({ ...prev, tipoContrato: e.target.value }))}
                          aria-label="Seleccionar tipo de contrato"
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Seleccionar...</option>
                          <option value="Tiempo completo">Tiempo completo</option>
                          <option value="Medio tiempo">Medio tiempo</option>
                          <option value="Freelance">Freelance</option>
                          <option value="Contrato">Contrato</option>
                          <option value="Por proyecto">Por proyecto</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="flex items-center gap-2 mt-1">
                          <input
                            type="checkbox"
                            checked={preferencesData.disponibilidadInmediata}
                            onChange={(e) =>
                              setPreferencesData((prev) => ({ ...prev, disponibilidadInmediata: e.target.checked }))
                            }
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Disponibilidad inmediata</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Button type="button" variant="outline" onClick={handleBack} disabled={currentStep === 0 || isSaving}>
                    Volver
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Guardando..." : currentStep === ONBOARDING_STEPS.length - 1 ? "Finalizar onboarding" : "Continuar"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </>
  );
}