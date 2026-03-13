import type { CalculationLog, EventData, ExpenseBreakdown, Transfer } from '../types/domain';

// 明細表示用の計算式テキストを生成する。
// 勾配モードでは ratio を割合（%）として、通常モードでは比率合計での按分として表示する。
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

// 各精算項目について「誰がいくら負担したか」の内訳を算出する。
export const calculateExpenseBreakdowns = (data: EventData): ExpenseBreakdown[] => {
  const breakdowns: ExpenseBreakdown[] = [];

  data.expenses.forEach((expense) => {
    // 通常モードでは「ratio>0 を負担対象」として 1 に正規化し、人数割り相当に寄せる。
    const normalizedRatios = expense.ratios.map((ratio) => ({
      memberId: ratio.memberId,
      ratio: expense.isGradientMode ? ratio.ratio : ratio.ratio > 0 ? 1 : 0,
    }));

    const totalRatio = normalizedRatios.reduce((sum, ratio) => sum + ratio.ratio, 0);
    // 負担対象が1人もいない精算項目は計算対象外とする。
    if (totalRatio === 0) return;

    // まず全員の基礎負担額（小数点以下切り捨て）を計算し、後で端数をまとめて配る。
    let totalBaseOwed = 0;
    const baseOweds = new Map<string, number>();

    normalizedRatios.forEach((ratio) => {
      if (ratio.ratio === 0) {
        baseOweds.set(ratio.memberId, 0);
        return;
      }

      const baseOwed = Math.floor(expense.amount * (ratio.ratio / totalRatio));
      baseOweds.set(ratio.memberId, baseOwed);
      totalBaseOwed += baseOwed;
    });

    // 切り捨て合計との差分を端数として扱う。
    const fraction = expense.amount - totalBaseOwed;

    // 指定された端数負担者が無効（対象外/負担0）の場合、最初の有効対象へフォールバックする。
    let actualBearerId = expense.fractionBearerId;
    if (!baseOweds.has(actualBearerId) || baseOweds.get(actualBearerId) === 0) {
      const firstValidRatio = normalizedRatios.find((ratio) => ratio.ratio > 0);
      actualBearerId = firstValidRatio ? firstValidRatio.memberId : expense.payerId;
    }

    // 明細用アイテムを生成。端数は actualBearerId のみ上乗せする。
    const items = normalizedRatios
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

// イベント全体の最終精算（送金リスト）とログを算出する。
export const calculateSettlement = (
  data: EventData,
): { transfers: Transfer[]; logs: CalculationLog[]; breakdowns: ExpenseBreakdown[] } => {
  // 残高ルール:
  // 正: 受け取るべき金額（立替超過）
  // 負: 支払うべき金額（負担超過）
  const balances = new Map<string, number>();
  const logs: CalculationLog[] = [];
  const breakdowns = calculateExpenseBreakdowns(data);

  // まず全メンバーの残高を 0 で初期化する。
  data.members.forEach((member) => balances.set(member.id, 0));

  breakdowns.forEach((breakdown) => {
    // 立替者は支出総額ぶん「受け取る側」に加算。
    const currentPayerBalance = balances.get(breakdown.payerId) ?? 0;
    balances.set(breakdown.payerId, currentPayerBalance + breakdown.amount);

    breakdown.items.forEach((item) => {
      // 各メンバーの負担額を残高から減算（支払う側へ寄せる）。
      const currentBalance = balances.get(item.memberId) ?? 0;
      balances.set(item.memberId, currentBalance - item.amountOwed);

      // payer 自身の明細行では「支払済」に総額を入れて差引残高が追えるようにする。
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
    // 浮動小数誤差を吸収するため、閾値 0.01 未満は 0 とみなす。
    if (balance < -0.01) debtors.push({ id, amount: -balance });
    else if (balance > 0.01) creditors.push({ id, amount: balance });
  });

  // 大きい金額同士から順に突き合わせると送金回数が少なくなる傾向がある。
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let debtorIndex = 0;
  let creditorIndex = 0;

  // 2ポインタで「払う側」と「受け取る側」を順にマッチングする。
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    if (!debtor || !creditor) break;

    // 今回の送金額は双方の残額の小さい方。
    const amount = Math.min(debtor.amount, creditor.amount);

    transfers.push({
      fromMemberId: debtor.id,
      toMemberId: creditor.id,
      // UI と実送金の扱いをシンプルにするため円単位に丸める。
      amount: Math.round(amount),
    });

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) debtorIndex += 1;
    if (creditor.amount < 0.01) creditorIndex += 1;
  }

  return { transfers, logs, breakdowns };
};
