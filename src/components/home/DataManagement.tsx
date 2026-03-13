import { Download, Save, Upload } from 'lucide-react';
import type { ChangeEvent, RefObject } from 'react';

interface DataManagementProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onExportCsv: () => void;
  onSaveJson: () => void;
  onLoadJson: (event: ChangeEvent<HTMLInputElement>) => void;
}

export const DataManagement = ({
  fileInputRef,
  onExportCsv,
  onSaveJson,
  onLoadJson,
}: DataManagementProps) => {
  return (
    <section className="pt-4 border-t border-gray-200">
      <h3 className="text-sm font-bold text-gray-400 mb-3 ml-2">データ管理</h3>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onExportCsv}
          className="bg-white text-gray-700 border border-gray-200 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
        >
          <Download size={16} /> CSV出力
        </button>
        <button
          onClick={onSaveJson}
          className="bg-white text-gray-700 border border-gray-200 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
        >
          <Save size={16} /> セーブ(JSON)
        </button>
        <label className="col-span-2 bg-orange-100 text-orange-600 border border-orange-200 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-orange-200 active:scale-95 transition-all shadow-sm cursor-pointer">
          <Upload size={16} /> イベントを読み込む
          <input
            type="file"
            accept=".json"
            className="hidden"
            ref={fileInputRef}
            onChange={onLoadJson}
          />
        </label>
      </div>
    </section>
  );
};
