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
  FileText
} from "lucide-react";

export default function PrintableAdminManual() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10 text-black">
      <div className="text-center mb-10 border-b pb-6">
        <h1 className="text-3xl font-bold mb-2">ENTIC Operations Center</h1>
        <h2 className="text-xl text-gray-600">System Administrator Manual</h2>
        <p className="text-sm text-gray-500 mt-2">Confidential - Internal Use Only</p>
        <p className="text-xs text-gray-400">Last Updated: December 2025</p>
      </div>

      {/* 1. System Architecture */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Server className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">1. System Architecture</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">The Operations Center runs on a serverless, cloud-native stack. Understanding the components helps in troubleshooting.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Platform:</strong> Base44 (Backend-as-a-Service). This manages the PostgreSQL database, user authentication, and file storage.</li>
            <li><strong>Backend Logic (Functions):</strong> Custom scripts written in Deno/Node.js that run in the cloud. These handle the "heavy lifting" like PDF generation, email logic, and nightly data syncs.</li>
            <li><strong>Frontend:</strong> A React.js Single Page Application (SPA) styled with Tailwind CSS.</li>
            <li><strong>External Services:</strong> 
              <ul className="list-circle pl-4 mt-1">
                <li><strong>Airtable:</strong> Used as an email relay and external database for office closures.</li>
                <li><strong>Supabase Storage:</strong> Stores generated PDF invoices and uploaded documents.</li>
              </ul>
            </li>
          </ul>
        </div>
      </section>

      {/* 2. Email Workflows (The "Hidden" Logic) */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Mail className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">2. Email Workflows</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-4">The system sends emails in two completely different ways depending on the context. It is crucial to know which method is used for troubleshooting.</p>

          <div className="mb-6 border-l-4 border-blue-500 pl-4 py-1">
            <h4 className="font-bold text-black text-lg">Method A: The "UConn & Reminders" Flow (via Airtable)</h4>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-semibold">Used for: UConn Invoices, Manchester Invoices, Holiday Reminders, Office Closures</p>
            <p>These emails are <strong>NOT</strong> sent directly by the app. Instead, the app acts as a "remote control" for Airtable.</p>
            <ol className="list-decimal pl-6 space-y-2 mt-2">
              <li><strong>User Action:</strong> You click "Sync to Airtable" (for invoices) or the daily scheduler runs (for holidays).</li>
              <li><strong>App Function:</strong> The app calls <code>syncUConnInvoiceToAirtable</code> or <code>syncReminderToAirtable</code>.</li>
              <li><strong>Airtable Record:</strong> The app creates a new record in the <strong>"Notifications"</strong> table in Airtable. It fills in the <em>Recipient</em>, <em>Subject</em>, <em>Body</em>, and <em>Attachments</em> (PDF links).</li>
              <li><strong>Automation:</strong> An Airtable Automation detects the new record and sends the actual email via Gmail/SendGrid.</li>
            </ol>
            <p className="mt-2 bg-gray-100 p-2 rounded text-xs"><strong>Troubleshooting:</strong> If a UConn email didn't arrive, check the "Notifications" table in Airtable first. If the record is there, the app worked, and the issue is with the Airtable Automation.</p>
          </div>

          <div className="border-l-4 border-green-500 pl-4 py-1">
            <h4 className="font-bold text-black text-lg">Method B: The "Direct Send" Flow</h4>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-semibold">Used for: License Expiration Alerts</p>
            <p>These emails are sent <strong>directly</strong> by the application using its internal mailer.</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Trigger:</strong> The <code>checkLicenseExpirations</code> job runs every morning.</li>
              <li><strong>Logic:</strong> It checks if a license expires in exactly 30, 14, or 7 days.</li>
              <li><strong>Action:</strong> It sends an email directly to the provider and CCs <code>steve.brown@enticmd.com</code>.</li>
              <li><strong>No Airtable:</strong> These do not appear in Airtable.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. Automated Jobs (Cron) */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Clock className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">3. Automated Backend Jobs</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Job Name</th>
                <th className="border p-2 text-left">Frequency</th>
                <th className="border p-2 text-left">What It Does</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2 font-mono text-xs">checkLicenseExpirations</td>
                <td className="border p-2">Daily</td>
                <td className="border p-2">Scans all active licenses. Sends warning emails at 90/60/30/14/7 day intervals.</td>
              </tr>
              <tr>
                <td className="border p-2 font-mono text-xs">sendScheduledReminders</td>
                <td className="border p-2">Daily</td>
                <td className="border p-2">Checks the <strong>Reminders</strong> module for any items scheduled for "Today". Pushes them to Airtable to be emailed.</td>
              </tr>
              <tr>
                <td className="border p-2 font-mono text-xs">syncPaymentsAndInvoices</td>
                <td className="border p-2">Daily / On-Demand</td>
                <td className="border p-2">Recalculates <code>amount_received</code> for every invoice based on Payment Allocations. Auto-updates status to "Paid to ENTIC" if fully paid.</td>
              </tr>
              <tr>
                <td className="border p-2 font-mono text-xs">checkProviderTerminations</td>
                <td className="border p-2">Daily</td>
                <td className="border p-2">Checks if today is past a provider's <code>termination_date</code>. If so, flips their status to "Inactive".</td>
              </tr>
              <tr>
                <td className="border p-2 font-mono text-xs">syncOfficeClosuresToAirtable</td>
                <td className="border p-2">Manual / Triggered</td>
                <td className="border p-2">Syncs "Holiday" reminders from the app to the "Office Closures (New)" table in Airtable, which feeds the phone system/answering service logic.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. PDF Generation Internals */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><FileText className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">4. PDF Generation Logic</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">The system does not create PDFs from scratch. It uses <strong>Fillable PDF Templates</strong>.</p>
          
          <h4 className="font-bold text-black mt-3 mb-1">How It Works (UConn Example):</h4>
          <ol className="list-decimal pl-6 space-y-1">
            <li><strong>Fetch Template:</strong> The system downloads the blank <code>MasterUConnServiceInvoice.pdf</code> from cloud storage.</li>
            <li><strong>Data Mapping:</strong> It reads the Invoice data and the linked Outside Income rows.</li>
            <li><strong>Filling Fields:</strong> It maps data to specific form fields in the PDF (e.g., <code>InvoiceNumber</code>, <code>Row1_Qty</code>, <code>Row1_Desc</code>).</li>
            <li><strong>Flattening:</strong> It "flattens" the PDF so it is no longer editable.</li>
            <li><strong>Saving:</strong> The new file is uploaded to storage, and the link is saved to the invoice.</li>
          </ol>
          
          <p className="mt-2 text-xs bg-yellow-50 p-2 rounded border border-yellow-100">
            <strong>Warning:</strong> If the UConn template changes, the backend code (<code>functions/generateUConnPDF.js</code>) must be updated to match the new field names in the PDF form.
          </p>
        </div>
      </section>

      {/* 5. Maintenance Tools */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Wrench className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">5. Maintenance Tools</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">Use these tools (found on Invoices/Income pages) when data feels "out of sync".</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="border p-3 rounded bg-gray-50">
              <h4 className="font-bold text-black text-sm">Fix & Sync Data</h4>
              <p className="text-xs mt-1">Forces a recalculation of all invoice balances. Use if an invoice shows "Partial" but you know it's fully paid.</p>
            </div>
            <div className="border p-3 rounded bg-gray-50">
              <h4 className="font-bold text-black text-sm">Fix Amounts</h4>
              <p className="text-xs mt-1">Recalculates <code>Days * Rate</code> for income records. Use if you changed a provider's daily rate and need to update old records.</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}