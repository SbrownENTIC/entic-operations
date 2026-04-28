# System Notes — ENTIC Operations Center

---

## 1. Fields That Rely on Manual Input

The following fields have **no automatic computation** and depend entirely on user entry:

### OutsideIncome
- `days_worked` — Must be entered manually per shift record (non-Hartford Hospital)
- `total_rvus` — Must be entered manually from Hartford Hospital RVU report
- `rate` — Pulled from ProgramLocation but can be overridden manually
- `total_amount` — Typically entered manually (or calculated from days × rate but not always enforced)
- `external_invoice_number` — Only entered when the payer provides one
- `external_po_number` — Only entered when the payer provides one
- `description` — Free text, not required
- `work_dates` — Must be individually selected by the user

### Invoice
- `invoice_number` — Manually assigned; no global auto-increment (per-program counters exist in ProgramLocation)
- `month` — Free-text string (e.g., "January 2026") — not validated as a date
- `amount_expected` — Defaults to `total` but can be manually adjusted
- `amount_received` — Updated manually or via Payment allocation; NOT auto-summed from payments
- `date_provider_paid` — Must be entered manually or via bulk update
- `notes` — Free text

### Payment
- `payment_date` — Manually entered
- `total_amount` — Manually entered
- `reference_number` — Manually entered (check number, wire reference, etc.)
- `allocations[]` — Manually configured; splitting across invoices requires user input
- `unallocated_amount` — Displayed but must be manually zeroed out

### Licenses
- `expiration_date` — Manually entered; no integration with state licensing boards
- `status` — Manually updated; does NOT auto-transition to "expired" when date passes
- `reminder_*_sent` flags — Set by the automated reminder job, but can be manually reset

### Supply Orders
- `vendor` — Free text, no vendor validation against Vendor entity
- `tax` — Manually entered
- `approved_by` — Set to authenticated user email at time of approval (system) — but approval itself is manual

---

## 2. Known Assumptions in the System

### Billing Model
- All Hartford Hospital On-Call income is assumed to be **RVU-based** (not days-worked)
- All Hartford Hospital Directorship income is assumed to be a **flat $3,250/month**
- All St. Francis Directorship income (for Seth Brown only) is assumed to be a **flat $1,750/month**
- Directorship invoices are auto-generated only — they use hardcoded ProgramLocation IDs embedded in code

### Invoice-to-Income Linkage
- The system assumes a **one-to-one mapping** between `OutsideIncome.invoice_id` and one Invoice
- An OutsideIncome record can only be linked to **one invoice at a time**
- `Invoice.amount_received` is NOT automatically recalculated when new payments are recorded — this requires manual entry or running `syncPaymentsAndInvoices`

### Provider Identity
- The Seth Brown Directorship auto-creation logic uses a **name match** (`provider.full_name.toLowerCase().includes("seth brown")`) — if the name changes or is misspelled, the trigger will not fire

### Program Group Matching
- Manchester/ECHN detection uses: `program_group.includes("manchester") || program_group.includes("echn")`
- UConn detection uses: `program_group.toLowerCase().includes("uconn")`
- These are **string matches**, not entity references — inconsistent naming in program_group will break routing

### Dates
- All dates are stored as `YYYY-MM-DD` strings (no timezone)
- Display is formatted to Eastern Time (America/New_York)
- The `month` field on Invoice is a **free-text string** like "January 2026" — not a date type — which means sorting and filtering must use string parsing

---

## 3. Known Data Gaps

| Area | Issue |
|------|-------|
| `Invoice.amount_received` | Not automatically updated from Payment allocations — requires manual sync or `syncPaymentsAndInvoices` function |
| `OutsideIncome.total_amount` | May not always equal `days_worked × rate` if entered manually without recalculation |
| `Invoice.invoice_number` | No enforced uniqueness at the database level — duplicates are possible |
| `Supply.item_number` | Not always populated on all supply catalog items |
| `License.status` | Does not auto-expire — "expired" must be set manually |
| `ClinicalPrivilege.status` | Does not auto-expire — must be manually updated |
| `Payment.unallocated_amount` | Must be manually maintained; not auto-computed from allocations |
| `ProviderTimeOff` | Partial day entries use `end_time` but no `start_time` |
| Airtable sync | Requires approved PDF to be uploaded before syncing; sync failures are not automatically retried |

---

## 4. Multi-Program Invoice Notes

- A single **provider** can have income from multiple **program groups** in the same month
- Invoices are **per program group per provider per month** — not consolidated across programs
- Hartford Hospital generates **two invoices**: one for On-Call RVU work and one for Directorship ($3,250)

---

## 5. External Integration Points

| Integration | Direction | Notes |
|---|---|---|
| Airtable | Outbound push | Invoices synced via `syncUConnInvoiceToAirtable`, `syncManchesterInvoiceToAirtable`, `syncHartfordInvoiceToAirtable` |
| Base44 File Storage | Outbound | Invoice PDFs and supply remittance documents uploaded to Base44 storage URLs |
| Email (Base44 Core) | Outbound | Automated reminders sent via Base44 `SendEmail` integration |
| Excel/PDF Generation | Internal | UConn Excel and Manchester PDF generated server-side using `exceljs` / `jsPDF` |

---

## 6. Recommended Approach for External Platform Integration

1. **Use the Base44 App Data API** to pull all entity data as JSON
2. **Join tables in your platform** using the FK fields documented in `data-relationships.md`
3. **Recalculate derived fields** (balance, workMonth, quarter) in your platform rather than relying on app state
4. **Poll or subscribe** to `updated_date` on each entity to detect changes since last sync
5. **Do not write back** to the system through the API unless you have confirmed field-level impact — especially avoid writing to `Invoice.amount_received`, `OutsideIncome.invoice_id`, or `OutsideIncome.status` without understanding the cascade effects