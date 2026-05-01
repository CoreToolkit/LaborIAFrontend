import { InterviewReportResponse, InterviewReportsHistoryResponse } from "@/types/interviewReport";

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
