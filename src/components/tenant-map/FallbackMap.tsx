import { formatKes, type Property } from "@/lib/properties";
import { compactKes, projectToFallbackMap } from "./map-constants";

export function FallbackMap({
  properties,
  selected,
  showHeat,
  onSelect,
}: Readonly<{
  properties: Property[];
  selected: Property | null;
  showHeat: boolean;
  onSelect: (property: Property) => void;
}>) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0e1a14]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(201,168,76,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(201,168,76,0.08)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_35%,rgba(13,79,60,0.85),transparent_32%),radial-gradient(circle_at_68%_58%,rgba(201,168,76,0.28),transparent_26%),radial-gradient(circle_at_52%_78%,rgba(255,107,53,0.18),transparent_24%)]" />
      <div className="absolute left-[16%] top-[34%] h-28 w-[68%] rotate-[-14deg] rounded-full border-y border-gold/25" />
      <div className="absolute left-[8%] top-[55%] h-20 w-[86%] rotate-[10deg] rounded-full border-y border-primary/35" />

      {["Westlands", "Kilimani", "Lavington", "Karen", "Kasarani"].map((hood, i) => (
        <span
          key={hood}
          className="absolute rounded-full bg-background/10 px-2 py-1 text-[10px] font-semibold text-background/60 backdrop-blur"
          style={{
            left: `${[30, 45, 39, 24, 72][i]}%`,
            top: `${[36, 51, 44, 66, 26][i]}%`,
          }}
        >
          {hood}
        </span>
      ))}

      {showHeat &&
        properties.map((p) => {
          const point = projectToFallbackMap(p);
          const size = Math.min(120, 44 + p.rent_kes / 2500);
          return (
            <span
              key={`heat-${p.id}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/20 blur-md"
              style={{ ...point, width: size, height: size }}
            />
          );
        })}

      {properties.map((p) => {
        const point = projectToFallbackMap(p);
        const active = selected?.id === p.id;
        return (
          <button
            type="button"
            key={p.id}
            onClick={() => onSelect(p)}
            className={`absolute -translate-x-1/2 -translate-y-full rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-elegant transition ${
              active
                ? "z-20 border-background bg-gradient-gold text-gold-foreground"
                : "z-10 border-background/70 bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
            style={point}
            aria-label={`${p.title}, ${formatKes(p.rent_kes)}`}
          >
            {compactKes(p.rent_kes).replaceAll("KES ", "")}
          </button>
        );
      })}
    </div>
  );
}
