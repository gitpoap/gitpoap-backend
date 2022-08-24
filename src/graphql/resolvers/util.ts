import { DateTime } from 'luxon';

export function getXDaysAgoStartDay(days: number): string {
  const lastMonth = DateTime.now().minus({ days });
  return lastMonth.toFormat('yyyy-MM-dd');
}

export function getXDaysAgoStartDatetime(days: number): Date {
  return new Date(getXDaysAgoStartDay(days));
}

export function getLastMonthStartDay(): Date {
  return new Date(getXDaysAgoStartDay(30));
}
