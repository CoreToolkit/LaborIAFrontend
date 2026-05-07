import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Waves, Volume2, Mic, MicOff, LogOut } from "lucide-react";
import PrivateRoute from "@/components/PrivateRoute";
import BlurText from "@/components/BlurText";
import { Button } from "@/components/ui/button";
import { useIndividualInterview } from "@/hooks/useIndividualInterview";
import type { InterviewDifficulty } from "@/types/individualInterview";

const DIFFICULTY_LABELS: Record<InterviewDifficulty, string> = {
  adaptive: "Adaptativa",
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
};

const BREAKDOWN_LABELS: Record<string, string> = {
  correctness: "Corrección",
  completeness: "Completitud",
  clarity: "Claridad",
  examples: "Ejemplos",
};

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = clamped >= 75 ? "text-green-600" : clamped >= 50 ? "text-yellow-500" : "text-red-500";
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-5xl font-bold tabular-nums ${color}`}>{clamped}</span>
      <span className="text-xs text-slate-400 uppercase tracking-wide">/ 100</span>
    </div>
  );
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 75 ? "bg-green-400" : pct >= 50 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-slate-500 text-right shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        {/* eslint-disable-next-line react/forbid-component-props */}
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-xs text-slate-600 tabular-nums">{pct}</span>
    </div>
  );
}

function IndividualInterviewContent() {
  const router = useRouter();
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const {
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
  } = useIndividualInterview();

  // Auto-play TTS when URL is ready
  React.useEffect(() => {
    if (!ttsAudioUrl || !audioRef.current) return;
    audioRef.current.src = ttsAudioUrl;
    audioRef.current.play().catch(() => onTtsPlaybackBlocked());
  }, [ttsAudioUrl, onTtsPlaybackBlocked]);

  const handleEndInterview = () => {
    endInterview();
    if (session?.id) {
      void router.push(`/interview-report/${session.id}`);
    } else {
      void router.push("/progress");
    }
  };

  const isActiveStep = step !== "initializing" && step !== "idle" && step !== "error";
  const showQuestion = isActiveStep && currentQuestion;

  return (
    <>
      <Head>
        <title>Entrevista Individual - LaborIA</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Hidden audio element for TTS */}
      <audio ref={audioRef} onEnded={onTtsEnded} className="hidden" />

      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50 to-white">
        {/* Header */}
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <Mic className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-semibold text-slate-900">Entrevista Individual</span>
              {questionNumber > 0 && (
                <span className="ml-2 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  Pregunta {questionNumber}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleEndInterview} className="gap-2">
              <LogOut className="h-4 w-4" />
              Terminar entrevista
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

          {/* ── Initializing ── */}
          {step === "initializing" && <Spinner label="Preparando sesión..." />}

          {/* ── Error ── */}
          {step === "error" && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="text-sm font-medium text-red-600">{error}</p>
              <Button
                variant="destructive"
                className="mt-4"
                onClick={() => void generateNextQuestion()}
              >
                Reintentar
              </Button>
            </div>
          )}

          {/* ── Idle: setup + start ── */}
          {step === "idle" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Configura tu práctica</h2>
                <p className="text-sm text-slate-500 mt-1">
                  El sistema generará preguntas personalizadas según tu perfil y las leerá en voz alta.
                  Responde hablando — tu respuesta se graba automáticamente.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-500">
                  Skill a practicar
                  <span className="ml-1 font-normal text-slate-400">
                    (opcional — se elige automáticamente del perfil)
                  </span>
                </label>
                <input
                  type="text"
                  value={targetSkill}
                  onChange={(e) => setTargetSkill(e.target.value)}
                  placeholder="Ej: Python, SQL, React..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-500">Dificultad</label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(DIFFICULTY_LABELS) as InterviewDifficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`px-4 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        difficulty === d
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      {DIFFICULTY_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void generateNextQuestion()}
                className="w-full py-3 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all"
              >
                Iniciar entrevista
              </button>
            </div>
          )}

          {/* ── Generating ── */}
          {step === "generating" && <Spinner label="Generando pregunta..." />}

          {/* ── Active interview ── */}
          {showQuestion && (
            <div className="space-y-4">

              {/* Question card */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  Pregunta {questionNumber}
                  {currentQuestion.meta.target_skill && (
                    <span className="ml-2 text-blue-500">· {currentQuestion.meta.target_skill}</span>
                  )}
                </p>

                <BlurText
                  key={String(currentQuestion.savedId)}
                  text={currentQuestion.question}
                  delay={80}
                  animateBy="words"
                  direction="top"
                  className="text-base font-semibold text-slate-900 leading-relaxed"
                />

                {/* TTS status */}
                <div className="mt-4 flex items-center gap-2">
                  {ttsStatus === "loading" && (
                    <>
                      <div className="w-3.5 h-3.5 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-400">Generando audio...</span>
                    </>
                  )}
                  {ttsStatus === "playing" && (
                    <>
                      <Waves className="h-3.5 w-3.5 animate-pulse text-blue-500" />
                      <span className="text-xs font-medium text-blue-600">Reproduciendo pregunta...</span>
                      {/* Fallback manual play button */}
                      <button
                        type="button"
                        onClick={() => audioRef.current?.play().catch(() => undefined)}
                        className="ml-2 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                      >
                        <Volume2 className="h-3 w-3" />
                        Reproducir
                      </button>
                    </>
                  )}
                  {ttsStatus === "countdown" && recordingCountdown !== null && (
                    <>
                      <Mic className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-xs font-medium text-blue-600">
                        Grabando en {recordingCountdown}s...
                      </span>
                    </>
                  )}
                  {ttsStatus === "error" && (
                    <span className="text-xs text-slate-400">Audio no disponible</span>
                  )}
                </div>
              </section>

              {/* Recording */}
              {step === "recording" && (
                <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <span className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">Grabando tu respuesta</p>
                        <p className="text-xs text-slate-400">Se detiene automáticamente al detectar silencio</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={stopRecording}
                      disabled={!isRecording}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
                    >
                      <MicOff className="h-4 w-4" />
                      Detener
                    </button>
                  </div>
                  {micError && (
                    <p className="mt-3 text-xs text-red-500">{micError}</p>
                  )}
                </section>
              )}

              {/* Transcribing */}
              {step === "transcribing" && <Spinner label="Transcribiendo tu respuesta..." />}

              {/* Evaluating */}
              {step === "evaluating" && (
                <div className="space-y-4">
                  {transcription && (
                    <section className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-400 mb-1">Tu respuesta</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{transcription}</p>
                    </section>
                  )}
                  <Spinner label="Evaluando respuesta..." />
                </div>
              )}

              {/* Result */}
              {step === "result" && evaluationResult && (
                <div className="space-y-4">
                  {transcription && (
                    <section className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-400 mb-1">Tu respuesta</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{transcription}</p>
                    </section>
                  )}

                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-slate-700">Resultado</h2>
                      {evaluationResult.score !== null && (
                        <ScoreRing score={evaluationResult.score} />
                      )}
                    </div>

                    {evaluationResult.feedback && (
                      <p className="text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                        {evaluationResult.feedback}
                      </p>
                    )}

                    {evaluationResult.score_breakdown && (
                      <div className="space-y-2.5 border-t border-slate-100 pt-4">
                        <p className="text-xs font-medium text-slate-400 mb-3">Desglose</p>
                        {Object.entries(evaluationResult.score_breakdown).map(([key, val]) => (
                          <BreakdownBar
                            key={key}
                            label={BREAKDOWN_LABELS[key] ?? key}
                            value={val}
                          />
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => void generateNextQuestion()}
                      className="py-3 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all"
                    >
                      Siguiente pregunta
                    </button>
                    <button
                      type="button"
                      onClick={handleEndInterview}
                      className="py-3 text-sm font-medium bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Terminar y ver reporte
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </main>
      </div>
    </>
  );
}

export default function IndividualInterviewPage() {
  return (
    <PrivateRoute>
      <IndividualInterviewContent />
    </PrivateRoute>
  );
}
