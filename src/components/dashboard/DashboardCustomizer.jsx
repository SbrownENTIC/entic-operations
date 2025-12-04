import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Settings, GripVertical, AlertCircle } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";

export const DEFAULT_WIDGETS = [
  { id: "alerts", title: "Alerts", visible: true },
  { id: "summary_cards", title: "Summary Cards", visible: true },
  { id: "pending_invoices", title: "Invoices Pending Approval", visible: true },
  { id: "missing_invoices", title: "Missing Invoices", visible: true },
  { id: "license_expirations", title: "License Expirations", visible: true },
  { id: "invoice_summary", title: "Invoice Summary", visible: true },
  { id: "financial_overview", title: "Financial Overview", visible: true },
  { id: "financial_by_program", title: "Financial Overview by Program", visible: true },
  { id: "cme_compliance", title: "CME Compliance", visible: true },
];

export default function DashboardCustomizer({ currentConfig, onConfigChange }) {
  const [open, setOpen] = useState(false);
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentConfig) {
      try {
        const parsedConfig = JSON.parse(currentConfig);
        // Merge with default to handle new widgets in future
        const merged = parsedConfig.map(w => ({
          ...DEFAULT_WIDGETS.find(dw => dw.id === w.id) || w,
          ...w
        }));
        
        // Add any new default widgets that aren't in the config yet
        const missing = DEFAULT_WIDGETS.filter(dw => !parsedConfig.find(w => w.id === dw.id));
        
        setWidgets([...merged, ...missing]);
      } catch (e) {
        console.error("Failed to parse dashboard config", e);
        setWidgets(DEFAULT_WIDGETS);
      }
    } else {
      setWidgets(DEFAULT_WIDGETS);
    }
  }, [currentConfig]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setWidgets(items);
  };

  const toggleVisibility = (id) => {
    setWidgets(widgets.map(w => 
      w.id === id ? { ...w, visible: !w.visible } : w
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const configString = JSON.stringify(widgets);
      await base44.auth.updateMe({ dashboard_config: configString });
      onConfigChange(configString);
      setOpen(false);
    } catch (error) {
      console.error("Failed to save dashboard config", error);
      let errorMessage = error.message || "An unexpected error occurred.";
      // Try to extract more detailed error from response if available
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      }
      setError(`Failed to save changes: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="w-4 h-4" />
          Customize Dashboard
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <DialogDescription>
            Reorder widgets and toggle their visibility.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md mb-4 flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="dashboard-widgets">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {widgets.map((widget, index) => (
                    <Draggable key={widget.id} draggableId={widget.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div {...provided.dragHandleProps} className="cursor-grab text-slate-400 hover:text-slate-600">
                              <GripVertical className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-sm text-slate-700">{widget.title}</span>
                          </div>
                          <Switch
                            checked={widget.visible}
                            onCheckedChange={() => toggleVisibility(widget.id)}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}