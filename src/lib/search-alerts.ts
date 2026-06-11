export type SearchAlert = {
  id: string;
  neighborhood: string;
  propertyType: string;
  maxBudget: number;
  frequency: "instant" | "daily" | "weekly";
  enabled: boolean;
  createdAt: string;
};

const KEY = "nyumba_search_alerts";

export function listSearchAlerts(): SearchAlert[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SearchAlert[];
  } catch {
    return [];
  }
}

export function saveSearchAlerts(alerts: SearchAlert[]) {
  localStorage.setItem(KEY, JSON.stringify(alerts));
}

export function addSearchAlert(
  alert: Omit<SearchAlert, "id" | "createdAt" | "enabled">,
): SearchAlert {
  const next: SearchAlert = {
    ...alert,
    id: crypto.randomUUID(),
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  const all = [...listSearchAlerts(), next];
  saveSearchAlerts(all);
  return next;
}

export function toggleSearchAlert(id: string, enabled: boolean) {
  const all = listSearchAlerts().map((a) => (a.id === id ? { ...a, enabled } : a));
  saveSearchAlerts(all);
}

export function removeSearchAlert(id: string) {
  saveSearchAlerts(listSearchAlerts().filter((a) => a.id !== id));
}

export function formatAlertLabel(a: SearchAlert) {
  const type = a.propertyType === "any" ? "Any type" : a.propertyType.replace("_", " ");
  return `${type} in ${a.neighborhood} under KES ${a.maxBudget.toLocaleString()}`;
}
