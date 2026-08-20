/** IndexNow ownership key — also served at `/{key}.txt` on the Worker. */
export const INDEXNOW_KEY = "eadbba7a0a778ba26d383e00d30c2784";

export function indexNowKeyPath(): string {
  return `/${INDEXNOW_KEY}.txt`;
}

export function indexNowKeyLocation(siteUrl: string): string {
  return `${siteUrl.replace(/\/$/, "")}${indexNowKeyPath()}`;
}
