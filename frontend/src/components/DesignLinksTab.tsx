import { useState, useCallback } from 'react';
import { Palette, ExternalLink, Trash2, Plus } from 'lucide-react';
import type { GanttTask } from '../types/gantt';

interface DesignLink {
  url: string;
  title: string;
  type: 'figma' | 'miro' | 'generic';
}

interface DesignLinksTabProps {
  item: GanttTask;
  applyUpdate: (taskId: string, updates: Partial<GanttTask>) => void;
  canEdit: boolean;
}

function detectDesignType(url: string): 'figma' | 'miro' | 'generic' {
  if (url.includes('figma.com')) return 'figma';
  if (url.includes('miro.com')) return 'miro';
  return 'generic';
}

function getFigmaEmbedUrl(url: string): string {
  return `https://www.figma.com/embed?embed_host=chatgantt&url=${encodeURIComponent(url)}`;
}

const TYPE_LABELS: Record<string, string> = {
  figma: 'FIGMA',
  miro: 'MIRO',
  generic: 'LINK',
};

const TYPE_COLORS: Record<string, string> = {
  figma: 'bg-[#A259FF]/15 border-[#A259FF]/30 text-[#A259FF]',
  miro: 'bg-[#FFD02F]/15 border-[#FFD02F]/50 text-[#8B7000]',
  generic: 'bg-[#D8CFC0] border-[#2C2824]/20 text-[#2C2824]',
};

export function DesignLinksTab({ item, applyUpdate, canEdit }: DesignLinksTabProps) {
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const meta = item.provider_meta as Record<string, unknown> | null;
  const links: DesignLink[] = (meta?.design_links as DesignLink[] | undefined) ?? [];

  const persist = useCallback(
    (updated: DesignLink[]) => {
      applyUpdate(item.id, { provider_meta: { design_links: updated } } as any);
    },
    [item.id, applyUpdate]
  );

  const handleAdd = useCallback(() => {
    const url = newUrl.trim();
    if (!url) return;
    const title = newTitle.trim() || url;
    const type = detectDesignType(url);
    persist([...links, { url, title, type }]);
    setNewUrl('');
    setNewTitle('');
  }, [newUrl, newTitle, links, persist]);

  const handleRemove = useCallback(
    (idx: number) => {
      persist(links.filter((_, i) => i !== idx));
    },
    [links, persist]
  );

  return (
    <div className="flex flex-col gap-4">
      {links.length === 0 && !canEdit && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Palette className="w-8 h-8 text-[#8C8278] mb-3" />
          <p className="text-sm text-[#8C8278] font-medium">No designs linked</p>
        </div>
      )}

      {links.map((link, idx) => (
        <div key={idx} className="border border-[#2C2824]/20 bg-[#F5EFE2]">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#E4DBCA] border-b border-[#2C2824]/15">
            <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 border ${TYPE_COLORS[link.type]}`}>
              {TYPE_LABELS[link.type]}
            </span>
            <span className="font-bold text-xs flex-1 truncate">{link.title}</span>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8C8278] hover:text-[#2C2824] transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {canEdit && (
              <button
                onClick={() => handleRemove(idx)}
                className="text-[#8C8278] hover:text-[#C4453A] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Content */}
          {link.type === 'figma' ? (
            <div className="w-full" style={{ height: '400px' }}>
              <iframe
                src={getFigmaEmbedUrl(link.url)}
                className="w-full h-full border-0"
                allowFullScreen
                title={link.title}
              />
            </div>
          ) : (
            <div className="px-3 py-3">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#2C2824] underline decoration-[#2C2824]/30 hover:decoration-[#2C2824] transition-colors break-all"
              >
                {link.url}
              </a>
            </div>
          )}
        </div>
      ))}

      {/* Add link form */}
      {canEdit && (
        <div className="border-2 border-dashed border-[#2C2824]/20 p-3 flex flex-col gap-2">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Paste a Figma, Miro, or design URL..."
            className="w-full px-2 py-1.5 bg-[#F5EFE2] border border-[#2C2824]/20 text-xs font-mono outline-none focus:border-[#2C2824]"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="Title (optional)"
              className="flex-1 px-2 py-1.5 bg-[#F5EFE2] border border-[#2C2824]/20 text-xs font-mono outline-none focus:border-[#2C2824]"
            />
            <button
              onClick={handleAdd}
              disabled={!newUrl.trim()}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#2C2824] text-[#EDE5D4] text-[10px] font-mono uppercase font-bold border border-[#2C2824] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.8)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          {newUrl && (
            <span className="text-[9px] font-mono text-[#8C8278]">
              Detected: {TYPE_LABELS[detectDesignType(newUrl)]}
            </span>
          )}
        </div>
      )}

      {links.length === 0 && canEdit && (
        <p className="text-[10px] text-[#8C8278] text-center">
          Add Figma frames, Miro boards, or other design links to this ticket.
        </p>
      )}
    </div>
  );
}
