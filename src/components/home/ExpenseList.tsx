import { Edit2, Receipt } from 'lucide-react';
import type { Expense } from '../../types/domain';

interface ExpenseListProps {
  expenses: Expense[];
  getMemberName: (id: string) => string;
  onEditExpense: (expenseId: string) => void;
}

export const ExpenseList = ({
  expenses,
  getMemberName,
  onEditExpense,
}: ExpenseListProps) => {
  return (
    <section>
      <div className="flex justify-between items-end mb-3 px-1">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Receipt size={20} className="text-sky-500" /> 精算項目
        </h2>
        <span className="text-xs text-gray-400">タップして編集</span>
      </div>
      <div className="bg-white rounded-3xl shadow-sm border border-sky-100/50 overflow-hidden">
        {expenses.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">登録なし</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                onClick={() => onEditExpense(expense.id)}
                className="p-4 hover:bg-sky-50 transition-colors cursor-pointer group flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-700">{expense.name}</span>
                    <span className="font-bold text-sky-600">¥{expense.amount.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 flex gap-2">
                    <span>立替: {getMemberName(expense.payerId)}</span>
                    <span>•</span>
                    <span>対象: {expense.ratios.filter((ratio) => ratio.ratio > 0).length}人</span>
                    {expense.isGradientMode && <span className="text-purple-400 font-bold">勾配あり</span>}
                  </div>
                </div>
                <Edit2 size={16} className="text-gray-300 group-hover:text-sky-400 ml-4 transition-colors" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
