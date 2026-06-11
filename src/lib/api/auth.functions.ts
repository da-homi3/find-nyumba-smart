import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import jwt from "jsonwebtoken";

const cfAccessMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const token = request?.headers.get("CF-Access-Token");
  if (!token) throw new Error("Missing Cloudflare Access token");
  const payload = jwt.decode(token);
  if (!payload) throw new Error("Invalid Cloudflare Access token");
  return next({ context: { cfUser: payload } });
});

export const getUser = createServerFn({ method: "GET" })
  .middleware([cfAccessMiddleware])
  .handler(async ({ context }) => {
    const ctx = context as { cfUser?: unknown };
    return { user: ctx.cfUser ?? null };
  });
