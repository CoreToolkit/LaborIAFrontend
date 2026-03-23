import React from 'react';
import { Button } from '@/components/ui/button';

interface EmployabilityScoreProps {
  score?: number;
  technicalSkills?: number;
  softSkills?: number;
}

export function EmployabilityScore({
  score = 72,
  technicalSkills = 85,
  softSkills = 60,
}: EmployabilityScoreProps) {
  const safeTechnicalSkills = Math.max(0, Math.min(100, technicalSkills));
  const safeSoftSkills = Math.max(0, Math.min(100, softSkills));

  return (
    <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
      <h3 className="text-lg font-semibold">Score de Empleabilidad</h3>

      {/* Main Score */}
      <div className="mt-6 space-y-2">
        <div className="flex items-end gap-2">
          <span className="text-5xl font-bold">{score}</span>
          <span className="text-lg text-slate-400 mb-2">/ 100</span>
        </div>
        <p className="text-sm text-slate-400">
          Estás en el top 25% de candidatos con tu nivel de experiencia.
        </p>
      </div>

      {/* Skills breakdown */}
      <div className="mt-8 space-y-4">
        {/* Technical Skills */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-300">Habilidades Técnicas</span>
            <span className="font-semibold text-emerald-400">{technicalSkills}%</span>
          </div>
          <progress
            className="h-2 w-full overflow-hidden rounded-full appearance-none [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-emerald-400 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-emerald-400"
            max={100}
            value={safeTechnicalSkills}
            aria-label={`Habilidades Técnicas: ${technicalSkills}%`}
          />
        </div>

        {/* Soft Skills */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-300">Soft Skills</span>
            <span className="font-semibold text-blue-400">{softSkills}%</span>
          </div>
          <progress
            className="h-2 w-full overflow-hidden rounded-full appearance-none [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-blue-400 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-blue-400"
            max={100}
            value={safeSoftSkills}
            aria-label={`Soft Skills: ${softSkills}%`}
          />
        </div>
      </div>

      {/* CTA Button */}
      <Button className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white">
        Mejorar score
      </Button>
    </div>
  );
}
