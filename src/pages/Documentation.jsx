import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertCircle, FileText, Settings, Users, DollarSign, Calendar, ClipboardList, ShieldAlert } from "lucide-react";

export default function Documentation() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">System Documentation</h1>
        <p className="text-slate-600 mt-2">Standard operating procedures, maintenance guides, and checklists for the ENTIC Operations Center.</p>
      </div>

      <Tabs defaultValue="sops" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-4 h-auto">
          <TabsTrigger value="sops" className="py-3">SOPs (Modules)</TabsTrigger>
          <TabsTrigger value="system" className="py-3">How System Works</TabsTrigger>
          <TabsTrigger value="maintenance" className="py-3">Maintenance Guide</TabsTrigger>
          <TabsTrigger value="checklist" className="py-3">Steve's Checklist</TabsTrigger>
        </TabsList>

        {/* SOPs Content */}
        <TabsContent value="sops">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" /> Invoices Module</CardTitle>
                <CardDescription>Managing billing for outside income</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  <AccordionItem value="create">
                    <AccordionTrigger>Creating Invoices</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p>1. Navigate to the <strong>Invoices</strong> page.</p>
                      <p>2. Click <strong>Create Invoice</strong>.</p>
                      <p>3. Select the <strong>Program Group</strong> (e.g., UConn, Hartford Hospital).</p>
                      <p>4. Select the <strong>Staff Member</strong>.</p>
                      <p>5. The system will auto-generate an invoice number for UConn invoices.</p>
                      <p>6. Link relevant <strong>Outside Income</strong> records by selecting them from the list. This calculates the totals automatically.</p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="uconn">
                    <AccordionTrigger>UConn PDF Automation</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p>For UConn invoices, the system automatically generates a PDF based on the standard template.</p>
                      <p>• Upon creation, a draft PDF is attached.</p>
                      <p>• You can regenerate the PDF manually using the "File Down" icon.</p>
                      <p>• Click the "Eye" icon to view the attached PDF.</p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="status">
                    <AccordionTrigger>Status Workflow</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p><strong>Draft:</strong> Initial state.</p>
                      <p><strong>Sent to Vendor:</strong> Automatically set when an approved PDF is uploaded or generated.</p>
                      <p><strong>Paid to ENTIC:</strong> Set when a Payment is allocated to this invoice.</p>
                      <p><strong>Provider Paid:</strong> Final state when the provider has been compensated.</p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-600" /> Outside Income</CardTitle>
                <CardDescription>Tracking external work and earnings</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  <AccordionItem value="log">
                    <AccordionTrigger>Logging Income</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p>1. Go to <strong>Outside Income</strong>.</p>
                      <p>2. Click <strong>Add Income</strong>.</p>
                      <p>3. Select the Provider and Facility.</p>
                      <p>4. Enter <strong>Work Dates</strong>. For Hartford Hospital RVU income, enter total RVUs instead.</p>
                      <p>5. Status starts as <strong>Pending</strong>.</p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="link">
                    <AccordionTrigger>Linking to Invoices</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p>• You can select multiple Pending income records and click "Create Invoice" to bundle them.</p>
                      <p>• Once linked, the status changes to <strong>Invoiced</strong>.</p>
                      <p>• If an invoice is deleted, linked income records revert to <strong>Pending</strong>.</p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5 text-orange-600" /> On-Call Schedule</CardTitle>
                <CardDescription>Managing provider shifts</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  <AccordionItem value="schedule">
                    <AccordionTrigger>Managing Shifts</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p>• Use the Calendar view to see coverage gaps.</p>
                      <p>• Click a date or "Add Shift" to schedule.</p>
                      <p>• St. Francis shifts can automatically generate Outside Income records if configured.</p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-purple-600" /> Providers & Licensing</CardTitle>
                <CardDescription>Staff management and compliance</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  <AccordionItem value="onboard">
                    <AccordionTrigger>Onboarding Provider</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p>1. Add provider details in <strong>Providers</strong> page.</p>
                      <p>2. Immediately add their <strong>Licenses</strong> and <strong>Clinical Privileges</strong>.</p>
                      <p>3. The system will automatically track expiration dates and show alerts on the Dashboard.</p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Overview */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>How the System Works</CardTitle>
              <CardDescription>Data flow and entity relationships</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="flex-1 space-y-4">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-2">1. The Core Flow</h3>
                    <p className="text-sm text-slate-600">
                      The system tracks the lifecycle of external revenue from work performance to provider payment:
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700 flex-wrap">
                      <span className="bg-white px-3 py-1 rounded border shadow-sm">Work Performed</span>
                      <span>→</span>
                      <span className="bg-white px-3 py-1 rounded border shadow-sm">Outside Income Logged</span>
                      <span>→</span>
                      <span className="bg-white px-3 py-1 rounded border shadow-sm">Invoice Created</span>
                      <span>→</span>
                      <span className="bg-white px-3 py-1 rounded border shadow-sm">Payment Received</span>
                      <span>→</span>
                      <span className="bg-white px-3 py-1 rounded border shadow-sm">Provider Paid</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-2">2. Automation Features</h3>
                    <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                      <li><strong>UConn Invoices:</strong> Auto-PDF generation and attachment.</li>
                      <li><strong>Status Sync:</strong> Updates to Payments/Allocations automatically update Invoice statuses.</li>
                      <li><strong>Expiration Tracking:</strong> Licenses and Privileges trigger alerts on the Dashboard.</li>
                      <li><strong>Reminders:</strong> Automated emails for critical dates.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Guide */}
        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Guide</CardTitle>
              <CardDescription>Keeping the Operations Center healthy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Settings className="w-4 h-4" /> Monthly Maintenance Tasks</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Sync & Fix Data</h4>
                    <p className="text-sm text-slate-600 mb-3">Use the helper buttons if data looks inconsistent.</p>
                    <ul className="list-disc pl-5 text-sm text-slate-500 space-y-1">
                      <li>Go to <strong>Invoices</strong> → Click "Fix & Sync Data" to reconcile statuses.</li>
                      <li>Go to <strong>Outside Income</strong> → Click "Fix Amounts" if totals look wrong.</li>
                    </ul>
                  </div>
                  <div className="border p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Verify Auto-Generated Records</h4>
                    <p className="text-sm text-slate-600 mb-3">Check system generated records.</p>
                    <ul className="list-disc pl-5 text-sm text-slate-500 space-y-1">
                      <li>Check <strong>Hartford Hospital Directorship</strong> invoices (auto-created).</li>
                      <li>Verify <strong>St. Francis</strong> outside income records generated from On-Call schedule.</li>
                    </ul>
                  </div>
                </div>

                <h3 className="font-semibold flex items-center gap-2 mt-6"><ShieldAlert className="w-4 h-4" /> Troubleshooting</h3>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="pdf">
                    <AccordionTrigger>PDF Generation Failed</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600">
                      If a UConn PDF fails to generate, try clicking the "Generate PDF" button on the invoice row again. If it persists, check that the invoice has valid "Outside Income" records linked with valid dates.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="allocation">
                    <AccordionTrigger>Payment Allocation Issues</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600">
                      If an invoice status isn't updating to "Paid", check the <strong>Payments</strong> page. Edit the relevant payment and ensure the allocation to that specific invoice is correct.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Steve's Checklist */}
        <TabsContent value="checklist">
          <Card className="border-l-4 border-l-blue-600">
            <CardHeader>
              <CardTitle>When Steve Is Out: Coverage Checklist</CardTitle>
              <CardDescription>Essential daily and weekly tasks to maintain operations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-8">
                  {/* Daily Tasks */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-600" /> Daily Tasks
                    </h3>
                    <div className="space-y-3 pl-2 border-l-2 border-slate-100">
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4" />
                        <div>
                          <p className="font-medium">Check Office Supply Orders</p>
                          <p className="text-sm text-slate-500">Review "Pending Review" orders on the Dashboard. Approve or Reject office supplies.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4" />
                        <div>
                          <p className="font-medium">Monitor Dashboard Alerts</p>
                          <p className="text-sm text-slate-500">Look for red alerts regarding License or Privilege expirations.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Weekly Tasks */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-orange-600" /> Weekly Tasks
                    </h3>
                    <div className="space-y-3 pl-2 border-l-2 border-slate-100">
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4" />
                        <div>
                          <p className="font-medium">Process Outside Income</p>
                          <p className="text-sm text-slate-500">Enter any new timesheets or RVU logs received from providers into the <strong>Outside Income</strong> module.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4" />
                        <div>
                          <p className="font-medium">Generate Invoices</p>
                          <p className="text-sm text-slate-500">Go to Outside Income, filter for "Pending", select records, and create invoices for completed months.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4" />
                        <div>
                          <p className="font-medium">Send Invoices</p>
                          <p className="text-sm text-slate-500">Check <strong>Invoices</strong> page for "Draft" status. Review PDFs and send to vendors.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Tasks */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-600" /> Monthly Tasks
                    </h3>
                    <div className="space-y-3 pl-2 border-l-2 border-slate-100">
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4" />
                        <div>
                          <p className="font-medium">Reconcile Payments</p>
                          <p className="text-sm text-slate-500">Log received checks in <strong>Payments</strong> module and allocate them to open invoices.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4" />
                        <div>
                          <p className="font-medium">Run Reports</p>
                          <p className="text-sm text-slate-500">Go to <strong>Reports</strong> page and generate the "Monthly Financials" report for leadership.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4" />
                        <div>
                          <p className="font-medium">Update On-Call Schedule</p>
                          <p className="text-sm text-slate-500">Ensure next month's schedule is fully populated in <strong>On-Call Schedule</strong>.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}