import { useMemo, useState } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { EventData, Expense, ExpenseRatio, ViewState } from '../types/domain';

interface UseExpenseFormParams {
  eventData: EventData;
  setEventData: Dispatch<SetStateAction<EventData>>;
  editingExpenseId: string | null;
  navigateTo: (view: ViewState, id?: string | null) => void;
}

type RatioValue = number | string;

export interface PreviewItem {
  name: string;
  owed: number;
  hasFraction: boolean;
}

export const useExpenseForm = ({
  eventData,
  setEventData,
  editingExpenseId,
  navigateTo,
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

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const normalized = event.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '');
    setAmountStr(normalized);
  };

  const recalculateUneditedRatios = (
    currentActiveIds: string[],
    currentRatios: Record<string, RatioValue>,
    currentEdited: Record<string, boolean>,
  ) => {
    let editedSum = 0;
    const uneditedIds: string[] = [];

    currentActiveIds.forEach((id) => {
      if (currentEdited[id]) {
        const val = currentRatios[id];
        editedSum += typeof val === 'number' ? val : parseInt(String(val), 10) || 0;
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

    setRatios(newRatios);
  };

  const toggleTarget = (memberId: string) => {
    setActiveTargets((prev) => {
      const isCurrentlyActive = prev[memberId] ?? false;
      const nextState = { ...prev, [memberId]: !isCurrentlyActive };
      const activeIds = Object.keys(nextState).filter((id) => nextState[id]);

      setEditedRatios({});
      recalculateUneditedRatios(activeIds, {}, {});

      if (!nextState[fractionBearerId] && activeIds.length > 0) {
        setFractionBearerId(activeIds[0]);
      } else if (activeIds.length === 0) {
        setFractionBearerId('');
      }

      return nextState;
    });
  };

  const handleRatioChange = (memberId: string, value: string) => {
    const activeIds = eventData.members
      .map((member) => member.id)
      .filter((id) => activeTargets[id]);

    const numericStr = value.replace(/[^0-9]/g, '').replace(/^0+/, '');

    if (numericStr === '') {
      const newRatios = { ...ratios, [memberId]: '' };
      const newEditedRatios = { ...editedRatios, [memberId]: true };
      setEditedRatios(newEditedRatios);
      recalculateUneditedRatios(activeIds, newRatios, newEditedRatios);
      return;
    }

    let numValue = parseInt(numericStr, 10);
    let otherEditedSum = 0;

    activeIds.forEach((id) => {
      if (id !== memberId && editedRatios[id]) {
        const val = ratios[id];
        otherEditedSum += typeof val === 'number' ? val : parseInt(String(val), 10) || 0;
      }
    });

    const maxAllowed = 100 - otherEditedSum;
    if (numValue > maxAllowed) numValue = maxAllowed;

    const newRatios = { ...ratios, [memberId]: numValue };
    const newEditedRatios = { ...editedRatios, [memberId]: true };

    setEditedRatios(newEditedRatios);
    recalculateUneditedRatios(activeIds, newRatios, newEditedRatios);
  };

  const saveExpense = () => {
    const numAmount = parseInt(amountStr, 10);
    if (!expenseName || Number.isNaN(numAmount) || numAmount <= 0 || !payerId) return;

    const expenseRatios: ExpenseRatio[] = eventData.members.map((member) => {
      const isTarget = activeTargets[member.id] ?? false;
      if (!isTarget) return { memberId: member.id, ratio: 0 };

      const rawRatio = ratios[member.id];
      const ratioNum =
        typeof rawRatio === 'number' ? rawRatio : parseInt(String(rawRatio), 10) || 0;
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
        const rawRatio = ratios[member.id];
        const ratioNum =
          typeof rawRatio === 'number' ? rawRatio : parseInt(String(rawRatio), 10) || 0;
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
    toggleTarget,
    saveExpense,
    removeExpense,
  };
};
