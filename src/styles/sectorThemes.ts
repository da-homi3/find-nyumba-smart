/**
 * Portal sector visual tokens for ambient backgrounds.
 * Keep motion subtle — portals are workspaces, not marketing heroes.
 */

export type PortalSector =
  | "tenant"
  | "landlord"
  | "agency"
  | "property_developer"
  | "agent"
  | "admin"
  | "caretaker";

export type SectorAmbientKind = "particles" | "breathe" | "grid" | "none";

export type SectorTheme = {
  ambient: SectorAmbientKind;
  /** CSS color used by particle / grid accents */
  accent: string;
  /** Soft wash under the ambient layer */
  washFrom: string;
  washTo: string;
};

export const SECTOR_THEMES: Record<PortalSector, SectorTheme> = {
  tenant: {
    ambient: "particles",
    accent: "rgba(10, 143, 61, 0.22)",
    washFrom: "rgba(10, 143, 61, 0.06)",
    washTo: "transparent",
  },
  landlord: {
    ambient: "breathe",
    accent: "rgba(92, 61, 46, 0.18)",
    washFrom: "rgba(139, 94, 60, 0.08)",
    washTo: "rgba(250, 246, 240, 0.0)",
  },
  agency: {
    ambient: "grid",
    accent: "rgba(30, 64, 120, 0.14)",
    washFrom: "rgba(30, 64, 120, 0.05)",
    washTo: "transparent",
  },
  property_developer: {
    ambient: "grid",
    accent: "rgba(55, 48, 110, 0.12)",
    washFrom: "rgba(55, 48, 110, 0.05)",
    washTo: "transparent",
  },
  agent: {
    ambient: "grid",
    accent: "rgba(20, 90, 90, 0.12)",
    washFrom: "rgba(20, 90, 90, 0.05)",
    washTo: "transparent",
  },
  admin: {
    ambient: "none",
    accent: "transparent",
    washFrom: "transparent",
    washTo: "transparent",
  },
  caretaker: {
    ambient: "none",
    accent: "transparent",
    washFrom: "transparent",
    washTo: "transparent",
  },
};

export function resolveSectorTheme(sector: PortalSector): SectorTheme {
  return SECTOR_THEMES[sector];
}
