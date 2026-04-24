import React from "react";
import type { TTSAudioStatus } from "@/hooks/useTTSAudioPlayer";
import { getAccessToken } from "@/utils/session";
import { convertBlobToWav, mergeWavBlobs } from "@/utils/interviewRoom";

// ─── Constantes de grabación ────────────────────────────────────────────────
/** RMS por debajo del cual se considera silencio (≈ -40 dBFS). */
const SILENCE_THRESHOLD = 0.01;
/** Milisegundos de silencio continuo antes de detener la grabación. */
const SILENCE_DURATION_MS = 5_000;
/** Tiempo al inicio de la grabación donde el silencio no cuenta (el usuario puede estar pensando). */
const GRACE_PERIOD_MS = 3_000;
/** Cada cuántos milisegundos se guarda un segmento WAV en memoria. */
const SEGMENT_INTERVAL_MS = 5_000;

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
  backendHttpOriginRef: React.MutableRefObject<string>;
  roomId: string;
  activeRoundId: string | null;
  ttsStatus: TTSAudioStatus;
};

export function useGroupInterviewAnswerFlow({
  localStreamRef,
  activeRoundIdRef,
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
  /** Chunks crudos (webm) del segmento actual. */
  const answerChunksRef = React.useRef<Blob[]>([]);
  /** Segmentos WAV de 5 s acumulados en memoria. */
  const wavSegmentsRef = React.useRef<Blob[]>([]);
  /** Stream clonado para la grabación de respuesta. */
  const answerStreamRef = React.useRef<MediaStream | null>(null);

  // ─── Refs de timers / detección ─────────────────────────────────────────
  const autoRecordTimerRef = React.useRef<number | null>(null);
  const countdownIntervalRef = React.useRef<number | null>(null);
  const segmentIntervalRef = React.useRef<number | null>(null);
  const silenceMonitorRafRef = React.useRef<number | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);

  // ─── Refs de funciones (para acceso estable en closures) ────────────────
  const startRecordingFnRef = React.useRef<(() => void) | null>(null);
  const stopSubmitFnRef = React.useRef<(() => void) | null>(null);

  // ─── Limpieza completa de timers, RAF y stream ──────────────────────────
  const clearTimersAndStreams = React.useCallback(() => {
    if (autoRecordTimerRef.current !== null) {
      window.clearTimeout(autoRecordTimerRef.current);
      autoRecordTimerRef.current = null;
    }
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (segmentIntervalRef.current !== null) {
      window.clearInterval(segmentIntervalRef.current);
      segmentIntervalRef.current = null;
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

  // ─── startAnswerRecording ────────────────────────────────────────────────
  const startAnswerRecording = React.useCallback(() => {
    if (!localStreamRef.current) {
      return;
    }

    // Clonar stream para no interferir con la transmisión en sala
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
    wavSegmentsRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        answerChunksRef.current.push(event.data);
      }
    };

    recorder.start(250);
    answerRecorderRef.current = recorder;
    setIsRecording(true);

    // ── Detección de silencio via AnalyserNode + RAF ─────────────────────
    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    const source = audioCtx.createMediaStreamSource(clonedStream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.fftSize);
    let silenceAccumMs = 0;
    let graceRemaining = GRACE_PERIOD_MS;
    let lastTimestamp: number | null = null;

    const monitorSilence = (timestamp: number) => {
      // Si el contexto fue cerrado (cleanup), detener el loop
      if (!audioContextRef.current) {
        return;
      }

      const delta = lastTimestamp !== null ? timestamp - lastTimestamp : 16;
      lastTimestamp = timestamp;

      // Grace period: ignorar silencio los primeros segundos
      if (graceRemaining > 0) {
        graceRemaining -= delta;
        silenceMonitorRafRef.current = requestAnimationFrame(monitorSilence);
        return;
      }

      analyser.getByteTimeDomainData(dataArray);

      // Calcular RMS para detectar actividad de voz
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const norm = (dataArray[i] - 128) / 128;
        sumSquares += norm * norm;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);

      if (rms < SILENCE_THRESHOLD) {
        silenceAccumMs += delta;
        if (silenceAccumMs >= SILENCE_DURATION_MS) {
          // Silencio detectado: detener y enviar
          stopSubmitFnRef.current?.();
          return; // Salir del loop RAF
        }
      } else {
        silenceAccumMs = 0; // Voz detectada: resetear contador
      }

      silenceMonitorRafRef.current = requestAnimationFrame(monitorSilence);
    };

    silenceMonitorRafRef.current = requestAnimationFrame(monitorSilence);

    // ── Snapshot de segmento WAV cada SEGMENT_INTERVAL_MS ────────────────
    segmentIntervalRef.current = window.setInterval(() => {
      const chunks = answerChunksRef.current.splice(0); // tomar y vaciar
      if (chunks.length === 0) {
        return;
      }
      const segmentBlob = new Blob(chunks, { type: mimeType });
      // Convertir a WAV en background; si falla, el chunk se pierde pero
      // los demás segmentos siguen acumulándose.
      void convertBlobToWav(segmentBlob)
        .then((wavBlob) => {
          wavSegmentsRef.current.push(wavBlob);
        })
        .catch(() => undefined);
    }, SEGMENT_INTERVAL_MS);
  }, [localStreamRef]);

  // ─── stopAndSubmitAnswer ─────────────────────────────────────────────────
  const stopAndSubmitAnswer = React.useCallback(() => {
    // Detener monitoreo de silencio y snapshots
    if (silenceMonitorRafRef.current !== null) {
      cancelAnimationFrame(silenceMonitorRafRef.current);
      silenceMonitorRafRef.current = null;
    }
    if (segmentIntervalRef.current !== null) {
      window.clearInterval(segmentIntervalRef.current);
      segmentIntervalRef.current = null;
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

      // Chunks que quedaron después del último snapshot
      const remainingChunks = answerChunksRef.current.splice(0);
      answerRecorderRef.current = null;

      if (answerStreamRef.current) {
        answerStreamRef.current.getTracks().forEach((track) => track.stop());
        answerStreamRef.current = null;
      }

      setIsRecording(false);

      if (!roundId) {
        return;
      }

      // Convertir chunks restantes y agregar al final de los segmentos
      if (remainingChunks.length > 0) {
        try {
          const remainingBlob = new Blob(remainingChunks, { type: recorder.mimeType });
          const wavBlob = await convertBlobToWav(remainingBlob);
          wavSegmentsRef.current.push(wavBlob);
        } catch {
          // Si falla la conversión del último segmento, continuar con los que hay
        }
      }

      const segments = wavSegmentsRef.current.splice(0);
      if (segments.length === 0) {
        setSubmissionError("No se capturó audio. Asegúrate de hablar cerca del micrófono.");
        return;
      }

      // Unir todos los segmentos WAV en uno solo
      let finalWav: Blob;
      try {
        finalWav = await mergeWavBlobs(segments);
      } catch {
        setSubmissionError("Error al unir los segmentos de audio.");
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
        formData.append("audio_file", finalWav, "answer.wav");

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
  }, [activeRoundIdRef, backendHttpOriginRef, roomId]);

  // ─── Reset al salir de la sala ──────────────────────────────────────────
  const resetForLeave = React.useCallback(() => {
    const recorder = answerRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }

    answerRecorderRef.current = null;
    answerChunksRef.current = [];
    wavSegmentsRef.current = [];
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

  // ─── Polling de evaluación ───────────────────────────────────────────────
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

  // ─── Mantener refs de funciones siempre actualizadas ───────────────────
  React.useEffect(() => {
    startRecordingFnRef.current = startAnswerRecording;
    stopSubmitFnRef.current = stopAndSubmitAnswer;
  }, [startAnswerRecording, stopAndSubmitAnswer]);

  // ─── Reset al cambiar de ronda ──────────────────────────────────────────
  React.useEffect(() => {
    clearTimersAndStreams();

    setIsRecording(false);
    setIsSubmitting(false);
    setRecordingCountdown(null);
    setSubmissionError(null);
    setTranscription(null);
    setEvaluationResult(null);
    setEvaluationId(null);
    setIsEvaluating(false);
    answerChunksRef.current = [];
    wavSegmentsRef.current = [];
  }, [activeRoundId, clearTimersAndStreams]);

  // ─── Trigger automático cuando el TTS termina ───────────────────────────
  // Espera 5 s después de que ElevenLabs termina de hablar y luego graba.
  React.useEffect(() => {
    if (ttsStatus !== "ended" || !activeRoundId) {
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

  // ─── Cleanup al desmontar ────────────────────────────────────────────────
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
