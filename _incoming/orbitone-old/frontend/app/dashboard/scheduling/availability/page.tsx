"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/empty-states";
import type {
  AvailabilityExceptionInput,
  AvailabilityRuleInput,
  SchedulingAvailability,
} from "@/lib/contracts";
import { Plus, Trash2, AlertCircle } from "lucide-react";

const dayLabels = [
  { dayOfWeek: 1, label: "Monday" },
  { dayOfWeek: 2, label: "Tuesday" },
  { dayOfWeek: 3, label: "Wednesday" },
  { dayOfWeek: 4, label: "Thursday" },
  { dayOfWeek: 5, label: "Friday" },
  { dayOfWeek: 6, label: "Saturday" },
  { dayOfWeek: 0, label: "Sunday" },
];

const defaultTimezone =
  typeof Intl !== "undefined" && Intl.DateTimeFormat
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";

const commonTimezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Colombo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export default function AvailabilityPage() {
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [timezone, setTimezone] = useState(defaultTimezone);
  const [days, setDays] = useState<DayState[]>(() =>
    dayLabels.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      label: d.label,
      active: false,
      startTime: "09:00",
      endTime: "17:00",
    }))
  );
  const [exceptions, setExceptions] = useState<ExceptionFormState[]>([]);

  useEffect(() => {
    async function load() {
      const result = await apiFetch<SchedulingAvailability>(
        "/scheduling/availability"
      );

      if (!result.ok) {
        setStatus("error");
        setError(result.error);
        return;
      }

      applyAvailability(result.data);
      setStatus("success");
    }

    load();
  }, []);

  function applyAvailability(data: SchedulingAvailability) {
    const tz = data.rules[0]?.timezone || defaultTimezone;
    setTimezone(tz);

    setDays((prev) =>
      prev.map((day) => {
        const rule = data.rules.find((r) => r.dayOfWeek === day.dayOfWeek);
        if (!rule) return { ...day, active: false };
        return {
          ...day,
          active: rule.isActive,
          startTime: rule.startTime.slice(0, 5),
          endTime: rule.endTime.slice(0, 5),
        };
      })
    );

    setExceptions(
      data.exceptions.map((e) => ({
        id: e.id,
        exceptionDate: e.exceptionDate,
        isAvailable: e.isAvailable,
        startTime: e.startTime ? e.startTime.slice(0, 5) : "09:00",
        endTime: e.endTime ? e.endTime.slice(0, 5) : "17:00",
        timezone: e.timezone,
        reason: e.reason || "",
      }))
    );
  }

  function updateDay(dayOfWeek: number, updates: Partial<DayState>) {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...updates } : d))
    );
  }

  function addException() {
    const today = new Date().toISOString().slice(0, 10);
    setExceptions((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        exceptionDate: today,
        isAvailable: false,
        startTime: "09:00",
        endTime: "17:00",
        timezone,
        reason: "",
      },
    ]);
  }

  function updateException(
    id: string,
    updates: Partial<ExceptionFormState>
  ) {
    setExceptions((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  }

  function removeException(id: string) {
    setExceptions((prev) => prev.filter((e) => e.id !== id));
  }

  function validate(): string | null {
    for (const day of days) {
      if (day.active && day.endTime <= day.startTime) {
        return `${day.label} end time must be after start time.`;
      }
    }
    for (const e of exceptions) {
      if (e.isAvailable && e.endTime <= e.startTime) {
        return `Exception on ${e.exceptionDate}: end time must be after start time.`;
      }
    }
    return null;
  }

  async function handleSave() {
    setSaveError(null);
    setSaveSuccess(false);

    const validationError = validate();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setIsSaving(true);

    const rules: AvailabilityRuleInput[] = days
      .filter((d) => d.active)
      .map((d) => ({
        dayOfWeek: d.dayOfWeek,
        startTime: `${d.startTime}:00`,
        endTime: `${d.endTime}:00`,
        timezone,
        isActive: true,
      }));

    const exceptionsPayload: AvailabilityExceptionInput[] = exceptions.map(
      (e) => ({
        exceptionDate: e.exceptionDate,
        isAvailable: e.isAvailable,
        startTime: e.isAvailable ? `${e.startTime}:00` : null,
        endTime: e.isAvailable ? `${e.endTime}:00` : null,
        timezone: e.timezone || timezone,
        reason: e.reason || null,
      })
    );

    const result = await apiFetch<SchedulingAvailability>(
      "/scheduling/availability",
      {
        method: "PUT",
        body: JSON.stringify({ rules: rules, exceptions: exceptionsPayload }),
      }
    );

    if (result.ok) {
      applyAvailability(result.data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setSaveError(result.error);
    }

    setIsSaving(false);
  }

  if (status === "loading") {
    return <LoadingState message="Loading availability..." />;
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Could not load availability"
        message={error || "Something went wrong."}
        action={
          <Button onClick={() => window.location.reload()}>Try again</Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Availability</h1>
          <p className="text-muted">
            Set the days and times you are available for bookings.
          </p>
        </div>
        <Button
          onClick={handleSave}
          isLoading={isSaving}
          className="w-full sm:w-auto"
        >
          Save availability
        </Button>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
          Availability saved successfully.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Weekly schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="flex h-11 w-full rounded-lg border border-border bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent sm:w-80"
            >
              {commonTimezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {days.map((day) => (
              <div
                key={day.dayOfWeek}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-center justify-between sm:w-40">
                  <span className="font-medium text-foreground">
                    {day.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateDay(day.dayOfWeek, { active: !day.active })}
                    className={[
                      "relative h-7 w-12 rounded-full transition-colors",
                      day.active ? "bg-secondary" : "bg-slate-300",
                    ].join(" ")}
                    aria-label={day.active ? `Disable ${day.label}` : `Enable ${day.label}`}
                  >
                    <span
                      className={[
                        "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                        day.active ? "translate-x-5" : "translate-x-0.5",
                      ].join(" ")}
                    />
                  </button>
                </div>

                <div className="flex flex-1 items-center gap-3">
                  <Input
                    type="time"
                    value={day.startTime}
                    onChange={(e) =>
                      updateDay(day.dayOfWeek, { startTime: e.target.value })
                    }
                    disabled={!day.active}
                    className="flex-1"
                  />
                  <span className="text-muted">to</span>
                  <Input
                    type="time"
                    value={day.endTime}
                    onChange={(e) =>
                      updateDay(day.dayOfWeek, { endTime: e.target.value })
                    }
                    disabled={!day.active}
                    className="flex-1"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Availability exceptions</CardTitle>
            <Button variant="outline" size="sm" onClick={addException}>
              <Plus className="h-4 w-4" />
              Add exception
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {exceptions.length === 0 ? (
            <EmptyState
              title="No exceptions"
              message="Add days you are unavailable or have different hours."
            />
          ) : (
            <div className="space-y-3">
              {exceptions.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <Label htmlFor={`date-${e.id}`}>Date</Label>
                      <Input
                        id={`date-${e.id}`}
                        type="date"
                        value={e.exceptionDate}
                        onChange={(ev) =>
                          updateException(e.id, { exceptionDate: ev.target.value })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-3 pb-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={e.isAvailable}
                          onChange={(ev) =>
                            updateException(e.id, {
                              isAvailable: ev.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-border text-secondary focus:ring-secondary"
                        />
                        Available
                      </label>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeException(e.id)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </div>

                  {e.isAvailable && (
                    <div className="flex items-center gap-3">
                      <Input
                        type="time"
                        value={e.startTime}
                        onChange={(ev) =>
                          updateException(e.id, { startTime: ev.target.value })
                        }
                        className="flex-1"
                      />
                      <span className="text-muted">to</span>
                      <Input
                        type="time"
                        value={e.endTime}
                        onChange={(ev) =>
                          updateException(e.id, { endTime: ev.target.value })
                        }
                        className="flex-1"
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor={`reason-${e.id}`}>Reason</Label>
                    <Input
                      id={`reason-${e.id}`}
                      value={e.reason}
                      onChange={(ev) =>
                        updateException(e.id, { reason: ev.target.value })
                      }
                      placeholder="e.g. Public holiday"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface DayState {
  dayOfWeek: number;
  label: string;
  active: boolean;
  startTime: string;
  endTime: string;
}

interface ExceptionFormState {
  id: string;
  exceptionDate: string;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
  reason: string;
}
