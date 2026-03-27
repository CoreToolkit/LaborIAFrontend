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
import PrivateRoute from "@/components/PrivateRoute";

const BACKEND_WS_BASE = process.env.NEXT_PUBLIC_BACKEND_WS_BASE;
const AUDIO_SAMPLE_RATE = 48000;
const PROCESSOR_BUFFER_SIZE = 1024;
const AUDIO_FRAME_MS = 20;
const AUDIO_FRAME_SAMPLES = Math.floor((AUDIO_SAMPLE_RATE * AUDIO_FRAME_MS) / 1000);
const MIN_JITTER_BUFFER_MS = 100;
const MAX_JITTER_BUFFER_MS = 220;

type SignalingMessage = {
    event: string;
    from?: string;
    user_id?: string;
    displayName?: string;
};

type RemoteParticipant = {
    socketId: string;
    displayName: string;
    connected: boolean;
    level: number;
};

type RemotePlaybackState = {
    queue: Float32Array[];
    isPlaying: boolean;
    nextTime: number;
    targetBufferMs: number;
};

const createDefaultRoomId = (): string => {
    return `room-${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeUserId = (displayName: string): string => {
    const base = displayName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-_]/g, "")
        .slice(0, 24) || "user";

    return `${base}-${Math.random().toString(36).slice(2, 7)}`;
};

const normalizeUserLabel = (name: string, socketId: string): string => {
    const safeName = name.trim();
    if (safeName) {
        return safeName;
    }

    return `Usuario-${socketId.slice(0, 5)}`;
};

const pcm16ToFloat32 = (payload: Uint8Array): Float32Array => {
    const sampleCount = Math.floor(payload.byteLength / 2);
    const result = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i += 1) {
        const lo = payload[i * 2] ?? 0;
        const hi = payload[i * 2 + 1] ?? 0;
        const value = (hi << 8) | lo;
        const signed = value >= 0x8000 ? value - 0x10000 : value;
        result[i] = Math.max(-1, Math.min(1, signed / 32768));
    }

    return result;
};

const float32ToPCM16 = (input: Float32Array): Uint8Array => {
    const bytes = new Uint8Array(input.length * 2);

    for (let i = 0; i < input.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
        const intSample = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
        const value = intSample < 0 ? intSample + 0x10000 : intSample;

        bytes[i * 2] = value & 0xff;
        bytes[i * 2 + 1] = (value >> 8) & 0xff;
    }

    return bytes;
};

const calculateRms = (samples: Float32Array): number => {
    if (!samples.length) {
        return 0;
    }

    let sumSquares = 0;
    for (let i = 0; i < samples.length; i += 1) {
        const s = samples[i] ?? 0;
        sumSquares += s * s;
    }

    return Math.sqrt(sumSquares / samples.length);
};

function InterviewPageContent() {
    const router = useRouter();

    const [displayName, setDisplayName] = React.useState("");
    const [roomId, setRoomId] = React.useState(createDefaultRoomId());
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
    const selfIdRef = React.useRef("");
    const isMutedRef = React.useRef(false);

    const localAudioContextRef = React.useRef<AudioContext | null>(null);
    const localSourceNodeRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
    const localProcessorNodeRef = React.useRef<ScriptProcessorNode | null>(null);
    const pendingCaptureSamplesRef = React.useRef<number[]>([]);
    const localMonitorCleanupRef = React.useRef<(() => void) | null>(null);

    const playbackContextRef = React.useRef<AudioContext | null>(null);
    const remotePlaybackRef = React.useRef<Map<string, RemotePlaybackState>>(new Map());
    const remoteLevelResetTimeoutsRef = React.useRef<Map<string, number>>(new Map());

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

    const sendAudioBytes = React.useCallback((bytes: Uint8Array) => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }
        socket.send(bytes.buffer);
    }, []);

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

        remotePlaybackRef.current.delete(socketId);
    }, []);

    const markRemoteLevel = React.useCallback((socketId: string, level: number) => {
        updateParticipant(socketId, (current) => ({
            socketId,
            displayName: current?.displayName || normalizeUserLabel("", socketId),
            connected: true,
            level,
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
        }, 300);

        remoteLevelResetTimeoutsRef.current.set(socketId, timeoutId);
    }, [updateParticipant]);

    const ensurePlaybackContext = React.useCallback((): AudioContext => {
        if (!playbackContextRef.current) {
            playbackContextRef.current = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
        }

        const playbackContext = playbackContextRef.current;
        if (playbackContext.state === "suspended") {
            void playbackContext.resume();
        }

        return playbackContext;
    }, []);

    const scheduleRemotePlayback = React.useCallback((socketId: string) => {
        const playbackContext = ensurePlaybackContext();
        const state = remotePlaybackRef.current.get(socketId);

        if (!state || state.isPlaying || state.queue.length === 0) {
            return;
        }

        const queueMsBeforeStart = state.queue.length * AUDIO_FRAME_MS;
        if (queueMsBeforeStart < state.targetBufferMs) {
            return;
        }

        state.isPlaying = true;

        const playNext = () => {
            const latest = remotePlaybackRef.current.get(socketId);
            if (!latest) {
                return;
            }

            const chunk = latest.queue.shift();
            if (!chunk) {
                latest.isPlaying = false;
                latest.nextTime = playbackContext.currentTime;
                latest.targetBufferMs = Math.min(MAX_JITTER_BUFFER_MS, latest.targetBufferMs + 20);
                return;
            }

            const audioBuffer = playbackContext.createBuffer(1, chunk.length, AUDIO_SAMPLE_RATE);
            const channelData = Float32Array.from(chunk);
            audioBuffer.getChannelData(0).set(channelData);

            const source = playbackContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(playbackContext.destination);

            const queueMs = latest.queue.length * AUDIO_FRAME_MS;
            source.playbackRate.value = 1;

            const startAt = Math.max(playbackContext.currentTime + 0.005, latest.nextTime || 0);
            source.start(startAt);
            latest.nextTime = startAt + audioBuffer.duration;

            if (queueMs <= latest.targetBufferMs + 20) {
                latest.targetBufferMs = Math.max(MIN_JITTER_BUFFER_MS, latest.targetBufferMs - 2);
            }

            source.onended = () => {
                playNext();
            };
        };

        playNext();
    }, [ensurePlaybackContext]);

    const processRemoteAudio = React.useCallback((socketId: string, payload: Uint8Array) => {
        const samples = pcm16ToFloat32(payload);
        if (!samples.length) {
            return;
        }

        const level = calculateRms(samples);
        markRemoteLevel(socketId, level);

        const existing = remotePlaybackRef.current.get(socketId);
        if (existing) {
            existing.queue.push(samples);
            if (existing.queue.length > 30) {
                existing.queue.shift();
            }
        } else {
            remotePlaybackRef.current.set(socketId, {
                queue: [samples],
                isPlaying: false,
                nextTime: 0,
                targetBufferMs: MIN_JITTER_BUFFER_MS,
            });
        }

        scheduleRemotePlayback(socketId);
    }, [markRemoteLevel, scheduleRemotePlayback]);

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

    const stopLocalPublisher = React.useCallback(async () => {
        pendingCaptureSamplesRef.current = [];

        if (localProcessorNodeRef.current) {
            localProcessorNodeRef.current.onaudioprocess = null;
            localProcessorNodeRef.current.disconnect();
            localProcessorNodeRef.current = null;
        }

        if (localSourceNodeRef.current) {
            localSourceNodeRef.current.disconnect();
            localSourceNodeRef.current = null;
        }

        if (localAudioContextRef.current) {
            try {
                await localAudioContextRef.current.close();
            } catch {
                return;
            } finally {
                localAudioContextRef.current = null;
            }
        }
    }, []);

    const startLocalPublisher = React.useCallback(async (stream: MediaStream) => {
        await stopLocalPublisher();

        const audioContext = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        const sourceNode = audioContext.createMediaStreamSource(stream);
        const processorNode = audioContext.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);

        processorNode.onaudioprocess = (event) => {
            if (isMutedRef.current) {
                return;
            }

            const input = event.inputBuffer.getChannelData(0);
            const pending = pendingCaptureSamplesRef.current;

            for (let i = 0; i < input.length; i += 1) {
                pending.push(input[i] ?? 0);
            }

            while (pending.length >= AUDIO_FRAME_SAMPLES) {
                const frame = new Float32Array(AUDIO_FRAME_SAMPLES);

                for (let i = 0; i < AUDIO_FRAME_SAMPLES; i += 1) {
                    frame[i] = pending[i] ?? 0;
                }

                pending.splice(0, AUDIO_FRAME_SAMPLES);

                const pcmBytes = float32ToPCM16(frame);
                sendAudioBytes(pcmBytes);
            }
        };

        sourceNode.connect(processorNode);
        processorNode.connect(audioContext.destination);

        localAudioContextRef.current = audioContext;
        localSourceNodeRef.current = sourceNode;
        localProcessorNodeRef.current = processorNode;
    }, [sendAudioBytes, stopLocalPublisher]);

    const leaveRoom = React.useCallback(async () => {
        const currentSelfId = selfIdRef.current;

        setConnectionStatus("disconnected");
        setIsJoined(false);
        setSelfId("");
        setParticipants([]);
        setLocalLevel(0);

        selfIdRef.current = "";
        isMutedRef.current = false;
        setIsMuted(false);

        if (localMonitorCleanupRef.current) {
            localMonitorCleanupRef.current();
            localMonitorCleanupRef.current = null;
        }

        await stopLocalPublisher();

        localStreamRef.current?.getTracks().forEach((track) => {
            track.stop();
        });
        localStreamRef.current = null;

        remoteLevelResetTimeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId);
        });
        remoteLevelResetTimeoutsRef.current.clear();
        remotePlaybackRef.current.clear();

        if (playbackContextRef.current) {
            try {
                await playbackContextRef.current.close();
            } catch {
                return;
            } finally {
                playbackContextRef.current = null;
            }
        }

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
    }, [sendJson, stopLocalPublisher]);

    React.useEffect(() => {
        if (router.isReady && typeof router.query.role_id === "string" && !roomId.startsWith("role-")) {
            setRoomId(`role-${router.query.role_id}`);
        }
    }, [roomId, router.isReady, router.query.role_id]);

    React.useEffect(() => {
        return () => {
            void leaveRoom();
        };
    }, [leaveRoom]);

    const joinRoom = React.useCallback(async () => {
        const safeRoomId = roomId.trim();
        const safeDisplayName = displayName.trim();

        if (!safeRoomId) {
            setErrorMessage("Debes ingresar un Room ID.");
            return;
        }

        if (!safeDisplayName) {
            setErrorMessage("Debes ingresar tu nombre para entrar.");
            return;
        }

        setIsConnecting(true);
        setErrorMessage(null);
        setConnectionStatus("connecting");

        try {
            await unlockPlayback();

            const localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: AUDIO_SAMPLE_RATE,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });

            localStreamRef.current = localStream;
            setIsMuted(false);
            isMutedRef.current = false;

            localMonitorCleanupRef.current = startAudioLevelMonitor(localStream, (level) => {
                setLocalLevel(level);
            });

            const sessionUserId = normalizeUserId(safeDisplayName);
            selfIdRef.current = sessionUserId;
            setSelfId(sessionUserId);

            const encodedRoom = encodeURIComponent(safeRoomId);
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

                void startLocalPublisher(localStream);
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
                    if (userIdLength === 0 || buffer.length < 1 + userIdLength + 2) {
                        return;
                    }

                    const userIdBytes = buffer.slice(1, 1 + userIdLength);
                    const senderId = new TextDecoder().decode(userIdBytes);
                    if (!senderId || senderId === sessionUserId) {
                        return;
                    }

                    const audioPayload = buffer.slice(1 + userIdLength);
                    processRemoteAudio(senderId, audioPayload);
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
                    return;
                }

                if (payload.event === "leave" || payload.event === "user_left") {
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
    }, [displayName, leaveRoom, processRemoteAudio, removeParticipant, roomId, sendJson, startAudioLevelMonitor, startLocalPublisher, unlockPlayback, updateParticipant]);

    const toggleMute = () => {
        const localStream = localStreamRef.current;
        if (!localStream) {
            return;
        }

        const nextMuted = !isMutedRef.current;
        isMutedRef.current = nextMuted;

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
                                    Room ID
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        id="roomId"
                                        type="text"
                                        value={roomId}
                                        onChange={(event) => setRoomId(event.target.value)}
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
                                    No hay participantes remotos aun. Comparte el Room ID y espera a que ingresen.
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
                                                        className={`rounded-full px-2 py-1 text-[11px] font-medium ${participant.connected
                                                                ? "bg-emerald-100 text-emerald-700"
                                                                : "bg-slate-100 text-slate-500"
                                                            }`}
                                                    >
                                                        {participant.connected ? "Activo" : "Conectando"}
                                                    </span>
                                                </div>

                                                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${isSpeaking ? "bg-emerald-500" : "bg-cyan-500"
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
