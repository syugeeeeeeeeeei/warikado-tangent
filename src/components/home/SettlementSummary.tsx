import { PieChart } from 'lucide-react';
import type { Transfer } from '../../types/domain';

interface SettlementSummaryProps {
  expensesCount: number;
  transfers: Transfer[];
  getMemberName: (id: string) => string;
}

export const SettlementSummary = ({
  expensesCount,
  transfers,
  getMemberName,
}: SettlementSummaryProps) => {
  return (
    <section>
      <div className="flex justify-between items-end mb-3 px-1">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <PieChart size={20} className="text-orange-500" /> 精算結果
        </h2>
      </div>
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-orange-100/50">
        {expensesCount === 0 ? (
          <p className="text-center text-gray-400 text-sm py-4">
            右下の「＋」から精算項目を追加してください
          </p>
        ) : transfers.length === 0 ? (
          <div className="text-center py-4 text-green-600 font-bold">
            🎉 全員の精算が完了しています！
          </div>
        ) : (
          <ul className="space-y-3">
            {transfers.map((transfer, index) => (
              <li
                key={index}
                className="flex items-center justify-between bg-orange-50/50 p-3 rounded-2xl border border-orange-100"
              >
                <div className="font-bold text-gray-700">{getMemberName(transfer.fromMemberId)}</div>
                <div className="flex flex-col items-center px-2">
                  <span className="text-xs font-bold text-orange-600 bg-white px-3 py-1 rounded-full shadow-sm mb-1">
                    ¥{transfer.amount.toLocaleString()}
                  </span>
                  <span className="text-orange-300 text-[10px]">▶︎</span>
                </div>
                <div className="font-bold text-gray-700">{getMemberName(transfer.toMemberId)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
