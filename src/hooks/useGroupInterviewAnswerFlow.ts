import React from "react";
import type { TTSAudioStatus } from "@/hooks/useTTSAudioPlayer";
import { getAccessToken } from "@/utils/session";
import { convertBlobToWav } from "@/utils/interviewRoom";

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

  const answerRecorderRef = React.useRef<MediaRecorder | null>(null);
  const answerChunksRef = React.useRef<Blob[]>([]);
  const autoRecordTimerRef = React.useRef<number | null>(null);
  const countdownIntervalRef = React.useRef<number | null>(null);
  const startRecordingFnRef = React.useRef<(() => void) | null>(null);
  const stopSubmitFnRef = React.useRef<(() => void) | null>(null);
  const recordingDurationTimerRef = React.useRef<number | null>(null);
  const answerStreamRef = React.useRef<MediaStream | null>(null);

  const clearTimersAndStreams = React.useCallback(() => {
    if (autoRecordTimerRef.current !== null) {
      window.clearTimeout(autoRecordTimerRef.current);
      autoRecordTimerRef.current = null;
    }

    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (recordingDurationTimerRef.current !== null) {
      window.clearTimeout(recordingDurationTimerRef.current);
      recordingDurationTimerRef.current = null;
    }

    if (answerStreamRef.current) {
      answerStreamRef.current.getTracks().forEach((track) => track.stop());
      answerStreamRef.current = null;
    }
  }, []);

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
        answerChunksRef.current.push(event.data);
      }
    };

    recorder.start(250);
    answerRecorderRef.current = recorder;
    setIsRecording(true);

    recordingDurationTimerRef.current = window.setTimeout(() => {
      recordingDurationTimerRef.current = null;
      stopSubmitFnRef.current?.();
    }, 10000);
  }, [localStreamRef]);

  const stopAndSubmitAnswer = React.useCallback(() => {
    const recorder = answerRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    if (recordingDurationTimerRef.current !== null) {
      window.clearTimeout(recordingDurationTimerRef.current);
      recordingDurationTimerRef.current = null;
    }

    recorder.onstop = async () => {
      const roundId = activeRoundIdRef.current;
      const blob = new Blob(answerChunksRef.current, { type: recorder.mimeType });
      answerRecorderRef.current = null;
      answerChunksRef.current = [];

      if (answerStreamRef.current) {
        answerStreamRef.current.getTracks().forEach((track) => track.stop());
        answerStreamRef.current = null;
      }

      setIsRecording(false);
      if (!roundId) {
        return;
      }

      const wavBlob = await convertBlobToWav(blob);
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

  React.useEffect(() => {
    startRecordingFnRef.current = startAnswerRecording;
    stopSubmitFnRef.current = stopAndSubmitAnswer;
  }, [startAnswerRecording, stopAndSubmitAnswer]);

  React.useEffect(() => {
    if (recordingDurationTimerRef.current !== null) {
      window.clearTimeout(recordingDurationTimerRef.current);
      recordingDurationTimerRef.current = null;
    }

    setIsRecording(false);
    setIsSubmitting(false);
    setRecordingCountdown(null);
    setSubmissionError(null);
    setTranscription(null);
    setEvaluationResult(null);
    setEvaluationId(null);
    setIsEvaluating(false);
  }, [activeRoundId]);

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
    startAnswerRecording,
    stopAndSubmitAnswer,
    resetForLeave,
  };
}
