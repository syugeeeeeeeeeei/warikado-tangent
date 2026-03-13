import { useMemo, useState } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { EventData, Expense, ExpenseRatio, ViewState } from '../types/domain';

interface UseExpenseFormParams {
  eventData: EventData;
  setEventData: Dispatch<SetStateAction<EventData>>;
  editingExpenseId: string | null;
  navigateTo: (view: ViewState, id?: string | null) => void;
  showToast: (message: string) => void;
}

type RatioValue = number | string;

interface RatioAdjustmentResult {
  ratios: Record<string, RatioValue>;
  zeroRedistributed: boolean;
  totalNormalized: boolean;
  failed: boolean;
}

export interface PreviewItem {
  name: string;
  owed: number;
  hasFraction: boolean;
}

const RATIO_DECIMAL_PLACES = 2;
const RATIO_SCALE = 10 ** RATIO_DECIMAL_PLACES;
const TOTAL_RATIO_UNITS = 100 * RATIO_SCALE;
const MIN_ACTIVE_RATIO_UNITS = 1 * RATIO_SCALE;

const toRatioUnits = (value: number) => Math.round(value * RATIO_SCALE);

const fromRatioUnits = (units: number) => {
  return Number((units / RATIO_SCALE).toFixed(RATIO_DECIMAL_PLACES));
};

const parseRatioValue = (value: RatioValue | undefined) => {
  if (typeof value === 'number') return value;
  return Number.parseFloat(String(value ?? '').trim()) || 0;
};

const normalizeIntegerPart = (value: string) => {
  const stripped = value.replace(/^0+(?=\d)/, '');
  return stripped === '' ? '0' : stripped;
};

const sanitizeRatioInput = (raw: string) => {
  const dotted = raw.replace(/,/g, '.');
  const onlyAllowed = dotted.replace(/[^0-9.]/g, '');

  if (onlyAllowed === '') return '';

  const dotIndex = onlyAllowed.indexOf('.');
  if (dotIndex === -1) {
    return normalizeIntegerPart(onlyAllowed);
  }

  const intPartRaw = onlyAllowed.slice(0, dotIndex);
  const decimalPart = onlyAllowed
    .slice(dotIndex + 1)
    .replace(/\./g, '')
    .slice(0, RATIO_DECIMAL_PLACES);

  const intPart = intPartRaw === '' ? '0' : normalizeIntegerPart(intPartRaw);

  if (onlyAllowed.endsWith('.') && decimalPart.length === 0) {
    return `${intPart}.`;
  }

  if (decimalPart.length === 0) {
    return intPart;
  }

  return `${intPart}.${decimalPart}`;
};

const formatUnitsAsInput = (units: number): string => {
  const safe = Math.max(0, units);
  if (safe === 0) return '0';

  const value = fromRatioUnits(safe);
  const fixed = value.toFixed(RATIO_DECIMAL_PLACES);
  return fixed.replace(/\.00$/, '').replace(/(\.\d*[1-9])0$/, '$1');
};

export const useExpenseForm = ({
  eventData,
  setEventData,
  editingExpenseId,
  navigateTo,
  showToast,
}: UseExpenseFormParams) => {
  const isEditing = Boolean(editingExpenseId);
  const editingExpense = isEditing
    ? eventData.expenses.find((expense) => expense.id === editingExpenseId)
    : null;

  const [expenseName, setExpenseName] = useState(editingExpense?.name || '');
  const [amountStr, setAmountStr] = useState<string>(
    editingExpense ? editingExpense.amount.toString() : '',
  );
  const [payerId, setPayerId] = useState<string>(
    editingExpense?.payerId || eventData.members[0]?.id || '',
  );
  const [isGradientMode, setIsGradientMode] = useState<boolean>(
    editingExpense?.isGradientMode || false,
  );
  const [fractionBearerId, setFractionBearerId] = useState<string>(
    editingExpense?.fractionBearerId || editingExpense?.payerId || eventData.members[0]?.id || '',
  );

  const initialActiveTargets: Record<string, boolean> = {};
  const initialRatios: Record<string, RatioValue> = {};
  const initialEditedRatios: Record<string, boolean> = {};

  if (editingExpense) {
    editingExpense.ratios.forEach((ratio) => {
      if (ratio.ratio > 0) {
        initialActiveTargets[ratio.memberId] = true;
        initialRatios[ratio.memberId] = ratio.ratio;
        initialEditedRatios[ratio.memberId] = true;
      }
    });
  }

  const [activeTargets, setActiveTargets] = useState<Record<string, boolean>>(
    initialActiveTargets,
  );
  const [ratios, setRatios] = useState<Record<string, RatioValue>>(initialRatios);
  const [editedRatios, setEditedRatios] = useState<Record<string, boolean>>(
    initialEditedRatios,
  );

  const getActiveIds = () => {
    return eventData.members
      .map((member) => member.id)
      .filter((id) => activeTargets[id]);
  };

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const normalized = event.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '');
    setAmountStr(normalized);
  };

  const calculateUneditedRatios = (
    currentActiveIds: string[],
    currentRatios: Record<string, RatioValue>,
    currentEdited: Record<string, boolean>,
  ): Record<string, RatioValue> => {
    if (currentActiveIds.length === 1) {
      return { ...currentRatios, [currentActiveIds[0]]: 100 };
    }

    let editedSumUnits = 0;
    const uneditedIds: string[] = [];

    currentActiveIds.forEach((id) => {
      if (currentEdited[id]) {
        editedSumUnits += toRatioUnits(parseRatioValue(currentRatios[id]));
      } else {
        uneditedIds.push(id);
      }
    });

    const newRatios = { ...currentRatios };
    const remainingUnits = Math.max(0, TOTAL_RATIO_UNITS - editedSumUnits);

    if (uneditedIds.length > 0) {
      const baseUnits = Math.floor(remainingUnits / uneditedIds.length);
      let remainder = remainingUnits % uneditedIds.length;

      uneditedIds.forEach((id) => {
        let units = baseUnits;
        if (remainder > 0) {
          units += 1;
          remainder -= 1;
        }
        newRatios[id] = fromRatioUnits(units);
      });
    }

    return newRatios;
  };

  const redistributeIfAnyZero = (
    currentActiveIds: string[],
    currentRatios: Record<string, RatioValue>,
  ): { ratios: Record<string, RatioValue>; redistributed: boolean } => {
    if (currentActiveIds.length <= 1 || currentActiveIds.length > 100) {
      return { ratios: currentRatios, redistributed: false };
    }

    const entries = currentActiveIds.map((id) => ({
      id,
      valueUnits: Math.max(0, toRatioUnits(parseRatioValue(currentRatios[id]))),
    }));

    const hasZeroMember = entries.some((entry) => entry.valueUnits <= 0);
    if (!hasZeroMember) {
      return { ratios: currentRatios, redistributed: false };
    }

    entries.forEach((entry) => {
      if (entry.valueUnits <= 0) {
        entry.valueUnits = MIN_ACTIVE_RATIO_UNITS;
      }
    });

    let totalUnits = entries.reduce((sum, entry) => sum + entry.valueUnits, 0);

    while (totalUnits > TOTAL_RATIO_UNITS) {
      const donors = entries
        .filter((entry) => entry.valueUnits > MIN_ACTIVE_RATIO_UNITS)
        .sort((a, b) => b.valueUnits - a.valueUnits);

      if (donors.length === 0) break;

      for (const donor of donors) {
        if (totalUnits <= TOTAL_RATIO_UNITS) break;
        const reducible = donor.valueUnits - MIN_ACTIVE_RATIO_UNITS;
        if (reducible <= 0) continue;

        const diff = Math.min(reducible, totalUnits - TOTAL_RATIO_UNITS);
        donor.valueUnits -= diff;
        totalUnits -= diff;
      }
    }

    while (totalUnits < TOTAL_RATIO_UNITS) {
      const receiver = entries.reduce((max, entry) =>
        entry.valueUnits > max.valueUnits ? entry : max,
      entries[0]);
      receiver.valueUnits += 1;
      totalUnits += 1;
    }

    const nextRatios = { ...currentRatios };
    entries.forEach((entry) => {
      nextRatios[entry.id] = fromRatioUnits(entry.valueUnits);
    });

    return { ratios: nextRatios, redistributed: true };
  };

  const normalizeTotalToHundred = (
    currentActiveIds: string[],
    currentRatios: Record<string, RatioValue>,
    preferredId?: string,
  ): { ratios: Record<string, RatioValue>; normalized: boolean; failed: boolean } => {
    if (currentActiveIds.length === 0) {
      return { ratios: currentRatios, normalized: false, failed: false };
    }

    if (currentActiveIds.length === 1) {
      return {
        ratios: { ...currentRatios, [currentActiveIds[0]]: 100 },
        normalized: parseRatioValue(currentRatios[currentActiveIds[0]]) !== 100,
        failed: false,
      };
    }

    if (currentActiveIds.length > 100) {
      return { ratios: currentRatios, normalized: false, failed: true };
    }

    const entries = currentActiveIds.map((id) => ({
      id,
      valueUnits: Math.max(MIN_ACTIVE_RATIO_UNITS, toRatioUnits(parseRatioValue(currentRatios[id]))),
    }));

    const originalTotal = entries.reduce((sum, entry) => sum + entry.valueUnits, 0);
    let totalUnits = originalTotal;

    if (totalUnits < TOTAL_RATIO_UNITS) {
      const receiver =
        entries.find((entry) => entry.id === preferredId) ??
        entries.reduce((max, entry) =>
          entry.valueUnits > max.valueUnits ? entry : max,
        entries[0]);
      receiver.valueUnits += TOTAL_RATIO_UNITS - totalUnits;
      totalUnits = TOTAL_RATIO_UNITS;
    }

    if (totalUnits > TOTAL_RATIO_UNITS) {
      let excess = totalUnits - TOTAL_RATIO_UNITS;
      const preferredEntry = preferredId
        ? entries.find((entry) => entry.id === preferredId)
        : undefined;

      const donors = [
        ...(preferredEntry ? [preferredEntry] : []),
        ...entries
          .filter((entry) => entry.id !== preferredEntry?.id)
          .sort((a, b) => b.valueUnits - a.valueUnits),
      ];

      for (const donor of donors) {
        if (excess <= 0) break;
        const reducible = donor.valueUnits - MIN_ACTIVE_RATIO_UNITS;
        if (reducible <= 0) continue;

        const diff = Math.min(reducible, excess);
        donor.valueUnits -= diff;
        excess -= diff;
      }

      if (excess > 0) {
        return { ratios: currentRatios, normalized: false, failed: true };
      }
    }

    const nextRatios = { ...currentRatios };
    entries.forEach((entry) => {
      nextRatios[entry.id] = fromRatioUnits(entry.valueUnits);
    });

    return {
      ratios: nextRatios,
      normalized: originalTotal !== TOTAL_RATIO_UNITS,
      failed: false,
    };
  };

  const adjustRatios = (
    currentActiveIds: string[],
    sourceRatios: Record<string, RatioValue>,
    preferredId?: string,
  ): RatioAdjustmentResult => {
    const zeroAdjusted = redistributeIfAnyZero(currentActiveIds, sourceRatios);
    const totalAdjusted = normalizeTotalToHundred(
      currentActiveIds,
      zeroAdjusted.ratios,
      preferredId,
    );

    return {
      ratios: totalAdjusted.ratios,
      zeroRedistributed: zeroAdjusted.redistributed,
      totalNormalized: totalAdjusted.normalized,
      failed: totalAdjusted.failed,
    };
  };

  const applyRatios = (
    currentActiveIds: string[],
    nextRatios: Record<string, RatioValue>,
    withWarning: boolean,
    avoidZero = true,
    preferredId?: string,
  ) => {
    if (!avoidZero) {
      setRatios(nextRatios);
      return;
    }

    const adjusted = adjustRatios(currentActiveIds, nextRatios, preferredId);
    setRatios(adjusted.ratios);

    if (!withWarning) return;

    if (adjusted.zeroRedistributed && adjusted.totalNormalized) {
      showToast('負担割合0%のメンバーが出たため、合計100%になるよう自動で再分配しました。');
      return;
    }

    if (adjusted.zeroRedistributed) {
      showToast('負担割合0%のメンバーが出たため自動で再分配しました。');
      return;
    }

    if (adjusted.totalNormalized) {
      showToast('負担割合の合計が100%でなかったため自動で補正しました。');
    }
  };

  const toggleTarget = (memberId: string) => {
    setActiveTargets((prev) => {
      const isCurrentlyActive = prev[memberId] ?? false;
      const nextState = { ...prev, [memberId]: !isCurrentlyActive };
      const activeIds = Object.keys(nextState).filter((id) => nextState[id]);

      setEditedRatios({});
      applyRatios(activeIds, calculateUneditedRatios(activeIds, {}, {}), false);

      if (!nextState[fractionBearerId] && activeIds.length > 0) {
        setFractionBearerId(activeIds[0]);
      } else if (activeIds.length === 0) {
        setFractionBearerId('');
      }

      return nextState;
    });
  };

  const handleRatioChange = (memberId: string, value: string) => {
    const activeIds = getActiveIds();
    const sanitized = sanitizeRatioInput(value);

    if (sanitized === '') {
      const newRatios = { ...ratios, [memberId]: '' };
      const newEditedRatios = { ...editedRatios, [memberId]: true };
      setEditedRatios(newEditedRatios);
      applyRatios(
        activeIds,
        calculateUneditedRatios(activeIds, newRatios, newEditedRatios),
        false,
        false,
      );
      return;
    }

    const inputUnits = toRatioUnits(parseRatioValue(sanitized));
    let otherEditedUnits = 0;

    activeIds.forEach((id) => {
      if (id !== memberId && editedRatios[id]) {
        otherEditedUnits += toRatioUnits(parseRatioValue(ratios[id]));
      }
    });

    const maxAllowedUnits = Math.max(0, TOTAL_RATIO_UNITS - otherEditedUnits);
    const nextInput =
      inputUnits > maxAllowedUnits
        ? formatUnitsAsInput(maxAllowedUnits)
        : sanitized;
    const newRatios = { ...ratios, [memberId]: nextInput };
    const newEditedRatios = { ...editedRatios, [memberId]: true };

    setEditedRatios(newEditedRatios);
    applyRatios(
      activeIds,
      calculateUneditedRatios(activeIds, newRatios, newEditedRatios),
      false,
      false,
    );
  };

  const handleRatioBlur = (memberId: string) => {
    const activeIds = getActiveIds();
    const currentValue = ratios[memberId];
    const parsedValue = parseRatioValue(currentValue);

    if (currentValue === '' || parsedValue <= 0) {
      const newEditedRatios = { ...editedRatios, [memberId]: false };
      const clearedRatios = { ...ratios, [memberId]: 0 };

      setEditedRatios(newEditedRatios);
      applyRatios(
        activeIds,
        calculateUneditedRatios(activeIds, clearedRatios, newEditedRatios),
        true,
        true,
        memberId,
      );
      return;
    }

    applyRatios(
      activeIds,
      calculateUneditedRatios(activeIds, { ...ratios }, { ...editedRatios }),
      true,
      true,
      memberId,
    );
  };

  const equalizeRatios = () => {
    const activeIds = getActiveIds();
    if (activeIds.length === 0) return;

    if (activeIds.length > 100) {
      showToast('対象メンバーが多いため均等化できません。');
      return;
    }

    const baseUnits = Math.floor(TOTAL_RATIO_UNITS / activeIds.length);
    let remainder = TOTAL_RATIO_UNITS % activeIds.length;
    const nextRatios = { ...ratios };

    activeIds.forEach((id) => {
      let units = baseUnits;
      if (remainder > 0) {
        units += 1;
        remainder -= 1;
      }
      nextRatios[id] = fromRatioUnits(units);
    });

    setEditedRatios({});
    setRatios(nextRatios);
  };

  const saveExpense = () => {
    const numAmount = parseInt(amountStr, 10);
    if (!expenseName || Number.isNaN(numAmount) || numAmount <= 0 || !payerId) return;
    const activeIds = getActiveIds();

    const recalculated = calculateUneditedRatios(activeIds, { ...ratios }, { ...editedRatios });
    const adjusted = adjustRatios(activeIds, recalculated, activeIds[0]);
    const finalizedRatios = adjusted.ratios;

    setRatios(finalizedRatios);

    if (adjusted.zeroRedistributed && adjusted.totalNormalized) {
      showToast('負担割合0%のメンバーが出たため、合計100%になるよう自動で再分配しました。');
    } else if (adjusted.zeroRedistributed) {
      showToast('負担割合0%のメンバーが出たため自動で再分配しました。');
    } else if (adjusted.totalNormalized) {
      showToast('負担割合の合計が100%でなかったため自動で補正しました。');
    }

    if (adjusted.failed) {
      alert('負担割合を100%に補正できませんでした。入力内容を見直してください。');
      return;
    }

    const expenseRatios: ExpenseRatio[] = eventData.members.map((member) => {
      const isTarget = activeTargets[member.id] ?? false;
      if (!isTarget) return { memberId: member.id, ratio: 0 };

      const ratioNum = fromRatioUnits(toRatioUnits(parseRatioValue(finalizedRatios[member.id])));
      const ratioVal = isGradientMode ? ratioNum : Math.max(ratioNum, 1);

      return { memberId: member.id, ratio: ratioVal };
    });

    if (isGradientMode) {
      const activeTotalUnits = expenseRatios
        .filter((ratio) => activeIds.includes(ratio.memberId))
        .reduce((acc, ratio) => acc + toRatioUnits(ratio.ratio), 0);

      if (activeIds.length > 0 && activeTotalUnits !== TOTAL_RATIO_UNITS) {
        alert('負担割合の合計が100%ではないため保存できません。');
        return;
      }
    }

    if (expenseRatios.reduce((acc, ratio) => acc + ratio.ratio, 0) === 0) {
      alert('負担対象者がいない、または勾配の合計が0です。');
      return;
    }

    const newExpense: Expense = {
      id: isEditing && editingExpenseId ? editingExpenseId : crypto.randomUUID(),
      name: expenseName,
      amount: numAmount,
      payerId,
      ratios: expenseRatios,
      isGradientMode,
      fractionBearerId,
    };

    if (isEditing) {
      setEventData({
        ...eventData,
        expenses: eventData.expenses.map((expense) =>
          expense.id === editingExpenseId ? newExpense : expense,
        ),
      });
    } else {
      setEventData({
        ...eventData,
        expenses: [...eventData.expenses, newExpense],
      });
    }

    navigateTo('home');
  };

  const removeExpense = () => {
    if (!isEditing || !editingExpenseId) return;

    setEventData({
      ...eventData,
      expenses: eventData.expenses.filter((expense) => expense.id !== editingExpenseId),
    });

    navigateTo('home');
  };

  const previewData = useMemo<PreviewItem[] | null>(() => {
    if (eventData.members.length === 0) return null;

    const numAmount = parseInt(amountStr, 10) || 0;
    if (numAmount === 0) return null;

    const targets = eventData.members
      .filter((member) => activeTargets[member.id])
      .map((member) => {
        const ratioNum = parseRatioValue(ratios[member.id]);
        const ratio = isGradientMode ? ratioNum : 1;

        return {
          id: member.id,
          name: member.name,
          ratio,
          baseOwed: 0,
          finalOwed: 0,
        };
      });

    const totalRatio = targets.reduce((acc, target) => acc + target.ratio, 0);
    if (totalRatio === 0) return null;

    let totalBaseOwed = 0;
    targets.forEach((target) => {
      if (target.ratio > 0) {
        target.baseOwed = Math.floor(numAmount * (target.ratio / totalRatio));
        totalBaseOwed += target.baseOwed;
        target.finalOwed = target.baseOwed;
      }
    });

    const fraction = numAmount - totalBaseOwed;

    let bearer = targets.find((target) => target.id === fractionBearerId && target.ratio > 0);
    if (!bearer && targets.some((target) => target.ratio > 0)) {
      bearer = targets.find((target) => target.ratio > 0);
    }

    if (bearer) {
      bearer.finalOwed += fraction;
    }

    return targets
      .filter((target) => target.ratio > 0)
      .map((target) => ({
        name: target.name,
        owed: target.finalOwed,
        hasFraction: target.id === bearer?.id && fraction > 0,
      }));
  }, [amountStr, activeTargets, eventData.members, fractionBearerId, isGradientMode, ratios]);

  const isSaveDisabled =
    !expenseName ||
    !amountStr ||
    parseInt(amountStr, 10) <= 0 ||
    !payerId ||
    Object.values(activeTargets).filter(Boolean).length === 0;

  return {
    isEditing,
    expenseName,
    amountStr,
    payerId,
    isGradientMode,
    fractionBearerId,
    activeTargets,
    editedRatios,
    ratios,
    previewData,
    isSaveDisabled,
    setExpenseName,
    setPayerId,
    setIsGradientMode,
    setFractionBearerId,
    handleAmountChange,
    handleRatioChange,
    handleRatioBlur,
    equalizeRatios,
    toggleTarget,
    saveExpense,
    removeExpense,
  };
};
