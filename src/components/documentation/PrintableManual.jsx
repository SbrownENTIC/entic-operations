import React from "react";
import { 
  Settings, 
  Users, 
  FileText, 
  DollarSign, 
  Package, 
  ShieldAlert, 
  ClipboardList 
} from "lucide-react";

export default function PrintableManual() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10 text-black">
      <div className="text-center mb-10 border-b pb-6">
        <h1 className="text-3xl font-bold mb-2">ENTIC Operations Center</h1>
        <h2 className="text-xl text-gray-600">User Manual</h2>
      </div>

      {/* 1. Dashboard */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Settings className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">1. Dashboard</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">The <strong>Dashboard</strong> is your mission control center. It provides a real-time snapshot of the practice's health.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Alerts:</strong> Red/Yellow alerts at the top highlight urgent actions like expiring licenses, pending approvals, or overdue invoices.</li>
            <li><strong>Summary Cards:</strong> Quick counts of supply orders, draft invoices, and other pending items.</li>
            <li><strong>Financial Overview:</strong> A high-level view of what's owed to ENTIC, what's been collected, and what's owed to providers.</li>
            <li><strong>Customization:</strong> Use the "Customize Dashboard" button to show/hide widgets based on your role.</li>
          </ul>
        </div>
      </section>

      {/* 2. Provider Management */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Users className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">2. Provider Management</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">Manage all staff details in the <strong>Providers</strong> module.</p>
          <h4 className="font-bold text-black mt-2 mb-1">Key Features:</h4>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Profile:</strong> Store email, phone, role, and program locations.</li>
            <li><strong>Status:</strong> Toggle between Active/Inactive. Inactive providers are hidden from most lists.</li>
            <li><strong>Documents:</strong> Upload and track employment contracts or other HR docs.</li>
            <li><strong>Terminations:</strong> Set a termination date, and the system will auto-deactivate the provider after that date passes.</li>
          </ul>
        </div>
      </section>

      {/* 3. Billing & Invoices */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><FileText className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">3. Billing & Invoices</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">This is the core revenue engine. The flow moves from <em>Outside Income</em> → <em>Invoices</em>.</p>
          
          <h4 className="font-bold text-black mt-2 mb-1">Outside Income (The "Shift" Logger)</h4>
          <p className="mb-2">Log every shift or service here. You can enter them manually or let the system auto-generate them from the On-Call Schedule.</p>
          
          <h4 className="font-bold text-black mt-2 mb-1">Invoices (The "Bill")</h4>
          <p className="mb-2">Group multiple income records into a single invoice to send to a facility (e.g., "November 2025 Invoices for UConn").</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Creation:</strong> Select a provider and program. The system finds all "Pending" income records for them.</li>
            <li><strong>PDF Generation:</strong> For UConn and Manchester, the system auto-generates a PDF using their official templates.</li>
            <li><strong>Status Tracking:</strong> Monitor the lifecycle from <em>Draft</em> → <em>Sent to Vendor</em> → <em>Paid</em>.</li>
          </ul>
        </div>
      </section>

      {/* 4. Payments & Allocations */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><DollarSign className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">4. Payments & Allocations</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">When money hits the bank, log it here. <strong>Crucial Rule:</strong> Never just log a total; you must allocate it.</p>
          
          <h4 className="font-bold text-black mt-2 mb-1">How to Process a Check:</h4>
          <ol className="list-decimal pl-6 space-y-1">
            <li>Create a new Payment record with the total check amount.</li>
            <li><strong>Attach Remittance:</strong> Upload the scan/PDF of the check or remittance advice.</li>
            <li><strong>Allocate:</strong> Click "Add Allocation" and select the invoices this check pays for.</li>
            <li><strong>Save:</strong> The system updates invoice balances. If an invoice is fully paid, its status flips to "Paid to ENTIC".</li>
          </ol>
        </div>
      </section>

      {/* 5. Supply Management */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Package className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">5. Supply Management</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">Manage inventory requests for both Office and Clinical supplies.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Catalogs:</strong> Define standard items (toner, gloves, paper) in the catalogs to make ordering easy.</li>
            <li><strong>Requests:</strong> Staff use a simplified form to request items.</li>
            <li><strong>Fulfillment:</strong> Managers review requests. Mark as "Ordered" when you buy them, and "Received" when they arrive.</li>
            <li><strong>Partial Receipt:</strong> You can mark individual line items as received if a shipment is split.</li>
          </ul>
        </div>
      </section>

      {/* 6. Compliance & Tracking */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><ShieldAlert className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">6. Compliance & Tracking</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">Keep the practice legal and compliant.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Licenses:</strong> Track expiration dates for Medical Licenses, DEA, etc. The system alerts you 90/60/30 days out.</li>
            <li><strong>Privileges:</strong> Track hospital privileges per facility.</li>
            <li><strong>CME:</strong> Log Continuing Medical Education credits. The dashboard tracks if doctors meet their annual quota (3 credits).</li>
            <li><strong>Time Off:</strong> Calendar view of provider vacations and time off.</li>
          </ul>
        </div>
      </section>

      {/* 7. Reports */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><ClipboardList className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">7. Reports</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">Export data for accounting and payroll.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Monthly Financials:</strong> The "Payout Bible". Shows exactly what each provider earned and collected for a specific month.</li>
            <li><strong>Invoice Aging:</strong> See who owes money and how long it's been outstanding.</li>
            <li><strong>Payment Tracking:</strong> Detailed audit trail of every dollar received.</li>
            <li><strong>Supply Analysis:</strong> See which locations are spending the most on supplies.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}