import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { type AudioPlayerQuestion } from "@/components/AudioPlayer";
import PrivateRoute from "@/components/PrivateRoute";
import { getAccessToken } from "@/utils/session";
import { getRoleDetail } from "@/services/matchingService";
import { InterviewRoomHeader } from "@/components/InterviewRoom/InterviewRoomHeader";
import { InterviewRoomConnectionPanel } from "@/components/InterviewRoom/InterviewRoomConnectionPanel";
import { InterviewRoomSessionPanel } from "@/components/InterviewRoom/InterviewRoomSessionPanel";
import { InterviewRoomAnswerPanel } from "@/components/InterviewRoom/InterviewRoomAnswerPanel";
import { InterviewRoomParticipants } from "@/components/InterviewRoom/InterviewRoomParticipants";
import {
    ensureSessionCodeFromApi,
    executeGroupSessionActionApi,
    fetchSessionDetailFromApi,
    getCurrentUserIdFromApi,
    mapGroupInterviewActionError,
    type GroupInterviewAction,
} from "@/services/groupInterviewRoomService";
import {
    buildRoundEventDedupKey,
} from "@/utils/groupInterview";
import { useTTSAudioPlayer } from "@/hooks/useTTSAudioPlayer";
import { useGroupInterviewAnswerFlow } from "@/hooks/useGroupInterviewAnswerFlow";
import { useInterviewRoomAudioParticipants } from "@/hooks/useInterviewRoomAudioParticipants";
import { useInterviewRoomSocketMessageHandler } from "@/hooks/useInterviewRoomSocketMessageHandler";
import { useInterviewRoomSessionSync } from "@/hooks/useInterviewRoomSessionSync";
import { useInterviewRoomRejoin } from "@/hooks/useInterviewRoomRejoin";
import { useInterviewRoomSocketLifecycle } from "@/hooks/useInterviewRoomSocketLifecycle";
import {
    clearPersistedRejoinState,
    pickSupportedMimeType,
    readPersistedRejoinState,
    resolveBackendHttpOrigin,
    resolveBackendWsBase,
    wrapChunkWithClientHeader,
} from "@/utils/interviewRoom";
import { BACKEND_URL as BACKEND_API_BASE } from "@/config/api";

const BACKEND_WS_BASE = process.env.NEXT_PUBLIC_BACKEND_WS_BASE;

type SignalingMessage = {
    event: string;
    from?: string;
    user_id?: string;
    displayName?: string;
    round_id?: string;
    round_index?: number | string;
    question_text?: string;
    target_skill?: string;
    difficulty?: string;
    status?: string;
    evaluation_id?: string;
};

type LeaveRoomOptions = {
    notifyServer?: boolean;
    clearPersistedRejoin?: boolean;
};

type JoinRoomOptions = {
    roomIdOverride?: string;
    displayNameOverride?: string;
    allowRejoinDuringInProgress?: boolean;
};

function InterviewPageContent() {
    const router = useRouter();
    const roleId = router.isReady && typeof router.query.role_id === "string"
        ? router.query.role_id.trim()
        : "";
    const roleNameFromQuery = router.isReady && typeof router.query.role_name === "string"
        ? router.query.role_name.trim()
        : "";

    const [displayName, setDisplayName] = React.useState("");
    const [roomId, setRoomId] = React.useState("");
    const [selfId, setSelfId] = React.useState("");
    const [isJoined, setIsJoined] = React.useState(false);
    const [isConnecting, setIsConnecting] = React.useState(false);
    const [isMuted, setIsMuted] = React.useState(false);
    const [isSyncingState, setIsSyncingState] = React.useState(false);
    const [roleDisplayName, setRoleDisplayName] = React.useState<string | null>(roleNameFromQuery || null);
    const [connectionStatus, setConnectionStatus] = React.useState<"disconnected" | "connecting" | "connected">("disconnected");
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [sessionStatus, setSessionStatus] = React.useState<string>("idle");
    const [activeRoundId, setActiveRoundId] = React.useState<string | null>(null);
    const [activeRoundIndex, setActiveRoundIndex] = React.useState<number | null>(null);
    const [totalRounds, setTotalRounds] = React.useState(0);
    const [currentQuestion, setCurrentQuestion] = React.useState<AudioPlayerQuestion | null>(null);
    const [isHost, setIsHost] = React.useState(false);
    const [runningAction, setRunningAction] = React.useState<GroupInterviewAction | null>(null);
    const [sessionNumericId, setSessionNumericId] = React.useState<number | null>(null);

    const socketRef = React.useRef<WebSocket | null>(null);
    const localStreamRef = React.useRef<MediaStream | null>(null);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const selectedMimeTypeRef = React.useRef("");
    const selfIdRef = React.useRef("");
    const lastRecorderRestartAtRef = React.useRef(0);
    const resyncTimersRef = React.useRef<number[]>([]);
    const localMonitorCleanupRef = React.useRef<(() => void) | null>(null);

    const backendHttpOriginRef = React.useRef(resolveBackendHttpOrigin(BACKEND_API_BASE, BACKEND_WS_BASE));
    const backendWsBaseRef = React.useRef(resolveBackendWsBase(BACKEND_API_BASE, BACKEND_WS_BASE));
    const processedRoundEventKeysRef = React.useRef<string[]>([]);
    const autoRejoinAttemptedRef = React.useRef(false);

    // Refs para estado que el socket.onmessage necesita leer siempre actualizado.
    const activeRoundIdRef = React.useRef<string | null>(null);
    const activeRoundIndexRef = React.useRef<number | null>(null);
    const sessionStatusRef = React.useRef<string>("idle");
    const totalRoundsRef = React.useRef<number>(0);
    const currentQuestionRef = React.useRef<AudioPlayerQuestion | null>(null);

    const {
        ttsStatus,
        handleQuestionAudioReady,
        handleTtsError,
        handleRoundStarted: handleTTSRoundStarted,
        cleanup: cleanupTTSAudio,
    } = useTTSAudioPlayer(activeRoundId);

    const {
        participants,
        localLevel,
        setLocalLevel,
        updateParticipant,
        removeParticipant,
        markRemoteActivity,
        startAudioLevelMonitor,
        appendChunkForSender,
        cleanupSenderPlayer,
        clearParticipantsAndAudio,
    } = useInterviewRoomAudioParticipants();

    const {
        isRecording,
        isSubmitting,
        recordingCountdown,
        transcription,
        evaluationResult,
        isEvaluating,
        submissionError,
        resetForLeave: resetAnswerFlowForLeave,
    } = useGroupInterviewAnswerFlow({
        localStreamRef,
        activeRoundIdRef,
        currentQuestionRef,
        backendHttpOriginRef,
        roomId,
        activeRoundId,
        ttsStatus,
    });

    // Las refs se actualizan directamente en el handler del WebSocket (mismo tick de JS),
    // no en useEffect. Esto elimina la ventana de carrera entre setActiveRoundId(...)
    // y la validación del siguiente evento de la misma ráfaga (question_audio_ready
    // llega inmediatamente después de question_generated y necesita ver el round_id ya actualizado).
    // Los useEffect de sincronización introducían exactamente esa ventana.

    const shouldProcessRoundEvent = React.useCallback((eventType: string, roundId?: string | null, roundIndex?: number | null) => {
        const dedupKey = buildRoundEventDedupKey(eventType, roundId, roundIndex);
        if (!dedupKey) {
            return true;
        }

        const cache = processedRoundEventKeysRef.current;
        if (cache.includes(dedupKey)) {
            return false;
        }

        cache.push(dedupKey);
        if (cache.length > 160) {
            cache.splice(0, cache.length - 160);
        }

        return true;
    }, []);

    const unlockPlayback = React.useCallback(async () => {
        try {
            const primerAudio = new Audio();
            primerAudio.muted = true;
            const playPromise = primerAudio.play();
            if (playPromise && typeof playPromise.catch === "function") {
                playPromise.catch(() => {
                    return;
                });
            }
            primerAudio.pause();
        } catch {
            return;
        }
    }, []);

    const sendJson = React.useCallback((message: SignalingMessage) => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }
        socket.send(JSON.stringify(message));
    }, []);

    const getAuthHeaders = React.useCallback((): HeadersInit | null => {
        const token = getAccessToken();
        if (!token) {
            return null;
        }

        return {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };
    }, []);

    const getCurrentUserId = React.useCallback((headers: HeadersInit): Promise<number> => {
        return getCurrentUserIdFromApi(backendHttpOriginRef.current, headers);
    }, []);

    const fetchSessionDetail = React.useCallback((headers: HeadersInit, sessionCode: string) => {
        return fetchSessionDetailFromApi(backendHttpOriginRef.current, headers, sessionCode);
    }, []);

    const executeHostAction = React.useCallback(async (action: GroupInterviewAction) => {
        const headers = getAuthHeaders();
        const backendHttpOrigin = backendHttpOriginRef.current;
        const sessionCode = roomId.trim().toUpperCase();

        if (!headers || !backendHttpOrigin || !sessionCode) {
            setErrorMessage("No se puede ejecutar la acción sin sesión válida y token activo.");
            return;
        }

        setRunningAction(action);
        setErrorMessage(null);

        try {
            const response = await executeGroupSessionActionApi(
                backendHttpOrigin,
                headers,
                sessionCode,
                action,
            );

            if (!response.ok) {
                setErrorMessage(mapGroupInterviewActionError(action, response.status));
                return;
            }

            if (action === "start") {
                setSessionStatus("in_progress");
            }

            if (action === "close") {
                setSessionStatus("closed");
            }
        } catch {
            setErrorMessage("Error de red al ejecutar la acción del host.");
        } finally {
            setRunningAction(null);
        }
    }, [getAuthHeaders, roomId]);

    const ensureSessionCode = React.useCallback(
        async (headers: HeadersInit, desiredCode: string, roleId: string): Promise<string> => {
            return ensureSessionCodeFromApi({
                backendHttpOrigin: backendHttpOriginRef.current,
                headers,
                desiredCode,
                roleId,
            });
        },
        [],
    );

    const stopRecorder = React.useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) {
            return;
        }

        try {
            if (recorder.state !== "inactive") {
                recorder.stop();
            }
        } catch {
            return;
        }

        mediaRecorderRef.current = null;
    }, []);

    const requestResync = React.useCallback((reason: string) => {
        const socket = socketRef.current;
        const from = selfIdRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN || !from) {
            return;
        }

        sendJson({
            event: "request_resync",
            from,
            user_id: from,
            displayName: reason,
        });
    }, [sendJson]);

    const startRecorder = React.useCallback((stream: MediaStream): boolean => {
        const selectedMimeType = selectedMimeTypeRef.current;

        try {
            mediaRecorderRef.current = selectedMimeType
                ? new MediaRecorder(stream, { mimeType: selectedMimeType })
                : new MediaRecorder(stream);
        } catch {
            return false;
        }

        const recorder = mediaRecorderRef.current;
        if (!recorder) {
            return false;
        }

        recorder.onerror = () => {
            setErrorMessage("Error en captura de audio. Intenta reconectar la sala.");
        };

        recorder.ondataavailable = async (event) => {
            if (!event.data || event.data.size === 0) {
                return;
            }

            const socket = socketRef.current;
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                return;
            }

            if (isMuted) {
                return;
            }

            try {
                const audioArrayBuffer = await event.data.arrayBuffer();
                const wrapped = wrapChunkWithClientHeader(audioArrayBuffer, selectedMimeType || event.data.type || "");
                socket.send(wrapped);
            } catch {
                return;
            }
        };

        try {
            recorder.start(250);
            return true;
        } catch {
            return false;
        }
    }, [isMuted]);

    const restartRecorderForNewPeer = React.useCallback((silent = false) => {
        const stream = localStreamRef.current;
        if (!stream) {
            return;
        }

        const now = Date.now();
        if (now - lastRecorderRestartAtRef.current < 900) {
            return;
        }
        lastRecorderRestartAtRef.current = now;

        stopRecorder();
        const started = startRecorder(stream);
        if (!started) {
            setErrorMessage("No se pudo resincronizar el audio local. Intenta salir y volver a entrar.");
            return;
        }

        if (!silent) {
            console.log("[audio-capture] Reiniciando MediaRecorder para sincronizar con nuevo participante");
        }
    }, [startRecorder, stopRecorder]);

    const {
        handleSocketMessage,
    } = useInterviewRoomSocketMessageHandler({
        selectedMimeTypeRef,
        activeRoundIdRef,
        activeRoundIndexRef,
        sessionStatusRef,
        totalRoundsRef,
        currentQuestionRef,
        shouldProcessRoundEvent,
        setSessionStatus,
        setActiveRoundId,
        setActiveRoundIndex,
        setTotalRounds,
        setCurrentQuestion,
        updateParticipant,
        appendChunkForSender,
        markRemoteActivity,
        cleanupSenderPlayer,
        removeParticipant,
        restartRecorderForNewPeer,
        handleTTSRoundStarted,
        handleQuestionAudioReady,
        handleTtsError,
    });

    const {
        syncRoomState,
    } = useInterviewRoomSessionSync({
        backendHttpOriginRef,
        activeRoundIdRef,
        activeRoundIndexRef,
        sessionStatusRef,
        totalRoundsRef,
        currentQuestionRef,
        setIsSyncingState,
        setSessionStatus,
        setActiveRoundId,
        setActiveRoundIndex,
        setTotalRounds,
        setCurrentQuestion,
    });

    const {
        attachSocketLifecycleHandlers,
    } = useInterviewRoomSocketLifecycle({
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
    });

    const leaveRoom = React.useCallback(async (options?: LeaveRoomOptions) => {
        const notifyServer = options?.notifyServer ?? true;
        const clearPersistedRejoin = options?.clearPersistedRejoin ?? false;
        const currentSelfId = selfIdRef.current;

        setConnectionStatus("disconnected");
        setIsJoined(false);
        setSelfId("");
        clearParticipantsAndAudio();
        setIsSyncingState(false);
        setIsMuted(false);
        setSessionStatus("idle");
        setActiveRoundId(null);
        setActiveRoundIndex(null);
        setTotalRounds(0);
        setCurrentQuestion(null);
        setIsHost(false);
        setRunningAction(null);
        processedRoundEventKeysRef.current = [];

        // Resetear refs de ronda inmediatamente para que no queden valores stale
        // si el componente se reconecta sin desmontar.
        activeRoundIdRef.current = null;
        activeRoundIndexRef.current = null;
        sessionStatusRef.current = "idle";
        totalRoundsRef.current = 0;
        currentQuestionRef.current = null;
        resetAnswerFlowForLeave();

        selfIdRef.current = "";

        if (localMonitorCleanupRef.current) {
            localMonitorCleanupRef.current();
            localMonitorCleanupRef.current = null;
        }

        if (resyncTimersRef.current.length > 0) {
            resyncTimersRef.current.forEach((timer) => {
                window.clearTimeout(timer);
            });
            resyncTimersRef.current = [];
        }

        stopRecorder();

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                track.stop();
            });
            localStreamRef.current = null;
        }

        cleanupTTSAudio();

        const socket = socketRef.current;
        if (socket) {
            if (notifyServer && socket.readyState === WebSocket.OPEN && currentSelfId) {
                sendJson({
                    event: "leave",
                    from: currentSelfId,
                    user_id: currentSelfId,
                });
            }
            socket.close();
            socketRef.current = null;
        }

        if (clearPersistedRejoin) {
            clearPersistedRejoinState();
        }
    }, [clearParticipantsAndAudio, cleanupTTSAudio, resetAnswerFlowForLeave, sendJson, stopRecorder]);

    React.useEffect(() => {
        return () => {
            void leaveRoom({ notifyServer: false });
        };
    }, [leaveRoom]);

    const joinRoom = React.useCallback(async (options?: JoinRoomOptions) => {
        const safeRoomId = (options?.roomIdOverride ?? roomId).trim();
        const safeDisplayName = (options?.displayNameOverride ?? displayName).trim();

        if (!safeDisplayName) {
            setErrorMessage("Debes ingresar tu nombre para entrar.");
            return;
        }

        const supportedMimeType = pickSupportedMimeType();
        if (!supportedMimeType) {
            setErrorMessage("Este navegador no soporta un formato de audio compatible para la sala.");
            return;
        }

        selectedMimeTypeRef.current = supportedMimeType;

        setIsConnecting(true);
        setErrorMessage(null);
        setConnectionStatus("connecting");

        try {
            await unlockPlayback();
            await leaveRoom({ notifyServer: false });

            const headers = getAuthHeaders();
            if (!headers) {
                throw new Error("No se encontró token de sesión. Vuelve a iniciar sesión.");
            }

            const resolvedUserId = await getCurrentUserId(headers);
            const resolvedSessionCode = await ensureSessionCode(headers, safeRoomId, roleId);
            const sessionDetail = await fetchSessionDetail(headers, resolvedSessionCode);

            const resolvedUserIdAsString = String(resolvedUserId);
            const persisted = readPersistedRejoinState();
            const isKnownRejoin =
                options?.allowRejoinDuringInProgress
                || (
                    !!persisted
                    && persisted.roomId.trim().toUpperCase() === resolvedSessionCode.trim().toUpperCase()
                    && persisted.userId === resolvedUserIdAsString
                );

            // Validar estado de la sesión antes de conectar
            const sessionStatus = sessionDetail.status || "waiting";
            if (sessionStatus === "in_progress" && !isKnownRejoin) {
                throw new Error("La entrevista ya ha comenzado. No se pueden agregar nuevos participantes.");
            }
            if (sessionStatus === "closed") {
                throw new Error("La entrevista ha finalizado. No se pueden agregar participantes.");
            }

            const localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });

            localStreamRef.current = localStream;
            setIsMuted(false);

            localMonitorCleanupRef.current = startAudioLevelMonitor(localStream, (level) => {
                setLocalLevel(level);
            });

            const sessionUserId = resolvedUserIdAsString;
            selfIdRef.current = sessionUserId;
            setSelfId(sessionUserId);
            setRoomId(resolvedSessionCode);
            setDisplayName(safeDisplayName);
            setIsHost(sessionDetail.host_id === resolvedUserId);
            setSessionStatus(sessionStatus);
            if (sessionDetail.my_interview_session_id && Number.isFinite(sessionDetail.my_interview_session_id)) {
                setSessionNumericId(sessionDetail.my_interview_session_id);
            }

            const encodedRoom = encodeURIComponent(resolvedSessionCode);
            const encodedUser = encodeURIComponent(sessionUserId);
            const backendWsBase = backendWsBaseRef.current;
            if (!backendWsBase) {
                throw new Error("No se encontró la URL del backend para WebSocket.");
            }

            const wsUrl = `${backendWsBase}/${encodedRoom}/${encodedUser}`;

            const socket = new WebSocket(wsUrl);
            socket.binaryType = "arraybuffer";
            socketRef.current = socket;

            attachSocketLifecycleHandlers({
                socket,
                headers,
                resolvedSessionCode,
                safeDisplayName,
                sessionUserId,
                localStream,
            });
        } catch (error) {
            const fallback = "No fue posible conectarte a la sala. Revisa permisos de microfono y vuelve a intentar.";
            const msg = error instanceof Error && error.message ? error.message : fallback;
            setErrorMessage(msg);
            await leaveRoom({ notifyServer: false });
        } finally {
            setIsConnecting(false);
        }
    }, [attachSocketLifecycleHandlers, displayName, ensureSessionCode, fetchSessionDetail, getAuthHeaders, getCurrentUserId, isJoined, leaveRoom, roleId, roomId, startAudioLevelMonitor, unlockPlayback]);

    useInterviewRoomRejoin({
        displayName,
        roomId,
        roleId,
        isJoined,
        isConnecting,
        routerIsReady: router.isReady,
        setDisplayName,
        setRoomId,
        joinRoom,
        autoRejoinAttemptedRef,
    });

    const toggleMute = () => {
        const localStream = localStreamRef.current;
        if (!localStream) {
            return;
        }

        const nextMuted = !isMuted;

        localStream.getAudioTracks().forEach((track) => {
            track.enabled = !nextMuted;
        });

        setIsMuted(nextMuted);
    };

    const copyRoomId = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
        } catch {
            setErrorMessage("No se pudo copiar el Room ID automaticamente.");
        }
    };

    const localName = displayName.trim() || "Tu usuario";
    const activeRemoteCount = participants.length;
    const accessToken = typeof window !== "undefined" ? getAccessToken() : null;
    const startDisabled = sessionStatus !== "waiting" || runningAction !== null;
    const nextDisabled = sessionStatus !== "in_progress" || runningAction !== null;
    const closeDisabled = sessionStatus !== "in_progress" || runningAction !== null;

    React.useEffect(() => {
        let cancelled = false;

        const loadRoleDisplayName = async () => {
            if (roleNameFromQuery) {
                setRoleDisplayName(roleNameFromQuery);
                return;
            }

            if (!roleId || !accessToken) {
                setRoleDisplayName(null);
                return;
            }

            try {
                const roleDetail = await getRoleDetail(roleId, accessToken);
                if (!cancelled) {
                    setRoleDisplayName(roleDetail.role_name || null);
                }
            } catch {
                if (!cancelled) {
                    setRoleDisplayName(null);
                }
            }
        };

        void loadRoleDisplayName();

        return () => {
            cancelled = true;
        };
    }, [accessToken, roleId, roleNameFromQuery]);

    const fallbackQuestion = React.useMemo<AudioPlayerQuestion>(() => {
        const readableRoleName = roleDisplayName?.trim() || roleNameFromQuery || roleId || "el rol seleccionado";

        if (roleId) {
            return {
                id: `intro-${roleId}`,
                text: `Presentate y resume por que tu experiencia encaja con el rol ${readableRoleName}.`,
                note: "Pregunta activa derivada del rol seleccionado.",
            };
        }

        return {
            id: "intro-general",
            text: "Presentate y resume brevemente la experiencia mas relevante que aportarias en esta entrevista.",
            note: "Pregunta activa temporal mientras se define el flujo real de preguntas.",
        };
    }, [roleDisplayName, roleId, roleNameFromQuery]);

    const activeQuestion = currentQuestion || fallbackQuestion;

    React.useEffect(() => {
        if (sessionStatus !== "in_progress" || !isJoined || !roomId || sessionNumericId) {
            return;
        }

        let cancelled = false;

        const fetchSessionId = async () => {
            const headers = getAuthHeaders();
            if (!headers) return;

            try {
                const detail = await fetchSessionDetail(headers, roomId);
                if (!cancelled && detail.my_interview_session_id && Number.isFinite(detail.my_interview_session_id)) {
                    setSessionNumericId(detail.my_interview_session_id);
                }
            } catch {
                // silently ignore — redirect won't fire but session continues
            }
        };

        void fetchSessionId();

        return () => { cancelled = true; };
    }, [sessionStatus, isJoined, roomId, sessionNumericId, getAuthHeaders, fetchSessionDetail]);

    React.useEffect(() => {
        if (sessionStatus !== "closed" || !isJoined || !sessionNumericId) {
            return;
        }

        const timer = window.setTimeout(() => {
            void router.push(`/interview-report/${sessionNumericId}`);
        }, 1500);

        return () => window.clearTimeout(timer);
    }, [sessionStatus, isJoined, sessionNumericId, router]);

    return (
        <>
            <Head>
                <title>Sala de Entrevista - LaborIA</title>
                <meta
                    name="description"
                    content="Sala de entrevista colaborativa por audio en tiempo real con WebSocket y broadcast por servidor"
                />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            <div className="min-h-screen bg-linear-to-b from-slate-50 via-cyan-50 to-white">
                <InterviewRoomHeader onBack={() => router.push("/dashboard")} />

                <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    <InterviewRoomConnectionPanel
                        connectionStatus={connectionStatus}
                        isSyncingState={isSyncingState}
                        displayName={displayName}
                        onDisplayNameChange={setDisplayName}
                        roomId={roomId}
                        onRoomIdChange={setRoomId}
                        errorMessage={errorMessage}
                        isJoined={isJoined}
                        isConnecting={isConnecting}
                        isMuted={isMuted}
                        activeRemoteCount={activeRemoteCount}
                        onJoinRoom={() => void joinRoom()}
                        onLeaveRoom={() => void leaveRoom({ clearPersistedRejoin: true })}
                        onToggleMute={toggleMute}
                        onCopyRoomId={() => void copyRoomId()}
                    />

                    <InterviewRoomSessionPanel
                        sessionStatus={sessionStatus}
                        activeRoundIndex={activeRoundIndex}
                        totalRounds={totalRounds}
                        activeRoundId={activeRoundId}
                        isJoined={isJoined}
                        isHost={isHost}
                        startDisabled={startDisabled}
                        nextDisabled={nextDisabled}
                        closeDisabled={closeDisabled}
                        onHostAction={(action) => void executeHostAction(action)}
                        activeQuestion={activeQuestion}
                        accessToken={accessToken}
                        ttsStatus={ttsStatus}
                    />

                    {activeRoundId && (
                        <InterviewRoomAnswerPanel
                            activeRoundIndex={activeRoundIndex}
                            currentQuestion={currentQuestion}
                            recordingCountdown={recordingCountdown}
                            isRecording={isRecording}
                            isSubmitting={isSubmitting}
                            isEvaluating={isEvaluating}
                            submissionError={submissionError}
                            transcription={transcription}
                            evaluationResult={evaluationResult}
                        />
                    )}

                    <InterviewRoomParticipants
                        localName={localName}
                        isMuted={isMuted}
                        localLevel={localLevel}
                        selfId={selfId}
                        participants={participants}
                        roomId={roomId}
                    />
                </main>
            </div>
        </>
    );
}

export default function InterviewPage() {
    return (
        <PrivateRoute>
            <InterviewPageContent />
        </PrivateRoute>
    );
}
