import { Check, Edit2, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useExpenseForm } from '../hooks/useExpenseForm';
import type { EventData, ViewState } from '../types/domain';

interface ExpenseManageViewProps {
  eventData: EventData;
  setEventData: Dispatch<SetStateAction<EventData>>;
  editingExpenseId: string | null;
  navigateTo: (view: ViewState, id?: string | null) => void;
}

export const ExpenseManageView = ({
  eventData,
  setEventData,
  editingExpenseId,
  navigateTo,
}: ExpenseManageViewProps) => {
  const {
    isEditing,
    expenseName,
    amountStr,
    payerId,
    isGradientMode,
    fractionBearerId,
    activeTargets,
    editedRatios,
    ratios,
    previewData,
    isSaveDisabled,
    setExpenseName,
    setPayerId,
    setIsGradientMode,
    setFractionBearerId,
    handleAmountChange,
    handleRatioChange,
    toggleTarget,
    saveExpense,
    removeExpense,
  } = useExpenseForm({
    eventData,
    setEventData,
    editingExpenseId,
    navigateTo,
  });

  if (eventData.members.length === 0) {
    return <div className="text-center py-10 text-gray-500">先にホーム画面からメンバーを登録してください</div>;
  }

  const activeMembers = eventData.members.filter((member) => activeTargets[member.id]);

  return (
    <div className="animate-fade-in-up space-y-8">
      <section className="bg-white p-5 rounded-3xl shadow-sm border border-sky-100 relative">
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
          <div>
            <label className="text-xs font-bold text-gray-500 ml-1 block mb-1">何にお金を使いましたか？</label>
            <input
              type="text"
              value={expenseName}
              onChange={(event) => setExpenseName(event.target.value)}
              placeholder="例: タクシー代"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 ml-1 block mb-1">合計金額 (円)</label>
              <input
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={handleAmountChange}
                placeholder="0"
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-200 font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 ml-1 block mb-1">立て替えた人</label>
              <select
                value={payerId}
                onChange={(event) => setPayerId(event.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-200 font-bold text-gray-700"
              >
                {eventData.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-200 pt-4">
            <label className="text-xs font-bold text-gray-500 ml-1 block mb-3">
              割り勘する対象メンバーをタップ
            </label>

            <div className="flex flex-wrap gap-2 mb-4">
              {eventData.members.map((member) => {
                const isActive = activeTargets[member.id] ?? false;
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleTarget(member.id)}
                    className={`px-4 py-2 rounded-full text-sm font-bold border transition-all flex items-center gap-1 ${
                      isActive
                        ? 'bg-sky-500 border-sky-500 text-white shadow-md shadow-sky-200'
                        : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {isActive && <Check size={14} />}
                    {member.name}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between bg-purple-50 p-3 rounded-2xl border border-purple-100 mb-2">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-purple-700">勾配モード</span>
                <span className="text-[10px] text-purple-500">個別の負担割合（%）を設定します</span>
              </div>
              <button
                onClick={() => setIsGradientMode((prev) => !prev)}
                className="text-purple-600 transition-transform active:scale-95"
              >
                {isGradientMode ? (
                  <ToggleRight size={36} />
                ) : (
                  <ToggleLeft size={36} className="text-purple-200" />
                )}
              </button>
            </div>

            {isGradientMode && (
              <div className="grid grid-cols-2 gap-2 mt-3 animate-fade-in">
                {activeMembers.map((member) => {
                  const isEdited = editedRatios[member.id] ?? false;
                  const displayValue = ratios[member.id] === 0 ? '' : (ratios[member.id] ?? '');

                  return (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between border p-2 rounded-xl shadow-sm transition-colors ${
                        isEdited ? 'bg-purple-50 border-purple-200' : 'bg-white border-purple-100'
                      }`}
                    >
                      <span className="text-xs font-bold text-gray-600 truncate mr-2">{member.name}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={displayValue}
                          onChange={(event) => handleRatioChange(member.id, event.target.value)}
                          className={`w-12 text-center font-bold rounded-lg px-1 py-1 focus:outline-none focus:ring-2 focus:ring-purple-300 ${
                            isEdited
                              ? 'bg-white text-purple-700'
                              : 'bg-gray-50 text-gray-500 placeholder-gray-400'
                          }`}
                        />
                        <span className="text-[10px] font-bold text-gray-400">%</span>
                      </div>
                    </div>
                  );
                })}
                {activeMembers.length === 0 && (
                  <div className="col-span-2 text-xs text-center text-purple-400 py-2">
                    対象メンバーを選択してください
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-gray-200 pt-4 mt-2">
            <label className="text-xs font-bold text-gray-500 ml-1 block mb-1">端数を負担する人</label>
            <select
              value={fractionBearerId}
              onChange={(event) => setFractionBearerId(event.target.value)}
              className="w-full bg-orange-50/30 border border-orange-100 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-200 font-bold text-gray-700"
            >
              {activeMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
              {activeMembers.length === 0 && <option value="">対象メンバーを選択してください</option>}
            </select>
            <p className="text-[10px] text-gray-400 ml-1 mt-1">
              割り切れない金額が出た場合、この人に加算されます
            </p>
          </div>

          {previewData && previewData.length > 0 && (
            <div className="bg-sky-50/50 p-3 rounded-2xl border border-sky-100 mt-2">
              <div className="text-[10px] font-bold text-sky-500 mb-2 uppercase tracking-wider">Preview</div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {previewData.map((item, index) => (
                  <div key={index} className="flex items-baseline gap-1 relative">
                    <span className="text-xs text-gray-600">{item.name}:</span>
                    <span className="text-sm font-extrabold text-gray-800">¥{item.owed.toLocaleString()}</span>
                    {item.hasFraction && (
                      <span className="absolute -top-3 -right-2 text-[8px] bg-orange-200 text-orange-700 px-1 rounded font-bold">
                        端数
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={saveExpense}
            disabled={isSaveDisabled}
            className="w-full bg-gray-800 text-white font-bold py-4 rounded-2xl hover:bg-black active:scale-[0.98] transition-all shadow-md mt-4 flex justify-center items-center gap-2 disabled:opacity-30 disabled:active:scale-100"
          >
            {isEditing ? '更新する' : '追加する'}
          </button>
        </div>
      </section>
    </div>
  );
};
