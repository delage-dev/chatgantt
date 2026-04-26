import { useMemo, useState, useEffect } from 'react';
import { Phone, Ban } from 'lucide-react';
import { SyncDropdown } from './SyncDropdown';
import { VoiceSettings } from './VoiceSettings';
import { BlockersDrawer } from './BlockersDrawer';
import { useGanttStore } from '../store/ganttStore';
import { useBlockerStore } from '../store/blockerStore';
import { useBlockers } from '../hooks/useBlockers';
import { usePermissions } from '../hooks/usePermissions';

export function Header() {
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const tasks = useGanttStore((s) => s.tasks);
  const activeProject = useGanttStore((s) => s.activeProject);
  const setActiveProject = useGanttStore((s) => s.setActiveProject);
  const { activeCount } = useBlockers();
  const { canEdit } = usePermissions();
  const drawerOpen = useBlockerStore((s) => s.drawerOpen);
  const openDrawer = useBlockerStore((s) => s.openDrawer);
  const closeDrawer = useBlockerStore((s) => s.closeDrawer);

  // Allow Ctrl+B to open the drawer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        if (drawerOpen) closeDrawer();
        else openDrawer();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawerOpen, openDrawer, closeDrawer]);

  const projectNames = useMemo(() => {
    const names = new Set<string>();
    for (const t of tasks) {
      if (t.ticket_type === 'epic') {
        const meta = t.provider_meta as Record<string, unknown> | null;
        const name = meta?.project_name;
        if (typeof name === 'string') names.add(name);
      }
    }
    return Array.from(names).sort();
  }, [tasks]);

  return (
    <header className="flex-none border-b border-[#2C2824]/20 h-16 flex items-center justify-between px-6 bg-[#F5EFE2] z-10">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-[#2C2824] text-[#EDE5D4] flex items-center justify-center font-bold font-mono text-xl">
          G
        </div>
        <h1 className="font-bold tracking-tight uppercase text-lg hidden sm:block">
          ChatGantt
        </h1>

        {/* Feature 2: Project selector */}
        {projectNames.length > 0 && (
          <select
            value={activeProject || ''}
            onChange={(e) => setActiveProject(e.target.value || null)}
            className="ml-4 h-9 px-3 bg-[#F5EFE2] border border-[#2C2824]/30 text-xs font-mono uppercase font-bold tracking-wider cursor-pointer outline-none hover:border-[#2C2824] transition-colors"
          >
            <option value="">All Projects</option>
            {projectNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => openDrawer()}
          className="relative w-9 h-9 flex items-center justify-center border border-[#2C2824]/30 hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors"
          title="Blockers (Ctrl+B)"
        >
          <Ban className="w-4 h-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-[#C4453A] text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowVoiceSettings(true)}
          className="w-9 h-9 flex items-center justify-center border border-[#2C2824]/30 hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors"
          title="Voice Settings"
        >
          <Phone className="w-4 h-4" />
        </button>
        <SyncDropdown />
      </div>

      <VoiceSettings isOpen={showVoiceSettings} onClose={() => setShowVoiceSettings(false)} />
      <BlockersDrawer isOpen={drawerOpen} onClose={closeDrawer} canEdit={canEdit} />
    </header>
  );
}
