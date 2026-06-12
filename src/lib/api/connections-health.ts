import { isMpesaConfigured } from "@/lib/api/mpesa";
import { getWorkersAi } from "@/lib/worker-bindings";

export type ConnectionStatus = {
  name: string;
  status: "ok" | "degraded" | "missing";
  detail: string;
};

export async function checkConnections(): Promise<ConnectionStatus[]> {
  const results: ConnectionStatus[] = [];

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  results.push({
    name: "supabase",
    status: supabaseUrl && supabaseKey ? "ok" : "missing",
    detail: supabaseUrl && supabaseKey ? "URL + anon key configured" : "Set SUPABASE_URL and keys",
  });

  if (supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      const { error } = await admin.from("properties").select("id").limit(1);
      results.push({
        name: "supabase_db",
        status: error ? "degraded" : "ok",
        detail: error?.message ?? "properties table reachable",
      });
    } catch (e) {
      results.push({
        name: "supabase_db",
        status: "degraded",
        detail: e instanceof Error ? e.message : "DB check failed",
      });
    }
  }

  const gemini = Boolean(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY);
  const workersAi = Boolean(getWorkersAi());
  results.push({
    name: "nyumba_ai",
    status: gemini || workersAi ? "ok" : "missing",
    detail: gemini ? "Gemini API" : workersAi ? "Cloudflare Workers AI" : "No AI provider",
  });

  results.push({
    name: "sendgrid",
    status: process.env.SENDGRID_API_KEY ? "ok" : "degraded",
    detail: process.env.SENDGRID_API_KEY
      ? "Email notifications enabled"
      : "Emails skipped until SENDGRID_API_KEY is set",
  });

  results.push({
    name: "mpesa",
    status: isMpesaConfigured() ? "ok" : "degraded",
    detail: isMpesaConfigured()
      ? `Daraja ${process.env.MPESA_ENV ?? "sandbox"}`
      : "Demo payments until MPESA_* vars are set",
  });

  results.push({
    name: "google_maps",
    status: process.env.VITE_GOOGLE_MAPS_API_KEY ? "ok" : "degraded",
    detail: process.env.VITE_GOOGLE_MAPS_API_KEY
      ? "Maps API key in client build"
      : "CSS fallback map (rebuild after adding VITE_GOOGLE_MAPS_API_KEY)",
  });

  return results;
}
