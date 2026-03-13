import { Users } from 'lucide-react';
import type { Member } from '../../types/domain';

interface MemberListProps {
  members: Member[];
  onManageMembers: () => void;
}

export const MemberList = ({ members, onManageMembers }: MemberListProps) => {
  return (
    <section>
      <div className="flex justify-between items-end mb-3 px-1">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Users size={20} className="text-emerald-500" /> メンバー
        </h2>
        <button
          onClick={onManageMembers}
          className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full"
        >
          管理
        </button>
      </div>
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-emerald-100/50 flex flex-wrap gap-2">
        {members.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-4 w-full">登録なし</p>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-full text-sm border border-emerald-100"
            >
              {member.name}
            </div>
          ))
        )}
      </div>
    </section>
  );
};
