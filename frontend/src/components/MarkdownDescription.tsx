import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pencil } from 'lucide-react';

interface MarkdownDescriptionProps {
  value: string | null;
  onChange: (newValue: string) => void;
  canEdit?: boolean;
}

export function MarkdownDescription({ value, onChange, canEdit = true }: MarkdownDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(120, textareaRef.current.scrollHeight)}px`;
    }
  }, [draft, isEditing]);

  const handleSave = useCallback(() => {
    onChange(draft);
    setIsEditing(false);
  }, [draft, onChange]);

  const handleCancel = useCallback(() => {
    setDraft(value || '');
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
            Description (editing)
          </span>
          <span className="text-[10px] text-[#8C8278] font-mono">
            Ctrl+Enter to save, Esc to cancel
          </span>
        </div>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full min-h-[120px] p-3 bg-[#F5EFE2] border-2 border-[#2C2824] font-mono text-sm text-[#2C2824] resize-none outline-none focus:shadow-[2px_2px_0_0_rgba(44,40,36,0.4)]"
          placeholder="Write a description using markdown..."
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-[#2C2824] text-[#EDE5D4] text-xs font-mono uppercase font-bold tracking-wider border-2 border-[#2C2824] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.8)] transition-shadow"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1 bg-[#F5EFE2] text-[#2C2824] text-xs font-mono uppercase font-bold tracking-wider border border-[#2C2824]/30 hover:border-[#2C2824] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!value) {
    if (!canEdit) {
      return <p className="text-sm text-[#8C8278]">No description</p>;
    }
    return (
      <button
        onClick={() => {
          setDraft('');
          setIsEditing(true);
        }}
        className="w-full text-left p-3 border-2 border-dashed border-[#2C2824]/20 text-[#8C8278] text-sm font-medium hover:border-[#2C2824]/40 hover:text-[#5C564E] transition-colors cursor-pointer"
      >
        Add a description...
      </button>
    );
  }

  return (
    <div className="group relative">
      {canEdit && (
        <button
          onClick={() => {
            setDraft(value);
            setIsEditing(true);
          }}
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center border border-[#2C2824]/30 bg-[#F5EFE2] hover:bg-[#2C2824] hover:text-[#EDE5D4] z-10"
          title="Edit description"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      <div
        className={`markdown-prose ${canEdit ? 'cursor-pointer' : ''}`}
        onClick={canEdit ? () => {
          setDraft(value);
          setIsEditing(true);
        } : undefined}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
      </div>
    </div>
  );
}
