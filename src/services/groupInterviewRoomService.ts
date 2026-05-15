export type GroupInterviewAction = "start" | "next" | "close";

type GroupSessionResponse = {
  id: number;
  session_code: string;
};

export type GroupSessionDetailResponse = {
  host_id: number;
  status: string;
  my_interview_session_id?: number | null;
};

type AuthMeResponse = {
  id: number;
};

export const getCurrentUserIdFromApi = async (
  backendHttpOrigin: string,
  headers: HeadersInit,
): Promise<number> => {
  if (!backendHttpOrigin) {
    throw new Error("No se encontró la URL del backend para auth/me.");
  }

  const response = await fetch(`${backendHttpOrigin}/auth/me`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("No se pudo validar el usuario actual. Inicia sesión de nuevo.");
  }

  const data = (await response.json()) as AuthMeResponse;
  if (!data?.id || !Number.isFinite(data.id)) {
    throw new Error("El backend no devolvió un user_id válido.");
  }

  return data.id;
};

export const fetchSessionDetailFromApi = async (
  backendHttpOrigin: string,
  headers: HeadersInit,
  sessionCode: string,
): Promise<GroupSessionDetailResponse> => {
  if (!backendHttpOrigin) {
    throw new Error("No se encontró la URL del backend para obtener la sesión.");
  }

  const response = await fetch(
    `${backendHttpOrigin}/api/group-sessions/${encodeURIComponent(sessionCode)}`,
    {
      method: "GET",
      headers,
    },
  );

  if (!response.ok) {
    throw new Error("No se pudo obtener el detalle de la sesión grupal.");
  }

  return (await response.json()) as GroupSessionDetailResponse;
};

type EnsureSessionCodeParams = {
  backendHttpOrigin: string;
  headers: HeadersInit;
  desiredCode: string;
  roleId: string;
};

export const ensureSessionCodeFromApi = async ({
  backendHttpOrigin,
  headers,
  desiredCode,
  roleId,
}: EnsureSessionCodeParams): Promise<string> => {
  if (!backendHttpOrigin) {
    throw new Error("No se encontró la URL del backend para sesiones grupales.");
  }

  const trimmedCode = desiredCode.trim().toUpperCase();
  if (trimmedCode) {
    const checkResponse = await fetch(
      `${backendHttpOrigin}/api/group-sessions/${encodeURIComponent(trimmedCode)}`,
      {
        method: "GET",
        headers,
      },
    );

    if (!checkResponse.ok) {
      throw new Error("El Session Code no existe o no está disponible.");
    }

    return trimmedCode;
  }

  if (!roleId) {
    throw new Error("No hay role_id para crear una sesión grupal nueva.");
  }

  const createResponse = await fetch(`${backendHttpOrigin}/api/group-sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      role_id: roleId,
      difficulty: "intermediate",
    }),
  });

  if (!createResponse.ok) {
    throw new Error("No se pudo crear la sesión grupal desde el backend.");
  }

  const created = (await createResponse.json()) as GroupSessionResponse;
  if (!created?.session_code) {
    throw new Error("El backend no devolvió un session_code válido.");
  }

  return created.session_code;
};

export const executeGroupSessionActionApi = async (
  backendHttpOrigin: string,
  headers: HeadersInit,
  sessionCode: string,
  action: GroupInterviewAction,
): Promise<Response> => {
  const encoded = encodeURIComponent(sessionCode);
  const endpoints: Record<GroupInterviewAction, string> = {
    start: `${backendHttpOrigin}/api/group-sessions/${encoded}/start`,
    next: `${backendHttpOrigin}/api/group-sessions/${encoded}/rounds/next`,
    close: `${backendHttpOrigin}/api/group-sessions/${encoded}/close`,
  };

  return fetch(endpoints[action], {
    method: "POST",
    headers,
    body: action === "next" ? JSON.stringify({}) : undefined,
  });
};

export const mapGroupInterviewActionError = (
  action: GroupInterviewAction,
  httpStatus: number,
): string => {
  if (httpStatus === 403) {
    return "No autorizado: solo el host puede ejecutar esta acción.";
  }

  if (httpStatus === 404) {
    return "No se encontró la sesión grupal solicitada.";
  }

  if (httpStatus === 409) {
    if (action === "start") {
      return "La sesión no está en estado waiting para iniciar.";
    }

    if (action === "next") {
      return "No se puede crear otra ronda en el estado actual de la sesión.";
    }

    return "No se puede cerrar la sesión en el estado actual.";
  }

  if (httpStatus === 502 && action === "next") {
    return "No se pudo generar la siguiente pregunta desde IA. Intenta nuevamente.";
  }

  return "No se pudo completar la acción solicitada.";
};
