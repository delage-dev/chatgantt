import { useState, useCallback } from 'react';
import { BookOpen, X, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useResourceStore } from '../store/resourceStore';
import { useResources } from '../hooks/useResources';
import { ResourceCard } from './ResourceCard';

export function ProjectResources() {
  const [isOpen, setIsOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const projectUrls = useResourceStore((s) => s.projectResourceUrls);
  const projectResources = useResourceStore((s) => s.projectResources);
  const loadingProject = useResourceStore((s) => s.loadingProject);
  const error = useResourceStore((s) => s.error);
  const addUrl = useResourceStore((s) => s.addProjectResourceUrl);
  const removeUrl = useResourceStore((s) => s.removeProjectResourceUrl);

  const { fetchProjectResources } = useResources();

  const handleAddUrl = useCallback(() => {
    const url = urlInput.trim();
    if (!url) return;
    addUrl(url);
    setUrlInput('');
  }, [urlInput, addUrl]);

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-30 w-14 h-14 bg-[#2C2824] text-[#EDE5D4] flex items-center justify-center border-2 border-[#2C2824] shadow-[4px_4px_0_0_rgba(44,40,36,0.8)] hover:shadow-[6px_6px_0_0_rgba(44,40,36,0.8)] hover:-translate-y-0.5 transition-all"
        title="Project knowledge"
      >
        <BookOpen className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-30 w-[380px] h-[500px] bg-[#F5EFE2] border-2 border-[#2C2824] shadow-[4px_4px_0_0_rgba(44,40,36,0.8)] flex flex-col">
      {/* Header */}
      <div className="h-12 border-b-2 border-[#2C2824] flex items-center justify-between px-4 bg-[#E4DBCA] flex-shrink-0">
        <span className="font-mono text-xs font-bold uppercase tracking-widest">
          Project Knowledge
        </span>
        <button
          onClick={() => setIsOpen(false)}
          className="w-7 h-7 flex items-center justify-center hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Add URL */}
      <div className="p-3 border-b border-[#2C2824]/15 flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddUrl();
          }}
          placeholder="Add resource URL..."
          className="flex-1 px-3 py-1.5 bg-[#F5EFE2] border border-[#2C2824]/30 font-mono text-xs outline-none focus:border-[#2C2824] transition-colors"
        />
        <button
          onClick={handleAddUrl}
          disabled={!urlInput.trim()}
          className="w-8 h-8 flex items-center justify-center bg-[#2C2824] text-[#EDE5D4] border-2 border-[#2C2824] disabled:opacity-40 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* URL list + Fetch button */}
      {projectUrls.length > 0 && (
        <div className="px-3 py-2 border-b border-[#2C2824]/15 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
              {projectUrls.length} source{projectUrls.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={fetchProjectResources}
              disabled={loadingProject}
              className="flex items-center gap-1 text-[10px] font-mono uppercase font-bold px-2 py-1 border border-[#2C2824]/30 hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${loadingProject ? 'animate-spin' : ''}`} />
              {loadingProject ? 'Fetching...' : 'Fetch All'}
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-20 overflow-y-auto">
            {projectUrls.map((url) => (
              <div key={url} className="flex items-center gap-2 text-[11px] font-mono truncate">
                <button
                  onClick={() => removeUrl(url)}
                  className="w-4 h-4 flex items-center justify-center text-[#8C8278] hover:text-[#C4453A] flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <span className="truncate text-[#5C564E]">{url}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resources content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 custom-scrollbar">
        {error && (
          <div className="bg-[#C4453A]/10 border border-[#C4453A]/30 px-3 py-2 text-xs text-[#C4453A]">
            {error}
          </div>
        )}

        {projectResources.length === 0 && projectUrls.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <div>
              <BookOpen className="w-8 h-8 mx-auto mb-3 text-[#8C8278]" />
              <p className="text-sm text-[#8C8278] font-medium">
                Add resource URLs to pull in project knowledge
              </p>
              <p className="text-[10px] text-[#8C8278] mt-2 font-mono uppercase">
                Wiki pages, docs, articles
              </p>
            </div>
          </div>
        )}

        {projectResources.length === 0 && projectUrls.length > 0 && !loadingProject && (
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <p className="text-sm text-[#8C8278] font-medium">
              Click "Fetch All" to load resources
            </p>
          </div>
        )}

        {loadingProject && projectResources.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <span className="font-mono text-sm text-[#8C8278] uppercase tracking-widest animate-pulse">
              Loading...
            </span>
          </div>
        )}

        {projectResources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </div>
    </div>
  );
}
