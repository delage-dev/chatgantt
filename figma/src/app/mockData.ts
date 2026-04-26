import { addDays, subDays } from 'date-fns';

export type TaskType = 'epic' | 'story' | 'task';
export type IntegrationSource = 'jira' | 'linear' | 'github' | 'asana';

export interface GanttTask {
  id: string;
  title: string;
  type: TaskType;
  startDate: Date;
  endDate: Date;
  progress: number; // 0-100
  assignee?: {
    name: string;
    avatar: string;
  };
  source: IntegrationSource;
  isExpanded?: boolean;
  children?: GanttTask[];
}

const today = new Date('2026-03-31T00:00:00Z');

export const avatars = {
  sarah: 'https://images.unsplash.com/photo-1633355130553-2d90ad3507d3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMG9mJTIvd29tYW58ZW58MXx8fHwxNzc0OTE5NDI3fDA&ixlib=rb-4.1.0&q=80&w=1080',
  james: 'https://images.unsplash.com/photo-1588560979004-a4de3190506e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMG9mJTIwbWFuJTIwaW4lMjBvZmZpY2V8ZW58MXx8fHwxNzc0OTE5NDUw&ixlib=rb-4.1.0&q=80&w=1080',
  alex: 'https://images.unsplash.com/photo-1672462478040-a5920e2c23d8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMG9mJTIwc21pbGluZyUyMHBlcnNvbnxlbnwxfHx8fDE3NzQ5MTk0NTY&ixlib=rb-4.1.0&q=80&w=1080',
};

export const MOCK_DATA: GanttTask[] = [
  {
    id: 'EPIC-1',
    title: 'Customer Portal Redesign',
    type: 'epic',
    startDate: subDays(today, 10),
    endDate: addDays(today, 30),
    progress: 35,
    source: 'jira',
    isExpanded: true,
    children: [
      {
        id: 'STORY-101',
        title: 'Authentication Flow UI',
        type: 'story',
        startDate: subDays(today, 10),
        endDate: addDays(today, 5),
        progress: 80,
        source: 'jira',
        isExpanded: true,
        assignee: { name: 'Sarah J.', avatar: avatars.sarah },
        children: [
          {
            id: 'TASK-1001',
            title: 'Design Login Screen',
            type: 'task',
            startDate: subDays(today, 10),
            endDate: subDays(today, 2),
            progress: 100,
            source: 'jira',
            assignee: { name: 'Sarah J.', avatar: avatars.sarah }
          },
          {
            id: 'TASK-1002',
            title: 'Implement OAuth Callbacks',
            type: 'task',
            startDate: subDays(today, 2),
            endDate: addDays(today, 5),
            progress: 40,
            source: 'jira',
            assignee: { name: 'James T.', avatar: avatars.james }
          }
        ]
      },
      {
        id: 'STORY-102',
        title: 'Dashboard Widget System',
        type: 'story',
        startDate: addDays(today, 2),
        endDate: addDays(today, 20),
        progress: 10,
        source: 'linear',
        isExpanded: false,
        assignee: { name: 'Alex M.', avatar: avatars.alex },
        children: [
          {
            id: 'TASK-1003',
            title: 'Build Chart Components',
            type: 'task',
            startDate: addDays(today, 2),
            endDate: addDays(today, 10),
            progress: 25,
            source: 'linear',
            assignee: { name: 'Alex M.', avatar: avatars.alex }
          },
          {
            id: 'TASK-1004',
            title: 'API Integration for Metrics',
            type: 'task',
            startDate: addDays(today, 10),
            endDate: addDays(today, 20),
            progress: 0,
            source: 'github',
            assignee: { name: 'James T.', avatar: avatars.james }
          }
        ]
      }
    ]
  },
  {
    id: 'EPIC-2',
    title: 'Q2 Marketing Site Launch',
    type: 'epic',
    startDate: subDays(today, 2),
    endDate: addDays(today, 45),
    progress: 15,
    source: 'asana',
    isExpanded: true,
    children: [
      {
        id: 'STORY-201',
        title: 'Landing Page Revamp',
        type: 'story',
        startDate: subDays(today, 2),
        endDate: addDays(today, 14),
        progress: 45,
        source: 'asana',
        assignee: { name: 'Sarah J.', avatar: avatars.sarah },
        isExpanded: true,
        children: [
          {
            id: 'TASK-2001',
            title: 'Hero Section Assets',
            type: 'task',
            startDate: subDays(today, 2),
            endDate: addDays(today, 4),
            progress: 90,
            source: 'asana',
            assignee: { name: 'Sarah J.', avatar: avatars.sarah }
          },
          {
            id: 'TASK-2002',
            title: 'Responsive Layout Polish',
            type: 'task',
            startDate: addDays(today, 3),
            endDate: addDays(today, 14),
            progress: 10,
            source: 'asana',
            assignee: { name: 'Alex M.', avatar: avatars.alex }
          }
        ]
      },
      {
        id: 'STORY-202',
        title: 'SEO Optimizations',
        type: 'story',
        startDate: addDays(today, 15),
        endDate: addDays(today, 30),
        progress: 0,
        source: 'github',
        assignee: { name: 'James T.', avatar: avatars.james }
      }
    ]
  }
];