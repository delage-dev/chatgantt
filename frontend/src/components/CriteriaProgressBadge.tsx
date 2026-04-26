interface CriteriaProgressBadgeProps {
  completed: number;
  total: number;
}

export function CriteriaProgressBadge({ completed, total }: CriteriaProgressBadgeProps) {
  if (total === 0) return null;

  const pct = Math.round((completed / total) * 100);
  const allDone = completed === total;

  return (
    <div className="flex items-center gap-1 flex-shrink-0" title={`${completed}/${total} criteria met`}>
      <div className="w-8 h-1.5 bg-[#2C2824]/10 border border-[#2C2824]/15 overflow-hidden">
        <div
          className={`h-full transition-all ${allDone ? 'bg-[#7FB5B0]' : 'bg-[#D4A017]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[9px] font-mono font-bold ${allDone ? 'text-[#7FB5B0]' : 'text-[#8C8278]'}`}>
        {completed}/{total}
      </span>
    </div>
  );
}
