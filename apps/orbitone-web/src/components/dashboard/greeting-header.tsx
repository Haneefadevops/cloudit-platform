import { CelestialAnimation } from "./celestial-animation";
import { useTimeOfDay } from "@/hooks/useTimeOfDay";

interface GreetingHeaderProps {
  name?: string;
  showClock?: boolean;
}

export function GreetingHeader({ name, showClock = true }: GreetingHeaderProps) {
  const { greeting, currentTime, timezone, timeOfDay } = useTimeOfDay();
  const displayName = name?.trim() || "friend";

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="hidden h-14 w-14 shrink-0 sm:block">
          <CelestialAnimation timeOfDay={timeOfDay} className="h-full w-full" />
        </div>
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <span className="sm:hidden">
              <CelestialAnimation timeOfDay={timeOfDay} className="h-8 w-8" />
            </span>
            {greeting}, {displayName}
          </h1>
          <p className="mt-1 text-muted">
            Here is what is happening with your network today.
          </p>
        </div>
      </div>

      {showClock && (
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tracking-tight text-foreground">{currentTime}</p>
          <p className="text-xs text-muted">{timezone}</p>
        </div>
      )}
    </header>
  );
}
