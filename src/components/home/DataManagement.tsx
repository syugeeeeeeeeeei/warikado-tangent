import { Download, Share2 } from 'lucide-react';

interface DataManagementProps {
  onOpenShare: () => void;
  onExportCsv: () => void;
}

export const DataManagement = ({
  onOpenShare,
  onExportCsv,
}: DataManagementProps) => {
  return (
    // データ入出力の操作群をまとめたセクション。
    <section className="pt-4 border-t border-gray-200">
      <h3 className="text-sm font-bold text-gray-400 mb-3 ml-2">データ管理</h3>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onOpenShare}
          className="col-span-2 bg-orange-500 text-white border border-orange-600 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-orange-600 active:scale-95 transition-all shadow-sm"
        >
          <Share2 size={16} /> 共有リンクを作成
        </button>
        <button
          onClick={onExportCsv}
          className="col-span-2 bg-white text-gray-700 border border-gray-200 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
        >
          <Download size={16} /> CSV出力
        </button>
      </div>
    </section>
  );
};
