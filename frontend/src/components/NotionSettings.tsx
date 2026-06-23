import { useState } from 'react';
import { X, Settings, CheckCircle2, XCircle } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';

interface NotionSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Connection settings for the Notion provider + LiveKit voice.
 * Replaces the old Twilio VoiceSettings modal.
 * All values persist in localStorage via the settingsStore — never sent to the server
 * except as provider headers on API requests or as JWT attributes in the voice token.
 */
export function NotionSettings({ isOpen, onClose }: NotionSettingsProps) {
  const {
    provider,
    notionToken,
    projectDataSourceId,
    blockersDataSourceId,
    setProvider,
    setNotionToken,
    setProjectDataSourceId,
    setBlockersDataSourceId,
    isConfigured,
  } = useSettingsStore();

  const [localToken, setLocalToken] = useState('');
  const [localProject, setLocalProject] = useState('');
  const [localBlockers, setLocalBlockers] = useState('');

  const configured = isConfigured();

  const handleSave = () => {
    if (localToken.trim()) setNotionToken(localToken.trim());
    if (localProject.trim()) setProjectDataSourceId(localProject.trim());
    if (localBlockers.trim()) setBlockersDataSourceId(localBlockers.trim());
    if (localToken.trim() || localProject.trim()) setProvider('notion');
    setLocalToken('');
    setLocalProject('');
    setLocalBlockers('');
  };

  const handleUseMock = () => {
    setProvider('mock');
    setNotionToken('');
    setProjectDataSourceId('');
    setBlockersDataSourceId('');
  };

  if (!isOpen) return null;

  const maskedToken = notionToken
    ? `****${notionToken.slice(-4)}`
    : '';
  const maskedProject = projectDataSourceId
    ? `****${projectDataSourceId.slice(-6)}`
    : '';

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[60]" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] max-h-[85vh] bg-[#F5EFE2] border-2 border-[#2C2824] shadow-[6px_6px_0_0_rgba(44,40,36,0.8)] z-[61] flex flex-col">
        {/* Header */}
        <div className="h-12 border-b-2 border-[#2C2824] flex items-center justify-between px-4 bg-[#E4DBCA] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest">
              Connection Settings
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Status */}
          <div
            className={`flex items-center gap-2 px-3 py-2 border-2 ${
              configured
                ? 'border-[#7FB5B0] bg-[#7FB5B0]/10'
                : 'border-[#C4453A]/30 bg-[#C4453A]/5'
            }`}
          >
            {configured ? (
              <CheckCircle2 className="w-4 h-4 text-[#7FB5B0]" />
            ) : (
              <XCircle className="w-4 h-4 text-[#C4453A]" />
            )}
            <span className="text-xs font-mono font-bold uppercase">
              {provider === 'notion' && configured
                ? 'Notion connected'
                : provider === 'mock'
                ? 'Mock provider (demo data)'
                : 'Not configured'}
            </span>
            {provider === 'notion' && maskedProject && (
              <span className="text-xs font-mono ml-auto text-[#8C8278]">
                {maskedProject}
              </span>
            )}
          </div>

          {/* Notion credentials */}
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
              Notion Integration Token
            </span>
            <input
              type="password"
              value={localToken}
              onChange={(e) => setLocalToken(e.target.value)}
              placeholder={maskedToken || 'secret_...'}
              className="w-full px-3 py-2 bg-[#F5EFE2] border-2 border-[#2C2824] font-mono text-sm outline-none focus:shadow-[2px_2px_0_0_rgba(44,40,36,0.4)]"
            />

            <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
              Tasks Data Source ID
            </span>
            <input
              type="text"
              value={localProject}
              onChange={(e) => setLocalProject(e.target.value)}
              placeholder={maskedProject || 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
              className="w-full px-3 py-2 bg-[#F5EFE2] border-2 border-[#2C2824] font-mono text-sm outline-none focus:shadow-[2px_2px_0_0_rgba(44,40,36,0.4)]"
            />

            <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
              Blockers Data Source ID{' '}
              <span className="normal-case font-normal">(optional)</span>
            </span>
            <input
              type="text"
              value={localBlockers}
              onChange={(e) => setLocalBlockers(e.target.value)}
              placeholder={
                blockersDataSourceId
                  ? `****${blockersDataSourceId.slice(-6)}`
                  : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
              }
              className="w-full px-3 py-2 bg-[#F5EFE2] border-2 border-[#2C2824] font-mono text-sm outline-none focus:shadow-[2px_2px_0_0_rgba(44,40,36,0.4)]"
            />

            <p className="text-[10px] text-[#8C8278] leading-relaxed">
              Stored in browser localStorage only. Never written to the server.
              Sent as request headers (X-Provider, X-Project, Authorization) and
              embedded transiently in the LiveKit voice JWT.
            </p>

            <button
              onClick={handleSave}
              disabled={!localToken.trim() && !localProject.trim()}
              className="w-full py-2 bg-[#2C2824] text-[#EDE5D4] font-mono text-xs uppercase font-bold tracking-wider border-2 border-[#2C2824] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.8)] transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save Notion Settings
            </button>
          </div>

          <div className="border-t-2 border-[#2C2824]/20" />

          {/* Mock fallback */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase text-[#8C8278] font-bold">
              Development
            </span>
            <p className="text-[10px] text-[#8C8278]">
              Use the mock provider with pre-seeded demo data (no Notion account needed).
            </p>
            <button
              onClick={handleUseMock}
              disabled={provider === 'mock'}
              className="w-full py-2 bg-transparent text-[#2C2824] font-mono text-xs uppercase font-bold tracking-wider border-2 border-[#2C2824]/40 hover:border-[#2C2824] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {provider === 'mock' ? 'Using Mock Provider' : 'Switch to Mock Provider'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
