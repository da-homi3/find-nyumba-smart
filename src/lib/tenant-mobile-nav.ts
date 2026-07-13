/** Routes where the fixed tenant bottom nav should appear (mobile only). */
export function shouldShowTenantBottomNav(pathname: string): boolean {
  if (
    pathname.startsWith("/landlord") ||
    pathname.startsWith("/manager") ||
    pathname.startsWith("/agency") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/caretaker") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/services/provider")
  ) {
    return false;
  }

  if (
    pathname.startsWith("/tenant/checkout") ||
    pathname.startsWith("/tenant/compare") ||
    pathname.startsWith("/tenant/review")
  ) {
    return false;
  }

  // Full-screen conversation thread — no bottom nav.
  if (/^\/tenant\/messages\/[^/]+/.test(pathname)) {
    return false;
  }

  return pathname === "/" || pathname.startsWith("/tenant");
}
