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

export interface PreviewItem {
  name: string;
  owed: number;
  hasFraction: boolean;
}

const parseRatioValue = (value: RatioValue | undefined) => {
  if (typeof value === 'number') return value;
  return parseInt(String(value ?? ''), 10) || 0;
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

    let editedSum = 0;
    const uneditedIds: string[] = [];

    currentActiveIds.forEach((id) => {
      if (currentEdited[id]) {
        editedSum += parseRatioValue(currentRatios[id]);
      } else {
        uneditedIds.push(id);
      }
    });

    const newRatios = { ...currentRatios };
    const remainingRatio = Math.max(0, 100 - editedSum);

    if (uneditedIds.length > 0) {
      const baseShare = Math.floor(remainingRatio / uneditedIds.length);
      let remainder = remainingRatio % uneditedIds.length;

      uneditedIds.forEach((id) => {
        let share = baseShare;
        if (remainder > 0) {
          share += 1;
          remainder -= 1;
        }
        newRatios[id] = share;
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
      value: Math.max(0, parseRatioValue(currentRatios[id])),
    }));

    const hasZeroMember = entries.some((entry) => entry.value <= 0);
    if (!hasZeroMember) {
      return { ratios: currentRatios, redistributed: false };
    }

    entries.forEach((entry) => {
      if (entry.value <= 0) {
        entry.value = 1;
      }
    });

    let total = entries.reduce((sum, entry) => sum + entry.value, 0);
    const targetTotal = 100;

    while (total > targetTotal) {
      const donors = entries.filter((entry) => entry.value > 1).sort((a, b) => b.value - a.value);
      if (donors.length === 0) break;

      for (const donor of donors) {
        if (total <= targetTotal) break;
        donor.value -= 1;
        total -= 1;
      }
    }

    while (total < targetTotal) {
      const receiver = entries.reduce((max, entry) => (entry.value > max.value ? entry : max), entries[0]);
      receiver.value += 1;
      total += 1;
    }

    const nextRatios = { ...currentRatios };
    entries.forEach((entry) => {
      nextRatios[entry.id] = entry.value;
    });

    return { ratios: nextRatios, redistributed: true };
  };

  const applyRatios = (
    currentActiveIds: string[],
    nextRatios: Record<string, RatioValue>,
    withWarning: boolean,
    avoidZero = true,
  ) => {
    if (!avoidZero) {
      setRatios(nextRatios);
      return;
    }

    const redistributed = redistributeIfAnyZero(currentActiveIds, nextRatios);
    setRatios(redistributed.ratios);

    if (withWarning && redistributed.redistributed) {
      showToast('負担割合0%のメンバーが出たため自動で再分配しました。');
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
    const numericStr = value.replace(/[^0-9]/g, '').replace(/^0+/, '');

    if (numericStr === '') {
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

    let numValue = parseInt(numericStr, 10);
    let otherEditedSum = 0;

    activeIds.forEach((id) => {
      if (id !== memberId && editedRatios[id]) {
        otherEditedSum += parseRatioValue(ratios[id]);
      }
    });

    const maxAllowed = 100 - otherEditedSum;
    if (numValue > maxAllowed) numValue = maxAllowed;

    const newRatios = { ...ratios, [memberId]: numValue };
    const newEditedRatios = { ...editedRatios, [memberId]: true };

    setEditedRatios(newEditedRatios);
    applyRatios(activeIds, calculateUneditedRatios(activeIds, newRatios, newEditedRatios), true);
  };

  const handleRatioBlur = (memberId: string) => {
    const activeIds = getActiveIds();
    const currentValue = ratios[memberId];
    const parsedValue = parseRatioValue(currentValue);

    if (currentValue === '' || parsedValue <= 0) {
      const newEditedRatios = { ...editedRatios, [memberId]: false };
      const clearedRatios = { ...ratios, [memberId]: 0 };

      setEditedRatios(newEditedRatios);
      applyRatios(activeIds, calculateUneditedRatios(activeIds, clearedRatios, newEditedRatios), false);
      return;
    }

    applyRatios(activeIds, { ...ratios }, true);
  };

  const equalizeRatios = () => {
    const activeIds = getActiveIds();
    if (activeIds.length === 0) return;

    if (activeIds.length > 100) {
      showToast('対象メンバーが多いため均等化できません。');
      return;
    }

    const base = Math.floor(100 / activeIds.length);
    let remainder = 100 % activeIds.length;
    const nextRatios = { ...ratios };

    activeIds.forEach((id) => {
      let value = base;
      if (remainder > 0) {
        value += 1;
        remainder -= 1;
      }
      nextRatios[id] = value;
    });

    setEditedRatios({});
    setRatios(nextRatios);
  };

  const saveExpense = () => {
    const numAmount = parseInt(amountStr, 10);
    if (!expenseName || Number.isNaN(numAmount) || numAmount <= 0 || !payerId) return;

    const expenseRatios: ExpenseRatio[] = eventData.members.map((member) => {
      const isTarget = activeTargets[member.id] ?? false;
      if (!isTarget) return { memberId: member.id, ratio: 0 };

      const ratioNum = parseRatioValue(ratios[member.id]);
      const ratioVal = isGradientMode ? ratioNum : 1;

      return { memberId: member.id, ratio: ratioVal };
    });

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
