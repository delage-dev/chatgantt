export type TicketType = 'epic' | 'story' | 'task' | 'subtask';

export interface Assignee {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface GanttTask {
  id: string;
  parent_id: string | null;
  ticket_type: TicketType;
  summary: string;
  description: string | null;
  assignee: Assignee | null;
  start_date: string; // ISO date "YYYY-MM-DD"
  end_date: string;
  status: string;
  dependencies: string[] | null;
  qa_start_date: string | null;
  qa_end_date: string | null;
  sort_order: number;
  provider_meta: Record<string, unknown> | null;
}

export interface TicketTree {
  project_key: string;
  tickets: GanttTask[];
}

export interface TicketUpdate {
  start_date?: string;
  end_date?: string;
  parent_id?: string;
  assignee_id?: string;
  description?: string;
  qa_start_date?: string;
  qa_end_date?: string;
  dependencies?: string[];
  sort_order?: number;
  provider_meta?: Record<string, unknown>;
  clear_qa?: boolean;
}

export interface BatchUpdateItem {
  ticket_id: string;
  updates: TicketUpdate;
}

export interface BatchResult {
  succeeded: string[];
  failed: string[];
  auto_resolved_blockers: string[];
}

export interface TicketUpdateResponse {
  ticket: GanttTask;
  auto_resolved_blockers: string[];
}

export interface Comment {
  id: string;
  author: Assignee;
  content: string;
  created_at: string;
}

export type UserRole = 'viewer' | 'editor';

export interface UserContext {
  user_id: string;
  display_name: string;
  role: UserRole;
}

// UI-enriched version with hierarchy info
export interface FlatGanttTask extends GanttTask {
  depth: number;
  hasChildren: boolean;
}
