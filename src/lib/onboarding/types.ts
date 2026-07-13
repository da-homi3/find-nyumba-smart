export type TourId =
  | "tenant-browse"
  | "tenant-saved"
  | "tenant-profile"
  | "tenant-messages"
  | "landlord-dashboard"
  | "manager-dashboard"
  | "agency-dashboard"
  | "caretaker-dashboard"
  | "provider-dashboard"
  | "admin-dashboard"
  | "services-directory";

export type TourStep = {
  /** CSS selector; omit for a centered welcome step */
  target?: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
};

export type TourDefinition = {
  id: TourId;
  title: string;
  steps: TourStep[];
};
