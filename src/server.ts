import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { setWorkerBindings } from "./lib/worker-bindings";
import type { ServeMode } from "./lib/app-client";
import { getAppServeContext, withAppClientHeaders } from "./lib/app-client";
import { addSecurityHeaders } from "./lib/security/headers";
import { tryInfrastructureRoute } from "./lib/api/infrastructure-routes";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

function attachRuntimeEnv(env: unknown) {
  if (!env || typeof env !== "object") return;

  setWorkerBindings(env as Record<string, unknown>);

  if (typeof process === "undefined") return;

  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  serverEntryPromise ??= import("@tanstack/react-start/server-entry").then(
    (m) => (m.default ?? m) as ServerEntry,
  );
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function injectServeModeIntoHtml(
  response: Response,
  serveMode: ServeMode,
): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") || serveMode !== "lite") {
    return response;
  }

  const html = await response.text();
  const patched = html.includes("data-serve-mode=")
    ? html
    : html.replace(/<html(\s[^>]*)?>/i, `<html$1 data-serve-mode="lite">`);

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function finalizeResponse(response: Response, request: Request): Promise<Response> {
  const appContext = getAppServeContext(request);
  const secured = addSecurityHeaders(response);
  const withHeaders = withAppClientHeaders(secured, appContext);
  return injectServeModeIntoHtml(withHeaders, appContext.serveMode);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      attachRuntimeEnv(env);

      const infraResponse = await tryInfrastructureRoute(request);
      if (infraResponse) {
        return finalizeResponse(infraResponse, request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return finalizeResponse(normalized, request);
    } catch (error) {
      console.error(error);
      return addSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
