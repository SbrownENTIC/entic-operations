# Data Relationship Map — ENTIC Operations Center

---

## Entity Relationship Overview

```
Provider
  │
  ├──< License              (one Provider → many Licenses)
  ├──< ClinicalPrivilege    (one Provider → many ClinicalPrivileges)
  ├──< ProviderTimeOff      (one Provider → many TimeOff/CME entries)
  ├──< OnCallSchedule       (one Provider → many OnCallSchedule entries)
  │
  ├──< OutsideIncome        (one Provider → many OutsideIncome records)
  │         │
  │         └──> Invoice    (many OutsideIncome → one Invoice, via outside_income_ids[])
  │                   │
  │                   └──< Payment.allocations  (one Invoice → many Payment allocations)
  │
  └──< Invoice              (one Provider → many Invoices via staff_member_id)

ProgramLocation
  └──< OutsideIncome        (one ProgramLocation → many OutsideIncome records)

SupplyOrder / AudiologySupplyOrder
  └── linked to Location (string enum, not a FK entity)
  └── items[].supply_id → Supply.id

Payment
  └── allocations[].invoice_id → Invoice.id
  └── allocations[].outside_income_id → OutsideIncome.id
  └── allocations[].provider_id → Provider.id
```

---

## Detailed Relationships

### 1. Provider → Licenses
- **Join:** `License.provider_id = Provider.id`
- **Cardinality:** One-to-Many
- **Notes:** A provider can have multiple license types (Medical, DEA, etc.)

### 2. Provider → ClinicalPrivileges
- **Join:** `ClinicalPrivilege.provider_id = Provider.id`
- **Cardinality:** One-to-Many
- **Notes:** One record per facility where the provider has privileges

### 3. Provider → OutsideIncome
- **Join:** `OutsideIncome.provider_id = Provider.id`
- **Cardinality:** One-to-Many
- **Notes:** Each work event (shift, RVU period) creates one OutsideIncome record

### 4. ProgramLocation → OutsideIncome
- **Join:** `OutsideIncome.program_location_id = ProgramLocation.id`
- **Cardinality:** One-to-Many
- **Notes:** Determines the billing rate and program_group for the income record

### 5. OutsideIncome → Invoice
- **Join:** `Invoice.outside_income_ids[] contains OutsideIncome.id`  
  AND `OutsideIncome.invoice_id = Invoice.id` (back-reference)
- **Cardinality:** Many-to-One (multiple income records roll up into one invoice)
- **Notes:**  
  - `OutsideIncome.invoice_id` is set when the invoice is created  
  - `OutsideIncome.status` is changed to `invoiced` when linked  
  - If the invoice is deleted, `OutsideIncome.invoice_id` is cleared and status reverts to `pending`

### 6. Provider → Invoice
- **Join:** `Invoice.staff_member_id = Provider.id`
- **Cardinality:** One-to-Many
- **Notes:** This is the primary provider on the invoice. Additional providers may be found through linked OutsideIncome records.

### 7. Invoice → Payment (via Allocations)
- **Join:** `Payment.allocations[].invoice_id = Invoice.id`
- **Cardinality:** One Invoice → Many Payment allocations; One Payment → Many Invoice allocations
- **Notes:**  
  - A single payment check may cover multiple invoices (split across `allocations[]`)  
  - `Invoice.amount_received` is updated to reflect total allocated payments  
  - `Invoice.balance = amount_expected − amount_received`

### 8. OutsideIncome → Payment (Direct, no invoice)
- **Join:** `Payment.allocations[].outside_income_id = OutsideIncome.id`
- **Cardinality:** Many-to-Many (via allocations array)
- **Notes:** Used when income is paid without a formal invoice

### 9. Supply → SupplyOrder (via line items)
- **Join:** `SupplyOrder.items[].supply_id = Supply.id`
- **Cardinality:** Many-to-Many (via embedded items array)
- **Notes:** Supply catalog is a reference table; orders embed item details at time of order

---

## Key Foreign Key Reference Table

| Source Field | Points To |
|---|---|
| `OutsideIncome.provider_id` | `Provider.id` |
| `OutsideIncome.program_location_id` | `ProgramLocation.id` |
| `OutsideIncome.invoice_id` | `Invoice.id` |
| `Invoice.staff_member_id` | `Provider.id` |
| `Invoice.outside_income_ids[]` | `OutsideIncome.id` (array) |
| `License.provider_id` | `Provider.id` |
| `ClinicalPrivilege.provider_id` | `Provider.id` |
| `ProviderTimeOff.provider_id` | `Provider.id` |
| `OnCallSchedule.provider_id` | `Provider.id` |
| `Payment.allocations[].invoice_id` | `Invoice.id` |
| `Payment.allocations[].outside_income_id` | `OutsideIncome.id` |
| `Payment.allocations[].provider_id` | `Provider.id` |
| `SupplyOrder.items[].supply_id` | `Supply.id` |
| `VendorInvoice.folder_id` | `DocumentFolder.id` |

---

## Data Flow: Income → Invoice → Payment

```
1. Work is performed by a provider at a facility
       ↓
2. OutsideIncome record is created
   (provider_id, program_location_id, work_dates, days_worked OR total_rvus, rate, total_amount)
   Status: "pending"
       ↓
3. Invoice is created grouping one or more OutsideIncome records
   (staff_member_id, outside_income_ids[], total, month)
   OutsideIncome.status → "invoiced"
   OutsideIncome.invoice_id → Invoice.id
       ↓
4. Invoice is sent for approval and to vendor
   Invoice.status progresses through workflow stages
       ↓
5. Payment is received from payer
   Payment.allocations[] references Invoice.id with amount
   Invoice.amount_received is updated
       ↓
6. Provider is paid by ENTIC
   Invoice.provider_paid = true
   Invoice.date_provider_paid = [date]
   Invoice.status = "provider_paid"
``