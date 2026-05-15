import type {
  IndividualSession,
  GeneratedQuestion,
  SavedQuestion,
  InterviewDifficulty,
  IndividualEvaluationResult,
} from "@/types/individualInterview";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const parseError = async (res: Response, fallback: string): Promise<string> => {
  try {
    const p = (await res.json()) as unknown;
    if (isObject(p)) {
      const msg = p.message ?? p.detail ?? p.error;
      if (typeof msg === "string" && msg.trim()) return msg.trim();
    }
  } catch {
    // ignore
  }
  return fallback;
};

export const createSession = async (token: string): Promise<IndividualSession> => {
  const res = await fetch(`${BACKEND}/api/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(await parseError(res, "No se pudo crear la sesión."));
  return (await res.json()) as IndividualSession;
};

export const generateQuestion = async (
  token: string,
  params: {
    session_id: number;
    target_skill?: string;
    difficulty?: InterviewDifficulty;
    previous_questions?: string[];
  }
): Promise<GeneratedQuestion> => {
  const res = await fetch(`${BACKEND}/api/ai/azure-openai/interview/question`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await parseError(res, "No se pudo generar la pregunta."));
  return (await res.json()) as GeneratedQuestion;
};

export const saveQuestion = async (
  token: string,
  params: {
    question_text: string;
    interview_session_id: number;
    category?: string | null;
    difficulty?: string | null;
  }
): Promise<SavedQuestion> => {
  const res = await fetch(`${BACKEND}/api/questions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await parseError(res, "No se pudo guardar la pregunta."));
  return (await res.json()) as SavedQuestion;
};

export const transcribeAudio = async (
  token: string,
  audioBlob: Blob,
  language = "es-CO"
): Promise<string> => {
  const formData = new FormData();
  formData.append("file", audioBlob, "answer.wav");
  formData.append("language", language);
  const res = await fetch(`${BACKEND}/api/ai/azure-speech/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error(await parseError(res, "No se pudo transcribir el audio."));
  const data = (await res.json()) as { result: string };
  return data.result ?? "";
};

export const submitAnswer = async (
  token: string,
  params: { question_id: number; user_answer_text: string }
): Promise<{ evaluation_id: string; status: string }> => {
  const res = await fetch(`${BACKEND}/evaluations/answer`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await parseError(res, "No se pudo enviar la respuesta."));
  return (await res.json()) as { evaluation_id: string; status: string };
};

export const pollEvaluation = async (
  token: string,
  evaluationId: string
): Promise<IndividualEvaluationResult> => {
  const res = await fetch(`${BACKEND}/evaluations/evaluation/${evaluationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseError(res, "No se pudo obtener el resultado."));
  return (await res.json()) as IndividualEvaluationResult;
};
