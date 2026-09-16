export function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const dayIndex = (result.getDay() + 6) % 7; // Monday = 0
  result.setDate(result.getDate() - dayIndex);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
