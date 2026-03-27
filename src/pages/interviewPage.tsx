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
  const selfIdRef = React.useRef("");
  const peerConnectionsRef = React.useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteMonitorsRef = React.useRef<Map<string, () => void>>(new Map());
  const audioElementsRef = React.useRef<Map<string, HTMLAudioElement>>(new Map());
  const localMonitorCleanupRef = React.useRef<(() => void) | null>(null);
  const introduceIntervalRef = React.useRef<number | null>(null);

  const unlockPlayback = React.useCallback(async () => {
    console.log("[unlockPlayback] Iniciando...");
    try {
      const primerAudio = new Audio();
      primerAudio.muted = true;
      const playPromise = primerAudio.play();
      // No esperar el resultado, solo triggear el play
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Silenciar errores - esto es solo para unlock
        });
      }
      primerAudio.pause();
      console.log("[unlockPlayback] ✓ Completado");
    } catch (err) {
      console.warn("[unlockPlayback] Advertencia (continúa):", err);
    }
  }, []);

  const sendSignal = React.useCallback((message: SignalingMessage) => {
    console.log("[sendSignal] Intentando enviar:", message.event, "target:", message.target);
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.error("[sendSignal] Socket no está abierto. Estado:", socket?.readyState);
      return;
    }

    console.log("[sendSignal] ✓ Enviando mensaje:", JSON.stringify(message).slice(0, 100));
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
      audioElement.pause();
      
      // Remover del DOM
      if (audioElement.parentNode) {
        audioElement.parentNode.removeChild(audioElement);
        console.log("[cleanupPeer] Audio element removido del DOM para:", socketId);
      }
      
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
    console.log("[createPeerConnection] Creando conexión para:", peerId);
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) {
      console.log("[createPeerConnection] Ya existe, retornando existente");
      return existing;
    }

    const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionsRef.current.set(peerId, peerConnection);
    console.log("[createPeerConnection] ✓ Nueva RTCPeerConnection creada");

    const localStream = localStreamRef.current;
    if (localStream) {
      console.log("[createPeerConnection] Agregando tracks locales...");
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
      console.log("[createPeerConnection] ✓ Tracks agregados");
    } else {
      console.warn("[createPeerConnection] No hay localStream disponible");
    }

    peerConnection.onicecandidate = (event) => {
      const senderId = selfIdRef.current;
      if (!event.candidate || !senderId) {
        return;
      }

      console.log("[createPeerConnection] Enviando ICE candidate a:", peerId);
      sendSignal({
        event: "webrtc-ice-candidate",
        from: senderId,
        user_id: senderId,
        target: peerId,
        candidate: event.candidate.toJSON(),
      });
    };

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) {
        return;
      }
      console.log("[createPeerConnection] Track remoto recibido de:", peerId);

      let audioElement = audioElementsRef.current.get(peerId);
      if (!audioElement) {
        audioElement = new Audio();
        audioElement.autoplay = true;
        audioElement.muted = false;
        audioElement.volume = 1;
        audioElement.preload = "auto";
        audioElement.setAttribute("playsinline", "true");
        audioElement.id = `audio-${peerId}`;

        audioElement.onloadedmetadata = () => {
          void audioElement?.play().catch((err) => {
            console.error("[createPeerConnection] ✗ Error play() onloadedmetadata:", err?.name, err?.message);
          });
        };
        
        // Agregar al DOM para que se reproduzca
        document.body.appendChild(audioElement);
        console.log("[createPeerConnection] Audio element agregado al DOM para:", peerId);
        
        audioElementsRef.current.set(peerId, audioElement);
      }

      audioElement.srcObject = remoteStream;
      console.log("[createPeerConnection] srcObject asignado, iniciando reproducción");
      void audioElement.play().catch((err) => {
          console.error("[createPeerConnection] ✗ Error reproduciendo audio:", err?.name, err?.message);
      });

      const [remoteTrack] = remoteStream.getAudioTracks();
      if (remoteTrack) {
        console.log(
          "[createPeerConnection] Estado track remoto:",
          "enabled=", remoteTrack.enabled,
          "muted=", remoteTrack.muted,
          "readyState=", remoteTrack.readyState,
        );
      }

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
      console.log("[createPeerConnection] connectionState", peerId, state);

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

    peerConnection.oniceconnectionstatechange = () => {
      console.log("[createPeerConnection] iceConnectionState", peerId, peerConnection.iceConnectionState);
    };

    return peerConnection;
  }, [cleanupPeer, sendSignal, startAudioLevelMonitor, updateParticipant]);

  const createOfferForPeer = React.useCallback(async (peerId: string, fromUserId: string) => {
    console.log("[createOfferForPeer] Iniciando para peer:", peerId, "desde:", fromUserId);
    if (!fromUserId) {
      console.warn("[createOfferForPeer] fromUserId no existe, abortando");
      return;
    }

    const peerConnection = createPeerConnection(peerId);
    if (peerConnection.localDescription) {
      console.log("[createOfferForPeer] Ya existe localDescription, abortando");
      return;
    }

    try {
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      console.log("[createOfferForPeer] Offer creada, estableciendo localDescription");

      await peerConnection.setLocalDescription(offer);
      console.log("[createOfferForPeer] LocalDescription establecida, enviando offer");

      sendSignal({
        event: "webrtc-offer",
        from: fromUserId,
        user_id: fromUserId,
        target: peerId,
        sdp: offer,
      });
      console.log("[createOfferForPeer] ✓ Offer enviada a:", peerId);
    } catch (err) {
      console.error("[createOfferForPeer] Error creando offer:", err);
    }
  }, [createPeerConnection, sendSignal]);

  const handleOffer = React.useCallback(async ({ from, sdp }: SignalSdpPayload, sessionUserId: string) => {
    console.log("[handleOffer] Offer recibida de:", from, "respondiendo como:", sessionUserId);
    if (!sessionUserId) {
      console.warn("[handleOffer] sessionUserId no existe");
      return;
    }

    try {
      const peerConnection = createPeerConnection(from);

      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log("[handleOffer] RemoteDescription establecida");
      
      const answer = await peerConnection.createAnswer();
      console.log("[handleOffer] Answer creada");
      
      await peerConnection.setLocalDescription(answer);
      console.log("[handleOffer] LocalDescription establecida");

      sendSignal({
        event: "webrtc-answer",
        from: sessionUserId,
        user_id: sessionUserId,
        target: from,
        sdp: answer,
      });
      console.log("[handleOffer] ✓ Answer enviada a:", from);
    } catch (err) {
      console.error("[handleOffer] Error:", err);
    }
  }, [createPeerConnection, sendSignal]);

  const handleAnswer = React.useCallback(async ({ from, sdp }: SignalSdpPayload) => {
    console.log("[handleAnswer] Answer recibida de:", from);
    const peerConnection = peerConnectionsRef.current.get(from);
    if (!peerConnection) {
      console.warn("[handleAnswer] No hay PeerConnection para:", from);
      return;
    }

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log("[handleAnswer] ✓ RemoteDescription establecida");
    } catch (err) {
      console.error("[handleAnswer] Error:", err);
    }
  }, []);

  const handleIceCandidate = React.useCallback(async ({ from, candidate }: SignalIcePayload) => {
    console.log("[handleIceCandidate] Candidato recibido de:", from);
    const peerConnection = peerConnectionsRef.current.get(from);
    if (!peerConnection) {
      console.warn("[handleIceCandidate] No hay PeerConnection para:", from);
      return;
    }

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("[handleIceCandidate] ✓ Candidato agregado");
    } catch (err) {
      console.error("[handleIceCandidate] Error:", err);
    }
  }, []);

  const leaveRoom = React.useCallback(async () => {
    setConnectionStatus("disconnected");
    setIsJoined(false);
    selfIdRef.current = "";
    setSelfId("");
    setParticipants([]);

    if (introduceIntervalRef.current !== null) {
      window.clearInterval(introduceIntervalRef.current);
      introduceIntervalRef.current = null;
    }

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
      audioElement.pause();
      if (audioElement.parentNode) {
        audioElement.parentNode.removeChild(audioElement);
      }
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
    console.log("[joinRoom] Iniciando función");
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
    console.log("[joinRoom] Estados iniciales configurados");

    try {
      console.log("[joinRoom] Antes de unlockPlayback");
      await unlockPlayback();
      console.log("[joinRoom] unlockPlayback completado");

      console.log("[joinRoom] Solicitando getUserMedia...");
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      console.log("[joinRoom] getUserMedia exitoso, stream obtenido:", localStream);

      localStreamRef.current = localStream;
      setIsMuted(false);

      localMonitorCleanupRef.current = startAudioLevelMonitor(localStream, (level) => {
        setLocalLevel(level);
      });

      const sessionUserId = normalizeUserId(safeDisplayName);
      selfIdRef.current = sessionUserId;
      setSelfId(sessionUserId);
      console.log("[joinRoom] sessionUserId generado:", sessionUserId);

      const encodedRoom = encodeURIComponent(safeRoomId);
      const encodedUser = encodeURIComponent(sessionUserId);
      const wsUrl = `${BACKEND_WS_BASE}/${encodedRoom}/${encodedUser}`;
      console.log("[joinRoom] Intentando conectar a WebSocket:", wsUrl);
      console.log("[joinRoom] WebSocket object creado, esperando eventos...");

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("[joinRoom] ✓ WebSocket abierto exitosamente");
        setConnectionStatus("connected");
        setIsJoined(true);

        sendSignal({
          event: "webrtc-introduce",
          from: sessionUserId,
          user_id: sessionUserId,
          displayName: safeDisplayName,
        });

        // Retry lightweight peer discovery to tolerate missed join events.
        introduceIntervalRef.current = window.setInterval(() => {
          sendSignal({
            event: "webrtc-introduce",
            from: sessionUserId,
            user_id: sessionUserId,
            displayName: safeDisplayName,
          });
        }, 4000);
      };

      socket.onclose = () => {
        console.log("[joinRoom] WebSocket cerrado");
        setConnectionStatus("disconnected");
      };

      socket.onerror = (event: Event) => {
        const errorMsg = "Error en conexión WebSocket";
        console.error("[joinRoom] ✗ Error WebSocket evento:", event);
        console.error("[joinRoom] ✗ Error message:", errorMsg);
        setErrorMessage(`Error conectando: ${errorMsg}. Revisa firewall, CORS, y que el backend esté disponible.`);
      };

      socket.onmessage = (event: MessageEvent) => {
        // Manejo de BYTES (audio from backend)
        if (event.data instanceof ArrayBuffer) {
          console.log("[joinRoom] Recibido ArrayBuffer (audio bytes)");
          try {
            const buffer = new Uint8Array(event.data);
            if (buffer.length < 2) return;

            // Parse frame: [user_id_length] + user_id + audio_bytes
            const userIdLength = buffer[0];
            if (userIdLength === 0 || buffer.length < 1 + userIdLength) return;

            const userIdBytes = buffer.slice(1, 1 + userIdLength);
            const userId = new TextDecoder().decode(userIdBytes);
            const audioBytes = buffer.slice(1 + userIdLength);

            console.log("[joinRoom] Audio recibido de:", userId, "bytes:", audioBytes.length);

            // El audio viene por WebRTC tracks, esto es solo logged como referencia
          } catch (err) {
            console.error("[joinRoom] Error procesando audio bytes:", err);
          }
          return;
        }

        // Manejo de TEXT (JSON signaling)
        console.log("[InterviewPage] Mensaje WebSocket recibido:", typeof event.data === "string" ? event.data.slice(0, 100) : event.data);
        
        if (typeof event.data !== "string") {
          return;
        }

        let payload: SignalingMessage | null = null;
        try {
          payload = JSON.parse(event.data) as SignalingMessage;
        } catch (e) {
          console.warn("[InterviewPage] No se pudo parsear payload:", event.data.slice(0, 100), e);
          return;
        }

        if (!payload || !payload.event) {
          return;
        }

        console.log("[InterviewPage] Evento de señalización:", payload.event, "de:", payload.from || payload.user_id);

        const senderId = payload.from || payload.user_id || "";
        if (senderId === sessionUserId) {
          return;
        }

        const isTargeted = !payload.target || payload.target === sessionUserId;
        if (!isTargeted) {
          console.log("[InterviewPage] Mensaje no dirigido a nosotros, ignorando.");
          return;
        }

        if (payload.event === "join" || payload.event === "user_joined" || payload.event === "webrtc-introduce") {
          if (!senderId) {
            return;
          }

          console.log("[InterviewPage] Peer incluido en sala:", senderId, "displayName:", payload.displayName);

          updateParticipant(senderId, (current) => ({
            socketId: senderId,
            displayName: payload?.displayName?.trim()
              ? payload.displayName.trim()
              : current?.displayName || normalizeUserLabel("", senderId),
            connected: true,
            level: current?.level || 0,
          }));

          // Deterministic initiator: smallest ID creates the offer.
          if (sessionUserId.localeCompare(senderId) < 0) {
            void createOfferForPeer(senderId, sessionUserId);
          }

          return;
        }

        if (payload.event === "webrtc-offer" && senderId && payload.sdp) {
          console.log("[InterviewPage] Offer recibida de:", senderId);
          void handleOffer({ from: senderId, sdp: payload.sdp }, sessionUserId);
          return;
        }

        if (payload.event === "webrtc-answer" && senderId && payload.sdp) {
          console.log("[InterviewPage] Answer recibida de:", senderId);
          void handleAnswer({ from: senderId, sdp: payload.sdp });
          return;
        }

        if (payload.event === "webrtc-ice-candidate" && senderId && payload.candidate) {
          console.log("[InterviewPage] ICE candidate recibida de:", senderId);
          void handleIceCandidate({ from: senderId, candidate: payload.candidate });
        }
      };
    } catch (error) {
      console.error("[joinRoom] ✗ Error en try-catch:", error);
      const fallback = "No fue posible conectarte a la sala. Revisa permisos de micrófono y vuelve a intentar.";
      const msg = error instanceof Error && error.message ? error.message : fallback;
      console.error("[joinRoom] ✗ Mensaje de error final:", msg);
      setErrorMessage(msg);
      await leaveRoom();
    } finally {
      console.log("[joinRoom] Finalizando joinRoom, setIsConnecting(false)");
      setIsConnecting(false);
    }
  }, [createOfferForPeer, displayName, handleAnswer, handleIceCandidate, handleOffer, leaveRoom, roomId, sendSignal, startAudioLevelMonitor, unlockPlayback, updateParticipant]);

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
      setErrorMessage("No se pudo copiar el Room ID automáticamente.");
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
                  Conecta varios participantes en tiempo real. Cada nuevo integrante se enlaza por WebRTC con todos los demás en la sala.
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
                {isMuted ? "Activar micrófono" : "Silenciar micrófono"}
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
                {isMuted ? "Micrófono silenciado" : "Micrófono activo"}
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
                  No hay participantes remotos aún. Comparte el Room ID y espera a que ingresen.
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
