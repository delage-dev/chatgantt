import { useMemo, useCallback, useRef, useEffect } from 'react';
import { format, startOfDay, differenceInDays, addDays } from 'date-fns';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useGanttStore } from '../store/ganttStore';
import { flattenTree, buildEpicAncestorMap } from '../utils/hierarchyUtils';
import {
  getTaskLeft, getTaskWidth, snapDate, parseDate, toISODate, CELL_WIDTH, BUFFER_DAYS,
  generateDaysArray, isToday, getTodayOffset,
} from '../utils/dateUtils';
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';
import { useReorder } from '../hooks/useReorder';
import { GanttRow } from './GanttRow';
import { DependencyLines } from './DependencyLines';
import { QASpan } from './QASpan';
import { SortableTreeRow } from './SortableTreeRow';

export const ROW_HEIGHT = 48; // h-12 — exported for DependencyLines

interface GanttChartProps {
  onSelectItem: (taskId: string) => void;
  canEdit: boolean;
}

export function GanttChart({ onSelectItem, canEdit }: GanttChartProps) {
  const tasks = useGanttStore((s) => s.tasks);
  const expandedIds = useGanttStore((s) => s.expandedIds);
  const toggleExpanded = useGanttStore((s) => s.toggleExpanded);
  const timelineStart = useGanttStore((s) => s.timelineStart);
  const timelineEnd = useGanttStore((s) => s.timelineEnd);
  const extendTimeline = useGanttStore((s) => s.extendTimeline);
  const activeProject = useGanttStore((s) => s.activeProject);
  const { beginDrag, applyUpdate } = useOptimisticUpdate();
  const { isDragging: isReordering, handleDragStart: handleReorderStart, handleDragEnd: handleReorderEnd, handleDragCancel: handleReorderCancel } = useReorder();

  const dragOrigins = useRef<Map<string, { start_date: string; end_date: string; qa_start_date?: string; qa_end_date?: string }>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledToToday = useRef(false);

  const today = useMemo(() => startOfDay(new Date()), []);

  const days = useMemo(
    () => generateDaysArray(timelineStart, timelineEnd),
    [timelineStart, timelineEnd]
  );

  const allVisibleItems = useMemo(
    () => flattenTree(tasks, expandedIds),
    [tasks, expandedIds]
  );

  const epicAncestorMap = useMemo(
    () => buildEpicAncestorMap(tasks),
    [tasks]
  );

  // Feature 2: Project filter
  const visibleItems = useMemo(() => {
    if (!activeProject) return allVisibleItems;
    const matchingEpicIds = new Set(
      tasks
        .filter((t) => {
          if (t.ticket_type !== 'epic') return false;
          const meta = t.provider_meta as Record<string, unknown> | null;
          return meta?.project_name === activeProject;
        })
        .map((t) => t.id)
    );
    return allVisibleItems.filter((item) => {
      const epicId = epicAncestorMap.get(item.id);
      return epicId ? matchingEpicIds.has(epicId) : false;
    });
  }, [allVisibleItems, activeProject, tasks, epicAncestorMap]);

  const totalWidth = days.length * CELL_WIDTH;
  const todayOffset = getTodayOffset(timelineStart);

  // Feature 1: Auto-scroll to today on mount
  useEffect(() => {
    if (scrollRef.current && !hasScrolledToToday.current && tasks.length > 0) {
      const todayPx = differenceInDays(today, timelineStart) * CELL_WIDTH;
      scrollRef.current.scrollLeft = Math.max(0, todayPx - 200);
      hasScrolledToToday.current = true;
    }
  }, [tasks.length, today, timelineStart]);

  // Lock horizontal scroll while reordering tree items
  const scrollLockX = useRef<number | null>(null);
  useEffect(() => {
    if (isReordering) {
      scrollLockX.current = scrollRef.current?.scrollLeft ?? null;
    } else {
      scrollLockX.current = null;
    }
  }, [isReordering]);

  // Feature 1: Infinite scroll detection
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Snap horizontal scroll back while reordering
    if (scrollLockX.current !== null && el.scrollLeft !== scrollLockX.current) {
      el.scrollLeft = scrollLockX.current;
      return;
    }
    const bufferPx = BUFFER_DAYS * CELL_WIDTH;

    if (el.scrollLeft < bufferPx) {
      const prevScrollWidth = el.scrollWidth;
      extendTimeline('past');
      // Compensate scroll position after DOM update
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          const addedPx = scrollRef.current.scrollWidth - prevScrollWidth;
          scrollRef.current.scrollLeft += addedPx;
        }
      });
    }

    if (el.scrollLeft + el.clientWidth > el.scrollWidth - bufferPx) {
      extendTimeline('future');
    }
  }, [extendTimeline]);

  // Feature 1: Cascade parent dates when child extends past parent bounds
  const cascadeParentDates = useCallback(
    (taskId: string, newEndDate?: string, newStartDate?: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !task.parent_id) return;
      const parent = tasks.find((t) => t.id === task.parent_id);
      if (!parent) return;

      const updates: Record<string, string> = {};
      if (newEndDate && parent.end_date && newEndDate > parent.end_date) {
        updates.end_date = newEndDate;
        // Shift the parent's QA buffer by the same number of days
        if (parent.qa_start_date && parent.qa_end_date) {
          const oldEnd = parseDate(parent.end_date);
          const newEnd = parseDate(newEndDate);
          const shiftDays = differenceInDays(newEnd, oldEnd);
          updates.qa_start_date = toISODate(addDays(parseDate(parent.qa_start_date), shiftDays));
          updates.qa_end_date = toISODate(addDays(parseDate(parent.qa_end_date), shiftDays));
        }
      }
      if (newStartDate && parent.start_date && newStartDate < parent.start_date) {
        updates.start_date = newStartDate;
      }
      if (Object.keys(updates).length > 0) {
        applyUpdate(parent.id, updates);
        // Recurse up the chain
        cascadeParentDates(parent.id, updates.end_date || parent.end_date, updates.start_date || parent.start_date);
      }
    },
    [tasks, applyUpdate]
  );

  // Drag handlers
  const handleDragStart = useCallback(
    (taskId: string) => {
      beginDrag(taskId);
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        dragOrigins.current.set(taskId, {
          start_date: task.start_date,
          end_date: task.end_date,
          qa_start_date: (task as any).qa_start_date,
          qa_end_date: (task as any).qa_end_date,
        });
      }
    },
    [beginDrag, tasks]
  );

  const handleDragMove = useCallback(
    (taskId: string, deltaPx: number) => {
      const origin = dragOrigins.current.get(taskId);
      if (!origin) return;
      const updates: Record<string, string> = {
        start_date: snapDate(origin.start_date, deltaPx),
        end_date: snapDate(origin.end_date, deltaPx),
      };
      // Move QA span with the task
      if (origin.qa_start_date && origin.qa_end_date) {
        updates.qa_start_date = snapDate(origin.qa_start_date, deltaPx);
        updates.qa_end_date = snapDate(origin.qa_end_date, deltaPx);
      }
      applyUpdate(taskId, updates);
    },
    [applyUpdate]
  );

  const handleDragResizeLeft = useCallback(
    (taskId: string, deltaPx: number) => {
      const origin = dragOrigins.current.get(taskId);
      if (!origin) return;
      applyUpdate(taskId, { start_date: snapDate(origin.start_date, deltaPx) });
    },
    [applyUpdate]
  );

  const handleDragResizeRight = useCallback(
    (taskId: string, deltaPx: number) => {
      const origin = dragOrigins.current.get(taskId);
      if (!origin) return;
      applyUpdate(taskId, { end_date: snapDate(origin.end_date, deltaPx) });
    },
    [applyUpdate]
  );

  // QA-specific drag handlers (independent of task bar)
  const handleQADragStart = useCallback(
    (taskId: string) => {
      beginDrag(taskId);
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.qa_start_date && task.qa_end_date) {
        dragOrigins.current.set(`qa:${taskId}`, {
          start_date: task.qa_start_date,
          end_date: task.qa_end_date,
        });
      }
    },
    [beginDrag, tasks]
  );

  const handleQADragMove = useCallback(
    (taskId: string, deltaPx: number) => {
      const origin = dragOrigins.current.get(`qa:${taskId}`);
      if (!origin) return;
      applyUpdate(taskId, {
        qa_start_date: snapDate(origin.start_date, deltaPx),
        qa_end_date: snapDate(origin.end_date, deltaPx),
      });
    },
    [applyUpdate]
  );

  const handleQAResizeRight = useCallback(
    (taskId: string, deltaPx: number) => {
      const origin = dragOrigins.current.get(`qa:${taskId}`);
      if (!origin) return;
      applyUpdate(taskId, { qa_end_date: snapDate(origin.end_date, deltaPx) });
    },
    [applyUpdate]
  );

  const handleQADragEnd = useCallback((taskId: string) => {
    dragOrigins.current.delete(`qa:${taskId}`);
    // Cascade parent dates based on final QA position
    const task = useGanttStore.getState().getTask(taskId);
    if (task) {
      cascadeParentDates(taskId, task.qa_end_date || undefined);
    }
  }, [cascadeParentDates]);

  const handleDragEnd = useCallback((taskId: string) => {
    dragOrigins.current.delete(taskId);
    // Cascade parent dates based on final task position
    const task = useGanttStore.getState().getTask(taskId);
    if (task) {
      cascadeParentDates(taskId, task.end_date, task.start_date);
    }
  }, [cascadeParentDates]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-full w-full overflow-auto bg-[#E8DFD0] relative custom-scrollbar"
    >
      <div className="flex min-w-max min-h-full">
        {/* Left Pane: Tree View (Sticky) */}
        <div className="w-[450px] flex-shrink-0 sticky left-0 z-20 flex flex-col bg-[#F5EFE2] border-r border-[#2C2824]/20 shadow-[2px_0_0_0_rgba(44,40,36,0.15)]">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-[#E4DBCA] border-b-2 border-[#2C2824]/30 h-12 flex items-center px-4 font-mono text-xs font-bold uppercase tracking-widest shadow-sm">
            <div className="flex-1">Task Name</div>
            <div className="w-16 text-center">Assign</div>
            <div className="w-20 text-right">Status</div>
          </div>

          {/* Body Rows */}
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={handleReorderStart}
            onDragEnd={handleReorderEnd}
            onDragCancel={handleReorderCancel}
          >
            <SortableContext items={visibleItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="flex-1 flex flex-col">
                {visibleItems.map((item) => (
                  <SortableTreeRow
                    key={`tree-${item.id}`}
                    item={item}
                    isExpanded={expandedIds.has(item.id)}
                    onToggle={toggleExpanded}
                    onSelect={onSelectItem}
                    epicAncestorMap={epicAncestorMap}
                    today={today}
                    isDragging={isReordering}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Right Pane: Timeline */}
        <div className="flex-1 flex flex-col relative z-0">
          {/* Timeline Header */}
          <div className="sticky top-0 z-10 bg-[#E4DBCA] border-b-2 border-[#2C2824]/30 h-12 flex w-max min-w-full font-mono text-xs uppercase shadow-sm">
            {days.map((day, i) => {
              const todayCell = isToday(day);
              return (
                <div
                  key={i}
                  className={`border-r border-[#2C2824]/15 flex flex-col justify-center items-center flex-shrink-0 ${
                    todayCell ? 'today-header-cell' : ''
                  }`}
                  style={{ width: CELL_WIDTH }}
                >
                  <div className="font-bold text-[11px]">{format(day, 'dd')}</div>
                  <div className="text-[9px] opacity-70">{format(day, 'MMM')}</div>
                </div>
              );
            })}
          </div>

          {/* Timeline Body */}
          <div className="relative flex-1 w-max min-w-full bg-[#EFE8DA]">
            {/* Grid lines */}
            <div className="absolute inset-0 flex pointer-events-none z-0">
              {days.map((_, i) => (
                <div
                  key={`grid-${i}`}
                  className="h-full border-r border-[#2C2824] opacity-[0.05]"
                  style={{ width: CELL_WIDTH }}
                />
              ))}
            </div>

            {/* Feature 3: Today marker line */}
            <div
              className="today-marker-line"
              style={{ left: todayOffset + CELL_WIDTH / 2 }}
            />

            {/* Task rows */}
            <div className="relative z-10 flex flex-col w-full">
              {visibleItems.map((item) => {
                if (!item.start_date || !item.end_date) return (
                  <div key={`row-${item.id}`} className="h-12 border-b border-[#2C2824]/10" style={{ width: totalWidth }} />
                );

                const taskLeft = getTaskLeft(item.start_date, timelineStart);
                const taskWidth = getTaskWidth(item.start_date, item.end_date);

                return (
                  <div
                    key={`row-${item.id}`}
                    className="h-12 border-b border-[#2C2824]/10 flex items-center relative"
                    style={{ width: totalWidth }}
                  >
                    <GanttRow
                      item={item}
                      left={taskLeft}
                      width={taskWidth}
                      cellWidth={CELL_WIDTH}
                      epicAncestorMap={epicAncestorMap}
                      onClick={() => onSelectItem(item.id)}
                      onDragMove={handleDragMove}
                      onDragResizeLeft={handleDragResizeLeft}
                      onDragResizeRight={handleDragResizeRight}
                      onDragEnd={handleDragEnd}
                      onDragStart={handleDragStart}
                      canEdit={canEdit}
                    />
                    {/* Feature 7: QA Span */}
                    {item.qa_start_date && item.qa_end_date && (
                      <QASpan
                        item={item}
                        timelineStart={timelineStart}
                        cellWidth={CELL_WIDTH}
                        onDragMove={handleQADragMove}
                        onDragResizeRight={handleQAResizeRight}
                        onDragEnd={handleQADragEnd}
                        onDragStart={handleQADragStart}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Feature 6: Dependency arrows */}
            <DependencyLines
              items={visibleItems}
              timelineStart={timelineStart}
              totalWidth={totalWidth}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
