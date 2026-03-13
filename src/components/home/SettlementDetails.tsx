import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ExpenseBreakdown, Member, Transfer } from '../../types/domain';

interface SettlementDetailsProps {
  members: Member[];
  transfers: Transfer[];
  breakdowns: ExpenseBreakdown[];
  getMemberName: (id: string) => string;
  showDetails: boolean;
  onToggle: () => void;
}

interface PayEntry {
  expenseId: string;
  expenseName: string;
  toMemberId: string;
  amount: number;
  formula: string;
}

interface ReceiveEntry {
  expenseId: string;
  expenseName: string;
  fromMemberId: string;
  amount: number;
}

interface TotalResultEntry {
  counterpartId: string;
  amount: number;
}

export const SettlementDetails = ({
  members,
  transfers,
  breakdowns,
  getMemberName,
  showDetails,
  onToggle,
}: SettlementDetailsProps) => {
  // null は「全表示モード」を意味する。空配列は「全解除」。
  const [manualSelectedMemberIds, setManualSelectedMemberIds] = useState<string[] | null>(null);

  // 現在存在するメンバー ID 一覧。
  const allMemberIds = useMemo(() => members.map((member) => member.id), [members]);

  // メンバー変更で存在しない ID が残らないように選択集合を正規化する。
  const selectedMemberIds = useMemo(() => {
    if (manualSelectedMemberIds === null) return allMemberIds;

    const memberSet = new Set(allMemberIds);
    return manualSelectedMemberIds.filter((id) => memberSet.has(id));
  }, [manualSelectedMemberIds, allMemberIds]);

  // 描画時の検索を O(1) にするため Set 化。
  const selectedSet = useMemo(() => new Set(selectedMemberIds), [selectedMemberIds]);

  // 1メンバーずつ選択トグル。
  const toggleMemberSelection = (memberId: string) => {
    setManualSelectedMemberIds((prev) => {
      const currentSelected = prev === null ? allMemberIds : prev;

      if (currentSelected.includes(memberId)) {
        return currentSelected.filter((id) => id !== memberId);
      }

      return [...currentSelected, memberId];
    });
  };

  // メンバーごとの「支払う/受け取る/最終結果」詳細を組み立てる。
  const detailByMember = useMemo(() => {
    return members.map((member) => {
      const payEntries: PayEntry[] = [];
      const receiveEntries: ReceiveEntry[] = [];
      const payTotalMap = new Map<string, number>();
      const receiveTotalMap = new Map<string, number>();
      // 最終精算の相手ごと差額（+なら受取、-なら支払）。
      const transferMap = new Map<string, number>();

      breakdowns.forEach((breakdown) => {
        // 自分の負担分は「支払う額」に積む。
        const ownItem = breakdown.items.find((item) => item.memberId === member.id);

        if (ownItem) {
          payEntries.push({
            expenseId: breakdown.expenseId,
            expenseName: breakdown.expenseName,
            toMemberId: breakdown.payerId,
            amount: ownItem.amountOwed,
            formula: ownItem.formula,
          });
          const current = payTotalMap.get(breakdown.payerId) ?? 0;
          payTotalMap.set(breakdown.payerId, current + ownItem.amountOwed);
        }

        // 自分が立替者なら、他メンバー分は「受け取る額」に積む。
        if (breakdown.payerId === member.id) {
          breakdown.items.forEach((item) => {
            if (item.memberId === member.id) return;

            receiveEntries.push({
              expenseId: breakdown.expenseId,
              expenseName: breakdown.expenseName,
              fromMemberId: item.memberId,
              amount: item.amountOwed,
            });
            const current = receiveTotalMap.get(item.memberId) ?? 0;
            receiveTotalMap.set(item.memberId, current + item.amountOwed);
          });
        }
      });

      // 最終 transfer から相手別の受払差額を集計。
      transfers.forEach((transfer) => {
        if (transfer.fromMemberId === member.id) {
          const current = transferMap.get(transfer.toMemberId) ?? 0;
          transferMap.set(transfer.toMemberId, current - transfer.amount);
        }

        if (transfer.toMemberId === member.id) {
          const current = transferMap.get(transfer.fromMemberId) ?? 0;
          transferMap.set(transfer.fromMemberId, current + transfer.amount);
        }
      });

      // 金額絶対値の大きい順に並べて可読性を高める。
      const totalResults: TotalResultEntry[] = Array.from(transferMap.entries())
        .filter(([, amount]) => Math.abs(amount) > 0)
        .map(([counterpartId, amount]) => ({ counterpartId, amount }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

      const payTotals: TotalResultEntry[] = Array.from(payTotalMap.entries())
        .filter(([, amount]) => amount > 0)
        .map(([counterpartId, amount]) => ({ counterpartId, amount }))
        .sort((a, b) => b.amount - a.amount);

      const receiveTotals: TotalResultEntry[] = Array.from(receiveTotalMap.entries())
        .filter(([, amount]) => amount > 0)
        .map(([counterpartId, amount]) => ({ counterpartId, amount }))
        .sort((a, b) => b.amount - a.amount);

      return {
        member,
        payEntries,
        receiveEntries,
        payTotals,
        receiveTotals,
        totalResults,
      };
    });
  }, [members, breakdowns, transfers]);

  // フィルタで選択されたメンバーのみ表示。
  const visibleDetails = detailByMember.filter((detail) => selectedSet.has(detail.member.id));

  return (
    <section>
      <button
        onClick={onToggle}
        className="w-full !bg-white hover:!bg-white focus:!bg-white active:!bg-white border-2 border-orange-50 text-orange-600 font-bold py-3 rounded-2xl transition-colors flex justify-center items-center gap-2"
      >
        {showDetails ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        計算の詳細フローを見る
      </button>

      {showDetails && (
        <div className="mt-4 space-y-4 animate-fade-in">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Filter size={16} className="text-orange-500" />
                表示メンバー
              </h3>
              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                {selectedMemberIds.length}/{members.length} 人を表示
              </span>
            </div>

            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setManualSelectedMemberIds(null)}
                  className="text-xs font-bold text-sky-600 bg-sky-50 px-3 py-1 rounded-full border border-sky-100"
                >
                  全表示
                </button>
                <button
                  onClick={() => setManualSelectedMemberIds([])}
                  className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-100"
                >
                  全解除
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {members.map((member) => {
                  const isActive = selectedSet.has(member.id);
                  return (
                    <button
                      key={member.id}
                      onClick={() => toggleMemberSelection(member.id)}
                      className={`px-4 py-2 rounded-full text-sm font-bold border transition-all flex items-center gap-1 ${isActive
                          ? 'bg-sky-500 border-sky-500 text-white shadow-md shadow-sky-200'
                          : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                        }`}
                    >
                      {member.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {visibleDetails.length === 0 && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-orange-100 text-sm text-gray-500 text-center">
              表示対象のメンバーが選択されていません
            </div>
          )}

          {visibleDetails.map((detail) => (
            <div
              key={detail.member.id}
              className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100 space-y-3"
            >
              <h3 className="font-bold text-gray-800 pb-2 border-b border-gray-100">
                👤 {detail.member.name} さんの明細
              </h3>

              <div className="space-y-3">
                <article className="bg-red-50/60 border border-red-100 rounded-xl p-3">
                  <h4 className="text-sm font-bold text-red-700 mb-2">支払う額</h4>
                  {detail.payEntries.length === 0 ? (
                    <p className="text-xs text-red-400">支払う項目はありません</p>
                  ) : (
                    <div className="space-y-3">
                      <ul className="space-y-2">
                        {detail.payEntries.map((entry) => (
                          <li
                            key={`${entry.expenseId}-pay-${entry.toMemberId}-${entry.formula}`}
                            className="bg-white/80 rounded-lg px-2 py-2 border border-red-100"
                          >
                            <div className="text-xs text-gray-500 truncate">{entry.expenseName}</div>
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm mt-1">
                              <span className="font-medium text-gray-700 truncate">
                                {detail.member.name}
                              </span>
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-500">
                                <ArrowRight size={14} />
                              </span>
                              <span className="font-medium text-gray-700 truncate text-right">
                                {getMemberName(entry.toMemberId)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-red-500">
                                ¥{entry.amount.toLocaleString()}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-400 mt-1 truncate">
                              式: {entry.formula}
                            </div>
                          </li>
                        ))}
                      </ul>

                      <div className="border-t border-red-100 pt-2">
                        <div className="text-[11px] font-bold text-red-700 mb-1">支払いトータル</div>
                        <ul className="space-y-1.5">
                          {detail.payTotals.map((entry) => (
                            <li
                              key={`pay-total-${detail.member.id}-${entry.counterpartId}`}
                              className="text-xs text-red-700 flex items-center justify-between"
                            >
                              <span className="truncate">{getMemberName(entry.counterpartId)} へ</span>
                              <span className="font-bold">¥{entry.amount.toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </article>

                <article className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
                  <h4 className="text-sm font-bold text-emerald-700 mb-2">受け取る額</h4>
                  {detail.receiveEntries.length === 0 ? (
                    <p className="text-xs text-emerald-400">受け取る項目はありません</p>
                  ) : (
                    <div className="space-y-3">
                      <ul className="space-y-2">
                        {detail.receiveEntries.map((entry) => (
                          <li
                            key={`${entry.expenseId}-receive-${entry.fromMemberId}`}
                            className="bg-white/80 rounded-lg px-2 py-2 border border-emerald-100"
                          >
                            <div className="text-xs text-gray-500 truncate">{entry.expenseName}</div>
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm mt-1">
                              <span className="font-medium text-gray-700 truncate">
                                {getMemberName(entry.fromMemberId)}
                              </span>
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                <ArrowRight size={14} />
                              </span>
                              <span className="font-medium text-gray-700 truncate text-right">
                                {detail.member.name}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-600">
                                ¥{entry.amount.toLocaleString()}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>

                      <div className="border-t border-emerald-100 pt-2">
                        <div className="text-[11px] font-bold text-emerald-700 mb-1">受け取りトータル</div>
                        <ul className="space-y-1.5">
                          {detail.receiveTotals.map((entry) => (
                            <li
                              key={`receive-total-${detail.member.id}-${entry.counterpartId}`}
                              className="text-xs text-emerald-700 flex items-center justify-between"
                            >
                              <span className="truncate">{getMemberName(entry.counterpartId)} から</span>
                              <span className="font-bold">¥{entry.amount.toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </article>

                <article className="bg-orange-50/60 border border-orange-100 rounded-xl p-3">
                  <h4 className="text-sm font-bold text-orange-700 mb-2">トータル結果</h4>
                  {detail.totalResults.length === 0 ? (
                    <p className="text-xs text-orange-400">最終精算は不要です</p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.totalResults.map((entry) => {
                        // プラスは受取、マイナスは支払。
                        const isReceive = entry.amount > 0;
                        return (
                          <li
                            key={`total-${detail.member.id}-${entry.counterpartId}`}
                            className="bg-white/80 rounded-lg px-2 py-2 border border-orange-100"
                          >
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-bold">
                              <span className="text-gray-700 truncate">{detail.member.name}</span>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 border ${isReceive
                                    ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                                    : 'text-red-600 border-red-200 bg-red-50'
                                  }`}
                              >
                                {isReceive ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                                <span className="text-[11px] tracking-wide">
                                  {isReceive ? '受取' : '支払'}
                                </span>
                                <span>¥{Math.abs(entry.amount).toLocaleString()}</span>
                              </span>
                              <span className="text-gray-700 truncate text-right">
                                {getMemberName(entry.counterpartId)}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
