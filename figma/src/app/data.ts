import { addDays, format } from 'date-fns';

export type Department = 'frontend' | 'backend' | 'design' | 'product';
export type ItemType = 'epic' | 'story' | 'task';
export type Source = 'jira' | 'linear' | 'github' | 'asana';

export interface Assignee {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface GanttItem {
  id: string;
  title: string;
  type: ItemType;
  source: Source;
  sourceId: string;
  status: 'todo' | 'in-progress' | 'done';
  department: Department;
  assignees: Assignee[];
  startDate: Date;
  endDate: Date;
  resourceLink?: string;
  figmaLink?: string;
  description?: string;
  children?: GanttItem[];
}

const today = new Date();

export const USERS: Record<string, Assignee> = {
  alex: { id: 'u1', name: 'Alex T', avatarUrl: 'https://images.unsplash.com/photo-1649433658557-54cf58577c68?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHByb2ZpbGUlMjBwaWN0dXJlfGVufDF8fHx8MTc3NDg2OTQ5MXww&ixlib=rb-4.1.0&q=80&w=1080' },
  sarah: { id: 'u2', name: 'Sarah K', avatarUrl: 'https://images.unsplash.com/photo-1697517874153-0384d16722fd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHBvcnRyYWl0JTIwaGVhZHNob3R8ZW58MXx8fHwxNzc0OTAyNjI2fDA&ixlib=rb-4.1.0&q=80&w=1080' },
  mike: { id: 'u3', name: 'Mike L', avatarUrl: 'https://images.unsplash.com/photo-1628619487942-01c58eed5c33?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW4lMjBnbGFzc2VzJTIwaGVhZHNob3R8ZW58MXx8fHwxNzc0OTIwNDE4fDA&ixlib=rb-4.1.0&q=80&w=1080' },
  emma: { id: 'u4', name: 'Emma R', avatarUrl: 'https://images.unsplash.com/photo-1761933808230-9a2e78956daa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWlsaW5nJTIwcGVyc29uJTIwcHJvZmlsZSUyMGhlYWRzaG90fGVufDF8fHx8MTc3NDg2NzcwNnww&ixlib=rb-4.1.0&q=80&w=1080' },
};

export const MOCK_DATA: GanttItem[] = [
  {
    id: 'epic-1',
    title: 'Q3 Product Overhaul',
    type: 'epic',
    source: 'linear',
    sourceId: 'PROD-102',
    status: 'in-progress',
    department: 'product',
    assignees: [USERS.alex, USERS.emma],
    startDate: today,
    endDate: addDays(today, 14),
    resourceLink: 'https://notion.so/product-overhaul-q3',
    description: 'A massive cross-functional effort to modernize the core application UI and optimize backend query performance.',
    children: [
      {
        id: 'story-1',
        title: 'Revamp Dashboard UI',
        type: 'story',
        source: 'linear',
        sourceId: 'PROD-103',
        status: 'in-progress',
        department: 'frontend',
        assignees: [USERS.sarah],
        startDate: today,
        endDate: addDays(today, 6),
        resourceLink: 'https://linear.app/issue/PROD-103',
        description: 'Update the main dashboard components to match the new brutalist design language.',
        children: [
          {
            id: 'task-1',
            title: 'Implement Data Grid',
            type: 'task',
            source: 'github',
            sourceId: '#401',
            status: 'done',
            department: 'frontend',
            assignees: [USERS.sarah],
            startDate: today,
            endDate: addDays(today, 2),
            resourceLink: 'https://github.com/org/repo/pull/401',
            figmaLink: 'https://figma.com/file/xyz/Data-Grid',
            description: 'Build the reusable data grid component with high-contrast borders and mono font.'
          },
          {
            id: 'task-2',
            title: 'Connect Live Sync',
            type: 'task',
            source: 'linear',
            sourceId: 'PROD-105',
            status: 'in-progress',
            department: 'frontend',
            assignees: [USERS.alex],
            startDate: addDays(today, 2),
            endDate: addDays(today, 6),
            resourceLink: 'https://linear.app/issue/PROD-105',
            figmaLink: 'https://figma.com/file/xyz/Sync-Indicator',
            description: 'Wire up the live sync visual indicators.'
          }
        ]
      },
      {
        id: 'story-2',
        title: 'Optimize Core Queries',
        type: 'story',
        source: 'jira',
        sourceId: 'BE-84',
        status: 'todo',
        department: 'backend',
        assignees: [USERS.mike],
        startDate: addDays(today, 5),
        endDate: addDays(today, 12),
        resourceLink: 'https://jira.com/browse/BE-84',
        description: 'Audit and rewrite the N+1 queries occurring on the dashboard aggregation endpoints.',
        children: [
          {
            id: 'task-3',
            title: 'Index Gantt DB Table',
            type: 'task',
            source: 'jira',
            sourceId: 'BE-85',
            status: 'todo',
            department: 'backend',
            assignees: [USERS.mike],
            startDate: addDays(today, 5),
            endDate: addDays(today, 8),
            resourceLink: 'https://jira.com/browse/BE-85',
            description: 'Add composite indexes for faster time-range queries.'
          },
          {
            id: 'task-4',
            title: 'Refactor Sync Webhooks',
            type: 'task',
            source: 'github',
            sourceId: '#512',
            status: 'todo',
            department: 'backend',
            assignees: [USERS.mike, USERS.alex],
            startDate: addDays(today, 8),
            endDate: addDays(today, 12),
            resourceLink: 'https://github.com/org/repo/pull/512',
            description: 'Update the incoming webhook handler for Jira and Linear syncs.'
          }
        ]
      }
    ]
  },
  {
    id: 'epic-2',
    title: 'Marketing Site Relaunch',
    type: 'epic',
    source: 'asana',
    sourceId: '82941',
    status: 'todo',
    department: 'design',
    assignees: [USERS.emma],
    startDate: addDays(today, 10),
    endDate: addDays(today, 25),
    resourceLink: 'https://asana.com/0/82941',
    description: 'Design and deploy the new delage.io inspired marketing website.',
  }
];
