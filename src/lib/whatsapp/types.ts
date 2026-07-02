export type WaRole = "unknown" | "tenant" | "landlord" | "agent" | "provider";

export type WaSession = {
  waPhone: string;
  userId: string | null;
  role: WaRole;
  state: string;
  context: Record<string, unknown>;
  lastMessageAt: string;
};

export type WaInboundMessage = {
  id?: string;
  phone: string;
  senderName: string;
  type: string;
  text: string;
  interactiveId: string;
  location?: { latitude: number; longitude: number };
  imageId?: string;
  raw: Record<string, unknown>;
};
