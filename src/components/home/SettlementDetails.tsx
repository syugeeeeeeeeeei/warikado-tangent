import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CalculationLog, Member } from '../../types/domain';

interface SettlementDetailsProps {
  members: Member[];
  logs: CalculationLog[];
  showDetails: boolean;
  onToggle: () => void;
}

export const SettlementDetails = ({
  members,
  logs,
  showDetails,
  onToggle,
}: SettlementDetailsProps) => {
  return (
    <section>
      <button
        onClick={onToggle}
        className="w-full bg-white border-2 border-orange-50 text-orange-600 font-bold py-3 rounded-2xl hover:bg-orange-50 transition-colors flex justify-center items-center gap-2"
      >
        {showDetails ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        計算の詳細フローを見る
      </button>

      {showDetails && (
        <div className="mt-4 space-y-4 animate-fade-in">
          {members.map((member) => {
            const memberLogs = logs.filter((log) => log.memberId === member.id);
            if (memberLogs.length === 0) return null;

            return (
              <div
                key={member.id}
                className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100"
              >
                <h3 className="font-bold text-gray-800 mb-2 pb-2 border-b border-gray-100">
                  👤 {member.name} さんの明細
                </h3>
                <ul className="space-y-3 mt-3">
                  {memberLogs.map((log, index) => (
                    <li key={index} className="text-sm bg-gray-50 p-3 rounded-xl">
                      <div className="font-bold text-gray-700 mb-1">{log.expenseName}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div>
                          <span className="text-gray-400">負担額: </span>
                          <span className="font-medium text-red-500">¥{log.amountOwed.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">支払済: </span>
                          <span className="font-medium text-green-500">¥{log.amountPaid.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="mt-1 pt-1 border-t border-gray-200 border-dashed text-xs text-gray-400 flex justify-between">
                        <span className="truncate max-w-[60%]">式: {log.formula}</span>
                        <span
                          className={`font-bold ${
                            log.net > 0
                              ? 'text-green-500'
                              : log.net < 0
                                ? 'text-red-500'
                                : 'text-gray-400'
                          }`}
                        >
                          収支: {log.net > 0 ? '+' : ''}
                          {log.net.toLocaleString()}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
