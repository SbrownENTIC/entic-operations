/**
 * Auto-allocation for Quinnipiac University payments (no invoice workflow).
 * Mirrors PaymentForm direct-income OutsideIncome + allocation pattern.
 */

export const QUINNIPIAC_FACILITY_NAME = 'Quinnipiac University';
const AUTO_NOTE_PREFIX = 'Auto-created from payment';

export function isQuinnipiacPayer(payer) {
  return /quinnipiac/i.test(String(payer || '').trim());
}

export function isQuinnipiacOutsideIncome(income) {
  return /quinnipiac/i.test(String(income?.facility_name || '').trim());
}

export function roundToTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/** Stable idempotency key stored on auto-managed OutsideIncome.notes */
export function buildAutoIncomeNote(paymentId) {
  return paymentId ? `${AUTO_NOTE_PREFIX} id:${paymentId}` : AUTO_NOTE_PREFIX;
}

export function isAutoManagedQuinnipiacIncome(income, paymentId) {
  if (!income || !paymentId) return false;
  return income.notes === buildAutoIncomeNote(paymentId);
}

export function paymentMonthFromDate(paymentDate) {
  if (!paymentDate) return '';
  const [year, month] = paymentDate.split('-');
  if (!year || !month) return '';
  const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
  return dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Pure plan: whether/how to auto-allocate a Quinnipiac payment.
 * Returns needsUpdate:false when fully allocated or unsafe to auto-fix.
 */
export function computeQuinnipiacAllocationPlan(payment, outsideIncomes = []) {
  if (!isQuinnipiacPayer(payment?.payer)) {
    return { needsUpdate: false };
  }

  const totalAmount = roundToTwo(payment.total_amount || 0);
  if (totalAmount <= 0) {
    return { needsUpdate: false };
  }

  const allocations = payment.allocations || [];
  const totalAllocated = roundToTwo(
    allocations.reduce((sum, allocation) => sum + (allocation.amount || 0), 0)
  );

  if (Math.abs(totalAmount - totalAllocated) < 0.01) {
    return { needsUpdate: false };
  }

  if (allocations.some((allocation) => allocation.invoice_id)) {
    return { needsUpdate: false, reason: 'has_invoice_allocations' };
  }

  const directAllocations = allocations.filter(
    (allocation) => allocation.outside_income_id && !allocation.provider_id
  );

  if (directAllocations.length > 1) {
    return { needsUpdate: false, reason: 'multiple_direct_allocations' };
  }

  const paymentId = payment.id;
  const autoNote = buildAutoIncomeNote(paymentId);

  let linkedIncome = outsideIncomes.find((income) => isAutoManagedQuinnipiacIncome(income, paymentId));

  const existingDirectAllocation = directAllocations[0];
  if (!linkedIncome && existingDirectAllocation) {
    const candidate = outsideIncomes.find((income) => income.id === existingDirectAllocation.outside_income_id);
    if (candidate && isQuinnipiacOutsideIncome(candidate)) {
      linkedIncome = candidate;
    }
  }

  const serviceDate = payment.payment_date || new Date().toISOString().slice(0, 10);

  const incomePayload = {
    facility_name: QUINNIPIAC_FACILITY_NAME,
    program_location_id: null,
    total_amount: totalAmount,
    amount_due: totalAmount,
    rate: totalAmount,
    days_worked: 1,
    status: 'entic_paid',
    work_dates: linkedIncome?.work_dates?.[0] ? linkedIncome.work_dates : [serviceDate],
    external_invoice_number: linkedIncome?.external_invoice_number || '',
    external_po_number: linkedIncome?.external_po_number || '',
    description: linkedIncome?.description || '',
    notes: autoNote,
  };

  const allocation = {
    outside_income_id: linkedIncome?.id || null,
    provider_id: null,
    amount: totalAmount,
    notes: existingDirectAllocation?.notes || '',
  };

  return {
    needsUpdate: true,
    incomeId: linkedIncome?.id || null,
    incomePayload,
    allocations: [allocation],
    paymentMonth: paymentMonthFromDate(serviceDate) || payment.payment_month || '',
    status: 'entic_paid',
    unallocated_amount: 0,
  };
}

/**
 * Create/update OutsideIncome and return payment fields to persist.
 * Idempotent: skips when already fully allocated; reuses one income per payment id.
 */
export async function applyQuinnipiacAutoAllocation(payment, outsideIncomes, base44) {
  const plan = computeQuinnipiacAllocationPlan(payment, outsideIncomes);
  if (!plan.needsUpdate || !payment?.id) {
    return { payment, changed: false, incomeRecord: null };
  }

  let incomeId = plan.incomeId;
  let incomeRecord;

  if (incomeId) {
    incomeRecord = await base44.entities.OutsideIncome.update(incomeId, plan.incomePayload);
  } else {
    incomeRecord = await base44.entities.OutsideIncome.create(plan.incomePayload);
    incomeId = incomeRecord.id;
  }

  const allocations = plan.allocations.map((allocation) => ({
    ...allocation,
    outside_income_id: incomeId,
  }));

  return {
    payment: {
      ...payment,
      allocations,
      payment_month: plan.paymentMonth,
      unallocated_amount: plan.unallocated_amount,
      status: plan.status,
    },
    changed: true,
    incomeRecord: { ...incomeRecord, ...plan.incomePayload, id: incomeId },
  };
}
