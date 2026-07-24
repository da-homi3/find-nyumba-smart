import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type PmPortal = "landlord" | "agency" | "manager";

export function pmBasePath(portal: PmPortal): string {
  return `/${portal}/manage`;
}

const OVERVIEW = {
  landlord: "/landlord/manage/$propertyId",
  agency: "/agency/manage/$propertyId",
  manager: "/manager/manage/$propertyId",
} as const;
const UNITS = {
  landlord: "/landlord/manage/$propertyId/units",
  agency: "/agency/manage/$propertyId/units",
  manager: "/manager/manage/$propertyId/units",
} as const;
const TENANTS = {
  landlord: "/landlord/manage/$propertyId/tenants",
  agency: "/agency/manage/$propertyId/tenants",
  manager: "/manager/manage/$propertyId/tenants",
} as const;
const RENT = {
  landlord: "/landlord/manage/$propertyId/rent",
  agency: "/agency/manage/$propertyId/rent",
  manager: "/manager/manage/$propertyId/rent",
} as const;
const MAINTENANCE = {
  landlord: "/landlord/manage/$propertyId/maintenance",
  agency: "/agency/manage/$propertyId/maintenance",
  manager: "/manager/manage/$propertyId/maintenance",
} as const;

type PmPropertySubnavProps = Readonly<{
  portal: PmPortal;
  propertyId: string;
  active: "overview" | "units" | "tenants" | "rent" | "maintenance";
}>;

export function PmPropertySubnav({ portal, propertyId, active }: PmPropertySubnavProps) {
  const params = { propertyId };
  const items = [
    { id: "overview" as const, to: OVERVIEW[portal], label: "Overview" },
    { id: "units" as const, to: UNITS[portal], label: "Units" },
    { id: "tenants" as const, to: TENANTS[portal], label: "Tenants" },
    { id: "rent" as const, to: RENT[portal], label: "Rent" },
    { id: "maintenance" as const, to: MAINTENANCE[portal], label: "Maintenance" },
  ];
  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.to}
          params={params}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm",
            active === item.id
              ? "bg-foreground text-background font-semibold"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
