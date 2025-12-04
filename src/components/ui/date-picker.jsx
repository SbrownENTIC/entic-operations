import React from "react";
import { format, isValid, parse, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function DatePicker({ value, onChange, className, defaultMonth, placeholder = "Pick a date", disabled = false }) {
  const [date, setDate] = React.useState();

  React.useEffect(() => {
    if (value) {
      // Handle both Date objects and YYYY-MM-DD strings
      const parsedDate = typeof value === 'string' ? parseISO(value) : value;
      if (isValid(parsedDate)) {
        setDate(parsedDate);
      }
    } else {
      setDate(undefined);
    }
  }, [value]);

  const handleSelect = (newDate) => {
    setDate(newDate);
    if (onChange) {
      // Return YYYY-MM-DD string to match HTML input behavior if original value was string
      // Or just standardize on YYYY-MM-DD string for this app's entities
      onChange(newDate ? format(newDate, 'yyyy-MM-dd') : '');
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          defaultMonth={date || defaultMonth || new Date()}
          initialFocus
          captionLayout="dropdown-buttons"
          fromYear={1960}
          toYear={2030}
        />
      </PopoverContent>
    </Popover>
  );
}