import React from "react";
import { format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export function MultiDatePicker({
  value = [], // Expects string[] of "yyyy-MM-dd"
  onChange,
  className,
  defaultMonth,
  placeholder = "Select dates...",
  disabled = false,
}) {
  const [selectedDates, setSelectedDates] = React.useState([]);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (Array.isArray(value)) {
      const parsedDates = value.map(d => typeof d === 'string' ? parseISO(d) : d).filter(isValid);
      setSelectedDates(parsedDates);
    } else {
      setSelectedDates([]);
    }
  }, [value]);

  const handleSelect = (newDates) => {
    // react-day-picker returns Date[] or undefined
    const dates = newDates || [];
    setSelectedDates(dates);
    if (onChange) {
      onChange(dates.map(d => format(d, 'yyyy-MM-dd')));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-auto min-h-[2.5rem] py-2",
            selectedDates.length === 0 && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {selectedDates.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedDates.length > 5 ? (
                 <span className="text-slate-900">{selectedDates.length} dates selected</span>
              ) : (
                selectedDates.sort((a,b) => a - b).map((d, index) => (
                    <Badge key={index} variant="secondary" className="rounded-sm px-1 py-0 text-xs font-normal bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200">
                    {format(d, "MMM d")}
                    </Badge>
                ))
              )}
            </div>
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="multiple"
          selected={selectedDates}
          onSelect={handleSelect}
          defaultMonth={selectedDates[0] || defaultMonth || new Date()}
          initialFocus
          captionLayout="dropdown-buttons"
          fromYear={2020}
          toYear={2030}
        />
      </PopoverContent>
    </Popover>
  );
}