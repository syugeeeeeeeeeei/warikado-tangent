import { useEffect, useState } from 'react';
import { AppHeader } from './components/layout/AppHeader';
import { FabMenu } from './components/layout/FabMenu';
import { Toast } from './components/layout/Toast';
import { useToast } from './hooks/useToast';
import { ExpenseManageView } from './views/ExpenseManageView';
import { HomeView } from './views/HomeView';
import { MemberManageView } from './views/MemberManageView';
import { EVENT_NAME_MAX_LENGTH } from './constants/inputLimits';
import type { EventData, ViewState } from './types/domain';
import { decodeEventDataFromUrlSafe } from './utils/shareCodec';
import { limitByCodePoints } from './utils/textLimit';

const getSharedPayloadFromHash = (hash: string) => {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!normalized) return null;
  const params = new URLSearchParams(normalized);
  return params.get('s');
};

export default function App() {
  // 画面遷移は URL ではなくローカル state で管理し、モバイル向けに軽量な単一画面遷移を実現する。
  const [currentView, setCurrentView] = useState<ViewState>('home');
  // 編集中の精算項目 ID。新規作成時は null を使う。
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  // ホーム画面右下の FAB メニュー開閉状態。
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  // 超過入力時トーストの連打を防ぐフラグ。
  const [eventNameLimitToastShown, setEventNameLimitToastShown] = useState(false);
  // アプリ全体で共有するドメインデータ（イベント名・メンバー・精算項目）。
  const [eventData, setEventData] = useState<EventData>({
    name: '',
    members: [],
    expenses: [],
  });

  // 短時間表示の通知 UI を扱うカスタムフック。
  const { toastMessage, showToast } = useToast();

  // ID から表示名を解決する共通ヘルパー。削除済み ID などは "不明" でフォールバックする。
  const getMemberName = (memberId: string) => {
    return eventData.members.find((member) => member.id === memberId)?.name || '不明';
  };

  // FAB を閉じる処理を共通化して、遷移時やオーバーレイ操作時に同じ挙動を保証する。
  const closeFabMenu = () => setIsFabMenuOpen(false);

  // イベント名は code point 単位で 20 文字までに制限する。
  const handleEventNameChange = (rawName: string) => {
    const { value, wasTrimmed } = limitByCodePoints(rawName, EVENT_NAME_MAX_LENGTH);
    setEventData((prev) => ({ ...prev, name: value }));

    if (wasTrimmed && !eventNameLimitToastShown) {
      showToast(`イベント名は${EVENT_NAME_MAX_LENGTH}文字までです。`);
      setEventNameLimitToastShown(true);
      return;
    }

    if (!wasTrimmed && eventNameLimitToastShown) {
      setEventNameLimitToastShown(false);
    }
  };

  // 画面遷移時に「表示ビュー」「編集対象」「FAB クローズ」を一括で更新する。
  const navigateTo = (view: ViewState, id: string | null = null) => {
    setCurrentView(view);
    setEditingExpenseId(id);
    closeFabMenu();
  };

  // #s=<payload> 付きURLアクセス時に、共有データを自動で復元する。
  useEffect(() => {
    let isCancelled = false;

    const loadFromSharedUrl = async () => {
      const payload = getSharedPayloadFromHash(window.location.hash);
      if (!payload) return;

      try {
        const parsed = await decodeEventDataFromUrlSafe(payload);
        if (isCancelled) return;

        setEventData(parsed);
        setCurrentView('home');
        setEditingExpenseId(null);
        setIsFabMenuOpen(false);
        showToast('共有URLからデータを読み込みました。');

        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}`,
        );
      } catch (error) {
        console.error(error);
        if (isCancelled) return;
        showToast('共有URLの読み込みに失敗しました。');
      }
    };

    void loadFromSharedUrl();

    return () => {
      isCancelled = true;
    };
  }, [showToast]);

  return (
    <div className="min-h-screen bg-orange-50 text-gray-800 font-sans flex flex-col relative selection:bg-orange-200">
      <AppHeader
        currentView={currentView}
        eventName={eventData.name}
        eventNameMaxLength={EVENT_NAME_MAX_LENGTH}
        // イベント名のみ差し替え、他の eventData は維持する。
        onEventNameChange={handleEventNameChange}
        onBackHome={() => navigateTo('home')}
      />

      <main className="flex-1 overflow-y-auto p-4 pb-28 max-w-md mx-auto w-full">
        {/* ホーム画面: 一覧・精算結果・入出力操作を表示 */}
        {currentView === 'home' && (
          <HomeView
            eventData={eventData}
            setEventData={setEventData}
            getMemberName={getMemberName}
            navigateTo={navigateTo}
            showToast={showToast}
          />
        )}

        {/* メンバー管理画面 */}
        {currentView === 'manage_members' && (
          <MemberManageView
            eventData={eventData}
            setEventData={setEventData}
            showToast={showToast}
          />
        )}

        {/* 精算項目管理画面。key を ID にすることで編集対象切替時にフォーム状態を再初期化する。 */}
        {currentView === 'manage_expenses' && (
          <ExpenseManageView
            key={editingExpenseId || 'new'}
            eventData={eventData}
            setEventData={setEventData}
            editingExpenseId={editingExpenseId}
            navigateTo={navigateTo}
            showToast={showToast}
          />
        )}
      </main>

      {/* ホーム画面のみ FAB を表示して操作導線をシンプルに保つ。 */}
      {currentView === 'home' && (
        <FabMenu
          isOpen={isFabMenuOpen}
          onToggle={() => setIsFabMenuOpen((prev) => !prev)}
          onClose={closeFabMenu}
          onAddExpense={() => navigateTo('manage_expenses', null)}
          onManageMembers={() => navigateTo('manage_members', null)}
        />
      )}

      {/* メッセージがある間だけトーストを描画する。 */}
      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
}
