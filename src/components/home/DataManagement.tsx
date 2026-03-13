import { Download, Share2, Upload } from 'lucide-react';
import type { ChangeEvent, RefObject } from 'react';

interface DataManagementProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onOpenShare: () => void;
  onExportCsv: () => void;
  onLoadJson: (event: ChangeEvent<HTMLInputElement>) => void;
}

export const DataManagement = ({
  fileInputRef,
  onOpenShare,
  onExportCsv,
  onLoadJson,
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
          className="bg-white text-gray-700 border border-gray-200 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
        >
          <Download size={16} /> CSV出力
        </button>
        <label className="bg-orange-100 text-orange-600 border border-orange-200 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-orange-200 active:scale-95 transition-all shadow-sm cursor-pointer">
          <Upload size={16} /> JSONをロード
          <input
            type="file"
            accept=".json"
            // 見た目はラベルをボタン化し、input 自体は隠す。
            className="hidden"
            ref={fileInputRef}
            onChange={onLoadJson}
          />
        </label>
      </div>
    </section>
  );
};
