import React, { useState } from "react";
import { createPortal } from "react-dom";
import PrintableManual from "@/components/documentation/PrintableManual";
import PrintableAdminManual from "@/components/documentation/PrintableAdminManual";
import ContactReferenceSheet from "@/components/documentation/ContactReferenceSheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertCircle, FileText, Settings, Users, DollarSign, Calendar, ClipboardList, ShieldAlert, Package, CreditCard, Bell, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Shield, PackagePlus } from "lucide-react";

function RedactButton() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleRedact = async () => {
    if (!confirm("Are you sure? This will scan all invoices and overwrite files to redact sensitive info. This process may take a few minutes.")) return;
    
    setLoading(true);
    toast({ title: "Started", description: "Batch redaction started..." });
    
    try {
      const res = await base44.functions.invoke('batchRedactInvoices');
      toast({ 
        title: "Completed", 
        description: `Processed ${res.data.processed} invoices. Check console for details.` 
      });
      console.log("Redaction results:", res.data);
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleRedact} disabled={loading} className="h-7 text-xs gap-1">
      <Shield className="w-3 h-3" />
      {loading ? "Processing..." : "Redact All Invoices"}
    </Button>
  );
}

function SyncHenryScheinButton() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleSync = async () => {
    if (!confirm("Sync unlinked Henry Schein invoices to Clinical Supply Orders?")) return;
    
    setLoading(true);
    toast({ title: "Sync Started", description: "Finding unlinked invoices..." });
    
    try {
      const res = await base44.functions.invoke('syncHenryScheinToOrders');
      toast({ 
        title: "Sync Completed", 
        description: `Created ${res.data.processed} new supply orders.` 
      });
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleSync} disabled={loading} className="h-7 text-xs gap-1 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
      <PackagePlus className="w-3 h-3" />
      {loading ? "Syncing..." : "Sync Henry Schein Orders"}
    </Button>
  );
}

function FixVendorDataButton() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleFix = async () => {
    if (!confirm("Update all existing vendor invoices to fix capitalization (e.g. HENRY -> Henry) and link missing locations?")) return;
    
    setLoading(true);
    toast({ title: "Fix Started", description: "Scanning invoices..." });
    
    try {
      const res = await base44.functions.invoke('fixVendorInvoiceData');
      toast({ 
        title: "Fix Completed", 
        description: res.data.message
      });
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleFix} disabled={loading} className="h-7 text-xs gap-1 bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
      <RefreshCw className="w-3 h-3" />
      {loading ? "Fixing..." : "Fix Vendor Data"}
    </Button>
  );
}

function ForceRedactHenryButton() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const queryClient = useQueryClient();

  const handleForce = async () => {
    if (!confirm("Force re-redact all Henry Schein invoices (DEBUG MODE: Red Box)? This will overwrite current files.")) return;

    setLoading(true);
    toast({ title: "Redaction Started", description: "Processing Henry Schein invoices..." });

    try {
      const res = await base44.functions.invoke('forceRedactAll');
      // Invalidate queries to force refresh of file URLs
      await queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });

      toast({ 
        title: "Completed", 
        description: `Re-redacted ${res.data.count} Henry Schein invoices. Please refresh the invoice list.`
      });
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleForce} disabled={loading} className="h-7 text-xs gap-1 bg-red-50 text-red-700 border-red-200 hover:bg-red-100">
      <Shield className="w-3 h-3" />
      {loading ? "Processing..." : "Force Redact (Henry Only)"}
    </Button>
  );
}

export default function Documentation() {
  const [activeTab, setActiveTab] = useState("sops");

  return (
    <div className="container mx-auto py-2 px-4 max-w-6xl h-[calc(100vh-8.5rem)] flex flex-col">
      <style>{`
        @media print {
          @page { 
            margin: 1.5cm; 
            size: auto; 
          }

          /* Hide the main app root */
          #root {
            display: none !important;
          }

          /* Reset body/html for full page printing */
          html, body {
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Show the portal and ensure it is visible */
          .print-portal {
            display: block !important;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: auto;
            background: white;
            z-index: 9999;
            visibility: visible !important;
          }

          /* Ensure all children of the portal are visible */
          .print-portal * {
            visibility: visible !important;
            color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          /* Utilities */
          .no-print { display: none !important; }
        }

        /* Hide portal on screen */
        .print-portal {
          display: none;
        }
      `}</style>

      {/* Render the print-optimized manual into the body based on active tab */}
      {createPortal(
        <div className="print-portal">
          {activeTab === 'admin' ? <PrintableAdminManual /> : activeTab === 'contacts' ? <ContactReferenceSheet /> : <PrintableManual />}
        </div>,
        document.body
      )}

      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-900">System Documentation</h1>
        <p className="text-slate-600 mt-1 text-sm">Comprehensive operating procedures, system logic, and maintenance guides for the ENTIC Operations Center.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto flex-shrink-0 gap-1 bg-slate-100/50 p-1">
          <TabsTrigger value="sops" className="py-2 px-1 h-auto whitespace-normal text-center text-xs md:text-sm">SOPs (Modules)</TabsTrigger>
          <TabsTrigger value="system" className="py-2 px-1 h-auto whitespace-normal text-center text-xs md:text-sm">How System Works</TabsTrigger>
          <TabsTrigger value="maintenance" className="py-2 px-1 h-auto whitespace-normal text-center text-xs md:text-sm">Maintenance</TabsTrigger>
          <TabsTrigger value="checklist" className="py-2 px-1 h-auto whitespace-normal text-center text-xs md:text-sm">Steve's Checklist</TabsTrigger>
          <TabsTrigger value="manual" className="py-2 px-1 h-auto whitespace-normal text-center text-xs md:text-sm">User Manual</TabsTrigger>
          <TabsTrigger value="contacts" className="py-2 px-1 h-auto whitespace-normal text-center text-xs md:text-sm">Contact Sheet</TabsTrigger>
          <TabsTrigger value="admin" className="py-2 px-1 h-auto whitespace-normal text-center text-xs md:text-sm font-medium text-red-600">Admin Manual</TabsTrigger>
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
                  <AccordionItem value="stfrancis">
                    <AccordionTrigger>St. Francis Workflow</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p><strong>Income Generation:</strong> St. Francis income records are often auto-generated from the On-Call Schedule (Daily Rate).</p>
                      <p><strong>Invoice Creation:</strong></p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Create a standard invoice. Select "St. Francis" as the Program Group.</li>
                        <li>Link the pending income records.</li>
                        <li>The system groups these into a standard invoice format.</li>
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

            {/* DOCUMENT MANAGEMENT SOP */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-600" /> Document Management</CardTitle>
                <CardDescription>Vendor Invoices & Processing</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  <AccordionItem value="upload">
                    <AccordionTrigger>Uploading & Splitting Invoices</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p><strong>Upload:</strong> Drag and drop PDF invoices into the <strong>Vendor Invoices</strong> folder.</p>
                      <p><strong>Split Multi-Invoice PDFs:</strong> Use the "Split Multi-Invoice PDF" button. The system AI analyzes the PDF, detects separate invoices, and splits them into individual records automatically.</p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="processing">
                    <AccordionTrigger>Processing & Allocations</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p><strong>AI Extraction:</strong> The system automatically reads Vendor Name, Invoice #, Date, and Total Amount.</p>
                      <p><strong>Linking:</strong> You can link an invoice to an existing Clinical Supply Order to mark it as "Received".</p>
                      <p><strong>Allocation (Splitting):</strong> If an invoice covers multiple locations, use the "Allocate" tab to select specific line items and move them to a new invoice/order for a different location. The original invoice total is reduced automatically.</p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="sync">
                    <AccordionTrigger>Resyncing Deleted Orders</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600 space-y-2">
                      <p>If you accidentally delete a Clinical Supply Order but still have the Vendor Invoice, you can use the <strong>Sync/Refresh</strong> button on the invoice list to recreate the order.</p>
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

                    <div className="bg-slate-50 p-4 rounded border">
                      <p className="font-semibold text-indigo-700">4. Vendor Invoice → Clinical Supply Order</p>
                      <p><strong>AI Processing:</strong> Uploaded PDFs are analyzed by AI to extract data.</p>
                      <p><strong>Allocation Logic:</strong> When you allocate line items from a main invoice to a location:
                      <br/>1. A <strong>New Clinical Supply Order</strong> is created for that location.
                      <br/>2. A <strong>New Vendor Invoice</strong> is created for that location.
                      <br/>3. The <strong>Original Invoice</strong> total is reduced by the allocated amount.
                      </p>
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
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-medium text-sm">"Redact All Invoices"</p>
                    <RedactButton />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    • Scans ALL historical invoices for the "Code Status Key" footer.<br/>
                    • Permanently blocks out everything below that line (DEA/Registry info).<br/>
                    • Updates the document file automatically.
                  </p>
                </div>

                <div className="border rounded-lg p-3 bg-slate-50 mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-medium text-sm">"Sync Henry Schein"</p>
                    <SyncHenryScheinButton />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    • Finds "Henry Schein" invoices that aren't linked to an order.<br/>
                    • Automatically creates Clinical Supply Orders for them.<br/>
                    • Links them together.
                  </p>
                </div>

                <div className="border rounded-lg p-3 bg-slate-50 mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-medium text-sm">"Fix Vendor Names/Locs"</p>
                    <FixVendorDataButton />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    • Fixes ALL CAPS vendor names (e.g. HENRY SCHEIN -> Henry Schein).<br/>
                    • Scans invoice data to link missing Locations (Glastonbury, etc).
                  </p>
                </div>

                <div className="border rounded-lg p-3 bg-slate-50 mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-medium text-sm">"Fix Catalog Codes"</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    • Scans all invoices and updates the Supply Catalog with missing item codes.<br/>
                    • Ensures future orders use the correct descriptions.
                  </p>
                </div>

                <div className="border rounded-lg p-3 bg-slate-50 mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-medium text-sm">"Force Redact Henry"</p>
                    <ForceRedactHenryButton />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    • Specifically targets Henry Schein invoices.<br/>
                    • Applies the new aggressive footer removal (bottom 25%) to existing files.<br/>
                    • Use this if old invoices still show the footer.
                  </p>
                </div>

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

        {/* ADMIN MANUAL */}
        <TabsContent value="admin" className="flex-1 overflow-hidden mt-4">
          <div className="h-full flex flex-col">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 flex-shrink-0 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-red-800 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" />
                    System Administrator Manual
                  </CardTitle>
                  <CardDescription>Advanced configuration, list management, and system internals</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 no-print">
                  <Printer className="w-4 h-4" />
                  Print Admin Manual
                </Button>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <div className="grid md:grid-cols-[250px_1fr] divide-x divide-slate-100 h-full">
                  <div className="p-4 bg-slate-50/50 overflow-y-auto">
                    <h4 className="font-semibold text-sm text-slate-900 mb-3">Admin Sections</h4>
                    <nav className="space-y-1 text-sm">
                      <a href="#admin-1" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">1. System Architecture</a>
                      <a href="#admin-2" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">2. Backend Registry</a>
                      <a href="#admin-3" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">3. Integration (Airtable)</a>
                      <a href="#admin-4" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">4. UConn Workflow</a>
                      <a href="#admin-5" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">5. Manchester Workflow</a>
                      <a href="#admin-6" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">6. Hartford/St. Francis</a>
                      <a href="#admin-7" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">7. Reminders Workflow</a>
                      <a href="#admin-8" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">8. Automated Tasks</a>
                      <a href="#admin-9" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">9. Maintenance</a>
                      <a href="#admin-10" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">10. Doc Management</a>
                    </nav>
                  </div>
                  
                  <ScrollArea className="h-full">
                    <div className="p-8 manual-admin-preview">
                      <div className="prose prose-sm max-w-none text-slate-600">
                        <p className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-yellow-800 mb-6">
                          <strong>Note:</strong> This view is a preview. Use the "Print Admin Manual" button to generate the clean, full-page document.
                        </p>
                        <PrintableAdminManual />
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CONTACT SHEET */}
        <TabsContent value="contacts" className="flex-1 overflow-hidden mt-4">
          <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 px-1 no-print">
               <div className="text-sm text-slate-500 italic">
                 This sheet is optimized for printing
               </div>
               <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
                  <Printer className="w-4 h-4" />
                  Print Contact Sheet
               </Button>
            </div>
            <ScrollArea className="h-full pr-4">
               <div className="pb-6">
                  <ContactReferenceSheet />
               </div>
            </ScrollArea>
          </div>
        </TabsContent>

        {/* USER MANUAL */}
        <TabsContent value="manual" className="flex-1 overflow-hidden mt-4">
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
                      <a href="#oncall" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">3. On-Call Schedule</a>
                      <a href="#billing" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">4. Billing & Invoices</a>
                      <a href="#payments" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">5. Payments & Allocations</a>
                      <a href="#supplies" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">6. Supply Management</a>
                      <a href="#compliance" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">7. Compliance & Tracking</a>
                      <a href="#reports" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">8. Reports</a>
                      <a href="#docs" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">9. Document Management</a>
                      <a href="#workflows" className="block px-2 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded">10. Facility Workflows</a>
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

                      {/* 3. On-Call Schedule */}
                      <section id="oncall" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-indigo-100 p-2 rounded-lg"><Calendar className="w-5 h-5 text-indigo-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">3. On-Call Schedule</h3>
                        </div>
                        <div className="prose prose-sm text-slate-600 max-w-none">
                          <p>Manage and view the provider rotation for all facilities. This schedule drives the automatic income generation for on-call shifts.</p>
                          <h4 className="font-bold text-slate-800 mt-4">Key Features:</h4>
                          <ul className="list-disc pl-4 space-y-2">
                            <li><strong>Views:</strong> Switch between Calendar view for a monthly overview and List view for detailed editing.</li>
                            <li><strong>Adding Shifts:</strong> Click "Add Schedule" to assign providers to locations.</li>
                            <li><strong>Auto-Income:</strong> For locations like St. Francis, the system can automatically create "Outside Income" records when you add a schedule.</li>
                            <li><strong>Filtering:</strong> Easily filter the schedule by Provider or Location to find specific shifts.</li>
                          </ul>
                        </div>
                      </section>

                      {/* 4. Billing & Invoices */}
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

                      {/* 5. Payments & Allocations */}
                      <section id="payments" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-emerald-100 p-2 rounded-lg"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">5. Payments & Allocations</h3>
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

                      {/* 6. Supply Management */}
                      <section id="supplies" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-orange-100 p-2 rounded-lg"><Package className="w-5 h-5 text-orange-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">6. Supply Management</h3>
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

                      {/* 7. Compliance & Tracking */}
                      <section id="compliance" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-red-100 p-2 rounded-lg"><ShieldAlert className="w-5 h-5 text-red-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">7. Compliance & Tracking</h3>
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

                      {/* 8. Reports */}
                      <section id="reports" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-indigo-100 p-2 rounded-lg"><ClipboardList className="w-5 h-5 text-indigo-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">8. Reports</h3>
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

                      {/* 9. Document Management */}
                      <section id="docs" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-blue-100 p-2 rounded-lg"><FileText className="w-5 h-5 text-blue-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">9. Document Management</h3>
                        </div>
                        <div className="prose prose-sm text-slate-600 max-w-none">
                          <p>Central repository for Vendor Invoices and other documents.</p>
                          <ul className="list-disc pl-4 space-y-2 mt-2">
                            <li><strong>Vendor Invoices:</strong> Upload PDF invoices. The system uses AI to extract data automatically.</li>
                            <li><strong>Split & Process:</strong> Upload a large PDF with multiple invoices, and the system will split it into individual records for you.</li>
                            <li><strong>Allocations:</strong> Easily split a large invoice by allocating specific items to different locations.</li>
                          </ul>
                        </div>
                      </section>

                      {/* 10. Facility Workflows */}
                      <section id="workflows" className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                          <div className="bg-indigo-100 p-2 rounded-lg"><RefreshCw className="w-5 h-5 text-indigo-600" /></div>
                          <h3 className="text-xl font-bold text-slate-900">10. Facility Workflows</h3>
                        </div>
                        <div className="prose prose-sm text-slate-600 max-w-none">
                          <p>Step-by-step guides for the most common billing scenarios.</p>

                          <div className="grid grid-cols-1 gap-6">
                            <div className="border rounded-lg p-4 bg-slate-50">
                              <h4 className="font-bold text-slate-900 mb-2 border-b pb-1">UConn & Manchester (ECHN)</h4>
                              <ol className="list-decimal pl-5 space-y-2 text-xs">
                                <li><strong>Create Invoice:</strong> Select Provider & Program Group (UConn or Manchester). Link the pending income records.</li>
                                <li><strong>Generate PDF:</strong> Once created, look for the "File Down" (⬇️) icon in the invoice list. Click it to generate the official PDF template.</li>
                                <li><strong>Sync & Send:</strong> Select the approved invoices and click the <strong>Cloud Icon</strong>.
                                  <ul className="list-disc pl-4 mt-1 text-slate-600">
                                    <li>This sends the PDF and data to the Notification system.</li>
                                    <li>An email is automatically drafted/sent to the AP department.</li>
                                  </ul>
                                </li>
                              </ol>
                            </div>

                            <div className="border rounded-lg p-4 bg-slate-50">
                              <h4 className="font-bold text-slate-900 mb-2 border-b pb-1">Hartford Hospital (Directorships)</h4>
                              <ol className="list-decimal pl-5 space-y-2 text-xs">
                                <li><strong>Check Schedule:</strong> Ensure the provider is scheduled for the month.</li>
                                <li><strong>Create RVU Invoice:</strong> Create a standard invoice for their RVU shifts.</li>
                                <li><strong>Auto-Detection:</strong> The system will check if they also have a "Directorship" role.</li>
                                <li><strong>Prompt:</strong> If found, you will be asked to create a <strong>Second Invoice</strong> for the flat Directorship fee (e.g., $3,250). Click Yes.</li>
                              </ol>
                            </div>

                            <div className="border rounded-lg p-4 bg-slate-50">
                              <h4 className="font-bold text-slate-900 mb-2 border-b pb-1">St. Francis</h4>
                              <div className="grid md:grid-cols-2 gap-4">
                                <ol className="list-decimal pl-5 space-y-2 text-xs">
                                  <li><strong>Schedule First:</strong> Go to On-Call Schedule. Add the provider to the St. Francis location for their shifts.</li>
                                  <li><strong>Auto-Income:</strong> The system automatically creates "Pending" Outside Income records for each scheduled day (calculated as Daily Rate).</li>
                                  <li><strong>Create Invoice:</strong> Go to Invoices -> Create. Select St. Francis.</li>
                                  <li><strong>Link:</strong> You will see the auto-generated income records in the list. Select them to include in the bill.</li>
                                </ol>
                                <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 flex items-center">
                                  <p><strong>Note:</strong> You do not need to manually enter income for St. Francis if the schedule is up to date.</p>
                                </div>
                              </div>
                            </div>
                          </div>
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