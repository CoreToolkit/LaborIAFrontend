import {
  ImprovementPlan,
  RefreshImprovementPlanResponse,
  ImprovementPlanHistoryEntry,
} from "@/types/improvementPlan";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

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

export const getImprovementPlan = async (token: string): Promise<ImprovementPlan> => {
  const response = await fetch(`${BACKEND_URL}/api/improvement-plan/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, "No se pudo cargar el plan de mejora.")
    );
  }

  return (await response.json()) as ImprovementPlan;
};

export const refreshImprovementPlan = async (
  token: string
): Promise<RefreshImprovementPlanResponse> => {
  const response = await fetch(`${BACKEND_URL}/api/improvement-plan/refresh`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, "No se pudo actualizar el plan de mejora.")
    );
  }

  return (await response.json()) as RefreshImprovementPlanResponse;
};

export const getImprovementPlanHistory = async (
  token: string
): Promise<ImprovementPlanHistoryEntry[]> => {
  const response = await fetch(`${BACKEND_URL}/api/improvement-plan/history`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, "No se pudo cargar el historial del plan de mejora.")
    );
  }

  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? (payload as ImprovementPlanHistoryEntry[]) : [];
};
