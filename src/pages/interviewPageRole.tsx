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
    Square,
    Users,
    UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioPlayer, type AudioPlayerQuestion } from "@/components/AudioPlayer";
import PrivateRoute from "@/components/PrivateRoute";
import { getAccessToken } from "@/utils/session";

const BACKEND_WS_BASE = process.env.NEXT_PUBLIC_BACKEND_WS_BASE;
const BACKEND_API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;
const CLIENT_MAGIC_A = 67; // 'C'
const CLIENT_MAGIC_B = 65; // 'A'
const MAX_QUEUE_PER_SENDER = 60;

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
    round_index?: number;
    question_text?: string;
    target_skill?: string;
    evaluation_id?: string;
};

type ActiveRound = {
    roundId: string;
    roundIndex: number;
    questionText: string;
    targetSkill: string | null;
};

type EvaluationResult = {
    evaluation_id: string;
    status: string;
    score: number | null;
    feedback: string | null;
    score_breakdown: {
        correctness: number;
        completeness: number;
        clarity: number;
        examples: number;
    } | null;
};

type GroupSessionResponse = {
    id: number;
    session_code: string;
};

type AuthMeResponse = {
    id: number;
};

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

function writeString(view: DataView, offset: number, value: string) {
    for (let i = 0; i < value.length; i++) {
        view.setUint8(offset + i, value.charCodeAt(i));
    }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const dataSize = buffer.length * numChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuffer);

    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += 2;
        }
    }
    return arrayBuffer;
}

async function convertBlobToWav(blob: Blob): Promise<Blob> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();
    return new Blob([audioBufferToWav(audioBuffer)], { type: "audio/wav" });
}

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

    const [displayName, setDisplayName] = React.useState("");
    const [roomId, setRoomId] = React.useState("");
    const [selfId, setSelfId] = React.useState("");
    const [participants, setParticipants] = React.useState<RemoteParticipant[]>([]);
    const [isJoined, setIsJoined] = React.useState(false);
    const [isConnecting, setIsConnecting] = React.useState(false);
    const [isMuted, setIsMuted] = React.useState(false);
    const [localLevel, setLocalLevel] = React.useState(0);
    const [connectionStatus, setConnectionStatus] = React.useState<"disconnected" | "connecting" | "connected">("disconnected");
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [activeRound, setActiveRound] = React.useState<ActiveRound | null>(null);
    const [isRecording, setIsRecording] = React.useState(false);
    const [isSubmittingAudio, setIsSubmittingAudio] = React.useState(false);
    const [transcription, setTranscription] = React.useState<string | null>(null);
    const [evaluationId, setEvaluationId] = React.useState<string | null>(null);
    const [evaluation, setEvaluation] = React.useState<EvaluationResult | null>(null);
    const [isHost, setIsHost] = React.useState(false);
    const [sessionStatus, setSessionStatus] = React.useState<string | null>(null);
    const [isGeneratingRound, setIsGeneratingRound] = React.useState(false);
    const [recordingCountdown, setRecordingCountdown] = React.useState<number | null>(null);

    const socketRef = React.useRef<WebSocket | null>(null);
    const localStreamRef = React.useRef<MediaStream | null>(null);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const answerRecorderRef = React.useRef<MediaRecorder | null>(null);
    const answerChunksRef = React.useRef<Blob[]>([]);
    const selectedMimeTypeRef = React.useRef("");
    const selfIdRef = React.useRef("");
    const lastRecorderRestartAtRef = React.useRef(0);
    const resyncTimersRef = React.useRef<number[]>([]);
    const localMonitorCleanupRef = React.useRef<(() => void) | null>(null);

    const senderPlayersRef = React.useRef<Map<string, SenderPlayer>>(new Map());
    const remoteLevelResetTimeoutsRef = React.useRef<Map<string, number>>(new Map());
    const backendHttpOriginRef = React.useRef(resolveBackendHttpOrigin());
    const autoRecordTimerRef = React.useRef<number | null>(null);
    const countdownIntervalRef = React.useRef<number | null>(null);
    const startRecordingFnRef = React.useRef<(() => void) | null>(null);
    const stopSubmitFnRef = React.useRef<(() => Promise<void>) | null>(null);

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

    const leaveRoom = React.useCallback(async () => {
        const currentSelfId = selfIdRef.current;

        setConnectionStatus("disconnected");
        setIsJoined(false);
        setSelfId("");
        setParticipants([]);
        setLocalLevel(0);
        setIsMuted(false);
        setActiveRound(null);
        setIsRecording(false);
        setTranscription(null);
        setEvaluation(null);
        setEvaluationId(null);
        setIsHost(false);
        setSessionStatus(null);
        setIsGeneratingRound(false);

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

        const answerRecorder = answerRecorderRef.current;
        if (answerRecorder && answerRecorder.state !== "inactive") {
            try { answerRecorder.stop(); } catch { /* ignore */ }
        }
        answerRecorderRef.current = null;
        answerChunksRef.current = [];

        if (autoRecordTimerRef.current !== null) {
            window.clearTimeout(autoRecordTimerRef.current);
            autoRecordTimerRef.current = null;
        }
        if (countdownIntervalRef.current !== null) {
            window.clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        setRecordingCountdown(null);

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

        const socket = socketRef.current;
        if (socket) {
            if (socket.readyState === WebSocket.OPEN && currentSelfId) {
                sendJson({
                    event: "leave",
                    from: currentSelfId,
                    user_id: currentSelfId,
                });
            }
            socket.close();
            socketRef.current = null;
        }
    }, [cleanupAllSenderPlayers, sendJson, stopRecorder]);

    React.useEffect(() => {
        return () => {
            void leaveRoom();
        };
    }, [leaveRoom]);

    const joinRoom = React.useCallback(async () => {
        const safeRoomId = roomId.trim();
        const safeDisplayName = displayName.trim();

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
            await leaveRoom();

            const headers = getAuthHeaders();
            if (!headers) {
                throw new Error("No se encontró token de sesión. Vuelve a iniciar sesión.");
            }

            const resolvedUserId = await getCurrentUserId(headers);
            const resolvedSessionCode = await ensureSessionCode(headers, safeRoomId, roleId);

            const sessionRes = await fetch(
                `${backendHttpOriginRef.current}/api/group-sessions/${encodeURIComponent(resolvedSessionCode)}`,
                { headers },
            );
            if (sessionRes.ok) {
                const sessionData = await sessionRes.json() as { host_id: number; status: string };
                setIsHost(sessionData.host_id === resolvedUserId);
                setSessionStatus(sessionData.status);
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

            const sessionUserId = String(resolvedUserId);
            selfIdRef.current = sessionUserId;
            setSelfId(sessionUserId);
            setRoomId(resolvedSessionCode);

            const encodedRoom = encodeURIComponent(resolvedSessionCode);
            const encodedUser = encodeURIComponent(sessionUserId);
            const wsUrl = `${BACKEND_WS_BASE}/${encodedRoom}/${encodedUser}`;

            const socket = new WebSocket(wsUrl);
            socket.binaryType = "arraybuffer";
            socketRef.current = socket;

            socket.onopen = () => {
                setConnectionStatus("connected");
                setIsJoined(true);

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

            socket.onclose = () => {
                setConnectionStatus("disconnected");
            };

            socket.onerror = () => {
                const errorMsg = "Error en conexion WebSocket";
                setErrorMessage(`Error conectando: ${errorMsg}. Revisa firewall, CORS, y que el backend este disponible.`);
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

                // ── Eventos del servidor (sin remitente peer) ──────────────────
                if (payload.event === "question_generated") {
                    setActiveRound({
                        roundId: payload.round_id ?? "",
                        roundIndex: payload.round_index ?? 0,
                        questionText: payload.question_text ?? "",
                        targetSkill: payload.target_skill ?? null,
                    });
                    setTranscription(null);
                    setEvaluation(null);
                    setEvaluationId(null);
                    return;
                }

                if (payload.event === "interview_started") {
                    setSessionStatus("in_progress");
                    return;
                }

                if (payload.event === "interview_closed") {
                    setSessionStatus("closed");
                    return;
                }

                if (payload.event === "round_started" || payload.event === "answer_transcribed") {
                    return;
                }

                // ── Eventos peer (filtrar self) ─────────────────────────────────
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
            await leaveRoom();
        } finally {
            setIsConnecting(false);
        }
    }, [appendChunkForSender, cleanupSenderPlayer, ensureSessionCode, getAuthHeaders, getCurrentUserId, leaveRoom, markRemoteActivity, removeParticipant, requestResync, restartRecorderForNewPeer, roleId, roomId, sendJson, startAudioLevelMonitor, startRecorder, unlockPlayback, updateParticipant, displayName]);

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

    const generateNextRound = React.useCallback(async () => {
        const headers = getAuthHeaders();
        if (!headers || !roomId) return;

        setIsGeneratingRound(true);
        setErrorMessage(null);
        try {
            if (sessionStatus === "waiting") {
                const startRes = await fetch(
                    `${backendHttpOriginRef.current}/api/group-sessions/${roomId}/start`,
                    { method: "POST", headers },
                );
                if (!startRes.ok) {
                    const err = await startRes.json().catch(() => ({})) as { detail?: string };
                    throw new Error(err.detail ?? "No se pudo iniciar la sesión.");
                }
                setSessionStatus("in_progress");
            }

            const roundRes = await fetch(
                `${backendHttpOriginRef.current}/api/group-sessions/${roomId}/rounds/next`,
                {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ target_skill: null, difficulty: null }),
                },
            );
            if (!roundRes.ok) {
                const err = await roundRes.json().catch(() => ({})) as { detail?: string };
                throw new Error(err.detail ?? "No se pudo generar la pregunta.");
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error generando la pregunta.";
            setErrorMessage(msg);
        } finally {
            setIsGeneratingRound(false);
        }
    }, [getAuthHeaders, roomId, sessionStatus]);

    const startAnswerRecording = React.useCallback(() => {
        const stream = localStreamRef.current;
        if (!stream || !isJoined) return;

        answerChunksRef.current = [];
        const mimeType = selectedMimeTypeRef.current || "";

        try {
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) answerChunksRef.current.push(e.data);
            };

            answerRecorderRef.current = recorder;
            recorder.start(250);
            setIsRecording(true);
        } catch {
            setErrorMessage("No se pudo iniciar la grabación de respuesta.");
        }
    }, [isJoined]);

    const stopAndSubmitAnswer = React.useCallback(async () => {
        if (autoRecordTimerRef.current !== null) {
            window.clearTimeout(autoRecordTimerRef.current);
            autoRecordTimerRef.current = null;
        }
        if (countdownIntervalRef.current !== null) {
            window.clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        setRecordingCountdown(null);

        const recorder = answerRecorderRef.current;
        if (!recorder || recorder.state === "inactive") {
            setIsRecording(false);
            return;
        }

        await new Promise<void>((resolve) => {
            recorder.onstop = () => resolve();
            recorder.stop();
        });

        setIsRecording(false);
        answerRecorderRef.current = null;

        const chunks = answerChunksRef.current;
        if (!chunks.length || !activeRound) return;

        const mimeType = selectedMimeTypeRef.current || "audio/webm";
        const rawBlob = new Blob(chunks, { type: mimeType });
        const blob = await convertBlobToWav(rawBlob).catch(() => rawBlob);
        const ext = blob.type === "audio/wav" ? "wav" : (mimeType.split("/")[1]?.split(";")[0] ?? "webm");

        setIsSubmittingAudio(true);
        setTranscription(null);
        setEvaluation(null);
        setEvaluationId(null);

        try {
            const token = getAccessToken();
            const formData = new FormData();
            formData.append("audio_file", blob, `answer.${ext}`);
            formData.append("round_id", activeRound.roundId);

            const response = await fetch(
                `${backendHttpOriginRef.current}/api/group-sessions/${roomId}/answers/audio`,
                {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                },
            );

            if (!response.ok) {
                const err = await response.json().catch(() => ({})) as { detail?: string };
                throw new Error(err.detail ?? "Error al enviar respuesta de audio.");
            }

            const data = await response.json() as { transcription: string; evaluation_id: string };
            setTranscription(data.transcription);
            setEvaluationId(data.evaluation_id);
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error al enviar respuesta de audio.";
            setErrorMessage(msg);
        } finally {
            setIsSubmittingAudio(false);
        }
    }, [activeRound, roomId]);

    React.useEffect(() => {
        if (!evaluationId) return;

        const token = getAccessToken();
        const backendOrigin = backendHttpOriginRef.current;

        const intervalId = window.setInterval(async () => {
            try {
                const res = await fetch(
                    `${backendOrigin}/evaluations/evaluation/${evaluationId}`,
                    { headers: { Authorization: `Bearer ${token}` } },
                );
                if (!res.ok) return;
                const data = await res.json() as EvaluationResult;
                if (data.status !== "pending") {
                    setEvaluation(data);
                    window.clearInterval(intervalId);
                }
            } catch {
                // ignore polling errors
            }
        }, 2000);

        return () => window.clearInterval(intervalId);
    }, [evaluationId]);

    React.useEffect(() => {
        startRecordingFnRef.current = startAnswerRecording;
        stopSubmitFnRef.current = stopAndSubmitAnswer;
    }, [startAnswerRecording, stopAndSubmitAnswer]);

    React.useEffect(() => {
        if (!activeRound?.roundId || !isJoined) return;

        if (autoRecordTimerRef.current !== null) {
            window.clearTimeout(autoRecordTimerRef.current);
            autoRecordTimerRef.current = null;
        }
        if (countdownIntervalRef.current !== null) {
            window.clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }

        startRecordingFnRef.current?.();
        setRecordingCountdown(5);

        countdownIntervalRef.current = window.setInterval(() => {
            setRecordingCountdown((prev) => {
                if (prev === null || prev <= 1) {
                    if (countdownIntervalRef.current !== null) {
                        window.clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                    }
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

        autoRecordTimerRef.current = window.setTimeout(() => {
            void stopSubmitFnRef.current?.();
            autoRecordTimerRef.current = null;
        }, 5000);

        return () => {
            if (autoRecordTimerRef.current !== null) {
                window.clearTimeout(autoRecordTimerRef.current);
                autoRecordTimerRef.current = null;
            }
            if (countdownIntervalRef.current !== null) {
                window.clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
            }
        };
    }, [activeRound?.roundId, isJoined]);

    const localName = displayName.trim() || "Tu usuario";
    const activeRemoteCount = participants.length;
    const accessToken = typeof window !== "undefined" ? getAccessToken() : null;
    const activeQuestion = React.useMemo<AudioPlayerQuestion>(() => {
        if (activeRound?.questionText) {
            return {
                id: `round-${activeRound.roundId}`,
                text: activeRound.questionText,
                note: `Ronda ${activeRound.roundIndex}${activeRound.targetSkill ? ` · ${activeRound.targetSkill}` : ""}`,
            };
        }

        if (roleId) {
            return {
                id: `intro-${roleId}`,
                text: `Presentate y resume por que tu experiencia encaja con el rol ${roleId}.`,
                note: "Pregunta de introducción",
            };
        }

        return {
            id: "intro-general",
            text: "Presentate y resume brevemente la experiencia mas relevante que aportarias en esta entrevista.",
            note: "Pregunta general de introducción",
        };
    }, [activeRound, roleId]);

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
                                {connectionStatus === "connected" && "Conectado"}
                                {connectionStatus === "connecting" && "Conectando..."}
                                {connectionStatus === "disconnected" && "Desconectado"}
                            </div>
                        </div>
                    </section>

                    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                            <div className="lg:col-span-4">
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
                            <div className="lg:col-span-5">
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
                            <div className="lg:col-span-3 lg:flex lg:items-end">
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
                                        onClick={() => void leaveRoom()}
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Salir de la sala
                                    </Button>
                                )}
                            </div>
                        </div>

                        {errorMessage && (
                            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {errorMessage}
                            </p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" onClick={toggleMute} disabled={!isJoined} className="gap-2">
                                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                {isMuted ? "Activar microfono" : "Silenciar microfono"}
                            </Button>
                            {isJoined && isHost && sessionStatus !== "closed" && (
                                <Button
                                    type="button"
                                    onClick={() => void generateNextRound()}
                                    disabled={isGeneratingRound}
                                    className="gap-2 bg-cyan-600 hover:bg-cyan-700"
                                >
                                    <AudioLines className="h-4 w-4" />
                                    {isGeneratingRound
                                        ? "Generando..."
                                        : activeRound
                                        ? "Siguiente pregunta"
                                        : "Iniciar entrevista"}
                                </Button>
                            )}
                            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
                                <Users className="mr-1 inline h-3.5 w-3.5" />
                                Participantes remotos: {activeRemoteCount}
                            </span>
                        </div>
                    </section>

                    <section className="mb-6">
                        <AudioPlayer question={activeQuestion} authToken={accessToken} />
                    </section>

                    {isJoined && activeRound && (
                        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4">
                                <span className="text-xs font-medium uppercase tracking-wide text-cyan-600">
                                    Ronda {activeRound.roundIndex}{activeRound.targetSkill ? ` · ${activeRound.targetSkill}` : ""}
                                </span>
                                <p className="mt-1 text-sm font-medium text-slate-800">{activeRound.questionText}</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {recordingCountdown !== null ? (
                                    <>
                                        <span className="inline-flex animate-pulse items-center gap-2 rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700">
                                            <Mic className="h-4 w-4" />
                                            Grabando... {recordingCountdown}s
                                        </span>
                                        <Button
                                            type="button"
                                            onClick={() => void stopAndSubmitAnswer()}
                                            className="gap-2 bg-slate-800 hover:bg-slate-900"
                                        >
                                            <Square className="h-4 w-4" />
                                            Enviar ahora
                                        </Button>
                                    </>
                                ) : isRecording ? (
                                    <Button
                                        type="button"
                                        onClick={() => void stopAndSubmitAnswer()}
                                        className="gap-2 animate-pulse bg-slate-800 hover:bg-slate-900"
                                    >
                                        <Square className="h-4 w-4" />
                                        Detener y enviar
                                    </Button>
                                ) : null}
                                {isSubmittingAudio && (
                                    <span className="text-sm text-slate-500">Transcribiendo respuesta...</span>
                                )}
                            </div>

                            {transcription && (
                                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Tu respuesta</p>
                                    <p className="text-sm text-slate-800">{transcription}</p>
                                </div>
                            )}

                            {evaluation && evaluation.status !== "pending" && (
                                <div className={`mt-4 rounded-lg border p-4 ${
                                    evaluation.score !== null && evaluation.score >= 70
                                        ? "border-emerald-200 bg-emerald-50"
                                        : evaluation.score !== null && evaluation.score >= 50
                                        ? "border-yellow-200 bg-yellow-50"
                                        : "border-red-200 bg-red-50"
                                }`}>
                                    <div className="mb-2 flex items-center justify-between">
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Evaluación automática</p>
                                        {evaluation.score !== null && (
                                            <span className={`text-sm font-bold ${
                                                evaluation.score >= 70 ? "text-emerald-700" : evaluation.score >= 50 ? "text-yellow-700" : "text-red-700"
                                            }`}>
                                                {evaluation.score}/100
                                            </span>
                                        )}
                                    </div>
                                    {evaluation.feedback && (
                                        <p className="whitespace-pre-line text-sm text-slate-700">{evaluation.feedback}</p>
                                    )}
                                    {evaluation.score_breakdown && (
                                        <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-slate-500">
                                            <span>Correctitud: {evaluation.score_breakdown.correctness}</span>
                                            <span>Completitud: {evaluation.score_breakdown.completeness}</span>
                                            <span>Claridad: {evaluation.score_breakdown.clarity}</span>
                                            <span>Ejemplos: {evaluation.score_breakdown.examples}</span>
                                        </div>
                                    )}
                                </div>
                            )}
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
                            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-cyan-100">
                                <div
                                    className="h-full rounded-full bg-cyan-600 transition-all"
                                    style={{ width: `${Math.min(100, Math.round(localLevel * 500))}%` }}
                                />
                            </div>
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

                                                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${
                                                            isSpeaking ? "bg-emerald-500" : "bg-cyan-500"
                                                        }`}
                                                        style={{ width: `${levelWidth}%` }}
                                                    />
                                                </div>
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
