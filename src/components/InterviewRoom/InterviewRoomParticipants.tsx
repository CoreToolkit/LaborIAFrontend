import React from "react";
import { UserRound } from "lucide-react";
import type { RemoteParticipant } from "@/hooks/useInterviewRoomAudioParticipants";

interface Props {
  localName: string;
  isMuted: boolean;
  localLevel: number;
  selfId: string;
  participants: RemoteParticipant[];
  roomId: string;
}

export function InterviewRoomParticipants({
  localName,
  isMuted,
  localLevel,
  selfId,
  participants,
  roomId,
}: Props) {
  return (
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
        <progress
          className="mt-4 h-2 w-full overflow-hidden rounded-full appearance-none [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-cyan-100 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-cyan-600 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-cyan-600"
          max={100}
          value={Math.min(100, Math.round(localLevel * 500))}
          aria-label="Nivel de audio local"
        />
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
            No hay participantes remotos aun. Comparte el Session Code y espera a que ingresen.
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

                  <progress
                    className={`mt-4 h-2 w-full overflow-hidden rounded-full appearance-none [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full ${
                      isSpeaking
                        ? "[&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500"
                        : "[&::-webkit-progress-value]:bg-cyan-500 [&::-moz-progress-bar]:bg-cyan-500"
                    }`}
                    max={100}
                    value={levelWidth}
                    aria-label={`Nivel de audio de ${participant.displayName}`}
                  />
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
  );
}
