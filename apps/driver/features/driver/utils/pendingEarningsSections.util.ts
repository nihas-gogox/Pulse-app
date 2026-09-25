/** UPI-style date section label: Today, Yesterday, or "5 Mar" */
export function formatPendingEarningsSectionLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dDate = d.getDate();
  const dMonth = d.getMonth();
  const dYear = d.getFullYear();
  if (
    dDate === today.getDate() &&
    dMonth === today.getMonth() &&
    dYear === today.getFullYear()
  ) {
    return 'Today';
  }
  if (
    dDate === yesterday.getDate() &&
    dMonth === yesterday.getMonth() &&
    dYear === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function groupTripsByDateSection<T extends { rawDate: string }>(
  items: T[],
): { sectionLabel: string; dateKey: string; items: T[] }[] {
  const bySection: { sectionLabel: string; dateKey: string; items: T[] }[] = [];
  let currentKey = '';
  let currentGroup: T[] = [];

  for (const item of items) {
    const raw = item.rawDate || '';
    const dateKey = raw ? new Date(raw).toISOString().slice(0, 10) : '';
    if (dateKey !== currentKey) {
      if (currentGroup.length > 0) {
        bySection.push({
          sectionLabel: formatPendingEarningsSectionLabel(currentGroup[0].rawDate),
          dateKey: currentKey,
          items: currentGroup,
        });
      }
      currentKey = dateKey;
      currentGroup = [item];
    } else {
      currentGroup.push(item);
    }
  }

  if (currentGroup.length > 0) {
    bySection.push({
      sectionLabel: formatPendingEarningsSectionLabel(currentGroup[0].rawDate),
      dateKey: currentKey,
      items: currentGroup,
    });
  }

  return bySection;
}
