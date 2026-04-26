import { useState, useMemo, useCallback, useEffect } from 'react';
import { X, Ban, Plus, Trash2, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useBlockers } from '../hooks/useBlockers';
import { useGanttStore } from '../store/ganttStore';
import { useBlockerStore } from '../store/blockerStore';
import type { Blocker, BlockerSeverity } from '../types/blockers';

interface BlockersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  canEdit: boolean;
}

const SEVERITY_ORDER: Record<BlockerSeverity, number> = { high: 0, medium: 1, low: 2 };

const SEVERITY_STYLES: Record<BlockerSeverity, string> = {
  high: 'bg-[#C4453A]/15 border-[#C4453A]/40 text-[#C4453A]',
  medium: 'bg-[#D4A017]/15 border-[#D4A017]/40 text-[#8B6F0F]',
  low: 'bg-[#7FB5B0]/15 border-[#7FB5B0]/40 text-[#4A8A84]',
};

export function BlockersDrawer({ isOpen, onClose, canEdit }: BlockersDrawerProps) {
  const { blockers, activeBlockers, createBlocker, resolveBlocker, deleteBlocker } = useBlockers();
  const tasks = useGanttStore((s) => s.tasks);
  const setSelectedTaskId = useGanttStore((s) => s.setSelectedTaskId);
  const drawerPrefill = useBlockerStore((s) => s.drawerPrefill);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<BlockerSeverity | null>(null);

  // Add form state
  const [blockedTaskId, setBlockedTaskId] = useState('');
  const [blockingTaskId, setBlockingTaskId] = useState('');
  const [externalBlocker, setExternalBlocker] = useState('');
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState<BlockerSeverity>('medium');
  const [isExternal, setIsExternal] = useState(false);

  // Apply prefill when drawer opens with prefill set
  useEffect(() => {
    if (isOpen && drawerPrefill?.blocked_task_id) {
      setBlockedTaskId(drawerPrefill.blocked_task_id);
      setShowAddForm(true);
    }
  }, [isOpen, drawerPrefill]);

  const tasksById = useMemo(() => {
    const m = new Map<string, typeof tasks[number]>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  const taskLabel = useCallback(
    (id: string | null) => {
      if (!id) return '';
      const t = tasksById.get(id);
      return t ? `${t.id} ${t.summary}` : id;
    },
    [tasksById]
  );

  const filteredActive = useMemo(() => {
    let list = activeBlockers;
    if (severityFilter) list = list.filter((b) => b.severity === severityFilter);
    return [...list].sort((a, b) => {
      const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [activeBlockers, severityFilter]);

  const resolvedBlockers = useMemo(
    () => blockers.filter((b) => b.status === 'resolved').sort((a, b) =>
      (b.resolved_at || '').localeCompare(a.resolved_at || '')
    ),
    [blockers]
  );

  const handleSubmit = useCallback(async () => {
    if (!blockedTaskId || !reason.trim()) return;
    if (!isExternal && !blockingTaskId) return;
    if (isExternal && !externalBlocker.trim()) return;

    try {
      await createBlocker({
        blocked_task_id: blockedTaskId,
        blocking_task_id: isExternal ? undefined : blockingTaskId,
        external_blocker: isExternal ? externalBlocker.trim() : undefined,
        reason: reason.trim(),
        severity,
      });
      // Reset form
      setBlockedTaskId('');
      setBlockingTaskId('');
      setExternalBlocker('');
      setReason('');
      setSeverity('medium');
      setIsExternal(false);
      setShowAddForm(false);
    } catch {
      // Error already in store
    }
  }, [blockedTaskId, blockingTaskId, externalBlocker, reason, severity, isExternal, createBlocker]);

  const handleTaskClick = useCallback((id: string) => {
    setSelectedTaskId(id);
  }, [setSelectedTaskId]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-[600px] bg-[#F5EFE2] border-l-4 border-[#2C2824] z-50 shadow-[-8px_0_0_0_rgba(44,40,36,0.8)] flex flex-col font-sans"
          >
            {/* Header */}
            <header className="h-16 border-b-2 border-[#2C2824] flex items-center justify-between px-6 bg-[#E4DBCA] flex-shrink-0">
              <div className="flex items-center gap-3">
                <Ban className="w-5 h-5" />
                <h2 className="font-mono text-sm font-black uppercase tracking-widest">
                  Blockers
                </h2>
                <span className="bg-[#C4453A] text-white text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1">
                  {activeBlockers.length} active
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center border border-transparent hover:border-[#2C2824] hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
              {/* Add Blocker section */}
              {canEdit && (
                <section className="border-2 border-[#2C2824]/20">
                  <button
                    onClick={() => setShowAddForm((s) => !s)}
                    className="w-full px-4 py-2 bg-[#E4DBCA] flex items-center justify-between text-[10px] font-mono uppercase font-bold tracking-widest hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5" /> Add Blocker
                    </span>
                    {showAddForm ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>

                  {showAddForm && (
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-mono uppercase text-[#8C8278] font-bold">
                          Blocked Task
                        </label>
                        <select
                          value={blockedTaskId}
                          onChange={(e) => setBlockedTaskId(e.target.value)}
                          className="px-2 py-1.5 bg-[#F5EFE2] border border-[#2C2824]/30 text-xs font-mono outline-none focus:border-[#2C2824]"
                        >
                          <option value="">Select task...</option>
                          {tasks.map((t) => (
                            <option key={t.id} value={t.id}>{t.id} — {t.summary}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsExternal(false)}
                          className={`flex-1 py-1 text-[10px] font-mono uppercase font-bold border-2 transition-colors ${
                            !isExternal ? 'bg-[#2C2824] text-[#EDE5D4] border-[#2C2824]' : 'bg-[#F5EFE2] border-[#2C2824]/30'
                          }`}
                        >
                          Internal
                        </button>
                        <button
                          onClick={() => setIsExternal(true)}
                          className={`flex-1 py-1 text-[10px] font-mono uppercase font-bold border-2 transition-colors ${
                            isExternal ? 'bg-[#2C2824] text-[#EDE5D4] border-[#2C2824]' : 'bg-[#F5EFE2] border-[#2C2824]/30'
                          }`}
                        >
                          External
                        </button>
                      </div>

                      {isExternal ? (
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-mono uppercase text-[#8C8278] font-bold">
                            External Blocker
                          </label>
                          <input
                            type="text"
                            value={externalBlocker}
                            onChange={(e) => setExternalBlocker(e.target.value)}
                            placeholder="e.g. Waiting on legal sign-off"
                            className="px-2 py-1.5 bg-[#F5EFE2] border border-[#2C2824]/30 text-xs font-mono outline-none focus:border-[#2C2824]"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-mono uppercase text-[#8C8278] font-bold">
                            Blocking Task
                          </label>
                          <select
                            value={blockingTaskId}
                            onChange={(e) => setBlockingTaskId(e.target.value)}
                            className="px-2 py-1.5 bg-[#F5EFE2] border border-[#2C2824]/30 text-xs font-mono outline-none focus:border-[#2C2824]"
                          >
                            <option value="">Select task...</option>
                            {tasks.filter((t) => t.id !== blockedTaskId).map((t) => (
                              <option key={t.id} value={t.id}>{t.id} — {t.summary}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-mono uppercase text-[#8C8278] font-bold">
                          Reason
                        </label>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          rows={3}
                          placeholder="Explain what's blocked and why..."
                          className="px-2 py-1.5 bg-[#F5EFE2] border border-[#2C2824]/30 text-xs font-sans outline-none focus:border-[#2C2824] resize-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-mono uppercase text-[#8C8278] font-bold">
                          Severity
                        </label>
                        <div className="flex gap-2">
                          {(['low', 'medium', 'high'] as BlockerSeverity[]).map((s) => (
                            <button
                              key={s}
                              onClick={() => setSeverity(s)}
                              className={`flex-1 py-1 text-[10px] font-mono uppercase font-bold border-2 transition-colors ${
                                severity === s ? SEVERITY_STYLES[s] : 'bg-[#F5EFE2] border-[#2C2824]/20 text-[#8C8278]'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleSubmit}
                        disabled={!blockedTaskId || !reason.trim() || (isExternal ? !externalBlocker.trim() : !blockingTaskId)}
                        className="px-3 py-2 bg-[#2C2824] text-[#EDE5D4] text-xs font-mono uppercase font-bold tracking-wider border-2 border-[#2C2824] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.8)] disabled:opacity-40 disabled:cursor-not-allowed transition-shadow"
                      >
                        Create Blocker
                      </button>
                    </div>
                  )}
                </section>
              )}

              {/* Severity filter */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono uppercase text-[#8C8278] font-bold">Filter:</span>
                <button
                  onClick={() => setSeverityFilter(null)}
                  className={`px-2 py-0.5 text-[10px] font-mono uppercase font-bold border ${
                    severityFilter === null ? 'bg-[#2C2824] text-[#EDE5D4] border-[#2C2824]' : 'border-[#2C2824]/20'
                  }`}
                >
                  All
                </button>
                {(['high', 'medium', 'low'] as BlockerSeverity[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverityFilter(severityFilter === s ? null : s)}
                    className={`px-2 py-0.5 text-[10px] font-mono uppercase font-bold border ${
                      severityFilter === s ? SEVERITY_STYLES[s] : 'border-[#2C2824]/20'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Active blockers */}
              <section>
                <h3 className="text-[10px] font-mono uppercase font-bold tracking-widest text-[#2C2824] mb-2">
                  Active ({filteredActive.length})
                </h3>
                {filteredActive.length === 0 ? (
                  <p className="text-xs text-[#8C8278] py-4 text-center">No active blockers</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredActive.map((b) => (
                      <BlockerCard
                        key={b.id}
                        blocker={b}
                        canEdit={canEdit}
                        onResolve={() => resolveBlocker(b.id)}
                        onDelete={() => deleteBlocker(b.id)}
                        onTaskClick={handleTaskClick}
                        taskLabel={taskLabel}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Resolved blockers */}
              {resolvedBlockers.length > 0 && (
                <section>
                  <button
                    onClick={() => setShowResolved((s) => !s)}
                    className="w-full text-left text-[10px] font-mono uppercase font-bold tracking-widest text-[#8C8278] flex items-center gap-1 mb-2"
                  >
                    {showResolved ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Resolved ({resolvedBlockers.length})
                  </button>
                  {showResolved && (
                    <div className="flex flex-col gap-2 opacity-60">
                      {resolvedBlockers.map((b) => (
                        <BlockerCard
                          key={b.id}
                          blocker={b}
                          canEdit={canEdit}
                          onResolve={() => resolveBlocker(b.id)}
                          onDelete={() => deleteBlocker(b.id)}
                          onTaskClick={handleTaskClick}
                          taskLabel={taskLabel}
                          resolved
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface BlockerCardProps {
  blocker: Blocker;
  canEdit: boolean;
  onResolve: () => void;
  onDelete: () => void;
  onTaskClick: (id: string) => void;
  taskLabel: (id: string | null) => string;
  resolved?: boolean;
}

function BlockerCard({ blocker, canEdit, onResolve, onDelete, onTaskClick, taskLabel, resolved = false }: BlockerCardProps) {
  const age = useMemo(() => {
    try {
      return formatDistanceToNow(parseISO(blocker.created_at), { addSuffix: true });
    } catch {
      return blocker.created_at;
    }
  }, [blocker.created_at]);

  return (
    <div className="border border-[#2C2824]/20 bg-[#F5EFE2] p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onTaskClick(blocker.blocked_task_id)}
          className="bg-[#2C2824] text-[#EDE5D4] text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 hover:bg-[#5C564E]"
          title={taskLabel(blocker.blocked_task_id)}
        >
          {blocker.blocked_task_id}
        </button>
        <span className="text-[#8C8278] font-mono text-xs">←</span>
        {blocker.blocking_task_id ? (
          <button
            onClick={() => onTaskClick(blocker.blocking_task_id!)}
            className="bg-[#D8CFC0] text-[#2C2824] text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 border border-[#2C2824]/30 hover:bg-[#E4DBCA]"
            title={taskLabel(blocker.blocking_task_id)}
          >
            {blocker.blocking_task_id}
          </button>
        ) : (
          <span className="text-[10px] font-mono italic text-[#8C8278]">
            {blocker.external_blocker}
          </span>
        )}
        <span className={`ml-auto text-[8px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 border ${SEVERITY_STYLES[blocker.severity]}`}>
          {blocker.severity}
        </span>
      </div>

      <div className="text-xs leading-relaxed text-[#2C2824] markdown-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{blocker.reason}</ReactMarkdown>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono text-[#8C8278]">{age}</span>
        {resolved && blocker.auto_resolved && (
          <span className="text-[8px] font-mono font-bold uppercase px-1 py-0.5 border border-[#7FB5B0]/40 bg-[#7FB5B0]/10 text-[#4A8A84]">
            Auto-resolved
          </span>
        )}
        {canEdit && !resolved && (
          <div className="ml-auto flex gap-1">
            <button
              onClick={onResolve}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase font-bold text-[#7FB5B0] border border-[#7FB5B0]/40 hover:bg-[#7FB5B0] hover:text-white transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" /> Resolve
            </button>
            <button
              onClick={onDelete}
              className="flex items-center px-1.5 py-0.5 text-[10px] text-[#8C8278] hover:text-[#C4453A] border border-[#2C2824]/20 hover:border-[#C4453A]/40 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
