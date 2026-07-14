import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "@/lib/random-uuid";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data fresh for 5 min, retain in cache 24h so poor-network /
        // offline sessions can still render the last-known good payload.
        staleTime: 5 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: 2,
        refetchOnWindowFocus: false,
        networkMode: "offlineFirst",
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 60_000,
  });

  return router;
};
