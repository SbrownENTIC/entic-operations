import React, { useEffect, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, parse, isValid } from "date-fns";

export function TimePicker({ value, onChange, className }) {
  // Internal state for display
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState("AM"); // AM or PM

  // Parse incoming value (can be "HH:mm" 24h or "h:mm aa" 12h)
  useEffect(() => {
    if (value) {
      // Try parsing as 24h first
      let date = parse(value, "HH:mm", new Date());
      if (!isValid(date)) {
        // Try 12h
        date = parse(value, "h:mm aa", new Date());
        if (!isValid(date)) {
            // Try 12h without space
             date = parse(value, "h:mmaa", new Date());
        }
      }

      if (isValid(date)) {
        let h = date.getHours();
        const m = date.getMinutes();
        const p = h >= 12 ? "PM" : "AM";
        
        if (h === 0) h = 12;
        else if (h > 12) h -= 12;

        setHour(h);
        setMinute(m); // Should ideally be 0 or 30 based on requirements, but we respect value
        setPeriod(p);
      }
    } else {
        // Default to 12:00 PM if no value
        setHour(12);
        setMinute(0);
        setPeriod("PM");
    }
  }, [value]);

  const updateTime = (h, m, p) => {
    // Convert back to 24h string or whatever format is preferred.
    // Assuming "h:mm aa" (e.g. "8:30 AM") as that's user friendly and standard in this app's legacy inputs
    // Or "HH:mm" if that's what backend expects.
    // Looking at ReminderForm, it uses text input, so likely string. 
    // Let's standardise on "h:mm aa" for display/storage if it's text, 
    // but if previous was "14:00" (time input), we might want to stick to that?
    // The user asked for interactive picker. Let's output "h:mm aa" (e.g. "8:30 AM").
    
    const formattedHour = h;
    const formattedMinute = m.toString().padStart(2, '0');
    const timeString = `${formattedHour}:${formattedMinute} ${p}`;
    onChange(timeString);
  };

  const incrementHour = () => {
    let newHour = hour + 1;
    if (newHour > 12) newHour = 1;
    setHour(newHour);
    updateTime(newHour, minute, period);
  };

  const decrementHour = () => {
    let newHour = hour - 1;
    if (newHour < 1) newHour = 12;
    setHour(newHour);
    updateTime(newHour, minute, period);
  };

  const incrementMinute = () => {
    // 30 min increments
    let newMinute = minute + 30;
    let newHour = hour;
    if (newMinute >= 60) {
      newMinute = 0;
      newHour = hour + 1;
      if (newHour > 12) newHour = 1;
      setHour(newHour);
    }
    setMinute(newMinute);
    updateTime(newHour, newMinute, period);
  };

  const decrementMinute = () => {
    let newMinute = minute - 30;
    let newHour = hour;
    if (newMinute < 0) {
      newMinute = 30;
      newHour = hour - 1;
      if (newHour < 1) newHour = 12;
      setHour(newHour);
    }
    setMinute(newMinute);
    updateTime(newHour, newMinute, period);
  };

  const togglePeriod = () => {
    const newPeriod = period === "AM" ? "PM" : "AM";
    setPeriod(newPeriod);
    updateTime(hour, minute, newPeriod);
  };

  return (
    <div className={cn("flex items-center gap-1 p-1 bg-white border rounded-md w-fit", className)}>
      {/* Hour */}
      <div className="flex flex-col items-center">
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={incrementHour}>
          <ChevronUp className="h-3 w-3" />
        </Button>
        <div className="text-lg font-bold w-8 text-center select-none">{hour}</div>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={decrementHour}>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      <span className="text-xl pb-1">:</span>

      {/* Minute */}
      <div className="flex flex-col items-center">
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={incrementMinute}>
          <ChevronUp className="h-3 w-3" />
        </Button>
        <div className="text-lg font-bold w-8 text-center select-none">{minute.toString().padStart(2, '0')}</div>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={decrementMinute}>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      {/* Period */}
      <div className="flex flex-col items-center ml-1">
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={togglePeriod}>
          <ChevronUp className="h-3 w-3" />
        </Button>
        <div className="text-sm font-bold w-8 text-center select-none cursor-pointer" onClick={togglePeriod}>{period}</div>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={togglePeriod}>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}