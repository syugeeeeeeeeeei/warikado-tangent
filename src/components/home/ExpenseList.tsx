import { Edit2, PlusCircle, Receipt } from 'lucide-react';
import { useState } from 'react';
import type { Expense } from '../../types/domain';

interface ExpenseListProps {
  expenses: Expense[];
  getMemberName: (id: string) => string;
  onEditExpense: (expenseId: string) => void;
  onAddExpense: () => void;
}

const TARGET_MEMBER_LAYOUT = {
  pageSize: 5,
  maxColumns: 5,
  minColumnWidthRem: 1.5,
} as const;

const getTargetGridStyle = (memberCount: number) => {
  const columnCount = Math.max(
    1,
    Math.min(TARGET_MEMBER_LAYOUT.maxColumns, memberCount),
  );

  return {
    gridTemplateColumns: `repeat(${columnCount}, ${TARGET_MEMBER_LAYOUT.minColumnWidthRem}rem)`,
    justifyContent: 'start',
  };
};

const getNameInitial = (name: string) => {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0] : '?';
};

export const ExpenseList = ({
  expenses,
  getMemberName,
  onEditExpense,
  onAddExpense,
}: ExpenseListProps) => {
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  const getVisibleCount = (expenseId: string, total: number) => {
    const current = visibleCounts[expenseId] ?? TARGET_MEMBER_LAYOUT.pageSize;
    return Math.min(current, total);
  };

  const showMoreMembers = (expenseId: string, total: number) => {
    setVisibleCounts((prev) => ({
      ...prev,
      [expenseId]: Math.min(
        total,
        (prev[expenseId] ?? TARGET_MEMBER_LAYOUT.pageSize) + TARGET_MEMBER_LAYOUT.pageSize,
      ),
    }));
  };

  const collapseMembers = (expenseId: string) => {
    setVisibleCounts((prev) => ({
      ...prev,
      [expenseId]: TARGET_MEMBER_LAYOUT.pageSize,
    }));
  };

  return (
    <section>
      <div className="flex justify-between items-end mb-3 px-1">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Receipt size={20} className="text-sky-500" /> 精算項目
        </h2>
        <button
          onClick={onAddExpense}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-white border border-sky-300 shadow-sm px-3.5 py-1.5 rounded-full hover:bg-sky-50 hover:shadow active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-sky-200"
        >
          <PlusCircle size={13} />
          登録する
        </button>
      </div>
      <div>
        {expenses.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">登録なし</p>
        ) : (
          <ul className="space-y-2">
            {expenses.map((expense) => {
              const targetIds = expense.ratios
                .filter((ratio) => ratio.ratio > 0)
                .map((ratio) => ratio.memberId);

              const orderMap = new Map<string, number>();
              targetIds.forEach((id, index) => orderMap.set(id, index));

              const prioritizedTargetIds = [...targetIds].sort((a, b) => {
                const aPriority = a === expense.payerId ? 0 : a === expense.fractionBearerId ? 1 : 2;
                const bPriority = b === expense.payerId ? 0 : b === expense.fractionBearerId ? 1 : 2;

                if (aPriority !== bPriority) return aPriority - bPriority;

                return (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0);
              });

              const visibleCount = getVisibleCount(expense.id, prioritizedTargetIds.length);
              const visibleTargetIds = prioritizedTargetIds.slice(0, visibleCount);
              const hasMoreMembers = visibleCount < prioritizedTargetIds.length;
              const canCollapse =
                prioritizedTargetIds.length > TARGET_MEMBER_LAYOUT.pageSize &&
                visibleCount >= prioritizedTargetIds.length;

              return (
                <li
                  key={expense.id}
                  onClick={() => onEditExpense(expense.id)}
                  className="bg-white p-3 rounded-2xl border border-sky-100/70 hover:bg-sky-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-gray-700 truncate">{expense.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                        立替: {getMemberName(expense.payerId)}
                        <span className="mx-1">・</span>
                        端数: {getMemberName(expense.fractionBearerId)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      {expense.isGradientMode && (
                        <span className="text-[9px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full">
                          勾配あり
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sky-600">¥{expense.amount.toLocaleString()}</span>
                        <Edit2
                          size={15}
                          className="text-gray-300 group-hover:text-sky-400 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <div>
                      <div className="text-[10px] text-gray-400">対象メンバー</div>
                      <div
                        className="grid gap-x-1 gap-y-1 w-fit"
                        style={getTargetGridStyle(visibleTargetIds.length)}
                      >
                        {visibleTargetIds.map((memberId) => {
                          const memberName = getMemberName(memberId);

                          return (
                            <div
                              key={`${expense.id}-${memberId}`}
                              className="flex items-center justify-center"
                              title={memberName}
                            >
                              <div className="w-6 h-6 rounded-full bg-sky-50 border border-sky-200 text-sky-700 font-extrabold text-[9px] flex items-center justify-center">
                                {getNameInitial(memberName)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {(hasMoreMembers || canCollapse) && (
                      <div className="ml-auto mt-[14px] flex items-center">
                        {hasMoreMembers ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              showMoreMembers(expense.id, prioritizedTargetIds.length);
                            }}
                            className="text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2.5 py-0.5 hover:bg-sky-100 transition-colors"
                          >
                            ...もっと見る（次の
                            {Math.min(
                              TARGET_MEMBER_LAYOUT.pageSize,
                              prioritizedTargetIds.length - visibleCount,
                            )}
                            人）
                          </button>
                        ) : (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              collapseMembers(expense.id);
                            }}
                            className="text-[11px] font-bold text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2.5 py-0.5 hover:bg-gray-200 transition-colors"
                          >
                            折りたたむ
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
