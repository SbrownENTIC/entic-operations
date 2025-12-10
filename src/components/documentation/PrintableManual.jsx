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
  RefreshCw
} from "lucide-react";

export default function PrintableManual() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12 text-black font-sans">
      <div className="text-center mb-12 border-b pb-8">
        <h1 className="text-4xl font-bold mb-3 text-slate-900">ENTIC Operations Center</h1>
        <h2 className="text-2xl text-slate-600">User Manual & Roadmap</h2>
        <p className="text-sm text-slate-500 mt-4">Comprehensive Guide for Staff & Managers</p>
      </div>

      <div className="break-after-page">
        <h3 className="text-xl font-bold mb-4">Table of Contents</h3>
        <ul className="grid grid-cols-2 gap-2 text-sm text-slate-700">
          <li>1. Dashboard & Customization</li>
          <li>2. Provider Management</li>
          <li>3. On-Call Schedule</li>
          <li>4. Outside Income & Billing</li>
          <li>5. Invoices & Workflows</li>
          <li>6. Payments & Allocations</li>
          <li>7. Supply Management & Catalogs</li>
          <li>8. Time Off & CME</li>
          <li>9. Compliance (Licenses & Privileges)</li>
          <li>10. Notifications & Closures</li>
          <li>11. Reports</li>
          <li>12. Document Management</li>
          <li>13. Facility Workflows</li>
        </ul>
      </div>

      {/* 1. Dashboard */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-100"><Layout className="w-6 h-6 text-blue-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">1. Dashboard & Customization</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>The <strong>Dashboard</strong> is your mission control center. It provides a real-time snapshot of the practice's health and your immediate tasks.</p>
          
          <div>
            <h4 className="font-bold text-slate-900 mb-1">Key Widgets:</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Alerts Panel:</strong> Red/Yellow alerts at the top highlight urgent actions (e.g., expiring licenses, pending supply approvals). Click an alert to jump to the relevant item.</li>
              <li><strong>Summary Cards:</strong> Quick counts of draft invoices, pending payments, and open orders.</li>
              <li><strong>Financial Overview:</strong> A high-level graph of what's owed to ENTIC vs. what's been collected.</li>
              <li><strong>CME Compliance:</strong> Tracks progress toward the annual 3-credit goal for each provider.</li>
            </ul>
          </div>

          <div className="bg-slate-50 p-4 rounded border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><Settings className="w-4 h-4" /> How to Customize Your View</h4>
            <p className="mb-2">You can tailor the dashboard to show only what matters to you:</p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Click the <strong>"Customize Dashboard"</strong> button in the top-right corner.</li>
              <li>A panel will slide out listing all available widgets.</li>
              <li>Toggle the switches <strong>On/Off</strong> for each widget (e.g., hide "Financial Overview" if you only manage supplies).</li>
              <li>Click <strong>"Save Preferences"</strong>. Your settings are saved for your next visit.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* 2. Provider Management */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-purple-50 border border-purple-100"><Users className="w-6 h-6 text-purple-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">2. Provider Management</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>The <strong>Providers</strong> module is the central registry for all staff members.</p>
          
          <div>
            <h4 className="font-bold text-slate-900 mb-1">Managing Profiles:</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Status:</strong> Toggle providers between <em>Active</em> and <em>Inactive</em>. Inactive providers are hidden from dropdowns to keep lists clean.</li>
              <li><strong>Program Locations:</strong> Assign providers to specific facilities (e.g., "Hartford Hospital", "UConn"). This filters what they see in other modules.</li>
              <li><strong>Terminations:</strong> Setting a "Termination Date" will automatically mark the provider as Inactive once that date passes.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. On-Call Schedule */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100"><Calendar className="w-6 h-6 text-indigo-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">3. On-Call Schedule</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>Manage and view the provider rotation for all facilities. This schedule drives the automatic income generation for on-call shifts.</p>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-slate-900 mb-1">Views & Navigation:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Calendar View:</strong> Visual monthly grid. Drag and drop isn't supported yet, but clicking a day allows you to add/edit.</li>
                <li><strong>List View:</strong> Sortable table of all shifts. Best for bulk editing or searching specific dates.</li>
                <li><strong>Filtering:</strong> Use the dropdowns to filter by specific Provider or Location.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">Adding Shifts:</h4>
              <ol className="list-decimal pl-6 space-y-1">
                <li>Click <strong>"Add Schedule"</strong>.</li>
                <li>Select Provider, Location, Start/End Dates.</li>
                <li><strong>Auto-Income:</strong> For locations like St. Francis, the system will ask if you want to auto-create "Outside Income" records for these dates. Say <strong>Yes</strong> to save time!</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Outside Income & Billing */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-green-50 border border-green-100"><DollarSign className="w-6 h-6 text-green-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">4. Outside Income</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>This is where you log every billable service or shift. Think of it as the "Timesheet" that feeds into Invoices.</p>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">Logging Income:</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Manual Entry:</strong> Click "Add Income". Select the Facility.
                <ul className="list-square pl-4 mt-1 text-slate-600">
                  <li>For <strong>Daily Rate</strong> locations (e.g., St. Francis), enter "Days Worked". The system calculates Total ($).</li>
                  <li>For <strong>RVU</strong> locations (e.g., Hartford Hospital), enter "Total RVUs".</li>
                </ul>
              </li>
              <li><strong>Status:</strong> Records start as <em>Pending</em>. Once included in an invoice, they flip to <em>Invoiced</em>. Once paid, they become <em>Paid</em>.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. Invoices & Workflows */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100"><FileText className="w-6 h-6 text-emerald-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">5. Invoices & Workflows</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>The <strong>Invoices</strong> module groups individual income records into a formal bill for a facility.</p>

          <div className="bg-slate-50 p-4 rounded border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-2">Creating an Invoice (Step-by-Step):</h4>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Go to <strong>Invoices</strong> -> <strong>Create Invoice</strong>.</li>
              <li>Select <strong>Program Group</strong> (e.g., UConn) and <strong>Staff Member</strong>.</li>
              <li>The system automatically finds all <em>Pending</em> income for that provider/program.</li>
              <li><strong>Link Income:</strong> Select the shifts you want to bill for. The invoice total is auto-calculated.</li>
              <li><strong>Save.</strong></li>
            </ol>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">Specific Workflows:</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>UConn & Manchester:</strong> These have special automation. Once created, click the <strong>"File Down" (⬇️)</strong> icon to generate the official PDF. Then click the <strong>"Cloud"</strong> icon to sync it to Airtable for emailing.</li>
              <li><strong>Hartford Hospital:</strong> Creating an RVU invoice will check for Directorships. If found, the system asks to auto-create a separate Directorship invoice.</li>
              <li><strong>St. Francis:</strong> Income is typically auto-generated from the On-Call Schedule. Create a standard invoice and link these pending records to bill them.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 6. Payments & Allocations */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-teal-50 border border-teal-100"><DollarSign className="w-6 h-6 text-teal-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">6. Payments & Allocations</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>When a check or wire arrives, log it here. <strong>Crucial:</strong> A payment record is useless unless it is "Allocated" to invoices.</p>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-slate-900 mb-1">Processing a Payment:</h4>
              <ol className="list-decimal pl-6 space-y-1">
                <li>Click <strong>"Add Payment"</strong>. Enter total amount and date.</li>
                <li><strong>Attach Remittance:</strong> Upload the PDF/Image of the check details.</li>
                <li><strong>Allocate:</strong> In the "Allocations" section, search for the invoices being paid.</li>
                <li>Enter the amount for each invoice. The "Unallocated Amount" should reach $0.00.</li>
              </ol>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">Auto-Updates:</h4>
              <p className="text-slate-600">When you save a fully allocated payment:</p>
              <ul className="list-disc pl-6 space-y-1 text-slate-600">
                <li>The linked Invoices update to <em>Paid to ENTIC</em>.</li>
                <li>The "Amount Received" on the invoice updates.</li>
                <li>The Provider Payout report updates automatically.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Supply Management & Catalogs */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-orange-50 border border-orange-100"><Package className="w-6 h-6 text-orange-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">7. Supply Management</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>Manage inventory for both Office and Clinical supplies across all locations.</p>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Using Catalogs</h4>
              <p>Go to <strong>Office Catalog</strong> or <strong>Clinical Catalog</strong> to browse standard items.</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li><strong>Add to Cart:</strong> Select items you need.</li>
                <li><strong>Checkout:</strong> Review your cart, select the Delivery Location, and submit.</li>
                <li>This creates a "Supply Order" automatically.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">Managing Orders:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Review:</strong> Managers see orders in "Pending Review". Click Approve to proceed.</li>
                <li><strong>Fulfillment:</strong> Mark items as "Received" when boxes arrive. You can receive partial orders (e.g., 2 of 5 boxes).</li>
                <li><strong>Status:</strong> Only when <em>all</em> items are received does the order close.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Time Off & CME */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-rose-50 border border-rose-100"><Calendar className="w-6 h-6 text-rose-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">8. Time Off & CME Requests</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>Use the <strong>Time Off & CME</strong> module to manage schedule availability.</p>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">How to Request:</h4>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Click <strong>"Add Time Off"</strong>.</li>
              <li>Select Provider and Date Range.</li>
              <li><strong>Type:</strong> Choose <em>Vacation</em>, <em>CME</em>, or <em>Partial Day</em>.
                <ul className="list-square pl-4 mt-1 text-slate-600">
                  <li>For <strong>Partial Day</strong>, specify the time (e.g., "Leaving at 12pm").</li>
                </ul>
              </li>
              <li>Save. The request appears on the master calendar for admin review.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* 9. Compliance (Licenses & Privileges) */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-red-50 border border-red-100"><ShieldAlert className="w-6 h-6 text-red-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">9. Compliance Tracking</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>Keep the practice legal. The system tracks expiration dates for all credentials.</p>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-slate-900 mb-1">Licenses:</h4>
              <p>Tracks Medical Licenses, DEA, etc.</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li><strong>Alerts:</strong> The system sends email warnings at 90, 60, 30, 14, and 7 days before expiration.</li>
                <li><strong>Renewal:</strong> When you renew, update the "Expiration Date" here to reset the alerts.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">Clinical Privileges:</h4>
              <p>Tracks hospital-specific privileges.</p>
              <ul className="list-disc pl-6 space-y-1 mt-1">
                <li>Lists each facility where a provider can practice.</li>
                <li>Tracks "Granted Date" and "Expiration Date".</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-slate-50 p-3 rounded border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-2"><GraduationCap className="w-4 h-4" /> CME Tracking</h4>
            <p>Log courses in <strong>CME Tracking</strong>. The Dashboard widget shows a progress bar for each provider towards their 3-credit annual goal.</p>
          </div>
        </div>
      </section>

      {/* 10. Notifications & Closures */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-yellow-50 border border-yellow-100"><Bell className="w-6 h-6 text-yellow-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">10. Notifications & Office Closures</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>The <strong>Reminders</strong> module manages system-wide alerts and office closure announcements.</p>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">Managing Closures:</h4>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Create a new Reminder with type <strong>"Holiday"</strong> or <strong>"Office Closure"</strong>.</li>
              <li>Set the "Closure Date" and "Re-open Date".</li>
              <li><strong>Sync:</strong> Click <strong>"Sync Reminders to Airtable"</strong>. This pushes the closure info to our phone system and email notification service.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* 11. Reports */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-gray-50 border border-gray-100"><ClipboardList className="w-6 h-6 text-gray-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">11. Reports</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>Export clean data for accounting and payroll.</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Monthly Financials:</strong> The "Payout Bible". Shows exactly what each provider earned and what was collected for a specific month. Use this for payroll.</li>
            <li><strong>Invoice Aging:</strong> See who owes money (30/60/90 days overdue).</li>
            <li><strong>Payment Tracking:</strong> A detailed audit trail of every dollar received and where it was allocated.</li>
          </ul>
        </div>
      </section>

      {/* 12. Document Management */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-100"><FileText className="w-6 h-6 text-blue-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">12. Document Management</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>The <strong>Document Management</strong> module handles Vendor Invoices with AI-powered processing.</p>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-slate-900 mb-1">Processing Invoices:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Upload:</strong> Drag & drop PDF invoices. The system automatically extracts Vendor, Date, and Total Amount.</li>
                <li><strong>Split PDF:</strong> If you have one PDF with multiple invoices, use the "Split Multi-Invoice PDF" tool. The AI will separate them into individual records automatically.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">Allocations & Linking:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Allocation:</strong> You can split a large invoice by allocating specific items to different locations. This creates new invoices/orders for those locations and reduces the original invoice total.</li>
                <li><strong>Syncing:</strong> Deleted a Clinical Supply Order by mistake? Use the "Refresh/Sync" button on the invoice list to recreate it from the invoice data.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 13. Facility Workflows */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100"><RefreshCw className="w-6 h-6 text-indigo-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">13. Facility Workflows</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>Step-by-step guides for the most common billing scenarios.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border rounded-lg p-4 bg-slate-50">
              <h4 className="font-bold text-slate-900 mb-2 border-b pb-1">UConn & Manchester (ECHN)</h4>
              <ol className="list-decimal pl-5 space-y-2 text-xs">
                <li><strong>Create Invoice:</strong> Select Provider & Program Group (UConn or Manchester). Link the pending income records.</li>
                <li><strong>Generate PDF:</strong> Once created, look for the "File Down" (⬇️) icon in the invoice list. Click it to generate the official PDF template.</li>
                <li><strong>Sync & Send:</strong> Select the approved invoices and click the <strong>Cloud Icon</strong>.
                  <ul className="list-disc pl-4 mt-1 text-slate-600">
                    <li>This sends the PDF and data to the Notification system.</li>
                    <li>An email is automatically drafted/sent to the AP department (e.g., Ann Marie at ECHN).</li>
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
                <li><strong>Result:</strong> You now have two invoices: one for RVUs, one for the Directorship.</li>
              </ol>
            </div>

            <div className="border rounded-lg p-4 bg-slate-50 md:col-span-2">
              <h4 className="font-bold text-slate-900 mb-2 border-b pb-1">St. Francis</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <ol className="list-decimal pl-5 space-y-2 text-xs">
                  <li><strong>Schedule First:</strong> Go to On-Call Schedule. Add the provider to the St. Francis location for their shifts.</li>
                  <li><strong>Auto-Income:</strong> The system automatically creates "Pending" Outside Income records for each scheduled day (calculated as Daily Rate).</li>
                  <li><strong>Create Invoice:</strong> Go to Invoices -> Create. Select St. Francis.</li>
                  <li><strong>Link:</strong> You will see the auto-generated income records in the list. Select them to include in the bill.</li>
                </ol>
                <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 flex items-center">
                  <p><strong>Note:</strong> You do not need to manually enter income for St. Francis if the schedule is up to date. The system does the math for you based on the provider's contracted daily rate.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="break-inside-avoid mt-12 border-t-2 border-slate-100 pt-6">
        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Questions or Concerns?</h3>
          <p className="text-slate-700">
            Please email your system administrator <strong>Steve Brown</strong> at <a href="mailto:steve.brown@enticmd.com" className="text-blue-600 hover:underline">steve.brown@enticmd.com</a>.
          </p>
        </div>
      </section>

    </div>
  );
}