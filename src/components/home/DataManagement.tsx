import { Copy, Download, Share2 } from 'lucide-react';

interface DataManagementProps {
  onExportCsv: () => void;
  onCopyShareUrl: () => void;
  onShareUrl: () => void;
  canNativeShare: boolean;
}

export const DataManagement = ({
  onExportCsv,
  onCopyShareUrl,
  onShareUrl,
  canNativeShare,
}: DataManagementProps) => {
  return (
    <section className="pt-4 border-t border-gray-200">
      <h3 className="text-sm font-bold text-gray-400 mb-3 ml-2">データ管理</h3>
      <div className="grid grid-cols-1 gap-3">
        <button
          onClick={onExportCsv}
          className="bg-white text-gray-700 border border-gray-200 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
        >
          <Download size={16} /> CSV出力
        </button>

        <button
          onClick={onCopyShareUrl}
          className="bg-white text-sky-700 border border-sky-200 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-sky-50 active:scale-95 transition-all shadow-sm"
        >
          <Copy size={16} /> 共有URLをコピー
        </button>

        <button
          onClick={onShareUrl}
          className="bg-orange-100 text-orange-700 border border-orange-200 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-orange-200 active:scale-95 transition-all shadow-sm"
        >
          <Share2 size={16} />
          {canNativeShare ? '他アプリで共有' : '共有機能がないためURLコピー'}
        </button>
      </div>
    </section>
  );
};
