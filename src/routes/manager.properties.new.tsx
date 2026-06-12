import { createFileRoute } from "@tanstack/react-router";
import { PropertyListingWizard } from "./landlord.properties.new";

export const Route = createFileRoute("/manager/properties/new")({
  head: () => ({ meta: [{ title: "Add listing — Property manager — NyumbaSearch" }] }),
  component: () => <PropertyListingWizard portalLabel="Property manager" />,
});
