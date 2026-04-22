import React from "react";
import { motion } from "motion/react";

type BlurStep = {
  filter?: string;
  opacity?: number;
  y?: number;
};

type BlurFrom = {
  filter?: string;
  opacity?: number;
  y?: number;
};

type BlurTextProps = {
  text: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "characters";
  direction?: "top" | "bottom";
  threshold?: number;
  rootMargin?: string;
  animationFrom?: BlurFrom;
  animationTo?: BlurStep[];
  easing?: (t: number) => number;
  onAnimationComplete?: () => void;
  stepDuration?: number;
};

const buildKeyframes = (from: BlurFrom, steps: BlurStep[]) => {
  const keys = new Set<string>([
    ...Object.keys(from),
    ...steps.flatMap((step) => Object.keys(step)),
  ]);

  const keyframes: Record<string, Array<string | number | undefined>> = {};
  keys.forEach((key) => {
    keyframes[key] = [
      from[key as keyof BlurFrom],
      ...steps.map((step) => step[key as keyof BlurStep]),
    ];
  });

  return keyframes;
};

export default function BlurText({
  text = "",
  delay = 200,
  className = "",
  animateBy = "words",
  direction = "top",
  threshold = 0.1,
  rootMargin = "0px",
  animationFrom,
  animationTo,
  easing = (t) => t,
  onAnimationComplete,
  stepDuration = 0.35,
}: BlurTextProps) {
  const elements = React.useMemo(
    () => (animateBy === "words" ? text.split(" ") : text.split("")),
    [animateBy, text],
  );

  const [inView, setInView] = React.useState(false);
  const ref = React.useRef<HTMLParagraphElement | null>(null);

  React.useEffect(() => {
    if (!ref.current) {
      return;
    }

    const target = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(target);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const defaultFrom = React.useMemo<BlurFrom>(
    () =>
      direction === "top"
        ? { filter: "blur(10px)", opacity: 0, y: -50 }
        : { filter: "blur(10px)", opacity: 0, y: 50 },
    [direction],
  );

  const defaultTo = React.useMemo<BlurStep[]>(
    () => [
      {
        filter: "blur(5px)",
        opacity: 0.5,
        y: direction === "top" ? 5 : -5,
      },
      { filter: "blur(0px)", opacity: 1, y: 0 },
    ],
    [direction],
  );

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots = animationTo ?? defaultTo;

  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from(
    { length: stepCount },
    (_, index) => (stepCount === 1 ? 0 : index / (stepCount - 1)),
  );

  return (
    <p ref={ref} className={`flex flex-wrap ${className}`.trim()}>
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);

        return (
          <motion.span
            className="inline-block will-change-[transform,filter,opacity]"
            key={`${segment}-${index}`}
            initial={fromSnapshot}
            animate={inView ? (animateKeyframes as any) : fromSnapshot}
            transition={{
              duration: totalDuration,
              times,
              delay: (index * delay) / 1000,
              ease: easing,
            }}
            onAnimationComplete={index === elements.length - 1 ? onAnimationComplete : undefined}
          >
            {segment === " " ? "\u00A0" : segment}
            {animateBy === "words" && index < elements.length - 1 && "\u00A0"}
          </motion.span>
        );
      })}
    </p>
  );
}
