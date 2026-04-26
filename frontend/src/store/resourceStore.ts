import { create } from 'zustand';
import type { Resource } from '../types/resources';

const STORAGE_KEY = 'chatgantt_project_resources';

function loadProjectUrls(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProjectUrls(urls: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
}

interface ResourceState {
  projectResourceUrls: string[];
  projectResources: Resource[];
  ticketResources: Record<string, Resource[]>;
  loadingProject: boolean;
  loadingTicket: string | null;
  error: string | null;

  addProjectResourceUrl: (url: string) => void;
  removeProjectResourceUrl: (url: string) => void;
  setProjectResources: (resources: Resource[]) => void;
  setTicketResources: (ticketId: string, resources: Resource[]) => void;
  setLoadingProject: (loading: boolean) => void;
  setLoadingTicket: (ticketId: string | null) => void;
  setError: (error: string | null) => void;
}

export const useResourceStore = create<ResourceState>((set) => ({
  projectResourceUrls: loadProjectUrls(),
  projectResources: [],
  ticketResources: {},
  loadingProject: false,
  loadingTicket: null,
  error: null,

  addProjectResourceUrl: (url) =>
    set((state) => {
      if (state.projectResourceUrls.includes(url)) return state;
      const urls = [...state.projectResourceUrls, url];
      saveProjectUrls(urls);
      return { projectResourceUrls: urls };
    }),

  removeProjectResourceUrl: (url) =>
    set((state) => {
      const urls = state.projectResourceUrls.filter((u) => u !== url);
      saveProjectUrls(urls);
      return {
        projectResourceUrls: urls,
        projectResources: state.projectResources.filter((r) => r.source_url !== url),
      };
    }),

  setProjectResources: (resources) => set({ projectResources: resources }),

  setTicketResources: (ticketId, resources) =>
    set((state) => ({
      ticketResources: { ...state.ticketResources, [ticketId]: resources },
    })),

  setLoadingProject: (loading) => set({ loadingProject: loading }),
  setLoadingTicket: (ticketId) => set({ loadingTicket: ticketId }),
  setError: (error) => set({ error }),
}));
