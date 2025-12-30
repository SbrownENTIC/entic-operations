import React from "react";
import { 
  Users, Calendar, DollarSign, FileText, CreditCard, 
  Package, ShoppingCart, Clock, Bell, Shield, 
  BarChart3, FolderOpen, Award, GraduationCap, 
  BookOpen, Settings, LayoutDashboard, RefreshCw,
  ClipboardList, CheckCircle2, Link as LinkIcon
} from "lucide-react";

export default function PrintableSOPs() {
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
          /* Zero page margins so we can control everything via body padding */
          @page { margin: 0; size: auto; }
          
          body { 
            margin: 0; 
            padding: 0 !important;
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
            background-color: white;
            box-sizing: border-box;
          }
          
          /* Reset container widths */
          .print-container { 
            max-width: 100% !important; 
            width: 100% !important; 
            margin: 0 !important;
            /* Add padding here to the container instead of body */
            padding: 25mm !important; 
            box-sizing: border-box !important;
            box-shadow: none !important;
            position: relative;
            z-index: 10;
          }

          /* The Border Frame - Fixed position ensures it repeats on every page */
          /* Placed at 10mm from edge, giving 15mm clearance to the content at 25mm padding */
          .page-frame {
            position: fixed;
            top: 10mm; 
            left: 10mm; 
            right: 10mm; 
            bottom: 10mm;
            border: 4px double #94a3b8;
            pointer-events: none;
            z-index: 9999;
          }

          /* Content wrapper doesn't need extra padding now, body handles it */
          .content-wrapper {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            position: relative;
            z-index: 10;
          }

          .page-break { page-break-after: always; break-after: page; }
          
          /* Allow breaks inside sections if they are long, but keep headers with content */
          .break-inside-avoid { 
            page-break-inside: avoid; 
            break-inside: avoid;
            display: block; 
          }
          
          .no-print { display: none !important; }
          a { text-decoration: none !important; color: black !important; }
          
          .page-footer { display: none; }
        }
        
        /* SCREEN STYLES - Unchanged */
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

      {/* Repeating Elements - Must be outside flow for fixed positioning to work in print */}
      <div className="page-frame"></div>
      <div className="page-footer">
        {/* Page number removed */}
      </div>

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
          
          <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-wider uppercase">Operations Manual</h1>
          <div className="h-0.5 w-24 bg-slate-900 mx-auto my-8"></div>
          <h2 className="text-xl text-slate-600 uppercase tracking-[0.2em] mb-16">Standard Operating Procedures</h2>
          
          <div className="w-full max-w-3xl mx-auto mt-8">
            <div className="grid grid-cols-2 gap-x-16 gap-y-2 text-left text-xs font-medium text-slate-600">
              {[
                "System Access", "Dashboard", "Providers", "On-Call Schedule", 
                "Outside Income", "Invoices", "Payments", "Office Supply Orders",
                "Clinical Supply Orders", "Time Off & CME", "Notifications & Closures",
                "Licenses", "Reports", "Document Management", "Clinical Privileges",
                "CME Tracking", "Office Catalog", "Clinical Catalog", "How System Works",
                "Coverage Checklist", "Maintenance Tools"
                ].map((item, idx) => (
                <div key={idx} className="flex items-baseline gap-3 border-b border-slate-100 py-1">
                  <span className="text-slate-400 font-mono text-xs w-6 text-right">{idx === 0 ? 'I' : idx}.</span>
                  <span className="uppercase tracking-wide">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>


      </div>

      {/* CONTENT */}
      <div className="space-y-8 mt-8">
        
        {/* System Access */}
        <PrintSection title="System Access" icon={LinkIcon}>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <strong className="block font-semibold text-blue-900 mb-2">Operations Center (Admin)</strong>
              <div className="text-xs text-blue-700 font-mono break-all">https://enticmd-operations-team.base44.app</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <strong className="block font-semibold text-green-900 mb-2">Public Supply Request</strong>
              <div className="text-xs text-green-700 font-mono break-all">https://enticmd-operations-team.base44.app/PublicSupplyRequest</div>
            </div>
          </div>
        </PrintSection>

        {/* 1. Dashboard */}
        <PrintSection title="1. Dashboard" icon={LayoutDashboard}>
          <p className="mb-3">The Dashboard is the central hub for monitoring the practice's health and pending tasks.</p>
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Overview
            </h4>
            <div className="ml-4">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Alerts:</strong> Critical items (Expiring Licenses, Pending Invoices) appear at the top in red or yellow.</li>
                <li><strong>Summary Cards:</strong> Quick access to Draft Invoices, Supply Orders, and other counts.</li>
                <li><strong>Financial Overview:</strong> Real-time view of Outstanding vs. Paid amounts.</li>
                <li><strong>Customization:</strong> Use the "Customize Dashboard" button (top right) to personalize your view.</li>
              </ul>
            </div>
          </div>
        </PrintSection>

        {/* 2. Providers */}
        <PrintSection title="2. Providers" icon={Users}>
          <p>Manage staff profiles, contact info, and employment details.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Adding a Provider
            </h4>
            <div className="ml-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Navigate to <strong>Providers</strong>.</li>
                <li>Click <strong>Add Provider</strong>.</li>
                <li>Enter Full Name, Email, Phone, Role, and select <strong>Program Locations</strong> (crucial for income logging).</li>
                <li>Set Status to "Active".</li>
                <li>Click <strong>Create Provider</strong>.</li>
              </ol>
            </div>
          </div>
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
            <span className="font-bold">i</span>
            <div>To deactivate a provider, edit their profile and change Status to <strong>Inactive</strong>. Do not delete providers with historical data.</div>
          </div>
        </PrintSection>

        {/* 3. On-Call Schedule */}
        <PrintSection title="3. On-Call Schedule" icon={Calendar}>
          <p>Manage provider rotation and drive automated income generation.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Adding Shifts
            </h4>
            <div className="ml-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Navigate to <strong>On-Call Schedule</strong>.</li>
                <li>Click <strong>Add Schedule</strong>.</li>
                <li>Select Provider, Location, and Dates.</li>
                <li>Click <strong>Save</strong>.</li>
              </ol>
            </div>
          </div>
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
            <span className="font-bold">i</span>
            <div><strong>Automation:</strong> Scheduling shifts for <strong>St. Francis</strong> automatically creates "Pending" Outside Income records for those dates.</div>
          </div>
        </PrintSection>

        {/* 4. Outside Income */}
        <PrintSection title="4. Outside Income" icon={DollarSign}>
          <p>Log every billable shift or service here before invoicing.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Logging Income
            </h4>
            <div className="ml-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Navigate to <strong>Outside Income</strong>.</li>
                <li>Click <strong>Add Income</strong>.</li>
                <li>Select Provider and Location.</li>
                <li><strong>Dates:</strong> Select the dates worked.</li>
                <li><strong>Amount:</strong> Enter Days/Rate or RVUs depending on the facility type.</li>
                <li>Click <strong>Save</strong>. Status defaults to "Pending".</li>
              </ol>
            </div>
          </div>
        </PrintSection>

        {/* 5. Invoices */}
        <PrintSection title="5. Invoices" icon={FileText}>
          <p>Group income records into invoices for billing facilities.</p>
          
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Creating an Invoice
            </h4>
            <div className="ml-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Navigate to <strong>Invoices</strong>.</li>
                <li>Click <strong>Create Invoice</strong>.</li>
                <li>Select <strong>Program Group</strong> (e.g., UConn, Hartford Hospital).</li>
                <li>Select <strong>Staff Member</strong>.</li>
                <li>Check the boxes for the <strong>Pending Income</strong> records to include.</li>
                <li>Click <strong>Create Invoice</strong>.</li>
              </ol>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Syncing to Vendor (Airtable)
            </h4>
            <div className="ml-4">
              <p className="mb-2">To send the invoice to the vendor (AP Department):</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Ensure the <strong>Approved Invoice</strong> PDF is uploaded.</li>
                <li>Click the <strong>Cloud Upload (Sync)</strong> button on the invoice row.</li>
                <li>Confirm the sync. This sends the data and PDF to Airtable/Notification system which triggers the email to the vendor.</li>
                <li>The status will automatically update to <strong>Sent to Vendor</strong>.</li>
              </ol>
            </div>
          </div>
        </PrintSection>

        {/* 6. Payments */}
        <PrintSection title="6. Payments" icon={CreditCard}>
          <p>Record and allocate payments received from facilities.</p>
          
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Processing a Payment
            </h4>
            <div className="ml-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Navigate to <strong>Payments</strong>.</li>
                <li>Click <strong>Add Payment</strong>.</li>
                <li>Enter Amount, Date, Payer, and Reference Number.</li>
                <li><strong>Allocate:</strong> Click "Add Allocation" to link the payment to specific Invoices.</li>
                <li>Click <strong>Save</strong>.</li>
              </ol>
            </div>
          </div>
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
            <span className="font-bold">i</span>
            <div>Fully allocated invoices automatically update their status to <strong>Paid to ENTIC</strong>.</div>
          </div>
        </PrintSection>

        {/* 7. Office Supply Orders */}
        <PrintSection title="7. Office Supply Orders" icon={Package}>
          <p>Manage internal requests for office supplies.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Fulfillment Workflow
            </h4>
            <div className="ml-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Navigate to <strong>Office Supply Orders</strong>.</li>
                <li>Filter by "Pending Review".</li>
                <li><strong>Approve/Reject</strong> requests.</li>
                <li>When purchasing, mark as "Order Placed".</li>
                <li>When items arrive, mark as "Received".</li>
              </ol>
            </div>
          </div>
        </PrintSection>

        {/* 8. Clinical Supply Orders */}
        <PrintSection title="8. Clinical Supply Orders" icon={ShoppingCart}>
          <p>Procurement for clinical and medical supplies.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Workflow
            </h4>
            <div className="ml-4">
              <ul className="list-disc pl-5 space-y-2">
                <li>Similar to Office Supplies (Review → Order → Receive).</li>
                <li><strong>Linking:</strong> Can be linked to Vendor Invoices in Document Management for reconciliation.</li>
                <li><strong>Sync:</strong> Use "Sync Henry Schein" to auto-create orders from uploaded invoices.</li>
              </ul>
            </div>
          </div>
        </PrintSection>

        {/* 9. Time Off & CME */}
        <PrintSection title="9. Time Off & CME" icon={Clock}>
          <p>Track provider absences and education days.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Logging Time Off
            </h4>
            <div className="ml-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Navigate to <strong>Time Off & CME</strong>.</li>
                <li>Click <strong>Add Time Off</strong>.</li>
                <li>Select Provider, Type (Time Off, CME, etc.), and Dates.</li>
                <li>Click <strong>Save</strong>.</li>
              </ol>
            </div>
          </div>
        </PrintSection>

        {/* 10. Notifications & Closures */}
        <PrintSection title="10. Notifications & Closures" icon={Bell}>
          <p>Manage automated email reminders and holiday closures.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Creating Reminders
            </h4>
            <div className="ml-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Navigate to <strong>Notifications & Closures</strong>.</li>
                <li>Click <strong>Create Reminder</strong>.</li>
                <li>Set Type (e.g., Holiday Closure).</li>
                <li>Set Dates and Send Date.</li>
                <li>Enter Recipients and Message.</li>
                <li>Click <strong>Save</strong>.</li>
              </ol>
            </div>
          </div>
        </PrintSection>

        {/* 11. Licenses */}
        <PrintSection title="11. Licenses" icon={Shield}>
          <p>Track professional license expirations.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Adding Licenses
            </h4>
            <div className="ml-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Navigate to <strong>Licenses</strong>.</li>
                <li>Click <strong>Add License</strong>.</li>
                <li>Select Provider and License Type.</li>
                <li>Enter <strong>Expiration Date</strong>.</li>
                <li>Click <strong>Save</strong>.</li>
              </ol>
            </div>
          </div>
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
            <span className="font-bold">i</span>
            <div>The system automatically alerts you 90, 60, and 30 days before expiration. Use the <strong>Sync to Airtable</strong> button to update the central credentialing database.</div>
          </div>
        </PrintSection>

        {/* 12. Reports */}
        <PrintSection title="12. Reports" icon={BarChart3}>
          <p>Access financial and operational analytics.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Available Reports
            </h4>
            <div className="ml-4">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Monthly Financials:</strong> Provider payout calculations.</li>
                <li><strong>Invoice Aging:</strong> Outstanding balances by age.</li>
                <li><strong>Payment Tracking:</strong> Audit trail of received payments.</li>
                <li><strong>Supply Analysis:</strong> Spending breakdown by location/category.</li>
                <li><strong>Credentialing Matrix:</strong> Privilege status overview.</li>
              </ul>
            </div>
          </div>
        </PrintSection>

        {/* 13. Document Management */}
        <PrintSection title="13. Document Management" icon={FolderOpen}>
          <p>Repository for vendor invoices and files.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Features
            </h4>
            <div className="ml-4">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Upload:</strong> Drag and drop files.</li>
                <li><strong>AI Processing:</strong> Extracts data from Vendor Invoices.</li>
                <li><strong>Split Tool:</strong> Break large PDFs into individual invoices.</li>
                <li><strong>Allocation:</strong> Assign costs to locations/orders.</li>
              </ul>
            </div>
          </div>
        </PrintSection>

        {/* 14. Clinical Privileges */}
        <PrintSection title="14. Clinical Privileges" icon={Award}>
          <p>Track hospital privileges.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Managing Privileges
            </h4>
            <div className="ml-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Navigate to <strong>Clinical Privileges</strong> (under 'More').</li>
                <li>Add/Edit privileges for each provider/facility.</li>
                <li>Track Granted and Expiration dates.</li>
              </ol>
            </div>
          </div>
        </PrintSection>

        {/* 15. CME Tracking */}
        <PrintSection title="15. CME Tracking" icon={GraduationCap}>
          <p>Log and monitor CME credits.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Logging Credits
            </h4>
            <div className="ml-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Navigate to <strong>CME Tracking</strong> (under 'More').</li>
                <li>Log credits earned by providers.</li>
                <li>Upload certificates.</li>
                <li>Monitor compliance against annual quotas.</li>
              </ol>
            </div>
          </div>
        </PrintSection>

        {/* 16. Office Catalog */}
        <PrintSection title="16. Office Catalog" icon={BookOpen}>
          <p>Maintain the list of available office supplies.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Managing Catalog
            </h4>
            <div className="ml-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Navigate to <strong>Office Catalog</strong> (under 'More').</li>
                <li>Add new items to appear in the order form.</li>
                <li>Set standard pricing and units.</li>
              </ol>
            </div>
          </div>
        </PrintSection>

        {/* 17. Clinical Catalog */}
        <PrintSection title="17. Clinical Catalog" icon={Settings}>
          <p>Maintain the list of medical supplies and vendor codes.</p>
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Managing Catalog
            </h4>
            <div className="ml-4">
              <ol className="list-decimal pl-5 space-y-2">
                <li>Navigate to <strong>Clinical Catalog</strong> (under 'More').</li>
                <li>Define items, SKUs, and Vendors.</li>
                <li>Used to link Vendor Invoices to Orders automatically.</li>
              </ol>
            </div>
          </div>
        </PrintSection>

        {/* 18. How System Works */}
        <PrintSection title="18. How System Works" icon={Settings}>
          <p>Understanding the automation and data relationships.</p>
          
          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Data Relationships
            </h4>
            <div className="ml-4">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Provider → Locations:</strong> Providers are linked to "Program Locations". This determines which facilities appear in dropdowns.</li>
                <li><strong>Outside Income → Invoice:</strong> Many Income Records (shifts) can be linked to one Invoice. Sum(Income Amounts) = Invoice Subtotal.</li>
                <li><strong>Payment → Allocation → Invoice:</strong> One Payment can be split across multiple Invoices. If (Amount Expected - Allocations) = 0, the invoice marks as Paid.</li>
                <li><strong>Vendor Invoice → Clinical Supply Order:</strong> Allocating items creates a new Clinical Supply Order and Vendor Invoice for that location.</li>
              </ul>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>Automated Jobs
            </h4>
            <div className="ml-4">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>License Checker:</strong> Runs daily. Checks Licenses and Privileges. Flags expiration dates 90, 60, 30 days out.</li>
                <li><strong>Invoice Status Sync:</strong> Runs in background. Ensures Paid status matches payments received.</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
            <span className="font-bold">i</span>
            <div><strong>Manual Override:</strong> If you manually change an Invoice Status (e.g., forcing it to "Paid"), the system sets a <strong>manual_status_override</strong> flag. Click the lock icon (🔒) on the invoice row to unlock it.</div>
          </div>
        </PrintSection>

        {/* 19. Coverage Checklist */}
        <PrintSection title="19. Coverage Checklist" icon={ClipboardList}>
          <p>Essential tasks to ensure zero downtime when the administrator is out.</p>

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

        {/* 20. Maintenance Tools */}
        <PrintSection title="20. Maintenance Tools" icon={RefreshCw}>
          <p>Tools to keep data clean and accurate. <span className="font-bold text-red-600 ml-2">⚠️ For System Admin ONLY</span></p>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="border rounded-lg p-3 bg-slate-50">
              <strong className="block text-sm font-bold text-slate-900 mb-1">Sync Henry Schein</strong>
              <p className="text-xs text-slate-600">Finds "Henry Schein" invoices not linked to orders and automatically creates Clinical Supply Orders.</p>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <strong className="block text-sm font-bold text-slate-900 mb-1">Fix Vendor Data</strong>
              <p className="text-xs text-slate-600">Fixes ALL CAPS vendor names and scans invoice data to link missing Locations.</p>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <strong className="block text-sm font-bold text-slate-900 mb-1">Force Redact Henry</strong>
              <p className="text-xs text-slate-600">Re-applies redaction to Henry Schein invoices (bottom 35%) to hide sensitive footer info.</p>
            </div>
          </div>
        </PrintSection>

        <div className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm font-medium break-inside-avoid">
          <p>Version 2.0 • Last Updated {currentDate}</p>
          <p className="mt-1 text-xs">ENTIC Medical Administration</p>
        </div>

      </div>
      </div>
      </div>
    </div>
  );
}

function PrintSection({ title, icon: Icon, children }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-6 border-b-2 border-slate-800 pb-2 break-inside-avoid">
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