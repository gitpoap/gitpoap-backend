import { DateTime } from 'luxon';

export function getLastWeekStartDay(): String {
  const lastWeek = DateTime.now().minus({ days: 7 });
  return lastWeek.toFormat('yyyy-MM-dd');
}

export function getLastWeekStartDatetime(): Date {
  return new Date(getLastWeekStartDay());
}
