"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  targetDate: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeRemaining(targetDate: string): TimeRemaining {
  const target = new Date(targetDate).getTime();
  const now = new Date().getTime();
  const total = target - now;

  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((total % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, total };
}

export function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(targetDate),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(targetDate));
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (timeRemaining.total <= 0) {
    return null;
  }

  const timeUnits = [
    { value: timeRemaining.days, label: "Days" },
    { value: timeRemaining.hours, label: "Hours" },
    { value: timeRemaining.minutes, label: "Minutes" },
    { value: timeRemaining.seconds, label: "Seconds" },
  ];

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      {timeUnits.map((unit, index) => (
        <div key={unit.label} className="flex items-center gap-2 sm:gap-4">
          <div className="flex flex-col items-center">
            <div className="text-foreground from-background/15 to-background/0 border-background/10 dark:border-brand/5 inset-shadow-brand flex h-12 w-12 items-center justify-center rounded-xl border bg-linear-to-b text-xl font-bold tabular-nums inset-shadow-sm sm:h-16 sm:w-16 sm:text-2xl dark:inset-shadow-black/20">
              {String(unit.value).padStart(2, "0")}
            </div>
            <span className="text-primary-foreground dark:text-foreground/50 mt-1 text-xs font-medium text-shadow-sm sm:text-sm">
              {unit.label}
            </span>
          </div>
          {index < timeUnits.length - 1 && (
            <span className="text-primary-foreground dark:text-foreground/80 mb-6 text-xl font-bold text-shadow-sm">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
