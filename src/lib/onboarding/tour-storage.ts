import type { TourId } from "@/lib/onboarding/types";

const STORAGE_VERSION = "v1";
const SIGNUP_PENDING_KEY = "nyumba_signup_tour_pending";

function storageKey(userId: string | null): string {
  return `nyumba_onboarding_${STORAGE_VERSION}:${userId ?? "guest"}`;
}

type CompletedMap = Partial<Record<TourId, true>>;

function readMap(userId: string | null): CompletedMap {
  if (globalThis.localStorage === undefined) return {};
  try {
    const raw = globalThis.localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    return JSON.parse(raw) as CompletedMap;
  } catch {
    return {};
  }
}

function writeMap(userId: string | null, map: CompletedMap): void {
  if (globalThis.localStorage === undefined) return;
  globalThis.localStorage.setItem(storageKey(userId), JSON.stringify(map));
}

export function isTourCompleted(tourId: TourId, userId: string | null): boolean {
  return readMap(userId)[tourId] === true;
}

export function markTourCompleted(tourId: TourId, userId: string | null): void {
  const map = readMap(userId);
  map[tourId] = true;
  writeMap(userId, map);
}

export function resetTour(tourId: TourId, userId: string | null): void {
  const map = readMap(userId);
  delete map[tourId];
  writeMap(userId, map);
}

export function tourIdForSignupRole(role: string): TourId | null {
  if (role === "tenant") return "tenant-browse";
  if (role === "landlord") return "landlord-dashboard";
  if (role === "manager") return "manager-dashboard";
  if (role === "agency") return "agency-dashboard";
  return null;
}

export function markSignupTourPending(role: string): void {
  if (globalThis.sessionStorage === undefined) return;
  globalThis.sessionStorage.setItem(SIGNUP_PENDING_KEY, role);
}

export function peekSignupTourPending(): string | null {
  if (globalThis.sessionStorage === undefined) return null;
  return globalThis.sessionStorage.getItem(SIGNUP_PENDING_KEY);
}

export function consumeSignupTourPending(): string | null {
  if (globalThis.sessionStorage === undefined) return null;
  const role = globalThis.sessionStorage.getItem(SIGNUP_PENDING_KEY);
  if (role) globalThis.sessionStorage.removeItem(SIGNUP_PENDING_KEY);
  return role;
}

export function shouldAutoStartTour(tourId: TourId, userId: string | null): boolean {
  if (isTourCompleted(tourId, userId)) return false;
  const pendingRole = peekSignupTourPending();
  if (pendingRole) {
    return tourIdForSignupRole(pendingRole) === tourId;
  }
  return true;
}
