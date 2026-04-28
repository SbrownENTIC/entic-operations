# Calculation Logic — ENTIC Operations Center

---

## 1. Invoice Total Calculations

### 1a. Days-Worked Invoice (On-Call, non-Hartford)
```
total_amount (per OutsideIncome) = days_worked × rate

Invoice.subtotal = SUM of total_amount across all linked OutsideIncome records
Invoice.total = subtotal  (no tax or deductions applied)
Invoice.amount_expected = total  (set equal to total at creation)
```

**Fields Used:** `OutsideIncome.days_worked`, `OutsideIncome.rate`, `OutsideIncome.total_amount`, `Invoice.outside_income_ids[]`

### 1b. RVU-Based Invoice (Hartford Hospital On-Call)
```
total_amount (per OutsideIncome) = total_rvus × rate

Invoice.subtotal = SUM of total_amount across all linked OutsideIncome records
Invoice.total = subtotal
Invoice.amount_expected = total
```

**Fields Used:** `OutsideIncome.total_rvus`, `OutsideIncome.rate`, `OutsideIncome.total_amount`

### 1c. Directorship Invoice (Hartford Hospital & St. Francis)
```
Fixed total_amount = $3,250 (Hartford Hospital Directorship)
Fixed total_amount = $1,750 (St. Francis Directorship)

Invoice.total = $3,250 or $1,750 (fixed, not derived from shifts)
```

**Notes:** Directorship invoices are auto-generated when a primary On-Call invoice is created for Hartford Hospital or for Seth Brown at St. Francis.

---

## 2. Invoice Balance

```
Invoice.balance = Invoice.amount_expected − Invoice.amount_received
```

- Displayed on the Invoices page as a running balance
- `amount_received` is updated manually or via Payment allocation
- A positive balance means outstanding amount owed
- A zero or negative balance indicates fully paid or overpaid

**Fields Used:** `Invoice.amount_expected`, `Invoice.amount_received`

---

## 3. Invoice Under/Over Amount

```
Invoice.under_over_amount = Invoice.amount_received − Invoice.amount_expected
```

- Positive = overpayment
- Negative = underpayment
- Zero = exactly paid

---

## 4. Payment Unallocated Amount

```
Payment.unallocated_amount = Payment.total_amount − SUM(allocations[].amount)
```

**Fields Used:** `Payment.total_amount`, `Payment.allocations[].amount`

---

## 5. Supply Order Total

```
SupplyOrder.items[i].line_total = items[i].quantity × items[i].unit_price

SupplyOrder.subtotal = SUM of all items[i].line_total
SupplyOrder.total_amount = subtotal + tax
```

**Fields Used:** `SupplyOrder.items[].quantity`, `items[].unit_price`, `items[].line_total`, `SupplyOrder.tax`

---

## 6. Outside Income Work Month Derivation

The `workMonth` field is not stored — it is derived at runtime from `work_dates`:

```
workMonth = FORMAT(work_dates[0], "MMMM yyyy")
```

If `work_dates` contains dates spanning multiple calendar months:
```
workMonth = JOIN(UNIQUE_MONTHS, ", ")
e.g., "January 2026, February 2026"
```

---

## 7. Invoice Quarter Calculation

Displayed on the Invoices page, derived at runtime:

```
Linked payments for the invoice = Payment records where allocations[].invoice_id = Invoice.id

Latest payment = most recent by payment_date

Quarter = "Q" + CEIL((payment_date.getMonth() + 1) / 3) + " " + payment_date.getFullYear()
e.g., payment on 2026-03-15 → "Q1 2026"
```

If no payment linked: Quarter displays as `"-"`

---

## 8. Invoice Aging Logic

Not stored as a field — external platforms can derive this:

```
Days Outstanding = TODAY − invoice_date  (for non-paid invoices)

Aging buckets (suggested):
  Current:    0–30 days
  30–60 days: 31–60 days
  60–90 days: 61–90 days
  90+ days:   > 90 days

Only apply to invoices with status NOT IN ("provider_paid", "paid_to_entic")
```

---

## 9. Monthly Financial Reporting Logic

To compute monthly revenue, aggregate OutsideIncome by invoice_month:

```
Monthly Total = SUM(OutsideIncome.total_amount)
  WHERE invoice_month = "January 2026"

Monthly Collected = SUM(Invoice.amount_received)
  WHERE Invoice.month = "January 2026"

Monthly Outstanding = SUM(Invoice.amount_expected - Invoice.amount_received)
  WHERE Invoice.month = "January 2026"
  AND Invoice.status NOT IN ("provider_paid")
```

---

## 10. License Expiration Alerts

Computed at runtime (also used by automated reminders):

```
Days Until Expiry = License.expiration_date − TODAY

Alert thresholds:
  30 days: reminder_30_sent flag set to true after reminder sent
  14 days: reminder_14_sent flag set to true after reminder sent
   7 days: reminder_7_sent flag set to true after reminder sent

Status auto-transition (manual, not automatic in current system):
  "active" → "pending_renewal" when expiry < 30 days (manual update)
  "active" → "expired" when expiry_date < TODAY (manual update)
```

---

## 11. On-Call Start Date (Sort Helper)

```
onCallStart = work_dates[0]  (first date in the work_dates array)
```

Used only for display and sorting. Not a stored field.

---

## 12. Invoice Auto-Generation Logic (Directorship)

**Hartford Hospital Directorship** (triggered when creating a Hartford Hospital On-Call invoice):
```
IF Invoice.program_group = "Hartford Hospital"
AND Invoice.invoice_number does NOT contain "Directorship"
THEN:
  1. Find or create OutsideIncome:
     provider_id = Invoice.staff_member_id
     facility_name = "Hartford Hospital (Directorship)"
     total_amount = $3,250 | rate = $3,250 | days_worked = 0

  2. Create new Invoice:
     invoice_number = original_invoice_number + " (Directorship)"
     total = $3,250 | subtotal = $3,250 | amount_expected = $3,250
     auto_generated = true
```

**St. Francis Directorship** (triggered only for provider Seth Brown):
```
IF Invoice.program_group = "St. Francis"
AND provider.full_name contains "Seth Brown"
AND Invoice.invoice_number does NOT contain "Directorship"
THEN:
  Same pattern as above but total_amount = $1,750
  Directorship income is APPENDED to the original invoice (not a new invoice)
``