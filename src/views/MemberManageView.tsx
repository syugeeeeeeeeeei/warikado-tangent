import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EventData, Member } from '../types/domain';

interface MemberManageViewProps {
  eventData: EventData;
  setEventData: Dispatch<SetStateAction<EventData>>;
}

export const MemberManageView = ({
  eventData,
  setEventData,
}: MemberManageViewProps) => {
  const [newMemberName, setNewMemberName] = useState('');

  const addMember = () => {
    if (!newMemberName.trim()) return;

    const newMember: Member = {
      id: crypto.randomUUID(),
      name: newMemberName.trim(),
    };

    setEventData({
      ...eventData,
      members: [...eventData.members, newMember],
    });
    setNewMemberName('');
  };

  const removeMember = (memberId: string) => {
    setEventData({
      ...eventData,
      members: eventData.members.filter((member) => member.id !== memberId),
      expenses: eventData.expenses.map((expense) => ({
        ...expense,
        ratios: expense.ratios.filter((ratio) => ratio.memberId !== memberId),
      })),
    });
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <h2 className="text-xl font-bold text-gray-800">メンバーの登録・編集</h2>

      <div className="bg-white p-3 rounded-3xl shadow-sm flex gap-2 border border-emerald-100 focus-within:ring-2 focus-within:ring-emerald-200 transition-shadow">
        <input
          type="text"
          value={newMemberName}
          onChange={(event) => setNewMemberName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && addMember()}
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

      <ul className="space-y-3">
        {eventData.members.map((member) => (
          <li
            key={member.id}
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center"
          >
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
};
