import { useMemo, useState, useEffect, useRef } from 'react';
import type { FlatGanttTask } from '../types/gantt';
import { getTaskLeft, getTaskWidth } from '../utils/dateUtils';

const ROW_HEIGHT = 48;
const ARROW_SIZE = 5;

interface DependencyLinesProps {
  items: FlatGanttTask[];
  timelineStart: Date;
  totalWidth: number;
}

interface DepLine {
  key: string;
  sourceId: string;
  targetId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isConflict: boolean;
}

export function DependencyLines({ items, timelineStart, totalWidth }: DependencyLinesProps) {
  const [dismissedConflicts, setDismissedConflicts] = useState<Set<string>>(new Set());
  const prevItemsRef = useRef(items);

  // Reset dismissed conflicts when items change (dates were dragged)
  useEffect(() => {
    if (prevItemsRef.current !== items) {
      setDismissedConflicts(new Set());
      prevItemsRef.current = items;
    }
  }, [items]);

  const lines = useMemo(() => {
    const itemIndex = new Map<string, number>();
    items.forEach((item, i) => itemIndex.set(item.id, i));

    const result: DepLine[] = [];

    for (const item of items) {
      if (!item.dependencies || !item.start_date || !item.end_date) continue;

      const targetIdx = itemIndex.get(item.id);
      if (targetIdx === undefined) continue;
      const targetLeft = getTaskLeft(item.start_date, timelineStart);
      const targetY = targetIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

      for (const depId of item.dependencies) {
        const sourceIdx = itemIndex.get(depId);
        if (sourceIdx === undefined) continue;

        const source = items[sourceIdx];
        if (!source.start_date || !source.end_date) continue;

        const sourceRight =
          getTaskLeft(source.start_date, timelineStart) +
          getTaskWidth(source.start_date, source.end_date);
        const sourceY = sourceIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

        // Conflict: upstream end date meets or exceeds downstream start date
        const isConflict = source.end_date >= item.start_date;

        result.push({
          key: `${depId}->${item.id}`,
          sourceId: depId,
          targetId: item.id,
          x1: sourceRight,
          y1: sourceY,
          x2: targetLeft,
          y2: targetY,
          isConflict,
        });
      }
    }

    return result;
  }, [items, timelineStart]);

  if (lines.length === 0) return null;

  const totalHeight = items.length * ROW_HEIGHT;

  return (
    <svg
      className="absolute inset-0"
      style={{ width: totalWidth, height: totalHeight, zIndex: 8, pointerEvents: 'none' }}
    >
      <defs>
        <marker
          id="dep-arrow"
          viewBox={`0 0 ${ARROW_SIZE * 2} ${ARROW_SIZE * 2}`}
          refX={ARROW_SIZE * 2}
          refY={ARROW_SIZE}
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE}
          orient="auto-start-reverse"
        >
          <path
            d={`M 0 0 L ${ARROW_SIZE * 2} ${ARROW_SIZE} L 0 ${ARROW_SIZE * 2} Z`}
            fill="#8C8278"
          />
        </marker>
        <marker
          id="dep-arrow-conflict"
          viewBox={`0 0 ${ARROW_SIZE * 2} ${ARROW_SIZE * 2}`}
          refX={ARROW_SIZE * 2}
          refY={ARROW_SIZE}
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE}
          orient="auto-start-reverse"
        >
          <path
            d={`M 0 0 L ${ARROW_SIZE * 2} ${ARROW_SIZE} L 0 ${ARROW_SIZE * 2} Z`}
            fill="#C4453A"
          />
        </marker>
      </defs>

      {lines.map((line) => {
        const midX = (line.x1 + line.x2) / 2;
        const midY = (line.y1 + line.y2) / 2;
        const path = `M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`;
        const isDismissed = dismissedConflicts.has(line.key);

        return (
          <g key={line.key}>
            <path
              d={path}
              fill="none"
              stroke={line.isConflict ? '#C4453A' : '#8C8278'}
              strokeWidth={line.isConflict ? 2 : 1.5}
              strokeDasharray={line.isConflict ? '6 3' : '4 3'}
              markerEnd={line.isConflict ? 'url(#dep-arrow-conflict)' : 'url(#dep-arrow)'}
              opacity={line.isConflict ? 0.8 : 0.6}
            />

            {/* Conflict "!" indicator */}
            {line.isConflict && !isDismissed && (
              <g
                style={{ pointerEvents: 'all', cursor: 'pointer' }}
                className="dep-conflict-marker"
                onClick={() =>
                  setDismissedConflicts((prev) => new Set(prev).add(line.key))
                }
              >
                <title>
                  Conflict: {line.sourceId} ends after {line.targetId} starts. Click to dismiss.
                </title>
                <circle cx={midX} cy={midY} r={9} fill="#C4453A" opacity={0.9} />
                <text
                  x={midX}
                  y={midY + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                  fontFamily="ui-monospace, monospace"
                >
                  !
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
