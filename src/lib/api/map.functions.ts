import { createServerFn } from "@tanstack/react-start";

export type MapboxConfig = {
  token: string | null;
  enabled: boolean;
};

/** Public Mapbox token — safe to expose to the browser (pk.* only). */
export const getMapboxPublicToken = createServerFn({ method: "GET" }).handler(
  async (): Promise<MapboxConfig> => {
    const fromEnv =
      process.env.MAPBOX_PUBLIC_TOKEN?.trim() ?? process.env.VITE_MAPBOX_TOKEN?.trim() ?? "";

    if (!fromEnv.startsWith("pk.")) {
      return { token: null, enabled: false };
    }

    return { token: fromEnv, enabled: true };
  },
);
