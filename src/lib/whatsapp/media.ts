import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { downloadMedia } from "@/lib/whatsapp/client";

type Admin = SupabaseClient<Database>;

export async function uploadWhatsAppPhoto(
  admin: Admin,
  mediaId: string,
  ownerKey: string,
): Promise<string> {
  const buffer = await downloadMedia(mediaId);
  const path = `whatsapp/${ownerKey}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`;

  const { error } = await admin.storage.from("property-media").upload(path, buffer, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const { data: signed } = await admin.storage
    .from("property-media")
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  if (!signed?.signedUrl) throw new Error("Could not sign uploaded photo URL");
  return signed.signedUrl;
}
