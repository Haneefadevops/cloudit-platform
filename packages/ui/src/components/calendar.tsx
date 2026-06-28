import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils.js";
import { Button } from "./button.js";

export interface CalendarProps {
  month?: number;
  year?: number;
  className?: string;
  onDateClick?: (date: Date) => void;
}

function Calendar({
  month: controlledMonth,
  year: controlledYear,
  className,
  onDateClick,
}: CalendarProps) {
  const today = new Date();
  const [month, setMonth] = React.useState(controlledMonth ?? today.getMonth());
  const [year, setYear] = React.useState(controlledYear ?? today.getFullYear());

  React.useEffect(() => {
    if (controlledMonth !== undefined) setMonth(controlledMonth);
    if (controlledYear !== undefined) setYear(controlledYear);
  }, [controlledMonth, controlledYear]);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const monthName = new Date(year, month).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const days = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isToday =
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year;

    days.push(
      <button
        key={day}
        type="button"
        onClick={() => onDateClick?.(date)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent",
          isToday && "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {day}
      </button>
    );
  }

  return (
    <div className={cn("rounded-lg border p-4", className)}>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{monthName}</span>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">{days}</div>
    </div>
  );
}

export { Calendar };
