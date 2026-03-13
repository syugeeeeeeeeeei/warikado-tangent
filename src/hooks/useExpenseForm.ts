import { useMemo, useState } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { EventData, Expense, ExpenseRatio, ViewState } from '../types/domain';
import { createShortSequentialId } from '../utils/id';

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

// 比率入力は小数第2位までを扱う（1.23% まで）。
const RATIO_DECIMAL_PLACES = 2;
const RATIO_SCALE = 10 ** RATIO_DECIMAL_PLACES;
const TOTAL_RATIO_UNITS = 100 * RATIO_SCALE;
// 負担対象として有効な最小値（=1.00%）。
const MIN_ACTIVE_RATIO_UNITS = 1 * RATIO_SCALE;

// パーセント値を整数ユニットへ変換し、誤差を制御しやすくする。
const toRatioUnits = (value: number) => Math.round(value * RATIO_SCALE);

const fromRatioUnits = (units: number) => {
  return Number((units / RATIO_SCALE).toFixed(RATIO_DECIMAL_PLACES));
};

// RatioValue(number|string) を安全に number 化する。
const parseRatioValue = (value: RatioValue | undefined) => {
  if (typeof value === 'number') return value;
  return Number.parseFloat(String(value ?? '').trim()) || 0;
};

// 先頭ゼロを整形して入力表現を安定させる（例: 0008 -> 8）。
const normalizeIntegerPart = (value: string) => {
  const stripped = value.replace(/^0+(?=\d)/, '');
  return stripped === '' ? '0' : stripped;
};

// ユーザー入力を「数字と小数点のみ」に制限し、小数桁数も上限をかける。
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

// ユニット値を入力欄表示用の文字列へ変換（不要な末尾ゼロを削る）。
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
  // 編集モード時は既存精算項目を読み出して初期値に使う。
  const isEditing = Boolean(editingExpenseId);
  const editingExpense = isEditing
    ? eventData.expenses.find((expense) => expense.id === editingExpenseId)
    : null;

  // 入力フォーム state 群。
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

  // 編集時に既存データから負担対象・比率・編集済みフラグを復元する。
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

  // 現在「負担対象として有効なメンバー ID 一覧」を返す。
  const getActiveIds = () => {
    return eventData.members
      .map((member) => member.id)
      .filter((id) => activeTargets[id]);
  };

  // 金額は整数円のみ扱うため、数字以外と先頭ゼロを除去する。
  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const normalized = event.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '');
    setAmountStr(normalized);
  };

  // 「編集済みメンバーを固定しつつ、未編集メンバーへ残り比率を配る」計算。
  const calculateUneditedRatios = (
    currentActiveIds: string[],
    currentRatios: Record<string, RatioValue>,
    currentEdited: Record<string, boolean>,
  ): Record<string, RatioValue> => {
    // 対象が1人なら必ず 100%。
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

    // 未編集メンバーへ均等配分し、余りは先頭から 1 ユニットずつ載せる。
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

  // 負担対象に 0% が発生したとき、最低 1.00% を割り当てるための再配分。
  const redistributeIfAnyZero = (
    currentActiveIds: string[],
    currentRatios: Record<string, RatioValue>,
  ): { ratios: Record<string, RatioValue>; redistributed: boolean } => {
    // 1人以下は再配分不要。100人超は最小比率制約と両立しないため対象外。
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

    // まず 0 以下の人を最小比率へ引き上げる。
    entries.forEach((entry) => {
      if (entry.valueUnits <= 0) {
        entry.valueUnits = MIN_ACTIVE_RATIO_UNITS;
      }
    });

    let totalUnits = entries.reduce((sum, entry) => sum + entry.valueUnits, 0);

    // 合計が 100% を超えた分は、余裕のある人（最小比率より上）から差し引く。
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

    // 合計が 100% 未満なら、最大比率の人へ 1 ユニットずつ戻して調整する。
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

  // 比率合計を 100% に正規化する。必要なら preferredId を優先して増減に使う。
  const normalizeTotalToHundred = (
    currentActiveIds: string[],
    currentRatios: Record<string, RatioValue>,
    preferredId?: string,
  ): { ratios: Record<string, RatioValue>; normalized: boolean; failed: boolean } => {
    if (currentActiveIds.length === 0) {
      return { ratios: currentRatios, normalized: false, failed: false };
    }

    // 対象1人時は常に 100%。
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

    // 最小比率制約を保ったままユニット化して計算する。
    const entries = currentActiveIds.map((id) => ({
      id,
      valueUnits: Math.max(MIN_ACTIVE_RATIO_UNITS, toRatioUnits(parseRatioValue(currentRatios[id]))),
    }));

    const originalTotal = entries.reduce((sum, entry) => sum + entry.valueUnits, 0);
    let totalUnits = originalTotal;

    // 不足分は preferredId（なければ最大比率）へ寄せる。
    if (totalUnits < TOTAL_RATIO_UNITS) {
      const receiver =
        entries.find((entry) => entry.id === preferredId) ??
        entries.reduce((max, entry) =>
          entry.valueUnits > max.valueUnits ? entry : max,
        entries[0]);
      receiver.valueUnits += TOTAL_RATIO_UNITS - totalUnits;
      totalUnits = TOTAL_RATIO_UNITS;
    }

    // 超過分は preferredId 優先、その後は大きい比率から順に削る。
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

      // 最小比率制約により削り切れない場合は失敗として扱う。
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

  // 0% 再配分 -> 合計100%補正をまとめて実行するユーティリティ。
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

  // 比率 state へ適用し、必要時に自動補正の通知も行う。
  const applyRatios = (
    currentActiveIds: string[],
    nextRatios: Record<string, RatioValue>,
    withWarning: boolean,
    avoidZero = true,
    preferredId?: string,
  ) => {
    // avoidZero=false は入力途中（空文字など）で補正をかけないためのモード。
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

  // 負担対象メンバーの ON/OFF。
  const toggleTarget = (memberId: string) => {
    setActiveTargets((prev) => {
      const isCurrentlyActive = prev[memberId] ?? false;
      const nextState = { ...prev, [memberId]: !isCurrentlyActive };
      const activeIds = Object.keys(nextState).filter((id) => nextState[id]);

      // 対象集合が変わると比率の意味が変わるため、編集済み状態はリセットして再計算する。
      setEditedRatios({});
      applyRatios(activeIds, calculateUneditedRatios(activeIds, {}, {}), false);

      // 端数負担者が対象外になった場合は有効メンバーへフォールバックする。
      if (!nextState[fractionBearerId] && activeIds.length > 0) {
        setFractionBearerId(activeIds[0]);
      } else if (activeIds.length === 0) {
        setFractionBearerId('');
      }

      return nextState;
    });
  };

  // 個別比率入力時のハンドラ。入力値を sanitization したうえで未編集分を再配分する。
  const handleRatioChange = (memberId: string, value: string) => {
    const activeIds = getActiveIds();
    const sanitized = sanitizeRatioInput(value);

    // 空入力は一時的に許容し、blur 時に最終補正する。
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

    // 他メンバーの編集済み比率を固定したときの残り上限を算出する。
    activeIds.forEach((id) => {
      if (id !== memberId && editedRatios[id]) {
        otherEditedUnits += toRatioUnits(parseRatioValue(ratios[id]));
      }
    });

    const maxAllowedUnits = Math.max(0, TOTAL_RATIO_UNITS - otherEditedUnits);
    // 上限超過入力は自動で丸める。
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

  // 比率入力欄を離れたタイミングで 0%/合計100% 補正を確定させる。
  const handleRatioBlur = (memberId: string) => {
    const activeIds = getActiveIds();
    const currentValue = ratios[memberId];
    const parsedValue = parseRatioValue(currentValue);

    // 空欄や 0 以下は「未編集扱い」に戻して再配分する。
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

    // 通常時も blur で最終的な補正を反映する。
    applyRatios(
      activeIds,
      calculateUneditedRatios(activeIds, { ...ratios }, { ...editedRatios }),
      true,
      true,
      memberId,
    );
  };

  // 勾配モードの比率を均等化する。
  const equalizeRatios = () => {
    const activeIds = getActiveIds();
    if (activeIds.length === 0) return;

    if (activeIds.length > 100) {
      showToast('対象メンバーが多いため均等化できません。');
      return;
    }

    // 100% を整数ユニットで均等に割り、余りは先頭から配る。
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

  // 入力検証 -> 比率確定 -> EventData 更新を行う保存処理。
  const saveExpense = () => {
    const numAmount = parseInt(amountStr, 10);
    if (!expenseName || Number.isNaN(numAmount) || numAmount <= 0 || !payerId) return;
    const activeIds = getActiveIds();

    // 保存直前に未編集分再配分と最終補正を実行する。
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

    // 全メンバー分の ratios を作成し、対象外は 0 にする。
    const expenseRatios: ExpenseRatio[] = eventData.members.map((member) => {
      const isTarget = activeTargets[member.id] ?? false;
      if (!isTarget) return { memberId: member.id, ratio: 0 };

      // 非勾配モードでは ratio>0 のみ意味があるため最低 1 を担保する。
      const ratioNum = fromRatioUnits(toRatioUnits(parseRatioValue(finalizedRatios[member.id])));
      const ratioVal = isGradientMode ? ratioNum : Math.max(ratioNum, 1);

      return { memberId: member.id, ratio: ratioVal };
    });

    // 勾配モードは総和100%を厳密チェックする。
    if (isGradientMode) {
      const activeTotalUnits = expenseRatios
        .filter((ratio) => activeIds.includes(ratio.memberId))
        .reduce((acc, ratio) => acc + toRatioUnits(ratio.ratio), 0);

      if (activeIds.length > 0 && activeTotalUnits !== TOTAL_RATIO_UNITS) {
        alert('負担割合の合計が100%ではないため保存できません。');
        return;
      }
    }

    // 全員 0 は不正（対象者なし）として保存不可。
    if (expenseRatios.reduce((acc, ratio) => acc + ratio.ratio, 0) === 0) {
      alert('負担対象者がいない、または勾配の合計が0です。');
      return;
    }

    const newExpense: Expense = {
      id:
        isEditing && editingExpenseId
          ? editingExpenseId
          : createShortSequentialId(
              'e',
              eventData.expenses.map((expense) => expense.id),
            ),
      name: expenseName,
      amount: numAmount,
      payerId,
      ratios: expenseRatios,
      isGradientMode,
      fractionBearerId,
    };

    // 編集時は置換、新規時は末尾追加。
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

    // 保存完了後はホームへ戻す。
    navigateTo('home');
  };

  // 編集対象の精算項目を削除する。
  const removeExpense = () => {
    if (!isEditing || !editingExpenseId) return;

    setEventData({
      ...eventData,
      expenses: eventData.expenses.filter((expense) => expense.id !== editingExpenseId),
    });

    navigateTo('home');
  };

  // フォーム入力中のプレビュー内訳を計算する（保存前でも確認可能）。
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

    // 勾配モードでは比率合計、通常モードでは対象人数が分母になる。
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

    // 切り捨てで生じた端数を負担者へ付与する。
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
        // 表示上、端数が載った行をバッジで区別する。
        hasFraction: target.id === bearer?.id && fraction > 0,
      }));
  }, [amountStr, activeTargets, eventData.members, fractionBearerId, isGradientMode, ratios]);

  // 保存ボタンの活性条件。
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
