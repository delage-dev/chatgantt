import { useState, useCallback } from 'react';
import { Target, X, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { GanttTask } from '../types/gantt';

interface PriorityContextData {
  rationale: string;
  stakeholder_goals: string[];
  linked_objectives: string[];
}

interface PriorityContextProps {
  item: GanttTask;
  applyUpdate: (taskId: string, updates: Partial<GanttTask>) => void;
  canEdit: boolean;
}

export function PriorityContext({ item, applyUpdate, canEdit }: PriorityContextProps) {
  const meta = item.provider_meta as Record<string, unknown> | null;
  const ctx: PriorityContextData = (meta?.priority_context as PriorityContextData) ?? {
    rationale: '',
    stakeholder_goals: [],
    linked_objectives: [],
  };

  const hasContent = ctx.rationale || ctx.stakeholder_goals.length > 0 || ctx.linked_objectives.length > 0;

  const [editingRationale, setEditingRationale] = useState(false);
  const [draft, setDraft] = useState(ctx.rationale);
  const [newGoal, setNewGoal] = useState('');
  const [newObjective, setNewObjective] = useState('');

  const persist = useCallback(
    (updated: PriorityContextData) => {
      applyUpdate(item.id, { provider_meta: { priority_context: updated } } as any);
    },
    [item.id, applyUpdate]
  );

  const saveRationale = useCallback(() => {
    persist({ ...ctx, rationale: draft });
    setEditingRationale(false);
  }, [ctx, draft, persist]);

  const addGoal = useCallback(() => {
    const text = newGoal.trim();
    if (!text) return;
    persist({ ...ctx, stakeholder_goals: [...ctx.stakeholder_goals, text] });
    setNewGoal('');
  }, [ctx, newGoal, persist]);

  const removeGoal = useCallback(
    (idx: number) => {
      persist({ ...ctx, stakeholder_goals: ctx.stakeholder_goals.filter((_, i) => i !== idx) });
    },
    [ctx, persist]
  );

  const addObjective = useCallback(() => {
    const text = newObjective.trim();
    if (!text) return;
    persist({ ...ctx, linked_objectives: [...ctx.linked_objectives, text] });
    setNewObjective('');
  }, [ctx, newObjective, persist]);

  const removeObjective = useCallback(
    (idx: number) => {
      persist({ ...ctx, linked_objectives: ctx.linked_objectives.filter((_, i) => i !== idx) });
    },
    [ctx, persist]
  );

  if (!hasContent && !canEdit) return null;

  return (
    <section>
      <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold flex items-center gap-1 mb-2">
        <Target className="w-3 h-3" /> Priority Context
      </span>

      {/* Rationale */}
      <div className="mb-3">
        <label className="text-[9px] font-mono uppercase text-[#8C8278] mb-1 block">
          Why is this important?
        </label>
        {editingRationale ? (
          <div className="flex flex-col gap-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveRationale();
                if (e.key === 'Escape') { setDraft(ctx.rationale); setEditingRationale(false); }
              }}
              className="w-full min-h-[60px] p-2 bg-[#F5EFE2] border border-[#2C2824] font-mono text-[11px] resize-none outline-none focus:shadow-[1px_1px_0_0_rgba(44,40,36,0.4)]"
              placeholder="Explain the business value or urgency..."
              autoFocus
            />
            <div className="flex gap-1">
              <button onClick={saveRationale} className="px-2 py-0.5 bg-[#2C2824] text-[#EDE5D4] text-[9px] font-mono uppercase font-bold">Save</button>
              <button onClick={() => { setDraft(ctx.rationale); setEditingRationale(false); }} className="px-2 py-0.5 border border-[#2C2824]/30 text-[9px] font-mono uppercase font-bold">Cancel</button>
            </div>
          </div>
        ) : ctx.rationale ? (
          <div
            className={`text-[11px] leading-relaxed px-2 py-1.5 border border-[#2C2824]/10 bg-[#F5EFE2] ${canEdit ? 'cursor-pointer hover:border-[#2C2824]/30' : ''}`}
            onClick={canEdit ? () => { setDraft(ctx.rationale); setEditingRationale(true); } : undefined}
          >
            <div className="markdown-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{ctx.rationale}</ReactMarkdown>
            </div>
          </div>
        ) : canEdit ? (
          <button
            onClick={() => { setDraft(''); setEditingRationale(true); }}
            className="w-full text-left px-2 py-1.5 border border-dashed border-[#2C2824]/20 text-[#8C8278] text-[11px] hover:border-[#2C2824]/40 transition-colors"
          >
            Add rationale...
          </button>
        ) : null}
      </div>

      {/* Stakeholder Goals */}
      <div className="mb-3">
        <label className="text-[9px] font-mono uppercase text-[#8C8278] mb-1 block">
          Stakeholder Goals
        </label>
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {ctx.stakeholder_goals.map((goal, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#D4A017]/15 border border-[#D4A017]/30 text-[10px] font-mono"
            >
              {goal}
              {canEdit && (
                <button onClick={() => removeGoal(i)} className="hover:text-[#C4453A]">
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          ))}
          {ctx.stakeholder_goals.length === 0 && !canEdit && (
            <span className="text-[10px] text-[#8C8278]">None</span>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addGoal(); }}
              placeholder="Add goal..."
              className="flex-1 px-2 py-1 bg-[#F5EFE2] border border-dashed border-[#2C2824]/20 text-[10px] font-mono outline-none focus:border-[#2C2824]/40"
            />
            <button onClick={addGoal} disabled={!newGoal.trim()} className="px-1.5 border border-[#2C2824]/30 hover:bg-[#2C2824] hover:text-[#EDE5D4] disabled:opacity-30">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Linked Objectives */}
      <div>
        <label className="text-[9px] font-mono uppercase text-[#8C8278] mb-1 block">
          Linked Objectives
        </label>
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {ctx.linked_objectives.map((obj, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#9BA4C4]/15 border border-[#9BA4C4]/30 text-[10px] font-mono"
            >
              {obj}
              {canEdit && (
                <button onClick={() => removeObjective(i)} className="hover:text-[#C4453A]">
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          ))}
          {ctx.linked_objectives.length === 0 && !canEdit && (
            <span className="text-[10px] text-[#8C8278]">None</span>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-1">
            <input
              type="text"
              value={newObjective}
              onChange={(e) => setNewObjective(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addObjective(); }}
              placeholder="Link objective..."
              className="flex-1 px-2 py-1 bg-[#F5EFE2] border border-dashed border-[#2C2824]/20 text-[10px] font-mono outline-none focus:border-[#2C2824]/40"
            />
            <button onClick={addObjective} disabled={!newObjective.trim()} className="px-1.5 border border-[#2C2824]/30 hover:bg-[#2C2824] hover:text-[#EDE5D4] disabled:opacity-30">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
