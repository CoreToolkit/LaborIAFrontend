import React from "react";
import { cn } from "@/utils/cn";

type NoiseBackgroundProps = {
  children: React.ReactNode;
  containerClassName?: string;
  className?: string;
  gradientColors?: string[];
};

const DEFAULT_COLORS = [
  "rgb(8, 145, 178)",
  "rgb(37, 99, 235)",
  "rgb(59, 130, 246)",
];

const GRADIENT_PRESETS: Record<string, string> = {
  "rgb(8, 145, 178)|rgb(37, 99, 235)|rgb(59, 130, 246)":
    "bg-[linear-gradient(120deg,#0891b2,#2563eb,#3b82f6)]",
  "rgb(14, 116, 244)|rgb(37, 99, 235)|rgb(6, 182, 212)":
    "bg-[linear-gradient(120deg,#0e74f4,#2563eb,#06b6d4)]",
  "rgb(255, 100, 150)|rgb(100, 150, 255)|rgb(255, 200, 100)":
    "bg-[linear-gradient(120deg,#ff6496,#6496ff,#ffc864)]",
  "rgb(239, 68, 68)|rgb(248, 113, 113)|rgb(252, 165, 165)":
    "bg-[linear-gradient(120deg,#ef4444,#f87171,#fca5a5)]",
};

const NOISE_LAYER_CLASS = "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.22'/%3E%3C/svg%3E\")] bg-[length:140px_140px]";

export function NoiseBackground({
  children,
  containerClassName,
  className,
  gradientColors = DEFAULT_COLORS,
}: NoiseBackgroundProps) {
  const safeColors = gradientColors.length >= 2 ? gradientColors : DEFAULT_COLORS;
  const gradientKey = safeColors.join("|");
  const gradientClass = GRADIENT_PRESETS[gradientKey] || GRADIENT_PRESETS[DEFAULT_COLORS.join("|")];

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl p-[1.5px]",
        gradientClass,
        containerClassName,
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 opacity-35 mix-blend-overlay", NOISE_LAYER_CLASS)} />
      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
}
