import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Users, Calendar, DollarSign, FileText, CreditCard, 
  Package, ShoppingCart, Clock, Bell, Shield, 
  BarChart3, FolderOpen, Award, GraduationCap, 
  BookOpen, Settings, AlertCircle
} from "lucide-react";

export default function StandardOperatingProcedures() {
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="flex h-full border rounded-lg overflow-hidden bg-white">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-slate-50 border-r border-slate-200 flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Table of Contents</h3>
          <p className="text-xs text-slate-500 mt-1">Click to navigate</p>
        </div>
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            <NavButton onClick={() => scrollToSection('providers')} icon={Users} label="1. Providers" />
            <NavButton onClick={() => scrollToSection('on-call')} icon={Calendar} label="2. On-Call Schedule" />
            <NavButton onClick={() => scrollToSection('income')} icon={DollarSign} label="3. Outside Income" />
            <NavButton onClick={() => scrollToSection('invoices')} icon={FileText} label="4. Processing Invoices" />
            <NavButton onClick={() => scrollToSection('payments')} icon={CreditCard} label="5. Processing Payments" />
            <NavButton onClick={() => scrollToSection('office-orders')} icon={Package} label="6. Office Supply Orders" />
            <NavButton onClick={() => scrollToSection('clinical-orders')} icon={ShoppingCart} label="7. Clinical Supply Orders" />
            <NavButton onClick={() => scrollToSection('time-off')} icon={Clock} label="8. Time Off & CME" />
            <NavButton onClick={() => scrollToSection('notifications')} icon={Bell} label="9. Notifications & Closures" />
            <NavButton onClick={() => scrollToSection('licenses')} icon={Shield} label="10. Licenses" />
            <NavButton onClick={() => scrollToSection('reports')} icon={BarChart3} label="11. Reports" />
            <NavButton onClick={() => scrollToSection('documents')} icon={FolderOpen} label="12. Document Management" />
            <NavButton onClick={() => scrollToSection('privileges')} icon={Award} label="13. Clinical Privileges" />
            <NavButton onClick={() => scrollToSection('cme-tracking')} icon={GraduationCap} label="14. CME Tracking" />
            <NavButton onClick={() => scrollToSection('office-catalog')} icon={BookOpen} label="15. Office Supply Catalog" />
            <NavButton onClick={() => scrollToSection('clinical-catalog')} icon={Settings} label="16. Clinical Supply Catalog" />
          </nav>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 bg-white">
        <ScrollArea className="h-full">
          <div className="p-8 max-w-4xl mx-auto space-y-12 pb-20">
            
            <div className="mb-8 border-b pb-4">
              <h1 className="text-3xl font-bold text-slate-900">Standard Operating Procedures</h1>
              <p className="text-slate-600 mt-2">Detailed guide for all system operations and workflows.</p>
            </div>

            {/* 1. Providers */}
            <Section id="providers" title="1. Adding New Providers" icon={Users}>
              <p>Adding a new provider is the first step in setting up their profile, payroll, and schedule.</p>
              
              <Step title="Navigation">
                Go to the <strong>Providers</strong> page from the main sidebar.
              </Step>
              
              <Step title="Process">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Click the <strong>Add Provider</strong> button in the top right.</li>
                  <li><strong>Personal Info:</strong> Enter Full Name, Email (work), and Phone number.</li>
                  <li><strong>Status & Role:</strong> Set status to 'Active'. Enter their Role (e.g., MD, PA).</li>
                  <li><strong>Locations:</strong> Select all Program Locations where they will work. This controls which locations appear when logging income.</li>
                  <li><strong>Dates:</strong> Enter their Start Date. Leave Termination Date blank for new hires.</li>
                  <li><strong>Vaccine Info:</strong> Optionally enter their current Flu Vaccine status.</li>
                  <li>Click <strong>Create Provider</strong>.</li>
                </ol>
              </Step>
              
              <InfoBox>
                <strong>Note:</strong> Once created, you cannot delete a provider if they have linked records (invoices, income). Instead, mark their status as <strong>Inactive</strong>.
              </InfoBox>
            </Section>

            {/* 2. On-Call Schedule */}
            <Section id="on-call" title="2. Using the On-Call Schedule" icon={Calendar}>
              <p>The On-Call Schedule manages coverage and drives automated income generation for certain facilities.</p>

              <Step title="Navigation">
                Go to <strong>On-Call Schedule</strong> page.
              </Step>

              <Step title="Adding a Shift">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Click <strong>Add Schedule</strong>.</li>
                  <li>Select the <strong>Provider</strong>.</li>
                  <li>Choose the <strong>Location</strong> (e.g., St. Francis, Hartford Hospital).</li>
                  <li>Select <strong>Start Date</strong> and <strong>End Date</strong>.</li>
                  <li>For single days, start and end dates are the same.</li>
                  <li>Optionally add times if it's a partial shift.</li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
              </Step>

              <InfoBox>
                <strong>Automation:</strong> For <strong>St. Francis</strong> shifts, the system automatically creates a "Pending" Outside Income record for each day scheduled. This saves you from manually entering them later.
              </InfoBox>
            </Section>

            {/* 3. Outside Income */}
            <Section id="income" title="3. Adding Outside Income" icon={DollarSign}>
              <p>Outside Income records track every shift or service performed that needs to be billed.</p>

              <Step title="Navigation">
                Go to <strong>Outside Income</strong> page.
              </Step>

              <Step title="Manual Entry">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Click <strong>Add Income</strong>.</li>
                  <li>Select the <strong>Provider</strong> and <strong>Program Location</strong>.</li>
                  <li><strong>Dates:</strong> Click to select one or multiple dates worked.</li>
                  <li><strong>Calculation:</strong>
                    <ul className="list-disc pl-5 mt-1">
                      <li><strong>Standard:</strong> Enter # of Days. System calculates <em>Days × Rate</em>.</li>
                      <li><strong>Hartford RVU:</strong> Enter Total RVUs. System calculates <em>RVUs × Rate</em>.</li>
                    </ul>
                  </li>
                  <li>Click <strong>Save</strong>. The status will be "Pending".</li>
                </ol>
              </Step>
            </Section>

            {/* 4. Processing Invoices */}
            <Section id="invoices" title="4. Processing Invoices" icon={FileText}>
              <p>Invoices group income records into a billable document for the facility.</p>

              <Step title="Creating an Invoice">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Go to <strong>Invoices</strong> → <strong>Create Invoice</strong>.</li>
                  <li>Select <strong>Program Group</strong> (Facility) and <strong>Staff Member</strong>.</li>
                  <li>The system shows a list of "Pending" income records. <strong>Check the boxes</strong> for the records you want to bill (usually all for that month).</li>
                  <li>The <strong>Month</strong> field auto-populates based on the selected dates.</li>
                  <li>Click <strong>Create Invoice</strong>.</li>
                </ol>
              </Step>

              <Step title="Facility-Specific Logic">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>UConn / Manchester:</strong> After creating, click the <strong>File Down (⬇️)</strong> icon to generate the PDF using the official template. Then select the invoice and click the <strong>Cloud Icon</strong> to sync/email it.</li>
                  <li><strong>Hartford Hospital:</strong> If the provider has a "Directorship" role, the system will ask to auto-create a second flat-fee invoice for $3,250.</li>
                </ul>
              </Step>
            </Section>

            {/* 5. Processing Payments */}
            <Section id="payments" title="5. Processing Payments" icon={CreditCard}>
              <p>Record payments received and allocate them to close out invoices.</p>

              <Step title="Recording a Payment">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Go to <strong>Payments</strong> → <strong>Add Payment</strong>.</li>
                  <li>Enter <strong>Amount</strong>, <strong>Date</strong>, <strong>Payer</strong>, and <strong>Reference #</strong> (Check #).</li>
                  <li><strong>Attach Remittance:</strong> Upload the PDF/Image of the check or remittance advice.</li>
                  <li><strong>Allocation (Crucial):</strong>
                    <ul className="list-disc pl-5 mt-1">
                      <li>Click "Add Allocation".</li>
                      <li>Select the Invoice being paid.</li>
                      <li>Enter the amount applied to that invoice.</li>
                      <li>Repeat for multiple invoices if one check covers many.</li>
                    </ul>
                  </li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
              </Step>

              <InfoBox>
                When an invoice is fully allocated (Balance = $0), its status automatically updates to <strong>Paid to ENTIC</strong>.
              </InfoBox>
            </Section>

            {/* 6. Office Supply Orders */}
            <Section id="office-orders" title="6. Office Supply Orders" icon={Package}>
              <p>Manage requests for general office supplies (paper, toner, kitchen).</p>

              <Step title="Process">
                <ol className="list-decimal pl-5 space-y-2">
                  <li><strong>Request:</strong> Staff submit requests via the "Office Supply Orders" page.</li>
                  <li><strong>Review:</strong> Go to the page and filter by "Pending Review".</li>
                  <li><strong>Action:</strong>
                    <ul className="list-disc pl-5 mt-1">
                      <li><strong>Approve:</strong> Marks it as ready for fulfillment.</li>
                      <li><strong>Reject:</strong> Enter a reason for denial.</li>
                    </ul>
                  </li>
                  <li><strong>Ordering:</strong> When you place the order (e.g., Amazon), update status to "Order Placed".</li>
                  <li><strong>Receiving:</strong> When items arrive, click "Edit" and check the "Received" box for each item.</li>
                </ol>
              </Step>
            </Section>

            {/* 7. Clinical Supply Orders */}
            <Section id="clinical-orders" title="7. Clinical Supply Orders" icon={ShoppingCart}>
              <p>Manage medical supply procurement for clinical locations.</p>

              <Step title="Process">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Similar workflow to Office Supplies.</li>
                  <li><strong>Linking Invoices:</strong> You can link a Clinical Supply Order to a <strong>Vendor Invoice</strong> (from Document Management) to verify pricing and receipt.</li>
                  <li><strong>Henry Schein Sync:</strong> Use the "Sync Henry Schein" button in maintenance to automatically create orders from uploaded vendor invoices if manual entry was missed.</li>
                </ol>
              </Step>
            </Section>

            {/* 8. Time Off & CMEs */}
            <Section id="time-off" title="8. Entering Time Off & CME" icon={Clock}>
              <p>Track provider absences for payroll and coverage planning.</p>

              <Step title="Entry">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Go to <strong>Time Off & CME</strong> page.</li>
                  <li>Click <strong>Add Time Off</strong>.</li>
                  <li>Select Provider, Type (Time Off, CME, Holiday), and Dates.</li>
                  <li>For partial days, specify the end time.</li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
              </Step>

              <Step title="Sync">
                <p>Use the "Sync to Schedule" button to visually block these dates on the On-Call Schedule.</p>
              </Step>
            </Section>

            {/* 9. Notifications & Closures */}
            <Section id="notifications" title="9. Notifications & Closures" icon={Bell}>
              <p>Set up automated email reminders for holidays, closures, or custom alerts.</p>

              <Step title="Setting Up a Reminder">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Go to <strong>Notifications & Closures</strong> page.</li>
                  <li>Click <strong>Create Reminder</strong>.</li>
                  <li><strong>Type:</strong> Select "Holiday" or "Office Closure".</li>
                  <li><strong>Dates:</strong> Enter Closure Date and Reopen Date.</li>
                  <li><strong>Send Date:</strong> When should the email go out?</li>
                  <li><strong>Content:</strong> Customize the email subject and body.</li>
                  <li><strong>Recipients:</strong> Enter email addresses (comma separated).</li>
                  <li>Click <strong>Save</strong>. The system will auto-send on the designated Send Date.</li>
                </ol>
              </Step>
            </Section>

            {/* 10. Adding Licenses */}
            <Section id="licenses" title="10. Adding Licenses" icon={Shield}>
              <p>Track professional licenses to prevent expiration lapses.</p>

              <Step title="Process">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Go to <strong>Licenses</strong> page.</li>
                  <li>Click <strong>Add License</strong>.</li>
                  <li>Select Provider and License Type (Medical, DEA, etc.).</li>
                  <li>Enter <strong>Expiration Date</strong> (Critical).</li>
                  <li>Upload a copy of the license document if available.</li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
              </Step>

              <InfoBox>
                <strong>Alerts:</strong> The dashboard automatically flags licenses expiring in 90, 60, and 30 days.
              </InfoBox>
            </Section>

            {/* 11. Reports */}
            <Section id="reports" title="11. Running Reports" icon={BarChart3}>
              <p>Access financial and operational analytics.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <ReportCard title="Monthly Financials" desc="The 'Payout Bible'. Shows payments received per provider for a specific month. Used for payroll." />
                <ReportCard title="Invoice Aging" desc="Shows unpaid invoices categorized by age (30/60/90 days). Use for collections." />
                <ReportCard title="Payment Tracking" desc="Detailed audit trail of every payment and its specific allocation." />
                <ReportCard title="Supply Orders" desc="Spending analysis by location or category over time." />
                <ReportCard title="Credentialing Matrix" desc="Status of hospital privileges for all providers." />
                <ReportCard title="Unlinked Invoices" desc="Finds invoices with $0 Received to identify billing gaps." />
              </div>
            </Section>

            {/* 12. Document Management */}
            <Section id="documents" title="12. Document Management System" icon={FolderOpen}>
              <p>Central file storage, primarily for Vendor Invoices.</p>

              <Step title="Features">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Upload:</strong> Drag & drop files into folders.</li>
                  <li><strong>Vendor Invoices:</strong> Uploading here triggers AI processing to read the Vendor Name, Date, and Amount.</li>
                  <li><strong>Splitting:</strong> If a PDF contains multiple invoices, use the "Split" tool to separate them into individual records automatically.</li>
                  <li><strong>Allocating:</strong> Assign invoice costs to specific Locations or Supply Orders directly from the document view.</li>
                </ul>
              </Step>
            </Section>

            {/* 13. Clinical Privileges */}
            <Section id="privileges" title="13. Adding Clinical Privileges" icon={Award}>
              <p>Track which hospitals a provider is credentialed at.</p>

              <Step title="Process">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Go to <strong>Clinical Privileges</strong> (under 'More' menu).</li>
                  <li>Click <strong>Add Privilege</strong>.</li>
                  <li>Select Provider and Facility (e.g., Hartford Hospital).</li>
                  <li>Enter <strong>Granted Date</strong> and <strong>Expiration Date</strong>.</li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
              </Step>
            </Section>

            {/* 14. CME Tracking */}
            <Section id="cme-tracking" title="14. CME Tracking" icon={GraduationCap}>
              <p>Monitor Continuing Medical Education credits against the annual quota.</p>

              <Step title="Adding Credits">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Go to <strong>CME Tracking</strong> (under 'More' menu).</li>
                  <li>Click <strong>Log CME Credits</strong>.</li>
                  <li>Select Provider.</li>
                  <li>Enter Course Name, Date, and <strong>Credits Earned</strong>.</li>
                  <li>Upload Certificate.</li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
              </Step>

              <Step title="Waivers">
                <p>If a provider is exempt for a year, click "Add Waiver" to stop the dashboard from flagging them as non-compliant.</p>
              </Step>
            </Section>

            {/* 15. Office Supply Catalog */}
            <Section id="office-catalog" title="15. Managing Office Supply Catalog" icon={BookOpen}>
              <p>Define standard items available for order.</p>

              <Step title="Process">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Go to <strong>Office Catalog</strong> (under 'More' menu).</li>
                  <li>Click <strong>Add Item</strong>.</li>
                  <li>Enter Product Name, Unit Price, and Unit (e.g., Box, Case).</li>
                  <li>Add an Image URL if available.</li>
                  <li>Click <strong>Save</strong>. These items will now appear in the dropdown when staff create orders.</li>
                </ol>
              </Step>
            </Section>

            {/* 16. Clinical Supply Catalog */}
            <Section id="clinical-catalog" title="16. Managing Clinical Supply Catalog" icon={Settings}>
              <p>Define medical items and link them to vendors.</p>

              <Step title="Process">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Go to <strong>Clinical Catalog</strong> (under 'More' menu).</li>
                  <li>Click <strong>Add Item</strong>.</li>
                  <li>Enter Item # (SKU), Name, Vendor, and Price.</li>
                  <li><strong>Codes:</strong> Enter any alternate codes used by different vendors for the same item.</li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
              </Step>
              
              <InfoBox>
                <strong>Tip:</strong> Accurate Item #s help the AI link Vendor Invoices to Supply Orders automatically.
              </InfoBox>
            </Section>

          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function Section({ id, title, icon: Icon, children }) {
  return (
    <div id={id} className="scroll-mt-8 border rounded-xl p-6 bg-slate-50/50 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-200">
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <Icon className="w-5 h-5 text-slate-700" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      </div>
      <div className="text-sm text-slate-600 space-y-4">
        {children}
      </div>
    </div>
  );
}

function Step({ title, children }) {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-slate-800 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
        {title}
      </h4>
      <div className="ml-4">{children}</div>
    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
      <AlertCircle className="w-5 h-5 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function NavButton({ onClick, icon: Icon, label }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors text-left"
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function ReportCard({ title, desc }) {
  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
      <h4 className="font-bold text-slate-800 mb-1">{title}</h4>
      <p className="text-xs text-slate-600">{desc}</p>
    </div>
  );
}