import { useState, useMemo } from 'react';
import { X, Link2, Plus, Trash2, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addDays, format } from 'date-fns';
import type { GanttTask, UserContext } from '../types/gantt';
import { parseDate, toISODate } from '../utils/dateUtils';
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';
import { useGanttStore } from '../store/ganttStore';
import { MarkdownDescription } from './MarkdownDescription';
import { AcceptanceCriteria } from './AcceptanceCriteria';
import { PriorityContext } from './PriorityContext';
import { DesignLinksTab } from './DesignLinksTab';
import { GitHubPRs } from './GitHubPRs';
import { TicketResources } from './TicketResources';
import { TicketComments } from './TicketComments';

type DrawerTab = 'details' | 'design' | 'resources' | 'comments';

interface ItemDrawerProps {
  item: GanttTask | null;
  onClose: () => void;
  canEdit?: boolean;
  user?: UserContext | null;
}

export function ItemDrawer({ item, onClose, canEdit = true, user = null }: ItemDrawerProps) {
  const { applyUpdate } = useOptimisticUpdate();
  const tasks = useGanttStore((s) => s.tasks);
  const [activeTab, setActiveTab] = useState<DrawerTab>('details');

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-[450px] bg-[#F5EFE2] border-l-4 border-[#2C2824] z-50 shadow-[-8px_0_0_0_rgba(44,40,36,0.8)] flex flex-col font-sans"
          >
            {/* Header */}
            <header className="h-16 border-b-2 border-[#2C2824] flex items-center justify-between px-6 bg-[#E4DBCA] flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="bg-[#2C2824] text-[#EDE5D4] text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1">
                  {item.id}
                </span>
                <span
                  className={`border-2 border-[#2C2824] text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1 ${
                    item.ticket_type === 'epic'
                      ? 'bg-[#2C2824] text-[#EDE5D4]'
                      : item.ticket_type === 'story'
                      ? 'bg-[#D8CFC0] text-[#2C2824]'
                      : 'bg-[#F5EFE2] text-[#2C2824]'
                  }`}
                >
                  {item.ticket_type}
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center border border-transparent hover:border-[#2C2824] hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors group"
              >
                <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </header>

            {/* Tabs */}
            <div className="flex border-b-2 border-[#2C2824] flex-shrink-0">
              {(['details', 'design', 'resources', 'comments'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-mono uppercase font-bold tracking-widest transition-colors ${
                    activeTab === tab
                      ? 'bg-[#2C2824] text-[#EDE5D4]'
                      : 'bg-[#F5EFE2] text-[#2C2824] hover:bg-[#E4DBCA] border-r border-[#2C2824]/15'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
              {activeTab === 'details' ? (
                <>
                  {/* Title */}
                  <section>
                    <h2 className="text-3xl font-black leading-tight tracking-tight mb-4">
                      {item.summary}
                    </h2>
                  </section>

                  {/* Description */}
                  <section>
                    <MarkdownDescription
                      value={item.description}
                      onChange={(desc) => applyUpdate(item.id, { description: desc })}
                      canEdit={canEdit}
                    />
                  </section>

                  {/* Priority Context */}
                  <PriorityContext item={item} applyUpdate={applyUpdate} canEdit={canEdit} />

                  {/* Meta Grid */}
                  <section className="grid grid-cols-2 gap-px bg-[#2C2824] border-2 border-[#2C2824]">
                    <div className="bg-[#F5EFE2] p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
                        Status
                      </span>
                      <span className="font-bold uppercase tracking-wider text-sm">
                        {item.status}
                      </span>
                    </div>
                    <div className="bg-[#F5EFE2] p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
                        Type
                      </span>
                      <span className="font-bold uppercase tracking-wider text-sm">
                        {item.ticket_type}
                      </span>
                    </div>
                    <div className="bg-[#F5EFE2] p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
                        Timeline
                      </span>
                      <span className="font-bold text-sm">
                        {item.start_date && item.end_date
                          ? `${format(parseDate(item.start_date), 'MMM dd')} - ${format(
                              parseDate(item.end_date),
                              'MMM dd'
                            )}`
                          : 'Unscheduled'}
                      </span>
                    </div>
                    <div className="bg-[#F5EFE2] p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
                        Assignee
                      </span>
                      {item.assignee ? (
                        <div className="flex items-center gap-2 mt-1">
                          {item.assignee.avatar_url ? (
                            <img
                              src={item.assignee.avatar_url}
                              alt={item.assignee.display_name}
                              className="w-8 h-8 rounded-none border-2 border-[#2C2824] object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-none border-2 border-[#2C2824] bg-[#E4DBCA] flex items-center justify-center text-xs font-bold">
                              {item.assignee.display_name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)}
                            </div>
                          )}
                          <span className="font-bold text-sm">
                            {item.assignee.display_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-[#8C8278]">Unassigned</span>
                      )}
                    </div>
                    {/* Tags / Domain */}
                    <div className="bg-[#F5EFE2] p-4 flex flex-col gap-1 col-span-2">
                      <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
                        Domain
                      </span>
                      <div className="flex gap-2 flex-wrap mt-1">
                        {(() => {
                          const meta = item.provider_meta as Record<string, unknown> | null;
                          const tags = (meta?.tags ?? []) as string[];
                          if (tags.length === 0) {
                            return (
                              <span className="text-sm text-[#8C8278]">No tags</span>
                            );
                          }
                          return tags.map((tag) => {
                            const isFE = ['frontend', 'ui', 'design'].includes(tag.toLowerCase());
                            const isBE = ['backend', 'api', 'infrastructure'].includes(tag.toLowerCase());
                            const bg = isFE
                              ? 'bg-[#9BA4C4]'
                              : isBE
                              ? 'bg-[#7FB5B0]'
                              : 'bg-[#D8CFC0]';
                            const textColor = isFE || isBE ? 'text-white' : 'text-[#2C2824]';
                            return (
                              <span
                                key={tag}
                                className={`${bg} ${textColor} text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1 border border-[#2C2824]/30`}
                              >
                                {tag}
                              </span>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </section>

                  {/* Pull Requests */}
                  <GitHubPRs item={item} applyUpdate={applyUpdate} canEdit={canEdit} />

                  {/* Dependencies section */}
                  <DependencySection item={item} tasks={tasks} applyUpdate={applyUpdate} canEdit={canEdit} />

                  {/* QA Estimate section */}
                  <QASection item={item} applyUpdate={applyUpdate} canEdit={canEdit} />

                  {/* Acceptance Criteria */}
                  <AcceptanceCriteria item={item} applyUpdate={applyUpdate} canEdit={canEdit} />
                </>
              ) : activeTab === 'design' ? (
                <DesignLinksTab item={item} applyUpdate={applyUpdate} canEdit={canEdit} />
              ) : activeTab === 'resources' ? (
                <TicketResources ticketId={item.id} />
              ) : activeTab === 'comments' ? (
                <TicketComments ticketId={item.id} user={user} />
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Dependency Section ──────────────────────────────────────────────────────

interface DepSectionProps {
  item: GanttTask;
  tasks: GanttTask[];
  applyUpdate: (taskId: string, updates: Partial<GanttTask>) => void;
  canEdit?: boolean;
}

function DependencySection({ item, tasks, applyUpdate, canEdit = true }: DepSectionProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const currentDeps = item.dependencies || [];
  const depTasks = currentDeps
    .map((depId) => tasks.find((t) => t.id === depId))
    .filter(Boolean) as GanttTask[];

  // Tasks available to add as dependencies (exclude self, already-added, and circular)
  const availableTasks = useMemo(() => {
    const currentDepSet = new Set(currentDeps);
    return tasks.filter((t) => {
      if (t.id === item.id) return false;
      if (currentDepSet.has(t.id)) return false;
      // Simple cycle check: does target already depend on us?
      if (wouldCreateCycle(item.id, t.id, tasks)) return false;
      if (search && !t.id.toLowerCase().includes(search.toLowerCase()) && !t.summary.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, item.id, currentDeps, search]);

  const removeDep = (depId: string) => {
    applyUpdate(item.id, { dependencies: currentDeps.filter((d) => d !== depId) } as any);
  };

  const addDep = (depId: string) => {
    applyUpdate(item.id, { dependencies: [...currentDeps, depId] } as any);
    setShowAdd(false);
    setSearch('');
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold flex items-center gap-1">
          <Link2 className="w-3 h-3" /> Dependencies
        </span>
        {canEdit && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 border border-[#2C2824]/30 hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors"
          >
            {showAdd ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>

      {depTasks.length > 0 ? (
        <div className="flex flex-col gap-1.5 mb-2">
          {depTasks.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center gap-2 px-2 py-1.5 border border-[#2C2824]/20 bg-[#F5EFE2]"
            >
              <span className="bg-[#2C2824] text-[#EDE5D4] text-[8px] font-mono font-bold px-1 py-0.5">
                {dep.id}
              </span>
              <span className="text-[11px] flex-1 truncate">{dep.summary}</span>
              {canEdit && (
                <button
                  onClick={() => removeDep(dep.id)}
                  className="w-5 h-5 flex items-center justify-center text-[#8C8278] hover:text-[#C4453A] flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        !showAdd && (
          <p className="text-xs text-[#8C8278] mb-2">No dependencies</p>
        )
      )}

      {showAdd && (
        <div className="border border-[#2C2824]/20 bg-[#F5EFE2] p-2 mb-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full px-2 py-1 bg-[#F5EFE2] border border-[#2C2824]/20 text-xs font-mono outline-none mb-2 focus:border-[#2C2824]"
            autoFocus
          />
          <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
            {availableTasks.slice(0, 10).map((t) => (
              <button
                key={t.id}
                onClick={() => addDep(t.id)}
                className="flex items-center gap-2 px-2 py-1 text-left hover:bg-[#E4DBCA] transition-colors w-full"
              >
                <span className="text-[8px] font-mono font-bold bg-[#D8CFC0] px-1 py-0.5 flex-shrink-0">
                  {t.id}
                </span>
                <span className="text-[10px] truncate">{t.summary}</span>
              </button>
            ))}
            {availableTasks.length === 0 && (
              <p className="text-[10px] text-[#8C8278] text-center py-2">No matching tasks</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Check if adding depId as a dependency of taskId would create a cycle */
function wouldCreateCycle(taskId: string, depId: string, tasks: GanttTask[]): boolean {
  const visited = new Set<string>();
  function walk(id: string): boolean {
    if (id === taskId) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const task = tasks.find((t) => t.id === id);
    if (!task?.dependencies) return false;
    return task.dependencies.some((d) => walk(d));
  }
  return walk(depId);
}

// ─── QA Estimate Section ─────────────────────────────────────────────────────

interface QASectionProps {
  item: GanttTask;
  applyUpdate: (taskId: string, updates: Partial<GanttTask>) => void;
  canEdit?: boolean;
}

function QASection({ item, applyUpdate, canEdit = true }: QASectionProps) {
  const hasQA = item.qa_start_date && item.qa_end_date;

  const handleAddQA = () => {
    if (!item.end_date) return;
    const dayAfter = addDays(parseDate(item.end_date), 1);
    const twoDaysAfter = addDays(parseDate(item.end_date), 2);
    applyUpdate(item.id, {
      qa_start_date: toISODate(dayAfter),
      qa_end_date: toISODate(twoDaysAfter),
    } as any);
  };

  const handleRemoveQA = () => {
    applyUpdate(item.id, {
      qa_start_date: null,
      qa_end_date: null,
      clear_qa: true,
    } as any);
  };

  return (
    <section>
      <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold flex items-center gap-1 mb-2">
        <Shield className="w-3 h-3" /> QA Estimate
      </span>

      {hasQA ? (
        <div className="flex items-center justify-between px-3 py-2 border border-[#2C2824]/20 bg-[#F5EFE2]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-3 qa-stripe border border-[#2C2824]/20" />
            <span className="font-bold text-sm">
              {format(parseDate(item.qa_start_date!), 'MMM dd')} -{' '}
              {format(parseDate(item.qa_end_date!), 'MMM dd')}
            </span>
          </div>
          {canEdit && (
            <button
              onClick={handleRemoveQA}
              className="flex items-center gap-1 text-[10px] font-mono uppercase font-bold px-2 py-0.5 text-[#C4453A] border border-[#C4453A]/30 hover:bg-[#C4453A] hover:text-white transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          )}
        </div>
      ) : canEdit ? (
        <button
          onClick={handleAddQA}
          disabled={!item.end_date}
          className="w-full py-2 text-xs font-mono uppercase font-bold tracking-wider border-2 border-dashed border-[#2C2824]/20 text-[#8C8278] hover:border-[#2C2824]/40 hover:text-[#5C564E] transition-colors disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5 inline mr-1" />
          Add QA Buffer
        </button>
      ) : (
        <p className="text-xs text-[#8C8278]">No QA estimate</p>
      )}
    </section>
  );
}
