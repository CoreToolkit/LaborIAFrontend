import React from "react";
import { getAccessToken } from "@/utils/session";
import { generateInterviewQuestionAudio } from "@/services/interviewService";
import {
  createSession,
  generateQuestion,
  saveQuestion,
  transcribeAudio,
  submitAnswer,
  pollEvaluation,
} from "@/services/individualInterviewService";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import type {
  IndividualSession,
  GeneratedQuestion,
  InterviewDifficulty,
  IndividualEvaluationResult,
} from "@/types/individualInterview";

export type IndividualInterviewStep =
  | "initializing"
  | "idle"
  | "generating"
  | "question"
  | "recording"
  | "transcribing"
  | "evaluating"
  | "result"
  | "error";

export type TtsStatus = "loading" | "playing" | "countdown" | "ended" | "error" | "idle";

export interface CurrentQuestion extends GeneratedQuestion {
  savedId: number;
}

export interface UseIndividualInterviewResult {
  step: IndividualInterviewStep;
  session: IndividualSession | null;
  targetSkill: string;
  setTargetSkill: (v: string) => void;
  difficulty: InterviewDifficulty;
  setDifficulty: (v: InterviewDifficulty) => void;
  currentQuestion: CurrentQuestion | null;
  questionNumber: number;
  ttsAudioUrl: string | null;
  ttsStatus: TtsStatus;
  recordingCountdown: number | null;
  transcription: string | null;
  evaluationResult: IndividualEvaluationResult | null;
  error: string | null;
  isRecording: boolean;
  micError: string | null;
  onTtsEnded: () => void;
  onTtsPlaybackBlocked: () => void;
  generateNextQuestion: () => Promise<void>;
  stopRecording: () => void;
  endInterview: () => void;
}

const base64ToObjectUrl = (audioBase64: string, mimeType: string | null): string => {
  const normalized = audioBase64.trim();
  const dataUrlMatch = normalized.match(/^data:(.+?);base64,(.+)$/);
  const base64Data = dataUrlMatch ? dataUrlMatch[2] ?? normalized : normalized;
  const mime = (dataUrlMatch ? dataUrlMatch[1] : null) ?? mimeType ?? "audio/mpeg";
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
};

export function useIndividualInterview(): UseIndividualInterviewResult {
  const [step, setStep] = React.useState<IndividualInterviewStep>("initializing");
  const [session, setSession] = React.useState<IndividualSession | null>(null);
  const [targetSkill, setTargetSkill] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<InterviewDifficulty>("adaptive");
  const [currentQuestion, setCurrentQuestion] = React.useState<CurrentQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = React.useState(0);
  const [ttsAudioUrl, setTtsAudioUrl] = React.useState<string | null>(null);
  const [ttsStatus, setTtsStatus] = React.useState<TtsStatus>("idle");
  const [recordingCountdown, setRecordingCountdown] = React.useState<number | null>(null);
  const [transcription, setTranscription] = React.useState<string | null>(null);
  const [evaluationResult, setEvaluationResult] = React.useState<IndividualEvaluationResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const previousQuestionsRef = React.useRef<string[]>([]);
  const sessionRef = React.useRef<IndividualSession | null>(null);
  const currentQuestionRef = React.useRef<CurrentQuestion | null>(null);
  const ttsUrlRef = React.useRef<string | null>(null);
  const countdownIntervalRef = React.useRef<number | null>(null);
  const autoRecordTimerRef = React.useRef<number | null>(null);
  const startRecordingRef = React.useRef<(() => Promise<void>) | null>(null);

  React.useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  const clearCountdownTimers = React.useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (autoRecordTimerRef.current !== null) {
      window.clearTimeout(autoRecordTimerRef.current);
      autoRecordTimerRef.current = null;
    }
    setRecordingCountdown(null);
  }, []);

  const revokeTtsUrl = React.useCallback(() => {
    if (ttsUrlRef.current) {
      URL.revokeObjectURL(ttsUrlRef.current);
      ttsUrlRef.current = null;
    }
  }, []);

  // ─── Session init ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setError("Sesión expirada. Inicia sesión nuevamente.");
      setStep("error");
      return;
    }
    createSession(token)
      .then((s) => {
        setSession(s);
        sessionRef.current = s;
        setStep("idle");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "No se pudo iniciar la sesión.");
        setStep("error");
      });
  }, []);

  // ─── Start countdown → auto-record ────────────────────────────────────────
  const startCountdown = React.useCallback(() => {
    clearCountdownTimers();
    setTtsStatus("countdown");
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
      setStep("recording");
      void startRecordingRef.current?.();
    }, 5000);
  }, [clearCountdownTimers]);

  // ─── TTS ended callback (called by <audio> onEnded) ───────────────────────
  const onTtsEnded = React.useCallback(() => {
    setTtsStatus("ended");
    startCountdown();
  }, [startCountdown]);

  // ─── Fallback when autoplay is blocked ────────────────────────────────────
  const onTtsPlaybackBlocked = React.useCallback(() => {
    // Stay on "playing" state so user sees a manual play button
    setTtsStatus("playing");
  }, []);

  // ─── WAV complete → transcribe → submit → poll ────────────────────────────
  const handleWavComplete = React.useCallback(async (wavBlob: Blob) => {
    const token = getAccessToken();
    const question = currentQuestionRef.current;
    if (!token || !question) return;

    setStep("transcribing");
    setError(null);

    try {
      const text = await transcribeAudio(token, wavBlob);
      setTranscription(text);

      setStep("evaluating");
      const { evaluation_id } = await submitAnswer(token, {
        question_id: question.savedId,
        user_answer_text: text,
      });

      let cancelled = false;
      const poll = async () => {
        try {
          const result = await pollEvaluation(token, evaluation_id);
          if (cancelled) return;
          if (result.status === "completed" || result.status === "failed") {
            setEvaluationResult(result);
            setStep("result");
          } else {
            setTimeout(() => void poll(), 3000);
          }
        } catch (err: unknown) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "No se pudo obtener el resultado.");
            setStep("error");
          }
        }
      };
      void poll();
      return () => { cancelled = true; };
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar la respuesta.");
      setStep("error");
    }
  }, []);

  const { isRecording, micError, startRecording, stopRecording } = useAudioRecorder({
    onComplete: handleWavComplete,
  });

  React.useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  // ─── Generate question + TTS ──────────────────────────────────────────────
  const generateNextQuestion = React.useCallback(async () => {
    const token = getAccessToken();
    const s = sessionRef.current;
    if (!token || !s) return;

    clearCountdownTimers();
    revokeTtsUrl();

    setStep("generating");
    setError(null);
    setTranscription(null);
    setEvaluationResult(null);
    setTtsAudioUrl(null);
    setTtsStatus("idle");

    try {
      const generated = await generateQuestion(token, {
        session_id: s.id,
        target_skill: targetSkill.trim() || undefined,
        difficulty,
        previous_questions: previousQuestionsRef.current,
      });

      const saved = await saveQuestion(token, {
        question_text: generated.question,
        interview_session_id: s.id,
        category: generated.meta.target_skill,
        difficulty: generated.meta.difficulty,
      });

      previousQuestionsRef.current = [...previousQuestionsRef.current, generated.question];
      const next: CurrentQuestion = { ...generated, savedId: saved.id };
      setCurrentQuestion(next);
      setQuestionNumber((n) => n + 1);
      setStep("question");

      // Generate TTS
      setTtsStatus("loading");
      try {
        const audio = await generateInterviewQuestionAudio({ text: generated.question }, token);
        const url = base64ToObjectUrl(audio.audioBase64, audio.mimeType);
        ttsUrlRef.current = url;
        setTtsAudioUrl(url);
        setTtsStatus("playing");
      } catch {
        // TTS failed — skip to countdown so interview can continue
        setTtsStatus("error");
        startCountdown();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo generar la pregunta.");
      setStep("error");
    }
  }, [clearCountdownTimers, difficulty, revokeTtsUrl, startCountdown, targetSkill]);

  const endInterview = React.useCallback(() => {
    clearCountdownTimers();
    revokeTtsUrl();
  }, [clearCountdownTimers, revokeTtsUrl]);

  React.useEffect(
    () => () => {
      clearCountdownTimers();
      revokeTtsUrl();
    },
    [clearCountdownTimers, revokeTtsUrl]
  );

  return {
    step,
    session,
    targetSkill,
    setTargetSkill,
    difficulty,
    setDifficulty,
    currentQuestion,
    questionNumber,
    ttsAudioUrl,
    ttsStatus,
    recordingCountdown,
    transcription,
    evaluationResult,
    error,
    isRecording,
    micError,
    onTtsEnded,
    onTtsPlaybackBlocked,
    generateNextQuestion,
    stopRecording,
    endInterview,
  };
}
