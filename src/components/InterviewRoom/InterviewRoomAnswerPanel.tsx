import React from "react";
import { AudioLines } from "lucide-react";
import type { AudioPlayerQuestion } from "@/components/AudioPlayer";
import type { EvaluationResult } from "@/hooks/useGroupInterviewAnswerFlow";

interface Props {
  activeRoundIndex: number | null;
  currentQuestion: AudioPlayerQuestion | null;
  recordingCountdown: number | null;
  isRecording: boolean;
  isSubmitting: boolean;
  isEvaluating: boolean;
  submissionError: string | null;
  transcription: string | null;
  evaluationResult: EvaluationResult | null;
}

export function InterviewRoomAnswerPanel({
  activeRoundIndex,
  currentQuestion,
  recordingCountdown,
  isRecording,
  isSubmitting,
  isEvaluating,
  submissionError,
  transcription,
  evaluationResult,
}: Props) {
  return (
    <section className="grid grid-cols-1 gap-4">
      <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-rose-800">
          <AudioLines className="h-4 w-4" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Ronda {(activeRoundIndex ?? 0) + 1} — Tu respuesta
          </h2>
        </div>
        {currentQuestion && (
          <p className="mb-4 text-sm text-rose-700">{currentQuestion.text}</p>
        )}
        {recordingCountdown !== null && !isRecording && (
          <p className="mb-2 text-sm font-medium text-rose-600">
            Grabación automática en {recordingCountdown}s…
          </p>
        )}
        {isRecording && (
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
            <p className="text-sm font-medium text-rose-700">Grabando tu respuesta…</p>
          </div>
        )}
        {isSubmitting && (
          <p className="mt-3 text-sm text-rose-600">Enviando audio…</p>
        )}
        {isEvaluating && !isSubmitting && (
          <p className="mt-3 text-sm text-rose-600">Evaluando respuesta…</p>
        )}
        {submissionError && (
          <p className="mt-3 text-sm font-medium text-red-600">Error: {submissionError}</p>
        )}
        {transcription && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Tu respuesta</p>
            <p className="mt-0.5 text-sm text-rose-800 italic">&quot;{transcription}&quot;</p>
          </div>
        )}
        {evaluationResult && (
          <div className="mt-2 rounded-xl border border-rose-300 bg-white p-3 space-y-2">
            <p className="text-sm font-semibold text-rose-800">
              Puntuación: {evaluationResult.score ?? "—"}
            </p>
            {evaluationResult.feedback && (
              <p className="text-sm text-rose-700">{evaluationResult.feedback}</p>
            )}
          </div>
        )}
      </article>
    </section>
  );
}
