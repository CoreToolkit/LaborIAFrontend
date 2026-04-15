type JsonRecord = Record<string, unknown>;

export interface GenerateInterviewQuestionAudioParams {
  text: string;
}

export interface InterviewQuestionAudioResponse {
  audioBase64: string;
  mimeType: string | null;
}

const isObject = (value: unknown): value is JsonRecord => {
  return typeof value === "object" && value !== null;
};

const toText = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
};

const toNullableText = (value: unknown): string | null => {
  const normalized = toText(value).trim();
  return normalized || null;
};

const parseErrorMessage = async (response: Response, fallbackMessage: string): Promise<string> => {
  try {
    const payload = (await response.json()) as unknown;
    if (isObject(payload)) {
      const message = payload.message || payload.detail || payload.error;
      const normalized = toText(message).trim();
      if (normalized) {
        return normalized;
      }
    }
  } catch {
    // Ignore parse errors and use the fallback message.
  }

  return fallbackMessage;
};

const parseInterviewTtsPayload = (payload: unknown): InterviewQuestionAudioResponse => {
  const candidate = isObject(payload) && isObject(payload.data) ? payload.data : payload;
  if (!isObject(candidate)) {
    throw new Error("La respuesta del servicio TTS no tiene un formato valido.");
  }

  const audioBase64 = toText(
    candidate.audio_base64 ||
      candidate.audioBase64 ||
      candidate.base64 ||
      candidate.audio
  ).trim();

  if (!audioBase64) {
    throw new Error("La respuesta del servicio TTS no incluye audio en base64.");
  }

  return {
    audioBase64,
    mimeType: toNullableText(
      candidate.mime_type || candidate.mimeType || candidate.content_type || candidate.contentType
    ),
  };
};

const postWithAuth = async (
  url: string,
  token: string,
  body: GenerateInterviewQuestionAudioParams
): Promise<Response> => {
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
};

export const generateInterviewQuestionAudio = async (
  params: GenerateInterviewQuestionAudioParams,
  token: string
): Promise<InterviewQuestionAudioResponse> => {
  const response = await postWithAuth("/api/interview/tts", token, params);

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "No se pudo generar el audio de la pregunta."));
  }

  const payload = (await response.json()) as unknown;
  return parseInterviewTtsPayload(payload);
};
