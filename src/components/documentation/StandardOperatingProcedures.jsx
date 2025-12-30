import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Users, Calendar, DollarSign, FileText, CreditCard, 
  Package, ShoppingCart, Clock, Bell, Shield, 
  BarChart3, FolderOpen, Award, GraduationCap, 
  BookOpen, Settings, AlertCircle, LayoutDashboard,
  HelpCircle, Link as LinkIcon, ExternalLink
} from "lucide-react";

export default function StandardOperatingProcedures() {
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const appUrl = window.location.origin;
  const publicSupplyUrl = `${window.location.origin}/public-supply-request`;

  return (
    <div className="flex h-full border rounded-lg overflow-hidden bg-white">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-slate-50 border-r border-slate-200 flex-shrink-0 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Table of Contents</h3>
          <p className="text-xs text-slate-500 mt-1">Click to navigate</p>
        </div>
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            <NavButton onClick={() => scrollToSection('access')} icon={LinkIcon} label="System Access" />
            <NavButton onClick={() => scrollToSection('dashboard')} icon={LayoutDashboard} label="1. Dashboard" />
            <NavButton onClick={() => scrollToSection('providers')} icon={Users} label="2. Providers" />
            <NavButton onClick={() => scrollToSection('on-call')} icon={Calendar} label="3. On-Call Schedule" />
            <NavButton onClick={() => scrollToSection('income')} icon={DollarSign} label="4. Outside Income" />
            <NavButton onClick={() => scrollToSection('invoices')} icon={FileText} label="5. Invoices" />
            <NavButton onClick={() => scrollToSection('payments')} icon={CreditCard} label="6. Payments" />
            <NavButton onClick={() => scrollToSection('office-orders')} icon={Package} label="7. Office Supply Orders" />
            <NavButton onClick={() => scrollToSection('clinical-orders')} icon={ShoppingCart} label="8. Clinical Supply Orders" />
            <NavButton onClick={() => scrollToSection('time-off')} icon={Clock} label="9. Time Off & CME" />
            <NavButton onClick={() => scrollToSection('notifications')} icon={Bell} label="10. Notifications & Closures" />
            <NavButton onClick={() => scrollToSection('licenses')} icon={Shield} label="11. Licenses" />
            <NavButton onClick={() => scrollToSection('reports')} icon={BarChart3} label="12. Reports" />
            <NavButton onClick={() => scrollToSection('documents')} icon={FolderOpen} label="13. Document Management" />
            <NavButton onClick={() => scrollToSection('privileges')} icon={Award} label="14. Clinical Privileges" />
            <NavButton onClick={() => scrollToSection('cme-tracking')} icon={GraduationCap} label="15. CME Tracking" />
            <NavButton onClick={() => scrollToSection('office-catalog')} icon={BookOpen} label="16. Office Catalog" />
            <NavButton onClick={() => scrollToSection('clinical-catalog')} icon={Settings} label="17. Clinical Catalog" />
            <NavButton onClick={() => scrollToSection('system-docs')} icon={HelpCircle} label="18. System Documentation" />
          </nav>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 bg-white">
        <ScrollArea className="h-full">
          <div className="p-8 max-w-4xl mx-auto space-y-12 pb-20">
            
            <div className="mb-8 border-b pb-4">
              <h1 className="text-3xl font-bold text-slate-900">ENTIC Operations Center SOP</h1>
              <p className="text-slate-600 mt-2">Standard Operating Procedures and detailed instructions for the complete application.</p>
            </div>

            {/* System Access */}
            <Section id="access" title="System Access & Links" icon={LinkIcon}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <h4 className="font-semibold text-blue-900 mb-2">Operations Center (Admin)</h4>
                  <p className="text-sm text-blue-700 mb-3">Main application for administrative staff.</p>
                  <a href={appUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-sm font-medium">
                    {appUrl} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <h4 className="font-semibold text-green-900 mb-2">Public Supply Request Form</h4>
                  <p className="text-sm text-green-700 mb-3">Public link for staff to request supplies without logging in.</p>
                  <a href={publicSupplyUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline flex items-center gap-1 text-sm font-medium">
                    {publicSupplyUrl} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </Section>

            {/* 1. Dashboard */}
            <Section id="dashboard" title="1. Dashboard" icon={LayoutDashboard}>
              <p>The Dashboard is the central hub for monitoring the practice's health and pending tasks.</p>
              
              <Step title="Overview">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Alerts:</strong> Critical items (Expiring Licenses, Pending Invoices) appear at the top in red or yellow.</li>
                  <li><strong>Summary Cards:</strong> Quick access to Draft Invoices, Supply Orders, and other counts.</li>
                  <li><strong>Financial Overview:</strong> Real-time view of Outstanding vs. Paid amounts.</li>
                  <li><strong>Customization:</strong> Use the "Customize Dashboard" button to show/hide specific widgets.</li>
                </ul>
              </Step>
            </Section>

            {/* 2. Providers */}
            <Section id="providers" title="2. Providers" icon={Users}>
              <p>Manage staff profiles, contact info, and employment details.</p>
              
              <Step title="Adding a Provider">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <strong>Providers</strong>.</li>
                  <li>Click <strong>Add Provider</strong>.</li>
                  <li>Enter Full Name, Email, Phone, Role, and select <strong>Program Locations</strong> (crucial for income logging).</li>
                  <li>Set Status to "Active".</li>
                  <li>Click <strong>Create Provider</strong>.</li>
                </ol>
              </Step>
              
              <InfoBox>
                To deactivate a provider, edit their profile and change Status to <strong>Inactive</strong>. Do not delete providers with historical data.
              </InfoBox>
            </Section>

            {/* 3. On-Call Schedule */}
            <Section id="on-call" title="3. On-Call Schedule" icon={Calendar}>
              <p>Manage provider rotation and drive automated income generation.</p>

              <Step title="Adding Shifts">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <strong>On-Call Schedule</strong>.</li>
                  <li>Click <strong>Add Schedule</strong>.</li>
                  <li>Select Provider, Location, and Dates.</li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
              </Step>

              <InfoBox>
                <strong>Automation:</strong> Scheduling shifts for <strong>St. Francis</strong> automatically creates "Pending" Outside Income records for those dates, streamlining the billing process.
              </InfoBox>
            </Section>

            {/* 4. Outside Income */}
            <Section id="income" title="4. Outside Income" icon={DollarSign}>
              <p>Log every billable shift or service here before invoicing.</p>

              <Step title="Logging Income">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <strong>Outside Income</strong>.</li>
                  <li>Click <strong>Add Income</strong>.</li>
                  <li>Select Provider and Location.</li>
                  <li><strong>Dates:</strong> Select the dates worked.</li>
                  <li><strong>Amount:</strong> Enter Days/Rate or RVUs depending on the facility type.</li>
                  <li>Click <strong>Save</strong>. Status defaults to "Pending".</li>
                </ol>
              </Step>
            </Section>

            {/* 5. Invoices */}
            <Section id="invoices" title="5. Invoices" icon={FileText}>
              <p>Group income records into invoices for billing facilities.</p>

              <Step title="Creating an Invoice">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <strong>Invoices</strong>.</li>
                  <li>Click <strong>Create Invoice</strong>.</li>
                  <li>Select <strong>Program Group</strong> (e.g., UConn, Hartford Hospital).</li>
                  <li>Select <strong>Staff Member</strong>.</li>
                  <li>Check the boxes for the <strong>Pending Income</strong> records to include.</li>
                  <li>Click <strong>Create Invoice</strong>.</li>
                </ol>
              </Step>

              <Step title="Managing Invoice Files">
                <p className="mb-2">Once an invoice is created, you manage its lifecycle by attaching PDFs:</p>
                <ol className="list-decimal pl-5 space-y-2">
                    <li><strong>Draft Invoice:</strong> In the invoice form (or via action buttons), upload the initial PDF. This is for internal review.</li>
                    <li><strong>Approved Invoice:</strong> Once the draft is approved/signed, upload the final PDF.
                        <ul className="list-disc pl-5 mt-1">
                            <li><strong>Auto-Status Update:</strong> Uploading an "Approved Invoice" automatically updates the status to <strong>Approved</strong>.</li>
                        </ul>
                    </li>
                </ol>
              </Step>

              <Step title="Syncing to Vendor (Airtable)">
                <p className="mb-2">To send the invoice to the vendor (AP Department):</p>
                <ol className="list-decimal pl-5 space-y-2">
                    <li>Ensure the <strong>Approved Invoice</strong> PDF is uploaded.</li>
                    <li>Click the <strong>Cloud Upload (Sync)</strong> button on the invoice row.</li>
                    <li>Confirm the sync. This sends the data and PDF to Airtable/Notification system which triggers the email to the vendor.</li>
                    <li>The status will automatically update to <strong>Sent to Vendor</strong>.</li>
                </ol>
              </Step>

              <Step title="Action Buttons Guide">
                 <p className="mb-2">Use the icons on the right side of the invoice list:</p>
                 <ul className="list-disc pl-5 space-y-2">
                    <li><strong className="text-blue-600">File Down (⬇️):</strong> <strong>Generate PDF</strong>. Creates the official PDF template (UConn/Manchester) based on the invoice data.</li>
                    <li><strong className="text-teal-600">Upload (⬆️):</strong> <strong>Quick Upload</strong>. Quickly upload the "Approved" PDF without opening the full edit form. Automatically updates status to "Approved".</li>
                    <li><strong className="text-indigo-600">Cloud (☁️):</strong> <strong>Sync to Airtable</strong>. Sends the approved invoice to the vendor. (Only active for UConn, Manchester, Hartford). Updates status to "Sent to Vendor".</li>
                    <li><strong className="text-purple-600">Eye (👁️):</strong> <strong>View Draft</strong>. Opens the attached draft PDF.</li>
                    <li><strong className="text-red-600">Trash (🗑️):</strong> <strong>Delete</strong>. Removes the invoice and resets linked income records to "Pending".</li>
                 </ul>
              </Step>

              <Step title="Facility-Specific Workflows">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Hartford Hospital:</strong> When you create the RVU Outside Income record, the system automatically creates the Directorship Outside Income record. When creating the invoice, simply select both records to include them.</li>
                  <li><strong>St. Francis (Dr. Seth Brown):</strong> Similar to Hartford, when an On-Call shift is created for Dr. Seth Brown, the system automatically creates the Directorship Outside Income record. Select both when creating the invoice.</li>
                </ul>
              </Step>
            </Section>

            {/* 6. Payments */}
            <Section id="payments" title="6. Payments" icon={CreditCard}>
              <p>Record and allocate payments received from facilities.</p>

              <Step title="Processing a Payment">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <strong>Payments</strong>.</li>
                  <li>Click <strong>Add Payment</strong>.</li>
                  <li>Enter Amount, Date, Payer, and Reference Number.</li>
                  <li><strong>Allocate:</strong> Click "Add Allocation" to link the payment to specific Invoices.</li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
              </Step>

              <InfoBox>
                Fully allocated invoices automatically update their status to <strong>Paid to ENTIC</strong>.
              </InfoBox>
            </Section>

            {/* 7. Office Supply Orders */}
            <Section id="office-orders" title="7. Office Supply Orders" icon={Package}>
              <p>Manage internal requests for office supplies.</p>

              <Step title="Fulfillment Workflow">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <strong>Office Supply Orders</strong>.</li>
                  <li>Filter by "Pending Review".</li>
                  <li><strong>Approve/Reject</strong> requests.</li>
                  <li>When purchasing, mark as "Order Placed".</li>
                  <li>When items arrive, mark as "Received".</li>
                </ol>
              </Step>
            </Section>

            {/* 8. Clinical Supply Orders */}
            <Section id="clinical-orders" title="8. Clinical Supply Orders" icon={ShoppingCart}>
              <p>Procurement for clinical and medical supplies.</p>

              <Step title="Workflow">
                <ul className="list-disc pl-5 space-y-2">
                  <li>Similar to Office Supplies (Review → Order → Receive).</li>
                  <li><strong>Linking:</strong> Can be linked to Vendor Invoices in Document Management for reconciliation.</li>
                  <li><strong>Sync:</strong> Use "Sync Henry Schein" to auto-create orders from uploaded invoices.</li>
                </ul>
              </Step>
            </Section>

            {/* 9. Time Off & CME */}
            <Section id="time-off" title="9. Time Off & CME" icon={Clock}>
              <p>Track provider absences and education days.</p>

              <Step title="Logging Time Off">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <strong>Time Off & CME</strong>.</li>
                  <li>Click <strong>Add Time Off</strong>.</li>
                  <li>Select Provider, Type (Time Off, CME, etc.), and Dates.</li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
              </Step>
            </Section>

            {/* 10. Notifications & Closures */}
            <Section id="notifications" title="10. Notifications & Closures" icon={Bell}>
              <p>Manage automated email reminders and holiday closures.</p>

              <Step title="Creating Reminders">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <strong>Notifications & Closures</strong>.</li>
                  <li>Click <strong>Create Reminder</strong>.</li>
                  <li>Set Type (e.g., Holiday Closure).</li>
                  <li>Set Dates and Send Date.</li>
                  <li>Enter Recipients and Message.</li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
              </Step>
            </Section>

            {/* 11. Licenses */}
            <Section id="licenses" title="11. Licenses" icon={Shield}>
              <p>Track professional license expirations.</p>

              <Step title="Adding Licenses">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <strong>Licenses</strong>.</li>
                  <li>Click <strong>Add License</strong>.</li>
                  <li>Select Provider and License Type.</li>
                  <li>Enter <strong>Expiration Date</strong>.</li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
              </Step>

              <InfoBox>
                The system automatically alerts you 90, 60, and 30 days before expiration.
              </InfoBox>
            </Section>

            {/* 12. Reports */}
            <Section id="reports" title="12. Reports" icon={BarChart3}>
              <p>Access financial and operational analytics.</p>

              <Step title="Available Reports">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Monthly Financials:</strong> Provider payout calculations.</li>
                  <li><strong>Invoice Aging:</strong> Outstanding balances by age.</li>
                  <li><strong>Payment Tracking:</strong> Audit trail of received payments.</li>
                  <li><strong>Supply Analysis:</strong> Spending breakdown by location/category.</li>
                  <li><strong>Credentialing Matrix:</strong> Privilege status overview.</li>
                </ul>
              </Step>
            </Section>

            {/* 13. Document Management */}
            <Section id="documents" title="13. Document Management" icon={FolderOpen}>
              <p>Repository for vendor invoices and files.</p>

              <Step title="Features">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Upload:</strong> Drag and drop files.</li>
                  <li><strong>AI Processing:</strong> Extracts data from Vendor Invoices.</li>
                  <li><strong>Split Tool:</strong> Break large PDFs into individual invoices.</li>
                  <li><strong>Allocation:</strong> Assign costs to locations/orders.</li>
                </ul>
              </Step>
            </Section>

            {/* 14. Clinical Privileges */}
            <Section id="privileges" title="14. Clinical Privileges" icon={Award}>
              <p>Track hospital privileges.</p>

              <Step title="Managing Privileges">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <strong>Clinical Privileges</strong> (under 'More').</li>
                  <li>Add/Edit privileges for each provider/facility.</li>
                  <li>Track Granted and Expiration dates.</li>
                </ol>
              </Step>
            </Section>

            {/* 15. CME Tracking */}
            <Section id="cme-tracking" title="15. CME Tracking" icon={GraduationCap}>
              <p>Log and monitor CME credits.</p>

              <Step title="Logging Credits">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <strong>CME Tracking</strong> (under 'More').</li>
                  <li>Log credits earned by providers.</li>
                  <li>Upload certificates.</li>
                  <li>Monitor compliance against annual quotas.</li>
                </ol>
              </Step>
            </Section>

            {/* 16. Office Catalog */}
            <Section id="office-catalog" title="16. Office Catalog" icon={BookOpen}>
              <p>Maintain the list of available office supplies.</p>

              <Step title="Managing Catalog">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <strong>Office Catalog</strong> (under 'More').</li>
                  <li>Add new items to appear in the order form.</li>
                  <li>Set standard pricing and units.</li>
                </ol>
              </Step>
            </Section>

            {/* 17. Clinical Catalog */}
            <Section id="clinical-catalog" title="17. Clinical Catalog" icon={Settings}>
              <p>Maintain the list of medical supplies and vendor codes.</p>

              <Step title="Managing Catalog">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Navigate to <strong>Clinical Catalog</strong> (under 'More').</li>
                  <li>Define items, SKUs, and Vendors.</li>
                  <li>Used to link Vendor Invoices to Orders automatically.</li>
                </ol>
              </Step>
            </Section>

             {/* 18. System Documentation */}
             <Section id="system-docs" title="18. System Documentation" icon={HelpCircle}>
              <p>This section contains the Standard Operating Procedures (SOPs), manuals, and checklists.</p>

              <Step title="Usage">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>SOPs:</strong> This detailed guide.</li>
                  <li><strong>How System Works:</strong> Technical logic and automation rules.</li>
                  <li><strong>Maintenance:</strong> Tools for fixing data issues.</li>
                  <li><strong>Checklists:</strong> Recurring task lists (Daily, Weekly, Monthly).</li>
                  <li><strong>Printable Manuals:</strong> Printer-friendly versions of documentation.</li>
                </ul>
              </Step>
            </Section>

          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function Section({ id, title, icon: Icon, children }) {
  return (
    <div id={id} className="scroll-mt-8 border rounded-xl p-6 bg-slate-50/50 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-200">
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <Icon className="w-5 h-5 text-slate-700" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      </div>
      <div className="text-sm text-slate-600 space-y-4">
        {children}
      </div>
    </div>
  );
}

function Step({ title, children }) {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-slate-800 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
        {title}
      </h4>
      <div className="ml-4">{children}</div>
    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
      <AlertCircle className="w-5 h-5 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function NavButton({ onClick, icon: Icon, label }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors text-left"
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}