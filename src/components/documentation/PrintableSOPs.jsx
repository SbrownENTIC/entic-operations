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
    <div className="p-8 max-w-[21cm] mx-auto bg-white text-slate-900 font-sans print-container">
      <style>{`
        @media print {
          .print-container { max-width: 100% !important; padding: 0 !important; }
          .page-break { page-break-after: always; }
          .break-inside-avoid { page-break-inside: avoid; }
          .no-print { display: none; }
          a { text-decoration: none; color: black; }
          .toc-dots { border-bottom: 1px dotted #ccc; flex: 1; margin: 0 4px; position: relative; top: -4px; }
        }
      `}</style>

      {/* TITLE PAGE */}
      <div className="page-break flex flex-col items-center justify-center min-h-[85vh] text-center border-8 border-double border-slate-100 p-8 rounded-xl relative">
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          <div className="mb-6">
             <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691521cbabed77e5043c7037/267bf0119_thumbnail_ENTIC_horizontal_BKGD.png" 
                alt="ENTIC Logo" 
                className="h-32 w-auto object-contain mx-auto"
              />
          </div>
          
          <h1 className="text-5xl font-extrabold text-slate-900 mb-2 tracking-tight">OPERATIONS CENTER</h1>
          <div className="h-1 w-32 bg-blue-600 mx-auto my-6"></div>
          <h2 className="text-3xl text-slate-600 font-light uppercase tracking-widest mb-12">Standard Operating Procedures</h2>
          
          <div className="bg-slate-50 p-8 rounded-xl border border-slate-200 w-full max-w-2xl mx-auto shadow-sm">
            <h3 className="text-lg font-bold mb-6 text-slate-800 uppercase tracking-wide border-b pb-4">Table of Contents</h3>
            <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-left text-sm">
              {[
                "System Access", "Dashboard", "Providers", "On-Call Schedule", 
                "Outside Income", "Invoices", "Payments", "Office Supply Orders",
                "Clinical Supply Orders", "Time Off & CME", "Notifications & Closures",
                "Licenses", "Reports", "Document Management", "Clinical Privileges",
                "CME Tracking", "Office Catalog", "Clinical Catalog", "How System Works",
                "Maintenance Tools", "Coverage Checklist"
              ].map((item, idx) => (
                <div key={idx} className="flex items-baseline justify-between group">
                  <span className="font-medium text-slate-700 flex-shrink-0">
                    <span className="text-slate-400 mr-2 text-xs font-normal">{idx}.</span>{item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>


      </div>

      {/* CONTENT */}
      <div className="space-y-10 px-4">
        
        {/* System Access */}
        <PrintSection title="0. System Access" icon={LinkIcon} color="bg-gray-100">
          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 shadow-sm">
              <strong className="block text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide">Operations Center (Admin)</strong>
              <div className="text-xs text-blue-700 font-mono break-all">https://enticmd-operations-team.base44.app</div>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 shadow-sm">
              <strong className="block text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide">Public Supply Request</strong>
              <div className="text-xs text-green-700 font-mono break-all">https://enticmd-operations-team.base44.app/PublicSupplyRequest</div>
            </div>
          </div>
        </PrintSection>

        {/* 1. Dashboard */}
        <PrintSection title="1. Dashboard" icon={LayoutDashboard} color="bg-blue-50">
          <p className="mb-3">The Dashboard is the central hub for monitoring the practice's health.</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-slate-100 p-3 rounded">
              <strong className="text-slate-900">Alerts Panel</strong>
              <p className="text-xs text-slate-500 mt-1">Red/Yellow indicators for critical tasks like expiring licenses.</p>
            </div>
            <div className="bg-white border border-slate-100 p-3 rounded">
              <strong className="text-slate-900">Financial Overview</strong>
              <p className="text-xs text-slate-500 mt-1">Real-time outstanding vs. paid tracking.</p>
            </div>
          </div>
        </PrintSection>

        {/* 2. Providers */}
        <PrintSection title="2. Providers" icon={Users} color="bg-purple-50">
          <div className="flex gap-6">
            <div className="flex-1">
              <p className="mb-3 font-medium">Adding a New Provider:</p>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700 marker:font-bold marker:text-slate-400">
                <li>Navigate to <strong>Providers</strong> &gt; <strong>Add Provider</strong>.</li>
                <li>Enter Personal Info (Name, Email, Phone) and Role.</li>
                <li><strong>CRITICAL:</strong> Select all applicable <strong>Program Locations</strong>.</li>
                <li>Set Status to "Active" and click <strong>Create</strong>.</li>
              </ol>
            </div>
            <div className="w-1/3 bg-slate-50 p-4 rounded-lg border border-slate-100 text-xs">
              <strong className="block text-slate-900 mb-2">💡 Pro Tip</strong>
              To deactivate a provider, simply change their status to <strong>Inactive</strong>. Never delete a provider who has historical data attached.
            </div>
          </div>
        </PrintSection>

        {/* 3. On-Call Schedule */}
        <PrintSection title="3. On-Call Schedule" icon={Calendar} color="bg-indigo-50">
          <p className="mb-3">Manages provider rotation and drives income automation.</p>
          <div className="border-l-4 border-indigo-200 pl-4 py-1">
            <h4 className="font-bold text-sm text-indigo-900">Adding Shifts</h4>
            <p className="text-sm mt-1">Navigate to <strong>On-Call Schedule</strong> &gt; <strong>Add Schedule</strong>. Select Provider, Location, and Dates.</p>
            <div className="mt-2 bg-indigo-100/50 p-2 rounded text-xs text-indigo-800 font-medium">
              ✨ Automation: For <strong>St. Francis</strong> shifts, the system will offer to auto-create income records. Always select "Yes".
            </div>
          </div>
        </PrintSection>

        {/* 4. Outside Income */}
        <PrintSection title="4. Outside Income" icon={DollarSign} color="bg-green-50">
          <p className="mb-3">Log every billable shift or service here <strong>before</strong> invoicing.</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 border rounded bg-white">
              <div className="text-xs text-slate-400 uppercase font-bold">Step 1</div>
              <div className="font-medium text-sm">Add Income</div>
            </div>
            <div className="p-3 border rounded bg-white">
              <div className="text-xs text-slate-400 uppercase font-bold">Step 2</div>
              <div className="font-medium text-sm">Enter Details</div>
            </div>
            <div className="p-3 border rounded bg-white">
              <div className="text-xs text-slate-400 uppercase font-bold">Step 3</div>
              <div className="font-medium text-sm">Save (Pending)</div>
            </div>
          </div>
        </PrintSection>

        {/* 5. Invoices */}
        <PrintSection title="5. Invoices" icon={FileText} color="bg-emerald-50">
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-sm mb-2 text-emerald-900">The 3-Step Process</h4>
              <ol className="list-decimal pl-5 space-y-1 text-sm marker:text-emerald-500 marker:font-bold">
                <li><strong>Create:</strong> Select Program & Staff. Link pending income records.</li>
                <li><strong>PDF:</strong> Click "File Down" (⬇️) to generate official PDF (UConn/Manchester).</li>
                <li><strong>Sync:</strong> Click "Cloud" (☁️) to email to Vendor AP Dept.</li>
              </ol>
            </div>
            <div className="bg-white border border-emerald-100 p-3 rounded-lg text-xs flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-full font-bold text-emerald-700">!</div>
              <div>
                <strong>Hartford/St. Francis Directorships:</strong> These invoices are often auto-created alongside standard RVU invoices.
              </div>
            </div>
          </div>
        </PrintSection>

        {/* 6. Payments */}
        <PrintSection title="6. Payments" icon={CreditCard} color="bg-teal-50">
          <p className="mb-3">Record payments and allocate them to close out invoices.</p>
          <div className="flex items-center gap-4 text-sm border p-4 rounded-lg bg-white">
            <div className="flex-1">
              <strong>1. Add Payment</strong>
              <p className="text-slate-500 text-xs">Total Amount & Date</p>
            </div>
            <div className="text-slate-300">→</div>
            <div className="flex-1">
              <strong>2. Allocate</strong>
              <p className="text-slate-500 text-xs">Link to Invoices</p>
            </div>
            <div className="text-slate-300">→</div>
            <div className="flex-1">
              <strong>3. Complete</strong>
              <p className="text-slate-500 text-xs">Status: Paid to ENTIC</p>
            </div>
          </div>
        </PrintSection>

        {/* 7 & 8. Supplies */}
        <PrintSection title="7 & 8. Supply Orders" icon={ShoppingCart} color="bg-orange-50">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold text-sm mb-2 text-orange-900 border-b border-orange-200 pb-1">Office Supplies</h4>
              <ul className="list-disc pl-4 space-y-1 text-sm text-slate-700">
                <li>Filter by "Pending Review"</li>
                <li>Approve/Reject requests</li>
                <li>Mark "Order Placed" -> "Received"</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-2 text-orange-900 border-b border-orange-200 pb-1">Clinical Supplies</h4>
              <ul className="list-disc pl-4 space-y-1 text-sm text-slate-700">
                <li>Same workflow as Office</li>
                <li>Use <strong>"Sync Henry Schein"</strong> tool to auto-create from invoices</li>
              </ul>
            </div>
          </div>
        </PrintSection>

        {/* 9. Time Off */}
        <PrintSection title="9. Time Off & CME" icon={Clock} color="bg-rose-50">
          <p className="text-sm">Track provider absences. Log Vacation, CME, or Partial Days. Dates sync to the master calendar.</p>
        </PrintSection>

        {/* 10. Notifications */}
        <PrintSection title="10. Notifications" icon={Bell} color="bg-yellow-50">
          <div className="flex justify-between items-center text-sm">
            <p>Manage automated email reminders and holiday closures.</p>
            <div className="bg-white px-3 py-1 rounded border border-yellow-200 text-yellow-800 text-xs font-bold uppercase">
              Action: Sync to Airtable
            </div>
          </div>
        </PrintSection>

        {/* 11. Licenses */}
        <PrintSection title="11. Licenses" icon={Shield} color="bg-red-50">
          <p className="text-sm">Track expirations. System auto-alerts at:</p>
          <div className="flex gap-2 mt-2">
            {[90, 60, 30, 14, 7].map(day => (
              <span key={day} className="bg-white border border-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold shadow-sm">{day} Days</span>
            ))}
          </div>
        </PrintSection>

        {/* 12. Reports */}
        <PrintSection title="12. Reports" icon={BarChart3} color="bg-slate-100">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span>Monthly Financials</span>
              <span className="text-slate-500">For Payroll</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span>Invoice Aging</span>
              <span className="text-slate-500">Collections</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span>Payment Tracking</span>
              <span className="text-slate-500">Audit Trail</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span>Supply Analysis</span>
              <span className="text-slate-500">Spending</span>
            </div>
          </div>
        </PrintSection>

        {/* 13. Doc Management */}
        <PrintSection title="13. Document Management" icon={FolderOpen} color="bg-blue-50">
          <p className="text-sm mb-2">AI-powered processing for Vendor Invoices.</p>
          <div className="flex gap-2 text-xs">
            <span className="bg-white border px-2 py-1 rounded">Drag & Drop Upload</span>
            <span className="bg-white border px-2 py-1 rounded">Auto-Extract Data</span>
            <span className="bg-white border px-2 py-1 rounded">Split Multi-Page PDFs</span>
          </div>
        </PrintSection>

        {/* 14-17. Misc */}
        <PrintSection title="14-17. Catalogs & Tracking" icon={BookOpen} color="bg-slate-50">
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
            <li><strong>Clinical Privileges:</strong> Track hospital privileges per provider.</li>
            <li><strong>CME Tracking:</strong> Monitor progress toward 3-credit annual goal.</li>
            <li><strong>Catalogs:</strong> Manage standard items for faster ordering.</li>
          </ul>
        </PrintSection>

        {/* 18. Logic */}
        <PrintSection title="18. System Logic" icon={Settings} color="bg-gray-100">
          <div className="text-sm space-y-2">
            <p><strong>Automation:</strong> License Checker (Daily), Invoice Status Sync (Hourly).</p>
            <p><strong>Manual Override:</strong> Manually changing an invoice status sets a lock (🔒) preventing auto-updates. Click the lock to reset.</p>
          </div>
        </PrintSection>

        {/* 19. Maintenance */}
        <PrintSection title="19. Maintenance Tools" icon={RefreshCw} color="bg-slate-50">
          <div className="grid grid-cols-3 gap-4 text-sm text-center">
            <div className="border p-3 rounded bg-white">
              <div className="font-bold text-slate-900">Sync Henry</div>
              <div className="text-xs text-slate-500 mt-1">Invoices → Orders</div>
            </div>
            <div className="border p-3 rounded bg-white">
              <div className="font-bold text-slate-900">Fix Data</div>
              <div className="text-xs text-slate-500 mt-1">Normalize Vendors</div>
            </div>
            <div className="border p-3 rounded bg-white">
              <div className="font-bold text-slate-900">Force Redact</div>
              <div className="text-xs text-slate-500 mt-1">Re-hide Footers</div>
            </div>
          </div>
        </PrintSection>

        {/* 20. Checklist */}
        <PrintSection title="20. Coverage Checklist" icon={ClipboardList} color="bg-yellow-50">
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div>
              <div className="font-bold text-yellow-900 flex items-center gap-1 mb-2"><CheckCircle2 className="w-4 h-4" /> Daily</div>
              <p className="text-slate-700 text-xs">Check Pending Orders & Dashboard Alerts.</p>
            </div>
            <div>
              <div className="font-bold text-yellow-900 flex items-center gap-1 mb-2"><CheckCircle2 className="w-4 h-4" /> Weekly</div>
              <p className="text-slate-700 text-xs">Log Income from texts/emails. Draft Invoices.</p>
            </div>
            <div>
              <div className="font-bold text-yellow-900 flex items-center gap-1 mb-2"><CheckCircle2 className="w-4 h-4" /> Monthly</div>
              <p className="text-slate-700 text-xs">Sync Invoices to Vendor. Reconcile Payments.</p>
            </div>
          </div>
        </PrintSection>

        <div className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm font-medium break-inside-avoid">
          <p>Version 2.0 • Last Updated {currentDate}</p>
          <p className="mt-1 text-xs">ENTIC Medical Administration</p>
        </div>

      </div>
    </div>
  );
}

function PrintSection({ title, icon: Icon, color = "bg-slate-50", children }) {
  return (
    <div className={`break-inside-avoid mb-8 border border-slate-200 rounded-xl overflow-hidden shadow-sm`}>
      <div className={`flex items-center gap-3 px-6 py-3 border-b border-slate-200 ${color}`}>
        <div className="bg-white p-1.5 rounded-lg shadow-sm">
          <Icon className="w-5 h-5 text-slate-800" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-6 bg-white text-slate-700">
        {children}
      </div>
    </div>
  );
}