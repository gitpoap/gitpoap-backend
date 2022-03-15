import { DateTime } from 'luxon';

export function getLastMonthStartDay(): string {
  const lastMonth = DateTime.now().minus({ days: 30 });
  return lastMonth.toFormat('yyyy-MM-dd');
}

export function getLastMonthStartDatetime(): Date {
  return new Date(getLastMonthStartDay());
}
