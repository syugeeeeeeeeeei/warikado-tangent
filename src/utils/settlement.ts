import type { CalculationLog, EventData, Transfer } from '../types/domain';

export const calculateSettlement = (
  data: EventData,
): { transfers: Transfer[]; logs: CalculationLog[] } => {
  const balances = new Map<string, number>();
  const logs: CalculationLog[] = [];

  data.members.forEach((member) => balances.set(member.id, 0));

  data.expenses.forEach((expense) => {
    const totalRatio = expense.ratios.reduce((sum, ratio) => sum + ratio.ratio, 0);
    if (totalRatio === 0) return;

    const currentPayerBalance = balances.get(expense.payerId) ?? 0;
    balances.set(expense.payerId, currentPayerBalance + expense.amount);

    let totalBaseOwed = 0;
    const baseOweds = new Map<string, number>();

    expense.ratios.forEach((ratio) => {
      if (ratio.ratio === 0) {
        baseOweds.set(ratio.memberId, 0);
        return;
      }
      const baseOwed = Math.floor(expense.amount * (ratio.ratio / totalRatio));
      baseOweds.set(ratio.memberId, baseOwed);
      totalBaseOwed += baseOwed;
    });

    const fraction = expense.amount - totalBaseOwed;

    let actualBearerId = expense.fractionBearerId;
    if (!baseOweds.has(actualBearerId) || baseOweds.get(actualBearerId) === 0) {
      const firstValidRatio = expense.ratios.find((ratio) => ratio.ratio > 0);
      actualBearerId = firstValidRatio ? firstValidRatio.memberId : expense.payerId;
    }

    expense.ratios.forEach((ratio) => {
      if (ratio.ratio === 0) return;

      let finalOwed = baseOweds.get(ratio.memberId) ?? 0;
      let hasFraction = false;

      if (ratio.memberId === actualBearerId) {
        finalOwed += fraction;
        hasFraction = fraction > 0;
      }

      const currentBalance = balances.get(ratio.memberId) ?? 0;
      balances.set(ratio.memberId, currentBalance - finalOwed);

      const formulaStr = expense.isGradientMode
        ? `${expense.amount}円 × ${ratio.ratio}%${hasFraction && fraction > 0 ? ` ＋ 端数${fraction}円` : ''}`
        : `${expense.amount}円 ÷ 比率合計${totalRatio}${hasFraction && fraction > 0 ? ` ＋ 端数${fraction}円` : ''}`;

      const amountPaid = expense.payerId === ratio.memberId ? expense.amount : 0;
      logs.push({
        memberId: ratio.memberId,
        expenseName: expense.name,
        formula: formulaStr,
        amountOwed: finalOwed,
        amountPaid,
        net: amountPaid - finalOwed,
      });
    });
  });

  const transfers: Transfer[] = [];
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  balances.forEach((balance, id) => {
    if (balance < -0.01) debtors.push({ id, amount: -balance });
    else if (balance > 0.01) creditors.push({ id, amount: balance });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    if (!debtor || !creditor) break;

    const amount = Math.min(debtor.amount, creditor.amount);

    transfers.push({
      fromMemberId: debtor.id,
      toMemberId: creditor.id,
      amount: Math.round(amount),
    });

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) debtorIndex += 1;
    if (creditor.amount < 0.01) creditorIndex += 1;
  }

  return { transfers, logs };
};
