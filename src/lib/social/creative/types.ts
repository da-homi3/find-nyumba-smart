/**
 * NyumbaSearch social creative intelligence — types.
 * Metrics may be null. Never invent numbers.
 */

export type SocialCreativePlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "linkedin"
  | "x"
  | "whatsapp";

export type ContentFormat =
  | "reel"
  | "tiktok"
  | "youtube_short"
  | "carousel"
  | "checklist"
  | "single_image"
  | "meme"
  | "infographic"
  | "story"
  | "poll"
  | "question"
  | "property_tour"
  | "talking_head"
  | "pov"
  | "interview"
  | "mini_documentary"
  | "cinematic"
  | "asmr"
  | "screen_recording"
  | "before_after"
  | "comparison"
  | "ugc_style"
  | "text_post";

export type FunnelStage = "AWARENESS" | "INTEREST" | "CONSIDERATION" | "HIGH_INTENT" | "CONVERSION";

export type Audience =
  | "house_hunter"
  | "property_owner"
  | "property_manager"
  | "service_provider"
  | "mixed";

export type BusinessObjective =
  | "owner_acquisition"
  | "hunter_acquisition"
  | "provider_acquisition"
  | "property_enquiry"
  | "app_install"
  | "website_search"
  | "brand_authority"
  | "engagement"
  | "lead_generation";

export type ContentPostRecord = {
  post_id: string;
  platform: SocialCreativePlatform;
  date: string;
  content_type: ContentFormat;
  topic: string;
  audience: Audience;
  hook: string;
  location: string | null;
  property_type: string | null;
  visual_style: string;
  audio: string | null;
  caption_style: string;
  cta: string;
  destination_url: string | null;
  status: "draft" | "published" | "unpublished";
  /** All performance fields are null until measured. Do not fill with estimates. */
  reach: number | null;
  views: number | null;
  watch_time: number | null;
  completion_rate: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  profile_visits: number | null;
  link_clicks: number | null;
  leads: number | null;
  registrations: number | null;
  provider_signups: number | null;
  property_listings: number | null;
  conversion_rate: number | null;
  performance_score: number | null;
  notes: string;
};

export type CreativeMemory = {
  updated_at: string;
  posts: ContentPostRecord[];
  learnings: string[];
};

export type ScoreBreakdown = {
  attention: number;
  relevance: number;
  brandFit: number;
  leadPotential: number;
  shareability: number;
  savePotential: number;
  searchability: number;
  culturalRelevance: number;
  novelty: number;
  total: number;
  viralScore: number;
  businessScore: number;
};

export type CreativeConcept = {
  id: string;
  letter: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
  name: string;
  mechanism: string;
  /** What inspired the mechanism (not a script to copy). */
  inspirationNotes: string[];
  nyumbaSpin: string;
  format: ContentFormat;
  objective: BusinessObjective;
  audience: Audience;
  funnel: FunnelStage;
  searchIntent: string;
  hook: string;
  keyMessage: string;
  cta: string;
  expectedAction: string;
  destination: string;
  kenyanContext: string;
  requiresVerifiedFacts: boolean;
  fatigueTags: string[];
};

export type QualityGateResult = {
  pass: boolean;
  answers: Record<string, "yes" | "weak" | "no">;
  reasons: string[];
};

export type CreativeBrief = {
  selected: CreativeConcept;
  scores: ScoreBreakdown;
  alternatives: Array<{ concept: CreativeConcept; scores: ScoreBreakdown }>;
  fatigue: string[];
  quality: QualityGateResult;
  reel?: ReelPackage;
  caption: string;
  hashtags: string[];
  locationTag: string;
  destinationUrl: string;
  warnings: string[];
};

export type ReelPackage = {
  concept: string;
  objective: BusinessObjective;
  targetAudience: Audience;
  hook1to3s: string;
  script: string[];
  shotList: string[];
  camera: string[];
  onScreenText: string[];
  voiceover: string[];
  audioDirection: string;
  transitions: string;
  broll: string[];
  ending: string;
  cta: string;
};
