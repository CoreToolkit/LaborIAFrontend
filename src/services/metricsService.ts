import { EmployabilityScoreResponse, UserMetricsResponse } from "@/types/metrics";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const clamp = (value: number): number =>
  Number(Math.max(0, Math.min(100, value)).toFixed(1));

const parseErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = (await response.json()) as unknown;
    if (isObject(payload)) {
      const msg = payload.message ?? payload.detail ?? payload.error;
      if (typeof msg === "string" && msg.trim()) return msg.trim();
    }
  } catch {
    // ignore
  }
  return fallback;
};

const parseEmployabilityScore = (payload: unknown): EmployabilityScoreResponse => {
  if (!isObject(payload)) {
    throw new Error("Respuesta inesperada del servidor.");
  }

  const breakdown = isObject(payload.breakdown) ? payload.breakdown : {};

  return {
    score: clamp(toNumber(payload.score)),
    breakdown: {
      interview_score: clamp(toNumber(breakdown.interview_score)),
      profile_completeness: clamp(toNumber(breakdown.profile_completeness)),
      avg_match_score: clamp(toNumber(breakdown.avg_match_score)),
    },
    last_updated:
      typeof payload.last_updated === "string" ? payload.last_updated : null,
    motivational_message:
      typeof payload.motivational_message === "string" && payload.motivational_message.trim()
        ? payload.motivational_message.trim()
        : null,
  };
};

const parseUserMetrics = (payload: unknown): UserMetricsResponse => {
  if (!isObject(payload)) {
    throw new Error("Respuesta inesperada del servidor.");
  }

  const rawSkills = isObject(payload.score_by_skill) ? payload.score_by_skill : {};
  const score_by_skill: Record<string, number> = {};
  for (const [key, val] of Object.entries(rawSkills)) {
    score_by_skill[key] = clamp(toNumber(val));
  }

  return {
    avg_score: clamp(toNumber(payload.avg_score)),
    score_by_skill,
    total_interviews: Math.max(0, Math.floor(toNumber(payload.total_interviews))),
    last_updated:
      typeof payload.last_updated === "string" ? payload.last_updated : null,
  };
};

export const getUserMetrics = async (token: string): Promise<UserMetricsResponse> => {
  const response = await fetch("/api/metrics/user", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, "No se pudo cargar las métricas del usuario.")
    );
  }

  const payload = (await response.json()) as unknown;
  return parseUserMetrics(payload);
};

export const getEmployabilityScore = async (
  token: string
): Promise<EmployabilityScoreResponse> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/metrics/employability`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, "No se pudo cargar el score de empleabilidad.")
    );
  }

  const payload = (await response.json()) as unknown;
  return parseEmployabilityScore(payload);
};
