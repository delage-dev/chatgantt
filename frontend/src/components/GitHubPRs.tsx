import { useState, useCallback } from 'react';
import { GitMerge, X, Plus } from 'lucide-react';
import type { GanttTask } from '../types/gantt';

interface PRData {
  number: number;
  title: string;
  state: string;
  html_url: string;
  author: string;
  review_status: string;
  source: string;
  updated_at?: string;
}

interface GitHubPRsProps {
  item: GanttTask;
  applyUpdate: (taskId: string, updates: Partial<GanttTask>) => void;
  canEdit: boolean;
}

function parsePRUrl(url: string): { number: number; html_url: string } | null {
  const match = url.match(/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/);
  if (!match) return null;
  return { number: parseInt(match[1], 10), html_url: url.split('?')[0] };
}

const STATE_STYLES: Record<string, string> = {
  open: 'bg-[#7FB5B0]/20 border-[#7FB5B0]/40 text-[#4A8A84]',
  merged: 'bg-[#9BA4C4]/20 border-[#9BA4C4]/40 text-[#6B74A4]',
  closed: 'bg-[#C4453A]/10 border-[#C4453A]/30 text-[#C4453A]',
};

const REVIEW_STYLES: Record<string, string> = {
  approved: 'text-[#7FB5B0]',
  changes_requested: 'text-[#D4A017]',
  review_required: 'text-[#8C8278]',
  pending: 'text-[#8C8278]',
};

const REVIEW_LABELS: Record<string, string> = {
  approved: 'APPROVED',
  changes_requested: 'CHANGES REQ',
  review_required: 'REVIEW REQ',
  pending: 'PENDING',
};

export function GitHubPRs({ item, applyUpdate, canEdit }: GitHubPRsProps) {
  const [newUrl, setNewUrl] = useState('');

  const meta = item.provider_meta as Record<string, unknown> | null;
  const prs: PRData[] = (meta?.github_prs as PRData[] | undefined) ?? [];

  if (prs.length === 0 && !canEdit) return null;

  const persist = useCallback(
    (updated: PRData[]) => {
      applyUpdate(item.id, { provider_meta: { github_prs: updated } } as any);
    },
    [item.id, applyUpdate]
  );

  const handleAdd = useCallback(() => {
    const parsed = parsePRUrl(newUrl.trim());
    if (!parsed) return;
    // Check for duplicates
    if (prs.some((p) => p.html_url === parsed.html_url)) {
      setNewUrl('');
      return;
    }
    const entry: PRData = {
      number: parsed.number,
      title: '',
      state: 'open',
      html_url: parsed.html_url,
      author: '',
      review_status: 'pending',
      source: 'manual',
    };
    persist([...prs, entry]);
    setNewUrl('');
  }, [newUrl, prs, persist]);

  const handleRemove = useCallback(
    (url: string) => {
      persist(prs.filter((p) => p.html_url !== url));
    },
    [prs, persist]
  );

  return (
    <section>
      <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold flex items-center gap-1 mb-2">
        <GitMerge className="w-3 h-3" /> Pull Requests
      </span>

      {prs.length > 0 ? (
        <div className="flex flex-col gap-1.5 mb-2">
          {prs.map((pr) => (
            <div
              key={pr.html_url}
              className="flex items-center gap-2 px-2 py-1.5 border border-[#2C2824]/15 bg-[#F5EFE2] group"
            >
              <a
                href={pr.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] font-bold text-[#2C2824] hover:underline flex-shrink-0"
              >
                #{pr.number}
              </a>

              <span className={`text-[8px] font-mono font-bold uppercase px-1 py-0.5 border flex-shrink-0 ${STATE_STYLES[pr.state] || STATE_STYLES.open}`}>
                {pr.state.toUpperCase()}
              </span>

              <span className="text-[11px] flex-1 truncate">
                {pr.title || pr.html_url.split('/').slice(-2).join('/')}
              </span>

              {pr.author && (
                <span className="text-[9px] font-mono text-[#8C8278] flex-shrink-0">
                  @{pr.author}
                </span>
              )}

              {pr.review_status && pr.review_status !== 'pending' && (
                <span className={`text-[8px] font-mono font-bold flex-shrink-0 ${REVIEW_STYLES[pr.review_status] || ''}`}>
                  {REVIEW_LABELS[pr.review_status] || pr.review_status.toUpperCase()}
                </span>
              )}

              <span className="text-[8px] font-mono text-[#8C8278]/50 flex-shrink-0">
                {pr.source === 'manual' ? 'manual' : 'auto'}
              </span>

              {canEdit && (
                <button
                  onClick={() => handleRemove(pr.html_url)}
                  className="w-4 h-4 flex items-center justify-center text-[#8C8278] hover:text-[#C4453A] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#8C8278] mb-2">No pull requests linked</p>
      )}

      {canEdit && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Paste a GitHub PR URL..."
            className="flex-1 px-2 py-1.5 bg-[#F5EFE2] border border-dashed border-[#2C2824]/20 text-[11px] font-mono outline-none focus:border-[#2C2824]/40 placeholder:text-[#8C8278]"
          />
          <button
            onClick={handleAdd}
            disabled={!newUrl.trim() || !parsePRUrl(newUrl.trim())}
            className="px-2 py-1.5 border border-[#2C2824]/30 text-[#8C8278] hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors disabled:opacity-30"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </section>
  );
}
