import { redirect } from "@tanstack/react-router";
import type { GuardPortal } from "@/lib/route-guards/portal-access";
import { resolvePortalRouteAccess } from "@/lib/api/portal-access.functions";

/** Server-side portal guard for TanStack Router layout routes. */
export function createPortalBeforeLoad(portal: GuardPortal) {
  return async ({ location }: { location: { pathname: string } }) => {
    const result = await resolvePortalRouteAccess({
      data: { portal, pathname: location.pathname },
    });
    if (result.allowed) return;
    throw redirect({
      to: result.redirect.to,
      search: result.redirect.search,
      replace: true,
    });
  };
}
