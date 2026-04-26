import type { GanttTask, FlatGanttTask } from '../types/gantt';

/** Build a parent->children map from a flat ticket list, sorted by sort_order */
function buildChildrenMap(tickets: GanttTask[]): Map<string | null, GanttTask[]> {
  const map = new Map<string | null, GanttTask[]>();
  for (const t of tickets) {
    const key = t.parent_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  for (const children of map.values()) {
    children.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }
  return map;
}

/** Check if a ticket has children in the list */
function hasChildrenInList(ticketId: string, childrenMap: Map<string | null, GanttTask[]>): boolean {
  return (childrenMap.get(ticketId)?.length ?? 0) > 0;
}

/** Flatten the ticket tree into a display-ordered list with depth info */
export function flattenTree(
  tickets: GanttTask[],
  expandedIds: Set<string>
): FlatGanttTask[] {
  const childrenMap = buildChildrenMap(tickets);
  const result: FlatGanttTask[] = [];

  function walk(parentId: string | null, depth: number) {
    const children = childrenMap.get(parentId) || [];
    for (const task of children) {
      const hasKids = hasChildrenInList(task.id, childrenMap);
      result.push({ ...task, depth, hasChildren: hasKids });
      if (hasKids && expandedIds.has(task.id)) {
        walk(task.id, depth + 1);
      }
    }
  }

  walk(null, 0);
  return result;
}

/** Build a map from any ticket ID to its root epic ID */
export function buildEpicAncestorMap(tickets: GanttTask[]): Map<string, string> {
  const parentMap = new Map<string, string | null>();
  const typeMap = new Map<string, string>();
  for (const t of tickets) {
    parentMap.set(t.id, t.parent_id);
    typeMap.set(t.id, t.ticket_type);
  }

  const epicMap = new Map<string, string>();

  function findEpic(id: string): string | null {
    if (typeMap.get(id) === 'epic') return id;
    const pid = parentMap.get(id);
    if (!pid) return null;
    return findEpic(pid);
  }

  for (const t of tickets) {
    const epicId = findEpic(t.id);
    if (epicId) epicMap.set(t.id, epicId);
  }
  return epicMap;
}
