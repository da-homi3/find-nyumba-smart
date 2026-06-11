import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getKV } from "./storage";

// List all listings with optional pagination & filters (price, location)
export const listListings = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
    }),
  )
  .handler(async ({ context, data }: { context: any; data: any }) => {
    const kv = getKV(context);
    const list = await kv.list({ prefix: "" });
    const keys = list.keys.map((k: { name: string }) => k.name);
    const items = await Promise.all(keys.map((k) => kv.get(k, { type: "json" })));
    let filtered = items.filter(Boolean) as any[];
    if (data?.minPrice !== undefined) {
      filtered = filtered.filter((i) => i.price >= data.minPrice);
    }
    if (data?.maxPrice !== undefined) {
      filtered = filtered.filter((i) => i.price <= data.maxPrice);
    }
    const offset = data?.offset ?? 0;
    const limit = data?.limit ?? 20;
    return filtered.slice(offset, offset + limit);
  });

// Create a new listing – only landlords can call this (auth handled elsewhere)
export const createListing = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      price: z.number().positive(),
      address: z.string().min(1),
      lat: z.number(),
      lng: z.number(),
      images: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ context, data }: { context: any; data: any }) => {
    const kv = getKV(context);
    const id = crypto.randomUUID();
    const record = {
      id,
      ...data,
      landlordId: (context as any).userId,
      createdAt: new Date().toISOString(),
    };
    await kv.put(id, JSON.stringify(record));
    return record;
  });

// Save / unsave a listing for a tenant
export const toggleSaveListing = createServerFn({ method: "POST" })
  .inputValidator(z.object({ listingId: z.string() }))
  .handler(async ({ context, data }: { context: any; data: any }) => {
    const kv = getKV(context);
    const uid = (context as any).userId;
    const userRaw = await kv.get(uid, { type: "json" });
    if (!userRaw) throw new Error("User not found");
    const user = userRaw as any;
    const saved = new Set(user.savedListings ?? []);
    if (saved.has(data.listingId)) saved.delete(data.listingId);
    else saved.add(data.listingId);
    user.savedListings = Array.from(saved);
    await kv.put(uid, JSON.stringify(user));
    return { saved: user.savedListings };
  });
