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
                <li><strong>Reminder:</strong> Stores scheduled alerts and office closures.</li>
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

      {/* 2. Detailed Billing & Notification Workflows */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><FileCode className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">2. Detailed Billing & Notification Workflows</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          
          <h4 className="font-bold text-black text-lg mt-4 mb-2 border-l-4 border-blue-500 pl-2">UConn Health Invoice Workflow</h4>
          <p className="mb-2">Automated from PDF generation to email dispatch via Airtable.</p>
          
          <div className="ml-4 space-y-3">
            <div>
              <strong className="block text-gray-800">Step 1: PDF Generation</strong>
              <p className="text-gray-600 text-xs">
                Function: <code>generateUConnPDF.js</code><br/>
                Trigger: Automatic on invoice creation/update for UConn program group, or manual from UI.<br/>
                Mechanism: Fetches <code>MasterUConnServiceInvoice.pdf</code> template from Supabase storage and populates its form fields with invoice and linked <em>Outside Income</em> data.<br/>
                Output: An approved PDF URL saved to the Invoice entity (`approved_invoice_url`).
              </p>
            </div>
            <div>
              <strong className="block text-gray-800">Step 2: Email Dispatch Orchestration</strong>
              <p className="text-gray-600 text-xs">
                Function: <code>syncUConnInvoiceToAirtable.js</code><br/>
                Trigger: Admin clicks the "Cloud" icon on the Invoices page.<br/>
                Mechanism: This function prepares an email (recipients, subject, body, PDF attachment) and creates a new record in Airtable's <strong>"Notifications"</strong> table. It does *not* send the email itself.
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <strong className="block text-xs uppercase text-gray-500 tracking-wide mb-1">Email Configuration (Hardcoded in Backend)</strong>
              <ul className="list-none space-y-1 text-xs font-mono">
                <li><strong>To:</strong> amoffo@uchc.edu, jserrano@uchc.edu</li>
                <li><strong>CC:</strong> steve.brown@enticmd.com, heldridge@enticmd.com</li>
                <li><strong>Subject:</strong> UConn [Month] Invoices</li>
                <li><strong>Body:</strong> Dynamic, includes provider list.</li>
              </ul>
            </div>
          </div>

          <h4 className="font-bold text-black text-lg mt-6 mb-2 border-l-4 border-green-500 pl-2">Manchester / ECHN Invoice Workflow</h4>
          <p className="mb-2">Similar to UConn but with specific templates and recipients.</p>
          
          <div className="ml-4 space-y-3">
            <div>
              <strong className="block text-gray-800">Step 1: PDF Generation</strong>
              <p className="text-gray-600 text-xs">Function: <code>generateManchesterPDF.js</code></p>
            </div>
            <div>
              <strong className="block text-gray-800">Step 2: Email Dispatch Orchestration</strong>
              <p className="text-gray-600 text-xs">Function: <code>syncManchesterInvoiceToAirtable.js</code><br/>
              Mechanism: Creates a record in Airtable's <strong>"Notifications"</strong> table.</p>
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

          <h4 className="font-bold text-black text-lg mt-6 mb-2 border-l-4 border-orange-500 pl-2">Office Closure & Automatic Reminder Emails</h4>
          <p className="mb-2">These are also orchestrated through Airtable for flexible automation.</p>
          
          <div className="ml-4 space-y-3">
            <div>
              <strong className="block text-gray-800">Step 1: Daily Reminder Check</strong>
              <p className="text-gray-600 text-xs">
                Function: <code>sendScheduledReminders.js</code><br/>
                Trigger: Daily cron job (configured in platform).<br/>
                Mechanism: Fetches <code>Reminder</code> entities scheduled for today. For each reminder/recipient, it invokes <code>syncReminderToAirtable</code> to trigger the notification.
              </p>
            </div>
            <div>
              <strong className="block text-gray-800">Step 2: Office Closure Sync</strong>
              <p className="text-gray-600 text-xs">
                Function: <code>syncOfficeClosuresToAirtable.js</code><br/>
                Trigger: "Sync Reminders to Airtable" button on Reminders page.<br/>
                Mechanism: Reads all <code>Reminder</code> entities. 
                <ul className="list-disc pl-4 mt-1">
                  <li><strong>Holiday/Office Closure</strong> types are synced to Airtable's <strong>"Office Closures (New)"</strong> table (controls phone system logic).</li>
                  <li><strong>Other</strong> types are synced to the <strong>"Reminders"</strong> table.</li>
                </ul>
                Includes deduplication logic and links to On-Call Periods.
              </p>
            </div>
            <div>
              <strong className="block text-gray-800">Step 3: Generic Reminder Sync to Airtable</strong>
              <p className="text-gray-600 text-xs">
                Function: <code>syncReminderToAirtable.js</code><br/>
                Trigger: Called by <code>sendScheduledReminders.js</code> or other functions needing to create a generic notification in Airtable.<br/>
                Mechanism: Creates a record in Airtable's <strong>"Notifications"</strong> table, populating recipient, subject, body, etc. This is the final step before Airtable's internal automation sends the email.
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <strong className="block text-xs uppercase text-gray-500 tracking-wide mb-1">Airtable Email Dispatch (Common for UConn, Manchester, Reminders)</strong>
              <p className="text-xs text-gray-600">For all workflows where the app pushes to Airtable (UConn, Manchester, and general Reminders), the actual email sending is handled by <strong>Airtable Automations</strong>. These automations watch for new records in specific tables (e.g., "Notifications", "Office Closures (New)", "Reminders") and trigger an email send using Airtable's integrated email service (Gmail/Outlook).</p>
              <p className="text-xs text-gray-600 mt-1"><strong>Troubleshooting:</strong> If emails are not arriving, first check if the record was created correctly in the relevant Airtable table. If so, inspect the Airtable Automation's run history for failures.</p>
            </div>
          </div>

          <h4 className="font-bold text-black text-lg mt-6 mb-2 border-l-4 border-red-500 pl-2">Direct Send: License Expiration Alerts</h4>
          <p className="mb-2">This is the only email type sent directly by the application.</p>
          <div className="ml-4 space-y-3">
            <div>
              <strong className="block text-gray-800">Mechanism:</strong>
              <p className="text-gray-600 text-xs">
                Function: <code>checkLicenseExpirations.js</code><br/>
                Trigger: Daily cron job.<br/>
                Action: Directly invokes Base44's email integration (<code>base44.integrations.Core.SendEmail</code>) to send emails to providers.<br/>
                No Airtable involvement.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 3. Automated Jobs (Cron) */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Clock className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">3. Automated Backend Jobs (Cron)</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">These are functions scheduled to run periodically (e.g., daily). Their schedules are configured in the Base44 platform settings.</p>
          
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-2 font-bold">Function Name</th>
                <th className="p-2 font-bold">Schedule</th>
                <th className="p-2 font-bold">Primary Action</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="p-2 font-mono">checkLicenseExpirations</td>
                <td className="p-2">Daily (Morning)</td>
                <td className="p-2">
                  Scans all active licenses. Sends warning emails directly to providers (and CCs Steve) if expiration is at 30, 14, or 7 days.
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-2 font-mono">sendScheduledReminders</td>
                <td className="p-2">Daily (Morning)</td>
                <td className="p-2">
                  Processes all active <code>Reminder</code> entities scheduled for today. Invokes <code>syncReminderToAirtable</code> for each recipient to create records in Airtable.
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-2 font-mono">syncPaymentsAndInvoices</td>
                <td className="p-2">Hourly</td>
                <td className="p-2">
                  Recalculates <code>amount_received</code> for every invoice based on payment allocations. Auto-updates invoice status to "Paid to ENTIC" or "Partial" as needed.
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="p-2 font-mono">checkProviderTerminations</td>
                <td className="p-2">Daily</td>
                <td className="p-2">Checks providers with a <code>termination_date</code>. If past due, updates their status to "Inactive".</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-xs bg-yellow-50 p-2 rounded border border-yellow-100">
            <strong>Note:</strong> <code>syncOfficeClosuresToAirtable</code> is NOT a scheduled cron job. It is designed for manual or programmatic triggering when Office Closures are created/updated to keep Airtable in sync.
          </p>
        </div>
      </section>

      {/* 4. Backend Maintenance Tools */}
      <section className="space-y-4 break-inside-avoid">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-300">
          <div className="p-2 rounded-lg border border-gray-200"><Wrench className="w-5 h-5 text-black" /></div>
          <h3 className="text-xl font-bold text-black">4. Manual Maintenance Tools (Frontend Triggers)</h3>
        </div>
        <div className="text-sm text-black leading-relaxed">
          <p className="mb-2">These tools are accessible via buttons in the frontend UI and trigger specific backend functions to perform data consistency checks or updates.</p>
          
          <div className="space-y-3">
            <div className="border-l-2 border-gray-300 pl-3">
              <strong className="text-sm">"Fix & Sync Data" (Invoices Page)</strong>
              <p className="text-xs text-gray-600 mt-1">Calls <code>syncPaymentsAndInvoices</code> (the same function used in an hourly cron job). Forces a full recalculation of all invoice balances and updates statuses. Essential if financial data looks inconsistent.</p>
            </div>
            <div className="border-l-2 border-gray-300 pl-3">
              <strong className="text-sm">"Fix Amounts" (Outside Income Page)</strong>
              <p className="text-xs text-gray-600 mt-1">Calls <code>fixOutsideIncomeAmounts</code>. Re-runs the calculation <code>Days Worked × Rate = Total Amount</code> for selected or all income records. Useful after changing a provider's daily rate or if income totals appear incorrect.</p>
            </div>
            <div className="border-l-2 border-gray-300 pl-3">
              <strong className="text-sm">"Sync to Airtable" (Invoices Page for UConn/Manchester)</strong>
              <p className="text-xs text-gray-600 mt-1">For UConn, calls <code>syncUConnInvoiceToAirtable</code>. For Manchester, calls <code>syncManchesterInvoiceToAirtable</code>. Triggers the email orchestration process via Airtable as described in Section 2.</p>
            </div>
            <div className="border-l-2 border-gray-300 pl-3">
              <strong className="text-sm">"Sync Reminders to Airtable" (Reminders Page)</strong>
              <p className="text-xs text-gray-600 mt-1">Calls <code>syncOfficeClosuresToAirtable</code>. This explicitly pushes all current reminders and office closures from the app's database to the relevant Airtable tables. Important for ensuring Airtable's automations have the latest data.</p>
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
          
          <h4 className="font-bold text-black mt-2 mb-1">Problem: UConn/Manchester/Reminder Emails Not Arriving</h4>
          <ul className="list-disc pl-6 space-y-1 text-xs">
            <li><strong>Check 1: Airtable API Key.</strong> Verify <code>AIRTABLE_API_KEY</code> secret is correctly set in Base44 Dashboard. Check function logs for errors like <code>AIRTABLE_API_KEY not configured</code>.</li>
            <li><strong>Check 2: PDF Attachment.</strong> For invoices, ensure the Invoice record has an <code>approved_invoice_url</code>. If the PDF generation failed, the Airtable sync won't have a file to attach.</li>
            <li><strong>Check 3: Airtable Record Creation.</strong> Go to the relevant Airtable base (<code>app6seexOdkDrMl2U</code>). Check the <strong>"Notifications"</strong> table (for invoice emails), <strong>"Office Closures (New)"</strong> table (for holiday reminders), or <strong>"Reminders"</strong> table (for other reminders). Is a new record being created when expected?</li>
            <li><strong>Check 4: Airtable Automation.</strong> If the record exists in Airtable, the issue is likely within Airtable itself. Inspect the "Run History" of the relevant Airtable Automation for failures or misconfigurations.</li>
          </ul>

          <h4 className="font-bold text-black mt-4 mb-1">Problem: License Expiration Emails Not Sending</h4>
          <ul className="list-disc pl-6 space-y-1 text-xs">
            <li>These emails are sent <em>directly</em> by the app, not via Airtable.</li>
            <li><strong>Check 1: Function Logs.</strong> Review the logs for the <code>checkLicenseExpirations</code> function in the Base44 Dashboard for any errors.</li>
            <li><strong>Check 2: Provider Data.</strong> Verify the provider's email address is correct and their status is 'active' in the <code>Provider</code> entity.</li>
            <li><strong>Check 3: License Reminders Sent.</strong> Ensure the <code>reminder_30_sent</code>, <code>reminder_14_sent</code>, or <code>reminder_7_sent</code> flags on the <code>License</code> entity are not already true for the specific interval.</li>
          </ul>

          <h4 className="font-bold text-black mt-4 mb-1">Problem: Scheduled Reminders (Daily Cron) Not Running</h4>
          <ul className="list-disc pl-6 space-y-1 text-xs">
            <li><strong>Check 1: Cron Job Configuration.</strong> Ensure the <code>sendScheduledReminders</code> function is correctly configured as a daily cron job in the Base44 platform settings.</li>
            <li><strong>Check 2: Reminder Status.</strong> Verify the <code>Reminder</code> entity has <code>status: 'active'</code> and <code>send_date</code> matches today's date.</li>
          </ul>

        </div>
      </section>

    </div>
  );
}