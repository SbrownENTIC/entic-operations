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
  FileCode,
  Cloud,
  AlertTriangle
} from "lucide-react";

export default function PrintableAdminManual() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12 text-black font-sans">
      <div className="text-center mb-12 border-b pb-8">
        <h1 className="text-4xl font-bold mb-3 text-red-900">ENTIC Operations Center</h1>
        <h2 className="text-2xl text-slate-700">System Administrator Manual</h2>
        <p className="text-sm text-slate-500 mt-4">Confidential - Technical Documentation & System Roadmap</p>
      </div>

      <div className="break-after-page">
        <h3 className="text-xl font-bold mb-4">Table of Contents</h3>
        <ul className="grid grid-cols-2 gap-2 text-sm text-slate-700">
          <li>1. System Architecture & Entities</li>
          <li>2. Backend Functions Registry</li>
          <li>3. Integration Deep Dive (Airtable)</li>
          <li>4. Workflow: UConn Invoices</li>
          <li>5. Workflow: Manchester Invoices</li>
          <li>6. Workflow: Reminders & Closures</li>
          <li>7. Automated Jobs (Cron)</li>
          <li>8. Maintenance & Troubleshooting</li>
        </ul>
      </div>

      {/* 1. Backend Architecture */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-slate-100 border border-slate-200"><Server className="w-6 h-6 text-slate-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">1. System Architecture & Entities</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed">
          <p className="mb-4">The system runs on the <strong>Base44</strong> platform. Data is stored in a relational database (Postgres) accessed via the Base44 Entity SDK.</p>
          
          <h4 className="font-bold text-slate-900 mb-2">Core Data Entities (Database Schema)</h4>
          <table className="w-full text-left border-collapse text-xs mb-6">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-2 font-bold w-1/4">Entity Name</th>
                <th className="p-2 font-bold">Description & Key Relationships</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr><td className="p-2 font-mono">Provider</td><td className="p-2">Staff profiles. Parent to Licenses, Privileges, and TimeOff.</td></tr>
              <tr><td className="p-2 font-mono">Invoice</td><td className="p-2">Billing record. <strong>Parent</strong> to OutsideIncome. Linked to Payments via Allocations.</td></tr>
              <tr><td className="p-2 font-mono">OutsideIncome</td><td className="p-2">Individual shifts. Linked to an Invoice (Many-to-One).</td></tr>
              <tr><td className="p-2 font-mono">Payment</td><td className="p-2">Incoming funds. contains JSON `allocations` linking to Invoices.</td></tr>
              <tr><td className="p-2 font-mono">SupplyOrder</td><td className="p-2">Parent for ordered items. Contains JSON `items` array.</td></tr>
              <tr><td className="p-2 font-mono">Reminder</td><td className="p-2">Schedule alerts and Office Closures. Synced to Airtable.</td></tr>
              <tr><td className="p-2 font-mono">License</td><td className="p-2">Credential tracking. Fields: `expiration_date`, `reminder_30_sent` flags.</td></tr>
              <tr><td className="p-2 font-mono">ProgramLocation</td><td className="p-2">Facilities. Controls dropdowns and Invoice Auto-Numbering counters.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Backend Functions Registry */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-blue-100 border border-blue-200"><FileCode className="w-6 h-6 text-blue-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">2. Backend Functions Registry</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed">
          <p className="mb-4">All logic resides in serverless functions found in the <code>functions/</code> directory.</p>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-2 font-bold w-1/3">Function Name</th>
                <th className="p-2 font-bold">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr><td className="p-2 font-mono">generateUConnPDF</td><td className="p-2">Fills <code>MasterUConnServiceInvoice.pdf</code> with invoice data. Returns URL.</td></tr>
              <tr><td className="p-2 font-mono">syncUConnInvoiceToAirtable</td><td className="p-2">Sends invoice data + PDF URL to Airtable 'Notifications' table.</td></tr>
              <tr><td className="p-2 font-mono">sendScheduledReminders</td><td className="p-2">Daily Cron. Finds today's Reminders -> Calls <code>syncReminderToAirtable</code>.</td></tr>
              <tr><td className="p-2 font-mono">syncOfficeClosuresToAirtable</td><td className="p-2">Syncs Holiday reminders to Airtable 'Office Closures' table.</td></tr>
              <tr><td className="p-2 font-mono">checkLicenseExpirations</td><td className="p-2">Daily Cron. Direct email send (via Base44) for expiring licenses.</td></tr>
              <tr><td className="p-2 font-mono">syncPaymentsAndInvoices</td><td className="p-2">Hourly Cron. Recalculates invoice balances from payments.</td></tr>
              <tr><td className="p-2 font-mono">fixOutsideIncomeAmounts</td><td className="p-2">Utility. Recalculates <code>Days * Rate = Total</code> for income records.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Integration Deep Dive */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-purple-100 border border-purple-200"><Cloud className="w-6 h-6 text-purple-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">3. Integration Deep Dive (Airtable)</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>Airtable is used as the <strong>Email Orchestration Engine</strong> for most notifications (except Licenses). We push data <em>to</em> Airtable, and Airtable Automations send the actual emails.</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="border p-3 rounded bg-slate-50">
              <h4 className="font-bold text-slate-900 mb-2">Table: Notifications</h4>
              <p className="text-xs mb-2">Used for: <strong>Invoices & General Reminders</strong></p>
              <ul className="list-disc pl-4 text-xs space-y-1">
                <li><strong>Synced Fields:</strong> Recipient, Subject, Body, Attachment URL.</li>
                <li><strong>Automation:</strong> "When record created" -> Send Email (Gmail/Outlook integration).</li>
                <li><strong>Source Functions:</strong> <code>syncUConn...</code>, <code>syncManchester...</code>, <code>syncReminderToAirtable</code>.</li>
              </ul>
            </div>
            <div className="border p-3 rounded bg-slate-50">
              <h4 className="font-bold text-slate-900 mb-2">Table: Office Closures (New)</h4>
              <p className="text-xs mb-2">Used for: <strong>Holidays & Closures</strong></p>
              <ul className="list-disc pl-4 text-xs space-y-1">
                <li><strong>Synced Fields:</strong> Closure Name, Date Closed, Date Re-open, Type.</li>
                <li><strong>Purpose:</strong> Drives the phone system logic and closure email blasts.</li>
                <li><strong>Source Function:</strong> <code>syncOfficeClosuresToAirtable</code>.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Workflow: UConn Invoices */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-100"><FileText className="w-6 h-6 text-blue-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">4. Workflow: UConn Invoices</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed">
          <ol className="list-decimal pl-6 space-y-3">
            <li>
              <strong>Creation:</strong> User creates invoice. System auto-assigns next Invoice # (e.g., 41) from <code>ProgramLocation</code> counter.
            </li>
            <li>
              <strong>PDF Gen:</strong> <code>generateUConnPDF</code> runs. It pulls the template, fills fields, and saves the PDF to the Storage bucket. Returns a public URL.
            </li>
            <li>
              <strong>Sync Trigger:</strong> Admin clicks "Cloud" icon. Frontend calls <code>syncUConnInvoiceToAirtable</code>.
            </li>
            <li>
              <strong>Airtable Push:</strong> Function creates record in <strong>Notifications</strong> table.
              <ul className="list-none pl-4 text-xs font-mono mt-1 text-slate-600">
                <li>To: amoffo@uchc.edu, jserrano@uchc.edu</li>
                <li>Subject: "UConn [Month] Invoices"</li>
                <li>Attachment: [PDF URL]</li>
              </ul>
            </li>
            <li>
              <strong>Delivery:</strong> Airtable Automation sees new record -> Sends Email.
            </li>
          </ol>
        </div>
      </section>

      {/* 5. Workflow: Manchester Invoices */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100"><FileText className="w-6 h-6 text-indigo-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">5. Workflow: Manchester Invoices</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed">
          <p className="mb-2">Identical flow to UConn, but uses <code>generateManchesterPDF</code> and different recipients.</p>
          <ul className="list-disc pl-6 text-xs font-mono text-slate-600">
            <li>To: apacileo@echn.org</li>
            <li>CC: steve.brown@enticmd.com</li>
            <li>Subject: "Manchester [Month] Invoices"</li>
          </ul>
        </div>
      </section>

      {/* 6. Workflow: Reminders & Closures */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-yellow-50 border border-yellow-100"><Bell className="w-6 h-6 text-yellow-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">6. Workflow: Reminders & Closures</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed">
          <div className="mb-4">
            <h4 className="font-bold text-slate-900 mb-1">Scenario A: Daily Email Alerts</h4>
            <p className="text-xs"><strong>Cron Job:</strong> <code>sendScheduledReminders</code> runs daily.</p>
            <p className="text-xs">1. Finds active Reminders where <code>send_date == Today</code>.</p>
            <p className="text-xs">2. For each recipient, calls <code>syncReminderToAirtable</code>.</p>
            <p className="text-xs">3. Creates record in Airtable <strong>Notifications</strong> table -> Airtable sends email.</p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">Scenario B: Office Closure Sync</h4>
            <p className="text-xs"><strong>Manual Trigger:</strong> "Sync Reminders to Airtable" button.</p>
            <p className="text-xs"><strong>Function:</strong> <code>syncOfficeClosuresToAirtable</code>.</p>
            <p className="text-xs">1. Reads all reminders.</p>
            <p className="text-xs">2. If type is 'Holiday'/'Office Closure' -> Syncs to <strong>Office Closures (New)</strong> table.</p>
            <p className="text-xs">3. If type is 'Custom' -> Syncs to <strong>Reminders</strong> table.</p>
          </div>
        </div>
      </section>

      {/* 7. Automated Jobs (Cron) */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-green-50 border border-green-100"><Clock className="w-6 h-6 text-green-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">7. Automated Backend Jobs (Cron)</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-2 font-bold">Function</th>
                <th className="p-2 font-bold">Frequency</th>
                <th className="p-2 font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-2 font-mono">checkLicenseExpirations</td>
                <td className="p-2">Daily</td>
                <td className="p-2">Checks active licenses. Sends <strong>Direct Email</strong> (via Base44, not Airtable) at 90/60/30/14/7 days.</td>
              </tr>
              <tr>
                <td className="p-2 font-mono">sendScheduledReminders</td>
                <td className="p-2">Daily</td>
                <td className="p-2">Processes 'Reminder' entities. Pushes to Airtable Notifications.</td>
              </tr>
              <tr>
                <td className="p-2 font-mono">syncPaymentsAndInvoices</td>
                <td className="p-2">Hourly</td>
                <td className="p-2">Sums payment allocations. Updates Invoice <code>amount_received</code> and <code>status</code>.</td>
              </tr>
              <tr>
                <td className="p-2 font-mono">checkProviderTerminations</td>
                <td className="p-2">Daily</td>
                <td className="p-2">Sets Provider <code>status = inactive</code> if <code>termination_date &lt; Today</code>.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 8. Maintenance & Troubleshooting */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-slate-300">
          <div className="p-2 rounded-lg bg-red-50 border border-red-100"><AlertTriangle className="w-6 h-6 text-red-700" /></div>
          <h3 className="text-2xl font-bold text-slate-900">8. Maintenance & Troubleshooting</h3>
        </div>
        <div className="text-sm text-slate-800 leading-relaxed space-y-4">
          
          <div className="border-l-4 border-red-500 pl-4 py-1 bg-slate-50">
            <h4 className="font-bold text-red-900 mb-1">Emails Not Sending?</h4>
            <ol className="list-decimal pl-4 text-xs space-y-1">
              <li><strong>Check API Key:</strong> Is <code>AIRTABLE_API_KEY</code> set in Secrets?</li>
              <li><strong>Check Record:</strong> Did the function create a record in the Airtable table?
                <ul className="list-disc pl-4 text-slate-600">
                  <li>Yes? -> Issue is in Airtable Automation (Check Run History).</li>
                  <li>No? -> Issue is in Base44 Function (Check Function Logs).</li>
                </ul>
              </li>
            </ol>
          </div>

          <div className="border-l-4 border-blue-500 pl-4 py-1 bg-slate-50">
            <h4 className="font-bold text-blue-900 mb-1">Financial Data Mismatch?</h4>
            <p className="text-xs mb-1">Use the <strong>"Fix & Sync Data"</strong> button on the Invoices page.</p>
            <p className="text-xs text-slate-600">This triggers <code>syncPaymentsAndInvoices</code> manually to force-recalculate all balances.</p>
          </div>

        </div>
      </section>

    </div>
  );
}