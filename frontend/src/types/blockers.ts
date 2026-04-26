export type BlockerSeverity = 'low' | 'medium' | 'high';
export type BlockerStatus = 'active' | 'resolved';

export interface Blocker {
  id: string;
  blocked_task_id: string;
  blocking_task_id: string | null;
  external_blocker: string | null;
  reason: string;
  severity: BlockerSeverity;
  status: BlockerStatus;
  created_by: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  auto_resolved: boolean;
}

export interface BlockerCreate {
  blocked_task_id: string;
  blocking_task_id?: string;
  external_blocker?: string;
  reason: string;
  severity?: BlockerSeverity;
}
