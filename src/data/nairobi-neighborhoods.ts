export const NAIROBI_NEIGHBORHOODS = [
  "Kilimani",
  "Westlands",
  "Karen",
  "Lavington",
  "Kileleshwa",
  "Kasarani",
  "South B",
  "Roysambu",
  "Parklands",
  "Ngong Road",
  "Embakasi",
  "Ruaraka",
  "Donholm",
  "Buruburu",
  "Langata",
  "Runda",
  "Gigiri",
  "Hurlingham",
  "Upper Hill",
  "CBD",
  "Rongai",
  "Tumaini",
  "Ruaka",
  "Ruiru",
] as const;

export function matchNeighborhood(input: string): string | null {
  const norm = input.trim().toLowerCase();
  if (!norm) return null;
  if (norm.includes("tumaini")) return "Tumaini";
  const exact = NAIROBI_NEIGHBORHOODS.find((n) => n.toLowerCase() === norm);
  if (exact) return exact;
  return (
    NAIROBI_NEIGHBORHOODS.find(
      (n) => norm.includes(n.toLowerCase()) || n.toLowerCase().includes(norm),
    ) ?? null
  );
}
