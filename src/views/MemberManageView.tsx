import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { MEMBER_NAME_MAX_LENGTH } from '../constants/inputLimits';
import type { EventData, Member } from '../types/domain';
import { createShortSequentialId } from '../utils/id';
import { limitByCodePoints } from '../utils/textLimit';

interface MemberManageViewProps {
  eventData: EventData;
  setEventData: Dispatch<SetStateAction<EventData>>;
  showToast: (message: string) => void;
}

export const MemberManageView = ({
  eventData,
  setEventData,
  showToast,
}: MemberManageViewProps) => {
  // 新規追加入力欄。
  const [newMemberName, setNewMemberName] = useState('');
  // インライン編集対象 ID と編集中テキスト。
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  // 超過入力時トーストを連打しないためのフラグ。
  const [newMemberLimitToastShown, setNewMemberLimitToastShown] = useState(false);
  const [editingMemberLimitToastShown, setEditingMemberLimitToastShown] = useState(false);

  // 表記ゆれを吸収して重複判定するための正規化。
  const normalizeName = (name: string) => name.trim().toLocaleLowerCase();

  // 既存メンバーとの重複を確認。編集時は自分自身を除外できる。
  const isDuplicateName = (name: string, excludeMemberId?: string) => {
    const target = normalizeName(name);
    return eventData.members.some(
      (member) =>
        member.id !== excludeMemberId &&
        normalizeName(member.name) === target,
    );
  };

  // メンバー追加処理。
  const addMember = () => {
    const nextName = newMemberName.trim();
    if (!nextName) return;

    if (isDuplicateName(nextName)) {
      showToast('そのメンバーはすでに存在します。');
      return;
    }

    const newMember: Member = {
      id: createShortSequentialId(
        'm',
        eventData.members.map((member) => member.id),
      ),
      name: nextName,
    };

    setEventData({
      ...eventData,
      members: [...eventData.members, newMember],
    });
    setNewMemberName('');
    setNewMemberLimitToastShown(false);
  };

  // メンバー削除時は、全精算項目から該当メンバーの ratio も同時に削除して整合性を保つ。
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

  // インライン編集開始。
  const startEditingMember = (member: Member) => {
    setEditingMemberId(member.id);
    const { value, wasTrimmed } = limitByCodePoints(
      member.name,
      MEMBER_NAME_MAX_LENGTH,
    );
    setEditingName(value);
    setEditingMemberLimitToastShown(wasTrimmed);
  };

  // インライン編集キャンセル。
  const cancelEditingMember = () => {
    setEditingMemberId(null);
    setEditingName('');
    setEditingMemberLimitToastShown(false);
  };

  // メンバー名保存処理。
  const saveMemberName = (memberId: string) => {
    const nextName = editingName.trim();
    if (!nextName) return;

    if (isDuplicateName(nextName, memberId)) {
      showToast('そのメンバーはすでに存在します。');
      return;
    }

    setEventData({
      ...eventData,
      members: eventData.members.map((member) =>
        member.id === memberId ? { ...member, name: nextName } : member,
      ),
    });

    cancelEditingMember();
  };

  // 新規入力欄の文字数を制限し、超過時に一度だけ通知する。
  const handleNewMemberNameChange = (rawName: string) => {
    const { value, wasTrimmed } = limitByCodePoints(rawName, MEMBER_NAME_MAX_LENGTH);
    setNewMemberName(value);

    if (wasTrimmed && !newMemberLimitToastShown) {
      showToast(`メンバー名は${MEMBER_NAME_MAX_LENGTH}文字までです。`);
      setNewMemberLimitToastShown(true);
      return;
    }

    if (!wasTrimmed && newMemberLimitToastShown) {
      setNewMemberLimitToastShown(false);
    }
  };

  // 編集入力欄の文字数制限。
  const handleEditingNameChange = (rawName: string) => {
    const { value, wasTrimmed } = limitByCodePoints(rawName, MEMBER_NAME_MAX_LENGTH);
    setEditingName(value);

    if (wasTrimmed && !editingMemberLimitToastShown) {
      showToast(`メンバー名は${MEMBER_NAME_MAX_LENGTH}文字までです。`);
      setEditingMemberLimitToastShown(true);
      return;
    }

    if (!wasTrimmed && editingMemberLimitToastShown) {
      setEditingMemberLimitToastShown(false);
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <h2 className="text-xl font-bold text-gray-800">メンバーの登録・編集</h2>

      <div className="bg-white p-3 rounded-3xl shadow-sm flex gap-2 border border-emerald-100 focus-within:ring-2 focus-within:ring-emerald-200 transition-shadow">
        <input
          type="text"
          value={newMemberName}
          onChange={(event) => handleNewMemberNameChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && addMember()}
          placeholder={`名前を入力（最大${MEMBER_NAME_MAX_LENGTH}文字）`}
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
            {editingMemberId === member.id ? (
              <div className="w-full flex items-center gap-2">
                <input
                  type="text"
                  value={editingName}
                  onChange={(event) => handleEditingNameChange(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && saveMemberName(member.id)}
                  placeholder={`名前を入力（最大${MEMBER_NAME_MAX_LENGTH}文字）`}
                  className="flex-1 bg-gray-50 border border-emerald-100 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200 text-gray-700 font-medium"
                />
                <button
                  onClick={() => saveMemberName(member.id)}
                  disabled={!editingName.trim()}
                  className="text-emerald-600 bg-emerald-50 border border-emerald-100 p-2 rounded-xl hover:bg-emerald-100 disabled:opacity-40 transition-colors"
                  aria-label="名前変更を保存"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={cancelEditingMember}
                  className="text-gray-500 bg-gray-50 border border-gray-200 p-2 rounded-xl hover:bg-gray-100 transition-colors"
                  aria-label="名前変更をキャンセル"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <span className="font-bold text-gray-700">{member.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEditingMember(member)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-xl hover:bg-emerald-100 transition-colors"
                  >
                    <Pencil size={13} />
                    名前変更
                  </button>
                  <button
                    onClick={() => removeMember(member.id)}
                    className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                    aria-label="メンバーを削除"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
        {eventData.members.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">メンバーを追加してください</div>
        )}
      </ul>
    </div>
  );
};
