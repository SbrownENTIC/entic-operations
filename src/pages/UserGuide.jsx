import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Calendar, DollarSign, FileText, CreditCard, Package, Bell, Award, ShieldCheck, GraduationCap, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function UserGuide() {
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
            <h1 className="text-3xl font-bold text-slate-900">ENTIC Operations Center User Guide</h1>
            <p className="text-slate-600 mt-1">A comprehensive guide for using the ENTIC Operations App</p>
          </div>
        </div>

        {/* Introduction */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Welcome to the ENTIC Operations App</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              This application is your all-in-one platform for managing the critical operational aspects of ENTIC. 
              It's designed to streamline complex workflows, automate routine tasks, and provide intelligent insights 
              across provider management, financial tracking, scheduling, compliance, and supply orders.
            </p>
          </CardContent>
        </Card>

        {/* Provider Management */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <CardTitle>Provider Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Overview</h4>
            <p>
              The Providers module allows you to maintain comprehensive records for each provider including 
              contact details, employment status, roles, and program affiliations.
            </p>
            
            <h4>Key Features</h4>
            <ul>
              <li><strong>Provider Profiles:</strong> Store full name, email, phone (required for providers with "MD" in their role), status, and role information</li>
              <li><strong>Program Locations:</strong> Assign providers to one or more program locations</li>
              <li><strong>Status Tracking:</strong> Manage provider employment status (active/inactive)</li>
              <li><strong>Termination Date:</strong> Set a termination date and the system will automatically update the provider to inactive when that date passes</li>
              <li><strong>Flu Vaccine Tracking:</strong> Record flu vaccine dates; the vaccine year is automatically calculated based on the date entered</li>
              <li><strong>Notes:</strong> Add any additional notes about the provider</li>
            </ul>

            <h4>Adding a New Provider</h4>
            <ol>
              <li>Navigate to <strong>Providers</strong> from the navigation menu</li>
              <li>Click the <strong>"Add Provider"</strong> button</li>
              <li>Fill out the required fields:
                <ul>
                  <li>Full Name</li>
                  <li>Email</li>
                  <li>Phone (required if "MD" is in the role)</li>
                  <li>Status</li>
                  <li>Role</li>
                </ul>
              </li>
              <li>Optionally select Program Locations, set Termination Date, Flu Vaccine Date, and add Notes</li>
              <li>Click <strong>"Add Provider"</strong> to save</li>
            </ol>

            <h4>Viewing Provider Details</h4>
            <p>
              Click on any provider's name in the Providers list to view their complete profile, including 
              contact information, status, flu vaccine status, licenses, clinical privileges, and CME records.
            </p>
          </CardContent>
        </Card>

        {/* Compliance Tracking */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <CardTitle>Compliance Tracking</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Licenses</h4>
            <p>Track all provider licenses with issue dates, expiration dates, and status.</p>
            <ul>
              <li>License types include: Medical License, Physician Assistant-Certified, Audiologist License, APRN License, DEA License, and Controlled Substance Practitioner License</li>
              <li>Internal license numbers are automatically generated</li>
              <li>The system sends automated reminders at 30, 14, and 7 days before expiration</li>
            </ul>

            <h4>Clinical Privileges</h4>
            <p>Track provider privileges at various facilities.</p>
            <ul>
              <li>Record granted date and expiration date</li>
              <li>Facilities include: Bloomfield, Hartford Hospital, St. Francis, UConn, Manchester/ECHN, CCMC, and CTSC-CT Surgery Center</li>
              <li>Automated alerts flag expiring privileges for timely renewal</li>
            </ul>

            <h4>CME Tracking</h4>
            <p>Record Continuing Medical Education courses and credits.</p>
            <ul>
              <li>Enter course name, credits earned, and completion date</li>
              <li>View total credits earned per provider</li>
              <li>Track compliance status (minimum 3 credits required)</li>
            </ul>
          </CardContent>
        </Card>

        {/* On-Call Schedule */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <CardTitle>On-Call Schedule</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Overview</h4>
            <p>
              Create and manage provider on-call shifts with start/end dates and times, and location assignments.
            </p>

            <h4>Key Features</h4>
            <ul>
              <li><strong>Calendar View:</strong> Visual representation of on-call assignments by month</li>
              <li><strong>List View:</strong> Sortable table view of all on-call entries</li>
              <li><strong>Auto-Generation:</strong> For certain programs (e.g., St. Francis), creating an on-call schedule automatically generates corresponding outside income records</li>
            </ul>

            <h4>Adding an On-Call Entry</h4>
            <ol>
              <li>Navigate to <strong>On-Call Schedule</strong></li>
              <li>Click <strong>"Add Entry"</strong></li>
              <li>Select the provider, location, and enter start/end dates and times</li>
              <li>Click <strong>"Save"</strong></li>
            </ol>
          </CardContent>
        </Card>

        {/* Outside Income */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <CardTitle>Understanding Outside Income</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Overview</h4>
            <p>
              Track external work performed by providers including facility, work dates, RVUs or days worked, and rates.
            </p>

            <h4>Key Features</h4>
            <ul>
              <li><strong>Automatic Calculations:</strong> The system automatically calculates days worked and total amount based on work dates and daily rates for most programs</li>
              <li><strong>Hartford Hospital RVU-Based:</strong> For Hartford Hospital (non-Directorship), enter Total RVUs and manually enter the Total Amount</li>
              <li><strong>Directorship Programs:</strong> Monthly rate programs where days worked doesn't apply</li>
              <li><strong>Auto-Creation:</strong> When you create an RVU-based "HH Skull Base" income, the system automatically creates a corresponding "Hartford Hospital (Directorship)" income entry</li>
            </ul>

            <h4>Adding Outside Income</h4>
            <ol>
              <li>Navigate to <strong>Outside Income</strong></li>
              <li>Click <strong>"Add Income"</strong></li>
              <li>Select the Provider and Program/Location (this will auto-fill the facility name and rate)</li>
              <li>For daily-rate programs: Add individual work dates</li>
              <li>For Hartford Hospital RVU-based: Enter Total RVUs and Total Amount</li>
              <li>Click <strong>"Add Income"</strong></li>
            </ol>
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <CardTitle>Invoice Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Overview</h4>
            <p>
              Create and manage invoices for outside income. Invoices track amounts expected, amounts received, 
              and provider payment status.
            </p>

            <h4>Invoice Statuses</h4>
            <ul>
              <li>Not Started</li>
              <li>Draft</li>
              <li>Pending Providers Approval</li>
              <li>Pending Providers Time</li>
              <li>Submitted for Approval</li>
              <li>Approved</li>
              <li>Sent to Vendor</li>
              <li>Paid to ENTIC</li>
              <li>Provider Paid</li>
            </ul>

            <h4>Creating an Invoice from Outside Income</h4>
            <ol>
              <li>Go to <strong>Outside Income</strong></li>
              <li>Select the pending income records you want to invoice using the checkboxes</li>
              <li>Click the <strong>"Create Invoice"</strong> button that appears</li>
              <li>The invoice form will be pre-filled with the selected income details</li>
              <li>Verify the invoice number, amounts, and status</li>
              <li>Click <strong>"Create Invoice"</strong></li>
            </ol>
            <p>
              <strong>Note:</strong> For Hartford Hospital RVU-based invoices, the system will automatically 
              generate an additional Directorship invoice for the same provider and month.
            </p>

            <h4>Bulk Invoice Updates</h4>
            <p>
              Select multiple invoices using checkboxes to update status, date provider paid, or mark as provider paid in bulk.
            </p>
          </CardContent>
        </Card>

        {/* Payments */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <CardTitle>Processing Payments</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Overview</h4>
            <p>
              Record incoming payments and allocate them to specific invoices. The system tracks payment method, 
              reference numbers, and automatically updates invoice statuses.
            </p>

            <h4>Adding a New Payment</h4>
            <ol>
              <li>Navigate to <strong>Payments</strong></li>
              <li>Click <strong>"Add Payment"</strong></li>
              <li>Enter payment details:
                <ul>
                  <li>Payment Date</li>
                  <li>Total Amount</li>
                  <li>Payment Method (check, wire transfer, ACH, credit card, other)</li>
                  <li>Reference Number: Use the Payment # if available. If no Payment #, use the Voucher Number. If both exist, put Payment # here and Voucher # in the Notes field</li>
                  <li>Payer</li>
                </ul>
              </li>
              <li>In the Allocations section, click <strong>"Add Allocation"</strong></li>
              <li>Select the Invoice to allocate to and enter the amount</li>
              <li>You can add multiple allocations to distribute the payment across different invoices</li>
              <li>Click <strong>"Add Payment"</strong></li>
            </ol>
            <p>
              <strong>Note:</strong> The system automatically updates invoice statuses and tracks any unallocated amount.
            </p>
          </CardContent>
        </Card>

        {/* Time Off */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <CardTitle>Time Off & CME</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Overview</h4>
            <p>
              Record provider absences including time off, CME days, partial days, and holidays.
            </p>

            <h4>Recording Time Off</h4>
            <ol>
              <li>Navigate to <strong>Time Off & CME</strong></li>
              <li>Click <strong>"Add Entry"</strong></li>
              <li>Select the provider, type (Time Off, CME, Partial Day, Holiday), and dates</li>
              <li>Add a reason if applicable</li>
              <li>The status is set to "Approved" as entries are only recorded after approval</li>
              <li>Click <strong>"Save"</strong></li>
            </ol>

            <h4>Views</h4>
            <ul>
              <li><strong>List View:</strong> Sortable table of all time off entries</li>
              <li><strong>Calendar View:</strong> Visual representation by month</li>
            </ul>
          </CardContent>
        </Card>

        {/* Supply Orders */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              <CardTitle>Supply Orders</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Overview</h4>
            <p>
              Manage supply orders for office locations. The vendor is Staples, and locations include 
              Glastonbury, Farmington, Manchester, and Bloomfield.
            </p>

            <h4>For Office Admins: Placing a Supply Request</h4>
            <p>
              Office administrators can use the <strong>Supply Request Link</strong> to submit supply orders. 
              This is a simplified form for requesting supplies without needing full system access.
            </p>

            <h4>Order Workflow</h4>
            <ul>
              <li><strong>Pending Review:</strong> New orders awaiting review</li>
              <li><strong>Pending Fulfillment:</strong> Orders approved and ready to be placed</li>
              <li><strong>Approved:</strong> Order has been approved</li>
              <li><strong>Rejected:</strong> Order was not approved</li>
              <li><strong>Order Placed:</strong> Order has been submitted to Staples</li>
              <li><strong>Partially Received:</strong> Some items have arrived</li>
              <li><strong>Received:</strong> All items have been received</li>
            </ul>
            <p>
              <strong>Note:</strong> The Order Number is manually updated once the order is actually placed on Staples.
            </p>

            <h4>Real-Time Notifications</h4>
            <p>
              The Bell icon in the navigation alerts you to pending supply orders. A distinctive doorbell 
              sound plays when new orders are awaiting review or fulfillment.
            </p>
          </CardContent>
        </Card>

        {/* Reminders */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              <CardTitle>Automated Reminders</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Overview</h4>
            <p>
              Create and manage automated email reminders for various purposes including license expirations, 
              privilege expirations, holidays, CME deadlines, invoice due dates, and custom reminders.
            </p>

            <h4>Creating a Reminder</h4>
            <ol>
              <li>Navigate to <strong>Reminders</strong></li>
              <li>Click <strong>"Create Reminder"</strong></li>
              <li>Enter the reminder name, type, email subject, and email body</li>
              <li>Add recipient email addresses</li>
              <li>Set the send date and frequency (once, daily, weekly, monthly, quarterly, yearly)</li>
              <li>For Holiday reminders, include closure date, reopen date, and on-call provider information</li>
              <li>Click <strong>"Create Reminder"</strong></li>
            </ol>
          </CardContent>
        </Card>

        {/* Reports */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <CardTitle>Reports</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Payment Tracking Report</h4>
            <p>
              Generate detailed reports of invoices, payments received, and outstanding amounts by program group.
            </p>
            <ul>
              <li>Filter by date range and program group</li>
              <li>For Hartford Hospital and St. Francis, the report separates Directorship and On-Call tracking</li>
              <li>Export to CSV for your records</li>
            </ul>

            <h4>Exporting Data</h4>
            <p>
              Most modules (Outside Income, Invoices, Payments, Time Off, etc.) have CSV export functionality. 
              Click the "Export CSV" or "Export to CSV" button to download the data.
            </p>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Tips for Best Results</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <ul>
              <li>Always fill out all relevant fields accurately to ensure automations work correctly</li>
              <li>Check the Dashboard regularly for alerts on expiring licenses and privileges</li>
              <li>Use the search and filter features to quickly find specific records</li>
              <li>Review the bell icon notifications for pending supply orders</li>
              <li>Keep provider information up to date, especially termination dates</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}