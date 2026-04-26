const API_BASE = '/api';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface VoiceConfigRequest {
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
  openai_api_key: string;
}

export interface VoiceConfigStatus {
  configured: boolean;
  twilio_phone_number: string | null;
  twilio_account_sid_last4: string | null;
  openai_key_last4: string | null;
}

export interface CallerMapping {
  phone_number: string;
  user_name: string;
  project_key: string;
  pin?: string;
}

export interface CallerMappingResponse {
  phone_number: string;
  user_name: string;
  project_key: string;
}

export async function saveVoiceConfig(config: VoiceConfigRequest): Promise<VoiceConfigStatus> {
  return fetchJSON<VoiceConfigStatus>(`${API_BASE}/voice/config`, {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function getVoiceConfig(): Promise<VoiceConfigStatus> {
  return fetchJSON<VoiceConfigStatus>(`${API_BASE}/voice/config`);
}

export async function addCallerMapping(mapping: CallerMapping): Promise<CallerMappingResponse> {
  return fetchJSON<CallerMappingResponse>(`${API_BASE}/voice/callers`, {
    method: 'POST',
    body: JSON.stringify(mapping),
  });
}

export async function listCallerMappings(): Promise<CallerMappingResponse[]> {
  return fetchJSON<CallerMappingResponse[]>(`${API_BASE}/voice/callers`);
}

export async function removeCallerMapping(phone: string): Promise<void> {
  return fetchJSON<void>(`${API_BASE}/voice/callers/${encodeURIComponent(phone)}`, {
    method: 'DELETE',
  });
}
