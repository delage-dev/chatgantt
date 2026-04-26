import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Resource } from '../types/resources';

interface ResourceCardProps {
  resource: Resource;
  defaultExpanded?: boolean;
}

const SOURCE_BADGE_COLORS: Record<string, string> = {
  url: 'bg-[#7FB5B0] text-white',
  confluence: 'bg-[#0052CC] text-white',
  notion: 'bg-[#2C2824] text-[#EDE5D4]',
  mock: 'bg-[#9BA4C4] text-white',
};

export function ResourceCard({ resource, defaultExpanded = false }: ResourceCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const badgeClass = SOURCE_BADGE_COLORS[resource.source_type] || SOURCE_BADGE_COLORS.url;

  return (
    <div className="border-2 border-[#2C2824]/30 bg-[#F5EFE2] shadow-[2px_2px_0_0_rgba(44,40,36,0.3)]">
      {/* Header */}
      <div
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-[#E4DBCA] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[#8C8278]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#8C8278]" />
          )}
        </div>

        <span
          className={`${badgeClass} text-[8px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 flex-shrink-0`}
        >
          {resource.source_type}
        </span>

        <span className="font-bold text-sm flex-1 truncate">{resource.title}</span>

        <a
          href={resource.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors"
          onClick={(e) => e.stopPropagation()}
          title="View source"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Summary (always visible when collapsed) */}
      {!isExpanded && (
        <div className="px-3 pb-3 pt-0">
          <p className="text-xs text-[#8C8278] line-clamp-2">{resource.summary}</p>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[#2C2824]/15 p-3">
          <div className="markdown-prose text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {resource.content}
            </ReactMarkdown>
          </div>
          {resource.last_fetched && (
            <div className="mt-3 pt-2 border-t border-[#2C2824]/10 text-[10px] font-mono text-[#8C8278] uppercase">
              Fetched {new Date(resource.last_fetched).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
