import { RoleDetail, RoleRecommendation, RoleSkill, RoleTechnology, SkillGap } from "@/types/matching";

const MATCHING_FACTORS_EXPLANATION =
  "Tu match score considera: Skills tecnicas (50%), Experiencia laboral (25%), Educacion (15%), Preferencias de trabajo (10%).";

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const toText = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  return fallback;
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const toNullableText = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = toText(value).trim();
  return normalized || null;
};

const clampPercentage = (value: number): number => {
  if (value < 0) return 0;
  if (value > 100) return 100;

  return Number(value.toFixed(1));
};

const parseSkillGap = (value: unknown): SkillGap | null => {
  if (typeof value === "string") {
    const skillName = value.trim();
    if (!skillName) {
      return null;
    }

    return {
      skill_name: skillName,
      importance_weight: 0,
    };
  }

  if (!isObject(value)) {
    return null;
  }

  const skillName = toText(value.skill_name || value.name).trim();
  if (!skillName) {
    return null;
  }

  return {
    skill_name: skillName,
    importance_weight: toNumber(value.importance_weight ?? value.weight, 0),
  };
};

const parseRoleRecommendation = (value: unknown): RoleRecommendation | null => {
  if (!isObject(value)) {
    return null;
  }

  const roleId = toText(value.role_id ?? value.id).trim();
  const roleName = toText(value.role_name ?? value.name).trim();
  const totalScore = toNumber(value.total_score, 0);
  const category = toText(value.category).trim();
  const seniorityLevel = toText(value.seniority_level).trim();
  const minEnglishLevel = toText(value.min_english_level).trim();

  if (!roleId || !roleName || !category || !seniorityLevel || !minEnglishLevel) {
    return null;
  }

  const skillGapsRaw = Array.isArray(value.skill_gaps) ? value.skill_gaps : [];
  const skillGaps =
    skillGapsRaw.length > 0
      ? skillGapsRaw
          .map(parseSkillGap)
          .filter((item): item is SkillGap => item !== null)
          .sort((a, b) => b.importance_weight - a.importance_weight)
      : undefined;

  return {
    role_id: roleId,
    role_name: roleName,
    total_score: clampPercentage(totalScore),
    category: category as "tech" | "data" | "design",
    seniority_level: seniorityLevel as "junior" | "mid" | "senior",
    min_english_level: minEnglishLevel as "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
    estimated_salary_min_cop: toNumber(value.estimated_salary_min_cop, 0) || undefined,
    estimated_salary_max_cop: toNumber(value.estimated_salary_max_cop, 0) || undefined,
    ...(skillGaps ? { skill_gaps: skillGaps } : {}),
    ...(value.description ? { description: toNullableText(value.description) } : {}),
  };
};

const parseRoleSkill = (value: unknown): RoleSkill | null => {
  if (!isObject(value)) {
    return null;
  }

  const skillName = toText(value.skill_name || value.technology_name || value.name).trim();
  if (!skillName) return null;

  return {
    role_skill_id: toNumber(value.id, 0) || undefined,
    technology_id: toNumber(value.technology_id, 0) || undefined,
    skill_name: skillName,
    importance_weight: toNumber(value.importance_weight ?? value.weight, 0) || undefined,
    is_required: typeof value.is_required === "boolean" ? value.is_required : undefined,
    required_level: toText(value.required_level ?? value.level).trim() || undefined,
  };
};

const parseRoleTechnology = (value: unknown): RoleTechnology | null => {
  if (!isObject(value)) {
    return null;
  }

  const technologyName = toText(value.technology_name || value.name).trim();
  if (!technologyName) return null;

  return {
    technology_name: technologyName,
    required_level: toText(value.required_level ?? value.level).trim() || undefined,
  };
};

const parseRoleDetail = (value: unknown): RoleDetail => {
  const recommendation = parseRoleRecommendation(value);

  if (!recommendation) {
    throw new Error("No se pudo interpretar el detalle del rol.");
  }

  const payload = isObject(value) ? value : {};
  const rawSkills = Array.isArray(payload.required_skills)
    ? payload.required_skills
    : Array.isArray(payload.role_skills)
      ? payload.role_skills
    : Array.isArray(payload.skills)
      ? payload.skills
      : [];

  const rawTechnologies = Array.isArray(payload.required_technologies)
    ? payload.required_technologies
    : Array.isArray(payload.technologies)
      ? payload.technologies
      : Array.isArray(payload.role_skills)
        ? payload.role_skills
      : [];

  return {
    ...recommendation,
    long_description: toText(payload.long_description || payload.full_description || payload.description)
      .trim() || undefined,
    required_skills: rawSkills
      .map(parseRoleSkill)
      .filter((item): item is RoleSkill => item !== null)
      .sort((a, b) => (b.importance_weight || 0) - (a.importance_weight || 0)),
    required_technologies: rawTechnologies
      .map(parseRoleTechnology)
      .filter((item): item is RoleTechnology => item !== null),
  };
};

const parseErrorMessage = async (response: Response, fallbackMessage: string): Promise<string> => {
  try {
    const payload = (await response.json()) as unknown;
    if (isObject(payload)) {
      const msg = payload.message || payload.detail || payload.error;
      if (typeof msg === "string" && msg.trim()) {
        return msg.trim();
      }
      if (typeof msg === "object" && msg !== null) {
        const stringified = String(msg);
        if (stringified && stringified !== "[object Object]") {
          return stringified;
        }
      }
    }
  } catch {
    // Ignore payload parse errors and return fallback.
  }

  return fallbackMessage;
};

const fetchWithAuth = async (url: string, token: string, init?: RequestInit): Promise<Response> => {
  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
};

export const getRecommendations = async (token: string): Promise<RoleRecommendation[]> => {
  const response = await fetchWithAuth("/api/matching/recommendations", token, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "No se pudieron cargar las recomendaciones."));
  }

  const payload = (await response.json()) as unknown;
  let list: unknown[] = [];

  if (isObject(payload) && Array.isArray(payload.recommendations)) {
    list = payload.recommendations;
  } else if (Array.isArray(payload)) {
    list = payload;
  }

  return list
    .map(parseRoleRecommendation)
    .filter((item): item is RoleRecommendation => item !== null);
};

export const recalculateRecommendations = async (token: string): Promise<void> => {
  const response = await fetchWithAuth("/api/matching/calculate", token, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "No se pudo recalcular el matching."));
  }
};

export const getRoleDetail = async (roleId: string, token: string): Promise<RoleDetail> => {
  const response = await fetchWithAuth(`/api/roles/${encodeURIComponent(roleId)}`, token, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "No se pudo cargar el detalle del rol."));
  }

  const payload = (await response.json()) as unknown;
  return parseRoleDetail(payload);
};

export const getRoles = async (
  token: string,
  filters?: {
    category?: string;
    seniority_level?: string;
    min_english_level?: string;
    active?: boolean;
    page?: number;
    size?: number;
  }
): Promise<RoleRecommendation[]> => {
  const query = new URLSearchParams();
  if (filters?.category) query.set("category", filters.category);
  if (filters?.seniority_level) query.set("seniority_level", filters.seniority_level);
  if (filters?.min_english_level) query.set("min_english_level", filters.min_english_level);
  if (typeof filters?.active === "boolean") query.set("active", String(filters.active));
  if (typeof filters?.page === "number") query.set("page", String(filters.page));
  if (typeof filters?.size === "number") query.set("size", String(filters.size));

  const url = query.toString() ? `/api/roles?${query.toString()}` : "/api/roles";
  const response = await fetchWithAuth(url, token, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "No se pudo cargar la lista de roles."));
  }

  const payload = (await response.json()) as unknown;
  const list = Array.isArray(payload)
    ? payload
    : isObject(payload) && Array.isArray(payload.items)
      ? payload.items
      : [];

  return list
    .map(parseRoleRecommendation)
    .filter((item): item is RoleRecommendation => item !== null);
};

export const matchingFactorsExplanation = MATCHING_FACTORS_EXPLANATION;
