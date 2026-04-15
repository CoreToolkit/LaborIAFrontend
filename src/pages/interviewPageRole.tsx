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
            const backendWsBase = backendWsBaseRef.current;
            if (!backendWsBase) {
                throw new Error("No se encontró la URL del backend para WebSocket.");
            }

            const wsUrl = `${backendWsBase}/${encodedRoom}/${encodedUser}`;

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

    const localName = displayName.trim() || "Tu usuario";
    const activeRemoteCount = participants.length;
    const accessToken = typeof window !== "undefined" ? getAccessToken() : null;
    const activeQuestion = React.useMemo<AudioPlayerQuestion>(() => {
        if (roleId) {
            return {
                id: `intro-${roleId}`,
                text: `Presentate y resume por que tu experiencia encaja con el rol ${roleId}.`,
                note: "Pregunta activa temporal derivada del role_id actual.",
            };
        }

        return {
            id: "intro-general",
            text: "Presentate y resume brevemente la experiencia mas relevante que aportarias en esta entrevista.",
            note: "Pregunta activa temporal mientras se define el flujo real de preguntas.",
        };
    }, [roleId]);

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
                            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
                                <Users className="mr-1 inline h-3.5 w-3.5" />
                                Participantes remotos: {activeRemoteCount}
                            </span>
                        </div>
                    </section>

                    <section className="mb-6">
                        <AudioPlayer question={activeQuestion} authToken={accessToken} />
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
