import { useCallback, useEffect, useRef, useState } from 'react';

export const useToast = () => {
  // 表示中メッセージ。null のときは非表示。
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // 連続表示時に前のタイマーを確実に破棄するため ID を保持する。
  const timeoutRef = useRef<number | null>(null);

  // 新しいトーストを表示し、3秒後に自動で閉じる。
  const showToast = useCallback((message: string) => {
    setToastMessage(message);

    // 既存タイマーがある場合は先に止めて、表示時間を最新メッセージに合わせる。
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      timeoutRef.current = null;
    }, 3000);
  }, []);

  // unmount 時にタイマーを破棄し、不要な state 更新を防ぐ。
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { toastMessage, showToast };
};
