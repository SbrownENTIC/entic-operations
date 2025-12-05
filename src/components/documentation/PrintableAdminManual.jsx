import React from "react";
import { 
  Settings, 
  Database, 
  Server, 
  Shield, 
  Wrench, 
  RefreshCw,
  FileJson,
  Mail,
  Clock,
  FileCode
} from "lucide-react";

export default function PrintableAdminManual() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10 text-black font-sans">
      <div className="text-center mb-10 border-b pb-6">
        <h1 className="text-3xl font-bold mb-2">ENTIC Operations Center</h1>
        <h2 className="text-xl text-gray-600">Service Administrator Manual</h2>
        <p className="text-sm text-gray-500 mt-2">Confidential - For System Administrators & Technical Staff</p>
      </div>

      {/* 1. Backend Architecture */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Server className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">1. Backend Architecture</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">The system is built on the <strong>Base44</strong> platform, which provides the backend infrastructure (Database, Auth, Hosting). The "Brain" of the application lives in the <strong>Backend Functions</strong> (Serverless Code).</p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="border p-3 rounded bg-gray-50">
              <h4 className="font-bold mb-1">Entities (Database)</h4>
              <p className="text-xs">Relational data models stored in the cloud. Key entities include:</p>
              <ul className="list-disc pl-4 text-xs mt-1 space-y-1">
                <li><strong>Provider:</strong> Staff profiles.</li>
                <li><strong>Invoice:</strong> Parent record for billing.</li>
                <li><strong>OutsideIncome:</strong> Child records (individual shifts) linked to Invoices.</li>
                <li><strong>Payment:</strong> Bank deposits allocated to Invoices.</li>
              </ul>
            </div>
            <div className="border p-3 rounded bg-gray-50">
              <h4 className="font-bold mb-1">Functions (Logic)</h4>
              <p className="text-xs">Javascript/Deno code that runs on the server. Handles:</p>
              <ul className="list-disc pl-4 text-xs mt-1 space-y-1">
                <li>Generating PDFs (pdf-lib).</li>
                <li>Syncing data to Airtable.</li>
                <li>Scheduled tasks (Cron jobs).</li>
                <li>Complex calculations (Auto-splitting invoices).</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Detailed Billing Automation */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><FileCode className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">2. Billing Automation & Email Workflows</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          
          <h4 className="font-bold text-black text-lg mt-4 mb-2 border-l-4 border-blue-500 pl-2">UConn Health Workflow</h4>
          <p className="mb-2">UConn billing is fully automated from PDF generation to Email delivery via Airtable.</p>
          
          <div className="ml-4 space-y-3">
            <div>
              <strong className="block text-gray-800">Step 1: PDF Generation</strong>
              <p className="text-gray-600 text-xs">
                Function: <code>generateUConnPDF.js</code><br/>
                Triggered automatically when an invoice is created/updated for the "UConn" program group.<br/>
                It loads the master template <code>MasterUConnServiceInvoice.pdf</code> and populates it with line items derived from the linked <em>Outside Income</em> records (Date + Provider Name).
              </p>
            </div>
            <div>
              <strong className="block text-gray-800">Step 2: Email Dispatch (The "Sync")</strong>
              <p className="text-gray-600 text-xs">
                Function: <code>syncUConnInvoiceToAirtable.js</code><br/>
                Trigger: Admin clicks the "Cloud" icon on the Invoices page.<br/>
                <strong>Mechanism:</strong> The system creates a record in the ENTIC Airtable Base (Table: <em>Notifications</em>). An Automation inside Airtable detects this new record and sends the actual email via Gmail/Outlook integration.
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <strong className="block text-xs uppercase text-gray-500 tracking-wide mb-1">Email Configuration (Hardcoded in Backend)</strong>
              <ul className="list-none space-y-1 text-xs font-mono">
                <li><strong>To:</strong> amoffo@uchc.edu, jserrano@uchc.edu</li>
                <li><strong>CC:</strong> steve.brown@enticmd.com, heldridge@enticmd.com</li>
                <li><strong>Subject:</strong> UConn [Month] Invoices</li>
                <li><strong>Body:</strong> "Hey Team... The [Month] clinic session details..."</li>
              </ul>
            </div>
          </div>

          <h4 className="font-bold text-black text-lg mt-6 mb-2 border-l-4 border-green-500 pl-2">Manchester / ECHN Workflow</h4>
          <p className="mb-2">Similar to UConn but uses different templates and recipients.</p>
          
          <div className="ml-4 space-y-3">
            <div>
              <strong className="block text-gray-800">Step 1: PDF Generation</strong>
              <p className="text-gray-600 text-xs">Function: <code>generateManchesterPDF.js</code></p>
            </div>
            <div>
              <strong className="block text-gray-800">Step 2: Email Dispatch</strong>
              <p className="text-gray-600 text-xs">Function: <code>syncManchesterInvoiceToAirtable.js</code></p>
            </div>
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <strong className="block text-xs uppercase text-gray-500 tracking-wide mb-1">Email Configuration</strong>
              <ul className="list-none space-y-1 text-xs font-mono">
                <li><strong>To:</strong> apacileo@echn.org</li>
                <li><strong>CC:</strong> steve.brown@enticmd.com</li>
                <li><strong>Subject:</strong> Manchester [Month] Invoices</li>
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* 3. Scheduled Jobs (Cron) */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Clock className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">3. Scheduled Jobs (Cron)</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">The system runs automated tasks in the background. These are configured in the platform settings but the logic resides in the functions.</p>
          
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-2 font-bold">Function Name</th>
                <th className="p-2 font-bold">Schedule</th>
                <th className="p-2 font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="p-2 font-mono">checkLicenseExpirations</td>
                <td className="p-2">Daily (Morning)</td>
                <td className="p-2">
                  Checks <code>License</code> entities.<br/>
                  If expiration is exactly <strong>30, 14, or 7 days</strong> away:<br/>
                  1. Sends email to Provider.<br/>
                  2. CCs <code>steve.brown@enticmd.com</code>.
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-2 font-mono">syncInvoiceBalances</td>
                <td className="p-2">Hourly</td>
                <td className="p-2">
                  Recalculates <code>amount_received</code> for all invoices based on payments.<br/>
                  Auto-marks invoices as "Paid" if balance is $0.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Backend Maintenance Tools */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Wrench className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">4. Manual Maintenance Tools</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">These tools (buttons in the UI) trigger specific backend cleaning functions.</p>
          
          <div className="space-y-3">
            <div className="border-l-2 border-gray-300 pl-3">
              <strong className="text-sm">"Fix & Sync Data" (Invoices Page)</strong>
              <p className="text-xs text-gray-600 mt-1">Calls <code>syncPaymentsAndInvoices</code>. It forces a recalculation of all financial totals in the database. Use this if the numbers on the dashboard don't match the sum of payments.</p>
            </div>
            <div className="border-l-2 border-gray-300 pl-3">
              <strong className="text-sm">"Fix Amounts" (Outside Income Page)</strong>
              <p className="text-xs text-gray-600 mt-1">Calls <code>fixOutsideIncomeAmounts</code>. Useful if you changed a provider's daily rate (in Program Locations) and want to retroactively apply that new rate to all their past "Pending" shifts.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Troubleshooting & Internals */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Settings className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">5. Troubleshooting Internals</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          
          <h4 className="font-bold text-black mt-2 mb-1">Problem: Emails not arriving (UConn/ECHN)</h4>
          <ul className="list-disc pl-6 space-y-1 text-xs">
            <li><strong>Check 1:</strong> Is the Airtable API Key valid? The backend logs will show <code>AIRTABLE_API_KEY not configured</code> or 401 errors if it expired.</li>
            <li><strong>Check 2:</strong> Did the PDF generate? If the Invoice record has no <code>approved_invoice_url</code>, the sync function will fail because it cannot attach the file.</li>
            <li><strong>Check 3:</strong> Airtable Automation. Even if the app successfully sends data to Airtable, the <em>Airtable Automation</em> itself might have failed. Check the "Run History" in Airtable base <code>app6seexOdkDrMl2U</code>.</li>
          </ul>

          <h4 className="font-bold text-black mt-4 mb-1">Problem: License Reminder Emails not sending</h4>
          <ul className="list-disc pl-6 space-y-1 text-xs">
            <li>These are sent directly via the backend (SendGrid/Postmark integration), NOT Airtable.</li>
            <li>Check the <code>checkLicenseExpirations</code> function logs.</li>
            <li>Verify the Provider's email address is correct in the Provider entity.</li>
          </ul>

        </div>
      </section>

    </div>
  );
}