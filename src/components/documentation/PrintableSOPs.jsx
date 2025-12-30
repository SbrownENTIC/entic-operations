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
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="p-8 max-w-[21cm] mx-auto bg-white text-slate-900 font-sans print-container">
      <style>{`
        @media print {
          .print-container { max-width: 100% !important; padding: 0 !important; }
          .page-break { page-break-after: always; }
          .break-inside-avoid { page-break-inside: avoid; }
          .no-print { display: none; }
          a { text-decoration: none; color: black; }
        }
      `}</style>

      {/* TITLE PAGE */}
      <div className="page-break flex flex-col justify-between h-[90vh]">
        <div className="text-center mt-20">
          <div className="mb-6 flex justify-center">
             <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691521cbabed77e5043c7037/267bf0119_thumbnail_ENTIC_horizontal_BKGD.png" 
                alt="ENTIC Logo" 
                className="h-24 w-auto object-contain"
              />
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-4">Operations Center</h1>
          <h2 className="text-3xl text-slate-600 font-light">Standard Operating Procedures</h2>
          <div className="w-24 h-1 bg-blue-600 mx-auto my-8"></div>
          <p className="text-slate-500">Comprehensive Guide for Administration & Staff</p>
        </div>

        <div className="mb-20">
          <h3 className="text-xl font-bold mb-6 border-b pb-2 uppercase tracking-wide">Table of Contents</h3>
          <ul className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-slate-700">
            <li><span className="font-bold mr-2">0.</span> System Access</li>
            <li><span className="font-bold mr-2">1.</span> Dashboard</li>
            <li><span className="font-bold mr-2">2.</span> Providers</li>
            <li><span className="font-bold mr-2">3.</span> On-Call Schedule</li>
            <li><span className="font-bold mr-2">4.</span> Outside Income</li>
            <li><span className="font-bold mr-2">5.</span> Invoices</li>
            <li><span className="font-bold mr-2">6.</span> Payments</li>
            <li><span className="font-bold mr-2">7.</span> Office Supply Orders</li>
            <li><span className="font-bold mr-2">8.</span> Clinical Supply Orders</li>
            <li><span className="font-bold mr-2">9.</span> Time Off & CME</li>
            <li><span className="font-bold mr-2">10.</span> Notifications & Closures</li>
            <li><span className="font-bold mr-2">11.</span> Licenses</li>
            <li><span className="font-bold mr-2">12.</span> Reports</li>
            <li><span className="font-bold mr-2">13.</span> Document Management</li>
            <li><span className="font-bold mr-2">14.</span> Clinical Privileges</li>
            <li><span className="font-bold mr-2">15.</span> CME Tracking</li>
            <li><span className="font-bold mr-2">16.</span> Office Catalog</li>
            <li><span className="font-bold mr-2">17.</span> Clinical Catalog</li>
            <li><span className="font-bold mr-2">18.</span> How System Works</li>
            <li><span className="font-bold mr-2">19.</span> Maintenance Tools</li>
            <li><span className="font-bold mr-2">20.</span> Coverage Checklist</li>
          </ul>
        </div>

        <div className="text-center text-xs text-slate-400">
          Generated on {currentDate}
        </div>
      </div>

      <div className="space-y-10">
        
        {/* System Access */}
        <PrintSection title="0. System Access" icon={LinkIcon}>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded bg-slate-50">
              <strong className="block text-sm mb-1">Operations Center (Admin)</strong>
              <div className="text-xs text-blue-800 font-mono">https://enticmd-operations-team.base44.app</div>
            </div>
            <div className="p-3 border rounded bg-slate-50">
              <strong className="block text-sm mb-1">Public Supply Request</strong>
              <div className="text-xs text-green-800 font-mono">https://enticmd-operations-team.base44.app/PublicSupplyRequest</div>
            </div>
          </div>
        </PrintSection>

        {/* 1. Dashboard */}
        <PrintSection title="1. Dashboard" icon={LayoutDashboard}>
          <p>The Dashboard is the central hub for monitoring the practice's health.</p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-sm">
            <li><strong>Alerts:</strong> Critical items (Expiring Licenses, Pending Invoices) appear at the top in red/yellow.</li>
            <li><strong>Summary Cards:</strong> Quick access to Draft Invoices, Supply Orders, and other counts.</li>
            <li><strong>Financial Overview:</strong> Real-time view of Outstanding vs. Paid amounts.</li>
            <li><strong>Customization:</strong> Use "Customize Dashboard" to personalize your view.</li>
          </ul>
        </PrintSection>

        {/* 2. Providers */}
        <PrintSection title="2. Providers" icon={Users}>
          <p>Manage staff profiles and employment details.</p>
          <div className="pl-4 border-l-2 border-slate-200 my-3">
            <h4 className="font-bold text-sm">Adding a Provider:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Navigate to <strong>Providers</strong> &gt; <strong>Add Provider</strong>.</li>
              <li>Enter Full Name, Email, Phone, Role.</li>
              <li>Select <strong>Program Locations</strong> (crucial for income logging).</li>
              <li>Set Status to "Active" and click <strong>Create Provider</strong>.</li>
            </ol>
          </div>
          <p className="text-xs italic bg-slate-50 p-2 rounded">Note: To deactivate, change Status to Inactive. Do not delete providers with history.</p>
        </PrintSection>

        {/* 3. On-Call Schedule */}
        <PrintSection title="3. On-Call Schedule" icon={Calendar}>
          <p>Manage provider rotation and drive automated income generation.</p>
          <div className="pl-4 border-l-2 border-slate-200 my-3">
            <h4 className="font-bold text-sm">Adding Shifts:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Navigate to <strong>On-Call Schedule</strong> &gt; <strong>Add Schedule</strong>.</li>
              <li>Select Provider, Location, and Dates.</li>
              <li><strong>Auto-Income:</strong> For St. Francis, say <strong>Yes</strong> to auto-create income records.</li>
            </ol>
          </div>
        </PrintSection>

        {/* 4. Outside Income */}
        <PrintSection title="4. Outside Income" icon={DollarSign}>
          <p>Log every billable shift or service here before invoicing.</p>
          <div className="pl-4 border-l-2 border-slate-200 my-3">
            <h4 className="font-bold text-sm">Process:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Navigate to <strong>Outside Income</strong> &gt; <strong>Add Income</strong>.</li>
              <li>Select Provider, Location, and Dates worked.</li>
              <li>Enter Days/Rate or RVUs depending on facility type.</li>
              <li>Click <strong>Save</strong> (Status: Pending).</li>
            </ol>
          </div>
        </PrintSection>

        {/* 5. Invoices */}
        <PrintSection title="5. Invoices" icon={FileText}>
          <p>Group income records into invoices for billing.</p>
          <div className="pl-4 border-l-2 border-slate-200 my-3">
            <h4 className="font-bold text-sm">Creating & Sending:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li><strong>Create:</strong> Select Program & Staff. Link pending income records.</li>
              <li><strong>PDF:</strong> Click "File Down" (⬇️) to generate official PDF (UConn/Manchester).</li>
              <li><strong>Sync:</strong> Click "Cloud" (☁️) to email to Vendor AP Dept.</li>
            </ol>
          </div>
          <div className="bg-slate-50 p-2 rounded text-xs mt-2">
            <strong>St. Francis/Hartford:</strong> Directorship invoices are often auto-created alongside RVU invoices.
          </div>
        </PrintSection>

        {/* 6. Payments */}
        <PrintSection title="6. Payments" icon={CreditCard}>
          <p>Record and allocate payments received.</p>
          <div className="pl-4 border-l-2 border-slate-200 my-3">
            <h4 className="font-bold text-sm">Workflow:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li><strong>Add Payment:</strong> Enter Amount, Date, Payer.</li>
              <li><strong>Allocate:</strong> Click "Add Allocation" to link to specific Invoices.</li>
              <li><strong>Result:</strong> Fully allocated invoices update to "Paid to ENTIC".</li>
            </ol>
          </div>
        </PrintSection>

        {/* 7. Office Supply Orders */}
        <PrintSection title="7. Office Supply Orders" icon={Package}>
          <p>Manage internal requests for office supplies.</p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-sm">
            <li>Filter by "Pending Review".</li>
            <li>Approve/Reject requests.</li>
            <li>Mark as "Order Placed" when purchasing.</li>
            <li>Mark as "Received" when delivered.</li>
          </ul>
        </PrintSection>

        {/* 8. Clinical Supply Orders */}
        <PrintSection title="8. Clinical Supply Orders" icon={ShoppingCart}>
          <p>Procurement for clinical/medical supplies.</p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-sm">
            <li>Follows same Review &gt; Order &gt; Receive workflow.</li>
            <li>Can be auto-created from "Sync Henry Schein" tool in Maintenance.</li>
          </ul>
        </PrintSection>

        {/* 9. Time Off & CME */}
        <PrintSection title="9. Time Off & CME" icon={Clock}>
          <p>Track provider absences.</p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-sm">
            <li>Log Vacation, CME, or Partial Days.</li>
            <li>These dates sync to the master calendar.</li>
          </ul>
        </PrintSection>

        {/* 10. Notifications */}
        <PrintSection title="10. Notifications & Closures" icon={Bell}>
          <p>Manage automated email reminders and holiday closures.</p>
          <div className="pl-4 border-l-2 border-slate-200 my-3">
            <h4 className="font-bold text-sm">Closures:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Create "Holiday" Reminder. Set Closure/Re-open Dates.</li>
              <li>Click <strong>Sync to Airtable</strong> to push to phone/email systems.</li>
            </ol>
          </div>
        </PrintSection>

        {/* 11. Licenses */}
        <PrintSection title="11. Licenses" icon={Shield}>
          <p>Track professional license expirations.</p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-sm">
            <li>Add License with Expiration Date.</li>
            <li>System alerts at 90, 60, 30 days before expiration.</li>
          </ul>
        </PrintSection>

        {/* 12. Reports */}
        <PrintSection title="12. Reports" icon={BarChart3}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Monthly Financials:</strong><br/>Provider payout bible for payroll.
            </div>
            <div>
              <strong>Invoice Aging:</strong><br/>Track overdue collections.
            </div>
            <div>
              <strong>Payment Tracking:</strong><br/>Audit trail of all receipts.
            </div>
            <div>
              <strong>Supply Analysis:</strong><br/>Spending by location.
            </div>
          </div>
        </PrintSection>

        {/* 13. Document Management */}
        <PrintSection title="13. Document Management" icon={FolderOpen}>
          <p>AI-powered Vendor Invoice processing.</p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-sm">
            <li><strong>Upload:</strong> Drag & drop PDFs. AI extracts Vendor/Amount.</li>
            <li><strong>Split:</strong> Use Split Tool for multi-invoice PDFs.</li>
            <li><strong>Allocations:</strong> Split costs to different locations/orders.</li>
          </ul>
        </PrintSection>

        {/* 14-17. Catalogs & Tracking */}
        <PrintSection title="14-17. Catalogs & Tracking" icon={BookOpen}>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-sm">
            <li><strong>Clinical Privileges:</strong> Track hospital privileges per provider.</li>
            <li><strong>CME Tracking:</strong> Monitor progress toward 3-credit annual goal.</li>
            <li><strong>Catalogs:</strong> Manage standard items for Office/Clinical ordering.</li>
          </ul>
        </PrintSection>

        {/* 18. How System Works */}
        <PrintSection title="18. How System Works" icon={Settings}>
          <div className="text-sm space-y-2">
            <p><strong>Data Flow:</strong> Income (Shift) &gt; Invoice (Bill) &lt; Payment (Receipt).</p>
            <p><strong>Automation:</strong>
              <br/>- License Checker runs daily.
              <br/>- Invoice Status Sync runs hourly to match Payments.
            </p>
            <p><strong>Manual Override:</strong> Manually changing an invoice status sets a lock (🔒) preventing auto-updates.</p>
          </div>
        </PrintSection>

        {/* 19. Maintenance */}
        <PrintSection title="19. Maintenance Tools" icon={RefreshCw}>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="border p-2 rounded">
              <strong>Sync Henry Schein</strong>
              <p className="text-xs text-slate-500">Auto-creates orders from invoices.</p>
            </div>
            <div className="border p-2 rounded">
              <strong>Fix Vendor Data</strong>
              <p className="text-xs text-slate-500">Normalizes names & locations.</p>
            </div>
            <div className="border p-2 rounded">
              <strong>Force Redact</strong>
              <p className="text-xs text-slate-500">Re-hides footer info on invoices.</p>
            </div>
          </div>
        </PrintSection>

        {/* 20. Checklist */}
        <PrintSection title="20. Coverage Checklist" icon={ClipboardList}>
          <div className="space-y-3 text-sm">
            <div>
              <strong className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Daily</strong>
              <span className="text-slate-600 ml-2">Check Pending Orders & Dashboard Alerts.</span>
            </div>
            <div>
              <strong className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Weekly (Fri)</strong>
              <span className="text-slate-600 ml-2">Log Income & Draft Invoices.</span>
            </div>
            <div>
              <strong className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Monthly (1st)</strong>
              <span className="text-slate-600 ml-2">Sync Invoices to Vendor & Reconcile Payments.</span>
            </div>
          </div>
        </PrintSection>

      </div>
    </div>
  );
}

function PrintSection({ title, icon: Icon, children }) {
  return (
    <div className="break-inside-avoid mb-8 border-b pb-6 border-slate-100">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1 rounded bg-slate-100">
          <Icon className="w-5 h-5 text-slate-700" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      </div>
      <div className="text-slate-700">
        {children}
      </div>
    </div>
  );
}