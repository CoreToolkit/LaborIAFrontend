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

const BACKEND_WS_BASE = "wss://laboriabackend-pxfh.onrender.com/api/ws";

type SignalSdpPayload = {
  from: string;
  sdp: RTCSessionDescriptionInit;
};

type SignalIcePayload = {
  from: string;
  candidate: RTCIceCandidateInit;
};

type SignalingMessage = {
  event: string;
  from?: string;
  target?: string;
  user_id?: string;
  displayName?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type RemoteParticipant = {
  socketId: string;
  displayName: string;
  connected: boolean;
  level: number;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

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
  const peerConnectionsRef = React.useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteMonitorsRef = React.useRef<Map<string, () => void>>(new Map());
  const audioElementsRef = React.useRef<Map<string, HTMLAudioElement>>(new Map());
  const localMonitorCleanupRef = React.useRef<(() => void) | null>(null);

  const sendSignal = React.useCallback((message: SignalingMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(message));
  }, []);

  React.useEffect(() => {
    if (router.isReady && typeof router.query.role_id === "string" && !roomId.startsWith("role-")) {
      setRoomId(`role-${router.query.role_id}`);
    }
  }, [roomId, router.isReady, router.query.role_id]);

  React.useEffect(() => {
    return () => {
      void leaveRoom();
    };
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
  }, []);

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

  const cleanupPeer = React.useCallback((socketId: string) => {
    const monitorCleanup = remoteMonitorsRef.current.get(socketId);
    if (monitorCleanup) {
      monitorCleanup();
      remoteMonitorsRef.current.delete(socketId);
    }

    const audioElement = audioElementsRef.current.get(socketId);
    if (audioElement) {
      audioElement.srcObject = null;
      audioElementsRef.current.delete(socketId);
    }

    const peerConnection = peerConnectionsRef.current.get(socketId);
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
      peerConnectionsRef.current.delete(socketId);
    }

    removeParticipant(socketId);
  }, [removeParticipant]);

  const createPeerConnection = React.useCallback((peerId: string): RTCPeerConnection => {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) {
      return existing;
    }

    const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionsRef.current.set(peerId, peerConnection);

    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !selfId) {
        return;
      }

      sendSignal({
        event: "webrtc-ice-candidate",
        from: selfId,
        target: peerId,
        candidate: event.candidate.toJSON(),
      });
    };

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) {
        return;
      }

      let audioElement = audioElementsRef.current.get(peerId);
      if (!audioElement) {
        audioElement = new Audio();
        audioElement.autoplay = true;
        audioElement.setAttribute("playsinline", "true");
        audioElementsRef.current.set(peerId, audioElement);
      }

      audioElement.srcObject = remoteStream;
      void audioElement.play().catch(() => {
        return;
      });

      if (!remoteMonitorsRef.current.has(peerId)) {
        const cleanupMonitor = startAudioLevelMonitor(remoteStream, (level) => {
          updateParticipant(peerId, (current) => ({
            socketId: peerId,
            displayName: current?.displayName || normalizeUserLabel("", peerId),
            connected: true,
            level,
          }));
        });

        remoteMonitorsRef.current.set(peerId, cleanupMonitor);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;

      if (state === "connected") {
        updateParticipant(peerId, (current) => ({
          socketId: peerId,
          displayName: current?.displayName || normalizeUserLabel("", peerId),
          connected: true,
          level: current?.level || 0,
        }));
      }

      if (state === "failed" || state === "closed") {
        cleanupPeer(peerId);
      }
    };

    return peerConnection;
  }, [cleanupPeer, selfId, sendSignal, startAudioLevelMonitor, updateParticipant]);

  const createOfferForPeer = React.useCallback(async (peerId: string) => {
    if (!selfId) {
      return;
    }

    const peerConnection = createPeerConnection(peerId);
    if (peerConnection.localDescription) {
      return;
    }

    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });

    await peerConnection.setLocalDescription(offer);

    sendSignal({
      event: "webrtc-offer",
      from: selfId,
      target: peerId,
      sdp: offer,
    });
  }, [createPeerConnection, selfId, sendSignal]);

  const handleOffer = React.useCallback(async ({ from, sdp }: SignalSdpPayload) => {
    if (!selfId) {
      return;
    }

    const peerConnection = createPeerConnection(from);

    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    sendSignal({
      event: "webrtc-answer",
      from: selfId,
      target: from,
      sdp: answer,
    });
  }, [createPeerConnection, selfId, sendSignal]);

  const handleAnswer = React.useCallback(async ({ from, sdp }: SignalSdpPayload) => {
    const peerConnection = peerConnectionsRef.current.get(from);
    if (!peerConnection) {
      return;
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
  }, []);

  const handleIceCandidate = React.useCallback(async ({ from, candidate }: SignalIcePayload) => {
    const peerConnection = peerConnectionsRef.current.get(from);
    if (!peerConnection) {
      return;
    }

    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }, []);

  const leaveRoom = React.useCallback(async () => {
    setConnectionStatus("disconnected");
    setIsJoined(false);
    setSelfId("");
    setParticipants([]);

    if (localMonitorCleanupRef.current) {
      localMonitorCleanupRef.current();
      localMonitorCleanupRef.current = null;
    }

    setLocalLevel(0);

    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    localStreamRef.current = null;

    remoteMonitorsRef.current.forEach((cleanup) => cleanup());
    remoteMonitorsRef.current.clear();

    audioElementsRef.current.forEach((audioElement) => {
      audioElement.srcObject = null;
    });
    audioElementsRef.current.clear();

    peerConnectionsRef.current.forEach((peerConnection) => {
      peerConnection.close();
    });
    peerConnectionsRef.current.clear();

    const socket = socketRef.current;
    if (socket) {
      if (socket.readyState === WebSocket.OPEN) {
        sendSignal({
          event: "leave",
          from: selfId,
          user_id: selfId,
        });
      }
      socket.close();
      socketRef.current = null;
    }
  }, [selfId, sendSignal]);

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

      const sessionUserId = normalizeUserId(safeDisplayName);
      setSelfId(sessionUserId);

      const encodedRoom = encodeURIComponent(safeRoomId);
      const encodedUser = encodeURIComponent(sessionUserId);
      const socket = new WebSocket(`${BACKEND_WS_BASE}/${encodedRoom}/${encodedUser}`);

      socketRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus("connected");
        setIsJoined(true);

        sendSignal({
          event: "webrtc-introduce",
          from: sessionUserId,
          user_id: sessionUserId,
          displayName: safeDisplayName,
        });
      };

      socket.onclose = () => {
        setConnectionStatus("disconnected");
      };

      socket.onerror = () => {
        setErrorMessage("No fue posible abrir la conexion websocket.");
      };

      socket.onmessage = (event) => {
        if (typeof event.data !== "string") {
          return;
        }

        let payload: SignalingMessage | null = null;
        try {
          payload = JSON.parse(event.data) as SignalingMessage;
        } catch {
          return;
        }

        if (!payload || !payload.event) {
          return;
        }

        const senderId = payload.from || payload.user_id || "";
        if (senderId === sessionUserId) {
          return;
        }

        const isTargeted = !payload.target || payload.target === sessionUserId;
        if (!isTargeted) {
          return;
        }

        if (payload.event === "join" || payload.event === "user_joined" || payload.event === "webrtc-introduce") {
          if (!senderId) {
            return;
          }

          updateParticipant(senderId, (current) => ({
            socketId: senderId,
            displayName: payload?.displayName?.trim()
              ? payload.displayName.trim()
              : current?.displayName || normalizeUserLabel("", senderId),
            connected: true,
            level: current?.level || 0,
          }));

          if (sessionUserId.localeCompare(senderId) < 0) {
            void createOfferForPeer(senderId);
          }

          return;
        }

        if (payload.event === "leave" || payload.event === "user_left") {
          if (!senderId) {
            return;
          }
          cleanupPeer(senderId);
          return;
        }

        if (payload.event === "webrtc-offer" && senderId && payload.sdp) {
          void handleOffer({ from: senderId, sdp: payload.sdp });
          return;
        }

        if (payload.event === "webrtc-answer" && senderId && payload.sdp) {
          void handleAnswer({ from: senderId, sdp: payload.sdp });
          return;
        }

        if (payload.event === "webrtc-ice-candidate" && senderId && payload.candidate) {
          void handleIceCandidate({ from: senderId, candidate: payload.candidate });
        }
      };
    } catch (error) {
      const fallback = "No fue posible conectarte a la sala. Revisa permisos de microfono y vuelve a intentar.";
      setErrorMessage(error instanceof Error && error.message ? error.message : fallback);
      await leaveRoom();
    } finally {
      setIsConnecting(false);
    }
  }, [cleanupPeer, createOfferForPeer, displayName, handleAnswer, handleIceCandidate, handleOffer, leaveRoom, roomId, sendSignal, startAudioLevelMonitor, updateParticipant]);

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

  return (
    <>
      <Head>
        <title>Sala de Entrevista - LaborIA</title>
        <meta
          name="description"
          content="Sala de entrevista colaborativa por audio en tiempo real con Socket.IO y WebRTC"
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
                  Conecta varios participantes en tiempo real. Cada nuevo integrante se enlaza por WebRTC con todos los demas en la sala.
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
