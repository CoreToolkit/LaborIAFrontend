import { PerfilCompleto, Experience, Skill } from "@/types/profile";
import type {
  BackendAuthMeResponse,
  BackendExperiencePayload,
  BackendExperienceResponse,
  BackendProfilePayload,
  BackendProfileResponse,
  BackendSkillPayload,
  BackendSkillResponse,
} from "@/types/profileBackend";

// ─── Re-export backend types so existing callers keep working ─────────────────
export type {
  BackendAuthMeResponse,
  BackendExperiencePayload,
  BackendExperienceResponse,
  BackendProfilePayload,
  BackendProfileResponse,
  BackendSkillPayload,
  BackendSkillResponse,
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ENGLISH_LEVEL_TO_BACKEND: Record<string, string> = {
  Basico: "Basic",
  "Básico": "Basic",
  Intermedio: "Intermediate",
  Avanzado: "Advanced",
  Fluido: "Advanced",
  Nativo: "Native",
  Basic: "Basic",
  Intermediate: "Intermediate",
  Advanced: "Advanced",
  Native: "Native",
};

const ENGLISH_LEVEL_TO_FRONTEND: Record<string, string> = {
  Basic: "Basico",
  Intermediate: "Intermedio",
  Advanced: "Avanzado",
  Fluent: "Fluido",
  Native: "Nativo",
};

const EMPLOYMENT_TYPE_TO_BACKEND: Record<string, string> = {
  "Tiempo completo": "Full-time",
  "Medio tiempo": "Part-time",
  Freelance: "Freelance",
  Contrato: "Contract",
  "Por proyecto": "Contract",
  Pasantia: "Internship",
  "Pasantía": "Internship",
  Internship: "Internship",
  "Full-time": "Full-time",
  "Part-time": "Part-time",
  Contract: "Contract",
};

const EMPLOYMENT_TYPE_TO_FRONTEND: Record<string, string> = {
  "Full-time": "Tiempo completo",
  "Part-time": "Medio tiempo",
  Freelance: "Freelance",
  Contract: "Contrato",
  Internship: "Pasantía",
};

const SKILL_LEVEL_TO_BACKEND: Record<Skill["nivel"], string> = {
  Basico: "basic",
  Intermedio: "intermediate",
  Avanzado: "advanced",
};

export const VALID_BACKEND_ENGLISH_LEVELS = new Set(["Basic", "Intermediate", "Advanced", "Native"]);
export const VALID_BACKEND_EMPLOYMENT_TYPES = new Set([
  "Full-time",
  "Part-time",
  "Contract",
  "Freelance",
  "Internship",
]);

// ─── Primitive converters ─────────────────────────────────────────────────────

export const normalizeText = (value?: string | null): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const toFrontendEnglishLevel = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  return ENGLISH_LEVEL_TO_FRONTEND[value] || value;
};

export const toBackendEnglishLevel = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  return ENGLISH_LEVEL_TO_BACKEND[value] || value;
};

export const toFrontendEmploymentType = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  return EMPLOYMENT_TYPE_TO_FRONTEND[value] || value;
};

export const toBackendEmploymentType = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  return EMPLOYMENT_TYPE_TO_BACKEND[value] || value;
};

export const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const toBackendSkillLevel = (value?: Skill["nivel"]): string | undefined => {
  if (!value) return undefined;
  return SKILL_LEVEL_TO_BACKEND[value] || value;
};

export const toFrontendSkillLevel = (value?: string | null): Skill["nivel"] => {
  const normalized = normalizeText(value)?.toLowerCase();
  if (!normalized) return "Intermedio";
  if (normalized.includes("basic") || normalized.includes("basico") || normalized.includes("junior")) {
    return "Basico";
  }
  if (
    normalized.includes("advanced") ||
    normalized.includes("avanz") ||
    normalized.includes("senior") ||
    normalized.includes("expert")
  ) {
    return "Avanzado";
  }
  return "Intermedio";
};

export const toFrontendSkillType = (value?: string | null): Skill["tipo"] => {
  const normalized = normalizeText(value)?.toLowerCase();
  if (!normalized) return "tecnica";
  if (normalized.includes("soft") || normalized.includes("blanda")) return "blanda";
  return "tecnica";
};

// ─── ID validation ────────────────────────────────────────────────────────────

export const toResourceIdOrThrow = (id: string, resourceName: string): number => {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`ID de ${resourceName} inválido.`);
  }
  return parsed;
};

// ─── Model mappers ────────────────────────────────────────────────────────────

export const mapBackendExperienceToFrontend = (b: BackendExperienceResponse): Experience => ({
  id: String(b.id),
  cargo: b.position,
  empresa: b.company,
  fechaInicio: b.start_date,
  fechaFin: b.end_date ?? null,
  descripcion: normalizeText(b.description),
  esActual: b.currently_working,
  ubicacion: normalizeText(b.ubicacion),
});

export const mapFrontendExperienceToBackend = (e: Experience): BackendExperiencePayload => ({
  position: e.cargo,
  company: e.empresa,
  start_date: e.fechaInicio,
  end_date: e.esActual ? null : normalizeText(e.fechaFin) ?? null,
  description: normalizeText(e.descripcion),
  currently_working: e.esActual,
  ubicacion: normalizeText(e.ubicacion),
});

export const mapBackendSkillToFrontend = (b: BackendSkillResponse): Skill => ({
  id: String(b.id),
  nombre: b.name,
  tipo: toFrontendSkillType(b.category),
  nivel: toFrontendSkillLevel(b.level),
  descripcion: undefined,
});

export const mapFrontendSkillToBackend = (s: Skill): BackendSkillPayload => ({
  name: s.nombre,
  category: s.tipo,
  level: toBackendSkillLevel(s.nivel),
});

// ─── Profile builders ─────────────────────────────────────────────────────────

export const createEmptyProfile = (): PerfilCompleto => ({
  id: "",
  email: "",
  nombre: "",
  experiencias: [],
  habilidades: [],
  logros: [],
});

export const mergeProfile = (
  base: PerfilCompleto,
  updates: Partial<PerfilCompleto>
): PerfilCompleto => ({
  ...base,
  ...updates,
  experiencias: updates.experiencias ?? base.experiencias,
  habilidades: updates.habilidades ?? base.habilidades,
  logros: updates.logros ?? base.logros,
  preferencias: updates.preferencias
    ? { ...base.preferencias, ...updates.preferencias }
    : base.preferencias,
});

export const buildBackendPayload = (profile: PerfilCompleto): BackendProfilePayload => {
  const preferredLocation =
    normalizeText(profile.preferencias?.ubicacion) || normalizeText(profile.ubicacion);
  const salaryExpectation = toNumber(profile.preferencias?.salarioEsperado);
  const englishLevelCandidate = toBackendEnglishLevel(profile.nivelIngles);
  const employmentTypeCandidate = toBackendEmploymentType(profile.preferencias?.tipoContrato);
  const englishLevel =
    englishLevelCandidate && VALID_BACKEND_ENGLISH_LEVELS.has(englishLevelCandidate)
      ? englishLevelCandidate
      : undefined;
  const preferredEmploymentType =
    employmentTypeCandidate && VALID_BACKEND_EMPLOYMENT_TYPES.has(employmentTypeCandidate)
      ? employmentTypeCandidate
      : undefined;

  return {
    full_name: normalizeText(profile.nombre),
    career: normalizeText(profile.carrera),
    university: normalizeText(profile.universidad),
    graduation_date: normalizeText(profile.fechaGraduacion),
    description: normalizeText(profile.bio),
    english_level: englishLevel,
    preferred_location: preferredLocation,
    preferred_employment_type: preferredEmploymentType,
    salary_expectation: salaryExpectation,
  };
};

export const buildSafeCreatePayload = (payload: BackendProfilePayload): BackendProfilePayload => ({
  full_name: payload.full_name,
  career: payload.career,
  university: payload.university,
  graduation_date: payload.graduation_date,
  description: payload.description,
  preferred_location: payload.preferred_location,
});

export const mapBackendProfileIntoFrontend = (
  currentProfile: PerfilCompleto,
  backendProfile: BackendProfileResponse
): PerfilCompleto => {
  const preferredLocation = normalizeText(backendProfile.preferred_location);
  const preferredEmploymentType = toFrontendEmploymentType(
    normalizeText(backendProfile.preferred_employment_type)
  );
  const salaryExpectation = toNumber(backendProfile.salary_expectation);
  const hasBackendPreferences = Boolean(
    preferredLocation || preferredEmploymentType || salaryExpectation !== undefined
  );

  return {
    ...currentProfile,
    id:
      String(backendProfile.user_id ?? "") ||
      String(backendProfile.id ?? "") ||
      currentProfile.id,
    nombre: normalizeText(backendProfile.full_name) || currentProfile.nombre,
    carrera: normalizeText(backendProfile.career),
    universidad: normalizeText(backendProfile.university),
    fechaGraduacion: normalizeText(backendProfile.graduation_date),
    bio: normalizeText(backendProfile.description),
    nivelIngles: toFrontendEnglishLevel(normalizeText(backendProfile.english_level)),
    ubicacion: preferredLocation || currentProfile.ubicacion,
    preferencias: hasBackendPreferences
      ? {
          ...currentProfile.preferencias,
          ubicacion: preferredLocation,
          tipoContrato: preferredEmploymentType,
          salarioEsperado: salaryExpectation,
        }
      : currentProfile.preferencias,
  };
};

export const buildProfileFromBackend = (
  authData: BackendAuthMeResponse,
  backendProfile: BackendProfileResponse | null,
  backendExperiences: BackendExperienceResponse[] | null,
  backendSkills: BackendSkillResponse[] | null
): PerfilCompleto => {
  const preferredLocation =
    normalizeText(backendProfile?.preferred_location) || normalizeText(authData.ubicacion);
  const preferredEmploymentType = toFrontendEmploymentType(
    normalizeText(backendProfile?.preferred_employment_type)
  );
  const salaryExpectation = toNumber(backendProfile?.salary_expectation);
  const authPreferencias = authData.preferencias;
  const hasPreferences = Boolean(
    preferredLocation ||
      preferredEmploymentType ||
      salaryExpectation !== undefined ||
      authPreferencias?.cargo ||
      authPreferencias?.industria ||
      authPreferencias?.disponibilidadInmediata
  );

  return {
    id:
      String(authData.id ?? "") ||
      String(authData.sub ?? "") ||
      String(backendProfile?.user_id ?? "") ||
      String(backendProfile?.id ?? ""),
    email: authData.email || "",
    nombre:
      normalizeText(backendProfile?.full_name) ||
      normalizeText(authData.name) ||
      normalizeText(authData.given_name) ||
      "",
    fotoPerfil: authData.picture || authData.avatar || undefined,
    telefono: normalizeText(authData.telefono),
    ubicacion: preferredLocation,
    carrera: normalizeText(backendProfile?.career) || normalizeText(authData.carrera),
    universidad: normalizeText(backendProfile?.university) || normalizeText(authData.universidad),
    fechaGraduacion:
      normalizeText(backendProfile?.graduation_date) ||
      normalizeText(authData.fechaGraduacion) ||
      normalizeText(authData.fecha_graduacion),
    bio:
      normalizeText(backendProfile?.description) ||
      normalizeText(authData.bio) ||
      normalizeText(authData.descripcion),
    nivelIngles:
      toFrontendEnglishLevel(normalizeText(backendProfile?.english_level)) ||
      toFrontendEnglishLevel(normalizeText(authData.nivelIngles)) ||
      toFrontendEnglishLevel(normalizeText(authData.nivel_ingles)),
    experiencias:
      backendExperiences?.map(mapBackendExperienceToFrontend) || authData.experiencias || [],
    habilidades:
      backendSkills?.map(mapBackendSkillToFrontend) || authData.habilidades || [],
    preferencias: hasPreferences
      ? {
          cargo: authPreferencias?.cargo,
          industria: authPreferencias?.industria,
          ubicacion: preferredLocation,
          salarioEsperado: salaryExpectation ?? authPreferencias?.salarioEsperado,
          tipoContrato: preferredEmploymentType || authPreferencias?.tipoContrato,
          disponibilidadInmediata: authPreferencias?.disponibilidadInmediata,
        }
      : undefined,
    estadisticas: authData.estadisticas,
    logros: authData.logros || [],
    redesSociales: authData.redesSociales,
    cvUrl: authData.cvUrl,
  };
};
