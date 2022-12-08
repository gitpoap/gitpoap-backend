import { DateTime } from 'luxon';
import { POAP_DATE_FORMAT } from '../../constants';

export function getXDaysAgoStartDay(days: number): string {
  const lastMonth = DateTime.now().minus({ days });
  return lastMonth.toFormat(POAP_DATE_FORMAT);
}

export function getXDaysAgoStartDatetime(days: number): Date {
  return new Date(getXDaysAgoStartDay(days));
}

export function getLastMonthStartDatetime(): Date {
  return new Date(getXDaysAgoStartDay(30));
}
