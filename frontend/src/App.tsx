import { useCallback } from 'react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { Toaster } from 'sonner';
import { Header } from './components/Header';
import { GanttChart } from './components/GanttChart';
import { ItemDrawer } from './components/ItemDrawer';
import { ChatPanel } from './components/ChatPanel';
import { ProjectResources } from './components/ProjectResources';
import { useGanttData } from './hooks/useGanttData';
import { usePolling } from './hooks/usePolling';
import { usePermissions } from './hooks/usePermissions';
import { useBlockers } from './hooks/useBlockers';
import { useGanttStore } from './store/ganttStore';

export default function App() {
  const loading = useGanttStore((s) => s.loading);
  const error = useGanttStore((s) => s.error);
  const tasks = useGanttStore((s) => s.tasks);
  const selectedTaskId = useGanttStore((s) => s.selectedTaskId);
  const setSelectedTaskId = useGanttStore((s) => s.setSelectedTaskId);

  // Load data from backend
  useGanttData();
  usePolling();
  useBlockers(true); // Start polling blockers
  const { canEdit, user } = usePermissions();

  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId) || null
    : null;

  const handleSelectItem = useCallback(
    (taskId: string) => setSelectedTaskId(taskId),
    [setSelectedTaskId]
  );

  const handleCloseDrawer = useCallback(
    () => setSelectedTaskId(null),
    [setSelectedTaskId]
  );

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex flex-col h-screen w-full bg-[#EDE5D4] text-[#2C2824] font-sans selection:bg-[#2C2824] selection:text-[#EDE5D4]">
        <Header />

        <main className="flex-1 flex overflow-hidden relative">
          {loading && tasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="font-mono text-sm uppercase tracking-widest animate-pulse">
                  Loading...
                </div>
              </div>
            </div>
          ) : error && tasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="border-2 border-[#C4453A] bg-[#FFF2F0] p-6 max-w-md">
                <div className="font-mono text-xs uppercase text-[#C4453A] font-bold mb-2">
                  Error
                </div>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : (
            <GanttChart onSelectItem={handleSelectItem} canEdit={canEdit} />
          )}
        </main>

        <ItemDrawer item={selectedTask} onClose={handleCloseDrawer} canEdit={canEdit} user={user} />
        <ProjectResources />
        <ChatPanel />
        <Toaster position="bottom-center" richColors />
      </div>
    </TooltipProvider>
  );
}
