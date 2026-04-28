# Data Dictionary — ENTIC Operations Center

> All entities include three system-generated built-in fields not listed below:
> - `id` — Unique record identifier (string, system-generated)
> - `created_date` — ISO 8601 timestamp of record creation (system-generated)
> - `updated_date` — ISO 8601 timestamp of last update (system-generated)
> - `created_by` — Email of the user who created the record (system-generated)

---

## 1. Provider

**Description:** Core roster of medical providers employed or contracted by ENTIC.

| Field | Description | Type | Source | Example |
|-------|-------------|------|--------|---------|
| `full_name` | Provider's full legal name | Text | Manual | `"Dr. Jane Smith"` |
| `email` | Provider's primary email address | Email | Manual | `"jsmith@entic.com"` |
| `phone` | Contact phone number | Text | Manual | `"860-555-1234"` |
| `status` | Employment/engagement status | Enum: `active`, `inactive`, `pending` | Manual | `"active"` |
| `role` | Clinical title or role | Text | Manual | `"Otolaryngologist"` |
| `program_locations` | Array of program/location names provider works at | Array of Text | Manual | `["Hartford Hospital", "UConn"]` |
| `start_date` | Date employment or contract began | Date (YYYY-MM-DD) | Manual | `"2022-07-01"` |
| `termination_date` | Last working day (if terminated) | Date (YYYY-MM-DD) | Manual | `"2025-12-31"` |
| `flu_vaccine_year` | Academic year of flu vaccine (e.g., 2025–2026) | Text | Manual | `"2025-2026"` |
| `flu_vaccine_date` | Date flu vaccine was administered | Date (YYYY-MM-DD) | Manual | `"2025-10-15"` |
| `notes` | Free-text internal notes | Text | Manual | `"On sabbatical Q2"` |

---

## 2. OutsideIncome

**Description:** Records of work performed by providers at external facilities. Each record represents one shift, a set of work dates, or an RVU-based billing event. This is the source data that feeds invoices.

| Field | Description | Type | Source | Example |
|-------|-------------|------|--------|---------|
| `provider_id` | Foreign key → Provider.id | Text (FK) | Manual / Auto | `"abc123"` |
| `program_location_id` | Foreign key → ProgramLocation.id | Text (FK) | Manual | `"def456"` |
| `facility_name` | Name of the external facility | Text | Manual / Auto-populated from ProgramLocation | `"Hartford Hospital"` |
| `work_dates` | Array of individual dates worked | Array of Dates | Manual | `["2026-01-05","2026-01-12"]` |
| `days_worked` | Number of days worked (non-Hartford Hospital) | Number | Manual | `3` |
| `total_rvus` | Total RVUs billed (Hartford Hospital On-Call only) | Number | Manual | `42.5` |
| `rate` | Daily rate ($/day) or RVU rate ($/RVU) | Number | Manual / From ProgramLocation | `1000.00` |
| `total_amount` | Total dollars earned for this record | Number | Manual / Calculated | `3000.00` |
| `invoice_id` | Foreign key → Invoice.id (once invoiced) | Text (FK) | System (set on invoice creation) | `"inv789"` |
| `invoice_month` | Human-readable invoice month (e.g., "January 2026") | Text | System (set on invoice creation) | `"January 2026"` |
| `status` | Current status of this income record | Enum: `pending`, `invoiced`, `paid`, `entic_paid` | System / Manual | `"invoiced"` |
| `external_invoice_number` | Invoice number issued by the paying facility | Text | Manual | `"HH-2026-0042"` |
| `external_po_number` | Purchase order number from payer | Text | Manual | `"PO-98765"` |
| `description` | Free-text memo or description | Text | Manual / Auto | `"January 2026 On-Call"` |
| `amount_due` | Original billed amount if different from total_amount | Number | Manual | `3250.00` |
| `temp_oncall_start_date` | Earliest work date (display/sort helper) | Date | System-derived from work_dates[0] | `"2026-01-05"` |
| `notes` | Internal notes | Text | Manual | `"Confirmed by facility"` |

**Key Calculated Fields (in app):**
- `workMonth` — Derived from `work_dates[0]`, displayed as "January 2026"
- `onCallStart` — Alias for `work_dates[0]`, used for sorting

---

## 3. Invoice

**Description:** Formal billing documents sent to program groups or facilities. Each invoice aggregates one or more OutsideIncome records for a given provider and billing month.

| Field | Description | Type | Source | Example |
|-------|-------------|------|--------|---------|
| `invoice_number` | Unique human-readable invoice ID | Text | Manual / Auto-generated | `"UConn-2026-001"` |
| `program_group` | The entity being billed (hospital/program) | Text | Manual | `"Hartford Hospital"` |
| `staff_member_id` | Foreign key → Provider.id | Text (FK) | Manual | `"abc123"` |
| `work_email` | Provider's work email at time of invoice | Email | Manual | `"jsmith@uconn.edu"` |
| `invoice_date` | Date the invoice was created | Date (YYYY-MM-DD) | Manual | `"2026-02-01"` |
| `month` | Human-readable billing month | Text | Manual | `"January 2026"` |
| `status` | Current invoice workflow status | Enum (12 values — see below) | Manual / System | `"approved"` |
| `manual_status_override` | When true, prevents automatic status updates | Boolean | Manual | `false` |
| `outside_income_ids` | Array of OutsideIncome IDs included in this invoice | Array of FK | Manual / Auto | `["inc1","inc2"]` |
| `days_worked` | Total days worked across all linked income | Number | Manual / Calculated in form | `5` |
| `subtotal` | Pre-adjustment total | Number | Calculated | `5000.00` |
| `total` | Final invoice total | Number | Calculated | `5000.00` |
| `amount_expected` | Expected payment amount | Number | Manual / Calculated | `5000.00` |
| `amount_received` | Actual amount received (from Payments) | Number | System (updated via Payment) | `5000.00` |
| `under_over_amount` | Difference: amount_received − amount_expected | Number | Calculated | `0.00` |
| `date_provider_paid` | Date the provider was paid by ENTIC | Date (YYYY-MM-DD) | Manual | `"2026-04-15"` |
| `provider_paid` | Whether provider has been paid | Boolean | Manual | `true` |
| `invoice_ready_to_send` | Flag: invoice is ready to send | Boolean | Manual | `true` |
| `invoice_sent_for_approval` | Flag: sent for internal approval | Boolean | Manual / System | `false` |
| `invoice_sent_to_vendor` | Flag: sent to the external vendor/facility | Boolean | System | `true` |
| `sent_for_approval_at` | Timestamp when sent for approval | DateTime | System | `"2026-02-05T10:30:00Z"` |
| `sent_to_vendor_at` | Timestamp when sent to vendor | DateTime | System | `"2026-02-10T14:00:00Z"` |
| `draft_invoice_url` | URL of draft invoice document (uploaded file) | URL | Manual | `"https://..."` |
| `approved_invoice_url` | URL of approved invoice document (uploaded file) | URL | Manual / System | `"https://..."` |
| `auto_generated` | Whether created automatically (Directorship auto-create) | Boolean | System | `false` |
| `notes` | Internal notes | Text | Manual | `""` |

**Invoice Status Values (in workflow order):**

| Status Value | Display Label |
|---|---|
| `not_started` | Not Started |
| `draft` | Draft |
| `pending_providers_approval` | Pending Providers Approval |
| `pending_providers_time` | Pending Providers Time |
| `sent_to_provider_for_approval` | Sent to Provider for Approval |
| `sent_to_provider_for_review` | Sent to Provider for Review |
| `sent_to_coo_for_approval` | Sent to COO for Approval |
| `sent_for_approval` | Sent for Approval |
| `approved` | Approved |
| `sent_to_vendor` | Sent to Vendor |
| `paid_to_entic` | Paid to ENTIC |
| `provider_paid` | Provider Paid |

---

## 4. Payment

**Description:** Records of money received from a facility or payer. Each payment can be allocated across one or more invoices or direct OutsideIncome records.

| Field | Description | Type | Source | Example |
|-------|-------------|------|--------|---------|
| `payment_date` | Date payment was received | Date (YYYY-MM-DD) | Manual | `"2026-03-15"` |
| `payment_month` | Human-readable month(s) this covers | Text | Manual / Calculated | `"January 2026"` |
| `total_amount` | Total amount received | Number | Manual | `15000.00` |
| `payment_method` | How payment was made | Enum: `check`, `wire_transfer`, `ach`, `credit_card`, `other` | Manual | `"check"` |
| `reference_number` | Check number or transaction reference | Text | Manual | `"CHK-10045"` |
| `payer` | Organization or entity that made the payment | Text | Manual | `"Hartford Hospital"` |
| `allocations` | Array of allocation objects (see below) | Array of Objects | Manual | See below |
| `unallocated_amount` | Amount not yet allocated to an invoice | Number | Calculated | `0.00` |
| `status` | Payment status | Enum: `pending`, `reversed`, `entic_paid` | Manual | `"entic_paid"` |
| `remittance_url` | URL to uploaded remittance document | URL | Manual | `"https://..."` |
| `notes` | Internal notes | Text | Manual | `""` |

**Allocation Object Structure:**

| Field | Description | Type |
|-------|-------------|------|
| `invoice_id` | FK → Invoice.id | Text (FK) |
| `outside_income_id` | FK → OutsideIncome.id (for direct income payments) | Text (FK) |
| `provider_id` | FK → Provider.id | Text (FK) |
| `amount` | Amount allocated to this invoice/income | Number |
| `notes` | Notes specific to this allocation | Text |

---

## 5. License

**Description:** Professional licenses held by providers (medical, DEA, etc.). Tracks expiration and renewal status with automated reminders.

| Field | Description | Type | Source | Example |
|-------|-------------|------|--------|---------|
| `provider_id` | Foreign key → Provider.id | Text (FK) | Manual | `"abc123"` |
| `license_type` | Type of license | Text | Manual | `"Medical License"` |
| `internal_license_number` | Auto-generated internal ID (e.g., MED-001) | Text | System | `"MED-007"` |
| `issue_date` | Date license was issued | Date (YYYY-MM-DD) | Manual | `"2022-01-01"` |
| `expiration_date` | Date license expires | Date (YYYY-MM-DD) | Manual | `"2026-12-31"` |
| `status` | License status | Enum: `active`, `expired`, `pending_renewal` | Manual | `"active"` |
| `document_url` | URL to uploaded license document | URL | Manual | `"https://..."` |
| `reminder_30_sent` | Whether 30-day expiration reminder was sent | Boolean | System | `false` |
| `reminder_14_sent` | Whether 14-day expiration reminder was sent | Boolean | System | `false` |
| `reminder_7_sent` | Whether 7-day expiration reminder was sent | Boolean | System | `false` |
| `notes` | Internal notes | Text | Manual | `""` |

---

## 6. SupplyOrder (Office & Clinical)

**Description:** Tracks supply orders for office or clinical locations. Office and Clinical orders use the same schema. Audiology orders use a separate `AudiologySupplyOrder` entity with the same structure (minus `category` and `merged_into_id`).

| Field | Description | Type | Source | Example |
|-------|-------------|------|--------|---------|
| `order_number` | Unique order number | Text | System / Manual | `"ORD-2026-042"` |
| `vendor` | Vendor name | Text | Manual | `"Staples"` |
| `location` | Office location | Enum: `Glastonbury`, `Manchester`, `Bloomfield`, `Farmington`, `Waterside` | Manual | `"Glastonbury"` |
| `order_date` | Date order was placed | Date (YYYY-MM-DD) | Manual | `"2026-04-01"` |
| `status` | Order status | Enum (8 values — see below) | Manual / System | `"received"` |
| `order_type` | Type of transaction | Enum: `order`, `return` | Manual | `"order"` |
| `category` | Supply category (SupplyOrder only) | Enum: `office`, `clinical` | Manual | `"office"` |
| `submission_source` | How the order was submitted | Enum: `public_form`, `system` | System | `"system"` |
| `items` | Line items array (see below) | Array of Objects | Manual | See below |
| `subtotal` | Sum of line totals before tax | Number | Calculated | `124.50` |
| `tax` | Tax amount | Number | Manual / Calculated | `9.47` |
| `total_amount` | subtotal + tax | Number | Calculated | `133.97` |
| `notes` | Order notes | Text | Manual | `""` |
| `review_flags` | Flags indicating why order needs review | Array of Objects | System | `[]` |
| `approval_notes` | Notes from approver | Text | Manual | `""` |
| `approved_by` | Email of approver | Email | System | `"admin@entic.com"` |
| `approved_date` | Date of approval | Date (YYYY-MM-DD) | System | `"2026-04-02"` |
| `updated_after_submission` | Whether order was edited after initial submission | Boolean | System | `false` |
| `merged_into_id` | If merged, FK of the primary order | Text (FK) | System | `null` |

**Order Status Values:**

| Status | Description |
|--------|-------------|
| `pending_review` | Flagged for admin review |
| `pending_fulfillment` | Approved, awaiting fulfillment |
| `approved` | Approved |
| `rejected` | Rejected |
| `order_placed` | Order has been placed with vendor |
| `partially_received` | Some items received |
| `received` | All items received |
| `merged` | Merged into another order |

**Line Item Object Structure:**

| Field | Description | Type |
|-------|-------------|------|
| `supply_id` | FK → Supply.id | Text (FK) |
| `supply_name` | Item name | Text |
| `item_number` | Vendor item/SKU number | Text |
| `quantity` | Quantity ordered | Number |
| `unit_price` | Price per unit | Number |
| `line_total` | quantity × unit_price | Number |
| `received` | Whether this specific item was received | Boolean |
| `lot_number` | Lot/batch number (clinical orders) | Text |

---

## 7. ProgramLocation

**Description:** Reference table for program/facility combinations. Used to determine billing rates and program groupings.

| Field | Description | Type | Source | Example |
|-------|-------------|------|--------|---------|
| `program_location` | Full location name | Text | Manual | `"Hartford Hospital On-Call"` |
| `program_group` | Parent billing group | Text | Manual | `"Hartford Hospital"` |
| `program_type` | Type of program | Enum: `On-Call`, `Directorship`, `Other` | Manual | `"On-Call"` |
| `daily_rate` | Standard daily billing rate | Number | Manual | `1000.00` |
| `invoice_counter` | Auto-incrementing counter for invoice numbering | Number | System | `12` |
| `notes` | Internal notes | Text | Manual | `""` |

---

## 8. ClinicalPrivilege

**Description:** Tracks hospital/facility clinical privileges for each provider.

| Field | Description | Type | Source | Example |
|-------|-------------|------|--------|---------|
| `provider_id` | Foreign key → Provider.id | Text (FK) | Manual | `"abc123"` |
| `facility_name` | Facility where privileges are granted | Enum (7 values) | Manual | `"Hartford Hospital"` |
| `granted_date` | Date privileges were granted | Date (YYYY-MM-DD) | Manual | `"2023-01-01"` |
| `expiration_date` | Date privileges expire | Date (YYYY-MM-DD) | Manual | `"2025-12-31"` |
| `status` | Privilege status | Enum: `active`, `expired`, `pending` | Manual | `"active"` |
| `notes` | Internal notes | Text | Manual | `""` |