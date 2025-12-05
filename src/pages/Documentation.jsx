import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertCircle, FileText, Settings, Users, DollarSign, Calendar, ClipboardList, ShieldAlert, Package, CreditCard, Bell, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Documentation() {
  return (
    <div className="container mx-auto py-2 px-4 max-w-6xl h-[calc(100vh-8.5rem)] flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-900">System Documentation</h1>
        <p className="text-slate-600 mt-1 text-sm">Comprehensive operating procedures, system logic, and maintenance guides for the ENTIC Operations Center.</p>
      </div>

      <Tabs defaultValue="sops" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto flex-shrink-0 gap-1 bg-slate-100/50 p-1">
          <TabsTrigger value="sops" className="py-2 px-1 h-auto whitespace-normal text-center text-xs md:text-sm">SOPs (Modules)</TabsTrigger>
          <TabsTrigger value="system" className="py-2 px-1 h-auto whitespace-normal text-center text-xs md:text-sm">How System Works</TabsTrigger>
          <TabsTrigger value="maintenance" className="py-2 px-1 h-auto whitespace-normal text-center text-xs md:text-sm">Maintenance Guide</TabsTrigger>
          <TabsTrigger value="checklist" className="py-2 px-1 h-auto whitespace-normal text-center text-xs md:text-sm">Steve's Checklist</TabsTrigger>
          <TabsTrigger value="manual" className="py-2 px-1 h-auto whitespace-normal text-center text-xs md:text-sm">User Manual</TabsTrigger>
        </TabsList>

        {/* SOPs Content */}
        <TabsContent value="sops" className="flex-1 overflow-hidden mt-4">
          <ScrollArea className="h-full pr-4">
            <div className="grid gap-6 md:grid-cols-2 pb-6">
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
                  <AccordionItem value="manchester">
                    <AccordionTrigger>Manchester / ECHN Workflow</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p><strong>PDF Generation:</strong> Uses a specific Manchester-formatted template.</p>
                      <p><strong>Airtable Sync & Emailing:</strong></p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Once invoices are approved (have a PDF), select them in the list.</li>
                        <li>Click the <strong>Sync to Airtable</strong> button (Cloud Icon).</li>
                        <li>This triggers an automated email draft to <em>apacileo@echn.org</em> (Ann Marie).</li>
                        <li>The email body includes a bulleted list of providers and attaches all selected invoices as a single package.</li>
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
                        <li>System reads the schedule and creates pending Income records for St. Francis shifts automatically when a schedule is created or updated.</li>
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
                      <p className="mt-2"><strong>Bulk Add:</strong> Use the "Bulk Add" button to select multiple invoices at once. The list now shows the <strong>Month</strong> column to help you pick the correct invoice for recurring payments.</p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="remittance">
                    <AccordionTrigger>Remittance Advice</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p>When recording a payment, you can now <strong>attach a file</strong> (PDF, Image) as the Remittance Advice.</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Click "Attach Remittance" in the payment form.</li>
                        <li>Upload the document.</li>
                        <li>Once saved, a "View Attached Remittance Document" link appears in the Payment Details modal.</li>
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

            {/* REPORTS SOP */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-purple-600" /> Reports Module</CardTitle>
                <CardDescription>Financial & Operational Insights</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  <AccordionItem value="financials">
                    <AccordionTrigger>Key Financial Reports</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p><strong>Payment Tracking:</strong> Comprehensive view of all payments and their allocations.</p>
                      <p><strong>Invoice Aging:</strong> Breakdown of outstanding invoices by age (30/60/90 days) to prioritize collections.</p>
                      <p><strong>Monthly Financials:</strong> Essential for provider payouts. Shows exactly how much was collected for each provider in a given month.</p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="operational">
                    <AccordionTrigger>Operational Reports</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p><strong>Supply Orders:</strong> Analyze spending by location or month to identify trends.</p>
                      <p><strong>Unlinked Invoices:</strong> Quickly find invoices that haven't been paid or allocated yet.</p>
                      <p><strong>Outside Income:</strong> Summary of all logged shifts and revenue by facility.</p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
          </ScrollArea>
        </TabsContent>

        {/* SYSTEM LOGIC */}
        <TabsContent value="system" className="flex-1 overflow-hidden mt-4">
          <ScrollArea className="h-full pr-4">
            <Card className="mb-6">
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
                      <p className="mt-2 pt-2 border-t border-slate-200 font-medium text-xs">Auto-Month Calculation:</p>
                      <p className="text-xs">The "Payment Month" field automatically updates to list the months of all linked invoices (e.g., "October 2025, November 2025").</p>
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
                    {/* St. Francis Sync Removed */}
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
          </ScrollArea>
        </TabsContent>

        {/* MAINTENANCE GUIDE */}
        <TabsContent value="maintenance" className="flex-1 overflow-hidden mt-4">
          <ScrollArea className="h-full pr-4">
            <Card className="mb-6">
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
                      <AccordionTrigger className="text-sm">UConn/Manchester PDF is Blank/Wrong</AccordionTrigger>
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
          </ScrollArea>
        </TabsContent>

        {/* STEVE'S CHECKLIST */}
        <TabsContent value="checklist" className="flex-1 overflow-hidden mt-4">
          <ScrollArea className="h-full pr-4">
            <Card className="border-l-4 border-l-blue-600 bg-slate-50/50 mb-6">
              <CardHeader>
                <CardTitle>When Steve Is Out: Coverage Checklist</CardTitle>
              <CardDescription>Essential tasks to ensure zero downtime</CardDescription>
            </CardHeader>
            <CardContent>
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
                          <p className="text-sm text-slate-600">Look at the top cards on <strong>Dashboard</strong>. If "Expiring Licenses" &gt; 0, click it and email the provider immediately.</p>
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
                      {/* St. Francis Sync Task Removed - Now Automatic */}
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
            </CardContent>
          </Card>
          </ScrollArea>
        </TabsContent>

        {/* USER MANUAL */}
        <TabsContent value="manual" className="flex-1 overflow-hidden mt-4">
          <style>{`
            @media print {
              @page { margin: 15mm; size: auto; }
              
              /* GLOBAL RESET */
              html, body {
                height: auto !important;
                min-height: 0 !important;
                overflow: visible !important;
                background: white !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
              }

              /* HIDE EVERYTHING BY DEFAULT */
              body * {
                visibility: hidden;
              }
              
              /* TARGET THE INNER CONTENT DIRECTLY */
              .manual-inner-content, 
              .manual-inner-content * { 
                visibility: visible !important;
              }

              /* POSITION THE CONTENT AT THE TOP, BYPASSING PARENTS */
              .manual-inner-content {
                position: absolute;
                left: 0;
                top: 0;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                display: block !important;
                background: white !important;
                z-index: 9999;
              }
              
              /* Ensure text is black and readable */
              .manual-inner-content p, 
              .manual-inner-content li,
              .manual-inner-content h1,
              .manual-inner-content h2,
              .manual-inner-content h3,
              .manual-inner-content h4 {
                 color: black !important;
              }

              /* Hide TOC explicitly */
              .manual-toc-section {
                display: none !important;
              }

              section {
                page-break-inside: avoid;
                margin-bottom: 30px !important;
                border-bottom: 1px solid #eee;
                padding-bottom: 20px;
              }

              /* TEXT STYLING */
              h1, h2, h3, h4 { color: black !important; }
              p, li { color: black !important; font-size: 12pt !important; }
              a { text-decoration: none !important; color: black !important; }

              /* UTILS */
              .no-print { display: none !important; }
            }
          `}</style>
          <div className="h-full flex flex-col">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 flex-shrink-0 flex flex-row items-center justify-between">
                <div>
                  <CardTitle>ENTIC Operations Center User Manual</CardTitle>
                  <CardDescription>A complete guide to navigating and using the system</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 no-print">
                  <Printer className="w-4 h-4" />
                  Print Manual
                </Button>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <div className="grid md:grid-cols-[250px_1fr] divide-x divide-slate-100 h-full manual-print-wrapper">
                  <div className="p-4 bg-slate-50/50 overflow-y-auto manual-toc-section">
                    <h4 className="font-semibold text-sm text-slate-900 mb-3">Table of Contents</h4>
                    <nav className="space-y-1 text-sm">
                      <a href="#dashboard" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">1. Dashboard</a>
                      <a href="#providers" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">2. Provider Management</a>
                      <a href="#billing" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">3. Billing & Invoices</a>
                      <a href="#payments" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">4. Payments & Allocations</a>
                      <a href="#supplies" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">5. Supply Management</a>
                      <a href="#compliance" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">6. Compliance & Tracking</a>
                      <a href="#reports" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">7. Reports</a>
                    </nav>
                  </div>
                  
                  <ScrollArea className="h-full manual-content-section">
                    <div className="p-8 space-y-10 manual-inner-content">
                      
                      {/* 1. Dashboard */}
                      <section id="dashboard" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-blue-100 p-2 rounded-lg"><Settings className="w-5 h-5 text-blue-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">1. Dashboard</h3>
                        </div>
                        <div className="prose prose-sm text-slate-600 max-w-none">
                          <p>The <strong>Dashboard</strong> is your mission control center. It provides a real-time snapshot of the practice's health.</p>
                          <ul className="list-disc pl-4 space-y-2 mt-2">
                            <li><strong>Alerts:</strong> Red/Yellow alerts at the top highlight urgent actions like expiring licenses, pending approvals, or overdue invoices.</li>
                            <li><strong>Summary Cards:</strong> Quick counts of supply orders, draft invoices, and other pending items.</li>
                            <li><strong>Financial Overview:</strong> A high-level view of what's owed to ENTIC, what's been collected, and what's owed to providers.</li>
                            <li><strong>Customization:</strong> Use the "Customize Dashboard" button to show/hide widgets based on your role.</li>
                          </ul>
                        </div>
                      </section>

                      {/* 2. Provider Management */}
                      <section id="providers" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-purple-100 p-2 rounded-lg"><Users className="w-5 h-5 text-purple-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">2. Provider Management</h3>
                        </div>
                        <div className="prose prose-sm text-slate-600 max-w-none">
                          <p>Manage all staff details in the <strong>Providers</strong> module.</p>
                          <h4 className="font-bold text-slate-800 mt-4">Key Features:</h4>
                          <ul className="list-disc pl-4 space-y-2">
                            <li><strong>Profile:</strong> Store email, phone, role, and program locations.</li>
                            <li><strong>Status:</strong> Toggle between Active/Inactive. Inactive providers are hidden from most lists.</li>
                            <li><strong>Documents:</strong> Upload and track employment contracts or other HR docs.</li>
                            <li><strong>Terminations:</strong> Set a termination date, and the system will auto-deactivate the provider after that date passes.</li>
                          </ul>
                        </div>
                      </section>

                      {/* 3. Billing & Invoices */}
                      <section id="billing" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-green-100 p-2 rounded-lg"><FileText className="w-5 h-5 text-green-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">3. Billing & Invoices</h3>
                        </div>
                        <div className="prose prose-sm text-slate-600 max-w-none">
                          <p>This is the core revenue engine. The flow moves from <em>Outside Income</em> → <em>Invoices</em>.</p>
                          
                          <h4 className="font-bold text-slate-800 mt-4">Outside Income (The "Shift" Logger)</h4>
                          <p>Log every shift or service here. You can enter them manually or let the system auto-generate them from the On-Call Schedule.</p>
                          
                          <h4 className="font-bold text-slate-800 mt-4">Invoices (The "Bill")</h4>
                          <p>Group multiple income records into a single invoice to send to a facility (e.g., "November 2025 Invoices for UConn").</p>
                          <ul className="list-disc pl-4 space-y-2">
                            <li><strong>Creation:</strong> Select a provider and program. The system finds all "Pending" income records for them.</li>
                            <li><strong>PDF Generation:</strong> For UConn and Manchester, the system auto-generates a PDF using their official templates.</li>
                            <li><strong>Status Tracking:</strong> Monitor the lifecycle from <em>Draft</em> → <em>Sent to Vendor</em> → <em>Paid</em>.</li>
                          </ul>
                        </div>
                      </section>

                      {/* 4. Payments & Allocations */}
                      <section id="payments" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-emerald-100 p-2 rounded-lg"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">4. Payments & Allocations</h3>
                        </div>
                        <div className="prose prose-sm text-slate-600 max-w-none">
                          <p>When money hits the bank, log it here. <strong>Crucial Rule:</strong> Never just log a total; you must allocate it.</p>
                          
                          <h4 className="font-bold text-slate-800 mt-4">How to Process a Check:</h4>
                          <ol className="list-decimal pl-4 space-y-2">
                            <li>Create a new Payment record with the total check amount.</li>
                            <li><strong>Attach Remittance:</strong> Upload the scan/PDF of the check or remittance advice.</li>
                            <li><strong>Allocate:</strong> Click "Add Allocation" and select the invoices this check pays for.</li>
                            <li><strong>Save:</strong> The system updates invoice balances. If an invoice is fully paid, its status flips to "Paid to ENTIC".</li>
                          </ol>
                        </div>
                      </section>

                      {/* 5. Supply Management */}
                      <section id="supplies" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-orange-100 p-2 rounded-lg"><Package className="w-5 h-5 text-orange-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">5. Supply Management</h3>
                        </div>
                        <div className="prose prose-sm text-slate-600 max-w-none">
                          <p>Manage inventory requests for both Office and Clinical supplies.</p>
                          <ul className="list-disc pl-4 space-y-2 mt-2">
                            <li><strong>Catalogs:</strong> Define standard items (toner, gloves, paper) in the catalogs to make ordering easy.</li>
                            <li><strong>Requests:</strong> Staff use a simplified form to request items.</li>
                            <li><strong>Fulfillment:</strong> Managers review requests. Mark as "Ordered" when you buy them, and "Received" when they arrive.</li>
                            <li><strong>Partial Receipt:</strong> You can mark individual line items as received if a shipment is split.</li>
                          </ul>
                        </div>
                      </section>

                      {/* 6. Compliance & Tracking */}
                      <section id="compliance" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-red-100 p-2 rounded-lg"><ShieldAlert className="w-5 h-5 text-red-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">6. Compliance & Tracking</h3>
                        </div>
                        <div className="prose prose-sm text-slate-600 max-w-none">
                          <p>Keep the practice legal and compliant.</p>
                          <ul className="list-disc pl-4 space-y-2 mt-2">
                            <li><strong>Licenses:</strong> Track expiration dates for Medical Licenses, DEA, etc. The system alerts you 90/60/30 days out.</li>
                            <li><strong>Privileges:</strong> Track hospital privileges per facility.</li>
                            <li><strong>CME:</strong> Log Continuing Medical Education credits. The dashboard tracks if doctors meet their annual quota (3 credits).</li>
                            <li><strong>Time Off:</strong> Calendar view of provider vacations and time off.</li>
                          </ul>
                        </div>
                      </section>

                      {/* 7. Reports */}
                      <section id="reports" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-indigo-100 p-2 rounded-lg"><ClipboardList className="w-5 h-5 text-indigo-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">7. Reports</h3>
                        </div>
                        <div className="prose prose-sm text-slate-600 max-w-none">
                          <p>Export data for accounting and payroll.</p>
                          <ul className="list-disc pl-4 space-y-2 mt-2">
                            <li><strong>Monthly Financials:</strong> The "Payout Bible". Shows exactly what each provider earned and collected for a specific month.</li>
                            <li><strong>Invoice Aging:</strong> See who owes money and how long it's been outstanding.</li>
                            <li><strong>Payment Tracking:</strong> Detailed audit trail of every dollar received.</li>
                            <li><strong>Supply Analysis:</strong> See which locations are spending the most on supplies.</li>
                          </ul>
                        </div>
                      </section>

                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex-shrink-0">
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-blue-100 p-2 rounded-full">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Questions or Concerns?</h3>
              <p className="text-slate-600 text-xs">
                Please email your system administrator, <strong>Steve Brown</strong>, at <a href="mailto:steve.brown@enticmd.com" className="text-blue-600 hover:underline">steve.brown@enticmd.com</a>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}