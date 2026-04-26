import { useState, useCallback } from 'react';
import { CheckSquare, Square, Trash2, Plus } from 'lucide-react';
import type { GanttTask } from '../types/gantt';
import { CriteriaProgressBadge } from './CriteriaProgressBadge';

interface Criterion {
  id: string;
  text: string;
  completed: boolean;
}

interface AcceptanceCriteriaProps {
  item: GanttTask;
  applyUpdate: (taskId: string, updates: Partial<GanttTask>) => void;
  canEdit: boolean;
}

export function AcceptanceCriteria({ item, applyUpdate, canEdit }: AcceptanceCriteriaProps) {
  const [newText, setNewText] = useState('');

  const criteria: Criterion[] = (
    (item.provider_meta as Record<string, unknown>)?.acceptance_criteria as Criterion[] | undefined
  ) ?? [];

  const completed = criteria.filter((c) => c.completed).length;

  const persist = useCallback(
    (updated: Criterion[]) => {
      applyUpdate(item.id, { provider_meta: { acceptance_criteria: updated } } as any);
    },
    [item.id, applyUpdate]
  );

  const handleToggle = useCallback(
    (id: string) => {
      const updated = criteria.map((c) => (c.id === id ? { ...c, completed: !c.completed } : c));
      persist(updated);
    },
    [criteria, persist]
  );

  const handleRemove = useCallback(
    (id: string) => {
      persist(criteria.filter((c) => c.id !== id));
    },
    [criteria, persist]
  );

  const handleAdd = useCallback(() => {
    const text = newText.trim();
    if (!text) return;
    const entry: Criterion = { id: crypto.randomUUID(), text, completed: false };
    persist([...criteria, entry]);
    setNewText('');
  }, [newText, criteria, persist]);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold flex items-center gap-1">
          <CheckSquare className="w-3 h-3" /> Acceptance Criteria
        </span>
        {criteria.length > 0 && (
          <CriteriaProgressBadge completed={completed} total={criteria.length} />
        )}
      </div>

      {criteria.length > 0 ? (
        <div className="flex flex-col gap-1 mb-2">
          {criteria.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-2 px-2 py-1.5 border border-[#2C2824]/15 bg-[#F5EFE2] group"
            >
              {canEdit ? (
                <button
                  onClick={() => handleToggle(c.id)}
                  className="flex-shrink-0 mt-0.5 text-[#2C2824] hover:text-[#7FB5B0] transition-colors"
                >
                  {c.completed ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[#7FB5B0]" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : (
                <span className="flex-shrink-0 mt-0.5">
                  {c.completed ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[#7FB5B0]" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-[#8C8278]" />
                  )}
                </span>
              )}
              <span
                className={`text-[11px] flex-1 leading-snug ${
                  c.completed ? 'line-through text-[#8C8278]' : 'text-[#2C2824]'
                }`}
              >
                {c.text}
              </span>
              {canEdit && (
                <button
                  onClick={() => handleRemove(c.id)}
                  className="w-4 h-4 flex items-center justify-center text-[#8C8278] hover:text-[#C4453A] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        !canEdit && <p className="text-xs text-[#8C8278] mb-2">No acceptance criteria</p>
      )}

      {canEdit && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            placeholder="Add a criterion..."
            className="flex-1 px-2 py-1.5 bg-[#F5EFE2] border border-dashed border-[#2C2824]/20 text-[11px] outline-none focus:border-[#2C2824]/40 placeholder:text-[#8C8278]"
          />
          <button
            onClick={handleAdd}
            disabled={!newText.trim()}
            className="px-2 py-1.5 border border-[#2C2824]/30 text-[#8C8278] hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors disabled:opacity-30"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </section>
  );
}
