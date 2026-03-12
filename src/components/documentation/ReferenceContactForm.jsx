import React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useMutation } from "@tanstack/react-query";

const FACILITIES = [
  "Bloomfield Ambulatory Surgery Center (BASC)",
  "Connecticut Children’s Medical Center (CCMC)",
  "Connecticut Surgery Center (CTSC)",
  "Constitution Surgery Alliance",
  "Hartford Hospital",
  "Integrated Practice Management Solutions (IPMS)",
  "Manchester / ECHN",
  "St. Francis Hospital / Trinity Health",
  "UConn Health"
];

export default function ReferenceContactForm({ open, onOpenChange, contact, section }) {
  const queryClient = useQueryClient();
  const [isCustomFacility, setIsCustomFacility] = React.useState(false);
  
  const { register, control, handleSubmit, reset, setValue, watch, getValues } = useForm({
    defaultValues: {
      facility: "",
      contact_person: "",
      title: "",
      phone: "",
      emails: [{ value: "" }],
      section: section || "credentialing"
    }
  });

  const currentFacility = watch("facility");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "emails"
  });

  React.useEffect(() => {
    if (contact) {
      const isKnown = FACILITIES.includes(contact.facility);
      setIsCustomFacility(!isKnown && !!contact.facility);
      
      reset({
        facility: contact.facility || "",
        contact_person: contact.contact_person || "",
        title: contact.title || "",
        phone: contact.phone || "",
        emails: contact.emails && contact.emails.length > 0 
          ? contact.emails.map(e => ({ value: e })) 
          : [{ value: "" }],
        section: contact.section || section || "credentialing"
      });
    } else {
      setIsCustomFacility(false);
      reset({
        facility: "",
        contact_person: "",
        title: "",
        phone: "",
        emails: [{ value: "" }],
        section: section || "credentialing"
      });
    }
  }, [contact, section, reset, open]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ReferenceContact.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-contacts'] });
      onOpenChange(false);
      reset();
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ReferenceContact.update(contact.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-contacts'] });
      onOpenChange(false);
      reset();
    }
  });

  const onSubmit = (data) => {
    // Transform emails from object array to string array and filter empty
    const formattedData = {
      ...data,
      emails: data.emails.map(e => e.value).filter(e => e.trim() !== "")
    };

    if (contact) {
      updateMutation.mutate(formattedData);
    } else {
      createMutation.mutate(formattedData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Facility / Organization</Label>
            {!isCustomFacility ? (
              <Select 
                value={FACILITIES.includes(currentFacility) ? currentFacility : ""} 
                onValueChange={(val) => {
                  if (val === "other") {
                    setIsCustomFacility(true);
                    setValue("facility", "");
                  } else {
                    setValue("facility", val);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a facility..." />
                </SelectTrigger>
                <SelectContent>
                  {FACILITIES.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                  <SelectItem value="other">Other / Create New...</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2">
                <Input 
                  {...register("facility", { required: true })} 
                  placeholder="Enter facility name..." 
                  autoFocus
                />
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => {
                    setIsCustomFacility(false);
                    setValue("facility", "");
                  }}
                  title="Back to list"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Contact Person</Label>
            <Input {...register("contact_person")} placeholder="e.g. Jane Doe" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input {...register("title")} placeholder="e.g. Manager" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...register("phone")} placeholder="e.g. 860-555-0123" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Emails</Label>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={() => append({ value: "" })}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input 
                    {...register(`emails.${index}.value`)} 
                    placeholder="email@example.com" 
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1 && index === 0}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
             <Label>Section</Label>
             <Select 
               onValueChange={(val) => setValue("section", val)} 
               defaultValue={watch("section")}
             >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credentialing">COI & Credentialing</SelectItem>
                  <SelectItem value="flu">Flu Vaccine</SelectItem>
                  <SelectItem value="it">IT Team</SelectItem>
                  <SelectItem value="accounts_payable">Accounts Payable</SelectItem>
                </SelectContent>
             </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {contact ? "Save Changes" : "Create Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}