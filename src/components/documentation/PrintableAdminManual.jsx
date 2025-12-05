import React from "react";
import { 
  Settings, 
  Database, 
  Server, 
  Shield, 
  Wrench, 
  RefreshCw,
  FileJson,
  Link
} from "lucide-react";

export default function PrintableAdminManual() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10 text-black">
      <div className="text-center mb-10 border-b pb-6">
        <h1 className="text-3xl font-bold mb-2">ENTIC Operations Center</h1>
        <h2 className="text-xl text-gray-600">System Administrator Manual</h2>
        <p className="text-sm text-gray-500 mt-2">Confidential - Internal Use Only</p>
      </div>

      {/* 1. System Architecture */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Server className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">1. System Architecture</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">The ENTIC Operations Center is built on a modern, cloud-native stack designed for reliability and security.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Platform:</strong> Base44 (Backend-as-a-Service). Handles database, authentication, and hosting.</li>
            <li><strong>Frontend:</strong> React.js with Tailwind CSS for styling.</li>
            <li><strong>Backend Logic:</strong> Serverless functions (Deno/Node.js) handling complex logic like PDF generation and data syncing.</li>
            <li><strong>Database:</strong> Relational data model (Entities) stored securely in the cloud.</li>
          </ul>
        </div>
      </section>

      {/* 2. Data Management & Dropdowns */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Database className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">2. Managing System Lists</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">The application relies on several "Master Lists" to populate dropdowns and drive logic. Admins must maintain these.</p>
          
          <h4 className="font-bold text-black mt-3 mb-1">Program Locations</h4>
          <p className="mb-1">This is the most critical list. It drives:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>The "Facility" dropdowns in Outside Income and Invoices.</li>
            <li>The daily rates for specific programs.</li>
            <li><strong>Invoice Counters:</strong> Each location tracks its own sequential invoice number (e.g., UConn starts at #40).</li>
          </ul>
          <p className="mt-2"><em>To Edit:</em> Navigate to the hidden <strong>Program Locations</strong> page (or use the direct URL <code>/ProgramLocations</code>) to adjust rates or reset counters.</p>
        </div>
      </section>

      {/* 3. Advanced Maintenance Tools */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Wrench className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">3. Maintenance Tools (The "Fix" Buttons)</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">The system includes several self-healing tools located on the Invoices and Outside Income pages. Use these if data appears inconsistent.</p>
          
          <div className="mb-4">
            <h4 className="font-bold text-black mb-1">"Fix & Sync Data" (Invoices Page)</h4>
            <p><strong>When to use:</strong> Invoice balances look wrong, or status says "Partial" when it should be "Paid".</p>
            <p><strong>What it does:</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Recalculates <code>amount_received</code> for every invoice by summing up linked payments.</li>
              <li>Updates invoice status to <code>paid_to_entic</code> if Balance = 0.</li>
              <li>Ensures <code>OutsideIncome</code> records are correctly linked to their parent invoices.</li>
            </ul>
          </div>

          <div className="mb-4">
            <h4 className="font-bold text-black mb-1">"Fix Amounts" (Outside Income Page)</h4>
            <p><strong>When to use:</strong> You updated a Provider's daily rate and need historical records to match.</p>
            <p><strong>What it does:</strong> Iterates through records and re-runs the math: <code>Days Worked × Rate = Total Amount</code>.</p>
          </div>
        </div>
      </section>

      {/* 4. Integrations & Automation */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><RefreshCw className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">4. Integrations & Automation</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          
          <h4 className="font-bold text-black mt-3 mb-1">PDF Generation</h4>
          <p className="mb-2">The system uses code-based templates to generate PDFs for UConn and Manchester/ECHN.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Trigger:</strong> Happens automatically on Invoice Create/Update.</li>
            <li><strong>Logic:</strong> Fetches the invoice data, formats it into a table, and renders a PDF file.</li>
            <li><strong>Storage:</strong> The resulting PDF is uploaded to the system's file storage, and the URL is saved to the invoice record.</li>
          </ul>

          <h4 className="font-bold text-black mt-3 mb-1">Airtable Sync</h4>
          <p className="mb-2">Used to email approved invoices to ECHN (Ann Marie).</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Trigger:</strong> Manual button click on Invoices page ("Cloud" icon).</li>
            <li><strong>Action:</strong> Sends the Invoice PDF URL and Provider Name to a specific Airtable base.</li>
            <li><strong>Result:</strong> An automation in Airtable picks this up and sends the email.</li>
          </ul>
        </div>
      </section>

      {/* 5. User & Security Management */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Shield className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">5. User & Security Management</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">Security is handled at the platform level.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Inviting Users:</strong> Done via the Base44 Dashboard. Users receive an email invite.</li>
            <li><strong>Roles:</strong> Currently, all authenticated users have access to the Operations Center.</li>
            <li><strong>Provider vs. User:</strong> "Providers" in the app are just data records (names/rates). "Users" are the actual people logging in (Steve, etc.). These are separate concepts.</li>
          </ul>
        </div>
      </section>

      {/* 6. Troubleshooting & Logs */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><FileJson className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">6. Troubleshooting Guide</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <div className="grid grid-cols-1 gap-4">
            <div className="border p-3 rounded">
              <p className="font-bold text-black text-sm">Issue: "Invoice PDF is blank"</p>
              <p className="text-xs text-gray-800 mt-1"><strong>Fix:</strong> The PDF generator relies on the "Work Dates" field in the linked Outside Income record. If that array is empty, the table is empty. Go back and add specific dates to the income record.</p>
            </div>
            <div className="border p-3 rounded">
              <p className="font-bold text-black text-sm">Issue: "Cannot delete Invoice"</p>
              <p className="text-xs text-gray-800 mt-1"><strong>Fix:</strong> An invoice cannot be deleted if it has Payment Allocations linked to it. You must go to the Payment, remove the allocation, and then delete the invoice.</p>
            </div>
            <div className="border p-3 rounded">
              <p className="font-bold text-black text-sm">Issue: "St. Francis shifts not appearing"</p>
              <p className="text-xs text-gray-800 mt-1"><strong>Fix:</strong> The auto-generator runs when the Schedule is updated. Try opening the On-Call Schedule page and making a small edit/save to trigger the sync job.</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}