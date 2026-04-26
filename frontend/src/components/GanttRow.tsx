import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { format } from 'date-fns';
import type { FlatGanttTask } from '../types/gantt';
import { parseDate, getTaskRiskLevel } from '../utils/dateUtils';
import { getEpicScheme, FALLBACK_SCHEME, type EpicColorScheme } from '../utils/epicColors';
import { startOfDay } from 'date-fns';
import { useBlockerStore } from '../store/blockerStore';

interface GanttRowProps {
  item: FlatGanttTask;
  left: number;
  width: number;
  cellWidth: number;
  epicAncestorMap: Map<string, string>;
  onClick: () => void;
  onDragMove: (taskId: string, deltaPx: number) => void;
  onDragResizeLeft: (taskId: string, deltaPx: number) => void;
  onDragResizeRight: (taskId: string, deltaPx: number) => void;
  onDragEnd: (taskId: string) => void;
  onDragStart: (taskId: string) => void;
  canEdit?: boolean;
}

type DragMode = 'move' | 'resize-left' | 'resize-right' | null;

function isFrontendTask(item: FlatGanttTask): boolean {
  const meta = item.provider_meta as Record<string, unknown> | null;
  if (!meta) return false;
  const tags = meta.tags;
  if (!Array.isArray(tags)) return false;
  return tags.some(
    (t) => typeof t === 'string' && ['frontend', 'ui', 'design'].includes(t.toLowerCase())
  );
}

export function GanttRow({
  item,
  left,
  width,
  cellWidth,
  epicAncestorMap,
  onClick,
  onDragMove,
  onDragResizeLeft,
  onDragResizeRight,
  onDragEnd,
  onDragStart,
  canEdit = true,
}: GanttRowProps) {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const startX = useRef(0);
  const accDelta = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: DragMode) => {
      if (!canEdit) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragMode(mode);
      startX.current = e.clientX;
      accDelta.current = 0;
      onDragStart(item.id);
      document.body.classList.add('dragging');
    },
    [item.id, onDragStart]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragMode) return;
      const rawDelta = e.clientX - startX.current;
      const snappedDelta = Math.round(rawDelta / cellWidth) * cellWidth;
      if (snappedDelta === accDelta.current) return;
      accDelta.current = snappedDelta;

      if (dragMode === 'move') onDragMove(item.id, snappedDelta);
      else if (dragMode === 'resize-left') onDragResizeLeft(item.id, snappedDelta);
      else if (dragMode === 'resize-right') onDragResizeRight(item.id, snappedDelta);
    },
    [dragMode, item.id, cellWidth, onDragMove, onDragResizeLeft, onDragResizeRight]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragMode) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setDragMode(null);
      document.body.classList.remove('dragging');
      if (accDelta.current !== 0) {
        onDragEnd(item.id);
      }
    },
    [dragMode, item.id, onDragEnd]
  );

  // Resolve the epic color scheme for this item
  let scheme: EpicColorScheme;
  if (item.ticket_type === 'epic') {
    scheme = getEpicScheme(item.id);
  } else {
    const epicId = epicAncestorMap.get(item.id);
    scheme = epicId ? getEpicScheme(epicId) : FALLBACK_SCHEME;
  }

  // Feature 4: Risk level
  const today = startOfDay(new Date());
  const riskLevel = item.end_date ? getTaskRiskLevel(item.end_date, item.status, today) : 'normal';
  const riskClass = riskLevel === 'overdue' ? 'overdue-border' : riskLevel === 'at-risk' ? 'at-risk-border' : '';

  // Visual differentiation by hierarchy type
  let heightClass = '';
  let topClass = '';
  let extraClass = '';
  let textClass = '';
  let borderClass = '';
  let shadowClass = '';
  let customStyle: React.CSSProperties = {};

  if (item.ticket_type === 'epic') {
    heightClass = 'h-10';
    topClass = 'top-1';
    textClass = 'text-[#2C2824] font-black text-xs uppercase tracking-widest';
    borderClass = 'border-2 border-[#2C2824]';
    shadowClass = 'shadow-[4px_4px_0_0_rgba(44,40,36,0.8)] hover:shadow-[6px_6px_0_0_rgba(44,40,36,0.8)]';
    customStyle = { backgroundColor: scheme.full };
  } else if (item.ticket_type === 'story') {
    heightClass = 'h-8';
    topClass = 'top-2';
    textClass = 'text-[#2C2824] font-bold text-[11px]';
    borderClass = 'border-2 border-[#2C2824]';
    shadowClass = 'shadow-[2px_2px_0_0_rgba(44,40,36,0.8)] hover:shadow-[4px_4px_0_0_rgba(44,40,36,0.8)]';
    customStyle = { backgroundColor: scheme.medium };
  } else {
    heightClass = 'h-6';
    topClass = 'top-3';
    textClass = 'text-[#2C2824] font-semibold text-[10px]';
    borderClass = 'border border-[#2C2824]/40';
    shadowClass = 'shadow-[1px_1px_0_0_rgba(44,40,36,0.4)] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.4)]';
    extraClass = isFrontendTask(item) ? 'dot-texture' : '';
    customStyle = { backgroundColor: scheme.light };
  }

  const HANDLE_WIDTH = 8;
  const startDate = item.start_date ? parseDate(item.start_date) : null;
  const endDate = item.end_date ? parseDate(item.end_date) : null;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <div
          className={`absolute ${heightClass} ${topClass} group transition-all flex items-center overflow-hidden ${extraClass} ${textClass} ${borderClass} ${shadowClass} ${riskClass} z-10 ${
            dragMode ? '' : 'hover:-translate-y-0.5'
          }`}
          style={{
            left: `${left}px`,
            width: `${Math.max(width, cellWidth)}px`,
            cursor: !canEdit ? 'default' : dragMode === 'move' ? 'grabbing' : 'grab',
            ...customStyle,
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Left resize handle */}
          <div
            className={`absolute left-0 top-0 bottom-0 z-20 ${canEdit ? 'cursor-ew-resize hover:bg-black/10' : ''}`}
            style={{ width: HANDLE_WIDTH }}
            onPointerDown={(e) => handlePointerDown(e, 'resize-left')}
          />

          {/* Main draggable body */}
          <div
            className={`flex-1 px-2 truncate select-none ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
            onPointerDown={(e) => handlePointerDown(e, 'move')}
            onClick={(e) => {
              if (accDelta.current === 0) onClick();
              else e.stopPropagation();
            }}
          >
            {/* Progress fill for in-progress */}
            {item.status.toLowerCase().includes('progress') && (
              <div
                className="absolute left-0 top-0 bottom-0 z-0 bg-black/10"
                style={{ width: '50%' }}
              />
            )}
            <span className="relative z-10 leading-tight">{item.summary}</span>
          </div>

          {/* Right resize handle */}
          <div
            className={`absolute right-0 top-0 bottom-0 z-20 ${canEdit ? 'cursor-ew-resize hover:bg-black/10' : ''}`}
            style={{ width: HANDLE_WIDTH }}
            onPointerDown={(e) => handlePointerDown(e, 'resize-right')}
          />
        </div>
      </Tooltip.Trigger>

      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          align="start"
          sideOffset={8}
          className="bg-[#F5EFE2] border-2 border-[#2C2824] p-3 shadow-[6px_6px_0_0_rgba(44,40,36,0.8)] z-50 w-64 animate-in fade-in-0 zoom-in-95 font-sans"
        >
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-start">
              <span className="font-mono text-[10px] uppercase font-bold tracking-widest bg-[#2C2824] text-[#EDE5D4] px-1">
                {item.id}
              </span>
              <span
                className={`font-mono text-[10px] uppercase border-2 border-[#2C2824] px-1 font-bold`}
                style={{
                  backgroundColor:
                    item.ticket_type === 'epic'
                      ? scheme.full
                      : item.ticket_type === 'story'
                      ? scheme.medium
                      : scheme.light,
                }}
              >
                {item.ticket_type}
              </span>
            </div>
            <h4 className="font-bold text-sm leading-tight mt-1">{item.summary}</h4>
            {riskLevel !== 'normal' && (
              <span className={`font-mono text-[9px] font-bold uppercase tracking-widest px-1 py-0.5 mt-1 inline-block ${
                riskLevel === 'overdue'
                  ? 'bg-[#C4453A] text-white'
                  : 'bg-[#D4A017] text-white'
              }`}>
                {riskLevel === 'overdue' ? 'OVERDUE' : 'AT RISK'}
              </span>
            )}
            <BlockedBadge taskId={item.id} />

            {item.assignee && (
              <p className="text-xs text-[#8C8278] mt-1">
                Assigned to {item.assignee.display_name}
              </p>
            )}
            {(() => {
              const m = item.provider_meta as Record<string, unknown> | null;
              const ac = m?.acceptance_criteria as Array<{ completed: boolean }> | undefined;
              if (ac && ac.length > 0) {
                const done = ac.filter((c) => c.completed).length;
                return (
                  <p className="text-[10px] text-[#8C8278] mt-1">
                    Criteria: {done}/{ac.length} met
                  </p>
                );
              }
              return null;
            })()}
            {(() => {
              const m = item.provider_meta as Record<string, unknown> | null;
              const pc = m?.priority_context as { rationale?: string } | undefined;
              if (pc?.rationale) {
                const excerpt = pc.rationale.length > 80 ? pc.rationale.slice(0, 80) + '...' : pc.rationale;
                return (
                  <p className="text-[10px] text-[#D4A017] mt-1 italic">
                    {excerpt}
                  </p>
                );
              }
              return null;
            })()}
            {startDate && endDate && (
              <div className="mt-2 pt-2 border-t border-[#2C2824] flex justify-between items-center text-[10px] font-mono uppercase font-bold text-[#2C2824]">
                <span>
                  {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd')}
                </span>
                <span className="uppercase">{item.status}</span>
              </div>
            )}
          </div>
          <Tooltip.Arrow className="fill-[#2C2824]" width={11} height={5} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function BlockedBadge({ taskId }: { taskId: string }) {
  const blockers = useBlockerStore((s) => s.blockers);
  const count = blockers.filter(
    (b) => b.blocked_task_id === taskId && b.status === 'active'
  ).length;
  if (count === 0) return null;
  return (
    <span className="font-mono text-[9px] font-bold uppercase tracking-widest px-1 py-0.5 mt-1 inline-block bg-[#2C2824] text-[#EDE5D4]">
      BLOCKED ({count})
    </span>
  );
}
