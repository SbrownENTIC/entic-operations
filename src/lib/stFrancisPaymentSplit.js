/**
 * Helpers for St. Francis (and Hartford) combined invoices that bundle
 * directorship and on-call outside income on one invoice.
 */

export const isDirectorshipOutsideIncome = (income, programLocations = []) => {
  if (!income) return false;
  if ((income.facility_name || '').toLowerCase().includes('directorship')) return true;
  if (income.program_location_id) {
    const loc = programLocations.find((pl) => pl.id === income.program_location_id);
    if (loc?.program_type === 'Directorship') return true;
    if ((loc?.program_location || '').toLowerCase().includes('directorship')) return true;
  }
  return false;
};

export const getLinkedIncomes = (invoice, outsideIncome = []) => {
  const linkedById = (invoice?.outside_income_ids || [])
    .map((id) => outsideIncome.find((inc) => inc.id === id))
    .filter(Boolean);
  const linkedByInvoiceId = outsideIncome.filter((inc) => inc.invoice_id === invoice?.id);
  const merged = new Map();
  [...linkedById, ...linkedByInvoiceId].forEach((inc) => merged.set(inc.id, inc));
  return [...merged.values()];
};

export const getInvoiceTypeSplit = (invoice, outsideIncome = [], programLocations = [], programGroup) => {
  const invoiceTotal = invoice?.amount_expected || invoice?.total || 0;
  const hasDirectorshipInvoiceNumber = invoice?.invoice_number?.includes('(Directorship)');

  if (programGroup === 'Hartford Hospital') {
    if (hasDirectorshipInvoiceNumber) {
      return { directorshipExpected: invoiceTotal, onCallExpected: 0 };
    }
    return { directorshipExpected: 0, onCallExpected: invoiceTotal };
  }

  const linked = getLinkedIncomes(invoice, outsideIncome);
  const directorshipFromIncome = linked
    .filter((inc) => isDirectorshipOutsideIncome(inc, programLocations))
    .reduce((sum, inc) => sum + (inc.total_amount || 0), 0);
  const onCallFromIncome = linked
    .filter((inc) => !isDirectorshipOutsideIncome(inc, programLocations))
    .reduce((sum, inc) => sum + (inc.total_amount || 0), 0);

  if (linked.length === 0) {
    if (hasDirectorshipInvoiceNumber) {
      return { directorshipExpected: invoiceTotal, onCallExpected: 0 };
    }
    return { directorshipExpected: 0, onCallExpected: invoiceTotal };
  }

  if (directorshipFromIncome > 0 && onCallFromIncome > 0) {
    return {
      directorshipExpected: directorshipFromIncome,
      onCallExpected: onCallFromIncome,
    };
  }

  if (directorshipFromIncome > 0 || hasDirectorshipInvoiceNumber) {
    return {
      directorshipExpected: directorshipFromIncome || invoiceTotal,
      onCallExpected: 0,
    };
  }

  return {
    directorshipExpected: 0,
    onCallExpected: onCallFromIncome || invoiceTotal,
  };
};

/**
 * Attribute invoice payment amounts to directorship vs on-call.
 * Uses outside_income_id on allocations when present; otherwise directorship-first waterfall.
 */
export const splitReceivedFromPayments = (
  invoice,
  payments = [],
  outsideIncome = [],
  programLocations = [],
  programGroup
) => {
  const split = getInvoiceTypeSplit(invoice, outsideIncome, programLocations, programGroup);
  let directorshipReceived = 0;
  let onCallReceived = 0;
  let unattributedReceived = 0;

  payments.forEach((payment) => {
    payment.allocations?.forEach((allocation) => {
      if (allocation.invoice_id !== invoice?.id) return;
      const amount = allocation.amount || 0;
      if (!amount) return;

      if (allocation.outside_income_id) {
        const income = outsideIncome.find((inc) => inc.id === allocation.outside_income_id);
        if (isDirectorshipOutsideIncome(income, programLocations)) {
          directorshipReceived += amount;
        } else {
          onCallReceived += amount;
        }
        return;
      }

      unattributedReceived += amount;
    });
  });

  if (unattributedReceived > 0) {
    const directorshipRemaining = Math.max(0, split.directorshipExpected - directorshipReceived);
    const toDirectorship = Math.min(unattributedReceived, directorshipRemaining);
    directorshipReceived += toDirectorship;
    onCallReceived += unattributedReceived - toDirectorship;
  }

  return {
    directorshipReceived: Math.round(directorshipReceived * 100) / 100,
    onCallReceived: Math.round(onCallReceived * 100) / 100,
    ...split,
  };
};

export const getIncomeAmountReceived = (
  income,
  invoice,
  payments = [],
  outsideIncome = [],
  programLocations = [],
  programGroup
) => {
  if (!income) return 0;

  let received = 0;
  payments.forEach((payment) => {
    payment.allocations?.forEach((allocation) => {
      if (allocation.outside_income_id === income.id) {
        received += allocation.amount || 0;
      }
    });
  });

  if (received > 0 || !invoice) {
    return Math.round(received * 100) / 100;
  }

  const { directorshipReceived, onCallReceived } = splitReceivedFromPayments(
    invoice,
    payments,
    outsideIncome,
    programLocations,
    programGroup
  );

  if (isDirectorshipOutsideIncome(income, programLocations)) {
    return directorshipReceived;
  }
  return onCallReceived;
};

export const findSplitOutsideIncomeId = (invoice, incomes, splitType) => {
  if (!invoice || !splitType) return null;
  const linked = getLinkedIncomes(invoice, incomes);
  if (splitType === 'directorship') {
    return linked.find((inc) => isDirectorshipOutsideIncome(inc))?.id || null;
  }
  if (splitType === 'oncall') {
    return linked.find((inc) => !isDirectorshipOutsideIncome(inc))?.id || null;
  }
  return null;
};

export const inferSplitTypeFromAmount = (invoice, incomes, amount) => {
  if (!invoice) return null;
  const split = getInvoiceTypeSplit(invoice, incomes, [], invoice.program_group);
  if (split.directorshipExpected <= 0 || split.onCallExpected <= 0) return null;
  if (Math.abs(amount - split.directorshipExpected) < 0.02) return 'directorship';
  if (Math.abs(amount - split.onCallExpected) < 0.02) return 'oncall';
  return null;
};

/** Attribute a single invoice allocation to directorship or on-call (directorship-first waterfall). */
export const attributeInvoiceAllocation = (
  allocation,
  invoice,
  outsideIncome = [],
  programLocations = [],
  programGroup,
  priorDirectorshipReceived = 0
) => {
  if (!allocation?.invoice_id || allocation.invoice_id !== invoice?.id) return null;

  if (allocation.outside_income_id) {
    const income = outsideIncome.find((inc) => inc.id === allocation.outside_income_id);
    return isDirectorshipOutsideIncome(income, programLocations) ? 'directorship' : 'oncall';
  }

  const split = getInvoiceTypeSplit(invoice, outsideIncome, programLocations, programGroup);
  const amount = allocation.amount || 0;
  if (amount <= 0) return null;

  const inferred = inferSplitTypeFromAmount(invoice, outsideIncome, amount);
  if (inferred) return inferred;

  if (split.directorshipExpected <= 0) return 'oncall';
  if (split.onCallExpected <= 0) return 'directorship';

  const directorshipRemaining = Math.max(0, split.directorshipExpected - priorDirectorshipReceived);
  if (amount <= directorshipRemaining + 0.01) return 'directorship';
  if (directorshipRemaining <= 0.01) return 'oncall';
  return 'mixed';
};

/** Raw payment attribution per type for combined invoices (used by reports). */
export const getSplitInvoicePaymentAttribution = (
  invoice,
  payments = [],
  outsideIncome = [],
  programLocations = [],
  programGroup
) => {
  const empty = { payment: null, notes: '' };
  const result = { directorship: { ...empty }, onCall: { ...empty } };

  if (!invoice) return result;

  let directorshipReceived = 0;
  const sortedPayments = [...payments].sort((a, b) =>
    (a.payment_date || '').localeCompare(b.payment_date || '')
  );

  sortedPayments.forEach((payment) => {
    if (!payment.payment_date) return;

    payment.allocations?.forEach((allocation) => {
      if (allocation.invoice_id !== invoice.id) return;

      const amount = allocation.amount || 0;
      if (!amount) return;

      const type = attributeInvoiceAllocation(
        allocation,
        invoice,
        outsideIncome,
        programLocations,
        programGroup,
        directorshipReceived
      );

      const paymentNotes = payment.notes && (
        payment.notes.toLowerCase().includes('auto-generated') ||
        payment.notes.toLowerCase().includes('auto-created')
      ) ? '' : (payment.notes || '');

      if (type === 'directorship' || type === 'oncall') {
        result[type] = { payment, notes: paymentNotes };
      } else if (type === 'mixed') {
        const split = getInvoiceTypeSplit(invoice, outsideIncome, programLocations, programGroup);
        const directorshipRemaining = Math.max(0, split.directorshipExpected - directorshipReceived);
        if (directorshipRemaining > 0.01) {
          result.directorship = { payment, notes: paymentNotes };
        }
        if (amount - directorshipRemaining > 0.01) {
          result.onCall = { payment, notes: paymentNotes };
        }
      }

      if (type === 'directorship') {
        directorshipReceived += amount;
      } else if (type === 'mixed') {
        const split = getInvoiceTypeSplit(invoice, outsideIncome, programLocations, programGroup);
        const directorshipRemaining = Math.max(0, split.directorshipExpected - directorshipReceived);
        directorshipReceived += Math.min(amount, directorshipRemaining);
      }
    });
  });

  return result;
};

export const getInvoiceBalanceSplit = (
  invoice,
  incomes = [],
  payments = [],
  programLocations = [],
  excludePaymentId = null
) => {
  const totalExpected = invoice?.amount_expected || invoice?.total || 0;
  const filteredPayments = excludePaymentId
    ? payments.filter((p) => p.id !== excludePaymentId)
    : payments;

  const received = splitReceivedFromPayments(
    invoice,
    filteredPayments,
    incomes,
    programLocations,
    invoice?.program_group
  );

  const totalReceived = received.directorshipReceived + received.onCallReceived;
  const totalBalance = Math.max(0, Math.round((totalExpected - totalReceived) * 100) / 100);
  const { directorshipExpected, onCallExpected, directorshipReceived, onCallReceived } = received;

  if (directorshipExpected > 0 && onCallExpected > 0) {
    const directorshipBalance = Math.max(
      0,
      Math.round((directorshipExpected - directorshipReceived) * 100) / 100
    );
    const onCallBalance = Math.max(
      0,
      Math.round((onCallExpected - onCallReceived) * 100) / 100
    );
    return {
      totalBalance: Math.max(0, Math.round((directorshipBalance + onCallBalance) * 100) / 100),
      directorshipBalance,
      onCallBalance,
      isMixed: true,
      directorshipExpected,
      onCallExpected,
    };
  }

  if (directorshipExpected > 0) {
    return {
      totalBalance,
      directorshipBalance: totalBalance,
      onCallBalance: 0,
      isMixed: false,
      directorshipExpected,
      onCallExpected: 0,
    };
  }

  return {
    totalBalance,
    directorshipBalance: 0,
    onCallBalance: totalBalance,
    isMixed: false,
    directorshipExpected: 0,
    onCallExpected,
  };
};

export const suggestAllocationAmount = (invoice, incomes, paymentTotal, payments = [], excludePaymentId = null) => {
  const split = getInvoiceBalanceSplit(invoice, incomes, payments, [], excludePaymentId);
  if (split.totalBalance <= 0) return 0;
  if (!paymentTotal || paymentTotal <= 0) return split.totalBalance;

  if (split.isMixed) {
    const matchesDirectorship = Math.abs(paymentTotal - split.directorshipBalance) < 0.02;
    const matchesOnCall = Math.abs(paymentTotal - split.onCallBalance) < 0.02;
    if (matchesDirectorship) return Math.min(paymentTotal, split.directorshipBalance);
    if (matchesOnCall) return Math.min(paymentTotal, split.onCallBalance);
    return Math.min(paymentTotal, split.totalBalance);
  }

  return Math.min(paymentTotal, split.totalBalance);
};
