"use client";

import { useEffect, useState, useMemo } from "react";
import { Button, Card, CardContent, Select, Badge } from "@cloudit/ui";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import type { Property, CalendarDay, PaginatedResponse } from "@/lib/types";

const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CalendarPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    if (propertyId) {
      loadCalendar();
    } else {
      setCalendarDays([]);
      setIsLoading(false);
    }
  }, [propertyId, currentDate]);

  async function loadProperties() {
    try {
      const res = await api.get<PaginatedResponse<Property>>("/properties?limit=100");
      setProperties(res.data);
      if (res.data.length > 0 && !propertyId) {
        setPropertyId(res.data[0].id);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function loadCalendar() {
    try {
      setIsLoading(true);
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const data = await api.get<CalendarDay[]>(
        `/reservations/calendar?propertyId=${propertyId}&month=${month}&year=${year}`
      );
      setCalendarDays(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const daysByKey = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    calendarDays.forEach((day) => map.set(day.date, day));
    return map;
  }, [calendarDays]);

  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

  const todayKey = new Date().toISOString().split("T")[0];

  const prevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const propertyOptions = [
    { value: "", label: "Select property" },
    ...properties.map((p) => ({ value: p.id, label: p.name })),
  ];

  const selectedDay = selectedDate ? daysByKey.get(selectedDate) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description="Booking calendar and occupancy overview">
        <Select
          options={propertyOptions}
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="w-64"
        />
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{monthName}</span>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading calendar...</div>
          ) : (
            <>
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                {weekDays.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-24 rounded-md border border-dashed border-muted" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateKey = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
                    .toISOString()
                    .split("T")[0];
                  const dayData = daysByKey.get(dateKey);
                  const isToday = dateKey === todayKey;
                  const isSelected = dateKey === selectedDate;

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDate(dateKey)}
                      className={`flex h-24 flex-col items-start rounded-md border p-2 text-left transition-colors hover:bg-accent ${
                        isToday ? "border-primary bg-primary/5" : ""
                      } ${isSelected ? "ring-2 ring-primary" : ""}`}
                    >
                      <span className={`text-sm font-medium ${isToday ? "text-primary" : ""}`}>{day}</span>
                      {dayData && (
                        <div className="mt-1 flex w-full flex-col gap-1">
                          {dayData.checkIns > 0 && (
                            <Badge variant="default" className="w-full justify-center text-[10px]">
                              {dayData.checkIns} in
                            </Badge>
                          )}
                          {dayData.checkOuts > 0 && (
                            <Badge variant="secondary" className="w-full justify-center text-[10px]">
                              {dayData.checkOuts} out
                            </Badge>
                          )}
                          {dayData.checkIns === 0 && dayData.checkOuts === 0 && (
                            <span className="text-[10px] text-muted-foreground">No activity</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedDay && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4" />
              {new Date(selectedDay.date).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h3>
            {selectedDay.reservations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reservations on this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedDay.reservations.map((res) => (
                  <div
                    key={`${res.id}-${res.type}`}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {res.reservationNumber} — {res.guestName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Room {res.roomNumber} • {res.type === "check-in" ? "Check-in" : "Check-out"}
                      </p>
                    </div>
                    <Badge variant={res.type === "check-in" ? "default" : "secondary"}>
                      {res.type === "check-in" ? "Check-in" : "Check-out"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
