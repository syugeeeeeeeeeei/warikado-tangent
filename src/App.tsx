import React, { useState, useMemo, useRef } from 'react';
import { 
  Users, Receipt, PieChart, Plus, Trash2, 
  ArrowLeft, Check, ToggleLeft, ToggleRight, Edit2,
  ChevronDown, ChevronUp, Download, Save, Upload
} from 'lucide-react';

// ==========================================
// 1. 型定義 (Domain Types)
// ==========================================

export interface Member {
  id: string;
  name: string;
}

export interface ExpenseRatio {
  memberId: string;
  ratio: number;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  payerId: string;
  ratios: ExpenseRatio[];
  isGradientMode: boolean; // 勾配モードを使用しているかどうかのフラグ
  fractionBearerId: string; // 端数を負担するメンバーのID
}

export interface EventData {
  name: string;
  members: Member[];
  expenses: Expense[];
}

export interface Transfer {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

export interface CalculationLog {
  memberId: string;
  expenseName: string;
  formula: string;
  amountOwed: number;
  amountPaid: number;
  net: number;
}

// 画面遷移のステート型
type ViewState = 'home' | 'manage_members' | 'manage_expenses';

// ==========================================
// 2. 計算ロジック (Pure Functions)
// ==========================================

/**
 * イベントデータから送金フローと詳細な計算ログを算出する関数
 * @param data イベント全体のデータ
 * @returns 最小送金回数の手順と詳細な計算ログ
 */
const calculateSettlement = (data: EventData): { transfers: Transfer[], logs: CalculationLog[] } => {
  const balances = new Map<string, number>();
  const logs: CalculationLog[] = [];

  // 全メンバーの残高を0で初期化
  data.members.forEach(m => balances.set(m.id, 0));

  // 各精算項目の負担額を計算
  data.expenses.forEach(expense => {
    // 参加しているメンバーの勾配合計を算出
    const totalRatio = expense.ratios.reduce((sum, r) => sum + r.ratio, 0);
    if (totalRatio === 0) return;

    // 立て替えた人の残高をプラス
    const currentPayerBalance = balances.get(expense.payerId) ?? 0;
    balances.set(expense.payerId, currentPayerBalance + expense.amount);

    let totalBaseOwed = 0;
    const baseOweds = new Map<string, number>();

    // ステップ1: 各メンバーの基本負担額を「切り捨て」で計算
    expense.ratios.forEach(ratio => {
      if (ratio.ratio === 0) {
        baseOweds.set(ratio.memberId, 0);
        return;
      }
      const baseOwed = Math.floor(expense.amount * (ratio.ratio / totalRatio));
      baseOweds.set(ratio.memberId, baseOwed);
      totalBaseOwed += baseOwed;
    });

    // ステップ2: 合計金額に満たない分（端数）を計算
    const fraction = expense.amount - totalBaseOwed;
    
    // 端数負担者を決定。指定者がいなければ、負担割合が1以上の最初のメンバーとする
    let actualBearerId = expense.fractionBearerId;
    if (!baseOweds.has(actualBearerId) || baseOweds.get(actualBearerId) === 0) {
      const firstValidRatio = expense.ratios.find(r => r.ratio > 0);
      actualBearerId = firstValidRatio ? firstValidRatio.memberId : expense.payerId;
    }

    // ステップ3: 残高の計算とログの記録
    expense.ratios.forEach(ratio => {
      if (ratio.ratio === 0) return; // 負担なしの人はスキップ

      let finalOwed = baseOweds.get(ratio.memberId) ?? 0;
      let hasFraction = false;
      
      // 端数負担者には端数を加算する
      if (ratio.memberId === actualBearerId) {
        finalOwed += fraction;
        hasFraction = fraction > 0;
      }

      const currentBalance = balances.get(ratio.memberId) ?? 0;
      balances.set(ratio.memberId, currentBalance - finalOwed);

      // ログの記録（端数が含まれる場合は明記する）
      const formulaStr = expense.isGradientMode 
        ? `${expense.amount}円 × ${ratio.ratio}%${hasFraction && fraction > 0 ? ` ＋ 端数${fraction}円` : ''}` 
        : `${expense.amount}円 ÷ 比率合計${totalRatio}${hasFraction && fraction > 0 ? ` ＋ 端数${fraction}円` : ''}`;

      const amountPaid = expense.payerId === ratio.memberId ? expense.amount : 0;
      logs.push({
        memberId: ratio.memberId,
        expenseName: expense.name,
        formula: formulaStr,
        amountOwed: finalOwed,
        amountPaid: amountPaid,
        net: amountPaid - finalOwed
      });
    });
  });

  // 貪欲法で最小送金回数を計算
  const transfers: Transfer[] = [];
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  balances.forEach((balance, id) => {
    if (balance < -0.01) debtors.push({ id, amount: -balance });
    else if (balance > 0.01) creditors.push({ id, amount: balance });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    if (!debtor || !creditor) break;

    const amount = Math.min(debtor.amount, creditor.amount);
    
    transfers.push({
      fromMemberId: debtor.id,
      toMemberId: creditor.id,
      amount: Math.round(amount)
    });

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) dIdx++;
    if (creditor.amount < 0.01) cIdx++;
  }

  return { transfers, logs };
};

// ==========================================
// 3. メインアプリケーションコンポーネント
// ==========================================

export default function App() {
  // --- 状態管理 ---
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null); // 編集対象の精算項目ID
  const [isFabMenuOpen, setIsFabMenuOpen] = useState<boolean>(false);
  const [eventData, setEventData] = useState<EventData>({
    name: "", // デフォルトは空
    members: [],
    expenses: []
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // トースト通知を表示するヘルパー
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ヘルパー: メンバーIDから名前を取得
  const getMemberName = (id: string) => eventData.members.find(m => m.id === id)?.name || '不明';

  // FABメニューを閉じる処理
  const closeFabMenu = () => setIsFabMenuOpen(false);

  // 画面遷移ハンドラ
  const navigateTo = (view: ViewState, id: string | null = null) => {
    setCurrentView(view);
    setEditingExpenseId(id);
    closeFabMenu();
  };

  return (
    <div className="min-h-screen bg-orange-50 text-gray-800 font-sans flex flex-col relative selection:bg-orange-200">
      
      {/* 🟢 スティッキーヘッダー */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md shadow-sm border-b border-orange-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          {currentView !== 'home' ? (
            <button 
              onClick={() => navigateTo('home')}
              className="p-2 -ml-2 text-orange-500 hover:bg-orange-100 rounded-full transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-bold">戻る</span>
            </button>
          ) : (
            <div className="w-8" />
          )}

          <div className="flex flex-col items-center flex-1">
            <h1 className="text-xl font-extrabold text-orange-600 tracking-tight">
              勾配割り勘ツール
            </h1>
            {currentView === 'home' ? (
              <input 
                type="text" 
                value={eventData.name}
                onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
                className="bg-transparent text-center text-sm font-bold text-gray-500 focus:outline-none w-full max-w-[250px] placeholder-gray-300 mt-0.5 border-b border-transparent focus:border-orange-200 transition-colors"
                placeholder="イベント名を入力"
              />
            ) : (
              <h2 className="text-sm font-bold text-gray-500 truncate max-w-[200px] mt-0.5">
                {eventData.name || 'イベント名未設定'}
              </h2>
            )}
          </div>

          <div className="w-8" />
        </div>
      </header>

      {/* 🟡 スクロール可能なメインコンテンツ */}
      <main className="flex-1 overflow-y-auto p-4 pb-28 max-w-md mx-auto w-full">
        {currentView === 'home' && (
          <HomeView 
            eventData={eventData}
            setEventData={setEventData}
            getMemberName={getMemberName} 
            navigateTo={navigateTo}
            showToast={showToast}
          />
        )}
        {currentView === 'manage_members' && (
          <MemberManageView 
            eventData={eventData} 
            setEventData={setEventData} 
          />
        )}
        {currentView === 'manage_expenses' && (
          <ExpenseManageView 
            key={editingExpenseId || 'new'}
            eventData={eventData} 
            setEventData={setEventData} 
            editingExpenseId={editingExpenseId}
            navigateTo={navigateTo}
          />
        )}
      </main>

      {/* 🔴 FAB (Floating Action Button) - ホーム画面のみ表示 */}
      {currentView === 'home' && (
        <>
          {/* FABメニューのバックドロップ */}
          {isFabMenuOpen && (
            <div 
              className="fixed inset-0 z-40 bg-black/5 backdrop-blur-[1px]" 
              onClick={closeFabMenu}
            />
          )}

          <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {isFabMenuOpen && (
              <div className="flex flex-col gap-3 mb-2 animate-fade-in-up origin-bottom">
                <button 
                  onClick={() => navigateTo('manage_expenses', null)}
                  className="flex items-center gap-3 bg-white px-4 py-3 rounded-full shadow-lg border border-orange-100 hover:bg-orange-50 active:scale-95 transition-all text-orange-600 font-bold text-sm"
                >
                  <Receipt size={18} /> 精算項目を追加
                </button>
                <button 
                  onClick={() => navigateTo('manage_members', null)}
                  className="flex items-center gap-3 bg-white px-4 py-3 rounded-full shadow-lg border border-orange-100 hover:bg-orange-50 active:scale-95 transition-all text-orange-600 font-bold text-sm"
                >
                  <Users size={18} /> メンバーを管理
                </button>
              </div>
            )}

            <button
              onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
              className={`w-14 h-14 flex items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 ${
                isFabMenuOpen ? 'bg-gray-700 rotate-45' : 'bg-orange-500 hover:bg-orange-600 hover:scale-105 active:scale-95'
              }`}
            >
              <Plus size={32} />
            </button>
          </div>
        </>
      )}

      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-xl z-50 animate-fade-in text-sm font-medium">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 4. サブビューコンポーネント
// ==========================================

/**
 * 【ホーム画面】
 */
function HomeView({ eventData, setEventData, getMemberName, navigateTo, showToast }: { 
  eventData: EventData, 
  setEventData: React.Dispatch<React.SetStateAction<EventData>>,
  getMemberName: (id: string) => string, 
  navigateTo: (view: ViewState, id?: string | null) => void,
  showToast: (msg: string) => void
}) {
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { transfers, logs } = useMemo(() => calculateSettlement(eventData), [eventData]);

  // JSON保存機能
  const handleSaveJSON = () => {
    const blob = new Blob([JSON.stringify(eventData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `popsplit_${eventData.name || 'event'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('イベントデータを保存しました');
  };

  // JSON読込機能
  const handleLoadJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = ev.target?.result as string;
        const parsed = JSON.parse(result);
        if (parsed && typeof parsed === 'object' && 'members' in parsed) {
          setEventData(parsed as EventData);
          showToast('データを読み込みました！');
        } else {
          showToast('不正なデータ形式です');
        }
      } catch (err) {
        console.error(err);
        showToast('ファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // CSVエクスポート機能
  const handleExportCSV = () => {
    let csv = 'メンバー名,精算項目,計算式,負担額,支払済,差引残高\n';
    logs.forEach((log: CalculationLog) => {
      const name = getMemberName(log.memberId);
      // CSV injection対策としてダブルクォートで囲む
      csv += `"${name}","${log.expenseName}","${log.formula}",${log.amountOwed},${log.amountPaid},${log.net}\n`;
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8' }); // Excel用BOM付き
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `popsplit_details_${eventData.name || 'event'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('明細をCSVで出力しました');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* --- 結果サマリー --- */}
      <section>
        <div className="flex justify-between items-end mb-3 px-1">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <PieChart size={20} className="text-orange-500" /> 精算結果
          </h2>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-orange-100/50">
          {eventData.expenses.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">
              右下の「＋」から精算項目を追加してください
            </p>
          ) : transfers.length === 0 ? (
            <div className="text-center py-4 text-green-600 font-bold">
              🎉 全員の精算が完了しています！
            </div>
          ) : (
            <ul className="space-y-3">
              {transfers.map((t, idx) => (
                <li key={idx} className="flex items-center justify-between bg-orange-50/50 p-3 rounded-2xl border border-orange-100">
                  <div className="font-bold text-gray-700">{getMemberName(t.fromMemberId)}</div>
                  <div className="flex flex-col items-center px-2">
                    <span className="text-xs font-bold text-orange-600 bg-white px-3 py-1 rounded-full shadow-sm mb-1">
                      ¥{t.amount.toLocaleString()}
                    </span>
                    <span className="text-orange-300 text-[10px]">▶︎</span>
                  </div>
                  <div className="font-bold text-gray-700">{getMemberName(t.toMemberId)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* --- 詳細フロー表示 (トランザクション明細) --- */}
      {eventData.expenses.length > 0 && (
        <section>
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="w-full bg-white border-2 border-orange-50 text-orange-600 font-bold py-3 rounded-2xl hover:bg-orange-50 transition-colors flex justify-center items-center gap-2"
          >
            {showDetails ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            計算の詳細フローを見る
          </button>

          {showDetails && (
            <div className="mt-4 space-y-4 animate-fade-in">
              {eventData.members.map((member: Member) => {
                const memberLogs = logs.filter((l: CalculationLog) => l.memberId === member.id);
                if (memberLogs.length === 0) return null;

                return (
                  <div key={member.id} className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100">
                    <h3 className="font-bold text-gray-800 mb-2 pb-2 border-b border-gray-100">
                      👤 {member.name} さんの明細
                    </h3>
                    <ul className="space-y-3 mt-3">
                      {memberLogs.map((log: CalculationLog, idx: number) => (
                        <li key={idx} className="text-sm bg-gray-50 p-3 rounded-xl">
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
                            <span className={`font-bold ${log.net > 0 ? 'text-green-500' : log.net < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                              収支: {log.net > 0 ? '+' : ''}{log.net.toLocaleString()}
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
      )}

      {/* --- 精算項目一覧 --- */}
      <section>
        <div className="flex justify-between items-end mb-3 px-1">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Receipt size={20} className="text-sky-500" /> 精算項目
          </h2>
          <span className="text-xs text-gray-400">タップして編集</span>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-sky-100/50 overflow-hidden">
          {eventData.expenses.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">登録なし</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {eventData.expenses.map(exp => (
                <li 
                  key={exp.id} 
                  onClick={() => navigateTo('manage_expenses', exp.id)}
                  className="p-4 hover:bg-sky-50 transition-colors cursor-pointer group flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-700">{exp.name}</span>
                      <span className="font-bold text-sky-600">¥{exp.amount.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex gap-2">
                      <span>立替: {getMemberName(exp.payerId)}</span>
                      <span>•</span>
                      <span>対象: {exp.ratios.filter(r => r.ratio > 0).length}人</span>
                      {exp.isGradientMode && <span className="text-purple-400 font-bold">勾配あり</span>}
                    </div>
                  </div>
                  <Edit2 size={16} className="text-gray-300 group-hover:text-sky-400 ml-4 transition-colors" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* --- メンバー一覧 --- */}
      <section>
        <div className="flex justify-between items-end mb-3 px-1">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Users size={20} className="text-emerald-500" /> メンバー
          </h2>
          <button onClick={() => navigateTo('manage_members', null)} className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">管理</button>
        </div>
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-emerald-100/50 flex flex-wrap gap-2">
          {eventData.members.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4 w-full">登録なし</p>
          ) : (
            eventData.members.map(member => (
              <div key={member.id} className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-full text-sm border border-emerald-100">
                {member.name}
              </div>
            ))
          )}
        </div>
      </section>

      {/* --- データ管理 (セーブ・ロード・エクスポート) --- */}
      <section className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-bold text-gray-400 mb-3 ml-2">データ管理</h3>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleExportCSV} className="bg-white text-gray-700 border border-gray-200 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all shadow-sm">
            <Download size={16} /> CSV出力
          </button>
          <button onClick={handleSaveJSON} className="bg-white text-gray-700 border border-gray-200 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all shadow-sm">
            <Save size={16} /> セーブ(JSON)
          </button>
          <label className="col-span-2 bg-orange-100 text-orange-600 border border-orange-200 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-orange-200 active:scale-95 transition-all shadow-sm cursor-pointer">
            <Upload size={16} /> イベントを読み込む
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleLoadJSON}
            />
          </label>
        </div>
      </section>

    </div>
  );
}

/**
 * 【メンバー管理画面】
 */
function MemberManageView({ eventData, setEventData }: { eventData: EventData, setEventData: React.Dispatch<React.SetStateAction<EventData>> }) {
  const [newMemberName, setNewMemberName] = useState('');

  const addMember = () => {
    if (!newMemberName.trim()) return;
    const newMember: Member = { id: crypto.randomUUID(), name: newMemberName.trim() };
    setEventData({ ...eventData, members: [...eventData.members, newMember] });
    setNewMemberName('');
  };

  const removeMember = (id: string) => {
    setEventData({
      ...eventData,
      members: eventData.members.filter(m => m.id !== id),
      expenses: eventData.expenses.map(exp => ({
        ...exp,
        ratios: exp.ratios.filter(r => r.memberId !== id)
      }))
    });
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <h2 className="text-xl font-bold text-gray-800">メンバーの登録・編集</h2>
      
      {/* 登録フォーム */}
      <div className="bg-white p-3 rounded-3xl shadow-sm flex gap-2 border border-emerald-100 focus-within:ring-2 focus-within:ring-emerald-200 transition-shadow">
        <input 
          type="text" 
          value={newMemberName}
          onChange={(e) => setNewMemberName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMember()}
          placeholder="名前を入力（例: 太郎）" 
          className="flex-1 bg-transparent border-none px-3 py-2 focus:outline-none text-gray-700 font-medium"
        />
        <button 
          onClick={addMember}
          disabled={!newMemberName.trim()}
          className="bg-emerald-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* リスト */}
      <ul className="space-y-3">
        {eventData.members.map((member) => (
          <li key={member.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
            <span className="font-bold text-gray-700">{member.name}</span>
            <button 
              onClick={() => removeMember(member.id)}
              className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </li>
        ))}
        {eventData.members.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">メンバーを追加してください</div>
        )}
      </ul>
    </div>
  );
}

/**
 * 【精算項目管理画面 (新規追加 & 編集)】
 */
function ExpenseManageView({ eventData, setEventData, editingExpenseId, navigateTo }: { 
  eventData: EventData, 
  setEventData: React.Dispatch<React.SetStateAction<EventData>>, 
  editingExpenseId: string | null,
  navigateTo: (view: ViewState, id?: string | null) => void
}) {
  const isEditing = !!editingExpenseId;

  // --- ローカルステート ---
  const editingExpense = isEditing ? eventData.expenses.find(e => e.id === editingExpenseId) : null;

  // --- ローカルステート (マウント時に初期化) ---
  const [expenseName, setExpenseName] = useState(editingExpense?.name || '');
  const [amountStr, setAmountStr] = useState<string>(editingExpense ? editingExpense.amount.toString() : '');
  const [payerId, setPayerId] = useState<string>(editingExpense?.payerId || eventData.members[0]?.id || '');
  const [isGradientMode, setIsGradientMode] = useState<boolean>(editingExpense?.isGradientMode || false);
  const [fractionBearerId, setFractionBearerId] = useState<string>(editingExpense?.fractionBearerId || editingExpense?.payerId || eventData.members[0]?.id || '');
  
  const initialActiveTargets: Record<string, boolean> = {};
  const initialRatios: Record<string, number | string> = {};
  const initialEditedRatios: Record<string, boolean> = {};

  if (editingExpense) {
    editingExpense.ratios.forEach(r => {
      if (r.ratio > 0) {
        initialActiveTargets[r.memberId] = true;
        initialRatios[r.memberId] = r.ratio;
        initialEditedRatios[r.memberId] = true;
      }
    });
  }

  const [activeTargets, setActiveTargets] = useState<Record<string, boolean>>(initialActiveTargets);
  // 比率は空文字を許容する string または number 型に変更
  const [ratios, setRatios] = useState<Record<string, number | string>>(initialRatios);
  const [editedRatios, setEditedRatios] = useState<Record<string, boolean>>(initialEditedRatios);

  // 金額入力の徹底的な正規化
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 数字以外を除去した上で、先頭の0をすべて消す
    const val = e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, ''); 
    setAmountStr(val);
  };

  /**
   * 未編集のメンバーに、残りの%を均等に割り当てる計算ロジック
   */
  const recalculateUneditedRatios = (currentActiveIds: string[], currentRatios: Record<string, number | string>, currentEdited: Record<string, boolean>) => {
    let editedSum = 0;
    const uneditedIds: string[] = [];

    currentActiveIds.forEach(id => {
      if (currentEdited[id]) {
        const val = currentRatios[id];
        // 文字列として保持されている可能性を考慮して計算
        editedSum += (typeof val === 'number' ? val : (parseInt(String(val), 10) || 0));
      } else {
        uneditedIds.push(id);
      }
    });

    const newRatios = { ...currentRatios };
    const remainingRatio = Math.max(0, 100 - editedSum);

    if (uneditedIds.length > 0) {
      const baseShare = Math.floor(remainingRatio / uneditedIds.length);
      let remainder = remainingRatio % uneditedIds.length;

      uneditedIds.forEach(id => {
        let share = baseShare;
        if (remainder > 0) {
          share += 1;
          remainder -= 1;
        }
        newRatios[id] = share;
      });
    }
    setRatios(newRatios);
  };

  // 対象メンバーのトグル
  const toggleTarget = (memberId: string) => {
    setActiveTargets(prev => {
      const isCurrentlyActive = prev[memberId] ?? false;
      const nextState = { ...prev, [memberId]: !isCurrentlyActive };
      const activeIds = Object.keys(nextState).filter(id => nextState[id]);
      
      setEditedRatios({});
      recalculateUneditedRatios(activeIds, {}, {});
      
      if (!nextState[fractionBearerId] && activeIds.length > 0) {
        setFractionBearerId(activeIds[0]);
      } else if (activeIds.length === 0) {
        setFractionBearerId('');
      }

      return nextState;
    });
  };

  // 勾配（％）の手動入力ハンドラの徹底的な正規化
  const handleRatioChange = (memberId: string, value: string) => {
    const activeIds = eventData.members.map(m=>m.id).filter(id => activeTargets[id]);

    // 数字以外の文字を削除し、先頭の0をすべて削除
    const numericStr = value.replace(/[^0-9]/g, '').replace(/^0+/, '');

    // ユーザーが全削除した場合、または単独の "0" だった場合は空文字として許容する
    if (numericStr === "") {
      const newRatios = { ...ratios, [memberId]: "" };
      const newEditedRatios = { ...editedRatios, [memberId]: true };
      setEditedRatios(newEditedRatios);
      recalculateUneditedRatios(activeIds, newRatios, newEditedRatios);
      return;
    }

    let numValue = parseInt(numericStr, 10);
    
    // 他の編集済みメンバーの合計%を取得して、100%を超えないよう制限
    let otherEditedSum = 0;
    activeIds.forEach(id => {
      if (id !== memberId && editedRatios[id]) {
        const val = ratios[id];
        otherEditedSum += (typeof val === 'number' ? val : (parseInt(String(val), 10) || 0));
      }
    });
    
    const maxAllowed = 100 - otherEditedSum;
    if (numValue > maxAllowed) numValue = maxAllowed;

    const newRatios = { ...ratios, [memberId]: numValue };
    const newEditedRatios = { ...editedRatios, [memberId]: true };
    
    setEditedRatios(newEditedRatios);
    recalculateUneditedRatios(activeIds, newRatios, newEditedRatios);
  };

  // 保存（追加 or 更新）処理
  const saveExpense = () => {
    const numAmount = parseInt(amountStr, 10);
    if (!expenseName || isNaN(numAmount) || numAmount <= 0 || !payerId) return;

    const expenseRatios: ExpenseRatio[] = eventData.members.map(m => {
      const isTarget = activeTargets[m.id] ?? false;
      if (!isTarget) return { memberId: m.id, ratio: 0 }; 

      const rawRatio = ratios[m.id];
      const ratioNum = typeof rawRatio === 'number' ? rawRatio : (parseInt(String(rawRatio), 10) || 0);
      const ratioVal = isGradientMode ? ratioNum : 1;
      
      return { memberId: m.id, ratio: ratioVal };
    });

    if (expenseRatios.reduce((acc, r) => acc + r.ratio, 0) === 0) {
      alert("負担対象者がいない、または勾配の合計が0です。");
      return;
    }

    const newExpense: Expense = {
      id: isEditing ? editingExpenseId : crypto.randomUUID(),
      name: expenseName,
      amount: numAmount,
      payerId,
      ratios: expenseRatios,
      isGradientMode,
      fractionBearerId
    };

    if (isEditing) {
      setEventData({ 
        ...eventData, 
        expenses: eventData.expenses.map(e => e.id === editingExpenseId ? newExpense : e) 
      });
    } else {
      setEventData({ 
        ...eventData, 
        expenses: [...eventData.expenses, newExpense] 
      });
    }

    navigateTo('home');
  };

  // 項目の削除処理
  const removeExpense = () => {
    if (!isEditing || !editingExpenseId) return;
    setEventData({ ...eventData, expenses: eventData.expenses.filter(e => e.id !== editingExpenseId) });
    navigateTo('home');
  };

  // リアルタイムプレビューの計算（端数処理込み）
  const previewData = useMemo(() => {
    if (eventData.members.length === 0) return null;

    const numAmount = parseInt(amountStr, 10) || 0;
    if (numAmount === 0) return null;

    const targets = eventData.members.filter(m => activeTargets[m.id]).map(m => {
      const rawRatio = ratios[m.id];
      const ratioNum = typeof rawRatio === 'number' ? rawRatio : (parseInt(String(rawRatio), 10) || 0);
      const r = isGradientMode ? ratioNum : 1;
      
      return { id: m.id, name: m.name, ratio: r, baseOwed: 0, finalOwed: 0 };
    });

    const totalRatio = targets.reduce((acc, t) => acc + t.ratio, 0);

    if (totalRatio === 0) return null;

    let totalBaseOwed = 0;
    targets.forEach(t => {
      if (t.ratio > 0) {
        t.baseOwed = Math.floor(numAmount * (t.ratio / totalRatio));
        totalBaseOwed += t.baseOwed;
        t.finalOwed = t.baseOwed;
      }
    });

    const fraction = numAmount - totalBaseOwed;
    
    let bearer = targets.find(t => t.id === fractionBearerId && t.ratio > 0);
    if (!bearer && targets.some(t => t.ratio > 0)) {
       bearer = targets.find(t => t.ratio > 0);
    }

    if (bearer) bearer.finalOwed += fraction;

    return targets.filter(t => t.ratio > 0).map(t => ({
      name: t.name,
      owed: t.finalOwed,
      hasFraction: t.id === bearer?.id && fraction > 0
    }));
  }, [amountStr, activeTargets, isGradientMode, ratios, eventData.members, fractionBearerId]);

  if (eventData.members.length === 0) {
    return <div className="text-center py-10 text-gray-500">先にホーム画面からメンバーを登録してください</div>;
  }

  return (
    <div className="animate-fade-in-up space-y-8">
      
      {/* 🧾 登録・編集フォーム */}
      <section className="bg-white p-5 rounded-3xl shadow-sm border border-sky-100 relative">
        {/* 削除ボタン (編集時のみ表示) */}
        {isEditing && (
          <button 
            onClick={removeExpense}
            className="absolute top-4 right-4 text-red-400 hover:text-red-500 bg-red-50 p-2 rounded-full transition-colors"
          >
            <Trash2 size={18} />
          </button>
        )}

        <h2 className="text-lg font-bold text-sky-600 mb-4 flex items-center gap-2">
          {isEditing ? <Edit2 size={20} /> : <Plus size={20} />} 
          {isEditing ? '精算項目の編集' : '新しい精算項目'}
        </h2>
        
        <div className="space-y-5">
          {/* 項目名 */}
          <div>
            <label className="text-xs font-bold text-gray-500 ml-1 block mb-1">何にお金を使いましたか？</label>
            <input 
              type="text" 
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              placeholder="例: タクシー代" 
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {/* 金額 */}
            <div>
              <label className="text-xs font-bold text-gray-500 ml-1 block mb-1">合計金額 (円)</label>
              {/* type="text" と inputMode="numeric" にすることで不要な0が残るバグを回避 */}
              <input 
                type="text" 
                inputMode="numeric"
                value={amountStr}
                onChange={handleAmountChange}
                placeholder="0" 
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-200 font-bold"
              />
            </div>
            {/* 立て替えた人 */}
            <div>
              <label className="text-xs font-bold text-gray-500 ml-1 block mb-1">立て替えた人</label>
              <select 
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-200 font-bold text-gray-700"
              >
                {eventData.members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-200 pt-4">
            <label className="text-xs font-bold text-gray-500 ml-1 block mb-3">
              割り勘する対象メンバーをタップ
            </label>
            
            {/* 対象メンバー選択（チップ） */}
            <div className="flex flex-wrap gap-2 mb-4">
              {eventData.members.map(m => {
                const isActive = activeTargets[m.id] ?? false;
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleTarget(m.id)}
                    className={`px-4 py-2 rounded-full text-sm font-bold border transition-all flex items-center gap-1 ${
                      isActive 
                        ? 'bg-sky-500 border-sky-500 text-white shadow-md shadow-sky-200' 
                        : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {isActive && <Check size={14} />}
                    {m.name}
                  </button>
                );
              })}
            </div>

            {/* 勾配モードトグル */}
            <div className="flex items-center justify-between bg-purple-50 p-3 rounded-2xl border border-purple-100 mb-2">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-purple-700">勾配モード</span>
                <span className="text-[10px] text-purple-500">個別の負担割合（%）を設定します</span>
              </div>
              <button 
                onClick={() => setIsGradientMode(!isGradientMode)}
                className="text-purple-600 transition-transform active:scale-95"
              >
                {isGradientMode ? <ToggleRight size={36} /> : <ToggleLeft size={36} className="text-purple-200" />}
              </button>
            </div>

            {/* 勾配入力フィールド (勾配モードON時のみ) */}
            {isGradientMode && (
              <div className="grid grid-cols-2 gap-2 mt-3 animate-fade-in">
                {eventData.members.filter(m => activeTargets[m.id]).map(m => {
                  const isEdited = editedRatios[m.id] ?? false;
                  // 0 または 空文字 の場合は画面上で完全に空白にし、プレースホルダーを表示させる
                  const displayValue = ratios[m.id] === 0 ? "" : (ratios[m.id] ?? "");
                  
                  return (
                    <div key={m.id} className={`flex items-center justify-between border p-2 rounded-xl shadow-sm transition-colors ${isEdited ? 'bg-purple-50 border-purple-200' : 'bg-white border-purple-100'}`}>
                      <span className="text-xs font-bold text-gray-600 truncate mr-2">{m.name}</span>
                      <div className="flex items-center gap-1">
                        {/* type="text" と inputMode="numeric" にすることで不要な0が残るバグを回避 */}
                        <input 
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={displayValue}
                          onChange={(e) => handleRatioChange(m.id, e.target.value)}
                          className={`w-12 text-center font-bold rounded-lg px-1 py-1 focus:outline-none focus:ring-2 focus:ring-purple-300 ${isEdited ? 'bg-white text-purple-700' : 'bg-gray-50 text-gray-500 placeholder-gray-400'}`}
                        />
                        <span className="text-[10px] font-bold text-gray-400">%</span>
                      </div>
                    </div>
                  );
                })}
                {eventData.members.filter(m => activeTargets[m.id]).length === 0 && (
                  <div className="col-span-2 text-xs text-center text-purple-400 py-2">
                    対象メンバーを選択してください
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 端数負担者の設定 */}
          <div className="border-t border-dashed border-gray-200 pt-4 mt-2">
            <label className="text-xs font-bold text-gray-500 ml-1 block mb-1">端数を負担する人</label>
            <select 
              value={fractionBearerId}
              onChange={(e) => setFractionBearerId(e.target.value)}
              className="w-full bg-orange-50/30 border border-orange-100 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-200 font-bold text-gray-700"
            >
              {eventData.members.filter(m => activeTargets[m.id]).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              {eventData.members.filter(m => activeTargets[m.id]).length === 0 && (
                <option value="">対象メンバーを選択してください</option>
              )}
            </select>
            <p className="text-[10px] text-gray-400 ml-1 mt-1">割り切れない金額が出た場合、この人に加算されます</p>
          </div>

          {/* リアルタイムプレビュー */}
          {previewData && previewData.length > 0 && (
            <div className="bg-sky-50/50 p-3 rounded-2xl border border-sky-100 mt-2">
              <div className="text-[10px] font-bold text-sky-500 mb-2 uppercase tracking-wider">Preview</div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {previewData.map((d, idx) => (
                  <div key={idx} className="flex items-baseline gap-1 relative">
                    <span className="text-xs text-gray-600">{d.name}:</span>
                    <span className="text-sm font-extrabold text-gray-800">¥{d.owed.toLocaleString()}</span>
                    {/* 端数負担を視覚的に表示 */}
                    {d.hasFraction && (
                      <span className="absolute -top-3 -right-2 text-[8px] bg-orange-200 text-orange-700 px-1 rounded font-bold">端数</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={saveExpense}
            disabled={!expenseName || !amountStr || parseInt(amountStr,10) <= 0 || !payerId || Object.values(activeTargets).filter(Boolean).length === 0}
            className="w-full bg-gray-800 text-white font-bold py-4 rounded-2xl hover:bg-black active:scale-[0.98] transition-all shadow-md mt-4 flex justify-center items-center gap-2 disabled:opacity-30 disabled:active:scale-100"
          >
            {isEditing ? '更新する' : '追加する'}
          </button>
        </div>
      </section>

    </div>
  );
}
