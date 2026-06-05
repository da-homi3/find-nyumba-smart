import { createServerFn } from "@tanstack/react-start";
import jwt from "jsonwebtoken";

// Middleware to verify Cloudflare Access token (JWT) from request headers
export const requireCfAccess = async ({ request }: { request: Request }) => {
  const token = request.headers.get("CF-Access-Token");
  if (!token) throw new Error("Missing Cloudflare Access token");
  // For demo purposes we skip actual verification; in production verify against CF Access public key
  try {
    // @ts-ignore – placeholder verification
    const payload = jwt.decode(token);
    if (!payload) throw new Error("Invalid token");
    // attach user info to context
    return { user: payload };
  } catch (e) {
    throw new Error("Invalid Cloudflare Access token");
  }
};

export const getUser = createServerFn({ method: "GET" })
  .middleware([requireCfAccess])
  .handler(async ({ context }) => {
    // @ts-ignore – context from middleware
    const { user } = context;
    return { user };
  });
