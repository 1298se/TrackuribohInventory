export function formatTimeRange(days: number): string {
  if (days === 7) return "7 days";
  if (days === 30) return "30 days";
  if (days === 90) return "3 months";
  if (days === 365) return "1 year";

  // Fallback for other values
  if (days < 30) return `${days} days`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months} month${months > 1 ? "s" : ""}`;
  }

  const years = Math.round(days / 365);
  return `${years} year${years > 1 ? "s" : ""}`;
}
