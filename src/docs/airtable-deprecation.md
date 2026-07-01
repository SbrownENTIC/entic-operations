# Airtable Deprecation Guide

**Status:** Phase 5b — UI warnings and documentation only (no function deletions)

**Last updated:** July 2026

---

## Summary

Email delivery for notifications, closures, reminders, and invoices is now handled through **Power Automate** and the **Notification Queue** in Base44. Airtable automations have been turned off; Airtable sync functions may still write records to Airtable, but they **do not send email**.

Use Airtable sync buttons only when explicitly directed by an administrator.

---

## What Staff Should Use Instead

| Workflow | Primary action | Page |
|----------|----------------|------|
| Office / holiday / reminder emails | Bell icon (queue) or **Queue Closure Notifications** | Notifications & Closures |
| Review pending emails | **Notification Queue** link | Notifications & Closures → Notification Queue |
| Invoice vendor email | Mail icon (**Queue Invoice Email**) | Invoices |
| License expiration email | Queue license reminders (Power Automate path) | Licenses |

---

## Legacy Airtable Controls (Still Present)

These remain in the app for transitional fallback but are **not** the primary email path:

| Control | Function invoked | Notes |
|---------|------------------|-------|
| Sync to Airtable (Reminders page) | `syncOfficeClosuresToAirtable` | Bulk closure sync to Airtable tables |
| Send icon (per reminder row) | `syncReminderToAirtable` | Legacy per-recipient Airtable push |
| Cloud icon on invoices (UC / HH / M) | `syncUConnInvoiceToAirtable`, etc. | Legacy vendor sync; use Mail icon instead |
| Sync to Airtable (Licenses) | `syncLicensesToAirtable` | Credentialing data sync, not email |
| Sync to Airtable (Providers) | `manualSyncProvidersToAirtable` | Staff status sync, not email |
| On-call schedule create/edit/delete | `syncOnCallToAirtable` | Automatic; may still feed external systems |

**Removed from UI (Phase 5b):** “Test Scheduled Reminders” button — it invoked `sendScheduledReminders`, which pushed reminders to Airtable.

---

## Primary Architecture (Power Automate)

See [notifications-phase2-working-baseline.md](./notifications-phase2-working-baseline.md) for the authoritative Phase 2 contract.

```text
Reminder / Invoice → queue* functions → NotificationQueue
                                              ↓
Power Automate → getReadyNotifications → send email → markNotificationSent / markNotificationFailed
```

---

## Admin Checklist (Base44 Dashboard)

Complete before further deprecation phases. Record findings for rollback reference.

### Scheduled jobs to verify or disable

- `sendScheduledReminders` — disable if still scheduled (pushes to Airtable via `syncReminderToAirtable`)
- `syncNotificationQueueToAirtable` — disable if present (abandoned bridge to Airtable)
- Leave `checkLicenseExpirations` enabled — uses Base44 email, not Airtable

### Entity automations / webhooks

- `Provider` update → `syncProviderStatusToAirtable` — disable webhook unless Airtable Staff table is still required
- Any other automation whose target function name contains `Airtable` or `syncReminder`

### Operational decisions (gate later phases)

1. **On-call:** Does anything outside Base44 still read the Airtable On-Call Period table?
2. **Licenses / providers:** Is Airtable still the credentialing system of record?
3. **Invoices:** Has staff fully adopted the Mail / Queue Invoice Email workflow?

---

## Deprecation Phases (Overview)

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Base44 dashboard audit | Manual — admin |
| 5a | Disable unattended Base44 triggers (cron, webhooks) | Manual — admin |
| **5b** | Hide test button, add UI banners, this document | **Current** |
| 3 | Redirect/hide legacy Airtable UI buttons | Future |
| 2 | Disable backend Airtable functions by tier | Future |
| 4 | Update operator SOPs and admin manual | Future |

---

## Do Not Change Yet (Phase 5b Scope)

- Backend Airtable functions remain deployed
- `AIRTABLE_API_KEY` secret unchanged
- Invoice cloud sync buttons remain visible
- On-call automatic Airtable sync unchanged
- Power Automate / Notification Queue functions unchanged

---

## Reference

- Phase 2 baseline: [notifications-phase2-working-baseline.md](./notifications-phase2-working-baseline.md)
- Integration triggers: [integration/trigger-event-logic.md](./integration/trigger-event-logic.md) (contains legacy Airtable references — to be updated in a later phase)
