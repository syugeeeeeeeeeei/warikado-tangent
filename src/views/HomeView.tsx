import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { DataManagement } from '../components/home/DataManagement';
import { ExpenseList } from '../components/home/ExpenseList';
import { MemberList } from '../components/home/MemberList';
import { SettlementDetails } from '../components/home/SettlementDetails';
import { SettlementSummary } from '../components/home/SettlementSummary';
import type { EventData, ViewState } from '../types/domain';
import { exportLogsAsCsv, readEventDataFromJsonFile, saveEventDataAsJson } from '../utils/dataIO';
import { calculateSettlement } from '../utils/settlement';

interface HomeViewProps {
  eventData: EventData;
  setEventData: Dispatch<SetStateAction<EventData>>;
  getMemberName: (id: string) => string;
  navigateTo: (view: ViewState, id?: string | null) => void;
  showToast: (message: string) => void;
}

export const HomeView = ({
  eventData,
  setEventData,
  getMemberName,
  navigateTo,
  showToast,
}: HomeViewProps) => {
  // 精算詳細パネルの開閉状態。
  const [showDetails, setShowDetails] = useState(false);
  // JSON 読み込み input を外部からリセットするための参照。
  const fileInputRef = useRef<HTMLInputElement>(null);

  // eventData が変わるたびに精算結果を再計算する。
  const { transfers, logs, breakdowns } = useMemo(() => calculateSettlement(eventData), [eventData]);

  // 現在データを JSON ダウンロード。
  const handleSaveJson = () => {
    saveEventDataAsJson(eventData);
    showToast('イベントデータを保存しました');
  };

  // JSON ファイル読込。成功時は eventData 全体を置き換える。
  const handleLoadJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await readEventDataFromJsonFile(file);
      setEventData(parsed);
      showToast('データを読み込みました！');
    } catch (error) {
      console.error(error);
      showToast('ファイルの読み込みに失敗しました');
    } finally {
      // 同じファイルを再選択した場合にも onChange が発火するように value を戻す。
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 計算ログを CSV 出力。
  const handleExportCsv = () => {
    exportLogsAsCsv(logs, getMemberName, eventData.name);
    showToast('明細をCSVで出力しました');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <SettlementSummary
        expensesCount={eventData.expenses.length}
        transfers={transfers}
        getMemberName={getMemberName}
      />

      {/* 精算項目が1件以上ある場合のみ詳細フローを表示可能にする。 */}
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
        fileInputRef={fileInputRef}
        onExportCsv={handleExportCsv}
        onSaveJson={handleSaveJson}
        onLoadJson={handleLoadJson}
      />
    </div>
  );
};
