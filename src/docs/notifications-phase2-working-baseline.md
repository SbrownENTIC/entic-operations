# Notifications Phase 2 Working Baseline

Date: 2026-05-29
Status: Phase 2 testing passed

## Scope Locked

The following areas are considered the current working baseline and should not be changed unless specifically requested:

- Office Closure notification queue logic
- Holiday Closure notification queue logic
- Reminder Notification queue logic
- Power Automate queue retrieval logic
- Send date eligibility/filtering logic
- CC formatting
- HTML email formatting
- Sent status update handling
- Failed status update handling

## Current Architecture

Automated email delivery is managed through the `NotificationQueue` entity. The app queues notification records, and the existing Power Automate process retrieves records that are ready to send.

Power Automate remains responsible for the actual email delivery process and for calling the app functions that mark notifications as sent or failed.

## Supported Notification Types

The Phase 2 baseline supports these queued notification types:

- Office Closure
- Holiday Closure
- Reminder Notification

Additional `NotificationQueue` types may exist in the schema, but the Phase 2 tested baseline is limited to the notification types listed above.

## Key Entities

### Reminder

Used as the source record for closures and reminder notifications.

Relevant Phase 2 fields include:

- `reminder_type`
- `email_notification_eligible`
- `email_subject`
- `email_body`
- `recipients`
- `bcc`
- `send_date`
- `closure_date`
- `closure_time`
- `reopen_date`
- `reopen_time`
- `closure_name`
- `oncall_provider_list`
- `oncall_phone_list`
- `status`

### NotificationQueue

Used as the queue consumed by Power Automate.

Relevant Phase 2 fields include:

- `notification_type`
- `related_entity`
- `related_record_id`
- `closure_type`
- `location`
- `send_date`
- `closure_date`
- `to`
- `cc`
- `bcc`
- `subject`
- `body`
- `status`
- `ready_to_send`
- `sent_date`
- `sent_by`
- `error_message`
- `email_provider_message_id`

## Backend Functions

### queueClosureNotification

Queues a single eligible Reminder record into `NotificationQueue`.

Current baseline behavior:

- Supports Office Closure, Holiday, Inclement Weather, and eligible Reminder Notification records.
- Converts Holiday reminders to `Holiday Closure` queue records.
- Converts Office Closure and Inclement Weather reminders to `Office Closure` queue records.
- Converts eligible Reminder Notification reminders to `Reminder Notification` queue records.
- Requires `send_date`.
- Requires `closure_date` for Office Closure and Holiday Closure notifications.
- Requires subject, body, and at least one recipient.
- Prevents duplicates using notification type, related reminder ID, send date, and closure date.
- Creates queue records with `status: Ready to Send` and `ready_to_send: true`.
- Preserves the standardized ENTIC HTML email structure and Steve Brown signature.

### queueBulkClosureNotifications

Bulk queues eligible closure-related reminders.

Current baseline behavior:

- Scans eligible closure reminders.
- Creates missing queue records.
- Skips records that are already queued, sent, failed, or otherwise duplicate-protected.
- Returns counts and details for created and skipped records.

### getReadyNotifications

Used by Power Automate to retrieve notifications ready for delivery.

Current baseline behavior:

- Returns only queue records with `status: Ready to Send`.
- Returns only records marked `ready_to_send: true`.
- Returns only records whose `send_date` is due for the current send cycle.
- Excludes future send dates.
- Excludes records already marked sent.
- Preserves the Power Automate-compatible response structure:

```json
{
  "success": true,
  "count": 0,
  "notifications": []
}
```

### markNotificationSent

Used by Power Automate after successful email delivery.

Current baseline behavior:

- Updates the matching queue record to `Sent`.
- Sets `ready_to_send` to false.
- Stores sent metadata such as sent date, sender, and provider message ID when provided.

### markNotificationFailed

Used by Power Automate when email delivery fails.

Current baseline behavior:

- Updates the matching queue record to `Failed`.
- Sets `ready_to_send` to false.
- Stores the error message for review.

## Frontend Pages

### Notifications & Closures

Current baseline behavior:

- Displays reminders and closure records.
- Allows eligible individual records to be queued.
- Includes a bulk action to queue closure notifications.
- Shows per-row queue status:
  - Not Queued
  - Queued
  - Sent
  - Failed
  - Cancelled
- Shows closure date and sent timestamp where available.

### Notification Queue

Current baseline behavior:

- Displays queued notification records.
- Supports filtering by:
  - Notification type
  - Status
  - Send date
  - Closure date
  - Search text
- Displays Office Closure, Holiday Closure, and Reminder Notification records using type-specific badges.
- Allows review of queue records without changing delivery logic.

## Formatting Baseline

The Phase 2 baseline preserves:

- Existing ENTIC HTML email layout
- Steve Brown signature block
- Closure-specific email wording
- Reminder Notification email wording
- Existing CC formatting behavior
- Existing recipient and BCC handling

## Power Automate Contract

Power Automate should continue to use the existing queue workflow:

1. Call `getReadyNotifications`.
2. Send each returned notification email.
3. Call `markNotificationSent` after successful delivery.
4. Call `markNotificationFailed` if delivery fails.

The response format of `getReadyNotifications` is part of the working baseline and should not be changed without explicit approval.

## Change Control Note

This document records the Phase 2 Working Baseline. Future changes to Office Closure, Holiday Closure, Reminder Notification, Power Automate queue logic, send date logic, CC formatting, HTML formatting, or Sent/Failed status updates should only be made after a specific request and should be tested against this baseline.