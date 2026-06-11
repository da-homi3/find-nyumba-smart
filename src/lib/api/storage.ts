import type { KVNamespace } from "@cloudflare/workers-types";

/**
 * Helper to get the KV namespace from the request context.
 * In TanStack Start server functions, `context.env` provides the KV bindings.
 */
export function getKV(context: any): KVNamespace {
  if (!context?.env?.NYUMBA) {
    throw new Error("KV namespace 'NYUMBA' not configured in env");
  }
  return context.env.NYUMBA as KVNamespace;
}

/** Listings */
export async function getListing(context: any, id: string) {
  const kv = getKV(context);
  const raw = await kv.get(`listing:${id}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function setListing(context: any, id: string, data: any) {
  const kv = getKV(context);
  await kv.put(`listing:${id}`, JSON.stringify(data));
}

/** Users */
export async function getUser(context: any, userId: string) {
  const kv = getKV(context);
  const raw = await kv.get(`user:${userId}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function setUser(context: any, userId: string, data: any) {
  const kv = getKV(context);
  await kv.put(`user:${userId}`, JSON.stringify(data));
}

/** Chats */
export async function getChatMessages(context: any, conversationId: string) {
  const kv = getKV(context);
  const raw = await kv.get(`chat:${conversationId}`);
  if (!raw) return [];
  return JSON.parse(raw) as Array<{ from: string; content: string; timestamp: string }>;
}

export async function addChatMessage(
  context: any,
  conversationId: string,
  message: { from: string; content: string },
) {
  const kv = getKV(context);
  const messages = await getChatMessages(context, conversationId);
  const enriched = {
    ...message,
    timestamp: new Date().toISOString(),
  };
  messages.push(enriched);
  await kv.put(`chat:${conversationId}`, JSON.stringify(messages));
  return enriched;
}
