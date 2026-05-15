import React from "react";
import { LogOut, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onBack: () => void;
}

export function InterviewRoomHeader({ onBack }: Props) {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-slate-900">LaborIA Entrevistas</span>
        </div>
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <LogOut className="h-4 w-4" />
          Volver al dashboard
        </Button>
      </div>
    </header>
  );
}
