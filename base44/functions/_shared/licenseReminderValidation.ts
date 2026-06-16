/**
 * Shared validation for License Expiration Reminder NotificationQueue records.
 * Used at send time (Power Automate / Airtable sync) to block stale reminders.
 */

export const STAGE_DAYS: Record<string, number> = {
  '30 Day': 30,
  '14 Day': 14,
  '7 Day': 7,
};

export function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function subtractDays(dateString: string, days: number): string {
  return addDays(dateString, -days);
}

export function daysUntilExpiration(expirationDate: string, today: string): number {
  const exp = new Date(`${expirationDate}T12:00:00`);
  const todayDate = new Date(`${today}T12:00:00`);
  return Math.round((exp.getTime() - todayDate.getTime()) / 86400000);
}

export type LicenseReminderValidation =
  | { valid: true }
  | { valid: false; reason: string };

export async function validateLicenseReminderNotification(
  base44: { asServiceRole: { entities: { License: { get: (id: string) => Promise<Record<string, unknown>> } } } },
  notification: Record<string, unknown>,
  today: string = todayET()
): Promise<LicenseReminderValidation> {
  if (notification.notification_type !== 'License Expiration Reminder') {
    return { valid: true };
  }

  if (!notification.related_record_id) {
    return { valid: false, reason: 'Missing related license id' };
  }

  let license: Record<string, unknown> | null = null;
  try {
    license = await base44.asServiceRole.entities.License.get(String(notification.related_record_id));
  } catch {
    return { valid: false, reason: 'Related license not found' };
  }

  if (!license?.expiration_date) {
    return { valid: false, reason: 'License missing expiration date' };
  }

  if (license.status !== 'active') {
    return { valid: false, reason: `License is not active (status: ${license.status || 'unknown'})` };
  }

  const licenseExpiration = String(license.expiration_date);
  const notificationExpiration = String(notification.expiration_date || '');

  if (licenseExpiration !== notificationExpiration) {
    return { valid: false, reason: 'Cancelled because license expiration date no longer matches' };
  }

  const stageDays = STAGE_DAYS[String(notification.reminder_stage || '')];
  if (!stageDays) {
    return { valid: false, reason: `Unknown reminder stage: ${notification.reminder_stage || '(blank)'}` };
  }

  const expectedSendDate = subtractDays(licenseExpiration, stageDays);
  const notificationSendDate = String(notification.send_date || '');

  if (notificationSendDate !== expectedSendDate) {
    return {
      valid: false,
      reason: 'Cancelled because reminder send date no longer matches license expiration schedule',
    };
  }

  // On the scheduled send day, confirm the license is still expiring on the expected timeline.
  if (notificationSendDate === today) {
    const daysUntil = daysUntilExpiration(licenseExpiration, today);

    if (daysUntil < 0) {
      return { valid: false, reason: 'Cancelled because license has already expired' };
    }

    // Allow 1-day tolerance for timezone / scheduling drift.
    if (Math.abs(daysUntil - stageDays) > 1) {
      return {
        valid: false,
        reason: `Cancelled because license expires in ${daysUntil} days, not ${stageDays} days as required for ${notification.reminder_stage} reminder`,
      };
    }
  }

  return { valid: true };
}

export async function cancelInvalidLicenseReminder(
  base44: { asServiceRole: { entities: { NotificationQueue: { update: (id: string, data: Record<string, unknown>) => Promise<unknown> } } } },
  notification: Record<string, unknown>,
  reason: string
): Promise<void> {
  await base44.asServiceRole.entities.NotificationQueue.update(String(notification.id), {
    status: 'Cancelled',
    ready_to_send: false,
    error_message: reason,
  });
}

export function isUnsentLicenseReminder(notification: Record<string, unknown>): boolean {
  return (
    notification.notification_type === 'License Expiration Reminder' &&
    notification.status === 'Ready to Send' &&
    notification.ready_to_send === true &&
    (!notification.sent_date || notification.sent_date === '' || notification.sent_date === null)
  );
}
