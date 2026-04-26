import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export interface LLMConfig {
  provider: 'anthropic' | 'openai';
  api_key: string;
}

const STORAGE_KEY = 'chatgantt_llm_config';

export function loadLLMConfig(): LLMConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.provider && parsed.api_key) return parsed as LLMConfig;
    return null;
  } catch {
    return null;
  }
}

export function saveLLMConfig(config: LLMConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

interface ChatSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: LLMConfig) => void;
}

export function ChatSettings({ isOpen, onClose, onSave }: ChatSettingsProps) {
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      const existing = loadLLMConfig();
      if (existing) {
        setProvider(existing.provider);
        setApiKey(existing.api_key);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!apiKey.trim()) return;
    const config: LLMConfig = { provider, api_key: apiKey.trim() };
    saveLLMConfig(config);
    onSave(config);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-[60]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] bg-[#F5EFE2] border-2 border-[#2C2824] shadow-[6px_6px_0_0_rgba(44,40,36,0.8)] z-[61] flex flex-col">
        {/* Header */}
        <div className="h-12 border-b-2 border-[#2C2824] flex items-center justify-between px-4 bg-[#E4DBCA]">
          <span className="font-mono text-xs font-bold uppercase tracking-widest">
            Chat Settings
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-5">
          {/* Provider */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
              Provider
            </label>
            <div className="flex gap-2">
              {(['anthropic', 'openai'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`flex-1 py-2 text-xs font-mono uppercase font-bold tracking-wider border-2 transition-colors ${
                    provider === p
                      ? 'bg-[#2C2824] text-[#EDE5D4] border-[#2C2824]'
                      : 'bg-[#F5EFE2] text-[#2C2824] border-[#2C2824]/30 hover:border-[#2C2824]'
                  }`}
                >
                  {p === 'anthropic' ? 'Claude' : 'GPT'}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
              className="w-full px-3 py-2 bg-[#F5EFE2] border-2 border-[#2C2824] font-mono text-sm outline-none focus:shadow-[2px_2px_0_0_rgba(44,40,36,0.4)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
            <p className="text-[10px] text-[#8C8278]">
              Stored in your browser only. Sent per-request, never saved on the server.
            </p>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="w-full py-2 bg-[#2C2824] text-[#EDE5D4] font-mono text-xs uppercase font-bold tracking-wider border-2 border-[#2C2824] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.8)] transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}
