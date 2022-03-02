export function getLastWeekStartDay(): DateTime {
  const lastWeek = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekStartDay = lastWeek.toISOString().slice(0, 10);
  return new Date(lastWeekStartDay);
}
