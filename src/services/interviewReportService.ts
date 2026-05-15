import {
  EvaluationHistoryResponse,
  InterviewReportResponse,
  InterviewReportsHistoryResponse,
  UserBadge,
} from "@/types/interviewReport";

import { BACKEND_URL } from "@/config/api";

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

export class NotFoundError extends Error {
  constructor() {
    super("Sesión no encontrada.");
    this.name = "NotFoundError";
  }
}

export const getInterviewReport = async (
  sessionId: number,
  token: string
): Promise<InterviewReportResponse> => {
  const response = await fetch(
    `${BACKEND_URL}/api/interviews/${encodeURIComponent(sessionId)}/report`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.status === 404) {
    throw new NotFoundError();
  }

  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, "No se pudo cargar el reporte de la entrevista.")
    );
  }

  return (await response.json()) as InterviewReportResponse;
};

export const getInterviewReportsHistory = async (
  token: string
): Promise<InterviewReportsHistoryResponse> => {
  const response = await fetch(
    `${BACKEND_URL}/api/interviews/reports`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, "No se pudo cargar el historial de reportes.")
    );
  }

  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? (payload as InterviewReportsHistoryResponse) : [];
};

export const getUserBadges = async (token: string): Promise<UserBadge[]> => {
  const response = await fetch(`${BACKEND_URL}/api/badges/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, "No se pudieron cargar los badges.")
    );
  }

  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? (payload as UserBadge[]) : [];
};

export const getEvaluationHistory = async (
  token: string,
  limit = 5
): Promise<EvaluationHistoryResponse> => {
  const response = await fetch(`/api/evaluations/history?limit=${limit}&offset=0`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, "No se pudo cargar el historial de evaluaciones.")
    );
  }

  const payload = (await response.json()) as unknown;
  if (isObject(payload) && Array.isArray(payload.items)) {
    return payload as unknown as EvaluationHistoryResponse;
  }
  return { items: [], total: 0, limit, offset: 0 };
};
