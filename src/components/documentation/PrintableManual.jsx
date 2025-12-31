import React from "react";
import { 
  Settings, 
  Users, 
  FileText, 
  DollarSign, 
  Package, 
  ShieldAlert, 
  ClipboardList,
  Calendar,
  Bell,
  GraduationCap,
  ShoppingBag,
  Layout,
  RefreshCw,
  LayoutDashboard,
  CreditCard,
  ShoppingCart,
  Clock,
  Shield,
  BarChart3,
  FolderOpen,
  Award,
  BookOpen,
  CheckCircle2,
  FileDown, 
  Upload, 
  CloudUpload, 
  Eye, 
  Trash2
} from "lucide-react";

export default function PrintableManual() {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto bg-white text-slate-900 font-sans print-container shadow-2xl print:shadow-none max-w-[21cm] min-h-[29.7cm]">
      <style>{`
        @media print {
          @page { margin: 15mm; size: auto; }
          
          body { 
            margin: 0; 
            padding: 0 !important;
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
            background-color: white;
          }
          
          .print-container { 
            max-width: 100% !important; 
            width: 100% !important; 
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            position: relative;
            z-index: 10;
          }

          .page-frame {
            position: fixed;
            top: 0; 
            left: 0; 
            right: 0; 
            bottom: 0;
            border: 4px double #94a3b8;
            pointer-events: none;
            z-index: 50;
          }

          .content-wrapper {
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
            position: relative;
            z-index: 10;
          }

          .page-break { page-break-after: always; break-after: page; }
          
          .break-inside-avoid { 
            page-break-inside: avoid; 
            break-inside: avoid;
            display: block; 
          }
          
          .no-print { display: none !important; }
          a { text-decoration: none !important; color: black !important; }
          
          .page-footer { display: none; }
        }
        
        @media screen {
          .page-frame {
            border: 6px double #e2e8f0;
            border-radius: 12px;
            margin: 20px;
            min-height: calc(100vh - 40px);
            pointer-events: none;
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            z-index: 10;
          }
          .content-wrapper {
            padding: 3rem;
            position: relative;
            z-index: 20;
          }
          .page-footer {
             display: none;
          }
        }
      `}</style>

      {/* Repeating Elements */}
      <div className="page-frame"></div>
      <div className="page-footer"></div>

      <div className="content-wrapper">
        {/* TITLE PAGE */}
        <div className="page-break flex flex-col items-center justify-center min-h-[80vh] text-center relative">
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div className="mb-12">
               <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691521cbabed77e5043c7037/267bf0119_thumbnail_ENTIC_horizontal_BKGD.png" 
                  alt="ENTIC Logo" 
                  className="h-24 w-auto object-contain mx-auto"
                />
            </div>
            
            <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-wider uppercase">Operations Center</h1>
            <div className="h-0.5 w-24 bg-slate-900 mx-auto my-8"></div>
            <h2 className="text-xl text-slate-600 uppercase tracking-[0.2em] mb-16">User Manual</h2>
            
            <div className="w-full max-w-3xl mx-auto mt-8">
              <div className="grid grid-cols-2 gap-x-16 gap-y-2 text-left text-xs font-medium text-slate-600">
                {[
                  "Dashboard & Customization", "Provider Management", "On-Call Schedule", 
                  "Outside Income & Billing", "Invoices & Workflows", "Payments & Allocations", 
                  "Supply Management", "Time Off & CME", "Compliance Tracking", "Notifications & Closures",
                  "Reports", "Document Management", "Facility Workflows", "How System Works", "Coverage Checklist"
                  ].map((item, idx) => (
                  <div key={idx} className="flex items-baseline gap-3 border-b border-slate-100 py-1">
                    <span className="text-slate-400 font-mono text-xs w-6 text-right">{idx + 1}.</span>
                    <span className="uppercase tracking-wide">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="space-y-8 mt-8">

          {/* 1. Dashboard */}
          <PrintSection title="1. Dashboard & Customization" icon={LayoutDashboard}>
            <p className="mb-3">The <strong>Dashboard</strong> is your mission control center. It provides a real-time snapshot of the practice's health and your immediate tasks.</p>
            
            <Step title="Key Widgets">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Alerts Panel:</strong> Red/Yellow alerts at the top highlight urgent actions (e.g., expiring licenses, pending supply approvals). Click an alert to jump to the relevant item.</li>
                <li><strong>Summary Cards:</strong> Quick counts of draft invoices, pending payments, and open orders.</li>
                <li><strong>Financial Overview:</strong> A high-level graph of what's owed to ENTIC vs. what's been collected.</li>
                <li><strong>CME Compliance:</strong> Tracks progress toward the annual 3-credit goal for each provider.</li>
              </ul>
            </Step>

            <Step title="How to Customize Your View">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Click the <strong>"Customize Dashboard"</strong> button in the top-right corner.</li>
                <li>A panel will slide out listing all available widgets.</li>
                <li>Toggle the switches <strong>On/Off</strong> for each widget (e.g., hide "Financial Overview" if you only manage supplies).</li>
                <li>Click <strong>"Save Preferences"</strong>. Your settings are saved for your next visit.</li>
              </ol>
            </Step>
          </PrintSection>

          {/* 2. Provider Management */}
          <PrintSection title="2. Provider Management" icon={Users}>
            <p className="mb-3">The <strong>Providers</strong> module is the central registry for all staff members.</p>
            
            <Step title="Managing Profiles">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Status:</strong> Toggle providers between <em>Active</em> and <em>Inactive</em>. Inactive providers are hidden from dropdowns to keep lists clean.</li>
                <li><strong>Program Locations:</strong> Assign providers to specific facilities (e.g., "Hartford Hospital", "UConn"). This filters what they see in other modules.</li>
                <li><strong>Terminations:</strong> Setting a "Termination Date" will automatically mark the provider as Inactive once that date passes.</li>
              </ul>
            </Step>
          </PrintSection>

          {/* 3. On-Call Schedule */}
          <PrintSection title="3. On-Call Schedule" icon={Calendar}>
            <p className="mb-3">Manage and view the provider rotation for all facilities. This schedule drives the automatic income generation for on-call shifts.</p>

            <Step title="Views & Navigation">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Calendar View:</strong> Visual monthly grid. Click a day to add/edit.</li>
                <li><strong>List View:</strong> Sortable table of all shifts. Best for bulk editing or searching specific dates.</li>
                <li><strong>Filtering:</strong> Use the dropdowns to filter by specific Provider or Location.</li>
              </ul>
            </Step>

            <Step title="Adding Shifts">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Click <strong>"Add Schedule"</strong>.</li>
                <li>Select Provider, Location, Start/End Dates.</li>
                <li><strong>Auto-Income:</strong> For locations like St. Francis, the system will ask if you want to auto-create "Outside Income" records for these dates. Say <strong>Yes</strong> to save time!</li>
              </ol>
            </Step>
          </PrintSection>

          {/* 4. Outside Income */}
          <PrintSection title="4. Outside Income" icon={DollarSign}>
            <p className="mb-3">This is where you log every billable service or shift. Think of it as the "Timesheet" that feeds into Invoices.</p>

            <Step title="Logging Income">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Manual Entry:</strong> Click "Add Income". Select the Facility.
                  <ul className="list-disc pl-5 mt-1 text-slate-600">
                    <li>For <strong>Daily Rate</strong> locations (e.g., St. Francis), enter "Days Worked". The system calculates Total ($).</li>
                    <li>For <strong>RVU</strong> locations (e.g., Hartford Hospital), enter "Total RVUs".</li>
                  </ul>
                </li>
                <li><strong>Status:</strong> Records start as <em>Pending</em>. Once included in an invoice, they flip to <em>Invoiced</em>. Once paid, they become <em>Paid</em>.</li>
              </ul>
            </Step>
          </PrintSection>

          {/* 5. Invoices */}
          <PrintSection title="5. Invoices & Workflows" icon={FileText}>
            <p className="mb-3">The <strong>Invoices</strong> module groups individual income records into a formal bill for a facility.</p>

            <Step title="Creating an Invoice">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Go to <strong>Invoices</strong> -> <strong>Create Invoice</strong>.</li>
                <li>Select <strong>Program Group</strong> (e.g., UConn) and <strong>Staff Member</strong>.</li>
                <li>The system automatically finds all <em>Pending</em> income for that provider/program.</li>
                <li><strong>Link Income:</strong> Select the shifts you want to bill for. The invoice total is auto-calculated.</li>
                <li><strong>Save.</strong></li>
              </ol>
            </Step>

            <Step title="Specific Workflows">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>UConn & Manchester:</strong> Once created, click the <strong>Generate PDF</strong> button (<FileDown className="w-3 h-3 inline text-blue-600"/>) to create the official PDF. Then click <strong>Sync to Vendor</strong> (<CloudUpload className="w-3 h-3 inline text-indigo-600"/>) to send it to Airtable for automation.</li>
                <li><strong>Hartford Hospital:</strong> Creating an RVU invoice will check for Directorships. If found, the system asks to auto-create a separate Directorship invoice.</li>
                <li><strong>St. Francis:</strong> Income is typically auto-generated from the On-Call Schedule. Create a standard invoice and link these pending records to bill them.</li>
              </ul>
            </Step>

            <div className="mt-4 border rounded-lg p-4 bg-slate-50 break-inside-avoid">
              <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Action Buttons Guide
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white border border-slate-200 rounded text-blue-600 shadow-sm"><FileDown className="w-4 h-4" /></div>
                  <div>
                    <span className="font-bold text-slate-900">Generate PDF</span>
                    <div className="text-xs text-slate-500">Create official template (UConn/ECHN)</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white border border-slate-200 rounded text-teal-600 shadow-sm"><Upload className="w-4 h-4" /></div>
                  <div>
                    <span className="font-bold text-slate-900">Quick Upload</span>
                    <div className="text-xs text-slate-500">Upload approved/signed PDF</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white border border-slate-200 rounded text-indigo-600 shadow-sm"><CloudUpload className="w-4 h-4" /></div>
                  <div>
                    <span className="font-bold text-slate-900">Sync to Vendor</span>
                    <div className="text-xs text-slate-500">Send to Airtable/AP Dept</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white border border-slate-200 rounded text-purple-600 shadow-sm"><Eye className="w-4 h-4" /></div>
                  <div>
                    <span className="font-bold text-slate-900">View Draft</span>
                    <div className="text-xs text-slate-500">View current attachment</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white border border-slate-200 rounded text-red-600 shadow-sm"><Trash2 className="w-4 h-4" /></div>
                  <div>
                    <span className="font-bold text-slate-900">Delete</span>
                    <div className="text-xs text-slate-500">Remove invoice & reset income</div>
                  </div>
                </div>
              </div>
            </div>
          </PrintSection>

          {/* 6. Payments */}
          <PrintSection title="6. Payments & Allocations" icon={CreditCard}>
            <p className="mb-3">When a check or wire arrives, log it here. <strong>Crucial:</strong> A payment record is useless unless it is "Allocated" to invoices.</p>

            <Step title="Processing a Payment">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Click <strong>"Add Payment"</strong>. Enter total amount and date.</li>
                <li><strong>Attach Remittance:</strong> Upload the PDF/Image of the check details.</li>
                <li><strong>Allocate:</strong> In the "Allocations" section, search for the invoices being paid.</li>
                <li>Enter the amount for each invoice. The "Unallocated Amount" should reach $0.00.</li>
              </ol>
            </Step>

            <Step title="Auto-Updates">
              <p>When you save a fully allocated payment:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>The linked Invoices update to <em>Paid to ENTIC</em>.</li>
                <li>The "Amount Received" on the invoice updates.</li>
                <li>The Provider Payout report updates automatically.</li>
              </ul>
            </Step>
          </PrintSection>

          {/* 7. Supply Management */}
          <PrintSection title="7. Supply Management" icon={Package}>
            <p className="mb-3">Manage inventory for both Office and Clinical supplies across all locations.</p>

            <Step title="Using Catalogs">
              <p>Go to <strong>Office Catalog</strong> or <strong>Clinical Catalog</strong> to browse standard items.</p>
              <ul className="list-disc pl-5 space-y-2 mt-1">
                <li><strong>Add to Cart:</strong> Select items you need.</li>
                <li><strong>Checkout:</strong> Review your cart, select the Delivery Location, and submit.</li>
                <li>This creates a "Supply Order" automatically.</li>
              </ul>
            </Step>

            <Step title="Managing Orders">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Review:</strong> Managers see orders in "Pending Review". Click Approve to proceed.</li>
                <li><strong>Fulfillment:</strong> Mark items as "Received" when boxes arrive. You can receive partial orders (e.g., 2 of 5 boxes).</li>
                <li><strong>Status:</strong> Only when <em>all</em> items are received does the order close.</li>
              </ul>
            </Step>
          </PrintSection>

          {/* 8. Time Off */}
          <PrintSection title="8. Time Off & CME Requests" icon={Clock}>
            <p className="mb-3">Use the <strong>Time Off & CME</strong> module to manage schedule availability.</p>

            <Step title="How to Request">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Click <strong>"Add Time Off"</strong>.</li>
                <li>Select Provider and Date Range.</li>
                <li><strong>Type:</strong> Choose <em>Vacation</em>, <em>CME</em>, or <em>Partial Day</em>.</li>
                <li>For <strong>Partial Day</strong>, specify the time (e.g., "Leaving at 12pm").</li>
                <li>Save. The request appears on the master calendar for admin review.</li>
              </ol>
            </Step>
          </PrintSection>

          {/* 9. Compliance */}
          <PrintSection title="9. Compliance Tracking" icon={ShieldAlert}>
            <p className="mb-3">Keep the practice legal. The system tracks expiration dates for all credentials.</p>

            <Step title="Licenses">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Alerts:</strong> The system sends email warnings at 90, 60, 30, 14, and 7 days before expiration.</li>
                <li><strong>Renewal:</strong> When you renew, update the "Expiration Date" here to reset the alerts.</li>
              </ul>
            </Step>

            <Step title="Clinical Privileges">
              <ul className="list-disc pl-5 space-y-2">
                <li>Lists each facility where a provider can practice.</li>
                <li>Tracks "Granted Date" and "Expiration Date".</li>
              </ul>
            </Step>

            <Step title="CME Tracking">
               <p>Log courses in <strong>CME Tracking</strong>. The Dashboard widget shows a progress bar for each provider towards their 3-credit annual goal.</p>
            </Step>
          </PrintSection>

          {/* 10. Notifications */}
          <PrintSection title="10. Notifications & Closures" icon={Bell}>
            <p className="mb-3">The <strong>Reminders</strong> module manages system-wide alerts and office closure announcements.</p>

            <Step title="Managing Closures">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Create a new Reminder with type <strong>"Holiday"</strong> or <strong>"Office Closure"</strong>.</li>
                <li>Set the "Closure Date" and "Re-open Date".</li>
                <li><strong>Sync:</strong> Click <strong>"Sync Reminders to Airtable"</strong>. This pushes the closure info to our phone system and email notification service.</li>
              </ol>
            </Step>
          </PrintSection>

          {/* 11. Reports */}
          <PrintSection title="11. Reports" icon={ClipboardList}>
            <p className="mb-3">Export clean data for accounting and payroll.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Monthly Financials:</strong> The "Payout Bible". Shows exactly what each provider earned and what was collected for a specific month. Use this for payroll.</li>
              <li><strong>Invoice Aging:</strong> See who owes money (30/60/90 days overdue).</li>
              <li><strong>Payment Tracking:</strong> A detailed audit trail of every dollar received and where it was allocated.</li>
            </ul>
          </PrintSection>

          {/* 12. Document Management */}
          <PrintSection title="12. Document Management" icon={FolderOpen}>
            <p className="mb-3">The <strong>Document Management</strong> module handles Vendor Invoices with AI-powered processing.</p>

            <Step title="Processing Invoices">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Upload:</strong> Drag & drop PDF invoices. The system automatically extracts Vendor, Date, and Total Amount.</li>
                <li><strong>Split PDF:</strong> If you have one PDF with multiple invoices, use the "Split Multi-Invoice PDF" tool. The AI will separate them into individual records automatically.</li>
              </ul>
            </Step>

            <Step title="Allocations & Linking">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Allocation:</strong> You can split a large invoice by allocating specific items to different locations. This creates new invoices/orders for those locations and reduces the original invoice total.</li>
                <li><strong>Syncing:</strong> Deleted a Clinical Supply Order by mistake? Use the "Refresh/Sync" button on the invoice list to recreate it from the invoice data.</li>
              </ul>
            </Step>

            <InfoBox>
               <strong>Special Tools:</strong> Use "Sync Henry Schein" to automatically find unlinked invoices, or "Force Redact Henry" to re-apply redactions.
            </InfoBox>
          </PrintSection>

          {/* 13. Facility Workflows */}
          <PrintSection title="13. Facility Workflows" icon={RefreshCw}>
            <p className="mb-3">Step-by-step guides for the most common billing scenarios.</p>

            <Step title="UConn & Manchester (ECHN)">
              <ol className="list-decimal pl-5 space-y-2">
                <li><strong>Create Invoice:</strong> Select Provider & Program Group (UConn or Manchester). Link the pending income records.</li>
                <li><strong>Generate PDF:</strong> Once created, look for the "File Down" (⬇️) icon in the invoice list. Click it to generate the official PDF template.</li>
                <li><strong>Sync & Send:</strong> Select the approved invoices and click the <strong>Cloud Icon</strong>.
                  <ul className="list-disc pl-5 mt-1 text-slate-600">
                    <li>This sends the PDF and data to the Notification system for email automations to improve workflow.</li>
                    <li>An email is automatically drafted/sent to the AP department (e.g., Ann Marie at ECHN).</li>
                  </ul>
                </li>
              </ol>
            </Step>

            <Step title="Hartford Hospital (Directorships)">
              <ol className="list-decimal pl-5 space-y-2">
                <li><strong>Check Schedule:</strong> Ensure the provider is scheduled for the month.</li>
                <li><strong>Create RVU Invoice:</strong> Create a standard invoice for their RVU shifts.</li>
                <li><strong>Auto-Detection:</strong> The system will check if they also have a "Directorship" role.</li>
                <li><strong>Prompt:</strong> If found, you will be asked to create a <strong>Second Invoice</strong> for the flat Directorship fee (e.g., $3,250). Click Yes.</li>
                <li><strong>Result:</strong> You now have two invoices: one for RVUs, one for the Directorship.</li>
              </ol>
            </Step>

            <Step title="St. Francis">
              <ol className="list-decimal pl-5 space-y-2">
                <li><strong>Schedule First:</strong> Go to On-Call Schedule. Add the provider to the St. Francis location for their shifts.</li>
                <li><strong>Auto-Income:</strong> The system automatically creates "Pending" Outside Income records for each scheduled day (calculated as Daily Rate).</li>
                <li><strong>Create Invoice:</strong> Go to Invoices -> Create. Select St. Francis.</li>
                <li><strong>Link:</strong> You will see the auto-generated income records in the list. Select them to include in the bill.</li>
              </ol>
              <div className="bg-blue-50 p-3 mt-2 rounded text-xs text-blue-800 flex items-center">
                <p><strong>Note:</strong> You do not need to manually enter income for St. Francis if the schedule is up to date.</p>
              </div>
            </Step>
          </PrintSection>

          {/* 14. How System Works */}
          <PrintSection title="14. How System Works" icon={Settings}>
            <p className="mb-3">Understanding the automation and data relationships.</p>

            <Step title="Data Relationships">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Provider → Locations:</strong> Providers are linked to "Program Locations". This determines which facilities appear in dropdowns.</li>
                <li><strong>Outside Income → Invoice:</strong> Many Income Records (shifts) can be linked to one Invoice. Sum(Income Amounts) = Invoice Subtotal.</li>
                <li><strong>Payment → Allocation → Invoice:</strong> One Payment can be split across multiple Invoices. If (Amount Expected - Allocations) = 0, the invoice marks as Paid.</li>
                <li><strong>Vendor Invoice → Clinical Supply Order:</strong> Allocating items creates a new Clinical Supply Order and Vendor Invoice for that location.</li>
              </ul>
            </Step>

            <Step title="Automated Jobs">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>License Checker:</strong> Runs daily. Checks Licenses and Privileges. Flags expiration dates 90, 60, 30 days out.</li>
                <li><strong>Invoice Status Sync:</strong> Runs in background. Ensures Paid status matches payments received.</li>
              </ul>
            </Step>

            <InfoBox>
              <strong>Manual Override:</strong> If you manually change an Invoice Status (e.g., forcing it to "Paid"), the system sets a <strong>manual_status_override</strong> flag. Click the lock icon (🔒) on the invoice row to unlock it.
            </InfoBox>
          </PrintSection>

          {/* 15. Coverage Checklist */}
          <PrintSection title="15. Coverage Checklist" icon={ClipboardList}>
            <p className="mb-3">Essential tasks to ensure zero downtime when the administrator is out.</p>

            <div className="space-y-4 mt-4">
              <div className="bg-slate-50 p-4 rounded border border-slate-200">
                <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" /> Daily (Morning)
                </h4>
                <ul className="list-disc pl-6 text-sm space-y-1">
                  <li><strong>Office Orders:</strong> Check "Pending Review". Approve urgent requests.</li>
                  <li><strong>Dashboard Alerts:</strong> Check "Expiring Licenses" or "Pending Invoices".</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-4 rounded border border-slate-200">
                <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-600" /> Weekly (Friday)
                </h4>
                <ul className="list-disc pl-6 text-sm space-y-1">
                  <li><strong>Log Income:</strong> Enter shifts into Outside Income from provider texts/emails.</li>
                  <li><strong>Draft Invoices:</strong> Create invoices for completed work so they are ready for review.</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-4 rounded border border-slate-200">
                <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600" /> Monthly (1st - 5th)
                </h4>
                <ul className="list-disc pl-6 text-sm space-y-1">
                  <li><strong>The "Big Send":</strong> Review drafts, generate PDFs, and Sync to Vendor.</li>
                  <li><strong>Reconcile Payments:</strong> Enter deposit slips into Payments and Allocate them.</li>
                  <li><strong>Provider Payouts:</strong> Export "Monthly Financials" report for payroll.</li>
                </ul>
              </div>
            </div>
          </PrintSection>

          <div className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm font-medium break-inside-avoid">
            <p>Version 2.0 • Last Updated {currentDate}</p>
            <p className="mt-1 text-xs">ENTIC Operations Team</p>
          </div>

        </div>
      </div>
      </div>
    </div>
  );
}

function PrintSection({ title, icon: Icon, children }) {
  return (
    <div className="mb-10 break-inside-avoid">
      <div className="flex items-center gap-3 mb-6 border-b-2 border-slate-800 pb-2">
        <h2 className="text-xl font-bold text-slate-900 uppercase tracking-widest">{title}</h2>
      </div>
      <div className="text-sm text-slate-700 leading-relaxed space-y-6 pl-1">
        {children}
      </div>
    </div>
  );
}

function Step({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="font-bold text-slate-900 text-base border-l-4 border-slate-300 pl-3 uppercase tracking-wide">
        {title}
      </h4>
      <div className="ml-4 pl-3 border-l border-slate-100">{children}</div>
    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div className="bg-slate-50 border-l-4 border-slate-400 p-4 flex gap-4 text-sm text-slate-700 my-4 italic">
      <div className="font-bold not-italic text-slate-900">NOTE:</div>
      <div>{children}</div>
    </div>
  );
}