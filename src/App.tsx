import { useState } from 'react';
import { AppHeader } from './components/layout/AppHeader';
import { FabMenu } from './components/layout/FabMenu';
import { Toast } from './components/layout/Toast';
import { useToast } from './hooks/useToast';
import { ExpenseManageView } from './views/ExpenseManageView';
import { HomeView } from './views/HomeView';
import { MemberManageView } from './views/MemberManageView';
import type { EventData, ViewState } from './types/domain';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const [eventData, setEventData] = useState<EventData>({
    name: '',
    members: [],
    expenses: [],
  });

  const { toastMessage, showToast } = useToast();

  const getMemberName = (memberId: string) => {
    return eventData.members.find((member) => member.id === memberId)?.name || '不明';
  };

  const closeFabMenu = () => setIsFabMenuOpen(false);

  const navigateTo = (view: ViewState, id: string | null = null) => {
    setCurrentView(view);
    setEditingExpenseId(id);
    closeFabMenu();
  };

  return (
    <div className="min-h-screen bg-orange-50 text-gray-800 font-sans flex flex-col relative selection:bg-orange-200">
      <AppHeader
        currentView={currentView}
        eventName={eventData.name}
        onEventNameChange={(name) => setEventData({ ...eventData, name })}
        onBackHome={() => navigateTo('home')}
      />

      <main className="flex-1 overflow-y-auto p-4 pb-28 max-w-md mx-auto w-full">
        {currentView === 'home' && (
          <HomeView
            eventData={eventData}
            setEventData={setEventData}
            getMemberName={getMemberName}
            navigateTo={navigateTo}
            showToast={showToast}
          />
        )}

        {currentView === 'manage_members' && (
          <MemberManageView eventData={eventData} setEventData={setEventData} />
        )}

        {currentView === 'manage_expenses' && (
          <ExpenseManageView
            key={editingExpenseId || 'new'}
            eventData={eventData}
            setEventData={setEventData}
            editingExpenseId={editingExpenseId}
            navigateTo={navigateTo}
          />
        )}
      </main>

      {currentView === 'home' && (
        <FabMenu
          isOpen={isFabMenuOpen}
          onToggle={() => setIsFabMenuOpen((prev) => !prev)}
          onClose={closeFabMenu}
          onAddExpense={() => navigateTo('manage_expenses', null)}
          onManageMembers={() => navigateTo('manage_members', null)}
        />
      )}

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
}
