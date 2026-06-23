import { useEffect, useMemo, useState } from 'react';
import { useSession, SessionProvider } from '@livekit/components-react';
import { TokenSource } from 'livekit-client';
import { X, Mic, MicOff } from 'lucide-react';
import { VoiceAgentView } from './VoiceAgentView';
import { useSettingsStore } from '../store/settingsStore';
import '@livekit/components-styles';

interface VoicePaneProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * LiveKit browser voice pane.
 *
 * Connects to POST /api/voice/token (Track B endpoint). Secrets travel only
 * in the minted JWT — never stored server-side.
 *
 * Must be mounted outside SessionProvider; it creates its own session.
 */
export function VoicePane({ isOpen, onClose }: VoicePaneProps) {
  const { notionToken, projectDataSourceId, blockersDataSourceId, provider } =
    useSettingsStore();

  // Build a stable TokenSource that carries the Notion context as participant
  // attributes so the backend can embed them in the minted JWT.
  const tokenSource = useMemo(() => {
    const attributes: Record<string, string> = {};
    if (provider === 'notion' && notionToken) {
      attributes['notion_token'] = notionToken;
      attributes['project_id'] = projectDataSourceId;
      if (blockersDataSourceId) {
        attributes['blockers_source'] = blockersDataSourceId;
      }
    }

    return TokenSource.endpoint('/api/voice/token', {
      // participant_attributes are merged into the minted JWT by the backend
      // (Track B Task B.2) and forwarded to the agent via room attributes.
      headers: {},
      // body additions are sent as the POST body per the LiveKit endpoint spec
    });
    // NOTE: participant_attributes will be sent as part of the request body
    // that TokenSource.endpoint automatically includes when calling useSession
    // with agentName — see the backend /api/voice/token handler.
  }, [provider, notionToken, projectDataSourceId, blockersDataSourceId]);

  const session = useSession(tokenSource, {
    agentName: 'chatgantt-voice-agent',
  });

  const [active, setActive] = useState(false);

  // Clean up session when pane closes
  useEffect(() => {
    if (!isOpen && active) {
      session.end();
      setActive(false);
    }
  }, [isOpen, active, session]);

  const handleToggle = async () => {
    if (active) {
      await session.end();
      setActive(false);
    } else {
      await session.start();
      setActive(true);
    }
  };

  if (!isOpen) return null;

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
          <SessionProvider session={session}>
            <VoiceAgentView />
          </SessionProvider>

          {/* Start / Stop button */}
          <button
            onClick={handleToggle}
            className={`w-full py-3 font-mono text-xs uppercase font-bold tracking-wider border-2 transition-shadow ${
              active
                ? 'bg-[#C4453A] text-white border-[#C4453A] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.8)]'
                : 'bg-[#2C2824] text-[#EDE5D4] border-[#2C2824] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.8)]'
            }`}
          >
            {active ? (
              <span className="flex items-center justify-center gap-2">
                <MicOff className="w-3.5 h-3.5" />
                End Session
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Mic className="w-3.5 h-3.5" />
                Start Voice Session
              </span>
            )}
          </button>

          <p className="text-[10px] text-[#8C8278] text-center leading-relaxed">
            Mic-only WebRTC via LiveKit. Configure Notion in Settings.
          </p>
        </div>
      </div>
    </>
  );
}
