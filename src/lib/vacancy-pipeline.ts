import type { Property } from "@/lib/properties";

export const VACANCY_PIPELINE_STAGES = [
  "Just Vacated",
  "Listed",
  "Inquiries Received",
  "Viewing Booked",
  "Filled",
] as const;

export type VacancyPipelineStage = (typeof VACANCY_PIPELINE_STAGES)[number];

type ViewingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export function classifyVacancyStage(
  property: Pick<Property, "id" | "is_active" | "is_vacant" | "created_at">,
  opts: {
    inquiryCount: number;
    viewingStatus?: ViewingStatus | null;
  },
): VacancyPipelineStage {
  const isVacant = property.is_vacant !== false;
  if (!isVacant) return "Filled";

  if (opts.viewingStatus === "pending" || opts.viewingStatus === "confirmed") {
    return "Viewing Booked";
  }
  if (opts.inquiryCount > 0) return "Inquiries Received";
  if (property.is_active && isVacant) return "Listed";

  const created = new Date(property.created_at).getTime();
  const daysSinceCreated = (Date.now() - created) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated <= 14) return "Just Vacated";

  return "Listed";
}

export function groupPropertiesByPipelineStage<T extends Property>(
  properties: T[],
  inquiryCountByProperty: Map<string, number>,
  viewingStatusByProperty: Map<string, ViewingStatus>,
): Record<VacancyPipelineStage, T[]> {
  const grouped = Object.fromEntries(
    VACANCY_PIPELINE_STAGES.map((stage) => [stage, [] as T[]]),
  ) as Record<VacancyPipelineStage, T[]>;

  for (const property of properties) {
    const stage = classifyVacancyStage(property, {
      inquiryCount: inquiryCountByProperty.get(property.id) ?? 0,
      viewingStatus: viewingStatusByProperty.get(property.id) ?? null,
    });
    grouped[stage].push(property);
  }

  return grouped;
}
