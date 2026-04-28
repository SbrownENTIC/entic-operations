# ENTIC Operations Center — Integration Package

**Version:** 1.0  
**Generated:** April 28, 2026  
**Purpose:** External data platform integration reference

---

## Package Contents

| File | Description |
|------|-------------|
| `README.md` | This file — overview and index |
| `data-dictionary.md` | Full field-level documentation for all datasets |
| `data-relationships.md` | Entity relationship map and join keys |
| `calculation-logic.md` | All business formulas and derived fields |
| `trigger-event-logic.md` | Automation triggers and cascading actions |
| `system-notes.md` | Manual inputs, assumptions, known gaps |
| `sample-data.json` | Realistic sample records for all datasets |
| `export-schema.json` | Structured export schema for each dataset |

---

## Quick Reference: Dataset Summary

| Dataset | Entity Name | Primary Key | Row Count Est. |
|---------|-------------|-------------|----------------|
| Providers | `Provider` | `id` | ~20–50 |
| Outside Income | `OutsideIncome` | `id` | ~500–2000/year |
| Invoices | `Invoice` | `id` | ~200–800/year |
| Payments | `Payment` | `id` | ~100–400/year |
| Licenses | `License` | `id` | ~100–300 |
| Supply Orders (Office) | `SupplyOrder` | `id` | ~200–800/year |
| Supply Orders (Audiology) | `AudiologySupplyOrder` | `id` | ~50–200/year |
| Clinical Privileges | `ClinicalPrivilege` | `id` | ~50–150 |
| Program Locations | `ProgramLocation` | `id` | ~10–30 |
| Payments | `Payment` | `id` | ~100–400/year |

---

## API Access

All entity data is accessible via the Base44 App Data API:

```
Base URL: https://api.base44.com/api/apps/{APP_ID}/entities/
```

Authentication: Bearer token (API key from Base44 dashboard → Settings → API)

Example:
```
GET /entities/OutsideIncome?sort=-created_date&limit=100
```

See Base44 documentation for filtering, pagination, and sort syntax.