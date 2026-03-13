import { useMemo, useState } from 'react';
import { DataManagement } from '../components/home/DataManagement';
import { ExpenseList } from '../components/home/ExpenseList';
import { MemberList } from '../components/home/MemberList';
import { SettlementDetails } from '../components/home/SettlementDetails';
import { SettlementSummary } from '../components/home/SettlementSummary';
import type { EventData, ViewState } from '../types/domain';
import { copyTextToClipboard, createShareUrlFromEventData, exportLogsAsCsv } from '../utils/dataIO';
import { calculateSettlement } from '../utils/settlement';

interface HomeViewProps {
  eventData: EventData;
  getMemberName: (id: string) => string;
  navigateTo: (view: ViewState, id?: string | null) => void;
  showToast: (message: string) => void;
}

export const HomeView = ({
  eventData,
  getMemberName,
  navigateTo,
  showToast,
}: HomeViewProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const { transfers, logs, breakdowns } = useMemo(() => calculateSettlement(eventData), [eventData]);

  const handleExportCsv = () => {
    exportLogsAsCsv(logs, getMemberName, eventData.name);
    showToast('明細をCSVで出力しました');
  };

  const handleCopyShareUrl = async () => {
    try {
      const url = await createShareUrlFromEventData(eventData);
      const copied = await copyTextToClipboard(url);
      showToast(copied ? '共有URLをコピーしました' : '共有URLのコピーに失敗しました');
    } catch (error) {
      console.error(error);
      showToast('共有URLのコピーに失敗しました');
    }
  };

  const handleShareUrl = async () => {
    try {
      const url = await createShareUrlFromEventData(eventData);

      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: eventData.name || '勾配割り勘ツール',
          text: '割り勘データを共有します',
          url,
        });
        showToast('共有が完了しました');
        return;
      }

      const copied = await copyTextToClipboard(url);
      showToast(copied ? '共有機能がないためURLをコピーしました' : '共有URLのコピーに失敗しました');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error(error);
      showToast('共有に失敗しました');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <SettlementSummary
        expensesCount={eventData.expenses.length}
        transfers={transfers}
        getMemberName={getMemberName}
      />

      {eventData.expenses.length > 0 && (
        <SettlementDetails
          members={eventData.members}
          transfers={transfers}
          breakdowns={breakdowns}
          getMemberName={getMemberName}
          showDetails={showDetails}
          onToggle={() => setShowDetails((prev) => !prev)}
        />
      )}

      <ExpenseList
        expenses={eventData.expenses}
        getMemberName={getMemberName}
        onEditExpense={(expenseId) => navigateTo('manage_expenses', expenseId)}
        onAddExpense={() => navigateTo('manage_expenses', null)}
      />

      <MemberList
        members={eventData.members}
        onManageMembers={() => navigateTo('manage_members', null)}
      />

      <DataManagement
        onExportCsv={handleExportCsv}
        onCopyShareUrl={handleCopyShareUrl}
        onShareUrl={handleShareUrl}
        canNativeShare={typeof navigator.share === 'function'}
      />
    </div>
  );
};
