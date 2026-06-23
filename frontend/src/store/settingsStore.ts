import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Provider connection settings — stored in localStorage, never sent to the server. */
export interface ProviderSettings {
  provider: string;
  notionToken: string;
  projectDataSourceId: string;
  blockersDataSourceId: string;
}

interface SettingsState extends ProviderSettings {
  setProvider: (provider: string) => void;
  setNotionToken: (token: string) => void;
  setProjectDataSourceId: (id: string) => void;
  setBlockersDataSourceId: (id: string) => void;
  isConfigured: () => boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      provider: 'mock',
      notionToken: '',
      projectDataSourceId: '',
      blockersDataSourceId: '',

      setProvider: (provider) => set({ provider }),
      setNotionToken: (notionToken) => set({ notionToken }),
      setProjectDataSourceId: (projectDataSourceId) => set({ projectDataSourceId }),
      setBlockersDataSourceId: (blockersDataSourceId) => set({ blockersDataSourceId }),

      isConfigured: () => {
        const { provider, notionToken, projectDataSourceId } = get();
        if (provider !== 'notion') return true; // mock always "configured"
        return Boolean(notionToken && projectDataSourceId);
      },
    }),
    {
      name: 'chatgantt-settings',
    }
  )
);

/**
 * Returns the provider request headers based on the current settings store state.
 * Falls back to mock/DEMO when not configured so existing dev flows keep working.
 */
export function getProviderHeaders(): Record<string, string> {
  const { provider, notionToken, projectDataSourceId, blockersDataSourceId } =
    useSettingsStore.getState();

  if (provider === 'notion' && notionToken && projectDataSourceId) {
    const headers: Record<string, string> = {
      'X-Provider': 'notion',
      'X-Project': projectDataSourceId,
      Authorization: `Bearer ${notionToken}`,
    };
    if (blockersDataSourceId) {
      headers['X-Notion-Blockers-Source'] = blockersDataSourceId;
    }
    return headers;
  }

  // Mock fallback — matches the backend's default mock adapter
  return {
    'X-Provider': 'mock',
    'X-Project': 'DEMO',
  };
}
