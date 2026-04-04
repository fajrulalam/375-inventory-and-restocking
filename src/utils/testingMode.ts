let _isTestingMode = false;

export function setTestingModeEnabled(value: boolean) {
  _isTestingMode = value;
}

export function isTestingModeEnabled(): boolean {
  return _isTestingMode;
}

/**
 * Prefixes the root segment of a Firestore collection path with "zTesting_"
 * when testing mode is active.
 *
 * Examples (testing ON):
 *   "DailyTransaction"                        → "zTesting_DailyTransaction"
 *   "Canteens/canteen375/DailyStockLogs"       → "zTesting_Canteens/canteen375/DailyStockLogs"
 *
 * When testing is OFF the path is returned unchanged.
 */
export function getCollectionPath(collectionPath: string): string {
  if (!_isTestingMode) return collectionPath;
  const parts = collectionPath.split("/");
  parts[0] = `zTesting_${parts[0]}`;
  return parts.join("/");
}
