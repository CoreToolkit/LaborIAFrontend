import React from "react";
import {
  clearPersistedRejoinState,
  persistRejoinState,
} from "@/utils/interviewRoom";

type SignalingMessage = {
  event: string;
  from?: string;
  user_id?: string;
  displayName?: string;
};

type UseInterviewRoomSocketLifecycleArgs = {
  roleId: string;
  resyncTimersRef: React.MutableRefObject<number[]>;
  setConnectionStatus: React.Dispatch<React.SetStateAction<"disconnected" | "connecting" | "connected">>;
  setIsJoined: React.Dispatch<React.SetStateAction<boolean>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  syncRoomState: (headers: HeadersInit, sessionCode: string) => Promise<void>;
  sendJson: (message: SignalingMessage) => void;
  startRecorder: (stream: MediaStream) => boolean;
  requestResync: (reason: string) => void;
  handleSocketMessage: (event: MessageEvent, sessionUserId: string) => void;
};

type AttachSocketLifecycleParams = {
  socket: WebSocket;
  headers: HeadersInit;
  resolvedSessionCode: string;
  safeDisplayName: string;
  sessionUserId: string;
  localStream: MediaStream;
};

export function useInterviewRoomSocketLifecycle({
  roleId,
  resyncTimersRef,
  setConnectionStatus,
  setIsJoined,
  setErrorMessage,
  syncRoomState,
  sendJson,
  startRecorder,
  requestResync,
  handleSocketMessage,
}: UseInterviewRoomSocketLifecycleArgs) {
  const attachSocketLifecycleHandlers = React.useCallback(({
    socket,
    headers,
    resolvedSessionCode,
    safeDisplayName,
    sessionUserId,
    localStream,
  }: AttachSocketLifecycleParams) => {
    // Ref local que indica si este socket llegó a abrir exitosamente.
    // Se usa en onclose para distinguir "salida voluntaria tras conectarse"
    // de "fallo antes de completar la conexión inicial".
    let didOpen = false;

    socket.onopen = () => {
      didOpen = true;
      setConnectionStatus("connected");
      setIsJoined(true);
      void syncRoomState(headers, resolvedSessionCode);

      persistRejoinState({
        roomId: resolvedSessionCode,
        displayName: safeDisplayName,
        userId: sessionUserId,
        roleId,
      });

      sendJson({
        event: "join",
        from: sessionUserId,
        user_id: sessionUserId,
        displayName: safeDisplayName,
      });

      const started = startRecorder(localStream);
      if (!started) {
        setErrorMessage("No se pudo iniciar la captura de audio. Revisa permisos y compatibilidad.");
      }

      // The new peer requests resync so existing peers restart MediaRecorder and send decodable initial segments.
      requestResync("join-initial");
      const t1 = window.setTimeout(() => requestResync("join-retry-1"), 450);
      const t2 = window.setTimeout(() => requestResync("join-retry-2"), 1200);
      resyncTimersRef.current.push(t1, t2);
    };

    socket.onclose = (closeEvent) => {
      setConnectionStatus("disconnected");

      // Si el socket se abrió exitosamente, el cierre fue voluntario (el
      // usuario salió o la sesión terminó normalmente) — no mostrar error.
      if (didOpen) {
        return;
      }

      // El socket se cerró sin haber abierto: fue un fallo de conexión inicial.
      const reason = closeEvent.reason || "";

      if (reason === "session_already_started") {
        clearPersistedRejoinState();
        setErrorMessage(
          "Esta sesión ya ha finalizado o fue cerrada. Crea una nueva sesión para continuar.",
        );
      } else if (reason === "group_session_not_found") {
        clearPersistedRejoinState();
        setErrorMessage(
          "El Session Code no existe o ya no está disponible. Verifica el código e intenta de nuevo.",
        );
      } else if (reason === "user_not_found") {
        setErrorMessage(
          "Tu usuario no fue encontrado. Vuelve a iniciar sesión.",
        );
      } else {
        const detail = reason
          ? ` (${reason})`
          : closeEvent.code !== 1000 ? ` (código ${closeEvent.code})` : "";
        setErrorMessage(
          `No se pudo conectar a la sala${detail}. Verifica que el backend esté corriendo y que el Session Code sea válido.`,
        );
      }
    };

    socket.onerror = () => {
      console.warn("[ws] Error de conexión WebSocket");
    };

    socket.onmessage = (event: MessageEvent) => {
      handleSocketMessage(event, sessionUserId);
    };
  }, [
    handleSocketMessage,
    requestResync,
    resyncTimersRef,
    roleId,
    sendJson,
    setConnectionStatus,
    setErrorMessage,
    setIsJoined,
    startRecorder,
    syncRoomState,
  ]);

  return {
    attachSocketLifecycleHandlers,
  };
}
