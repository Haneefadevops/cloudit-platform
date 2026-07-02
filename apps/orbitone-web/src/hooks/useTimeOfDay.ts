import { useEffect, useMemo, useState } from "react";
import { getTimes } from "suncalc";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

interface TimeOfDayState {
  timeOfDay: TimeOfDay;
  greeting: string;
  currentTime: string;
  timezone: string;
  locationStatus: "loading" | "geolocation" | "fallback" | "error";
}

function getFallbackTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getGreeting(timeOfDay: TimeOfDay): string {
  switch (timeOfDay) {
    case "morning":
      return "Good morning";
    case "afternoon":
      return "Good afternoon";
    case "evening":
      return "Good evening";
    case "night":
      return "Good night";
  }
}

function formatTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function useTimeOfDay(): TimeOfDayState {
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  const [state, setState] = useState<TimeOfDayState>(() => {
    const now = new Date();
    const timeOfDay = getFallbackTimeOfDay(now.getHours());
    return {
      timeOfDay,
      greeting: getGreeting(timeOfDay),
      currentTime: formatTime(now, timezone),
      timezone,
      locationStatus: "loading",
    };
  });

  useEffect(() => {
    let cancelled = false;

    const compute = (now: Date, position?: GeolocationPosition) => {
      let timeOfDay: TimeOfDay;

      if (position) {
        const { latitude, longitude } = position.coords;
        const times = getTimes(now, latitude, longitude);
        const hour = now.getHours() + now.getMinutes() / 60;

        if (times.sunrise && times.sunset && times.dusk) {
          const sunriseHour =
            times.sunrise.getHours() + times.sunrise.getMinutes() / 60;
          const sunsetHour =
            times.sunset.getHours() + times.sunset.getMinutes() / 60;
          const duskHour = times.dusk.getHours() + times.dusk.getMinutes() / 60;

          if (hour >= sunriseHour && hour < 12) timeOfDay = "morning";
          else if (hour >= 12 && hour < sunsetHour) timeOfDay = "afternoon";
          else if (hour >= sunsetHour && hour < duskHour + 1) timeOfDay = "evening";
          else timeOfDay = "night";
        } else {
          timeOfDay = getFallbackTimeOfDay(now.getHours());
        }
      } else {
        timeOfDay = getFallbackTimeOfDay(now.getHours());
      }

      if (!cancelled) {
        setState({
          timeOfDay,
          greeting: getGreeting(timeOfDay),
          currentTime: formatTime(now, timezone),
          timezone,
          locationStatus: position ? "geolocation" : "fallback",
        });
      }
    };

    // Try geolocation once
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => compute(new Date(), position),
        () => compute(new Date()),
        { timeout: 5000, maximumAge: 3600_000 }
      );
    } else {
      compute(new Date());
    }

    const interval = setInterval(() => {
      // Recompute without re-fetching geolocation; timezone/daylight changes are handled by local time.
      compute(new Date());
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [timezone]);

  return state;
}
