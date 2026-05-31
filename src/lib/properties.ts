import { supabase } from "@/integrations/supabase/client";

export type PropertyType =
  | "bedsitter"
  | "single_room"
  | "one_bedroom"
  | "two_bedroom"
  | "three_bedroom"
  | "studio"
  | "hostel"
  | "maisonette"
  | "bungalow"
  | "townhouse";

export interface Property {
  id: string;
  owner_id: string | null;
  title: string;
  property_type: PropertyType;
  neighborhood: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rent_kes: number;
  deposit_kes: number | null;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  description: string | null;
  amenities: string[];
  images: string[];
  video_url: string | null;
  is_verified: boolean;
  is_active: boolean;
  available_from: string | null;
  views: number;
  created_at: string;
  updated_at: string;
}

export const formatKes = (n: number) => "KES " + n.toLocaleString("en-KE");

export const prettyType = (t: PropertyType) =>
  ({
    bedsitter: "Bedsitter",
    single_room: "Single Room",
    one_bedroom: "1 Bedroom",
    two_bedroom: "2 Bedroom",
    three_bedroom: "3 Bedroom",
    studio: "Studio",
    hostel: "Hostel",
    maisonette: "Maisonette",
    bungalow: "Bungalow",
    townhouse: "Townhouse",
  })[t];

export async function fetchProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Property[];
}

export async function fetchProperty(id: string): Promise<Property | null> {
  const { data, error } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Property | null;
}
