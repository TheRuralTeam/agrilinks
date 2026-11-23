const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const NOW_PURCHASE_WINDOW_DAYS = 5;

export function isAvailableForImmediatePurchase(
  harvestDate: string | null | undefined,
  now = new Date(),
): boolean {
  const dateParts = harvestDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateParts) return false;

  const [, yearValue, monthValue, dayValue] = dateParts;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const harvestDay = Date.UTC(year, month - 1, day);
  const parsedHarvestDate = new Date(harvestDay);

  if (
    parsedHarvestDate.getUTCFullYear() !== year ||
    parsedHarvestDate.getUTCMonth() !== month - 1 ||
    parsedHarvestDate.getUTCDate() !== day
  ) {
    return false;
  }

  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntilHarvest = (harvestDay - today) / DAY_IN_MILLISECONDS;

  return daysUntilHarvest < NOW_PURCHASE_WINDOW_DAYS;
}
