import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
    AudioLines,
    Copy,
    Mic,
    MicOff,
    LogOut,
    Plug,
    Radio,
    Users,
    UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioPlayer, type AudioPlayerQuestion } from "@/components/AudioPlayer";
import { NoiseBackground } from "@/components/ui/noise-background";
import PrivateRoute from "@/components/PrivateRoute";
import { getAccessToken } from "@/utils/session";
import { getRoleDetail } from "@/services/matchingService";
import {
    ensureSessionCodeFromApi,
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

const BACKEND_WS_BASE = process.env.NEXT_PUBLIC_BACKEND_WS_BASE;
const BACKEND_API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

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
    /** ID del participante al que fue asignada la ronda actual (null en intro o sin asignar). */
    const [assignedUserId, setAssignedUserId] = React.useState<string | null>(null);

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
    /** Ref que siempre refleja el assignedUserId más reciente para acceso estable en closures. */
    const assignedUserIdRef = React.useRef<string | null>(null);

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
        startAnswerRecording,
        stopAndSubmitAnswer,
    } = useGroupInterviewAnswerFlow({
        localStreamRef,
        activeRoundIdRef,
        currentQuestionRef,
        backendHttpOriginRef,
        roomId,
        activeRoundId,
        ttsStatus,
        selfId: selfId ? String(selfId) : "",
        assignedUserId,
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

        let endpoint = `${backendHttpOrigin}/api/group-sessions/${encodeURIComponent(sessionCode)}/start`;
        let body: string | undefined;

        if (action === "next") {
            endpoint = `${backendHttpOrigin}/api/group-sessions/${encodeURIComponent(sessionCode)}/rounds/next`;
            body = JSON.stringify({});
        }

        if (action === "close") {
            endpoint = `${backendHttpOrigin}/api/group-sessions/${encodeURIComponent(sessionCode)}/close`;
        }

        setRunningAction(action);
        setErrorMessage(null);

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers,
                body,
            });

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
        assignedUserIdRef,
        setAssignedUserId,
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
        assignedUserIdRef,
        setIsSyncingState,
        setSessionStatus,
        setActiveRoundId,
        setActiveRoundIndex,
        setTotalRounds,
        setCurrentQuestion,
        setAssignedUserId,
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
        assignedUserIdRef.current = null;
        setAssignedUserId(null);
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

    const introQuestion = React.useMemo<AudioPlayerQuestion>(() => {
        const readableRoleName = roleDisplayName?.trim() || roleNameFromQuery || roleId || "el rol seleccionado";

        return {
            id: roleId ? `intro-${roleId}` : "intro-general",
            text: `Vamos a realizar una entrevista enfocada en el rol ${readableRoleName}. Hablaremos sobre tu experiencia, los retos mas comunes del rol y como abordarias situaciones reales.`,
            note: "Introduccion inicial antes de la primera pregunta.",
            isIntro: true,
        };
    }, [roleDisplayName, roleId, roleNameFromQuery]);

    const fallbackQuestion = React.useMemo<AudioPlayerQuestion>(() => {
        return {
            id: "idle-intro",
            text: "Cuando la entrevista inicie, veras una introduccion breve y luego las preguntas de la ronda.",
            note: "Sala lista para iniciar la entrevista.",
            isIntro: false,
        };
    }, []);

    const activeQuestion = currentQuestion
        || (sessionStatus === "in_progress" ? introQuestion : fallbackQuestion);
    const isIntroRound = Boolean(activeQuestion?.isIntro);

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
                <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
                    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600">
                                <Radio className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-xl font-semibold text-slate-900">LaborIA Entrevistas</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")} className="gap-2">
                            <LogOut className="h-4 w-4" />
                            Volver al dashboard
                        </Button>
                    </div>
                </header>

                <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    <section className="mb-6 rounded-2xl border border-cyan-100 bg-linear-to-r from-cyan-700 to-blue-700 p-6 text-white shadow-sm">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold">Sala de entrevista por audio</h1>
                                <p className="mt-2 text-sm text-cyan-50">
                                    Todos los participantes publican su audio al servidor y se distribuye por broadcast a los demas usuarios de la sala.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
                                <Plug className="h-3.5 w-3.5" />
                                {connectionStatus === "connected" && isSyncingState && "Re-sincronizando sala..."}
                                {connectionStatus === "connected" && !isSyncingState && "Conectado"}
                                {connectionStatus === "connecting" && "Conectando..."}
                                {connectionStatus === "disconnected" && "Desconectado"}
                            </div>
                        </div>
                    </section>

                    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                            <div className="space-y-4 xl:col-span-8">
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    <div>
                                        <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-slate-700">
                                            Tu nombre
                                        </label>
                                        <input
                                            id="displayName"
                                            type="text"
                                            value={displayName}
                                            onChange={(event) => setDisplayName(event.target.value)}
                                            placeholder="Ej: Camila Rojas"
                                            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="roomId" className="mb-1.5 block text-sm font-medium text-slate-700">
                                            Session Code
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                id="roomId"
                                                type="text"
                                                value={roomId}
                                                onChange={(event) => setRoomId(event.target.value)}
                                                placeholder="Ej: ABCD1234 (vacío para crear uno nuevo)"
                                                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                                            />
                                            <Button type="button" variant="outline" onClick={() => void copyRoomId()} className="gap-1.5">
                                                <Copy className="h-4 w-4" />
                                                Copiar
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {errorMessage && (
                                    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                        {errorMessage}
                                    </p>
                                )}
                            </div>

                            <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4 xl:col-span-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Panel rápido</p>
                                <div className="mt-3 space-y-2">
                                    {!isJoined ? (
                                        <Button
                                            type="button"
                                            className="h-10 w-full gap-2 bg-cyan-600 hover:bg-cyan-700"
                                            onClick={() => void joinRoom()}
                                            disabled={isConnecting}
                                        >
                                            <AudioLines className="h-4 w-4" />
                                            {isConnecting ? "Conectando..." : "Unirme a la sala"}
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            className="h-10 w-full gap-2"
                                            onClick={() => void leaveRoom({ clearPersistedRejoin: true })}
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Salir de la sala
                                        </Button>
                                    )}

                                    <Button type="button" variant="outline" onClick={toggleMute} disabled={!isJoined} className="h-10 w-full gap-2">
                                        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                        {isMuted ? "Activar microfono" : "Silenciar microfono"}
                                    </Button>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-medium text-cyan-700">
                                        <Users className="mr-1 inline h-3.5 w-3.5" />
                                        Participantes: {activeRemoteCount}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
                        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado de sesión</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                                    Estado: {sessionStatus}
                                </span>
                                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
                                    {isIntroRound ? "Introduccion" : `Ronda: ${activeRoundIndex ?? "--"}`}
                                </span>
                                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                                    Total: {totalRounds}
                                </span>
                                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                                    ID: {activeRoundId || "--"}
                                </span>
                            </div>

                            {isJoined && isHost ? (
                                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs font-medium text-slate-600">Controles host</p>
                                    <NoiseBackground
                                        containerClassName="w-full rounded-xl"
                                        gradientColors={[
                                            "rgb(14, 116, 244)",
                                            "rgb(37, 99, 235)",
                                            "rgb(6, 182, 212)",
                                        ]}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => void executeHostAction("start")}
                                            disabled={startDisabled}
                                            className="h-10 w-full cursor-pointer rounded-xl bg-linear-to-r from-blue-50 via-cyan-50 to-white px-4 py-2 text-sm font-semibold text-blue-900 shadow-[0px_2px_0px_0px_var(--color-slate-50)_inset,0px_0.5px_1px_0px_var(--color-blue-300)] transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Iniciar entrevista
                                        </button>
                                    </NoiseBackground>

                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        <NoiseBackground
                                            containerClassName="w-full rounded-xl"
                                            gradientColors={[
                                                "rgb(14, 116, 244)",
                                                "rgb(37, 99, 235)",
                                                "rgb(6, 182, 212)",
                                            ]}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => void executeHostAction("next")}
                                                disabled={nextDisabled}
                                                className="h-9 w-full cursor-pointer rounded-xl bg-linear-to-r from-blue-50 via-cyan-50 to-white px-3 py-2 text-sm font-semibold text-blue-900 shadow-[0px_2px_0px_0px_var(--color-slate-50)_inset,0px_0.5px_1px_0px_var(--color-blue-300)] transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Siguiente ronda
                                            </button>
                                        </NoiseBackground>

                                        <NoiseBackground
                                            containerClassName="w-full rounded-xl"
                                            gradientColors={[
                                                "rgb(239, 68, 68)",
                                                "rgb(248, 113, 113)",
                                                "rgb(252, 165, 165)",
                                            ]}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => void executeHostAction("close")}
                                                disabled={closeDisabled}
                                                className="h-9 w-full cursor-pointer rounded-xl bg-linear-to-r from-red-50 via-red-50 to-rose-50 px-3 py-2 text-sm font-semibold text-red-900 shadow-[0px_2px_0px_0px_var(--color-red-50)_inset,0px_0.5px_1px_0px_var(--color-red-300)] transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Finalizar entrevista
                                            </button>
                                        </NoiseBackground>
                                    </div>
                                </div>
                            ) : (
                                <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                    Los controles de ronda están disponibles solo para el host conectado.
                                </p>
                            )}
                        </aside>

                        <div className="xl:col-span-8">
                            <AudioPlayer question={activeQuestion} authToken={accessToken} ttsStatus={ttsStatus} />
                        </div>
                    </section>

                    {activeRoundId && !isIntroRound && (
                        <section className="grid grid-cols-1 gap-4">
                            {/* Banner: participante asignado */}
                            {assignedUserId ? (
                                selfId && String(selfId) === String(assignedUserId) ? (
                                    <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 shadow-sm">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-lg">🎤</span>
                                        <div>
                                            <p className="text-sm font-bold text-emerald-800">¡Es tu turno!</p>
                                            <p className="text-xs text-emerald-700">Esta pregunta es para ti. Prepárate para responder cuando el audio termine.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-300 text-slate-700 text-lg">👁</span>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700">Escucha activa</p>
                                            <p className="text-xs text-slate-500">Esta pregunta está dirigida a otro participante. Escucha y aprende de su respuesta.</p>
                                        </div>
                                    </div>
                                )
                            ) : null}

                            {/* Sección de respuesta: solo para el participante asignado */}
                            {selfId && assignedUserId && String(selfId) === String(assignedUserId) && (
                                <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                                    <div className="mb-3 flex items-center gap-2 text-rose-800">
                                        <AudioLines className="h-4 w-4" />
                                        <h2 className="text-sm font-semibold uppercase tracking-wide">
                                            {`Ronda ${(activeRoundIndex ?? 0) + 1} — Tu respuesta`}
                                        </h2>
                                    </div>
                                    {currentQuestion && (
                                        <p className="mb-4 text-sm text-rose-700">{currentQuestion.text}</p>
                                    )}
                                    {recordingCountdown !== null && !isRecording && (
                                        <p className="mb-2 text-sm font-medium text-rose-600">
                                            Grabación automática en {recordingCountdown}s…
                                        </p>
                                    )}
                                    {isRecording && (
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                                            <p className="text-sm font-medium text-rose-700">Grabando tu respuesta…</p>
                                        </div>
                                    )}
                                    {!isRecording && !isSubmitting && !transcription && (
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                type="button"
                                                onClick={startAnswerRecording}
                                                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
                                                disabled={isSubmitting || isEvaluating}
                                            >
                                                <Mic className="inline h-4 w-4 mr-1" /> Grabar respuesta
                                            </button>
                                        </div>
                                    )}
                                    {isRecording && (
                                        <button
                                            type="button"
                                            onClick={stopAndSubmitAnswer}
                                            className="mt-2 rounded-lg bg-rose-800 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-900 transition"
                                        >
                                            <MicOff className="inline h-4 w-4 mr-1" /> Detener y enviar
                                        </button>
                                    )}
                                    {isSubmitting && (
                                        <p className="mt-3 text-sm text-rose-600">Enviando audio…</p>
                                    )}
                                    {isEvaluating && !isSubmitting && (
                                        <p className="mt-3 text-sm text-rose-600">Evaluando respuesta…</p>
                                    )}
                                    {submissionError && (
                                        <p className="mt-3 text-sm font-medium text-red-600">Error: {submissionError}</p>
                                    )}
                                    {transcription && (
                                        <div className="mt-3 rounded-xl border border-rose-200 bg-white p-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Tu respuesta</p>
                                            <p className="mt-0.5 text-sm text-rose-800 italic">"{transcription}"</p>
                                        </div>
                                    )}
                                    {evaluationResult && (
                                        <div className="mt-2 rounded-xl border border-rose-300 bg-white p-3 space-y-2">
                                            <p className="text-sm font-semibold text-rose-800">
                                                Puntuación: {evaluationResult.score ?? "—"}
                                            </p>
                                            {evaluationResult.feedback && (
                                                <p className="text-sm text-rose-700">{evaluationResult.feedback}</p>
                                            )}
                                        </div>
                                    )}
                                </article>
                            )}
                        </section>
                    )}

                    {activeRoundId && isIntroRound && (
                        <section className="grid grid-cols-1 gap-4">
                            <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                                <div className="mb-3 flex items-center gap-2 text-rose-800">
                                    <AudioLines className="h-4 w-4" />
                                    <h2 className="text-sm font-semibold uppercase tracking-wide">Introduccion a la entrevista</h2>
                                </div>
                                {currentQuestion && (
                                    <p className="mb-4 text-sm text-rose-700">{currentQuestion.text}</p>
                                )}
                            </article>
                        </section>
                    )}

                    <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                        <article className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 xl:col-span-1">
                            <div className="mb-3 flex items-center gap-2 text-cyan-800">
                                <UserRound className="h-4 w-4" />
                                <h2 className="text-sm font-semibold uppercase tracking-wide">Tu canal</h2>
                            </div>
                            <p className="text-base font-semibold text-cyan-900">{localName}</p>
                            <p className="mt-2 text-sm text-cyan-700">
                                {isMuted ? "Microfono silenciado" : "Microfono activo"}
                            </p>
                            <progress
                                className="mt-4 h-2 w-full overflow-hidden rounded-full appearance-none [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-cyan-100 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-cyan-600 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-cyan-600"
                                max={100}
                                value={Math.min(100, Math.round(localLevel * 500))}
                                aria-label="Nivel de audio local"
                            />
                            <p className="mt-2 text-xs text-cyan-700">Nivel de audio local</p>
                            <p className="mt-2 text-xs text-cyan-600">User ID: {selfId || "--"}</p>
                        </article>

                        <div className="xl:col-span-2">
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                                    Audio remoto en sala
                                </h2>
                                <span className="text-xs text-slate-500">Room: {roomId || "--"}</span>
                            </div>

                            {participants.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                                    No hay participantes remotos aun. Comparte el Session Code y espera a que ingresen.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {participants.map((participant) => {
                                        const levelWidth = Math.min(100, Math.round(participant.level * 500));
                                        const isSpeaking = levelWidth > 8;

                                        return (
                                            <article
                                                key={participant.socketId}
                                                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">{participant.displayName}</p>
                                                        <p className="text-xs text-slate-500">{participant.socketId}</p>
                                                    </div>
                                                    <span
                                                        className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                                                            participant.connected
                                                                ? "bg-emerald-100 text-emerald-700"
                                                                : "bg-slate-100 text-slate-500"
                                                        }`}
                                                    >
                                                        {participant.connected ? "Activo" : "Conectando"}
                                                    </span>
                                                </div>

                                                <progress
                                                    className={`mt-4 h-2 w-full overflow-hidden rounded-full appearance-none [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full ${
                                                        isSpeaking
                                                            ? "[&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500"
                                                            : "[&::-webkit-progress-value]:bg-cyan-500 [&::-moz-progress-bar]:bg-cyan-500"
                                                    }`}
                                                    max={100}
                                                    value={levelWidth}
                                                    aria-label={`Nivel de audio de ${participant.displayName}`}
                                                />
                                                <p className="mt-2 text-xs text-slate-500">
                                                    {isSpeaking ? "Transmitiendo audio ahora" : "Audio estable"}
                                                </p>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>
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
