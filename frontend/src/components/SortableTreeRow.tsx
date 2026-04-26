import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Target, Ban } from 'lucide-react';
import type { FlatGanttTask } from '../types/gantt';
import { getEpicScheme } from '../utils/epicColors';
import { CriteriaProgressBadge } from './CriteriaProgressBadge';
import { useBlockerStore } from '../store/blockerStore';
import { getTaskRiskLevel } from '../utils/dateUtils';

interface SortableTreeRowProps {
  item: FlatGanttTask;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  epicAncestorMap: Map<string, string>;
  today: Date;
  isDragging: boolean;
  canEdit?: boolean;
}

export function SortableTreeRow({
  item,
  isExpanded,
  onToggle,
  onSelect,
  epicAncestorMap,
  today,
  isDragging: isGlobalDragging,
  canEdit = true,
}: SortableTreeRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isThisDragging,
  } = useSortable({ id: item.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isThisDragging ? 0.5 : 1,
    zIndex: isThisDragging ? 50 : undefined,
  };

  const epicId = item.ticket_type === 'epic' ? item.id : epicAncestorMap.get(item.id);
  const scheme = epicId ? getEpicScheme(epicId) : null;
  const leftBorderStyle = scheme
    ? { borderLeft: `4px solid ${scheme.full}` }
    : {};

  const riskLevel = item.end_date ? getTaskRiskLevel(item.end_date, item.status, today) : 'normal';

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...leftBorderStyle }}
      className={`h-12 border-b border-[#2C2824]/15 flex items-center px-4 hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors cursor-pointer group relative ${
        item.ticket_type === 'epic' ? 'bg-[#E8DFD0]' : 'bg-[#F5EFE2]'
      }`}
      onClick={() => onSelect(item.id)}
    >
      {/* Drag handle */}
      {canEdit && (
        <div
          className="flex-shrink-0 mr-1 cursor-grab active:cursor-grabbing text-[#8C8278] hover:text-[#2C2824] group-hover:text-[#EDE5D4] opacity-40 hover:opacity-100 transition-opacity"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </div>
      )}

      <div
        className="flex-1 flex items-center overflow-hidden"
        style={{ paddingLeft: `${item.depth * 24}px` }}
      >
        {item.hasChildren ? (
          <button
            className="w-4 h-4 border border-[#2C2824]/30 bg-[#F5EFE2] group-hover:bg-[#2C2824] flex items-center justify-center mr-3 flex-shrink-0 hover:bg-[#2C2824] hover:text-[#EDE5D4] group-hover:border-[#EDE5D4] transition-colors shadow-[1px_1px_0_0_rgba(44,40,36,0.3)] group-hover:shadow-[1px_1px_0_0_rgba(237,229,212,0.5)]"
            onClick={(e) => {
              e.stopPropagation();
              if (!isGlobalDragging) onToggle(item.id);
            }}
          >
            <span className="font-mono text-[10px] leading-none group-hover:text-white mt-[1px]">
              {isExpanded ? '-' : '+'}
            </span>
          </button>
        ) : (
          <div className="w-4 h-4 mr-3 flex-shrink-0 border border-transparent" />
        )}

        {/* Type badge */}
        <div className="flex-shrink-0 mr-3 w-12 flex justify-center">
          {item.ticket_type === 'epic' && (
            <span className="bg-[#2C2824] text-[#EDE5D4] text-[9px] font-black uppercase tracking-widest px-1 py-0.5 border-2 border-[#2C2824] w-full text-center group-hover:border-[#EDE5D4]">
              EPIC
            </span>
          )}
          {item.ticket_type === 'story' && (
            <span className="bg-[#D8CFC0] text-[#2C2824] text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 border border-[#2C2824]/30 w-full text-center group-hover:bg-[#5C564E] group-hover:text-[#EDE5D4] group-hover:border-[#8C8278]">
              STORY
            </span>
          )}
          {item.ticket_type === 'task' && (
            <div className="flex items-center w-full justify-end pr-1 text-gray-400 group-hover:text-gray-500">
              <span className="text-[10px]">&#8627;</span>
            </div>
          )}
        </div>

        {/* Title + risk indicator */}
        <span
          className={`truncate flex-1 ${
            item.ticket_type === 'epic'
              ? 'font-black text-[13px] uppercase tracking-tight'
              : item.ticket_type === 'story'
              ? 'font-bold text-[12px] text-gray-900 group-hover:text-white'
              : 'font-medium text-[11px] text-gray-600 group-hover:text-gray-300'
          }`}
        >
          {item.summary}
        </span>

        {/* Risk indicator */}
        {riskLevel === 'overdue' && (
          <span className="ml-1 text-[10px] font-bold text-[#C4453A] flex-shrink-0" title="Overdue">!</span>
        )}
        {riskLevel === 'at-risk' && (
          <span className="ml-1 text-[10px] font-bold text-[#D4A017] flex-shrink-0" title="At risk">!</span>
        )}

        {/* Priority context indicator */}
        {(() => {
          const m = item.provider_meta as Record<string, unknown> | null;
          const pc = m?.priority_context as { rationale?: string; stakeholder_goals?: string[] } | undefined;
          if (pc?.rationale || (pc?.stakeholder_goals && pc.stakeholder_goals.length > 0)) {
            return <span title="Has priority context"><Target className="ml-1 w-3 h-3 text-[#D4A017] flex-shrink-0 group-hover:text-[#EDE5D4]" /></span>;
          }
          return null;
        })()}

        {/* Acceptance criteria progress */}
        {(() => {
          const m = item.provider_meta as Record<string, unknown> | null;
          const ac = m?.acceptance_criteria as Array<{ completed: boolean }> | undefined;
          if (ac && ac.length > 0) {
            const done = ac.filter((c) => c.completed).length;
            return <span className="ml-1"><CriteriaProgressBadge completed={done} total={ac.length} /></span>;
          }
          return null;
        })()}

        {/* Blocker indicator */}
        <BlockerBadge taskId={item.id} />
      </div>

      {/* Assignee avatar */}
      <div className="w-16 flex justify-center flex-shrink-0">
        {item.assignee && (
          <div className="flex -space-x-2">
            {item.assignee.avatar_url ? (
              <img
                src={item.assignee.avatar_url}
                alt={item.assignee.display_name}
                className="w-6 h-6 rounded-none border border-[#2C2824]/30 object-cover bg-[#F5EFE2]"
                title={item.assignee.display_name}
              />
            ) : (
              <div
                className="w-6 h-6 rounded-none border border-[#2C2824]/30 bg-[#E4DBCA] flex items-center justify-center text-[9px] font-bold"
                title={item.assignee.display_name}
              >
                {item.assignee.display_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status */}
      <div className={`w-20 text-right flex-shrink-0 font-mono text-[10px] uppercase ${
        riskLevel === 'overdue' ? 'text-[#C4453A] font-bold' :
        riskLevel === 'at-risk' ? 'text-[#D4A017] font-bold' : ''
      }`}>
        {riskLevel === 'overdue' ? 'OVERDUE' :
         item.status.toLowerCase().includes('progress') ? 'IN PROG' :
         item.status.toUpperCase()}
      </div>
    </div>
  );
}

function BlockerBadge({ taskId }: { taskId: string }) {
  const blockers = useBlockerStore((s) => s.blockers);
  const count = blockers.filter(
    (b) => b.blocked_task_id === taskId && b.status === 'active'
  ).length;
  if (count === 0) return null;
  return (
    <span title={`Blocked by ${count} task(s)`} className="ml-1 flex items-center gap-0.5 text-[#C4453A] flex-shrink-0">
      <Ban className="w-3 h-3" />
      {count > 1 && <span className="text-[9px] font-mono font-bold">{count}</span>}
    </span>
  );
}
