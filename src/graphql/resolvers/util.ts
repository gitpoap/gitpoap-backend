import { DateTime } from 'luxon';

export function getPastStartDay(days: number): string {
  const lastMonth = DateTime.now().minus({ days });
  return lastMonth.toFormat('yyyy-MM-dd');
}

export function getPastStartDatetime(days: number): Date {
  return new Date(getPastStartDay(days));
}
