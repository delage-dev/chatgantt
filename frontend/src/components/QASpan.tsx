import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import type { FlatGanttTask } from '../types/gantt';
import { getTaskLeft, getTaskWidth } from '../utils/dateUtils';

interface QASpanProps {
  item: FlatGanttTask;
  timelineStart: Date;
  cellWidth: number;
  onDragMove: (taskId: string, deltaPx: number) => void;
  onDragResizeRight: (taskId: string, deltaPx: number) => void;
  onDragEnd: (taskId: string) => void;
  onDragStart: (taskId: string) => void;
}

type DragMode = 'move' | 'resize-right' | null;

export function QASpan({
  item,
  timelineStart,
  cellWidth,
  onDragMove,
  onDragResizeRight,
  onDragEnd,
  onDragStart,
}: QASpanProps) {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const startX = useRef(0);
  const accDelta = useRef(0);

  const qaStart = item.qa_start_date;
  const qaEnd = item.qa_end_date;
  if (!qaStart || !qaEnd) return null;

  const left = getTaskLeft(qaStart, timelineStart);
  const width = getTaskWidth(qaStart, qaEnd);
  const HANDLE_WIDTH = 8;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: DragMode) => {
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
      else if (dragMode === 'resize-right') onDragResizeRight(item.id, snappedDelta);
    },
    [dragMode, item.id, cellWidth, onDragMove, onDragResizeRight]
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

  return (
    <div
      className="absolute qa-stripe border border-[#2C2824]/25 z-9 cursor-grab active:cursor-grabbing"
      style={{
        left: `${left}px`,
        width: `${Math.max(width, cellWidth)}px`,
        height: '10px',
        bottom: '2px',
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Move handle (full body) */}
      <div
        className="absolute inset-0 cursor-grab"
        onPointerDown={(e) => handlePointerDown(e, 'move')}
      />
      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 cursor-ew-resize hover:bg-[#2C2824]/10"
        style={{ width: HANDLE_WIDTH }}
        onPointerDown={(e) => handlePointerDown(e, 'resize-right')}
      />
      {/* QA label */}
      <span className="absolute left-1 top-0 text-[7px] font-mono font-bold text-[#8C8278] uppercase leading-[10px] pointer-events-none">
        QA
      </span>
    </div>
  );
}
