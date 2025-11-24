import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Server, Database, Settings, AlertTriangle, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AdminGuide() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin & Manager Guide</h1>
            <p className="text-slate-600 mt-1">System administration, backend functions, and advanced operations</p>
          </div>
        </div>

        {/* Introduction */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Introduction</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              This guide is designed for administrators and managers responsible for the strategic oversight, 
              configuration, and advanced operational management of the ENTIC Operations App. It covers topics 
              beyond day-to-day user tasks, focusing on system health, data integrity, and leveraging advanced features.
            </p>
          </CardContent>
        </Card>

        {/* Reports & Analytics */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              <CardTitle>Understanding Reports & Analytics</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Payment Tracking Report</h4>
            <p>
              This report provides a detailed breakdown of invoices, payments received, and amounts outstanding, 
              categorized by program group.
            </p>
            <ul>
              <li><strong>How to Access:</strong> Navigate to Reports and select Payment Tracking Report</li>
              <li><strong>Filters:</strong> Date Range (start and end date) and Program Group</li>
              <li><strong>Directorship/On-Call Separation:</strong> For Hartford Hospital and St. Francis, the report 
              intelligently separates data into "Directorship Tracking" and "On-Call Tracking" sections</li>
              <li><strong>Key Columns:</strong> Expected Payment, Payment Received, Date/Voucher Number, Date Paid Provider</li>
              <li><strong>Notes Filtering:</strong> The report automatically filters out internal auto-generated notes</li>
              <li><strong>Export:</strong> Click "Export to CSV" to download the report data</li>
            </ul>

            <h4>Other Data Exports</h4>
            <p>
              Most modules (Licenses, Clinical Privileges, Supply Orders, etc.) offer CSV export functionality 
              for generating specific reports.
            </p>
          </CardContent>
        </Card>

        {/* Backend Functions */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              <CardTitle>Backend Functions: Powering Automations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>What are Backend Functions?</h4>
            <p>
              Backend functions are custom server-side programs that extend the app's capabilities. They enable 
              complex automations, data integrity checks, and specialized processing. You typically interact with 
              these functions through specific buttons in the UI or they run on a scheduled basis.
            </p>

            <h4>Data Synchronization Functions</h4>
            <p>These functions ensure consistency and accuracy across related data entities:</p>
            <ul>
              <li><strong>syncInvoiceMonths:</strong> Ensures invoice month fields are correctly populated</li>
              <li><strong>syncPaymentsAndInvoices:</strong> Reconciles payment allocations with invoice statuses and amounts</li>
              <li><strong>syncInvoiceBalances:</strong> Recalculates and updates invoice balances based on payments</li>
              <li><strong>fixPaymentAllocations:</strong> Corrects discrepancies in payment allocations</li>
              <li><strong>updatePaymentMonths:</strong> Ensures payment months are accurately recorded</li>
              <li><strong>fixSpecificPayment:</strong> Addresses issues with individual payment records</li>
              <li><strong>diagnoseInvoiceData:</strong> Identifies and reports on inconsistencies within invoice data</li>
              <li><strong>forceSyncIncomeLinks:</strong> Re-establishes links between outside income and invoices</li>
            </ul>

            <h4>Automated Action Functions</h4>
            <p>These functions perform scheduled or triggered actions:</p>
            <ul>
              <li><strong>checkLicenseExpirations:</strong> Runs periodically to identify expiring licenses and trigger 
              reminders (30, 14, 7-day notifications)</li>
              <li><strong>checkProviderTerminations:</strong> Automatically updates provider status to 'inactive' when 
              termination date passes</li>
              <li><strong>sendScheduledReminders:</strong> Sends automated email reminders based on configured schedules</li>
              <li><strong>updateOnCallProviders:</strong> Updates provider information related to on-call schedules</li>
              <li><strong>updateInvoiceProviders:</strong> Ensures provider details are current on invoices</li>
              <li><strong>processSupplyRequest:</strong> Handles logic for new supply requests</li>
              <li><strong>fillSupplyOrderItemNumbers:</strong> Automatically populates item numbers for supply orders</li>
            </ul>

            <h4>Data Linking & Smart Generation Functions</h4>
            <ul>
              <li><strong>linkOutsideIncomeToOnCall:</strong> Automatically links outside income records to 
              corresponding on-call schedule entries</li>
              <li><strong>linkStFrancisProviders:</strong> Links St. Francis providers to relevant data</li>
              <li><strong>linkUConnProviders:</strong> Links UConn providers to relevant data</li>
              <li><strong>fixHartfordDirectorshipInvoices:</strong> A critical function (accessible via the Invoices page 
              "Fix Hartford Data" button) that identifies missing Hartford Hospital Directorship invoices and creates them, 
              linking them to existing outside income and reallocating payments as necessary</li>
              <li><strong>fixOutsideIncomeLinks:</strong> Corrects broken links between outside income and other entities</li>
              <li><strong>fixOutsideIncomeAmounts:</strong> Corrects total amounts for outside income records</li>
            </ul>

            <h4>Supply Management Functions</h4>
            <ul>
              <li><strong>bulkUpdateSupplies:</strong> Allows for mass updates to supply catalog items</li>
              <li><strong>importSuppliesWithImages:</strong> Facilitates importing supply data in bulk</li>
            </ul>

            <h4>Monitoring Backend Functions</h4>
            <p>
              For detailed information on specific backend functions, including their input/output and execution logs, 
              refer to your Base44 dashboard under <strong>Code → Functions</strong>.
            </p>
          </CardContent>
        </Card>

        {/* System Configuration */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              <CardTitle>System Configuration & Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>User Management</h4>
            <p>
              The Base44 platform handles user authentication and authorization. To manage app users, assign roles, 
              or adjust access levels, use the Base44 dashboard. The app differentiates between 'admin' and 'user' roles.
            </p>

            <h4>Entity Management</h4>
            <p>
              Understanding the structure of your data is key. Key entities include:
            </p>
            <ul>
              <li><strong>Provider:</strong> Provider profiles with contact info, status, roles, and notes</li>
              <li><strong>Invoice:</strong> Invoice records with status, amounts, and linked outside income</li>
              <li><strong>OutsideIncome:</strong> External work records with dates, RVUs, and amounts</li>
              <li><strong>Payment:</strong> Payment records with allocations to invoices</li>
              <li><strong>License:</strong> Provider licenses with expiration tracking</li>
              <li><strong>ClinicalPrivilege:</strong> Facility privileges with expiration dates</li>
              <li><strong>CME:</strong> Continuing education records</li>
              <li><strong>SupplyOrder:</strong> Supply order records with items and status</li>
              <li><strong>OnCallSchedule:</strong> On-call shift assignments</li>
              <li><strong>ProviderTimeOff:</strong> Time off and CME day records</li>
              <li><strong>ProgramLocation:</strong> Program/location definitions with rates</li>
              <li><strong>Reminder:</strong> Automated reminder configurations</li>
            </ul>

            <h4>Environment Variables & Secrets</h4>
            <p>
              Critical configuration values, such as API keys for external services, are stored as secure 
              environment variables (secrets). Current secrets configured:
            </p>
            <ul>
              <li><strong>MAILGUN_API_KEY:</strong> API key for sending emails via Mailgun</li>
              <li><strong>MAILGUN_DOMAIN:</strong> Domain configured in Mailgun</li>
              <li><strong>MAILGUN_FROM_EMAIL:</strong> Sender email address for automated emails</li>
            </ul>
            <p>
              These secrets are managed within your Base44 project settings in the dashboard. If an external 
              service integration (like email reminders) is not working, verify that the corresponding secrets 
              are correctly set.
            </p>
          </CardContent>
        </Card>

        {/* Automations Deep Dive */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <CardTitle>Key Automations & Smart Features</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Outside Income Auto-Calculations</h4>
            <ul>
              <li>Automatically calculates days worked and total amount for non-RVU programs</li>
              <li>Links ProgramLocation details (daily rate) directly to outside income entries</li>
              <li>When creating HH Skull Base income, automatically creates corresponding Hartford Hospital Directorship income</li>
            </ul>

            <h4>Invoice Smart Generation</h4>
            <ul>
              <li>Creates invoices directly from selected outside income records</li>
              <li>For Hartford Hospital RVU invoices, automatically generates an associated Directorship invoice</li>
              <li>Automatic status updates based on payment allocations (unless manual override is enabled)</li>
            </ul>

            <h4>Payment Reconciliation</h4>
            <ul>
              <li>When payments are allocated, invoice amount_received is automatically updated</li>
              <li>Invoice statuses update to reflect payment status</li>
              <li>Unallocated amounts are tracked automatically</li>
            </ul>

            <h4>Compliance Monitoring</h4>
            <ul>
              <li>Automated license and privilege expiration checks with reminder emails</li>
              <li>Provider termination dates automatically update status to inactive</li>
              <li>Flu vaccine year automatically calculated from vaccine date</li>
            </ul>

            <h4>Supply Order Notifications</h4>
            <ul>
              <li>Real-time bell icon notifications for pending orders</li>
              <li>Distinctive doorbell sound when new orders await review</li>
            </ul>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
              <CardTitle>Troubleshooting & Common Issues</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>A reminder wasn't sent</h4>
            <ul>
              <li>Check the Reminders page: Is the reminder status active? Is the next_send_date correct?</li>
              <li>Verify Mailgun secrets in the Base44 dashboard</li>
              <li>Check backend function logs for sendScheduledReminders for any errors</li>
            </ul>

            <h4>An invoice status isn't updating automatically</h4>
            <ul>
              <li>Check if "Manual Status Override" (🔒 icon) is enabled for that invoice</li>
              <li>Click the lock icon to disable it and allow automatic updates</li>
              <li>Check backend function logs for syncPaymentsAndInvoices</li>
            </ul>

            <h4>Data looks inconsistent</h4>
            <ul>
              <li>Use data remediation functions: fixHartfordDirectorshipInvoices, fixOutsideIncomeAmounts, 
              fixPaymentAllocations</li>
              <li>Run diagnostic functions like diagnoseInvoiceData</li>
              <li>Use search and filter features to identify specific issues</li>
            </ul>

            <h4>Hartford Directorship invoices missing</h4>
            <ul>
              <li>Go to the Invoices page and click the "Fix Hartford Data" button</li>
              <li>This will scan for missing Directorship invoices and create them</li>
            </ul>
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <CardTitle>Best Practices for Data Integrity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <ul>
              <li><strong>Regular Data Review:</strong> Periodically review key reports (Payment Tracking Report, 
              License Expiration Summary) to catch anomalies early</li>
              <li><strong>Understand Automation Flow:</strong> Be aware of how data changes in one module can 
              automatically update statuses in another</li>
              <li><strong>Judicious Use of Overrides:</strong> Use Manual Status Override on invoices sparingly, 
              understanding it prevents beneficial automations</li>
              <li><strong>Complete Information:</strong> Encourage users to fill out all relevant fields accurately 
              to ensure automations and reports function optimally</li>
              <li><strong>Monitor Function Logs:</strong> Regularly check backend function logs for errors or 
              unexpected behavior</li>
            </ul>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Getting Help</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              For issues that cannot be resolved using the information above, or for questions regarding the 
              platform itself, consult the Base44 platform documentation or contact Base44 support. For app-specific 
              logic or feature requests, contact your internal development team.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}