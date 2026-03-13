import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { DataManagement } from '../components/home/DataManagement';
import { ExpenseList } from '../components/home/ExpenseList';
import { MemberList } from '../components/home/MemberList';
import { ShareSheet } from '../components/home/ShareSheet';
import { SettlementDetails } from '../components/home/SettlementDetails';
import { SettlementSummary } from '../components/home/SettlementSummary';
import type { EventData, ViewState } from '../types/domain';
import { exportLogsAsCsv, readEventDataFromJsonFile, saveEventDataAsJson } from '../utils/dataIO';
import { encodeEventDataToUrlSafe } from '../utils/shareCodec';
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
  const RECOMMENDED_URL_LENGTH = 1800;
  const WARNING_URL_LENGTH = 4000;

  // 精算詳細パネルの開閉状態。
  const [showDetails, setShowDetails] = useState(false);
  // JSON 読み込み input を外部からリセットするための参照。
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 共有シート状態。
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [isShareUrlLoading, setIsShareUrlLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareUrlError, setShareUrlError] = useState<string | null>(null);

  const isNativeShareSupported =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

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

  // 現在データを共有URLへ変換する。
  const buildShareUrl = async () => {
    try {
      setIsShareUrlLoading(true);
      setShareUrlError(null);
      const { encoded } = await encodeEventDataToUrlSafe(eventData);
      const baseUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
      const url = `${baseUrl}#s=${encoded}`;
      setShareUrl(url);
      return url;
    } catch (error) {
      console.error(error);
      setShareUrl('');
      setShareUrlError('共有リンクの生成に失敗しました。');
      return null;
    } finally {
      setIsShareUrlLoading(false);
    }
  };

  // 共有シートを開く。
  const handleOpenShareSheet = () => {
    setIsShareSheetOpen(true);
    void buildShareUrl();
  };

  const copyTextToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  };

  // 共有リンクをクリップボードへコピー。
  const handleCopyShareUrl = async () => {
    const url = shareUrl || (await buildShareUrl());
    if (!url) {
      showToast('共有リンクを作成できませんでした。');
      return;
    }

    try {
      await copyTextToClipboard(url);
      showToast('共有リンクをコピーしました。');
    } catch (error) {
      console.error(error);
      showToast('クリップボードへのコピーに失敗しました。');
    }
  };

  // 端末の共有シートを開く。失敗時はコピーへフォールバック。
  const handleNativeShare = async () => {
    if (!isNativeShareSupported) {
      showToast('この端末では共有機能を利用できません。');
      return;
    }

    const url = shareUrl || (await buildShareUrl());
    if (!url) {
      showToast('共有リンクを作成できませんでした。');
      return;
    }

    try {
      await navigator.share({
        title: eventData.name || '割り勘データ',
        text: '割り勘データを共有します。',
        url,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error(error);
      showToast('共有に失敗したため、リンクをコピーします。');
      await handleCopyShareUrl();
    }
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
        onOpenShare={handleOpenShareSheet}
        onExportCsv={handleExportCsv}
        onLoadJson={handleLoadJson}
      />

      <ShareSheet
        isOpen={isShareSheetOpen}
        isLoading={isShareUrlLoading}
        isNativeShareSupported={isNativeShareSupported}
        shareUrl={shareUrl}
        errorMessage={shareUrlError}
        urlLength={shareUrl.length}
        recommendedLength={RECOMMENDED_URL_LENGTH}
        warningLength={WARNING_URL_LENGTH}
        onClose={() => setIsShareSheetOpen(false)}
        onCopyLink={handleCopyShareUrl}
        onNativeShare={handleNativeShare}
        onSaveJson={handleSaveJson}
      />
    </div>
  );
};
