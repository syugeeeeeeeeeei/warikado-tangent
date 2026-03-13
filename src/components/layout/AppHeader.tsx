import { ArrowLeft } from 'lucide-react';
import type { ViewState } from '../../types/domain';

interface AppHeaderProps {
  currentView: ViewState;
  eventName: string;
  onEventNameChange: (name: string) => void;
  onBackHome: () => void;
}

export const AppHeader = ({
  currentView,
  eventName,
  onEventNameChange,
  onBackHome,
}: AppHeaderProps) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md shadow-sm border-b border-orange-100">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        {currentView !== 'home' ? (
          <button
            onClick={onBackHome}
            className="p-2 -ml-2 text-orange-500 hover:bg-orange-100 rounded-full transition-colors flex items-center gap-1"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-bold">戻る</span>
          </button>
        ) : (
          <div className="w-8" />
        )}

        <div className="flex flex-col items-center flex-1">
          <h1 className="text-xl font-extrabold text-orange-600 tracking-tight">勾配割り勘ツール</h1>
          {currentView === 'home' ? (
            <input
              type="text"
              value={eventName}
              onChange={(event) => onEventNameChange(event.target.value)}
              className="bg-transparent text-center text-sm font-bold text-gray-500 focus:outline-none w-full max-w-[250px] placeholder-gray-300 mt-0.5 border-b border-transparent focus:border-orange-200 transition-colors"
              placeholder="イベント名を入力"
            />
          ) : (
            <h2 className="text-sm font-bold text-gray-500 truncate max-w-[200px] mt-0.5">
              {eventName || 'イベント名未設定'}
            </h2>
          )}
        </div>

        <div className="w-8" />
      </div>
    </header>
  );
};
