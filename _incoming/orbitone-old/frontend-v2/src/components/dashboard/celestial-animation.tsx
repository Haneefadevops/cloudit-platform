import type { TimeOfDay } from "@/hooks/useTimeOfDay";

interface CelestialAnimationProps {
  timeOfDay: TimeOfDay;
  className?: string;
}

export function CelestialAnimation({ timeOfDay, className }: CelestialAnimationProps) {
  if (timeOfDay === "morning") {
    return (
      <svg
        viewBox="0 0 64 64"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        {/* Sky glow */}
        <circle cx="32" cy="32" r="28" className="fill-secondary/10 animate-pulse-slow" />
        {/* Sun */}
        <g className="origin-center animate-sun-rise">
          <circle cx="32" cy="44" r="10" className="fill-accent-2" />
          <circle cx="32" cy="44" r="14" className="fill-accent/20" />
          {/* Rays */}
          <g className="stroke-accent-2" strokeWidth="2" strokeLinecap="round">
            <line x1="32" y1="24" x2="32" y2="18" />
            <line x1="32" y1="64" x2="32" y2="70" />
            <line x1="12" y1="44" x2="6" y2="44" />
            <line x1="52" y1="44" x2="58" y2="44" />
            <line x1="18" y1="30" x2="14" y2="26" />
            <line x1="46" y1="30" x2="50" y2="26" />
            <line x1="18" y1="58" x2="14" y2="62" />
            <line x1="46" y1="58" x2="50" y2="62" />
          </g>
        </g>
      </svg>
    );
  }

  if (timeOfDay === "afternoon") {
    return (
      <svg
        viewBox="0 0 64 64"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <circle cx="32" cy="32" r="28" className="fill-secondary/10 animate-pulse-slow" />
        <g className="origin-center animate-sun-pulse">
          <circle cx="32" cy="32" r="10" className="fill-accent-2" />
          <circle cx="32" cy="32" r="16" className="fill-accent/20" />
          <circle cx="32" cy="32" r="22" className="fill-accent/10" />
        </g>
      </svg>
    );
  }

  if (timeOfDay === "evening") {
    return (
      <svg
        viewBox="0 0 64 64"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <circle cx="32" cy="32" r="28" className="fill-accent/10 animate-pulse-slow" />
        <g className="origin-center animate-sun-set">
          <circle cx="32" cy="28" r="10" className="fill-accent" />
          <circle cx="32" cy="28" r="14" className="fill-accent-2/30" />
          <g className="stroke-accent" strokeWidth="2" strokeLinecap="round">
            <line x1="32" y1="8" x2="32" y2="2" />
            <line x1="12" y1="28" x2="6" y2="28" />
            <line x1="52" y1="28" x2="58" y2="28" />
            <line x1="18" y1="14" x2="14" y2="10" />
            <line x1="46" y1="14" x2="50" y2="10" />
          </g>
        </g>
        {/* Horizon */}
        <rect x="4" y="48" width="56" height="4" rx="2" className="fill-accent/30" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="28" className="fill-secondary/10" />
      {/* Stars */}
      <circle cx="16" cy="18" r="1.5" className="fill-primary-foreground animate-twinkle" />
      <circle cx="48" cy="14" r="1.5" className="fill-primary-foreground animate-twinkle-delayed" />
      <circle cx="52" cy="36" r="1" className="fill-primary-foreground animate-twinkle" />
      <circle cx="14" cy="40" r="1" className="fill-primary-foreground animate-twinkle-delayed" />
      {/* Moon */}
      <g className="animate-moon-float">
        <circle cx="34" cy="32" r="10" className="fill-primary-foreground" />
        <circle cx="38" cy="30" r="8" className="fill-background" />
      </g>
    </svg>
  );
}
