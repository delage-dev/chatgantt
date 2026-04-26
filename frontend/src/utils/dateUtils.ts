import { startOfDay, differenceInDays, addDays, format, isSameDay } from 'date-fns';

export const CELL_WIDTH = 48; // px per day
export const DAYS_TO_SHOW = 30; // legacy default
export const BUFFER_DAYS = 5; // scroll edge detection buffer
export const EXTEND_DAYS = 14; // days to add when extending

/** Parse an ISO date string to a Date at start of day */
export function parseDate(iso: string): Date {
  return startOfDay(new Date(iso + 'T00:00:00'));
}

/** Format a Date as ISO date string "YYYY-MM-DD" */
export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Convert a pixel offset to a number of days */
export function pxToDays(px: number): number {
  return Math.round(px / CELL_WIDTH);
}

/** Convert a number of days to a pixel offset */
export function daysToPx(days: number): number {
  return days * CELL_WIDTH;
}

/** Get the pixel left position of a task relative to the timeline origin */
export function getTaskLeft(startDate: string, timelineStart: Date): number {
  const start = parseDate(startDate);
  const offset = differenceInDays(start, timelineStart);
  return Math.max(0, offset * CELL_WIDTH);
}

/** Get the pixel width of a task */
export function getTaskWidth(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const duration = differenceInDays(end, start) + 1; // inclusive
  return Math.max(CELL_WIDTH, duration * CELL_WIDTH);
}

/** Snap a date by adding a pixel delta */
export function snapDate(originalDate: string, deltaPx: number): string {
  const d = parseDate(originalDate);
  const daysDelta = pxToDays(deltaPx);
  return toISODate(addDays(d, daysDelta));
}

/** Generate an array of dates from start to end (inclusive) */
export function generateDaysArray(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const total = differenceInDays(end, start);
  for (let i = 0; i <= total; i++) {
    days.push(addDays(start, i));
  }
  return days;
}

/** Check if a date is today */
export function isToday(d: Date): boolean {
  return isSameDay(d, startOfDay(new Date()));
}

/** Get the pixel position of today relative to timeline start */
export function getTodayOffset(timelineStart: Date): number {
  const today = startOfDay(new Date());
  return differenceInDays(today, timelineStart) * CELL_WIDTH;
}

/** Determine task risk level based on end date and status */
export type RiskLevel = 'overdue' | 'at-risk' | 'normal';

export function getTaskRiskLevel(endDate: string, status: string, today: Date): RiskLevel {
  const end = parseDate(endDate);
  const statusLower = status.toLowerCase();
  if (statusLower === 'done') return 'normal';
  if (differenceInDays(end, today) < 0) return 'overdue';
  if (differenceInDays(end, today) <= 3 && statusLower === 'to do') return 'at-risk';
  return 'normal';
}
