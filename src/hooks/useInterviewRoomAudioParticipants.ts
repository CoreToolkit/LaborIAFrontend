import React from "react";
import { MAX_QUEUE_PER_SENDER, normalizeUserLabel } from "@/utils/interviewRoom";

export type RemoteParticipant = {
  socketId: string;
  displayName: string;
  connected: boolean;
  level: number;
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

export function useInterviewRoomAudioParticipants() {
  const [participants, setParticipants] = React.useState<RemoteParticipant[]>([]);
  const [localLevel, setLocalLevel] = React.useState(0);

  const senderPlayersRef = React.useRef<Map<string, SenderPlayer>>(new Map());
  const remoteLevelResetTimeoutsRef = React.useRef<Map<string, number>>(new Map());

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
      // Ignore endOfStream errors and continue cleanup.
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
          // Some browsers disallow changing mode; continue with default mode.
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

  const clearParticipantsAndAudio = React.useCallback(() => {
    setParticipants([]);
    setLocalLevel(0);

    remoteLevelResetTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    remoteLevelResetTimeoutsRef.current.clear();

    cleanupAllSenderPlayers();
  }, [cleanupAllSenderPlayers]);

  React.useEffect(() => {
    return () => {
      clearParticipantsAndAudio();
    };
  }, [clearParticipantsAndAudio]);

  return {
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
  };
}
