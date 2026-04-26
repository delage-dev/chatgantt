import React, { useMemo, useState } from 'react';
import { GanttItem, MOCK_DATA } from '../data';
import { addDays, format, differenceInDays, startOfDay } from 'date-fns';
import { GanttRow } from './GanttRow';

interface GanttChartProps {
  data: GanttItem[];
  onSelectItem: (item: GanttItem) => void;
}

const CELL_WIDTH = 48; // px per day
const DAYS_TO_SHOW = 30;

export function GanttChart({ data, onSelectItem }: GanttChartProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(data.map(d => d.id)));

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const today = startOfDay(new Date());
  
  // Generate days header
  const days = useMemo(() => {
    return Array.from({ length: DAYS_TO_SHOW }).map((_, i) => addDays(today, i));
  }, [today]);

  const flattenData = (items: GanttItem[], depth = 0): (GanttItem & { depth: number })[] => {
    let result: (GanttItem & { depth: number })[] = [];
    for (const item of items) {
      result.push({ ...item, depth });
      if (expandedIds.has(item.id) && item.children) {
        result = result.concat(flattenData(item.children, depth + 1));
      }
    }
    return result;
  };

  const visibleItems = flattenData(data);
  const totalWidth = days.length * CELL_WIDTH;

  return (
    <div className="h-full w-full overflow-auto bg-[#EDE8E1] relative scroll-smooth custom-scrollbar">
      <div className="flex min-w-max min-h-full">
        
        {/* Left Pane: Tree View (Sticky to Left) */}
        <div className="w-[450px] flex-shrink-0 sticky left-0 z-20 flex flex-col bg-[#F7F3ED] border-r border-[#2C2824]/20 shadow-[2px_0_0_0_rgba(44,40,36,0.15)]">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-[#E8E2D9] border-b-2 border-[#2C2824]/30 h-12 flex items-center px-4 font-mono text-xs font-bold uppercase tracking-widest shadow-sm">
            <div className="flex-1">Task Name</div>
            <div className="w-16 text-center">Assign</div>
            <div className="w-16 text-center">Dept</div>
            <div className="w-20 text-right">Status</div>
          </div>
          
          {/* Body Rows */}
          <div className="flex-1 flex flex-col">
            {visibleItems.map((item, index) => (
              <div 
                key={`tree-${item.id}`} 
                className={`h-12 border-b border-[#2C2824]/15 flex items-center px-4 hover:bg-[#2C2824] hover:text-[#F0EBE3] transition-colors cursor-pointer group relative ${
                  item.type === 'epic' ? 'bg-[#EDE8E1]' : 'bg-[#F7F3ED]'
                }`}
                onClick={() => onSelectItem(item)}
              >
                <div 
                  className="flex-1 flex items-center overflow-hidden" 
                  style={{ paddingLeft: `${item.depth * 24}px` }}
                >
                  {item.children && item.children.length > 0 ? (
                    <button 
                      className="w-4 h-4 border border-[#2C2824]/30 bg-[#F7F3ED] group-hover:bg-[#2C2824] flex items-center justify-center mr-3 flex-shrink-0 hover:bg-[#2C2824] hover:text-[#F0EBE3] group-hover:border-[#F0EBE3] transition-colors shadow-[1px_1px_0_0_rgba(44,40,36,0.3)] group-hover:shadow-[1px_1px_0_0_rgba(240,235,227,0.5)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(item.id);
                      }}
                    >
                      <span className="font-mono text-[10px] leading-none group-hover:text-white mt-[1px]">
                        {expandedIds.has(item.id) ? '-' : '+'}
                      </span>
                    </button>
                  ) : (
                    <div className="w-4 h-4 mr-3 flex-shrink-0 border border-transparent" />
                  )}
                  
                  {/* Distinct Type Badges */}
                  <div className="flex-shrink-0 mr-3 w-12 flex justify-center">
                    {item.type === 'epic' && (
                      <span className="bg-[#2C2824] text-[#F0EBE3] text-[9px] font-black uppercase tracking-widest px-1 py-0.5 border-2 border-[#2C2824] w-full text-center group-hover:border-[#F0EBE3]">
                        EPIC
                      </span>
                    )}
                    {item.type === 'story' && (
                      <span className="bg-[#DDD7CE] text-[#2C2824] text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 border border-[#2C2824]/30 w-full text-center group-hover:bg-[#5C564E] group-hover:text-[#F0EBE3] group-hover:border-[#8C8278]">
                        STORY
                      </span>
                    )}
                    {item.type === 'task' && (
                      <div className="flex items-center w-full justify-end pr-1 text-gray-400 group-hover:text-gray-500">
                        <span className="text-[10px]">↳</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Differentiated Typography */}
                  <span className={`truncate flex-1 ${
                    item.type === 'epic' ? 'font-black text-[13px] uppercase tracking-tight' : 
                    item.type === 'story' ? 'font-bold text-[12px] text-gray-900 group-hover:text-white' : 
                    'font-medium text-[11px] text-gray-600 group-hover:text-gray-300'
                  }`}>
                    {item.title}
                  </span>
                </div>
                
                {/* Avatars */}
                <div className="w-16 flex justify-center flex-shrink-0">
                  <div className="flex -space-x-2">
                    {item.assignees.map((a, i) => (
                      <img 
                        key={a.id} 
                        src={a.avatarUrl} 
                        alt={a.name}
                        className="w-6 h-6 rounded-none border border-[#2C2824]/30 object-cover bg-[#F7F3ED] relative"
                        style={{ zIndex: item.assignees.length - i }}
                        title={a.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Department */}
                <div className="w-16 text-center font-mono text-[10px] uppercase truncate flex-shrink-0 px-1">
                  {item.department === 'frontend' ? 'FE' : 
                   item.department === 'backend' ? 'BE' : 
                   item.department === 'design' ? 'DES' : 'PROD'}
                </div>

                {/* Status */}
                <div className="w-20 text-right flex-shrink-0 font-mono text-[10px] uppercase">
                  {item.status === 'todo' ? 'TODO' : 
                   item.status === 'in-progress' ? 'IN PROG' : 'DONE'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Pane: Timeline View */}
        <div className="flex-1 flex flex-col relative z-0">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#E8E2D9] border-b-2 border-[#2C2824]/30 h-12 flex w-max min-w-full font-mono text-xs uppercase shadow-sm">
            {days.map((day, i) => (
              <div 
                key={i} 
                className="border-r border-[#2C2824]/15 flex flex-col justify-center items-center flex-shrink-0"
                style={{ width: CELL_WIDTH }}
              >
                <div className="font-bold text-[11px]">{format(day, 'dd')}</div>
                <div className="text-[9px] opacity-70">{format(day, 'MMM')}</div>
              </div>
            ))}
          </div>
          
          {/* Timeline Body */}
          <div className="relative flex-1 group/timeline w-max min-w-full bg-[#F3EEE7]">
            {/* Vertical Grid Lines */}
            <div className="absolute inset-0 flex pointer-events-none z-0">
              {days.map((_, i) => (
                <div 
                  key={`grid-${i}`} 
                  className="h-full border-r border-[#2C2824] opacity-[0.05]"
                  style={{ width: CELL_WIDTH }}
                />
              ))}
            </div>

            {/* Rows */}
            <div className="relative z-10 flex flex-col w-full">
              {visibleItems.map((item, index) => {
                const startOffset = differenceInDays(item.startDate, today);
                const duration = differenceInDays(item.endDate, item.startDate) + 1; // inclusive
                const left = Math.max(0, startOffset * CELL_WIDTH);
                const width = duration * CELL_WIDTH;

                return (
                  <div 
                    key={`row-${item.id}`} 
                    className="h-12 border-b border-[#2C2824]/10 flex items-center relative group-hover/timeline:opacity-100 transition-opacity"
                    style={{ width: totalWidth }}
                  >
                    <GanttRow 
                      item={item} 
                      left={left} 
                      width={width} 
                      onClick={() => onSelectItem(item)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}