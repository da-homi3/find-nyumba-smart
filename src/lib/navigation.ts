/** Build a path+query redirect string safe for TanStack Router auth search params. */
export function currentRedirectPath(location: {
  pathname: string;
  searchStr?: string;
  hash?: string;
}): string {
  return `${location.pathname}${location.searchStr ?? ""}${location.hash ?? ""}`;
}
