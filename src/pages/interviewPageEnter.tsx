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
    applyGroupInterviewEvent,
    buildRoundEventDedupKey,
    extractGroupInterviewUiState,
    type QuestionAudioReadyPayload,
    type TtsErrorPayload,
} from "@/utils/groupInterview";
import { useTTSAudioPlayer } from "@/hooks/useTTSAudioPlayer";

const BACKEND_WS_BASE = process.env.NEXT_PUBLIC_BACKEND_WS_BASE;
const BACKEND_API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;
const CLIENT_MAGIC_A = 67; // 'C'
const CLIENT_MAGIC_B = 65; // 'A'
const MAX_QUEUE_PER_SENDER = 60;
const GROUP_INTERVIEW_REJOIN_KEY = "laboria.groupInterview.rejoin";

const MIME_CANDIDATES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
];

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
};

type GroupSessionResponse = {
    id: number;
    session_code: string;
};

type GroupSessionDetailResponse = {
    host_id: number;
    status: string;
};

type AuthMeResponse = {
    id: number;
};

type GroupInterviewAction = "start" | "next" | "close";

type RemoteParticipant = {
    socketId: string;
    displayName: string;
    connected: boolean;
    level: number;
};

type UnwrappedIncomingAudio = {
    mimeType: string | null;
    audioBuffer: ArrayBuffer | null;
};

type SenderPlayer = {
    audio: HTMLAudioElement;
    mediaSource: MediaSource;
    sourceBuffer: SourceBuffer | null;
    queue: ArrayBuffer[];
    mimeType: string;
    sourceBufferReady: boolean;
    isRemoving: boolean;
    appendErrorCount: number;
};

type PersistedRejoinState = {
    roomId: string;
    displayName: string;
    userId: string;
    roleId: string;
};

const readPersistedRejoinState = (): PersistedRejoinState | null => {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const raw = window.sessionStorage.getItem(GROUP_INTERVIEW_REJOIN_KEY);

        if (window.localStorage.getItem(GROUP_INTERVIEW_REJOIN_KEY)) {
            window.localStorage.removeItem(GROUP_INTERVIEW_REJOIN_KEY);
        }

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as Partial<PersistedRejoinState>;
        if (
            typeof parsed.roomId !== "string"
            || typeof parsed.displayName !== "string"
            || typeof parsed.userId !== "string"
        ) {
            return null;
        }

        return {
            roomId: parsed.roomId,
            displayName: parsed.displayName,
            userId: parsed.userId,
            roleId: typeof parsed.roleId === "string" ? parsed.roleId : "",
        };
    } catch {
        return null;
    }
};

const persistRejoinState = (state: PersistedRejoinState): void => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.sessionStorage.setItem(GROUP_INTERVIEW_REJOIN_KEY, JSON.stringify(state));
    } catch {
        return;
    }
};

const clearPersistedRejoinState = (): void => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.sessionStorage.removeItem(GROUP_INTERVIEW_REJOIN_KEY);
        window.localStorage.removeItem(GROUP_INTERVIEW_REJOIN_KEY);
    } catch {
        return;
    }
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

const resolveBackendHttpOrigin = (): string => {
    if (BACKEND_API_BASE) {
        return BACKEND_API_BASE.replace(/\/+$/, "");
    }

    if (!BACKEND_WS_BASE) {
        return "";
    }

    const wsAsHttp = BACKEND_WS_BASE
        .replace(/^wss:\/\//i, "https://")
        .replace(/^ws:\/\//i, "http://")
        .replace(/\/+$/, "");

    return wsAsHttp.replace(/\/api\/ws$/i, "").replace(/\/ws$/i, "");
};

const resolveBackendWsBase = (): string => {
    if (BACKEND_WS_BASE) {
        return BACKEND_WS_BASE.replace(/\/+$/, "");
    }

    if (!BACKEND_API_BASE) {
        return "";
    }

    const httpBase = BACKEND_API_BASE.replace(/\/+$/, "");
    const wsBase = httpBase
        .replace(/^https:\/\//i, "wss://")
        .replace(/^http:\/\//i, "ws://");

    return `${wsBase}/api/ws`;
};

const normalizeUserLabel = (name: string, socketId: string): string => {
    const safeName = name.trim();
    if (safeName) {
        return safeName;
    }

    return `Usuario-${socketId.slice(0, 5)}`;
};

const pickSupportedMimeType = (): string => {
    for (const candidate of MIME_CANDIDATES) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
            return candidate;
        }
    }
    return "";
};

const wrapChunkWithClientHeader = (audioBuffer: ArrayBuffer, mimeType: string): ArrayBuffer => {
    const mimeBytes = new TextEncoder().encode(mimeType || "");
    const audioBytes = new Uint8Array(audioBuffer);
    const out = new Uint8Array(3 + mimeBytes.length + audioBytes.length);
    out[0] = CLIENT_MAGIC_A;
    out[1] = CLIENT_MAGIC_B;
    out[2] = Math.min(255, mimeBytes.length);
    out.set(mimeBytes.slice(0, 255), 3);
    out.set(audioBytes, 3 + Math.min(255, mimeBytes.length));
    return out.buffer;
};

const unwrapIncomingAudioPayload = (audioData: ArrayBuffer): UnwrappedIncomingAudio => {
    const payload = new Uint8Array(audioData);
    if (payload.length >= 3 && payload[0] === CLIENT_MAGIC_A && payload[1] === CLIENT_MAGIC_B) {
        const mimeLen = payload[2];
        if (payload.length <= 3 + mimeLen) {
            return { mimeType: null, audioBuffer: null };
        }

        const mimeType = new TextDecoder().decode(payload.slice(3, 3 + mimeLen));
        const audioBytes = payload.slice(3 + mimeLen);
        const copy = new Uint8Array(audioBytes.length);
        copy.set(audioBytes);
        return { mimeType, audioBuffer: copy.buffer };
    }

    return { mimeType: null, audioBuffer: audioData.slice(0) };
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
    const [participants, setParticipants] = React.useState<RemoteParticipant[]>([]);
    const [isJoined, setIsJoined] = React.useState(false);
    const [isConnecting, setIsConnecting] = React.useState(false);
    const [isMuted, setIsMuted] = React.useState(false);
    const [localLevel, setLocalLevel] = React.useState(0);
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

    const socketRef = React.useRef<WebSocket | null>(null);
    const localStreamRef = React.useRef<MediaStream | null>(null);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const selectedMimeTypeRef = React.useRef("");
    const selfIdRef = React.useRef("");
    const lastRecorderRestartAtRef = React.useRef(0);
    const resyncTimersRef = React.useRef<number[]>([]);
    const localMonitorCleanupRef = React.useRef<(() => void) | null>(null);

    const senderPlayersRef = React.useRef<Map<string, SenderPlayer>>(new Map());
    const remoteLevelResetTimeoutsRef = React.useRef<Map<string, number>>(new Map());
    const backendHttpOriginRef = React.useRef(resolveBackendHttpOrigin());
    const backendWsBaseRef = React.useRef(resolveBackendWsBase());
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

    const getCurrentUserId = React.useCallback(async (headers: HeadersInit): Promise<number> => {
        const backendHttpOrigin = backendHttpOriginRef.current;
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
    }, []);

    const fetchSessionDetail = React.useCallback(async (headers: HeadersInit, sessionCode: string): Promise<GroupSessionDetailResponse> => {
        const backendHttpOrigin = backendHttpOriginRef.current;
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
    }, []);

    const mapActionErrorMessage = React.useCallback((action: GroupInterviewAction, httpStatus: number) => {
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
                setErrorMessage(mapActionErrorMessage(action, response.status));
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
    }, [getAuthHeaders, mapActionErrorMessage, roomId]);

    const ensureSessionCode = React.useCallback(
        async (headers: HeadersInit, desiredCode: string, roleId: string): Promise<string> => {
            const backendHttpOrigin = backendHttpOriginRef.current;
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
        },
        [],
    );

    const updateParticipant = React.useCallback((socketId: string, updater: (current?: RemoteParticipant) => RemoteParticipant) => {
        setParticipants((current) => {
            const index = current.findIndex((participant) => participant.socketId === socketId);
            if (index === -1) {
                return [...current, updater(undefined)];
            }

            const next = [...current];
            next[index] = updater(current[index]);
            return next;
        });
    }, []);

    const removeParticipant = React.useCallback((socketId: string) => {
        setParticipants((current) => current.filter((participant) => participant.socketId !== socketId));

        const timeoutId = remoteLevelResetTimeoutsRef.current.get(socketId);
        if (timeoutId) {
            window.clearTimeout(timeoutId);
            remoteLevelResetTimeoutsRef.current.delete(socketId);
        }
    }, []);

    const markRemoteActivity = React.useCallback((socketId: string) => {
        updateParticipant(socketId, (current) => ({
            socketId,
            displayName: current?.displayName || normalizeUserLabel("", socketId),
            connected: true,
            level: 0.6,
        }));

        const previousTimeout = remoteLevelResetTimeoutsRef.current.get(socketId);
        if (previousTimeout) {
            window.clearTimeout(previousTimeout);
        }

        const timeoutId = window.setTimeout(() => {
            updateParticipant(socketId, (current) => ({
                socketId,
                displayName: current?.displayName || normalizeUserLabel("", socketId),
                connected: current?.connected ?? true,
                level: 0,
            }));
            remoteLevelResetTimeoutsRef.current.delete(socketId);
        }, 350);

        remoteLevelResetTimeoutsRef.current.set(socketId, timeoutId);
    }, [updateParticipant]);

    const startAudioLevelMonitor = React.useCallback((stream: MediaStream, onLevel: (level: number) => void): (() => void) => {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let rafId = 0;

        const measure = () => {
            analyser.getByteTimeDomainData(dataArray);
            let sumSquares = 0;

            for (let i = 0; i < dataArray.length; i += 1) {
                const normalized = (dataArray[i] - 128) / 128;
                sumSquares += normalized * normalized;
            }

            const rms = Math.sqrt(sumSquares / dataArray.length);
            onLevel(Number.isFinite(rms) ? rms : 0);
            rafId = window.requestAnimationFrame(measure);
        };

        measure();

        return () => {
            window.cancelAnimationFrame(rafId);
            source.disconnect();
            analyser.disconnect();
            void audioContext.close();
        };
    }, []);

    const cleanupSenderPlayer = React.useCallback((senderId: string) => {
        const player = senderPlayersRef.current.get(senderId);
        if (!player) {
            return;
        }

        try {
            if (player.mediaSource.readyState === "open") {
                player.mediaSource.endOfStream();
            }
        } catch {
            return;
        }

        player.queue = [];
        player.sourceBufferReady = false;
        player.sourceBuffer = null;
        player.audio.pause();
        player.audio.src = "";

        if (player.audio.parentNode) {
            player.audio.parentNode.removeChild(player.audio);
        }

        senderPlayersRef.current.delete(senderId);
    }, []);

    const cleanupAllSenderPlayers = React.useCallback(() => {
        senderPlayersRef.current.forEach((_, senderId) => {
            cleanupSenderPlayer(senderId);
        });
        senderPlayersRef.current.clear();
    }, [cleanupSenderPlayer]);

    const flushSenderQueue = React.useCallback((senderId: string) => {
        const player = senderPlayersRef.current.get(senderId);
        if (!player || !player.sourceBuffer || !player.sourceBufferReady || player.sourceBuffer.updating || player.isRemoving) {
            return;
        }

        if (!player.queue.length) {
            return;
        }

        const chunk = player.queue.shift();
        if (!chunk) {
            return;
        }

        try {
            player.sourceBuffer.appendBuffer(chunk);
            player.appendErrorCount = 0;
            void player.audio.play().catch(() => {
                return;
            });
        } catch {
            player.appendErrorCount += 1;
            player.queue.unshift(chunk);

            if (player.appendErrorCount >= 3) {
                cleanupSenderPlayer(senderId);
                return;
            }

            window.setTimeout(() => {
                flushSenderQueue(senderId);
            }, 150);
        }
    }, [cleanupSenderPlayer]);

    const createSenderPlayer = React.useCallback((senderId: string, mimeType: string): SenderPlayer | null => {
        if (senderPlayersRef.current.has(senderId)) {
            const existing = senderPlayersRef.current.get(senderId) || null;
            if (existing && existing.mimeType !== mimeType) {
                cleanupSenderPlayer(senderId);
            } else {
                return existing;
            }
        }

        const audio = new Audio();
        audio.autoplay = true;
        audio.setAttribute("playsinline", "true");
        audio.style.display = "none";
        document.body.appendChild(audio);

        const mediaSource = new MediaSource();
        audio.src = URL.createObjectURL(mediaSource);

        const player: SenderPlayer = {
            audio,
            mediaSource,
            sourceBuffer: null,
            queue: [],
            mimeType,
            sourceBufferReady: false,
            isRemoving: false,
            appendErrorCount: 0,
        };

        mediaSource.addEventListener("sourceopen", () => {
            if (!MediaSource.isTypeSupported(mimeType)) {
                cleanupSenderPlayer(senderId);
                return;
            }

            try {
                const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
                player.sourceBuffer = sourceBuffer;
                try {
                    sourceBuffer.mode = "sequence";
                } catch {
                    // Algunos navegadores no permiten cambiar el mode; continuamos con el default.
                }

                const readinessTimer = window.setTimeout(() => {
                    player.sourceBufferReady = true;
                    flushSenderQueue(senderId);
                }, 200);

                sourceBuffer.addEventListener("updateend", () => {
                    window.clearTimeout(readinessTimer);
                    if (!player.sourceBufferReady) {
                        player.sourceBufferReady = true;
                    }
                    player.isRemoving = false;
                    flushSenderQueue(senderId);
                });

                sourceBuffer.addEventListener("error", () => {
                    cleanupSenderPlayer(senderId);
                });

                void audio.play().catch(() => {
                    return;
                });
            } catch {
                cleanupSenderPlayer(senderId);
            }
        });

        mediaSource.addEventListener("sourceclose", () => {
            player.sourceBufferReady = false;
        });

        senderPlayersRef.current.set(senderId, player);
        return player;
    }, [cleanupSenderPlayer, flushSenderQueue]);

    const appendChunkForSender = React.useCallback((senderId: string, mimeType: string, audioChunk: ArrayBuffer) => {
        const player = createSenderPlayer(senderId, mimeType);
        if (!player) {
            return;
        }

        player.queue.push(audioChunk);
        if (player.queue.length > MAX_QUEUE_PER_SENDER) {
            player.queue.shift();
        }

        flushSenderQueue(senderId);
    }, [createSenderPlayer, flushSenderQueue]);

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

    const leaveRoom = React.useCallback(async (options?: LeaveRoomOptions) => {
        const notifyServer = options?.notifyServer ?? true;
        const clearPersistedRejoin = options?.clearPersistedRejoin ?? false;
        const currentSelfId = selfIdRef.current;

        setConnectionStatus("disconnected");
        setIsJoined(false);
        setSelfId("");
        setParticipants([]);
        setLocalLevel(0);
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

        remoteLevelResetTimeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId);
        });
        remoteLevelResetTimeoutsRef.current.clear();

        cleanupAllSenderPlayers();
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
    }, [cleanupAllSenderPlayers, cleanupTTSAudio, sendJson, stopRecorder]);

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

            const syncRoomState = async () => {
                const backendHttpOrigin = backendHttpOriginRef.current;
                if (!backendHttpOrigin) {
                    return;
                }

                setIsSyncingState(true);
                try {
                    const stateResponse = await fetch(
                        `${backendHttpOrigin}/api/group-sessions/${encodeURIComponent(resolvedSessionCode)}/state`,
                        {
                            method: "GET",
                            headers,
                        },
                    );

                    if (!stateResponse.ok) {
                        return;
                    }

                    const snapshot = await stateResponse.json();
                    const restored = extractGroupInterviewUiState(snapshot);

                    activeRoundIdRef.current = restored.roundId;
                    activeRoundIndexRef.current = restored.roundIndex;
                    sessionStatusRef.current = restored.status;
                    totalRoundsRef.current = restored.totalRounds;

                    setSessionStatus(restored.status);
                    setActiveRoundId(restored.roundId);
                    setActiveRoundIndex(restored.roundIndex);
                    setTotalRounds(restored.totalRounds);

                    if (restored.question) {
                        const skill = restored.question.targetSkill ?? "General";
                        const difficulty = restored.question.difficulty ?? "N/A";

                        const restoredQuestion: AudioPlayerQuestion = {
                            id: restored.question.roundId || `round-${restored.question.roundIndex ?? "active"}`,
                            text: restored.question.text,
                            note: `Skill objetivo: ${skill} | Dificultad: ${difficulty}`,
                        };
                        currentQuestionRef.current = restoredQuestion;
                        setCurrentQuestion(restoredQuestion);
                    }
                } catch {
                    return;
                } finally {
                    setIsSyncingState(false);
                }
            };

            socket.onopen = () => {
                setConnectionStatus("connected");
                setIsJoined(true);
                void syncRoomState();

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

                // El peer nuevo pide resincronización para que todos los existentes
                // reinicien su MediaRecorder y reenvíen segmentos iniciales decodificables.
                requestResync("join-initial");
                const t1 = window.setTimeout(() => requestResync("join-retry-1"), 450);
                const t2 = window.setTimeout(() => requestResync("join-retry-2"), 1200);
                resyncTimersRef.current.push(t1, t2);
            };

            socket.onclose = (closeEvent) => {
                setConnectionStatus("disconnected");
                if (!isJoined) {
                    const reason = closeEvent.reason || "";

                    if (reason === "session_already_started") {
                        clearPersistedRejoinState();
                        setErrorMessage(
                            "Esta sesión ya ha finalizado o fue cerrada. Crea una nueva sesión para continuar."
                        );
                    } else if (reason === "group_session_not_found") {
                        clearPersistedRejoinState();
                        setErrorMessage(
                            "El Session Code no existe o ya no está disponible. Verifica el código e intenta de nuevo."
                        );
                    } else if (reason === "user_not_found") {
                        setErrorMessage(
                            "Tu usuario no fue encontrado. Vuelve a iniciar sesión."
                        );
                    } else {
                        const detail = reason
                            ? ` (${reason})`
                            : closeEvent.code !== 1000 ? ` (código ${closeEvent.code})` : "";
                        setErrorMessage(
                            `No se pudo conectar a la sala${detail}. Verifica que el backend esté corriendo y que el Session Code sea válido.`
                        );
                    }
                }
            };

            socket.onerror = () => {
                console.warn("[ws] Error de conexión WebSocket");
            };

            socket.onmessage = (event: MessageEvent) => {
                if (event.data instanceof ArrayBuffer) {
                    const buffer = new Uint8Array(event.data);
                    if (buffer.length < 2) {
                        return;
                    }

                    const userIdLength = buffer[0];
                    if (userIdLength === 0 || buffer.length <= 1 + userIdLength) {
                        return;
                    }

                    const userIdBytes = buffer.slice(1, 1 + userIdLength);
                    const senderId = new TextDecoder().decode(userIdBytes);
                    if (!senderId || senderId === sessionUserId) {
                        return;
                    }

                    const payloadBytes = buffer.slice(1 + userIdLength);
                    const payloadBuffer = new Uint8Array(payloadBytes.length);
                    payloadBuffer.set(payloadBytes);
                    const decoded = unwrapIncomingAudioPayload(payloadBuffer.buffer);
                    if (!decoded.audioBuffer) {
                        return;
                    }

                    const mimeType = decoded.mimeType || selectedMimeTypeRef.current || "audio/webm;codecs=opus";

                    updateParticipant(senderId, (current) => ({
                        socketId: senderId,
                        displayName: current?.displayName || normalizeUserLabel("", senderId),
                        connected: true,
                        level: current?.level || 0,
                    }));

                    appendChunkForSender(senderId, mimeType, decoded.audioBuffer);
                    markRemoteActivity(senderId);
                    return;
                }

                if (typeof event.data !== "string") {
                    return;
                }

                let payload: SignalingMessage | null = null;
                try {
                    payload = JSON.parse(event.data) as SignalingMessage;
                } catch {
                    return;
                }

                if (!payload?.event) {
                    return;
                }

                // Validación fuerte de ronda vieja para question_generated / question_new:
                // si el evento trae un round_index menor al activo, es un evento tardío y se descarta.
                if (payload.event === "question_generated" || payload.event === "question_new") {
                    const eventRoundId = payload.round_id;
                    const eventRoundIndex = payload.round_index !== undefined
                        ? Number(payload.round_index)
                        : null;
                    const currentIndex = activeRoundIndexRef.current;

                    if (eventRoundId && activeRoundIdRef.current && eventRoundId !== activeRoundIdRef.current) {
                        return;
                    }
                    if (
                        eventRoundIndex !== null
                        && !Number.isNaN(eventRoundIndex)
                        && currentIndex !== null
                        && eventRoundIndex < currentIndex
                    ) {
                        return;
                    }
                }

                const nextState = applyGroupInterviewEvent(
                    {
                        status: sessionStatusRef.current,
                        roundId: activeRoundIdRef.current,
                        roundIndex: activeRoundIndexRef.current,
                        totalRounds: totalRoundsRef.current,
                        question: currentQuestionRef.current
                            ? {
                                roundId: activeRoundIdRef.current,
                                roundIndex: activeRoundIndexRef.current,
                                text: currentQuestionRef.current.text,
                                targetSkill: null,
                                difficulty: null,
                            }
                            : null,
                    },
                    payload,
                    shouldProcessRoundEvent,
                );

                const stateChanged =
                    nextState.status !== sessionStatusRef.current
                    || nextState.roundId !== activeRoundIdRef.current
                    || nextState.roundIndex !== activeRoundIndexRef.current
                    || nextState.totalRounds !== totalRoundsRef.current
                    || nextState.question;

                if (stateChanged) {
                    // Actualizar refs INMEDIATAMENTE en el mismo tick de JS.
                    if (nextState.roundId !== activeRoundIdRef.current) {
                        activeRoundIdRef.current = nextState.roundId;
                    }
                    if (nextState.roundIndex !== activeRoundIndexRef.current) {
                        activeRoundIndexRef.current = nextState.roundIndex;
                    }
                    if (nextState.status !== sessionStatusRef.current) {
                        sessionStatusRef.current = nextState.status;
                    }
                    if (nextState.totalRounds !== totalRoundsRef.current) {
                        totalRoundsRef.current = nextState.totalRounds;
                    }

                    setSessionStatus(nextState.status);
                    setActiveRoundId(nextState.roundId);
                    setActiveRoundIndex(nextState.roundIndex);
                    setTotalRounds(nextState.totalRounds);

                    if (nextState.question) {
                        const nextQuestion: AudioPlayerQuestion = {
                            id: nextState.question.roundId || `round-${nextState.question.roundIndex ?? "active"}`,
                            text: nextState.question.text,
                            note: `Skill objetivo: ${nextState.question.targetSkill ?? "General"} | Dificultad: ${nextState.question.difficulty ?? "N/A"}`,
                        };
                        currentQuestionRef.current = nextQuestion;
                        setCurrentQuestion(nextQuestion);
                    }
                }

                if (
                    payload.event === "interview_started"
                    || payload.event === "interview_closed"
                    || payload.event === "round_started"
                    || payload.event === "question_generated"
                    || payload.event === "question_new"
                ) {
                    if (payload.event === "interview_closed") {
                        clearPersistedRejoinState();
                    }
                    if (payload.event === "round_started") {
                        if (payload.round_id) {
                            activeRoundIdRef.current = payload.round_id;
                        }
                        handleTTSRoundStarted(payload.round_id ?? null);
                    }
                    return;
                }

                // Eventos de audio TTS automático.
                // La ref ya fue actualizada síncronamente cuando llegó question_generated
                // o round_started, por lo que no hay ventana de carrera.
                if (payload.event === "question_audio_ready") {
                    const eventRoundId = (payload as QuestionAudioReadyPayload).round_id;
                    if (eventRoundId && eventRoundId === activeRoundIdRef.current) {
                        handleQuestionAudioReady(payload as QuestionAudioReadyPayload);
                    }
                    return;
                }

                if (payload.event === "tts_error") {
                    const eventRoundId = (payload as TtsErrorPayload).round_id;
                    if (eventRoundId && eventRoundId === activeRoundIdRef.current) {
                        handleTtsError(payload as TtsErrorPayload);
                    }
                    return;
                }

                const senderId = payload.from || payload.user_id || "";
                if (!senderId || senderId === sessionUserId) {
                    return;
                }

                if (payload.event === "join" || payload.event === "user_joined") {
                    updateParticipant(senderId, (current) => ({
                        socketId: senderId,
                        displayName: payload?.displayName?.trim()
                            ? payload.displayName.trim()
                            : current?.displayName || normalizeUserLabel("", senderId),
                        connected: true,
                        level: current?.level || 0,
                    }));

                    // Reenviar segmentos iniciales para que el peer nuevo pueda decodificar nuestro stream.
                    restartRecorderForNewPeer(true);
                    return;
                }

                if (payload.event === "request_resync") {
                    restartRecorderForNewPeer(true);
                    return;
                }

                if (payload.event === "leave" || payload.event === "user_left") {
                    cleanupSenderPlayer(senderId);
                    removeParticipant(senderId);
                }
            };
        } catch (error) {
            const fallback = "No fue posible conectarte a la sala. Revisa permisos de microfono y vuelve a intentar.";
            const msg = error instanceof Error && error.message ? error.message : fallback;
            setErrorMessage(msg);
            await leaveRoom({ notifyServer: false });
        } finally {
            setIsConnecting(false);
        }
    }, [appendChunkForSender, cleanupSenderPlayer, ensureSessionCode, fetchSessionDetail, getAuthHeaders, getCurrentUserId, handleQuestionAudioReady, handleTtsError, handleTTSRoundStarted, leaveRoom, markRemoteActivity, removeParticipant, requestResync, restartRecorderForNewPeer, roleId, roomId, sendJson, shouldProcessRoundEvent, startAudioLevelMonitor, startRecorder, unlockPlayback, updateParticipant, displayName]);

    React.useEffect(() => {
        const persisted = readPersistedRejoinState();
        if (!persisted) {
            return;
        }

        if (!displayName.trim()) {
            setDisplayName(persisted.displayName);
        }

        if (!roomId.trim()) {
            setRoomId(persisted.roomId);
        }
    }, [displayName, roomId]);

    React.useEffect(() => {
        if (!router.isReady || isJoined || isConnecting || autoRejoinAttemptedRef.current) {
            return;
        }

        const persisted = readPersistedRejoinState();
        if (!persisted) {
            return;
        }

        if (persisted.roleId && roleId && persisted.roleId !== roleId) {
            return;
        }

        if (!displayName.trim() || !roomId.trim()) {
            return;
        }

        autoRejoinAttemptedRef.current = true;
        void joinRoom({
            roomIdOverride: persisted.roomId,
            displayNameOverride: persisted.displayName,
            allowRejoinDuringInProgress: true,
        });
    }, [displayName, isConnecting, isJoined, joinRoom, roleId, roomId, router.isReady]);

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
                                    Ronda: {activeRoundIndex ?? "--"}
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
