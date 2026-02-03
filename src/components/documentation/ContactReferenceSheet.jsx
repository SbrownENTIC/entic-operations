import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Mail, User, Building2, ShieldCheck, Syringe, Monitor, Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import ReferenceContactForm from "@/components/documentation/ReferenceContactForm";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function ContactReferenceSheet() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [activeSection, setActiveSection] = useState("credentialing");
  const [contactToDelete, setContactToDelete] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['reference-contacts'],
    queryFn: () => base44.entities.ReferenceContact.list(),
    initialData: []
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ReferenceContact.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-contacts'] });
      setContactToDelete(null);
    }
  });

  const credentialingContacts = contacts.filter(c => c.section === 'credentialing');
  const fluContacts = contacts.filter(c => c.section === 'flu');

  const groupByFacility = (list) => {
    const grouped = {};
    list.forEach(item => {
      const facility = item.facility || "Other";
      if (!grouped[facility]) grouped[facility] = [];
      grouped[facility].push(item);
    });
    // Sort groups alphabetically
    return Object.keys(grouped).sort().reduce((acc, key) => {
      acc[key] = grouped[key];
      return acc;
    }, {});
  };

  const groupedCredentialing = groupByFacility(credentialingContacts);
  const groupedFlu = groupByFacility(fluContacts);

  const handleEdit = (contact) => {
    setSelectedContact(contact);
    setActiveSection(contact.section);
    setIsFormOpen(true);
  };

  const handleAdd = (section) => {
    setSelectedContact(null);
    setActiveSection(section);
    setIsFormOpen(true);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-5xl mx-auto bg-white">
      <div className="text-center space-y-2 border-b pb-6">
        <h1 className="text-3xl font-bold text-slate-900">Hospital & Surgery Center Contact Reference Sheet</h1>
        <p className="text-slate-500">Key contacts for credentialing, compliance, and IT support</p>
      </div>

      {/* COI & Credentialing Contacts */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-blue-50/50 border-b border-blue-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <CardTitle className="text-blue-900">COI & Credentialing Contacts</CardTitle>
              <CardDescription>Primary points of contact for privileges and insurance</CardDescription>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => handleAdd('credentialing')} className="no-print gap-2">
              <Plus className="w-4 h-4" /> Add Contact
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="w-[30%]">Facility / Organization</TableHead>
                <TableHead className="w-[25%]">Contact Person</TableHead>
                <TableHead className="w-[45%]">Contact Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedCredentialing).map(([facility, groupItems]) => (
                <React.Fragment key={facility}>
                  {groupItems.map((item, index) => (
                    <TableRow key={item.id} className="group">
                      {index === 0 && (
                        <TableCell rowSpan={groupItems.length} className="font-medium align-top bg-slate-50/30 border-r w-[30%]">
                          <div className="flex items-start gap-2 sticky top-4">
                            <Building2 className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                            {facility}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="align-top w-[25%]">
                        {(item.contact_person) ? (
                          <div className="flex items-start gap-2 font-medium text-slate-900">
                            <User className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                            <div>
                              {item.contact_person}
                              {item.title && <div className="text-xs text-slate-500 font-normal">{item.title}</div>}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-sm">General Contact</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top w-[45%]">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            {item.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{item.phone}</span>
                              </div>
                            )}
                            {item.emails && item.emails.map((email, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <a href={`mailto:${email}`} className="text-blue-600 hover:underline break-all">
                                  {email}
                                </a>
                              </div>
                            ))}
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEdit(item)}>
                                <Pencil className="w-3 h-3 text-blue-600" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setContactToDelete(item)}>
                                <Trash2 className="w-3 h-3 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Annual Flu Vaccine Contacts */}
        <Card className="border-slate-200 shadow-sm h-full flex flex-col">
          <CardHeader className="bg-green-50/50 border-b border-green-100 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Syringe className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <CardTitle className="text-green-900">Annual Flu Vaccine Contacts</CardTitle>
                <CardDescription>Send proof of vaccination to these emails</CardDescription>
              </div>
            </div>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => handleAdd('flu')} className="no-print gap-2">
                <Plus className="w-4 h-4" /> Add
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <Table>
              <TableBody>
                {Object.entries(groupedFlu).map(([facility, groupItems]) => (
                  <React.Fragment key={facility}>
                    {groupItems.map((item, index) => (
                      <TableRow key={item.id} className="group">
                        {index === 0 && (
                          <TableCell rowSpan={groupItems.length} className="font-medium align-top bg-slate-50/30 border-r w-[50%]">
                            <div className="flex items-start gap-2 sticky top-4">
                              <Building2 className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                              {facility}
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="align-top">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              {item.contact_person && (
                                <div className="text-sm font-medium mb-1">{item.contact_person}</div>
                              )}
                              {item.emails && item.emails.map((email, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <a href={`mailto:${email}`} className="text-blue-600 hover:underline break-all">
                                    {email}
                                  </a>
                                </div>
                              ))}
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEdit(item)}>
                                  <Pencil className="w-3 h-3 text-blue-600" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setContactToDelete(item)}>
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ENTIC- IT TEAM (Kept Hardcoded for specific layout) */}
        <Card className="border-slate-200 shadow-sm h-full">
          <CardHeader className="bg-purple-50/50 border-b border-purple-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Monitor className="w-5 h-5 text-purple-700" />
              </div>
              <div>
                <CardTitle className="text-purple-900">ENTIC- IT TEAM</CardTitle>
                <CardDescription>Technical support contacts (Corteligent)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <Phone className="w-5 h-5 text-purple-700" />
                <div>
                  <div className="font-medium text-purple-900">Support Hotline</div>
                  <div className="text-lg font-bold text-slate-900">866-855-2673</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Primary Support</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <User className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-900">Ryan Niemela</div>
                      <a href="mailto:rniemela@core.tech" className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" /> rniemela@core.tech
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <User className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-900">Ryan McNulty</div>
                      <a href="mailto:rmcnulty@core.tech" className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" /> rmcnulty@core.tech
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-3">CC For Escalations</h4>
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <User className="w-5 h-5 text-slate-500 mt-0.5" />
                  <div>
                    <div className="font-medium text-slate-900">Francis Burnett</div>
                    <a href="mailto:franb@bridgelinegs.com" className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" /> franb@bridgelinegs.com
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ReferenceContactForm 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        contact={selectedContact}
        section={activeSection}
      />

      <AlertDialog open={!!contactToDelete} onOpenChange={() => setContactToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the contact for {contactToDelete?.facility}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700" 
              onClick={() => deleteMutation.mutate(contactToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}