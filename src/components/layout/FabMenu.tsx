import { Plus, Receipt, Users } from 'lucide-react';

interface FabMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAddExpense: () => void;
  onManageMembers: () => void;
}

export const FabMenu = ({
  isOpen,
  onToggle,
  onClose,
  onAddExpense,
  onManageMembers,
}: FabMenuProps) => {
  return (
    <>
      {/* メニュー展開時は背景クリックで閉じられるようにオーバーレイを表示する。 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/5 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* サブアクションは展開中のみ表示し、主要導線を邪魔しない。 */}
        {isOpen && (
          <div className="flex flex-col gap-3 mb-2 animate-fade-in-up origin-bottom">
            <button
              onClick={onAddExpense}
              className="flex items-center gap-3 bg-white px-4 py-3 rounded-full shadow-lg border border-orange-100 hover:bg-orange-50 active:scale-95 transition-all text-orange-600 font-bold text-sm"
            >
              <Receipt size={18} /> 精算項目を追加
            </button>
            <button
              onClick={onManageMembers}
              className="flex items-center gap-3 bg-white px-4 py-3 rounded-full shadow-lg border border-orange-100 hover:bg-orange-50 active:scale-95 transition-all text-orange-600 font-bold text-sm"
            >
              <Users size={18} /> メンバーを管理
            </button>
          </div>
        )}

        {/* トグルボタンは開閉状態を回転・色で明示する。 */}
        <button
          onClick={onToggle}
          className={`w-14 h-14 flex items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 ${
            isOpen
              ? 'bg-gray-700 rotate-45'
              : 'bg-orange-500 hover:bg-orange-600 hover:scale-105 active:scale-95'
          }`}
        >
          <Plus size={32} />
        </button>
      </div>
    </>
  );
};
