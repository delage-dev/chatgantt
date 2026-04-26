import React from 'react';
import { GanttItem } from '../data';
import * as Tooltip from '@radix-ui/react-tooltip';
import { format } from 'date-fns';

interface GanttRowProps {
  item: GanttItem;
  left: number;
  width: number;
  onClick: () => void;
}

export function GanttRow({ item, left, width, onClick }: GanttRowProps) {
  let deptColor = '#F7F3ED';
  let deptTextColor = 'text-[#2C2824]';

  if (item.department === 'frontend') {
    deptColor = '#FAFF00'; // Neon Yellow
  } else if (item.department === 'backend') {
    deptColor = '#00F0FF'; // Cyan
  } else if (item.department === 'design') {
    deptColor = '#FF00F0'; // Magenta
    deptTextColor = 'text-white';
  }

  // Visual differentiation based on hierarchy type
  let heightClass = '';
  let topClass = '';
  let bgClass = '';
  let textClass = '';
  let borderClass = '';
  let shadowClass = '';
  let customStyle: React.CSSProperties = {};

  if (item.type === 'epic') {
    // Epics: Dominant thick black bars
    heightClass = 'h-10';
    topClass = 'top-1';
    bgClass = 'bg-black';
    textClass = 'text-white font-black text-xs uppercase tracking-widest';
    borderClass = 'border-2 border-black';
    shadowClass = 'shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)]';
  } else if (item.type === 'story') {
    // Stories: Medium colored bars
    heightClass = 'h-8';
    topClass = 'top-2';
    bgClass = ''; // Used exact hex in style instead
    textClass = `${deptTextColor} font-bold text-[11px]`;
    borderClass = 'border-2 border-[#2C2824]';
    shadowClass = 'shadow-[2px_2px_0_0_rgba(44,40,36,0.8)] hover:shadow-[4px_4px_0_0_rgba(44,40,36,0.8)]';
    customStyle = { backgroundColor: deptColor };
  } else {
    // Tasks: Thinner subtle bars with a stark colored left-edge
    heightClass = 'h-6';
    topClass = 'top-3';
    bgClass = 'bg-[#F7F3ED]';
    textClass = 'text-[#2C2824] font-semibold text-[10px]';
    borderClass = 'border border-[#2C2824]/40';
    shadowClass = 'shadow-[1px_1px_0_0_rgba(44,40,36,0.4)] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.4)]';
    customStyle = { borderLeft: `6px solid ${deptColor}` };
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          onClick={onClick}
          className={`absolute ${heightClass} ${topClass} group hover:-translate-y-0.5 transition-all flex items-center px-2 overflow-hidden ${bgClass} ${textClass} ${borderClass} ${shadowClass} cursor-pointer z-10`}
          style={{
            left: `${left}px`,
            width: `${width}px`,
            ...customStyle
          }}
        >
          {/* Progress bar fill for in-progress tasks */}
          {item.status === 'in-progress' && (
            <div 
              className={`absolute left-0 top-0 bottom-0 z-0 ${item.type === 'epic' ? 'bg-white/20' : 'bg-black/20'}`} 
              style={{ width: '50%' }}
            />
          )}
          
          <div className="relative z-10 truncate leading-tight flex-1 flex items-center text-left">
            {item.title}
          </div>
          
          {/* Icons or indicators for FE/BE/Links */}
          {item.figmaLink && (
            <div className="relative z-10 w-3 h-3 rounded-none bg-black flex items-center justify-center flex-shrink-0 ml-2 shadow-[1px_1px_0_0_rgba(255,255,255,1)]">
              <span className="text-white text-[7px] font-bold">F</span>
            </div>
          )}
        </button>
      </Tooltip.Trigger>
      
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          align="start"
          sideOffset={8}
          className="bg-[#F7F3ED] border-2 border-[#2C2824] p-3 shadow-[6px_6px_0_0_rgba(44,40,36,0.8)] z-50 w-64 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 font-sans"
        >
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-start">
              <span className="font-mono text-[10px] uppercase font-bold tracking-widest bg-[#2C2824] text-[#F0EBE3] px-1">
                {item.sourceId}
              </span>
              <span className={`font-mono text-[10px] uppercase border-2 border-[#2C2824] px-1 font-bold ${
                item.type === 'epic' ? 'bg-[#2C2824] text-[#F0EBE3]' : 
                item.type === 'story' ? 'bg-[#DDD7CE]' : 'bg-[#F7F3ED]'
              }`}>
                {item.type}
              </span>
            </div>
            
            <h4 className="font-bold text-sm leading-tight mt-1">{item.title}</h4>
            
            <p className="text-xs text-[#8C8278] mt-1 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
            
            <div className="mt-2 pt-2 border-t border-[#2C2824] flex justify-between items-center text-[10px] font-mono uppercase font-bold text-[#2C2824]">
              <span>{format(item.startDate, 'MMM dd')} - {format(item.endDate, 'MMM dd')}</span>
              <span className="px-1" style={{ backgroundColor: deptColor, color: deptTextColor }}>{item.department}</span>
            </div>
          </div>
          <Tooltip.Arrow className="fill-[#2C2824]" width={11} height={5} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}