import { useEffect, useState } from 'react';
import { useSession, SessionProvider } from '@livekit/components-react';
import { TokenSource } from 'livekit-client';
import { X, Mic, MicOff, AlertCircle } from 'lucide-react';
import { VoiceAgentView } from './VoiceAgentView';
import '@livekit/components-styles';

interface VoicePaneProps {
  isOpen: boolean;
  onClose: () => void;
}

// Stable token source — POSTs to /api/voice/token with no body.
// The backend holds all credentials server-side.
const TOKEN_SOURCE = TokenSource.endpoint('/api/voice/token');

/**
 * LiveKit browser voice pane.
 *
 * Connects to POST /api/voice/token on open (one-click from the header mic
 * button). No credential input required — the backend is server-configured.
 */
function VoicePaneInner({ onClose }: { onClose: () => void }) {
  const session = useSession(TOKEN_SOURCE, {
    agentName: 'chatgantt-voice-agent',
  });

  const [active, setActive] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Connect immediately on mount (one-click from the header mic button)
  useEffect(() => {
    let cancelled = false;
    async function connect() {
      try {
        await session.start();
        if (!cancelled) setActive(true);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Voice not available';
          setConnectError(
            msg.includes('5') || msg.includes('config')
              ? 'Voice is not configured on the server. Check LIVEKIT_* env vars.'
              : msg
          );
        }
      }
    }
    connect();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up session when pane closes
  useEffect(() => {
    return () => {
      if (active) session.end();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const handleEnd = async () => {
    await session.end();
    setActive(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[60]" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] bg-[#F5EFE2] border-2 border-[#2C2824] shadow-[6px_6px_0_0_rgba(44,40,36,0.8)] z-[61] flex flex-col">
        {/* Header */}
        <div className="h-12 border-b-2 border-[#2C2824] flex items-center justify-between px-4 bg-[#E4DBCA] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest">
              Voice Agent
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center hover:bg-[#2C2824] hover:text-[#EDE5D4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {connectError ? (
            <div className="flex items-start gap-2 px-3 py-3 border-2 border-[#C4453A]/40 bg-[#C4453A]/5">
              <AlertCircle className="w-4 h-4 text-[#C4453A] mt-0.5 flex-shrink-0" />
              <p className="text-xs font-mono text-[#C4453A] leading-relaxed">{connectError}</p>
            </div>
          ) : (
            <SessionProvider session={session}>
              <VoiceAgentView />
            </SessionProvider>
          )}

          {/* End session button — only shown when connected */}
          {active && !connectError && (
            <button
              onClick={handleEnd}
              className="w-full py-3 font-mono text-xs uppercase font-bold tracking-wider border-2 bg-[#C4453A] text-white border-[#C4453A] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.8)] transition-shadow"
            >
              <span className="flex items-center justify-center gap-2">
                <MicOff className="w-3.5 h-3.5" />
                End Session
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export function VoicePane({ isOpen, onClose }: VoicePaneProps) {
  if (!isOpen) return null;
  return <VoicePaneInner onClose={onClose} />;
}
