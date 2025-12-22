import React from "react";
import { 
  Users, Calendar, DollarSign, FileText, CreditCard, 
  Package, ShoppingCart, Clock, Bell, Shield, 
  BarChart3, FolderOpen, Award, GraduationCap, 
  BookOpen, Settings, AlertCircle
} from "lucide-react";

export default function PrintableSOPs() {
  return (
    <div className="p-8 max-w-[21cm] mx-auto bg-white text-slate-900">
      <div className="mb-8 border-b pb-4 text-center">
        <h1 className="text-3xl font-bold text-slate-900">Standard Operating Procedures</h1>
        <p className="text-slate-600 mt-2">ENTIC Operations Center</p>
        <p className="text-xs text-slate-400 mt-1">Generated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="space-y-10">
        {/* 1. Providers */}
        <PrintSection title="1. Adding New Providers" icon={Users}>
          <p>Adding a new provider is the first step in setting up their profile, payroll, and schedule.</p>
          <div className="pl-4 border-l-2 border-slate-200 my-4">
            <h4 className="font-bold text-sm mb-2">Process:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Navigate to the <strong>Providers</strong> page.</li>
              <li>Click <strong>Add Provider</strong>.</li>
              <li>Enter Personal Info (Name, Email, Phone), Status, and Role.</li>
              <li>Select all <strong>Program Locations</strong> (controls income logging options).</li>
              <li>Enter Start Date.</li>
              <li>Click <strong>Create Provider</strong>.</li>
            </ol>
          </div>
          <div className="text-xs bg-slate-100 p-2 rounded">
            <strong>Note:</strong> To remove a provider, mark status as <strong>Inactive</strong>. Do not delete if they have linked records.
          </div>
        </PrintSection>

        {/* 2. On-Call Schedule */}
        <PrintSection title="2. Using the On-Call Schedule" icon={Calendar}>
          <p>The On-Call Schedule manages coverage and drives automated income generation for certain facilities.</p>
          <div className="pl-4 border-l-2 border-slate-200 my-4">
            <h4 className="font-bold text-sm mb-2">Adding a Shift:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Go to <strong>On-Call Schedule</strong> page.</li>
              <li>Click <strong>Add Schedule</strong>.</li>
              <li>Select Provider, Location, Start Date, and End Date.</li>
              <li>Click <strong>Save</strong>.</li>
            </ol>
          </div>
          <div className="text-xs bg-slate-100 p-2 rounded">
            <strong>Automation:</strong> St. Francis shifts automatically create "Pending" Outside Income records.
          </div>
        </PrintSection>

        {/* 3. Outside Income */}
        <PrintSection title="3. Adding Outside Income" icon={DollarSign}>
          <p>Outside Income records track every shift or service performed that needs to be billed.</p>
          <div className="pl-4 border-l-2 border-slate-200 my-4">
            <h4 className="font-bold text-sm mb-2">Manual Entry:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Go to <strong>Outside Income</strong> page.</li>
              <li>Click <strong>Add Income</strong>.</li>
              <li>Select Provider and Program Location.</li>
              <li>Select Dates worked.</li>
              <li>For Standard: Enter # of Days (Calculates Days × Rate).</li>
              <li>For Hartford RVU: Enter Total RVUs (Calculates RVUs × Rate).</li>
              <li>Click <strong>Save</strong>.</li>
            </ol>
          </div>
        </PrintSection>

        {/* 4. Processing Invoices */}
        <PrintSection title="4. Processing Invoices" icon={FileText}>
          <p>Invoices group income records into a billable document for the facility.</p>
          <div className="pl-4 border-l-2 border-slate-200 my-4">
            <h4 className="font-bold text-sm mb-2">Creating an Invoice:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Go to <strong>Invoices</strong> → <strong>Create Invoice</strong>.</li>
              <li>Select Program Group and Staff Member.</li>
              <li>Check the boxes for the "Pending" income records to include.</li>
              <li>Click <strong>Create Invoice</strong>.</li>
            </ol>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-slate-50 p-3 rounded text-sm">
              <strong className="block mb-1">UConn / Manchester</strong>
              <ul className="list-disc pl-4 text-xs">
                <li>Click <strong>File Down (⬇️)</strong> to generate PDF.</li>
                <li>Select and click <strong>Cloud Icon</strong> to sync/email.</li>
              </ul>
            </div>
            <div className="bg-slate-50 p-3 rounded text-sm">
              <strong className="block mb-1">Hartford Hospital</strong>
              <ul className="list-disc pl-4 text-xs">
                <li>System detects "Directorship" roles.</li>
                <li>Prompts to auto-create separate flat-fee invoice.</li>
              </ul>
            </div>
          </div>
        </PrintSection>

        <div className="page-break" />

        {/* 5. Processing Payments */}
        <PrintSection title="5. Processing Payments" icon={CreditCard}>
          <p>Record payments received and allocate them to close out invoices.</p>
          <div className="pl-4 border-l-2 border-slate-200 my-4">
            <h4 className="font-bold text-sm mb-2">Recording a Payment:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Go to <strong>Payments</strong> → <strong>Add Payment</strong>.</li>
              <li>Enter Amount, Date, Payer, and Reference #.</li>
              <li><strong>Attach Remittance:</strong> Upload check image/PDF.</li>
              <li><strong>Allocation:</strong> Click "Add Allocation", select Invoices, and enter amounts.</li>
              <li>Click <strong>Save</strong>.</li>
            </ol>
          </div>
        </PrintSection>

        {/* 6. Supply Orders */}
        <PrintSection title="6. Supply Orders (Office & Clinical)" icon={Package}>
          <p>Manage requests for office and clinical supplies.</p>
          <div className="pl-4 border-l-2 border-slate-200 my-4">
            <h4 className="font-bold text-sm mb-2">Workflow:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li><strong>Review:</strong> Check "Pending Review" orders on Orders page.</li>
              <li><strong>Action:</strong> Approve (for fulfillment) or Reject.</li>
              <li><strong>Ordering:</strong> Update status to "Order Placed" when bought.</li>
              <li><strong>Receiving:</strong> Mark items as "Received" when delivered.</li>
            </ol>
          </div>
        </PrintSection>

        {/* 7. Time Off & CME */}
        <PrintSection title="7. Time Off & CME" icon={Clock}>
          <p>Track provider absences.</p>
          <ul className="list-disc pl-5 space-y-1 text-sm mt-2">
            <li>Go to <strong>Time Off & CME</strong> page.</li>
            <li>Add entry with Type (Time Off, CME, Holiday) and Dates.</li>
            <li>Use "Sync to Schedule" to block dates on the calendar.</li>
          </ul>
        </PrintSection>

        {/* 8. Notifications */}
        <PrintSection title="8. Notifications & Closures" icon={Bell}>
          <p>Set up automated email reminders.</p>
          <ul className="list-disc pl-5 space-y-1 text-sm mt-2">
            <li>Create Reminder for Holidays or Closures.</li>
            <li>Set Send Date, Content, and Recipients.</li>
            <li>System auto-sends on the designated date.</li>
          </ul>
        </PrintSection>

        {/* 9. Licenses */}
        <PrintSection title="9. Licenses" icon={Shield}>
          <p>Track professional licenses.</p>
          <ul className="list-disc pl-5 space-y-1 text-sm mt-2">
            <li>Go to <strong>Licenses</strong> page.</li>
            <li>Add License with <strong>Expiration Date</strong>.</li>
            <li>Dashboard alerts at 90, 60, and 30 days before expiration.</li>
          </ul>
        </PrintSection>

        {/* 10. Reports */}
        <PrintSection title="10. Reports" icon={BarChart3}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Monthly Financials:</strong> Payout bible for payroll.
            </div>
            <div>
              <strong>Invoice Aging:</strong> Collections tracking.
            </div>
            <div>
              <strong>Payment Tracking:</strong> Audit trail of deposits.
            </div>
            <div>
              <strong>Supply Analysis:</strong> Spending trends.
            </div>
          </div>
        </PrintSection>

        {/* 11. Document Management */}
        <PrintSection title="11. Document Management" icon={FolderOpen}>
          <p>Central file storage for Vendor Invoices.</p>
          <ul className="list-disc pl-5 space-y-1 text-sm mt-2">
            <li><strong>Upload:</strong> Drag & drop PDF invoices.</li>
            <li><strong>AI Processing:</strong> Auto-extracts Name, Date, Amount.</li>
            <li><strong>Allocating:</strong> Split invoice costs to specific Locations.</li>
          </ul>
        </PrintSection>

        {/* 12. Catalogs */}
        <PrintSection title="12. Catalogs" icon={BookOpen}>
          <p>Manage standard items for Office and Clinical supplies to streamline ordering.</p>
          <ul className="list-disc pl-5 space-y-1 text-sm mt-2">
            <li>Add items with standardized names, prices, and vendor codes.</li>
          </ul>
        </PrintSection>

      </div>
      
      <div className="mt-12 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
        End of Standard Operating Procedures
      </div>
    </div>
  );
}

function PrintSection({ title, icon: Icon, children }) {
  return (
    <div className="break-inside-avoid mb-6">
      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-300">
        <Icon className="w-5 h-5 text-slate-700" />
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      </div>
      <div className="text-slate-700 text-sm">
        {children}
      </div>
    </div>
  );
}