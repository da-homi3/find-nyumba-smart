/** Cloudflare Worker bindings (Nitro sets globalThis.__env__ per request). */
export type WorkersAiBinding = {
  run: (
    model: string,
    inputs: {
      messages?: Array<{ role: string; content: string }>;
      prompt?: string;
      max_tokens?: number;
    },
  ) => Promise<{ response?: string } | string>;
};

type EnvHolder = { __env__?: Record<string, unknown> };

function resolveAiBinding(ai: unknown): WorkersAiBinding | undefined {
  return ai && typeof ai === "object" && typeof (ai as WorkersAiBinding).run === "function"
    ? (ai as WorkersAiBinding)
    : undefined;
}

export function setWorkerBindings(env: Record<string, unknown>) {
  // Kept for server.ts wrapper; production Nitro uses __env__ directly.
  const g = globalThis as EnvHolder;
  g.__env__ = { ...g.__env__, ...env };
}

export function getWorkersAi(): WorkersAiBinding | undefined {
  const env = (globalThis as EnvHolder).__env__;
  return resolveAiBinding(env?.AI);
}
