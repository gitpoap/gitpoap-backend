import { DateTime } from 'luxon';

export function getLastWeekStartDay(): Date {
  const lastWeek = DateTime.now().minus({ days: 7 });
  const lastWeekStartDay = lastWeek.toFormat('yyyy-MM-dd');
  return new Date(lastWeekStartDay);
}
