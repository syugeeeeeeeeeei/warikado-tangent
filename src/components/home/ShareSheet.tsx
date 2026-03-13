import { Copy, Save, Share2, X } from 'lucide-react';

interface ShareSheetProps {
  isOpen: boolean;
  isLoading: boolean;
  isNativeShareSupported: boolean;
  shareUrl: string;
  errorMessage: string | null;
  urlLength: number;
  recommendedLength: number;
  warningLength: number;
  onClose: () => void;
  onCopyLink: () => void;
  onNativeShare: () => void;
  onSaveJson: () => void;
}

export const ShareSheet = ({
  isOpen,
  isLoading,
  isNativeShareSupported,
  shareUrl,
  errorMessage,
  urlLength,
  recommendedLength,
  warningLength,
  onClose,
  onCopyLink,
  onNativeShare,
  onSaveJson,
}: ShareSheetProps) => {
  if (!isOpen) return null;

  const isOverRecommended = urlLength > recommendedLength;
  const isOverWarning = urlLength > warningLength;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        aria-label="共有シートを閉じる"
      />

      <section className="relative w-full max-w-md bg-white rounded-t-3xl p-5 shadow-2xl border-t border-gray-100 animate-fade-in-up">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="閉じる"
        >
          <X size={18} />
        </button>

        <h3 className="text-lg font-bold text-gray-800">共有リンク</h3>
        <p className="text-xs text-gray-500 mt-1">
          「リンクをコピー」または「他アプリで共有」でデータを渡せます。
        </p>

        {isLoading && (
          <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700">
            リンクを生成中です...
          </div>
        )}

        {errorMessage && !isLoading && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && shareUrl && (
          <>
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 break-all text-[11px] text-gray-600 max-h-24 overflow-y-auto">
              {shareUrl}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              URL長: {urlLength}文字（推奨: {recommendedLength}文字以下）
            </p>
            {isOverRecommended && !isOverWarning && (
              <p className="text-xs text-amber-600 mt-1">
                URLが長めです。共有先によっては開けない場合があります。
              </p>
            )}
            {isOverWarning && (
              <p className="text-xs text-red-600 mt-1">
                URLが長すぎます。共有できない場合は JSON 保存を使ってください。
              </p>
            )}
          </>
        )}

        <div className="mt-4 space-y-2">
          <button
            onClick={onCopyLink}
            className="w-full bg-sky-500 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-sky-600 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            disabled={isLoading}
          >
            <Copy size={16} /> リンクをコピー
          </button>

          {isNativeShareSupported && (
            <button
              onClick={onNativeShare}
              className="w-full bg-white text-sky-700 border border-sky-200 rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-sky-50 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
              disabled={isLoading}
            >
              <Share2 size={16} /> 他アプリで共有
            </button>
          )}

          <button
            onClick={onSaveJson}
            className="w-full bg-gray-50 text-gray-700 border border-gray-200 rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            disabled={isLoading}
          >
            <Save size={16} /> JSONで保存
          </button>
        </div>
      </section>
    </div>
  );
};
