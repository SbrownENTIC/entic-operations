import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Mail, User, Building2, ShieldCheck, Syringe, Monitor } from "lucide-react";

export default function ContactReferenceSheet() {
  const credentialingContacts = [
    {
      facility: "Bloomfield Ambulatory Surgery Center (BASC)",
      contact: "Carissa Beaulieu",
      title: "",
      phone: "",
      emails: ["Carissa.Beaulieu@scasurgery.com"]
    },
    {
      facility: "Connecticut Children’s Medical Center (CCMC)",
      contact: "Amanda Fascendini",
      title: "Physician Liaison",
      phone: "860-836-4221",
      emails: ["afascendini@connecticutchildrens.org", "RThornton@connecticutchildrens.org"]
    },
    {
      facility: "Connecticut Surgery Center (CTSC)",
      contact: "Rosanna Santilli",
      title: "Manager",
      phone: "860-777-1836 | Cell: 860-402-6896",
      emails: ["rosanna.santilli@scasurgery.com"]
    },
    {
      facility: "Hartford Hospital",
      contact: "Lauren McLaughlin",
      title: "Medical Staff Office",
      phone: "860-972-7503",
      emails: ["Lauren.McLaughlin@hhchealth.org"]
    },
    {
      facility: "Integrated Practice Management Solutions (IPMS)",
      contact: "Leigha Laurent",
      title: "",
      phone: "",
      emails: ["Leigha.laurent@berrydunn.com"]
    },
    {
      facility: "St. Francis Hospital / Trinity Health",
      contact: "",
      title: "",
      phone: "",
      emails: ["hqthsmcpiexpirables@trinity-health.org", "Sandra.kolodziej@trinity-health.org"]
    },
    {
      facility: "UConn Health",
      contact: "Lauren Rondinone",
      title: "",
      phone: "",
      emails: ["lrondinone@uchc.edu", "jcatucci@uchc.edu", "MedicalStaffOffice@uchc.edu"]
    }
  ];

  const fluContacts = [
    {
      facility: "BASC – Bloomfield Ambulatory Surgery Center",
      emails: ["expirables@scasurgery.com"]
    },
    {
      facility: "Bristol Hospital",
      emails: ["blaprise@Bristolhospital.org"]
    },
    {
      facility: "Hartford Hospital",
      emails: ["Jennifer.Cleveland@hhchealth.org"]
    },
    {
      facility: "Manchester Hospital",
      emails: ["Medicalaffairs@echn.org"]
    },
    {
      facility: "Trinity Health – St. Francis",
      emails: ["blnguyen@trinityhealthofne.org", "jerri.richard@trinityhealthofne.org"]
    },
    {
      facility: "UConn",
      emails: ["Lrondinone@uchc.edu"]
    }
  ];

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-5xl mx-auto bg-white min-h-screen">
      <div className="text-center space-y-2 border-b pb-6">
        <h1 className="text-3xl font-bold text-slate-900">Hospital & Surgery Center Contact Reference Sheet</h1>
        <p className="text-slate-500">Key contacts for credentialing, compliance, and IT support</p>
      </div>

      {/* COI & Credentialing Contacts */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-blue-50/50 border-b border-blue-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <CardTitle className="text-blue-900">COI & Credentialing Contacts</CardTitle>
              <CardDescription>Primary points of contact for privileges and insurance</CardDescription>
            </div>
          </div>
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
              {credentialingContacts.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium align-top">
                    <div className="flex items-start gap-2">
                      <Building2 className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                      {item.facility}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    {item.contact && (
                      <div className="flex items-start gap-2 font-medium text-slate-900">
                        <User className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                        <div>
                          {item.contact}
                          {item.title && <div className="text-xs text-slate-500 font-normal">{item.title}</div>}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="space-y-2">
                      {item.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{item.phone}</span>
                        </div>
                      )}
                      {item.emails.map((email, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <a href={`mailto:${email}`} className="text-blue-600 hover:underline break-all">
                            {email}
                          </a>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Annual Flu Vaccine Contacts */}
        <Card className="border-slate-200 shadow-sm h-full">
          <CardHeader className="bg-green-50/50 border-b border-green-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Syringe className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <CardTitle className="text-green-900">Annual Flu Vaccine Contacts</CardTitle>
                <CardDescription>Send proof of vaccination to these emails</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {fluContacts.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium w-[50%] align-top">
                      <div className="flex items-start gap-2">
                        <Building2 className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                        {item.facility}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        {item.emails.map((email, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <a href={`mailto:${email}`} className="text-blue-600 hover:underline break-all">
                              {email}
                            </a>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ENTIC- IT TEAM */}
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
    </div>
  );
}