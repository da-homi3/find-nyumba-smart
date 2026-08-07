export const NOTIFICATION_TYPES = [
  "announcement",
  "listing_match",
  "message",
  "lead",
  "portal",
  "account",
  "maintenance_new",
  "maintenance_update",
  "maintenance_confirm",
  "complaint_new",
  "complaint_reply",
  "rent",
  "payment",
  "system",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationCategory =
  | "announcements"
  | "listings"
  | "messages"
  | "maintenance"
  | "payments"
  | "account";

export const TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory> = {
  announcement: "announcements",
  listing_match: "listings",
  message: "messages",
  lead: "messages",
  portal: "account",
  account: "account",
  maintenance_new: "maintenance",
  maintenance_update: "maintenance",
  maintenance_confirm: "maintenance",
  complaint_new: "maintenance",
  complaint_reply: "maintenance",
  rent: "payments",
  payment: "payments",
  system: "account",
};

export type NotificationPreferences = {
  announcements: boolean;
  listings: boolean;
  messages: boolean;
  maintenance: boolean;
  payments: boolean;
  account: boolean;
  push_enabled: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  announcements: true,
  listings: true,
  messages: true,
  maintenance: true,
  payments: true,
  account: true,
  push_enabled: true,
};

export type NotifyPayload = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};
