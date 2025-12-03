import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertCircle, FileText, Settings, Users, DollarSign, Calendar, ClipboardList, ShieldAlert, Package, CreditCard, Bell } from "lucide-react";

export default function Documentation() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">System Documentation</h1>
        <p className="text-slate-600 mt-2">Comprehensive operating procedures, system logic, and maintenance guides for the ENTIC Operations Center.</p>
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
            {/* INVOICES SOP */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" /> Invoices Module</CardTitle>
                <CardDescription>Billing workflows for all facility types</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  <AccordionItem value="create">
                    <AccordionTrigger>Creating Standard Invoices</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p>1. Navigate to <strong>Invoices</strong> page.</p>
                      <p>2. Click <strong>Create Invoice</strong>.</p>
                      <p>3. Select <strong>Program Group</strong> and <strong>Staff Member</strong>.</p>
                      <p>4. <strong>Link Income:</strong> Select "Pending" records from the list. The system auto-calculates the <em>Days Worked</em> and <em>Total Amount</em>.</p>
                      <p>5. <strong>Month:</strong> Auto-filled based on the linked income dates (e.g., "October 2024").</p>
                      <p>6. Click <strong>Create Invoice</strong>.</p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="uconn">
                    <AccordionTrigger>UConn Specific Workflow</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p><strong>Auto-Numbering:</strong> UConn invoices automatically get the next sequential invoice number (e.g., 40, 41) based on the <em>ProgramLocation</em> counter.</p>
                      <p><strong>PDF Generation:</strong></p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>The system automatically generates a PDF using the official UConn template upon creation.</li>
                        <li>It populates rows with: <em>Provider Name + Date Worked</em>, <em>Rate</em>, <em>Total</em>.</li>
                        <li>If successful, the invoice status updates to <strong>Sent to Vendor</strong> automatically.</li>
                        <li><strong>Manual Regen:</strong> Click the "File Down" icon (⬇️) on the invoice row to regenerate/download the PDF if needed.</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="hartford">
                    <AccordionTrigger>Hartford Hospital Directorships</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p><strong>Automation:</strong> When you create a standard RVU invoice for Hartford Hospital:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>The system checks if a <em>Directorship</em> income record exists for that provider/month.</li>
                        <li>If found, it <strong>automatically creates a second invoice</strong> for the Directorship (flat $3,250).</li>
                        <li>The new invoice number will be "<em>Original# (Directorship)</em>".</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            {/* OUTSIDE INCOME SOP */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-600" /> Outside Income</CardTitle>
                <CardDescription>Tracking earnings & shifts</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  <AccordionItem value="entry">
                    <AccordionTrigger>Manual Entry vs. Auto-Generation</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p><strong>Manual Entry:</strong> Use for ad-hoc shifts or corrections. Click "Add Income", select Facility, enter Dates/RVUs.</p>
                      <p><strong>St. Francis Auto-Gen:</strong></p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Go to <strong>On-Call Schedule</strong>.</li>
                        <li>Click <strong>Link St. Francis Providers</strong> (via "Fix/Sync" logic if available).</li>
                        <li>System reads the schedule and creates pending Income records for St. Francis shifts automatically.</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="rvu">
                    <AccordionTrigger>RVU vs. Daily Rates</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p><strong>Standard:</strong> Calculates as <em>Days Worked × Daily Rate</em>.</p>
                      <p><strong>Hartford RVU:</strong> Enter <em>Total RVUs</em> instead of days. Calculates as <em>RVUs × Rate</em>.</p>
                      <p><strong>Directorship:</strong> Flat fee (usually $3,250/mo). Days worked is 0.</p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            {/* PAYMENTS SOP */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-emerald-600" /> Payments & Allocations</CardTitle>
                <CardDescription>Reconciling bank deposits</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  <AccordionItem value="receive">
                    <AccordionTrigger>Receiving a Payment</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p>1. Go to <strong>Payments</strong> → <strong>Add Payment</strong>.</p>
                      <p>2. Enter Total Amount, Date, and Payer (e.g., "UConn Health").</p>
                      <p>3. <strong>Allocation (Critical):</strong></p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>You MUST allocate the funds to specific Invoices.</li>
                        <li>Click "Add Allocation" in the form.</li>
                        <li>Select the Invoice. The system suggests the open balance.</li>
                        <li>Save. The Invoice status automatically updates to <strong>Paid to ENTIC</strong> if fully paid.</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            {/* SUPPLIES SOP */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-orange-600" /> Supply Orders</CardTitle>
                <CardDescription>Office & Clinical procurement</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  <AccordionItem value="workflow">
                    <AccordionTrigger>Approval Workflow</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p>1. <strong>Request:</strong> Staff submits request via public/internal form. Status: <em>Pending Review</em>.</p>
                      <p>2. <strong>Review:</strong> Manager checks <strong>Office/Clinical Orders</strong> page.</p>
                      <p>3. <strong>Action:</strong></p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li><strong>Approve:</strong> Status changes to <em>Pending Fulfillment</em> (or <em>Order Placed</em> depending on config).</li>
                        <li><strong>Reject:</strong> Enter reason. Status changes to <em>Rejected</em>.</li>
                      </ul>
                      <p>4. <strong>Fulfillment:</strong> When items arrive, mark individual items as "Received". When all items are received, Order Status becomes <em>Received</em>.</p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SYSTEM LOGIC */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>How the System Works (The "Magic")</CardTitle>
              <CardDescription>Understanding the automation and data relationships</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              
              {/* Entity Relationships */}
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-slate-900 border-b pb-2">Data Relationships</h3>
                  <div className="space-y-4 text-sm text-slate-600">
                    <div className="bg-slate-50 p-4 rounded border">
                      <p className="font-semibold text-blue-700">1. Provider → Locations</p>
                      <p>Providers are linked to "Program Locations". This determines which facilities appear in dropdowns when logging income for that provider.</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded border">
                      <p className="font-semibold text-green-700">2. Outside Income → Invoice</p>
                      <p>Many <em>Income Records</em> (shifts) can be linked to one <em>Invoice</em>. <br/>
                      <strong>Logic:</strong> Sum(Income Amounts) = Invoice Subtotal.</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded border">
                      <p className="font-semibold text-emerald-700">3. Payment → Allocation → Invoice</p>
                      <p>One <em>Payment</em> (e.g., a $10k check) can be split across multiple <em>Invoices</em> via "Allocations". <br/>
                      <strong>Logic:</strong> Invoice Status checks: <em>Amount Expected - Sum(Allocations) = 0?</em> → Mark Paid.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-slate-900 border-b pb-2">Automated Jobs</h3>
                  <ul className="space-y-3 text-sm text-slate-600">
                    <li className="flex gap-2">
                      <Settings className="w-5 h-5 text-slate-400 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-800">License Expiration Checker</span>
                        <p>Runs daily. Checks <em>Licenses</em> and <em>Privileges</em>. If (Expiration - Today) = 90, 60, or 30 days, it flags the dashboard.</p>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <Settings className="w-5 h-5 text-slate-400 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-800">Invoice Status Sync</span>
                        <p>Runs in background. Ensures <em>Paid</em> status is accurate based on total payments received. If you manually change a status, it sets a "Manual Override" flag to stop this sync.</p>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <Settings className="w-5 h-5 text-slate-400 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-800">St. Francis Schedule Sync</span>
                        <p>Can be triggered manually. Reads "On-Call Schedule" for St. Francis locations and generates corresponding "Outside Income" records so you don't have to double-entry.</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Critical Logic: The "Manual Override"</h3>
                <p className="text-sm text-blue-800">
                  If you manually change an Invoice Status (e.g., forcing it to "Paid" without a payment record), the system sets a <strong>manual_status_override</strong> flag. 
                  This prevents the automated sync from reverting your change. You will see a lock icon (🔒) on the invoice row. 
                  Click the lock to remove the override and let the system manage the status again.
                </p>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* MAINTENANCE GUIDE */}
        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance & Troubleshooting</CardTitle>
              <CardDescription>Tools to keep data clean and accurate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h3 className="font-bold text-slate-900">The "Fix" Buttons</h3>
                  <p className="text-sm text-slate-600">Use these when data looks "off" or out of sync.</p>
                  
                  <div className="border rounded-lg p-3 bg-slate-50 mt-2">
                    <p className="font-medium text-sm">"Fix & Sync Data" (Invoices Page)</p>
                    <p className="text-xs text-slate-500 mt-1">
                      • Recalculates "Amount Received" for all invoices based on payments.<br/>
                      • Updates statuses to "Paid to ENTIC" if fully paid.<br/>
                      • Fixes any broken links between Invoices and Income records.
                    </p>
                  </div>

                  <div className="border rounded-lg p-3 bg-slate-50 mt-2">
                    <p className="font-medium text-sm">"Fix Amounts" (Outside Income Page)</p>
                    <p className="text-xs text-slate-500 mt-1">
                      • Re-runs the math: <em>Days × Rate</em> = Total.<br/>
                      • Useful if you changed a provider's daily rate and want to update old records.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-slate-900">Common Issues & Solutions</h3>
                  
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="pdf-fail">
                      <AccordionTrigger className="text-sm">UConn PDF is Blank/Wrong</AccordionTrigger>
                      <AccordionContent className="text-xs text-slate-600">
                        <strong>Cause:</strong> Usually missing "Work Dates" on the linked Outside Income record.<br/>
                        <strong>Fix:</strong> Go to Outside Income, find the record, add specific dates. Then go back to Invoices and click the "File Down" icon to regenerate.
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="status-stuck">
                      <AccordionTrigger className="text-sm">Invoice Won't Mark "Paid"</AccordionTrigger>
                      <AccordionContent className="text-xs text-slate-600">
                        <strong>Cause:</strong> Total Allocations are less than Amount Expected (even by $0.01).<br/>
                        <strong>Fix:</strong> Check the "Balance" column. If it's pennies, edit the Payment Allocation to match the Invoice Total exactly.
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="duplicate">
                      <AccordionTrigger className="text-sm">Duplicate Invoices Created</AccordionTrigger>
                      <AccordionContent className="text-xs text-slate-600">
                        <strong>Cause:</strong> Double-clicking "Create" or sync lag.<br/>
                        <strong>Fix:</strong> Delete the duplicate. The linked "Outside Income" records will revert to "Pending". You can then re-link them to the correct invoice if needed.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* STEVE'S CHECKLIST */}
        <TabsContent value="checklist">
          <Card className="border-l-4 border-l-blue-600 bg-slate-50/50">
            <CardHeader>
              <CardTitle>When Steve Is Out: Coverage Checklist</CardTitle>
              <CardDescription>Essential tasks to ensure zero downtime</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-8">
                  
                  {/* DAILY */}
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-600" /> Daily Checks (Morning)
                    </h3>
                    <div className="space-y-4">
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4 cursor-pointer" />
                        <div>
                          <p className="font-bold text-slate-800">1. Check Office Supply Orders</p>
                          <p className="text-sm text-slate-600">Go to <strong>Office Orders</strong>. Filter by "Pending Review". Approve urgent requests so Amazon orders aren't delayed.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4 cursor-pointer" />
                        <div>
                          <p className="font-bold text-slate-800">2. Dashboard "Red" Alerts</p>
                          <p className="text-sm text-slate-600">Look at the top cards on <strong>Dashboard</strong>. If "Expiring Licenses" > 0, click it and email the provider immediately.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* WEEKLY */}
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-orange-600" /> Weekly Tasks (Friday)
                    </h3>
                    <div className="space-y-4">
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4 cursor-pointer" />
                        <div>
                          <p className="font-bold text-slate-800">1. Log Outside Income</p>
                          <p className="text-sm text-slate-600">Collect emails/texts from providers about shifts worked. Enter them into <strong>Outside Income</strong>.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4 cursor-pointer" />
                        <div>
                          <p className="font-bold text-slate-800">2. Generate "Draft" Invoices</p>
                          <p className="text-sm text-slate-600">For any completed work, create the invoice so it's ready for review. Don't send yet if unsure.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4 cursor-pointer" />
                        <div>
                          <p className="font-bold text-slate-800">3. Sync St. Francis</p>
                          <p className="text-sm text-slate-600">Go to <strong>Outside Income</strong> → Click "Link St. Francis Providers" to pull data from the On-Call Schedule.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MONTHLY */}
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-600" /> Monthly Tasks (1st - 5th)
                    </h3>
                    <div className="space-y-4">
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4 cursor-pointer" />
                        <div>
                          <p className="font-bold text-slate-800">1. The "Big Send"</p>
                          <p className="text-sm text-slate-600">Review all Draft invoices. Check PDFs. Mark status as "Sent to Vendor" and email them to AP departments.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4 cursor-pointer" />
                        <div>
                          <p className="font-bold text-slate-800">2. Reconcile Payments</p>
                          <p className="text-sm text-slate-600">Gather bank deposit slips. Enter in <strong>Payments</strong>. Allocating them is crucial for the provider payout report.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" className="mt-1 w-4 h-4 cursor-pointer" />
                        <div>
                          <p className="font-bold text-slate-800">3. Provider Payouts</p>
                          <p className="text-sm text-slate-600">Go to <strong>Reports</strong> → <strong>Monthly Financials</strong>. Export the CSV. This tells payroll how much to pay each doctor.</p>
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