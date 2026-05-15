import React from "react";
import { AudioLines, Copy, LogOut, Mic, MicOff, Plug, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  connectionStatus: "disconnected" | "connecting" | "connected";
  isSyncingState: boolean;
  displayName: string;
  onDisplayNameChange: (v: string) => void;
  roomId: string;
  onRoomIdChange: (v: string) => void;
  errorMessage: string | null;
  isJoined: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  activeRemoteCount: number;
  onJoinRoom: () => void;
  onLeaveRoom: () => void;
  onToggleMute: () => void;
  onCopyRoomId: () => void;
}

export function InterviewRoomConnectionPanel({
  connectionStatus,
  isSyncingState,
  displayName,
  onDisplayNameChange,
  roomId,
  onRoomIdChange,
  errorMessage,
  isJoined,
  isConnecting,
  isMuted,
  activeRemoteCount,
  onJoinRoom,
  onLeaveRoom,
  onToggleMute,
  onCopyRoomId,
}: Props) {
  return (
    <>
      <section className="mb-6 rounded-2xl border border-cyan-100 bg-linear-to-r from-cyan-700 to-blue-700 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Sala de entrevista por audio</h1>
            <p className="mt-2 text-sm text-cyan-50">
              Todos los participantes publican su audio al servidor y se distribuye por broadcast a los demas usuarios de la sala.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
            <Plug className="h-3.5 w-3.5" />
            {connectionStatus === "connected" && isSyncingState && "Re-sincronizando sala..."}
            {connectionStatus === "connected" && !isSyncingState && "Conectado"}
            {connectionStatus === "connecting" && "Conectando..."}
            {connectionStatus === "disconnected" && "Desconectado"}
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Tu nombre
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(event) => onDisplayNameChange(event.target.value)}
                  placeholder="Ej: Camila Rojas"
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                />
              </div>
              <div>
                <label htmlFor="roomId" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Session Code
                </label>
                <div className="flex gap-2">
                  <input
                    id="roomId"
                    type="text"
                    value={roomId}
                    onChange={(event) => onRoomIdChange(event.target.value)}
                    placeholder="Ej: ABCD1234 (vacío para crear uno nuevo)"
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                  />
                  <Button type="button" variant="outline" onClick={onCopyRoomId} className="gap-1.5">
                    <Copy className="h-4 w-4" />
                    Copiar
                  </Button>
                </div>
              </div>
            </div>

            {errorMessage && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4 xl:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Panel rápido</p>
            <div className="mt-3 space-y-2">
              {!isJoined ? (
                <Button
                  type="button"
                  className="h-10 w-full gap-2 bg-cyan-600 hover:bg-cyan-700"
                  onClick={onJoinRoom}
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
                  onClick={onLeaveRoom}
                >
                  <LogOut className="h-4 w-4" />
                  Salir de la sala
                </Button>
              )}

              <Button type="button" variant="outline" onClick={onToggleMute} disabled={!isJoined} className="h-10 w-full gap-2">
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isMuted ? "Activar microfono" : "Silenciar microfono"}
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-medium text-cyan-700">
                <Users className="mr-1 inline h-3.5 w-3.5" />
                Participantes: {activeRemoteCount}
              </span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
