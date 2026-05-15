import React from "react";
import { AudioPlayer, type AudioPlayerQuestion } from "@/components/AudioPlayer";
import { NoiseBackground } from "@/components/ui/noise-background";
import type { TTSAudioStatus } from "@/hooks/useTTSAudioPlayer";
import type { GroupInterviewAction } from "@/services/groupInterviewRoomService";

interface Props {
  sessionStatus: string;
  activeRoundIndex: number | null;
  totalRounds: number;
  activeRoundId: string | null;
  isJoined: boolean;
  isHost: boolean;
  startDisabled: boolean;
  nextDisabled: boolean;
  closeDisabled: boolean;
  onHostAction: (action: GroupInterviewAction) => void;
  activeQuestion: AudioPlayerQuestion;
  accessToken: string | null;
  ttsStatus: TTSAudioStatus | undefined;
}

export function InterviewRoomSessionPanel({
  sessionStatus,
  activeRoundIndex,
  totalRounds,
  activeRoundId,
  isJoined,
  isHost,
  startDisabled,
  nextDisabled,
  closeDisabled,
  onHostAction,
  activeQuestion,
  accessToken,
  ttsStatus,
}: Props) {
  return (
    <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado de sesión</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
            Estado: {sessionStatus}
          </span>
          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
            Ronda: {activeRoundIndex ?? "--"}
          </span>
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Total: {totalRounds}
          </span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            ID: {activeRoundId || "--"}
          </span>
        </div>

        {isJoined && isHost ? (
          <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">Controles host</p>
            <NoiseBackground
              containerClassName="w-full rounded-xl"
              gradientColors={[
                "rgb(14, 116, 244)",
                "rgb(37, 99, 235)",
                "rgb(6, 182, 212)",
              ]}
            >
              <button
                type="button"
                onClick={() => onHostAction("start")}
                disabled={startDisabled}
                className="h-10 w-full cursor-pointer rounded-xl bg-linear-to-r from-blue-50 via-cyan-50 to-white px-4 py-2 text-sm font-semibold text-blue-900 shadow-[0px_2px_0px_0px_var(--color-slate-50)_inset,0px_0.5px_1px_0px_var(--color-blue-300)] transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Iniciar entrevista
              </button>
            </NoiseBackground>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <NoiseBackground
                containerClassName="w-full rounded-xl"
                gradientColors={[
                  "rgb(14, 116, 244)",
                  "rgb(37, 99, 235)",
                  "rgb(6, 182, 212)",
                ]}
              >
                <button
                  type="button"
                  onClick={() => onHostAction("next")}
                  disabled={nextDisabled}
                  className="h-9 w-full cursor-pointer rounded-xl bg-linear-to-r from-blue-50 via-cyan-50 to-white px-3 py-2 text-sm font-semibold text-blue-900 shadow-[0px_2px_0px_0px_var(--color-slate-50)_inset,0px_0.5px_1px_0px_var(--color-blue-300)] transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente ronda
                </button>
              </NoiseBackground>

              <NoiseBackground
                containerClassName="w-full rounded-xl"
                gradientColors={[
                  "rgb(239, 68, 68)",
                  "rgb(248, 113, 113)",
                  "rgb(252, 165, 165)",
                ]}
              >
                <button
                  type="button"
                  onClick={() => onHostAction("close")}
                  disabled={closeDisabled}
                  className="h-9 w-full cursor-pointer rounded-xl bg-linear-to-r from-red-50 via-red-50 to-rose-50 px-3 py-2 text-sm font-semibold text-red-900 shadow-[0px_2px_0px_0px_var(--color-red-50)_inset,0px_0.5px_1px_0px_var(--color-red-300)] transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Finalizar entrevista
                </button>
              </NoiseBackground>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Los controles de ronda están disponibles solo para el host conectado.
          </p>
        )}
      </aside>

      <div className="xl:col-span-8">
        <AudioPlayer question={activeQuestion} authToken={accessToken} ttsStatus={ttsStatus} />
      </div>
    </section>
  );
}
