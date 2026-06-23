import type { GanttTask, TicketTree, TicketUpdate, TicketUpdateResponse, BatchUpdateItem, BatchResult, Comment, UserContext } from '../types/gantt';
import type { Blocker, BlockerCreate, BlockerStatus } from '../types/blockers';

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

export async function fetchTasks(project?: string): Promise<TicketTree> {
  const params = project ? `?project=${encodeURIComponent(project)}` : '';
  return fetchJSON<TicketTree>(`${API_BASE}/tasks${params}`);
}

export async function fetchTask(ticketId: string): Promise<GanttTask> {
  return fetchJSON<GanttTask>(`${API_BASE}/tasks/${encodeURIComponent(ticketId)}`);
}

export async function updateTask(ticketId: string, updates: TicketUpdate): Promise<TicketUpdateResponse> {
  return fetchJSON<TicketUpdateResponse>(`${API_BASE}/tasks/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function fetchComments(ticketId: string): Promise<Comment[]> {
  return fetchJSON<Comment[]>(`${API_BASE}/tasks/${encodeURIComponent(ticketId)}/comments`);
}

export async function createComment(ticketId: string, content: string): Promise<Comment> {
  return fetchJSON<Comment>(`${API_BASE}/tasks/${encodeURIComponent(ticketId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function fetchMe(): Promise<UserContext> {
  return fetchJSON<UserContext>(`${API_BASE}/me`);
}

// ─── Blockers ────────────────────────────────────────────────────────────────

export interface BlockerFilters {
  status?: BlockerStatus;
  blocked_task_id?: string;
  blocking_task_id?: string;
}

export async function fetchBlockers(filters?: BlockerFilters): Promise<Blocker[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.blocked_task_id) params.set('blocked_task_id', filters.blocked_task_id);
  if (filters?.blocking_task_id) params.set('blocking_task_id', filters.blocking_task_id);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return fetchJSON<Blocker[]>(`${API_BASE}/blockers${qs}`);
}

export async function fetchTaskBlockers(taskId: string): Promise<Blocker[]> {
  return fetchJSON<Blocker[]>(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/blockers`);
}

export async function createBlocker(payload: BlockerCreate): Promise<Blocker> {
  return fetchJSON<Blocker>(`${API_BASE}/blockers`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resolveBlocker(blockerId: string): Promise<Blocker> {
  return fetchJSON<Blocker>(`${API_BASE}/blockers/${encodeURIComponent(blockerId)}/resolve`, {
    method: 'POST',
  });
}

export async function deleteBlocker(blockerId: string): Promise<void> {
  return fetchJSON<void>(`${API_BASE}/blockers/${encodeURIComponent(blockerId)}`, {
    method: 'DELETE',
  });
}

export async function batchUpdateTasks(items: BatchUpdateItem[]): Promise<BatchResult> {
  return fetchJSON<BatchResult>(`${API_BASE}/tasks/batch`, {
    method: 'POST',
    body: JSON.stringify(items),
  });
}

// ─── Chat API ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatTaskSummary {
  id: string;
  summary: string;
  type: string;
  status: string;
  assignee: string | null;
  parent_id: string | null;
  start_date: string | null;
  end_date: string | null;
  provider_meta?: Record<string, unknown> | null;
}

export interface ChatResourceSummary {
  title: string;
  source_url: string;
  content: string;
}

export interface ChatBlockerSummary {
  id: string;
  blocked_task_id: string;
  blocking_task_id: string | null;
  external_blocker: string | null;
  reason: string;
  severity: string;
  status: string;
}

export interface ToolCallExecution {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
  succeeded: boolean;
}

export interface ChatRequest {
  messages: ChatMessage[];
  project_context: {
    project_key: string;
    tasks: ChatTaskSummary[];
    resources?: ChatResourceSummary[];
    blockers?: ChatBlockerSummary[];
  };
}

export interface ChatResponse {
  message: ChatMessage;
  tool_executions: ToolCallExecution[];
}

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  return fetchJSON<ChatResponse>(`${API_BASE}/chat`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ─── Resources API ───────────────────────────────────────────────────────────

import type { ResourceFetchRequest, ResourceFetchResponse } from '../types/resources';

export async function fetchResources(request: ResourceFetchRequest): Promise<ResourceFetchResponse> {
  return fetchJSON<ResourceFetchResponse>(`${API_BASE}/resources/fetch`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
