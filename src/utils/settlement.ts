import type { CalculationLog, EventData, ExpenseBreakdown, Transfer } from '../types/domain';

const buildFormula = (
  amount: number,
  ratio: number,
  totalRatio: number,
  isGradientMode: boolean,
  hasFraction: boolean,
  fraction: number,
) => {
  if (isGradientMode) {
    return `${amount}円 × ${ratio}%${hasFraction && fraction > 0 ? ` ＋ 端数${fraction}円` : ''}`;
  }

  return `${amount}円 ÷ 比率合計${totalRatio}${hasFraction && fraction > 0 ? ` ＋ 端数${fraction}円` : ''}`;
};

export const calculateExpenseBreakdowns = (data: EventData): ExpenseBreakdown[] => {
  const breakdowns: ExpenseBreakdown[] = [];

  data.expenses.forEach((expense) => {
    const totalRatio = expense.ratios.reduce((sum, ratio) => sum + ratio.ratio, 0);
    if (totalRatio === 0) return;

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

    const items = expense.ratios
      .filter((ratio) => ratio.ratio > 0)
      .map((ratio) => {
        let finalOwed = baseOweds.get(ratio.memberId) ?? 0;
        let hasFraction = false;

        if (ratio.memberId === actualBearerId) {
          finalOwed += fraction;
          hasFraction = fraction > 0;
        }

        return {
          memberId: ratio.memberId,
          amountOwed: finalOwed,
          formula: buildFormula(
            expense.amount,
            ratio.ratio,
            totalRatio,
            expense.isGradientMode,
            hasFraction,
            fraction,
          ),
        };
      });

    breakdowns.push({
      expenseId: expense.id,
      expenseName: expense.name,
      payerId: expense.payerId,
      amount: expense.amount,
      items,
    });
  });

  return breakdowns;
};

export const calculateSettlement = (
  data: EventData,
): { transfers: Transfer[]; logs: CalculationLog[]; breakdowns: ExpenseBreakdown[] } => {
  const balances = new Map<string, number>();
  const logs: CalculationLog[] = [];
  const breakdowns = calculateExpenseBreakdowns(data);

  data.members.forEach((member) => balances.set(member.id, 0));

  breakdowns.forEach((breakdown) => {
    const currentPayerBalance = balances.get(breakdown.payerId) ?? 0;
    balances.set(breakdown.payerId, currentPayerBalance + breakdown.amount);

    breakdown.items.forEach((item) => {
      const currentBalance = balances.get(item.memberId) ?? 0;
      balances.set(item.memberId, currentBalance - item.amountOwed);

      const amountPaid = breakdown.payerId === item.memberId ? breakdown.amount : 0;
      logs.push({
        memberId: item.memberId,
        expenseName: breakdown.expenseName,
        formula: item.formula,
        amountOwed: item.amountOwed,
        amountPaid,
        net: amountPaid - item.amountOwed,
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

  return { transfers, logs, breakdowns };
};
