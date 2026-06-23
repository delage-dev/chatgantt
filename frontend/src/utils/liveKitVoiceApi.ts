/** Typed response from POST /api/voice/token */
export interface VoiceTokenResponse {
  server_url: string;
  participant_token: string;
}
