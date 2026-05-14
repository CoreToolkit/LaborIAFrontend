import React from "react";
import type { TTSAudioStatus } from "@/hooks/useTTSAudioPlayer";
import type { AudioPlayerQuestion } from "@/components/AudioPlayer";
import { getAccessToken } from "@/utils/session";
import { convertBlobToWav } from "@/utils/interviewRoom";

// ─── Constantes de grabación ────────────────────────────────────────────────
/** RMS por debajo del cual se considera silencio.
 * 0.003 es permisivo para micrófonos móviles que capturan a menor ganancia.
 * En desktop el RMS al hablar suele ser > 0.02, en móvil puede ser ~0.005.
 */
const SILENCE_THRESHOLD = 0.01;
/** Milisegundos de silencio continuo antes de detener la grabación. */
const SILENCE_DURATION_MS = 5_000;
/** Tiempo al inicio de la grabación donde el silencio no cuenta. */
const GRACE_PERIOD_MS = 3_000;

export type EvaluationResult = {
  evaluation_id: string;
  status: string;
  score: number | null;
  feedback: string | null;
  transcription: string | null;
  score_breakdown: {
    correctness: number;
    completeness: number;
    clarity: number;
    examples: number;
  } | null;
};

type UseGroupInterviewAnswerFlowParams = {
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  activeRoundIdRef: React.MutableRefObject<string | null>;
  currentQuestionRef: React.MutableRefObject<AudioPlayerQuestion | null>;
  backendHttpOriginRef: React.MutableRefObject<string>;
  roomId: string;
  activeRoundId: string | null;
  ttsStatus: TTSAudioStatus;
};

export function useGroupInterviewAnswerFlow({
  localStreamRef,
  activeRoundIdRef,
  currentQuestionRef,
  backendHttpOriginRef,
  roomId,
  activeRoundId,
  ttsStatus,
}: UseGroupInterviewAnswerFlowParams) {
  const [isRecording, setIsRecording] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [recordingCountdown, setRecordingCountdown] = React.useState<number | null>(null);
  const [transcription, setTranscription] = React.useState<string | null>(null);
  const [evaluationResult, setEvaluationResult] = React.useState<EvaluationResult | null>(null);
  const [evaluationId, setEvaluationId] = React.useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  // ─── Refs de grabación ───────────────────────────────────────────────────
  const answerRecorderRef = React.useRef<MediaRecorder | null>(null);
  /**
   * Todos los chunks webm de la sesión de grabación.
   * IMPORTANTE: los chunks de WebM/Opus NO son independientes entre sí —
   * el primer chunk siempre contiene el initialization segment y los
   * siguientes están en delta. Por eso se acumulan todos aquí y se
   * convierten en un único WAV al final, en lugar de hacer mini-segmentos.
   */
  const answerChunksRef = React.useRef<Blob[]>([]);
  /** Stream clonado dedicado a la grabación de respuesta. */
  const answerStreamRef = React.useRef<MediaStream | null>(null);

  // ─── Refs de timers / detección de silencio ──────────────────────────────
  const autoRecordTimerRef = React.useRef<number | null>(null);
  const countdownIntervalRef = React.useRef<number | null>(null);
  const silenceMonitorRafRef = React.useRef<number | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);

  /** Último activeRoundId que disparó el reset. Evita limpiar chunks cuando
   * React re-renderiza con el mismo ID (p.ej. tras syncRoomState). */
  const lastResetRoundIdRef = React.useRef<string | null>(undefined as unknown as string | null);
  // ─── Refs de funciones (acceso estable en closures del RAF) ──────────────
  const startRecordingFnRef = React.useRef<(() => void) | null>(null);
  const stopSubmitFnRef = React.useRef<(() => void) | null>(null);

  // ─── Limpieza completa ────────────────────────────────────────────────────
  const clearTimersAndStreams = React.useCallback(() => {
    if (autoRecordTimerRef.current !== null) {
      window.clearTimeout(autoRecordTimerRef.current);
      autoRecordTimerRef.current = null;
    }
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (silenceMonitorRafRef.current !== null) {
      cancelAnimationFrame(silenceMonitorRafRef.current);
      silenceMonitorRafRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    if (answerStreamRef.current) {
      answerStreamRef.current.getTracks().forEach((track) => track.stop());
      answerStreamRef.current = null;
    }
  }, []);

  // ─── startAnswerRecording ─────────────────────────────────────────────────
  const startAnswerRecording = React.useCallback(() => {
    if (!localStreamRef.current) {
      return;
    }

    const clonedStream = localStreamRef.current.clone();
    if (answerStreamRef.current) {
      answerStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    answerStreamRef.current = clonedStream;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(clonedStream, { mimeType });
    answerChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        // Acumular TODOS los chunks en orden.
        // El primer chunk es el initialization segment de WebM y es
        // imprescindible para poder decodificar el audio al final.
        answerChunksRef.current.push(event.data);
      }
    };

    recorder.start(250);
    answerRecorderRef.current = recorder;
    setIsRecording(true);

    // ── Detección de silencio via AnalyserNode + RAF ─────────────────────
    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;

    // En móvil el AudioContext puede quedar en estado 'suspended' si no fue
    // creado dentro de un gesto directo del usuario. Intentamos resumirlo
    // de inmediato; en Android Chrome funciona, en iOS actúa como noop
    // (el fallback del RAF loop cubre ese caso).
    void audioCtx.resume().catch(() => undefined);

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    const source = audioCtx.createMediaStreamSource(clonedStream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.fftSize);
    let silenceAccumMs = 0;
    let graceRemaining = GRACE_PERIOD_MS;
    let lastTimestamp: number | null = null;

    const monitorSilence = (timestamp: number) => {
      if (!audioContextRef.current) {
        return;
      }

      // Si el AudioContext está suspendido (frecuente en mobile antes de
      // que el browser lo active), intentar resumirlo y no contar silencio.
      if (audioContextRef.current.state === "suspended") {
        void audioContextRef.current.resume().catch(() => undefined);
        silenceMonitorRafRef.current = requestAnimationFrame(monitorSilence);
        return;
      }

      // Capear delta a 200ms para evitar que el throttling del browser móvil
      // provoque un salto enorme en silenceAccumMs en un solo frame.
      const rawDelta = lastTimestamp !== null ? timestamp - lastTimestamp : 16;
      const delta = Math.min(rawDelta, 200);
      lastTimestamp = timestamp;

      // Grace period: no contar silencio durante los primeros segundos
      if (graceRemaining > 0) {
        graceRemaining -= delta;
        silenceMonitorRafRef.current = requestAnimationFrame(monitorSilence);
        return;
      }

      analyser.getByteTimeDomainData(dataArray);

      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const norm = (dataArray[i] - 128) / 128;
        sumSquares += norm * norm;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);

      if (rms < SILENCE_THRESHOLD) {
        silenceAccumMs += delta;
        if (silenceAccumMs >= SILENCE_DURATION_MS) {
          // Silencio sostenido detectado → detener y enviar
          stopSubmitFnRef.current?.();
          return; // Salir del loop RAF
        }
      } else {
        silenceAccumMs = 0; // Voz detectada → reiniciar contador
      }

      silenceMonitorRafRef.current = requestAnimationFrame(monitorSilence);
    };

    silenceMonitorRafRef.current = requestAnimationFrame(monitorSilence);
  }, [localStreamRef]);

  // ─── stopAndSubmitAnswer ──────────────────────────────────────────────────
  const stopAndSubmitAnswer = React.useCallback(() => {
    // Detener monitoreo de silencio
    if (silenceMonitorRafRef.current !== null) {
      cancelAnimationFrame(silenceMonitorRafRef.current);
      silenceMonitorRafRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    const recorder = answerRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.onstop = async () => {
      const roundId = activeRoundIdRef.current;

      // Tomar TODOS los chunks acumulados durante la grabación completa.
      // El primer chunk contiene el initialization segment de WebM sin el
      // cual los chunks posteriores no pueden decodificarse. Por eso NO
      // fragmentamos — todo se convierte de una sola vez.
      const allChunks = answerChunksRef.current.splice(0);
      answerRecorderRef.current = null;

      if (answerStreamRef.current) {
        answerStreamRef.current.getTracks().forEach((track) => track.stop());
        answerStreamRef.current = null;
      }

      setIsRecording(false);

      if (!roundId || allChunks.length === 0) {
        if (!roundId) return;
        setSubmissionError("No se capturó audio. Asegúrate de hablar cerca del micrófono.");
        return;
      }

      // Convertir el WebM completo a WAV en una sola operación
      let wavBlob: Blob;
      try {
        const fullWebmBlob = new Blob(allChunks, { type: recorder.mimeType });
        wavBlob = await convertBlobToWav(fullWebmBlob);
      } catch {
        setSubmissionError("Error al procesar el audio. Intenta de nuevo.");
        return;
      }

      const token = getAccessToken();
      if (!token) {
        return;
      }

      setSubmissionError(null);
      setIsSubmitting(true);

      try {
        const formData = new FormData();
        formData.append("round_id", roundId);
        formData.append("audio_file", wavBlob, "answer.wav");
        const targetSkill = currentQuestionRef.current?.targetSkill;
        if (targetSkill) formData.append("category", targetSkill);

        const response = await fetch(
          `${backendHttpOriginRef.current ?? ""}/api/group-sessions/${encodeURIComponent(roomId)}/answers/audio`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );

        if (!response.ok) {
          if (response.status === 422) {
            throw new Error("No se detectó voz en tu respuesta. Habla más cerca del micrófono e intenta de nuevo.");
          }
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as { evaluation_id: string; transcription: string };
        if (!data.evaluation_id) {
          throw new Error("El backend no retornó evaluation_id");
        }

        setTranscription(data.transcription ?? null);
        setEvaluationId(data.evaluation_id);
        setIsEvaluating(true);
      } catch (error) {
        setSubmissionError(error instanceof Error ? error.message : "Error al enviar audio");
      } finally {
        setIsSubmitting(false);
      }
    };

    recorder.stop();
  }, [activeRoundIdRef, backendHttpOriginRef, currentQuestionRef, roomId]);

  // ─── Reset al salir de la sala ────────────────────────────────────────────
  const resetForLeave = React.useCallback(() => {
    const recorder = answerRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }

    answerRecorderRef.current = null;
    answerChunksRef.current = [];
    clearTimersAndStreams();

    setIsRecording(false);
    setIsSubmitting(false);
    setRecordingCountdown(null);
    setSubmissionError(null);
    setTranscription(null);
    setEvaluationResult(null);
    setEvaluationId(null);
    setIsEvaluating(false);
  }, [clearTimersAndStreams]);

  // ─── Polling de evaluación ────────────────────────────────────────────────
  React.useEffect(() => {
    if (!evaluationId || !isEvaluating) {
      return;
    }

    const token = getAccessToken();
    if (!token) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `${backendHttpOriginRef.current ?? ""}/evaluations/evaluation/${evaluationId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as EvaluationResult;
        if (data.status === "completed" || data.status === "failed") {
          if (!cancelled) {
            setEvaluationResult(data);
            setIsEvaluating(false);
          }
        } else if (!cancelled) {
          setTimeout(() => {
            void poll();
          }, 3000);
        }
      } catch {
        if (!cancelled) {
          setIsEvaluating(false);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [backendHttpOriginRef, evaluationId, isEvaluating]);

  // ─── Mantener refs de funciones siempre actualizadas ─────────────────────
  React.useEffect(() => {
    startRecordingFnRef.current = startAnswerRecording;
    stopSubmitFnRef.current = stopAndSubmitAnswer;
  }, [startAnswerRecording, stopAndSubmitAnswer]);

  // ─── Reset al cambiar de ronda ────────────────────────────────────────────
  // Solo limpiamos cuando el ID de ronda cambia genuinamente.
  // Si React re-renderiza con el MISMO activeRoundId (p.ej. porque syncRoomState
  // llamó setActiveRoundId con el mismo valor), no borramos los chunks.
  React.useEffect(() => {
    if (activeRoundId === lastResetRoundIdRef.current) {
      return; // mismo ID → no es un cambio de ronda real
    }
    lastResetRoundIdRef.current = activeRoundId;

    clearTimersAndStreams();
    answerChunksRef.current = [];

    setIsRecording(false);
    setIsSubmitting(false);
    setRecordingCountdown(null);
    setSubmissionError(null);
    setTranscription(null);
    setEvaluationResult(null);
    setEvaluationId(null);
    setIsEvaluating(false);
  }, [activeRoundId, clearTimersAndStreams]);

  // ─── Trigger automático cuando el TTS termina ─────────────────────────────
  React.useEffect(() => {
    const isIntro = Boolean(currentQuestionRef.current?.isIntro);
    if (ttsStatus !== "ended" || !activeRoundId || isIntro) {
      if (autoRecordTimerRef.current !== null) {
        window.clearTimeout(autoRecordTimerRef.current);
        autoRecordTimerRef.current = null;
      }
      if (countdownIntervalRef.current !== null) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setRecordingCountdown(null);
      return;
    }

    let count = 5;
    setRecordingCountdown(count);

    countdownIntervalRef.current = window.setInterval(() => {
      count -= 1;
      setRecordingCountdown(count);
      if (count <= 0) {
        window.clearInterval(countdownIntervalRef.current!);
        countdownIntervalRef.current = null;
      }
    }, 1000);

    autoRecordTimerRef.current = window.setTimeout(() => {
      autoRecordTimerRef.current = null;
      setRecordingCountdown(null);
      if (!answerRecorderRef.current) {
        startRecordingFnRef.current?.();
      }
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
      setRecordingCountdown(null);
    };
  }, [ttsStatus, activeRoundId]);

  // ─── Cleanup al desmontar ─────────────────────────────────────────────────
  React.useEffect(() => {
    return () => {
      resetForLeave();
    };
  }, [resetForLeave]);

  return {
    isRecording,
    isSubmitting,
    recordingCountdown,
    transcription,
    evaluationResult,
    isEvaluating,
    submissionError,
    resetForLeave,
  };
}
