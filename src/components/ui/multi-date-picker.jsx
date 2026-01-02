import React from "react";
import { format, isValid, parseISO, parse } from "date-fns";
import { Calendar as CalendarIcon, ClipboardList, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
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
  const [isPasteMode, setIsPasteMode] = React.useState(false);
  const [pasteText, setPasteText] = React.useState("");

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

  const handlePasteProcess = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText.split(/\n|,/);
    const newDates = [];
    const currentDates = [...selectedDates];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Try parsing MM/DD/YYYY
      let date = parse(trimmed, 'MM/dd/yyyy', new Date());
      
      // If invalid, try yyyy-MM-dd
      if (!isValid(date)) {
        date = parse(trimmed, 'yyyy-MM-dd', new Date());
      }
      
      // If invalid, try M/d/yyyy
      if (!isValid(date)) {
        date = parse(trimmed, 'M/d/yyyy', new Date());
      }

      if (isValid(date)) {
        // Check if already selected to avoid duplicates
        const alreadyExists = currentDates.some(d => 
          format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        ) || newDates.some(d => 
          format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        );

        if (!alreadyExists) {
          newDates.push(date);
        }
      }
    });

    const finalDates = [...currentDates, ...newDates];
    setSelectedDates(finalDates);
    if (onChange) {
      onChange(finalDates.map(d => format(d, 'yyyy-MM-dd')));
    }
    
    setPasteText("");
    setIsPasteMode(false);
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
              {selectedDates.sort((a,b) => a - b).map((d, index) => (
                  <Badge key={index} variant="secondary" className="rounded-sm px-1 py-0 text-xs font-normal bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200">
                  {format(d, "MMM d")}
                  </Badge>
              ))}
            </div>
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {!isPasteMode ? (
          <>
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
            <div className="border-t p-2">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-xs h-8"
                onClick={() => setIsPasteMode(true)}
              >
                <ClipboardList className="mr-2 h-3 w-3" />
                Paste Dates
              </Button>
            </div>
          </>
        ) : (
          <div className="w-[276px] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6" 
                onClick={() => setIsPasteMode(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">Paste Dates</span>
            </div>
            <Textarea
              placeholder="Paste list of dates...&#10;12/04/2025&#10;12/05/2025"
              className="min-h-[200px] text-sm resize-none mb-2"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <Button 
              size="sm" 
              className="w-full" 
              onClick={handlePasteProcess}
              disabled={!pasteText.trim()}
            >
              Add Dates
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}