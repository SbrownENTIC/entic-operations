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
  AlertTriangle,
  FileText,
  Bell,
  FileDown, 
  CloudUpload
} from "lucide-react";

export default function PrintableAdminManual() {
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
          @page { margin: 15mm; size: auto; }
          
          body { 
            margin: 0; 
            padding: 0 !important;
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
            background-color: white;
          }
          
          .print-container { 
            max-width: 100% !important; 
            width: 100% !important; 
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            position: relative;
            z-index: 10;
          }

          .page-frame {
            position: fixed;
            top: 0; 
            left: 0; 
            right: 0; 
            bottom: 0;
            border: 4px double #94a3b8;
            pointer-events: none;
            z-index: 50;
          }

          .content-wrapper {
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
            position: relative;
            z-index: 10;
          }

          .page-break { page-break-after: always; break-after: page; }
          
          .break-inside-avoid { 
            page-break-inside: avoid; 
            break-inside: avoid;
            display: block; 
          }
          
          .no-print { display: none !important; }
          a { text-decoration: none !important; color: black !important; }
          
          .page-footer { display: none; }
        }
        
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

      {/* Repeating Elements */}
      <div className="page-frame"></div>
      <div className="page-footer"></div>

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
            
            <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-wider uppercase">Operations Center</h1>
            <div className="h-0.5 w-24 bg-slate-900 mx-auto my-8"></div>
            <h2 className="text-xl text-red-800 uppercase tracking-[0.2em] mb-4">System Administrator Manual</h2>
            <p className="text-sm text-slate-500 uppercase tracking-widest mb-16">Confidential • Technical Documentation</p>
            
            <div className="w-full max-w-3xl mx-auto mt-8">
              <div className="grid grid-cols-2 gap-x-16 gap-y-2 text-left text-xs font-medium text-slate-600">
                {[
                  "System Architecture & Entities", "Backend Functions Registry", "Integration Deep Dive (Airtable)", 
                  "Workflow: UConn Invoices", "Workflow: Manchester Invoices", "Workflow: Hartford & St. Francis", 
                  "Workflow: Reminders & Closures", "Automated Scheduled Tasks", "Maintenance & Troubleshooting", 
                  "Document Management Internals"
                  ].map((item, idx) => (
                  <div key={idx} className="flex items-baseline gap-3 border-b border-slate-100 py-1">
                    <span className="text-slate-400 font-mono text-xs w-6 text-right">{idx + 1}.</span>
                    <span className="uppercase tracking-wide">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="space-y-8 mt-8">

          {/* 1. Architecture */}
          <PrintSection title="1. System Architecture & Entities" icon={Server}>
            <p className="mb-4">The system runs on the <strong>Base44</strong> platform. Data is stored in a relational database (Postgres) accessed via the Base44 Entity SDK.</p>
            
            <Step title="Core Data Entities">
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
                  <tr><td className="p-2 font-mono">VendorInvoice</td><td className="p-2">Invoices uploaded via Document Management. Stores AI-extracted JSON data.</td></tr>
                </tbody>
              </table>
            </Step>
          </PrintSection>

          {/* 2. Backend Functions */}
          <PrintSection title="2. Backend Functions Registry" icon={FileCode}>
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
                <tr><td className="p-2 font-mono">sendScheduledReminders</td><td className="p-2">Daily Schedule. Finds today's Reminders &#8594; Calls <code>syncReminderToAirtable</code>.</td></tr>
                <tr><td className="p-2 font-mono">syncOfficeClosuresToAirtable</td><td className="p-2">Syncs Holiday reminders to Airtable 'Office Closures' table.</td></tr>
                <tr><td className="p-2 font-mono">checkLicenseExpirations</td><td className="p-2">Daily Schedule. Direct email send (via Base44) for expiring licenses.</td></tr>
                <tr><td className="p-2 font-mono">syncPaymentsAndInvoices</td><td className="p-2">Hourly Schedule. Recalculates invoice balances from payments.</td></tr>
                <tr><td className="p-2 font-mono">fixOutsideIncomeAmounts</td><td className="p-2">Utility. Recalculates <code>Days * Rate = Total</code> for income records.</td></tr>
                <tr><td className="p-2 font-mono">splitAndProcessInvoices</td><td className="p-2">Document Mgmt. Splits PDF and uses LLM to extract data + create entities.</td></tr>
                <tr><td className="p-2 font-mono">suggestSupplyOrderMatches</td><td className="p-2">Document Mgmt. Fuzzy matching to find Supply Orders for an invoice.</td></tr>
              </tbody>
            </table>
          </PrintSection>

          {/* 3. Integration Deep Dive */}
          <PrintSection title="3. Integration Deep Dive (Airtable)" icon={Cloud}>
            <p className="mb-3">Airtable is used as the <strong>Email Orchestration Engine</strong> for most notifications (except Licenses). We push data <em>to</em> Airtable, and Airtable Automations send the actual emails.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="border p-3 rounded bg-slate-50">
                <h4 className="font-bold text-slate-900 mb-2">Table: Notifications</h4>
                <p className="text-xs mb-2">Used for: <strong>Invoices & General Reminders</strong></p>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  <li><strong>Synced Fields:</strong> Recipient, Subject, Body, Attachment URL.</li>
                  <li><strong>Automation:</strong> "When record created" &#8594; Send Email (Gmail/Outlook integration).</li>
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
          </PrintSection>

          {/* 4. Workflow: UConn Invoices */}
          <PrintSection title="4. Workflow: UConn Invoices" icon={FileText}>
            <Step title="Process Flow">
              <ol className="list-decimal pl-5 space-y-3">
                <li>
                  <strong>Creation:</strong> User creates invoice. System auto-assigns next Invoice # (e.g., 41) from <code>ProgramLocation</code> counter.
                </li>
                <li>
                  <strong>PDF Gen:</strong> <code>generateUConnPDF</code> runs. It pulls the template, fills fields, and saves the PDF to the Storage bucket. Returns a public URL.
                </li>
                <li>
                  <strong>Sync Trigger:</strong> Admin clicks <CloudUpload className="w-3 h-3 inline text-indigo-600"/> <strong>Sync to Vendor</strong> (Badge: <strong>UC</strong>). Frontend calls <code>syncUConnInvoiceToAirtable</code>.
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
                  <strong>Delivery:</strong> Airtable Automation sees new record &#8594; Sends Email to ensure workflow automation.
                </li>
              </ol>
            </Step>
          </PrintSection>

          {/* 5. Workflow: Manchester Invoices */}
          <PrintSection title="5. Workflow: Manchester Invoices" icon={FileText}>
            <p className="mb-2">Identical flow to UConn, but uses <code>generateManchesterPDF</code> and different recipients.</p>
            <ul className="list-disc pl-6 text-xs font-mono text-slate-600">
              <li>To: apacileo@echn.org</li>
              <li>CC: steve.brown@enticmd.com</li>
              <li>Subject: "Manchester [Month] Invoices"</li>
            </ul>
            <p className="text-xs mt-2 text-slate-500"><em>Trigger via Sync Button with <strong>M</strong> badge.</em></p>
          </PrintSection>

          {/* 6. Workflow: Hartford & St. Francis */}
          <PrintSection title="6. Workflow: Hartford & St. Francis" icon={FileText}>
            <Step title="Hartford Hospital (Directorships)">
              <p className="text-xs"><strong>Trigger:</strong> Creating an Invoice with <code>Program Group = 'Hartford Hospital'</code>.</p>
              <p className="text-xs"><strong>Logic:</strong> The system checks for an active <em>Directorship</em> income record for that provider/month.</p>
              <ul className="list-disc pl-4 text-xs font-mono text-slate-600 mt-1">
                <li>If found: Automatically creates a SECOND invoice for the flat Directorship fee (e.g., $3,250).</li>
                <li>Naming: Appends "(Directorship)" to the invoice number.</li>
              </ul>
            </Step>

            <Step title="St. Francis">
              <p className="text-xs"><strong>Income Source:</strong> Driven by the On-Call Schedule.</p>
              <p className="text-xs"><strong>Logic:</strong> When a schedule is published for St. Francis locations, the system calls <code>sync2026StFrancis</code> (or similar logic) to generate Pending Income records calculated as <code>Days * Rate</code>.</p>
              <p className="text-xs mt-1"><strong>Invoice:</strong> Standard manual creation. Select St. Francis &#8594; Link Income &#8594; Save.</p>
            </Step>
          </PrintSection>

          {/* 7. Workflow: Reminders & Closures */}
          <PrintSection title="7. Workflow: Reminders & Closures" icon={Bell}>
            <Step title="Scenario A: Daily Email Alerts">
              <p className="text-xs"><strong>Scheduled Task:</strong> <code>sendScheduledReminders</code> runs daily.</p>
              <p className="text-xs">1. Finds active Reminders where <code>send_date == Today</code>.</p>
              <p className="text-xs">2. For each recipient, calls <code>syncReminderToAirtable</code>.</p>
              <p className="text-xs">3. Creates record in Airtable <strong>Notifications</strong> table &#8594; Airtable sends email.</p>
            </Step>

            <Step title="Scenario B: Office Closure Sync">
              <p className="text-xs"><strong>Manual Trigger:</strong> "Sync Reminders to Airtable" button.</p>
              <p className="text-xs"><strong>Function:</strong> <code>syncOfficeClosuresToAirtable</code>.</p>
              <p className="text-xs">1. Reads all reminders.</p>
              <p className="text-xs">2. If type is 'Holiday'/'Office Closure' -> Syncs to <strong>Office Closures (New)</strong> table.</p>
              <p className="text-xs">3. If type is 'Custom' -> Syncs to <strong>Reminders</strong> table.</p>
            </Step>
          </PrintSection>

          {/* 8. Automated Scheduled Tasks */}
          <PrintSection title="8. Automated Scheduled Tasks" icon={Clock}>
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
          </PrintSection>

          {/* 9. Maintenance */}
          <PrintSection title="9. Maintenance & Troubleshooting" icon={AlertTriangle}>
            <InfoBox>
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
            </InfoBox>

            <div className="space-y-4 mt-4">
              <div className="border-l-4 border-blue-500 pl-4 py-1 bg-slate-50">
                <h4 className="font-bold text-blue-900 mb-1">Financial Data Mismatch?</h4>
                <p className="text-xs mb-1">Use the <strong>"Fix & Sync Data"</strong> button on the Invoices page.</p>
                <p className="text-xs text-slate-600">This triggers <code>syncPaymentsAndInvoices</code> manually to force-recalculate all balances.</p>
              </div>

              <div className="border-l-4 border-slate-500 pl-4 py-1 bg-slate-50">
                <h4 className="font-bold text-slate-900 mb-1">Force Redact Henry</h4>
                <p className="text-xs mb-1">Use the <strong>"Force Redact Henry"</strong> button.</p>
                <p className="text-xs text-slate-600">Specifically targets Henry Schein invoices to redact the bottom 35% (footer) where sensitive distribution info is located.</p>
              </div>

              <div className="border-l-4 border-emerald-500 pl-4 py-1 bg-slate-50">
                <h4 className="font-bold text-emerald-900 mb-1">Sync Henry Schein</h4>
                <p className="text-xs mb-1">Use the <strong>"Sync Henry Schein"</strong> button.</p>
                <p className="text-xs text-slate-600">Scans for unlinked Henry Schein invoices and automatically creates/links Clinical Supply Orders for them.</p>
              </div>
            </div>
          </PrintSection>

          {/* 10. Doc Mgmt Internals */}
          <PrintSection title="10. Document Management Internals" icon={FileText}>
            <Step title="PDF Processing Pipeline">
              <p className="text-xs">The <code>splitAndProcessInvoices</code> function handles the heavy lifting:</p>
              <ol className="list-decimal pl-4 text-xs space-y-1">
                <li><strong>Download:</strong> Fetches the PDF from the provided URL.</li>
                <li><strong>Analysis:</strong> Sends first/last pages to LLM to determine where one invoice ends and the next begins.</li>
                <li><strong>Splitting:</strong> Uses <code>pdf-lib</code> to slice the PDF into separate files.</li>
                <li><strong>Extraction:</strong> LLM extracts JSON data (Vendor, Date, Total, Line Items).</li>
                <li><strong>Creation:</strong> Creates <code>VendorInvoice</code> records and uploads the new split PDFs.</li>
              </ol>
            </Step>
            
            <Step title="Allocation Logic">
              <p className="text-xs">When allocating items from Invoice A (Total: $1000) to Location B:</p>
              <ul className="list-disc pl-4 text-xs space-y-1">
                <li><strong>New Invoice:</strong> Created for Location B (Amount: $200).</li>
                <li><strong>New Order:</strong> Created for Location B (linked to New Invoice).</li>
                <li><strong>Update Original:</strong> Invoice A is updated (Amount: $800). Extracted items are removed from JSON to prevent double-counting.</li>
              </ul>
            </Step>
          </PrintSection>

          <div className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm font-medium break-inside-avoid">
            <p>Version 2.0 • Last Updated {currentDate}</p>
            <p className="mt-1 text-xs">ENTIC Operations Team</p>
          </div>

        </div>
      </div>
      </div>
    </div>
  );
}

function PrintSection({ title, icon: Icon, children }) {
  return (
    <div className="mb-10 break-inside-avoid">
      <div className="flex items-center gap-3 mb-6 border-b-2 border-slate-800 pb-2">
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