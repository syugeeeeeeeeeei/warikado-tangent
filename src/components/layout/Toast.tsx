interface ToastProps {
  message: string;
}

export const Toast = ({ message }: ToastProps) => {
  return (
    // 画面上部固定の軽量通知。表示制御は useToast 側で行う。
    <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-xl z-50 animate-fade-in text-sm font-medium">
      {message}
    </div>
  );
};
