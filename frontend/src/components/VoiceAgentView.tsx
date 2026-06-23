import { BarVisualizer, RoomAudioRenderer, useAgent } from '@livekit/components-react';

/**
 * Renders agent state label and audio visualizer bar.
 * Must be mounted inside a SessionProvider.
 */
export function VoiceAgentView() {
  const agent = useAgent();

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <RoomAudioRenderer />

      <div className="text-[10px] font-mono uppercase tracking-widest text-[#8C8278]">
        {agent.state ?? 'disconnected'}
      </div>

      {agent.canListen && (
        <div className="w-full h-12">
          <BarVisualizer
            track={agent.microphoneTrack}
            state={agent.state}
            barCount={7}
          />
        </div>
      )}

      {agent.isFinished && (
        <div className="text-[10px] font-mono text-[#8C8278]">
          Session ended
        </div>
      )}
    </div>
  );
}
