# Trigger & Event Logic — ENTIC Operations Center

---

## Overview

The system has two categories of triggers:
1. **User-initiated actions** — changes made in the UI that cascade to related records
2. **Automated/scheduled functions** — backend jobs that run on a schedule or in response to events

---

## Section A: User-Initiated Cascades

### Trigger 1: Invoice Created
**Event:** User creates a new Invoice  
**Actions:**
1. All `OutsideIncome` records in `outside_income_ids[]` are updated:
   - `status` → `"invoiced"`
   - `invoice_id` → new Invoice ID
   - `invoice_month` → Invoice.month
2. If `program_group = "Hartford Hospital"` (non-Directorship):
   - Auto-find or create a Directorship `OutsideIncome` for same provider/month
   - Auto-create a paired Directorship `Invoice` (total = $3,250, `auto_generated = true`)
3. If `program_group = "St. Francis"` and provider is Seth Brown:
   - Auto-find or create a St. Francis Directorship `OutsideIncome` ($1,750)
   - Link it to the **same** invoice (appended, not a new invoice)
4. If `program_group` includes "UConn":
   - Auto-generate Excel file via `generateUConnExcel` function
   - Open generated file in new browser tab
5. If `program_group` includes "Manchester" or "ECHN":
   - Auto-generate PDF via `generateManchesterPDF` function
   - Open generated PDF in new browser tab
   - **Note:** Manchester invoices are group-level — one invoice covers all required providers (Seth Brown, Benjamin Wycherly, Ryan Drake) for the month. The PDF invoice number is derived from the service month (`MM/YY`), not the invoice creation date.

**Dependencies:** Provider record, ProgramLocation record, OutsideIncome records

---

### Trigger 2: Invoice Updated
**Event:** User edits an existing Invoice  
**Actions:**
1. Any `OutsideIncome` records **removed** from `outside_income_ids[]`:
   - `invoice_id` → `null`
   - `invoice_month` → `null`
   - `status` → `"pending"`
2. Any `OutsideIncome` records **newly added** to `outside_income_ids[]`:
   - `invoice_id` → Invoice ID
   - `invoice_month` → Invoice.month
   - `status` → `"invoiced"`
3. All remaining linked income records: `invoice_month` refreshed to match current `Invoice.month`
4. If `statusChanged = true`: `Invoice.manual_status_override` is set to `true` (prevents future auto-updates)

---

### Trigger 3: Invoice Deleted
**Event:** User deletes an Invoice  
**Actions:**
1. All linked `OutsideIncome` records (`outside_income_ids[]`) are updated:
   - `invoice_id` → `null`
   - `invoice_month` → `null`
   - `status` → `"pending"`

**Note:** If an OutsideIncome record has already been deleted, the unlink attempt is silently skipped.

---

### Trigger 4: Invoice Synced to Airtable
**Event:** User clicks the sync-to-Airtable button (Manchester, UConn, or Hartford Hospital invoices)  
**Actions:**
1. Calls backend function: `syncManchesterInvoiceToAirtable`, `syncUConnInvoiceToAirtable`, or `syncHartfordInvoiceToAirtable`
2. Invoice is updated:
   - `status` → `"sent_to_vendor"`
   - `invoice_sent_to_vendor` → `true`
   - `sent_to_vendor_at` → current timestamp
   - `manual_status_override` → `true`

**Prerequisite:** Invoice must have an `approved_invoice_url` set (uploaded PDF). Sync will fail otherwise.

---

### Trigger 5: Approved PDF Uploaded (Quick Upload)
**Event:** Admin uploads an approved invoice file from the Invoices list view  
**Actions:**
1. File uploaded to Base44 storage, URL saved to `Invoice.approved_invoice_url`
2. If current invoice status is NOT `paid_to_entic`, `provider_paid`, or `sent_to_vendor`:
   - `status` → `"approved"`
   - `invoice_sent_to_vendor` → `false`
   - `manual_status_override` → `true`

---

### Trigger 6: OutsideIncome Created (HH Skull Base)
**Event:** User creates OutsideIncome record at an HH Skull Base program location  
**Actions:**
1. System checks if a `Hartford Hospital (Directorship)` ProgramLocation exists
2. If yes, auto-creates a paired Directorship `OutsideIncome`:
   - `facility_name` → `"Hartford Hospital (Directorship)"`
   - `rate` → $3,250
   - `total_amount` → $3,250
   - `work_dates` → [first day of same month]

---

### Trigger 7: OutsideIncome Created (St. Francis + Seth Brown)
**Event:** User creates OutsideIncome for Seth Brown at a St. Francis On-Call location  
**Actions:**
1. Checks if a St. Francis Directorship record already exists for same provider+month
2. If none exists, auto-creates:
   - `facility_name` → `"St. Francis (Directorship)"`
   - `rate` → $1,750
   - `total_amount` → $1,750

---

### Trigger 8: Bulk "Pay Provider Quarter" Action
**Event:** Admin clicks "Pay Provider Q1/Q2/Q3/Q4" button (only after quarter end date)  
**Actions:**
1. All invoices for that calendar quarter (based on linked payment dates) that are not yet `provider_paid`:
   - `status` → `"provider_paid"`
   - `provider_paid` → `true`
   - `date_provider_paid` → today's date
   - `manual_status_override` → `true`

---

## Section B: Scheduled / Automated Backend Functions

### Automation 1: License Expiration Reminders
**Trigger:** Scheduled (runs daily)  
**Function:** `checkLicenseExpirations`  
**Actions:**
1. Fetches all active licenses
2. For each license:
   - If expiry within 30 days AND `reminder_30_sent = false`: send email, set flag
   - If expiry within 14 days AND `reminder_14_sent = false`: send email, set flag
   - If expiry within 7 days AND `reminder_7_sent = false`: send email, set flag
3. Emails sent to provider + admin contacts

---

### Automation 2: CME Deadline Reminders
**Trigger:** Scheduled (runs periodically)  
**Function:** `checkCMEDeadlines`  
**Actions:** Sends reminder emails to providers with upcoming CME requirements

---

### Automation 3: Scheduled Reminders (Holidays, Closures, Custom)
**Trigger:** Scheduled (runs daily at fixed time)  
**Function:** `sendScheduledReminders`  
**Actions:**
1. Fetches all `Reminder` records where `status = "active"` and `send_date <= today`
2. Sends email to all `recipients[]`
3. Updates `Reminder.last_sent_date` and `Reminder.send_count`
4. Calculates `next_send_date` based on `frequency` and `frequency_count`
5. If `frequency = "once"`, sets `status → "completed"`

---

### Automation 4: Provider Termination Check
**Trigger:** Scheduled  
**Function:** `checkProviderTerminations`  
**Actions:** Checks for providers with `termination_date` in the past and may send notifications

---

## Section C: Manual Admin Functions (On-Demand)

| Function | Description |
|----------|-------------|
| `linkOutsideIncomeToOnCall` | Links OutsideIncome records to corresponding OnCallSchedule dates |
| `linkUConnProviders` | Associates UConn OutsideIncome records with correct Provider records |
| `fixHartfordDirectorshipInvoices` | Repairs missing Directorship invoices for Hartford Hospital |
| `fixOutsideIncomeAmounts` | Recalculates total_amounts based on days_worked × rate |
| `syncLicensesToAirtable` | Syncs License data to Airtable |
| `syncOnCallToAirtable` | Syncs OnCall schedule to Airtable |
| `syncPaymentsAndInvoices` | Syncs payment/invoice balances |
| `generateUConnExcel` | Generates Excel invoice file for UConn program |
| `generateManchesterPDF` | Generates PDF invoice for Manchester/ECHN |